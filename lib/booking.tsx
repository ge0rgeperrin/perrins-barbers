/**
 * The booking flow's state, and the prefetching that makes it feel instant.
 *
 * The rule this file is built around: never make someone wait for something we
 * could already have fetched.
 *
 *   - Hovering or focusing a price row warms the calendar for that pairing.
 *   - Availability arrives a whole month at a time, so every day the customer
 *     taps renders from memory with no network at all.
 *   - The month after the one on screen is fetched quietly in the background, so
 *     paging forward is instant too.
 *   - Picking a time immediately opens the hold while they are still typing
 *     their name, so the final button has only the reservation left to do.
 *
 * Nothing here talks to Schedulista. See server/schedulista.ts for that.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BookingError,
  fetchAvailability,
  openHold,
  reserve,
  type Availability,
  type CustomerDetails,
  type DayView,
  type HoldView,
  type SlotView,
} from './booking-api';
import type { Provider, Service } from './services';
import { addMonths, monthOf, monthsApart, today, type DateKey, type MonthKey } from './calendar';
import { booking as settings } from './content';
import { useServices } from './app-state';

export const STEPS = ['barber', 'service', 'time', 'details', 'done'] as const;
export type Step = (typeof STEPS)[number];

/** How long a cached month is trusted before we ask again. */
const MONTH_TTL_MS = 60_000;

/**
 * How far ahead the calendar will page. Schedulista itself will quote times a
 * year out, but the shop takes bookings three months ahead, so the arrows stop
 * there and the diary never fills up with appointments nobody remembers making.
 *
 * The number lives in content.json so the owners can change it, and the server
 * enforces the same one — the arrows stopping is a courtesy, not the rule.
 */
export const MONTHS_AHEAD = settings.monthsAhead;

/**
 * How far the flow will skip ahead on its own looking for the first free day.
 * A barbershop that is genuinely full for two months has a different problem,
 * and silently landing someone in November is worse than showing them an empty
 * August and letting them page.
 */
const AUTO_ADVANCE_LIMIT = settings.autoAdvanceMonths;

type CachedMonth = { at: number; promise: Promise<Availability> };
type Key = `${string}:${string}:${MonthKey}`;

type BookingState = {
  open: boolean;
  step: Step;
  provider?: Provider;
  service?: Service;

  /** The month the calendar is showing. */
  month: MonthKey;
  date?: DateKey;
  slot?: SlotView;

  /** Days of the visible month, once they have arrived. */
  days: DayView[];
  loadingMonth: boolean;
  /** Part of the visible month could not be read; empty days are unknown. */
  partialMonth: boolean;

  hold?: HoldView;
  submitting: boolean;

  error?: { message: string; fields: string[]; fallbackUrl?: string };
};

type BookingApi = BookingState & {
  prefetch: (provider: Provider, service: Service) => void;
  /** True when the shop has one barber, so the flow starts at the service. */
  skipBarber: boolean;
  start: (seed?: { provider?: Provider; service?: Service }) => void;
  close: () => void;
  back: () => void;
  chooseProvider: (provider: Provider) => void;
  chooseService: (service: Service) => void;
  showMonth: (month: MonthKey) => void;
  chooseDate: (date: DateKey) => void;
  chooseSlot: (slot: SlotView) => void;
  submit: (details: CustomerDetails) => Promise<void>;
  /** How far the calendar may page, so the arrows know when to stop. */
  canPage: (delta: number) => boolean;
};

const Context = createContext<BookingApi | null>(null);

export function useBooking(): BookingApi {
  const value = useContext(Context);
  if (!value) throw new Error('useBooking must be used inside <BookingProvider>');
  return value;
}

const initial = (): BookingState => ({
  open: false,
  step: 'barber',
  month: monthOf(today()),
  days: [],
  loadingMonth: false,
  partialMonth: false,
  submitting: false,
});

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BookingState>(initial);
  const { providers } = useServices();
  // A shop with one chair should never be asked "who would you like?". This is
  // read from the live list, so it corrects itself the day a second barber is
  // added in Schedulista — and the day one leaves.
  const soleProvider = providers.length === 1 ? providers[0] : undefined;
  const cache = useRef(new Map<Key, CachedMonth>());
  const holdRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  /** Guards against a slow month landing after the customer moved on. */
  const wanted = useRef<Key | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      holdRequest.current?.abort();
    };
  }, []);

  const patch = useCallback((next: Partial<BookingState>) => {
    if (mounted.current) setState((current) => ({ ...current, ...next }));
  }, []);

  /* -------------------------------------------------- availability ------ */

  const load = useCallback(
    (provider: Provider, service: Service, month: MonthKey): Promise<Availability> => {
      const key: Key = `${provider.id}:${service.id}:${month}`;
      const hit = cache.current.get(key);
      if (hit && Date.now() - hit.at < MONTH_TTL_MS) return hit.promise;

      const promise = fetchAvailability(service.id, provider.id, month);
      // A failure must not be cached, or one blip poisons the month for a minute.
      promise.catch(() => cache.current.delete(key));
      cache.current.set(key, { at: Date.now(), promise });
      return promise;
    },
    []
  );

  const prefetch = useCallback<BookingApi['prefetch']>(
    (provider, service) => {
      load(provider, service, monthOf(today())).catch(() => {});
    },
    [load]
  );

  /**
   * Put a month on screen. `preferDate` keeps the customer's own choice when
   * they are only paging back and forth; otherwise the first open day is picked
   * for them, and if this month has none we walk forward until we find one —
   * the same courtesy Schedulista's own scheduler extends.
   */
  const showMonthFor = useCallback(
    async (
      provider: Provider,
      service: Service,
      month: MonthKey,
      options: { autoAdvance?: number; keepDate?: boolean } = {}
    ) => {
      const key: Key = `${provider.id}:${service.id}:${month}`;
      wanted.current = key;

      const hit = cache.current.get(key);
      const warm = hit && Date.now() - hit.at < MONTH_TTL_MS;
      patch({ month, loadingMonth: !warm, ...(options.keepDate ? {} : { date: undefined }) });

      try {
        const availability = await load(provider, service, month);
        if (!mounted.current || wanted.current !== key) return;

        const from = month === monthOf(today()) ? today() : `${month}-01`;
        const firstOpen = availability.days.find((day) => day.date >= from && day.slots.length);

        // Nothing free this month — step forward rather than showing an empty
        // grid and making the customer guess which month to try. Only when the
        // month was read in full: a day we could not read is unknown, not shut,
        // and skipping on the strength of it would quietly land someone six
        // months away because Schedulista shed a bit of load.
        const remaining = options.autoAdvance ?? 0;
        if (
          !firstOpen &&
          remaining > 0 &&
          !availability.partial &&
          monthsApart(monthOf(today()), month) < MONTHS_AHEAD
        ) {
          void showMonthFor(provider, service, addMonths(month, 1), {
            ...options,
            autoAdvance: remaining - 1,
          });
          return;
        }

        setState((current) => ({
          ...current,
          days: availability.days,
          loadingMonth: false,
          error: undefined,
          date: options.keepDate && current.date ? current.date : firstOpen?.date,
          partialMonth: availability.partial,
        }));

        // Quietly warm the next month so paging forward costs nothing.
        if (monthsApart(monthOf(today()), month) < MONTHS_AHEAD) {
          load(provider, service, addMonths(month, 1)).catch(() => {});
        }
      } catch (error) {
        if (!mounted.current || wanted.current !== key) return;
        patch({ loadingMonth: false, days: [], error: toDisplay(error) });
      }
    },
    [load, patch]
  );

  /* -------------------------------------------------- navigation -------- */

  const start = useCallback<BookingApi['start']>(
    (seed) => {
      const provider = seed?.provider ?? soleProvider;
      const service = seed?.service;
      const step: Step = !provider ? 'barber' : !service ? 'service' : 'time';

      setState({ ...initial(), open: true, step, provider, service });
      if (provider && service) {
        void showMonthFor(provider, service, monthOf(today()), { autoAdvance: AUTO_ADVANCE_LIMIT });
      }
    },
    [showMonthFor, soleProvider]
  );

  const close = useCallback(() => {
    holdRequest.current?.abort();
    wanted.current = null;
    patch({ open: false });
    // Let the exit animation finish before the contents vanish.
    setTimeout(() => mounted.current && setState(initial), 260);
  }, [patch]);

  const back = useCallback(() => {
    setState((current) => {
      const index = STEPS.indexOf(current.step);
      if (index <= 0) return current;
      // Stepping back off the details clears the slot, not the whole flow.
      if (current.step === 'details') {
        return { ...current, step: 'time', slot: undefined, hold: undefined, error: undefined };
      }
      // With one barber there is no barber step to go back to.
      if (current.step === 'service' && soleProvider) return current;
      return { ...current, step: STEPS[index - 1], error: undefined };
    });
  }, [soleProvider]);

  const chooseProvider = useCallback<BookingApi['chooseProvider']>(
    (provider) => {
      setState((current) => {
        // Keep the service only if this barber also offers one by that name.
        const service = current.service
          ? provider.services.find((s) => s.name === current.service!.name)
          : undefined;
        if (service) {
          void showMonthFor(provider, service, monthOf(today()), { autoAdvance: AUTO_ADVANCE_LIMIT });
        }
        return {
          ...current,
          provider,
          service,
          date: undefined,
          slot: undefined,
          hold: undefined,
          days: [],
          step: service ? 'time' : 'service',
        };
      });
    },
    [showMonthFor]
  );

  const chooseService = useCallback<BookingApi['chooseService']>(
    (service) => {
      setState((current) => {
        if (current.provider) {
          void showMonthFor(current.provider, service, monthOf(today()), { autoAdvance: AUTO_ADVANCE_LIMIT });
        }
        return { ...current, service, date: undefined, slot: undefined, hold: undefined, days: [], step: 'time' };
      });
    },
    [showMonthFor]
  );

  const showMonth = useCallback<BookingApi['showMonth']>(
    (month) => {
      const { provider, service } = state;
      if (!provider || !service) return;
      void showMonthFor(provider, service, month);
    },
    [showMonthFor, state]
  );

  const canPage = useCallback<BookingApi['canPage']>(
    (delta) => {
      const target = addMonths(state.month, delta);
      const distance = monthsApart(monthOf(today()), target);
      return distance >= 0 && distance <= MONTHS_AHEAD;
    },
    [state.month]
  );

  const chooseDate = useCallback<BookingApi['chooseDate']>(
    (date) => patch({ date, slot: undefined, hold: undefined }),
    [patch]
  );

  /**
   * Picking a time starts the hold straight away. By the time the customer has
   * typed their name the session and token are already waiting.
   */
  const chooseSlot = useCallback<BookingApi['chooseSlot']>(
    (slot) => {
      setState((current) => {
        const { provider, service, date } = current;
        if (!provider || !service || !date) return current;

        holdRequest.current?.abort();
        const controller = new AbortController();
        holdRequest.current = controller;

        openHold(service.id, provider.id, date, slot.iso, controller.signal)
          .then((hold) => mounted.current && patch({ hold }))
          .catch(() => {
            /* Retried on submit; no need to alarm anyone mid-typing. */
          });

        return { ...current, slot, hold: undefined, step: 'details', error: undefined };
      });
    },
    [patch]
  );

  /* -------------------------------------------------- submit ------------ */

  const submit = useCallback<BookingApi['submit']>(
    async (details) => {
      const { provider, service, date, slot } = state;
      if (!provider || !service || !date || !slot) return;

      patch({ submitting: true, error: undefined });

      try {
        // The background hold usually beat us here; if not, open one now.
        let hold = state.hold ?? (await openHold(service.id, provider.id, date, slot.iso));
        try {
          await reserve(hold.seal, details);
        } catch (error) {
          // A hold that aged out while they typed is not the customer's problem.
          if (error instanceof BookingError && (error.expired || error.status === 409)) {
            hold = await openHold(service.id, provider.id, date, slot.iso);
            await reserve(hold.seal, details);
          } else {
            throw error;
          }
        }
        // The month we cached is now one slot out of date.
        cache.current.clear();
        if (mounted.current) patch({ submitting: false, step: 'done', hold });
      } catch (error) {
        if (mounted.current) patch({ submitting: false, error: toDisplay(error) });
      }
    },
    [patch, state]
  );

  const value = useMemo<BookingApi>(
    () => ({
      ...state,
      prefetch,
      skipBarber: Boolean(soleProvider),
      start,
      close,
      back,
      chooseProvider,
      chooseService,
      showMonth,
      chooseDate,
      chooseSlot,
      submit,
      canPage,
    }),
    [
      state,
      prefetch,
      soleProvider,
      start,
      close,
      back,
      chooseProvider,
      chooseService,
      showMonth,
      chooseDate,
      chooseSlot,
      submit,
      canPage,
    ]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function toDisplay(error: unknown): BookingState['error'] {
  if (error instanceof BookingError) {
    return { message: error.message, fields: error.fieldErrors, fallbackUrl: error.fallbackUrl };
  }
  return { message: 'Something went wrong. Please try again.', fields: [] };
}

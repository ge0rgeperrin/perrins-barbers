/**
 * Step three: a month calendar and the times for the day you pick.
 *
 * Layout follows the space it is actually given, measured with onLayout rather
 * than read from the window — inside a sheet the panel width is what matters,
 * not the browser's. Wide enough and the calendar sits beside the times, the way
 * a booking page should; narrow and they stack, the way a phone should.
 *
 * Changing day does no network work and starts no animation: the whole month is
 * already in memory, so the times list simply is different on the next frame.
 * That is the fastest thing a UI can do, and the least jittery.
 */
import { useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, dsize, font, radius, size, space } from '../../theme';
import { useBooking } from '../../lib/booking';
import { openHostedScheduler } from '../../lib/links';
import { business } from '../../lib/content';
import { addMonths, longDate } from '../../lib/calendar';
import { MonthCalendar } from './MonthCalendar';
import type { SlotView } from '../../lib/booking-api';

const PART_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } as const;
const PARTS = ['morning', 'afternoon', 'evening'] as const;

/** Below this the calendar and the times stack instead of sitting side by side. */
const SIDE_BY_SIDE_AT = 660;

/** The widest the sheet's panel ever gets — see panelWide in BookingSheet. */
const PANEL_MAX = 720;

export function PickTime() {
  const {
    days,
    loadingMonth,
    partialMonth,
    month,
    date,
    showMonth,
    chooseDate,
    chooseSlot,
    canPage,
    error,
  } = useBooking();
  // Not 0. Starting unmeasured lays the step out stacked and then jumps to
  // side-by-side the instant onLayout lands — a reflow on every single open,
  // and one that needs a paint to resolve at all. The panel is never wider
  // than the sheet's own cap, so this renders the right branch on the first
  // frame; onLayout still has the last word if the panel is really narrower.
  const [width, setWidth] = useState(() => Math.min(Dimensions.get('window').width, PANEL_MAX));
  const wide = width >= SIDE_BY_SIDE_AT;

  const openDates = useMemo(
    () => new Set(days.filter((day) => day.slots.length).map((day) => day.date)),
    [days]
  );
  const slots = useMemo(
    () => days.find((day) => day.date === date)?.slots ?? [],
    [days, date]
  );

  if (error) return <Problem message={error.message} fallbackUrl={error.fallbackUrl} />;

  const calendar = (
    <MonthCalendar
      month={month}
      open={openDates}
      selected={date}
      loading={loadingMonth}
      onSelect={chooseDate}
      onPage={(delta) => showMonth(addMonths(month, delta))}
      canPage={canPage}
    />
  );

  const times = (
    <Times
      date={date}
      slots={slots}
      loading={loadingMonth}
      partial={partialMonth}
      onPick={chooseSlot}
    />
  );

  return (
    <ScrollView
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.calendarColumn}>{calendar}</View>
          <View style={styles.timesColumn}>{times}</View>
        </View>
      ) : (
        <View style={styles.stack}>
          {calendar}
          {times}
        </View>
      )}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */

function Times({
  date,
  slots,
  loading,
  partial,
  onPick,
}: {
  date?: string;
  slots: SlotView[];
  loading: boolean;
  partial: boolean;
  onPick: (slot: SlotView) => void;
}) {
  const grouped = PARTS.map((part) => ({
    part,
    slots: slots.filter((slot) => slot.part === part),
  })).filter((group) => group.slots.length);

  return (
    <View style={styles.times}>
      <Text style={styles.dayHeading}>{date ? longDate(date) : 'Pick a day'}</Text>

      {loading && !slots.length ? (
        <Text style={styles.quiet}>Checking the diary…</Text>
      ) : !date ? (
        <Text style={styles.quiet}>Choose a day from the calendar.</Text>
      ) : !slots.length ? (
        <Text style={styles.quiet}>Nothing free that day. Try another.</Text>
      ) : (
        grouped.map((group) => (
          <View key={group.part} style={styles.group}>
            <Text style={styles.groupTitle}>{PART_LABEL[group.part]}</Text>
            <View style={styles.grid}>
              {group.slots.map((slot) => (
                <Pressable
                  key={slot.iso}
                  onPress={() => onPick(slot)}
                  accessibilityRole="button"
                  accessibilityLabel={`Book ${slot.label}`}
                  style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
                >
                  <Text style={styles.slotText}>{slot.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))
      )}

      {partial ? (
        <Text style={[styles.footnote, styles.warn]}>
          Part of this month would not load. A day showing nothing here might still be free. Try
          again in a moment, or ring the shop.
        </Text>
      ) : null}

      <Text style={styles.footnote}>
        Times come live from the shop diary. Nothing is held until you confirm.
      </Text>
    </View>
  );
}

function Problem({ message, fallbackUrl }: { message: string; fallbackUrl?: string }) {
  return (
    <View style={styles.problem}>
      <Text style={styles.problemTitle}>{message}</Text>
      {fallbackUrl ? (
        <Pressable
          onPress={() => openHostedScheduler(fallbackUrl)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.fallback, pressed && styles.slotPressed]}
        >
          <Text style={styles.fallbackText}>Open the booking page instead</Text>
        </Pressable>
      ) : null}
      <Text style={styles.quiet}>Or ring the shop on {business.phone}.</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xl },

  stack: { gap: space.lg },
  columns: { flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' },
  calendarColumn: { flex: 5, minWidth: 260 },
  timesColumn: { flex: 4, minWidth: 220 },

  times: { gap: space.md },
  dayHeading: { fontFamily: font.display, fontSize: dsize(size.h4), color: color.cream },
  quiet: { fontFamily: font.body, fontSize: size.caption, color: color.muted },

  group: { gap: space.sm },
  groupTitle: {
    fontFamily: font.semibold,
    fontSize: size.micro,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: color.gold,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: {
    minWidth: 74,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
    backgroundColor: color.panel2,
  },
  slotPressed: { backgroundColor: color.gold, borderColor: color.gold },
  slotText: {
    fontFamily: font.medium,
    fontSize: size.body,
    color: color.cream,
    fontVariant: ['tabular-nums'],
  },

  footnote: {
    fontFamily: font.body,
    fontSize: size.micro,
    lineHeight: size.micro * 1.5,
    color: color.mutedDim,
    marginTop: space.xs,
  },

  warn: { color: color.warnText },

  problem: { gap: space.md, paddingVertical: space.lg },
  problemTitle: { fontFamily: font.display, fontSize: dsize(size.h4), color: color.cream },
  fallback: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.base,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
  },
  fallbackText: { fontFamily: font.semibold, fontSize: size.caption, color: color.goldLift },
});

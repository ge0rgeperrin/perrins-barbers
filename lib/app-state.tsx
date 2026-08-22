/**
 * Connection gate and price-list state.
 *
 * The shop asked for an app that simply does not open without a connection:
 * no offline mode, no cached prices, no half-usable screens. So this provider
 * holds the whole app behind a live connectivity check and keeps retrying until
 * the device is back on the network.
 *
 * On the web that check is a formality — a browser that fetched the page has a
 * connection by definition — so the gate passes straight through and the static
 * export still pre-renders real content for Google. The gate is a native
 * behaviour; the equivalent on web is that the page simply will not load.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { bundledServices, fetchServices, type ServicesDoc } from './services';

/** How often to re-check while we are sitting on the waiting screen. */
const RETRY_MS = 3000;

type AppState = {
  /** Null until the first check completes. Web starts true. */
  online: boolean | null;
  services: ServicesDoc;
  /** True while a price refresh is in flight. Never blocks the UI. */
  refreshing: boolean;
  retry: () => void;
};

const Context = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('useAppState must be used inside <AppStateProvider>');
  return value;
}

/** Convenience for screens that only care about the price list. */
export function useServices(): ServicesDoc {
  return useAppState().services;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const isWeb = Platform.OS === 'web';
  const [online, setOnline] = useState<boolean | null>(isWeb ? true : null);
  const [services, setServices] = useState<ServicesDoc>(bundledServices);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // --- connectivity -------------------------------------------------------
  // Runs on the web too, so dropping Wi-Fi mid-visit shows the same waiting
  // screen. It only ever runs after hydration, which is why the web starts
  // optimistic: the pre-rendered HTML must contain the real page for Google.
  useEffect(() => {
    const apply = (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => {
      if (!mounted.current) return;
      // isInternetReachable is null while the probe is still running; treat that
      // as "connected for now" so a slow probe does not flash the gate.
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    };

    const unsubscribe = NetInfo.addEventListener(apply);
    NetInfo.fetch().then(apply);
    return unsubscribe;
  }, []);

  // Keep prodding the radio while we are stuck on the waiting screen.
  useEffect(() => {
    if (online) return;
    const timer = setInterval(() => {
      NetInfo.refresh();
      setAttempt((n) => n + 1);
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [isWeb, online]);

  // --- price list ---------------------------------------------------------
  // Refresh whenever we come online, and on every manual retry. A failure is
  // not fatal: the build-time snapshot in assets/services.json is already real
  // data from the same source, it is only potentially a few hours older.
  useEffect(() => {
    if (online === false) return;
    const controller = new AbortController();
    setRefreshing(true);

    fetchServices(controller.signal)
      .then((doc) => {
        if (mounted.current) setServices(doc);
      })
      .catch(() => {
        /* keep the bundled snapshot */
      })
      .finally(() => {
        if (mounted.current) setRefreshing(false);
      });

    return () => controller.abort();
  }, [online, attempt]);

  return (
    <Context.Provider value={{ online, services, refreshing, retry }}>{children}</Context.Provider>
  );
}

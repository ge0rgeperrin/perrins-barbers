/**
 * Root layout. Loads the two typefaces, puts the whole app behind the
 * connection gate, then splits: bottom tabs on a phone, a header bar on the web.
 */
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot, Tabs, usePathname, useRouter } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import {
  BodoniModa_700Bold,
  BodoniModa_900Black,
} from '@expo-google-fonts/bodoni-moda';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
} from '@expo-google-fonts/outfit';

import { color, font, label, maxContentWidth, radius, size, space, TAP } from '../theme';
import { AppStateProvider, useAppState } from '../lib/app-state';
import { BookingProvider, useBooking } from '../lib/booking';
import { WaitingScreen } from '../components/WaitingScreen';
import { BookingSheet } from '../components/booking/BookingSheet';
import { Logo } from '../components/Logo';
import { Wordmark } from '../components/Wordmark';
import { addressLine, banner, business } from '../lib/content';

SplashScreen.preventAutoHideAsync().catch(() => {});

const TABS = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'services', title: 'Prices', icon: 'scissors' },
  { name: 'visit', title: 'Visit', icon: 'map-pin' },
] as const;

/** Screens that exist but do not earn a tab. */
const HIDDEN_ROUTES = ['privacy', 'terms'] as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BodoniModa_700Bold,
    BodoniModa_900Black,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,

    // LHF Old Tom, the shop's own face, licensed and supplied by the shop.
    // Two of the five cuts are used and the others are left in the folder:
    // Plain is the one the badge is lettered in, Poster Letter is the heavy
    // caps-only cut for the name at poster size. See assets/fonts/README.md.
    OldTom: require('../assets/fonts/LHFoldtomplain.otf'),
    OldTomPoster: require('../assets/fonts/LHFoldtomposterletter.otf'),
  });

  useEffect(() => {
    // Show the app once type is ready. A font failure must not trap anyone on
    // the splash screen: the system face is an ugly fallback, not a dead end.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    // The root view gesture-handler needs in order to see a drag anywhere in
    // the tree. Without it the booking sheet cannot be pulled down to dismiss.
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppStateProvider>
          <BookingProvider>
            <Gate />
          </BookingProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Nothing renders until the device is on the network. The booking sheet lives
 * outside the tabs and the web shell alike, so it can cover either.
 */
function Gate() {
  const { online, retry } = useAppState();
  if (online !== true) return <WaitingScreen online={online} onRetry={retry} />;

  return (
    <View style={styles.fill}>
      {Platform.OS === 'web' ? <WebShell /> : <PhoneTabs />}
      <BookingSheet />
    </View>
  );
}

function Banner() {
  if (!banner.active || !banner.text) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{banner.text}</Text>
    </View>
  );
}

function PhoneTabs() {
  return (
    <View style={styles.fill}>
      <Banner />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: color.ink },
          tabBarActiveTintColor: color.gold,
          tabBarInactiveTintColor: color.mutedDim,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color: tint, size: iconSize }) => (
                <Feather name={tab.icon} size={iconSize - 2} color={tint} />
              ),
            }}
          />
        ))}

        {/* Reachable, but not a tab. The legal pages are linked from Visit and
            from the booking form, which is where anyone actually wants them. */}
        {HIDDEN_ROUTES.map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}
      </Tabs>
    </View>
  );
}

function WebShell() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { start, prefetch } = useBooking();
  const { services } = useAppState();
  const firstBarber = services.providers[0];
  // The header carries a badge, three links and a button. At full size that is
  // wider than a phone, and a nav that overflows the viewport is worse than a
  // small one, so everything in it steps down together below 720.
  const { width } = useWindowDimensions();
  const compact = width < 720;

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <Banner />

      <View style={styles.webHeader}>
        <View style={[styles.webHeaderInner, compact && styles.webHeaderCompact]}>
          {/* The badge and the name together. The badge is the shop's own
              mark and it is drawn at a size where the panther, the rose and the
              ring of lettering are all actually legible: a 30px version of it
              is a gold smudge, which is worse than no mark at all. */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Perrin's Barber Shop, home"
            onPress={() => router.push('/')}
            style={styles.webBrandRow}
          >
            <Logo size={compact ? 52 : 88} />
            <Wordmark size="sm" />
          </Pressable>

          <View style={[styles.webNav, compact && styles.webNavCompact]}>
            {TABS.map((tab) => {
              const href = tab.name === 'index' ? '/' : `/${tab.name}`;
              const active = pathname === href;
              return (
                <Text
                  key={tab.name}
                  accessibilityRole="link"
                  onPress={() => router.push(href as never)}
                  style={[
                    styles.webNavItem,
                    compact && styles.webNavItemCompact,
                    active && styles.webNavItemActive,
                  ]}
                >
                  {tab.title}
                </Text>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Book now"
              onPress={() => start()}
              // Hovering the header button warms the calendar, so by the time
              // the sheet opens the times are already there.
              onHoverIn={() =>
                firstBarber?.services[0] && prefetch(firstBarber, firstBarber.services[0])
              }
              style={({ pressed }) => [
                styles.webBookWrap,
                compact && styles.webBookCompact,
                pressed && styles.webBookPressed,
              ]}
            >
              <Text style={styles.webBook}>Book now</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Slot />
      <SiteFooter />
    </View>
  );
}

/**
 * The web footer. It carries the legal links, which is not decoration: the app
 * stores both require a reachable privacy policy, and a customer who has just
 * typed their phone number into a form is entitled to find out where it went.
 */
function SiteFooter() {
  const router = useRouter();
  const links: Array<[string, string]> = [
    ['Privacy', '/privacy'],
    ['Terms', '/terms'],
  ];

  return (
    <View style={styles.footer}>
      <View style={styles.footerInner}>
        <Text style={styles.footerCredit}>
          {`© ${new Date().getFullYear()} ${business.name} · ${addressLine}`}
        </Text>
        <View style={styles.footerLinks}>
          {links.map(([title, href]) => (
            <Text
              key={href}
              accessibilityRole="link"
              onPress={() => router.push(href as never)}
              style={styles.footerLink}
            >
              {title}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.ink },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
    paddingHorizontal: space.lg,
  },
  footerInner: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.base,
  },
  footerCredit: { fontFamily: font.body, fontSize: size.caption, color: color.mutedDim },
  footerLinks: { flexDirection: 'row', gap: space.lg },
  footerLink: { fontFamily: font.medium, fontSize: size.caption, color: color.muted },

  banner: {
    backgroundColor: color.panel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
    paddingVertical: space.sm,
    paddingHorizontal: space.base,
  },
  bannerText: {
    ...label,
    color: color.goldLift,
    textAlign: 'center',
  },

  tabBar: {
    backgroundColor: color.ink,
    borderTopColor: color.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabLabel: {
    fontFamily: font.semibold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  webHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
    paddingHorizontal: space.lg,
  },
  webHeaderInner: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.lg,
    flexWrap: 'wrap',
  },
  webBrandRow: { flexDirection: 'row', alignItems: 'center', gap: space.base },
  webNav: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: space.xl,
  },
  webHeaderCompact: { paddingVertical: space.base, gap: space.md },
  webNavCompact: { gap: space.base },
  webNavItem: {
    fontFamily: font.medium,
    fontSize: size.lead,
    letterSpacing: 0.4,
    color: color.muted,
  },
  webNavItemCompact: { fontSize: size.body },
  webNavItemActive: { color: color.cream },
  webBookWrap: {
    backgroundColor: color.gold,
    borderRadius: radius.card,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 54,
    justifyContent: 'center',
  },
  webBookCompact: { paddingHorizontal: space.base, minHeight: TAP },
  webBookPressed: { backgroundColor: color.goldLift },
  webBook: { ...label, color: color.onGold },
});

/**
 * Root layout. Loads the two typefaces, puts the whole app behind the
 * connection gate, then splits: bottom tabs on a phone, a header bar on the web.
 */
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Feather from '@expo/vector-icons/Feather';
import { Slot, Tabs, usePathname, useRouter } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Imported one weight at a time, from the weight's own subpath.
//
// The package root is the documented import and it is the expensive one: its
// index.js `require`s every cut in the family, and a `require` of an asset is
// not something Metro can shake out. Importing the two Bodonis and the three
// Outfits from the root shipped twenty-one font files in the bundle to load
// five of them, about 940KB of type nobody can see, in every download of both
// apps. Each subpath requires exactly its own file.
import { BodoniModa_700Bold } from '@expo-google-fonts/bodoni-moda/700Bold';
import { BodoniModa_900Black } from '@expo-google-fonts/bodoni-moda/900Black';
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';

import { color, font, label, maxContentWidth, radius, size, space, TAB_BAR_HEIGHT, TAP } from '../theme';
import { AppStateProvider, useAppState } from '../lib/app-state';
import { BookingProvider, useBooking } from '../lib/booking';
import { WaitingScreen } from '../components/WaitingScreen';
import { TabBarBackground } from '../components/TabBarBackground';
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
  // The status bar is ours to clear.
  //
  // Bottom tabs hands the safe-area insets to the tab bar and to nothing else,
  // and every screen here sets headerShown: false — so without this the top of
  // Home sits under the clock and, on any phone that has one, behind the
  // Dynamic Island. WebShell has always padded for this; the phone never did,
  // because until now the phone had never been run.
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <Banner />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: color.ink },
          tabBarActiveTintColor: color.gold,
          tabBarInactiveTintColor: color.mutedDim,
          tabBarLabelStyle: styles.tabLabel,
          // The bar floats over the page rather than sitting under it, so the
          // content runs beneath the glass and the material has something to
          // refract. See components/TabBarBackground.
          //
          // The height is set rather than left to React Navigation because
          // Screen in components/ui has to leave exactly this much room at the
          // end of every scroll, and the two numbers have to be the same one.
          tabBarStyle: [
            styles.tabBar,
            { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
          ],
          tabBarBackground: () => <TabBarBackground />,
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

  // Transparent and borderless: everything visible about this bar is drawn by
  // TabBarBackground, including the hairline, which only appears in the solid
  // fallback. A border on top of glass reads as a seam.
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
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

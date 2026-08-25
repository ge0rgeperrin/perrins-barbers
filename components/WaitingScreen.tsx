/**
 * What the app shows when the phone has no connection, and while the first
 * connectivity check is still running.
 *
 * The shop's rule: nothing is usable offline. So this is a dead end by design —
 * it keeps checking on its own and lets itself out the moment the network is
 * back. There is no "continue anyway", because there is nothing to continue to.
 */
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, radius, size, space, TAP } from '../theme';
import { NATIVE_DRIVER, useReducedMotion } from '../lib/motion';
import { Logo } from './Logo';
import { addressLine, business } from '../lib/content';

type Props = {
  /** False once we know the device is offline; null while still checking. */
  online: boolean | null;
  onRetry: () => void;
};

export function WaitingScreen({ online, onRetry }: Props) {
  const checking = online === null;
  const reduced = useReducedMotion();
  // This screen renders before either shell, so nothing above it has cleared
  // the status bar or the home indicator on its behalf. It is also the very
  // first thing the app ever shows, which is a poor place to have the footer
  // sitting under the home bar.
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(reduced ? 1 : 0.45)).current;

  useEffect(() => {
    if (reduced) {
      fade.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(fade, { toValue: 0.45, duration: 900, useNativeDriver: NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [fade, reduced]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.middle}>
        {/* The badge rather than the shop name in type. This screen is the one
            place a customer is stuck looking at nothing, so it may as well be
            the nicest thing the shop owns. */}
        <Logo size={148} />

        <Animated.Text style={[styles.status, { opacity: fade }]} accessibilityLiveRegion="polite">
          {checking ? 'Checking your connection' : 'Waiting for a connection'}
        </Animated.Text>

        <Text style={styles.help}>
          {checking
            ? 'One moment.'
            : 'Perrin’s needs mobile data or Wi-Fi to show live prices and open the booking diary. It will carry on as soon as you’re back online.'}
        </Text>

        {checking ? null : (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
          >
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.footer}>{`${addressLine} · ${business.phone}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.base,
  },
  status: {
    fontFamily: font.semibold,
    fontSize: size.micro,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: color.gold,
    marginTop: space.xl,
  },
  help: {
    fontFamily: font.body,
    fontSize: size.caption,
    lineHeight: size.caption * 1.6,
    color: color.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
  retry: {
    marginTop: space.sm,
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
  },
  retryPressed: { backgroundColor: color.panel },
  retryLabel: {
    fontFamily: font.semibold,
    fontSize: size.caption,
    letterSpacing: 0.6,
    color: color.cream,
  },
  footer: {
    fontFamily: font.body,
    fontSize: size.micro,
    color: color.mutedDim,
    textAlign: 'center',
    paddingBottom: space.xl,
  },
});

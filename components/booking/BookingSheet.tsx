/**
 * The booking sheet: the whole Schedulista flow, in our own chrome.
 *
 * Structure is deliberately flat. One overlay, one panel, one step on screen at
 * a time, so there is never more than a backdrop fade and a single transform
 * running at once. Nothing here animates layout, so no frame ever waits on a
 * reflow.
 *
 * ON A PHONE IT IS A DRAWER YOU CAN THROW AWAY. Drag it down and it follows your
 * finger exactly; let go and it either goes home or leaves, decided by how fast
 * you were moving as much as by how far you got. Drag it up and it resists more
 * the harder you pull rather than stopping dead against an invisible wall,
 * because nothing in the world stops instantly. The whole gesture runs on the UI
 * thread, so it keeps up with a finger even while the calendar is fetching.
 *
 * TWO RULES THIS FILE HAS ALREADY BROKEN ONCE EACH, AND MUST NOT AGAIN:
 *
 *   1. Correctness never waits on an animation frame or a completion callback.
 *      A browser that is not painting hands out no frames, and an animation that
 *      never runs leaves a full-screen invisible panel over the page and a
 *      button that reads as dead. Visibility and unmount are settled by a timer.
 *
 *   2. A flexBasis of 0 never sizes the panel. In React Native both `flex: 0`
 *      and `flex: 1` set flexBasis to 0, and a basis of 0 inside a parent that
 *      sizes to its contents contributes no height, so the panel collapses. It
 *      has now happened twice: once to the desktop dialog, see panelWide, and
 *      once to the phone sheet, see dragLayerPhone. Before changing any flex
 *      value in this file, ask what sizes the parent.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing as ReEasing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { color, dsize, font, label, radius, size, space } from '../../theme';
import {
  duration,
  easeOut,
  FLICK_VELOCITY,
  isReducedMotion,
  NATIVE_DRIVER,
  spring,
  useReducedMotion,
} from '../../lib/motion';
import { STEPS, useBooking, type Step } from '../../lib/booking';
import { PickBarber, PickService } from './PickBarberService';
import { PickTime } from './PickTime';
import { Details, Done } from './Details';

/** Past this far down, letting go dismisses even from a standstill. */
const DISMISS_AFTER = 110;
/** How much of an upward pull actually moves the sheet. The rest is friction. */
const RUBBER = 0.32;

/** The steps that get a progress pip. "done" is an outcome, not a step. */
const PROGRESS: Step[] = ['barber', 'service', 'time', 'details'];

const TITLES: Record<Step, string> = {
  barber: 'Who would you like?',
  service: 'What are you having?',
  time: 'When suits you?',
  details: 'Your details',
  done: 'You’re booked',
};

export function BookingSheet() {
  const booking = useBooking();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const wide = width >= 720;

  // Kept mounted for one animation after close so the exit can play.
  const [mounted, setMounted] = useState(booking.open);
  const presence = useRef(new Animated.Value(0)).current;

  /** How far the finger has pulled the sheet down. Lives on the UI thread. */
  const drag = useSharedValue(0);

  useEffect(() => {
    const target = booking.open ? 1 : 0;
    if (booking.open) setMounted(true);
    // A sheet that is opening must not inherit the drag that closed it.
    if (booking.open) drag.value = 0;

    const ms = reduced ? 0 : booking.open ? duration.sheet : duration.out;
    const animation = Animated.timing(presence, {
      toValue: target,
      duration: ms,
      easing: easeOut,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();

    // A timer, not the animation's own callback.
    //
    // An animation needs animation frames, and a browser that is not painting,
    // a background tab, a throttled one, a machine under load, does not hand
    // them out. Nothing here may depend on one arriving: without this the panel
    // sits at opacity 0 over the whole screen and the button reads as broken,
    // and a closed sheet never unmounts because `finished` never fires.
    // setTimeout always fires, so the end state is always reached.
    const settle = setTimeout(() => {
      presence.setValue(target);
      if (!booking.open) setMounted(false);
    }, ms + 60);

    return () => {
      animation.stop();
      clearTimeout(settle);
    };
  }, [booking.open, drag, presence, reduced]);

  /**
   * The drag, on a phone only.
   *
   * It is attached to the grab area at the top of the sheet, not to the panel,
   * so a swipe over the calendar, the times list or the form scrolls that
   * content and never dismisses the booking.
   *
   * `activeOffsetY([-12, 12])` still earns its place: the header holds the back
   * and close buttons, and the pan must not swallow a tap on either. Twelve
   * pixels of vertical travel is more than a tap and less than a deliberate
   * pull.
   *
   * Release is decided by distance OR velocity, not distance alone. Requiring a
   * long drag makes a sheet feel stuck; a quick flick downward is a perfectly
   * clear instruction and should be obeyed even if it only travelled 30px.
   */
  const pan = Gesture.Pan()
    .enabled(!wide && !reduced)
    .activeOffsetY([-12, 12])
    .onChange((event) => {
      const next = drag.value + event.changeY;
      // Downward is free. Upward gets harder the further it goes, so the sheet
      // slows to a stop instead of hitting a wall.
      drag.value = next >= 0 ? next : next * RUBBER;
    })
    .onEnd((event) => {
      const gone = drag.value > DISMISS_AFTER || event.velocityY / 1000 > FLICK_VELOCITY;
      if (gone) {
        runOnJS(booking.close)();
        drag.value = withTiming(height, { duration: duration.out, easing: ReEasing.out(ReEasing.cubic) });
      } else {
        drag.value = withSpring(0, spring.sheet);
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drag.value }],
  }));

  if (!mounted) return null;

  const panelShift = presence.interpolate({
    inputRange: [0, 1],
    outputRange: [wide ? 16 : Math.min(height * 0.06, 48), 0],
  });

  const panel = (
    <ReAnimated.View style={[styles.dragLayer, !wide && styles.dragLayerPhone, dragStyle]}>
      <Animated.View
        // accessibilityViewIsModal is iOS only; role and aria-modal are what a
        // browser and a screen reader on Android actually read.
        accessibilityViewIsModal
        role="dialog"
        aria-modal
        aria-label="Book an appointment"
        style={[
          styles.panel,
          wide ? styles.panelWide : { paddingBottom: insets.bottom },
          !wide && { paddingTop: insets.top },
          { opacity: presence, transform: [{ translateY: panelShift }] },
        ]}
      >
        {/* The grab area: the handle plus the header, and nothing below it.

            The handle is not decoration. It is the only thing that says this
            panel can be pulled, and without it drag-to-dismiss is a secret.

            The detector sits here rather than around the whole panel because
            a sheet that closes when you swipe anywhere is a sheet that closes
            by accident: every downward flick over the calendar, the times or
            the form was throwing the booking away mid-way through it. */}
        {wide ? (
          <Header />
        ) : (
          <GestureDetector gesture={pan}>
            <View style={styles.grabArea}>
              <View style={styles.grabber} />
              <Header />
            </View>
          </GestureDetector>
        )}
        <Progress />
        <StepBody />
      </Animated.View>
    </ReAnimated.View>
  );

  return (
    <View style={styles.overlay} pointerEvents={booking.open ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: presence }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={booking.close}
          accessibilityRole="button"
          accessibilityLabel="Close booking"
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.centre, wide && styles.centreWide]}
        pointerEvents="box-none"
      >
        {panel}
      </KeyboardAvoidingView>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function Header() {
  const { step, back, close, provider, service } = useBooking();
  const canGoBack = step !== 'done' && STEPS.indexOf(step) > 0;

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {canGoBack ? (
          <Pressable
            onPress={back}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          >
            <Feather name="chevron-left" size={20} color={color.cream} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}

        <Text style={styles.eyebrow}>Book an appointment</Text>

        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close booking"
          hitSlop={12}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
        >
          <Feather name="x" size={20} color={color.cream} />
        </Pressable>
      </View>

      <Text style={styles.title} accessibilityRole="header">
        {TITLES[step]}
      </Text>

      {provider || service ? (
        <Text style={styles.crumb} numberOfLines={1}>
          {[provider?.name, service?.name, service?.priceLabel].filter(Boolean).join('  ·  ')}
        </Text>
      ) : null}
    </View>
  );
}

/** Four hairline pips. The filled one grows, it does not slide — no layout thrash. */
function Progress() {
  const { step } = useBooking();
  const index = PROGRESS.indexOf(step);
  const done = step === 'done';

  return (
    <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {PROGRESS.map((name, i) => (
        <Pip key={name} active={done || i <= index} current={!done && i === index} />
      ))}
    </View>
  );
}

function Pip({ active, current }: { active: boolean; current: boolean }) {
  const reduced = useReducedMotion();
  const fill = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: active ? 1 : 0,
      duration: reduced ? 0 : duration.in,
      easing: easeOut,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [active, fill, reduced]);

  return (
    <View style={styles.pipTrack}>
      <Animated.View
        style={[
          styles.pipFill,
          {
            opacity: fill,
            transform: [{ scaleX: fill }],
            backgroundColor: current ? color.gold : color.goldDeep,
          },
        ]}
      />
    </View>
  );
}

/**
 * One step on screen.
 *
 * The new step is mounted immediately and animates in; there is no exit
 * animation to wait through, so a tap is answered on the very next frame. That
 * is a deliberate trade: sequencing an exit into an entrance costs 100ms of
 * dead time on every single tap, and needs an animation callback to be reliable
 * — which is one more thing that can leave the sheet stuck on the wrong step.
 *
 * Keying on the step also remounts the content, which resets its scroll
 * position: going back to the time grid should not land halfway down it.
 */
function StepBody() {
  const { step } = useBooking();
  const previous = useRef<Step>(step);

  // Read before the effect below updates it, so this render knows which way we
  // are travelling and the new step slips in from the correct side.
  const forward = STEPS.indexOf(step) >= STEPS.indexOf(previous.current);
  useEffect(() => {
    previous.current = step;
  }, [step]);

  return <StepFrame key={step} step={step} forward={forward} />;
}

function StepFrame({ step, forward }: { step: Step; forward: boolean }) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: duration.in,
      easing: easeOut,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [anim, reduced]);

  const slip = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [forward ? 16 : -16, 0],
  });

  return (
    <Animated.View style={[styles.body, { opacity: anim, transform: [{ translateX: slip }] }]}>
      {step === 'barber' ? <PickBarber /> : null}
      {step === 'service' ? <PickService /> : null}
      {step === 'time' ? <PickTime /> : null}
      {step === 'details' ? <Details /> : null}
      {step === 'done' ? <Done /> : null}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4,4,5,0.82)',
  },
  // A phone sheet rises from the bottom edge; a desktop dialog sits in the
  // middle of the screen, not pinned to the bottom of it.
  centre: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  centreWide: { justifyContent: 'center' },

  // The layer the finger moves. Separate from the panel so the drag transform
  // and the entrance transform never have to share one style object.
  //
  // Content-sized on purpose, because that is what a centred desktop dialog
  // needs: panelWide has a basis of `auto` and a maxHeight, and this layer has
  // to be free to be exactly as tall as that.
  dragLayer: { width: '100%', alignItems: 'center', flexShrink: 1 },

  // On a phone it has to fill instead, and this is rule 2 at the top of the
  // file catching the same file out a second time.
  //
  // The phone sheet is full height: it pads for the status bar at the top and
  // the home indicator at the bottom, and `panel` asks for `flex: 1`. But
  // `flex: 1` is flexBasis 0, and a basis of 0 inside a parent that sizes to
  // its contents contributes no height at all. So the layer measured zero, the
  // panel had nothing to grow into, and the whole booking flow spilled out of
  // the bottom of the screen with only a strip of it visible. Exactly the
  // failure described under panelWide, on the other branch of the same
  // ternary, and it survived because the desktop was the only thing ever run.
  dragLayerPhone: { flex: 1 },

  // The pull handle. Small, centred, gold at low alpha so it reads as part of
  // the sheet's edge rather than as a control in its own right.
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.line,
    alignSelf: 'center',
    marginTop: space.sm,
    marginBottom: space.xs,
  },

  // Everything you can pull the sheet down by. Full width so the target is
  // the whole top of the sheet rather than the 36px of the handle itself.
  grabArea: { width: '100%' },

  panel: {
    width: '100%',
    flex: 1,
    // Glass, not paint. The sheet is the thing you look through into the shop's
    // diary, and it needs to be the darkest surface on screen so the gold on it
    // is legible at button size rather than only at heading size.
    backgroundColor: color.panel,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  // Wide enough that the calendar and the times sit side by side on the time
  // step; the lighter steps constrain their own content so it never sprawls.
  //
  // NOT `flex: 0`. In React Native `flex: 0` expands to flexBasis: 0, so the
  // panel's hypothetical height is zero, nothing grows it, and the whole sheet
  // collapses to the two hairlines of its own border — mounted, on top of the
  // page, and invisible. Basis `auto` means "as tall as your contents", which
  // is what a dialog wants; maxHeight then caps it and the body scrolls.
  panelWide: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    maxWidth: 720,
    maxHeight: '88%',
    marginBottom: 0,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
  },

  header: { paddingHorizontal: space.lg, paddingTop: space.base, width: '100%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
  },
  iconPressed: { backgroundColor: color.panel2 },
  eyebrow: { ...label, color: color.gold },
  title: {
    fontFamily: font.display,
    fontSize: dsize(size.h3),
    color: color.cream,
    marginTop: space.base,
  },
  crumb: {
    fontFamily: font.body,
    fontSize: size.caption,
    color: color.muted,
    marginTop: space.xs,
  },

  progress: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.base,
    paddingBottom: space.md,
  },
  pipTrack: {
    flex: 1,
    height: 2,
    backgroundColor: color.lineSoft,
    overflow: 'hidden',
  },
  pipFill: { flex: 1, transformOrigin: 'left' },

  // Same reason as panelWide: a basis of 0 inside a panel that sizes to its
  // contents contributes nothing, so the step would have no height to render
  // into. Basis auto, grow to fill a full-height phone sheet, shrink so the
  // step scrolls rather than pushing a desktop panel past its cap.
  body: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minHeight: 0 },
});

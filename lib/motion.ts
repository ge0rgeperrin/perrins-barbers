/**
 * Motion constants and the reduced-motion switch.
 *
 * Everything animated in this app moves opacity and transform only, never
 * width, height or layout, so the compositor can do the work and nothing
 * reflows mid frame. Durations are short on purpose: this is a booking form,
 * not a title sequence.
 *
 * WHETHER A THING SHOULD ANIMATE AT ALL is decided by how often it is seen.
 * Something a customer meets once per booking can be given a moment. Something
 * they touch forty times while picking a time gets press feedback and nothing
 * else, because at that frequency an animation stops reading as polish and
 * starts reading as lag. That is why choosing a day does not animate the time
 * grid: the month is already in memory and the list simply differs on the next
 * frame, which is the fastest thing an interface can do.
 *
 * NOTHING HERE USES EASE-IN. It starts slow, which delays the exact instant the
 * customer is watching hardest, and makes the same duration feel longer.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';

export const duration = {
  /** Press feedback. Anything longer stops feeling like a button. */
  press: 140,
  /** Leaving. Always quicker than arriving, so it feels like getting out of the way. */
  out: 160,
  /** A step changing inside the sheet. Seen many times, so kept tight. */
  step: 180,
  /** Arriving. */
  in: 260,
  /** The sheet itself. */
  sheet: 400,
  /** Something entering as you scroll to it. Seen once, so it can breathe. */
  reveal: 500,
} as const;

/**
 * Curves. The built-in easings are too weak to read as deliberate; these are the
 * stronger variants, and they are the same three curves used throughout.
 */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);
/** The iOS drawer curve. Used only by the sheet, which is why it exists. */
export const easeDrawer = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * Springs, in Apple's terms rather than stiffness and damping, because duration
 * and bounce are things you can actually picture.
 *
 * `dampingRatio: 1` is critically damped: it settles without ever overshooting.
 * Anything under 1 bounces, and bounce is reserved for the one moment in the
 * product a customer sees once, at the end of a booking.
 */
export const spring = {
  /** The sheet and the panel. No bounce: a dialog that wobbles reads as cheap. */
  sheet: { duration: 400, dampingRatio: 1 },
  /** Under a finger. Fast enough to feel like the surface answered. */
  press: { duration: 160, dampingRatio: 1 },
  /** The confirmation tick, once per booking, and nowhere else. */
  delight: { duration: 500, dampingRatio: 0.72 },
} as const;

/**
 * How long each item waits behind the one before it in a staggered entrance.
 * Under 30ms reads as simultaneous, over 80ms reads as slow.
 */
export const STAGGER_MS = 55;

/** A flick, in pixels per millisecond. Past this, a drag dismisses on velocity
 * alone however short it was, because a quick flick should be enough. */
export const FLICK_VELOCITY = 0.11;

/**
 * react-native-web has no native driver; asking for one there logs a warning and
 * falls back anyway. On web the values still end up as inline transform/opacity,
 * which the browser composites.
 */
export const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Whether the person has asked their device for less movement.
 *
 * Resolved once for the whole app rather than per component. Asking
 * AccessibilityInfo inside every animated component meant each one rendered,
 * settled, then started its animation a tick later — which is exactly the
 * stutter it was supposed to prevent. One listener, one shared value, and the
 * answer is already there by the time anything animates.
 */
let reducedMotion = false;
const listeners = new Set<(value: boolean) => void>();

function publish(value: boolean) {
  if (value === reducedMotion) return;
  reducedMotion = value;
  for (const listener of listeners) listener(value);
}

// Resolve as soon as the module loads, well before the first animated mount.
AccessibilityInfo.isReduceMotionEnabled().then(publish).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', publish);

/** The current answer, without subscribing. Safe to read during render. */
export const isReducedMotion = () => reducedMotion;

export function useReducedMotion(): boolean {
  const [value, setValue] = useState(reducedMotion);

  useEffect(() => {
    setValue(reducedMotion);
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);

  return value;
}

/* ------------------------------------------------------------------ */
/* what "reduced motion" actually means here                           */
/* ------------------------------------------------------------------ */

/**
 * Reduced motion means fewer and gentler, not none.
 *
 * The earlier version of this file switched every animation off, which is the
 * obvious reading and the wrong one. What makes people ill is movement: things
 * flying across the screen, parallax, scale, drag. A short fade is not motion
 * sickness, it is the thing that stops content appearing out of nowhere, and
 * removing it makes the interface harder to follow rather than kinder.
 *
 * So the rule in this codebase is:
 *
 *   travel(px)   -> 0 when reduced motion is on. No translation, no parallax.
 *   scaleFrom(n) -> 1 when reduced motion is on. Nothing grows or shrinks.
 *   opacity      -> left alone. Fades stay, and stay short.
 *
 * Anything driven by a finger (the drag-to-dismiss sheet) simply does not
 * animate its release; it snaps.
 */

/** A translation distance, or zero if the device asked for less movement. */
export function travel(px: number): number {
  return reducedMotion ? 0 : px;
}

/** A starting scale, or 1 if the device asked for less movement. */
export function scaleFrom(value: number): number {
  return reducedMotion ? 1 : value;
}

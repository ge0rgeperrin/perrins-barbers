/**
 * The tab bar's glass: the material behind the bar, and the plate that arrives
 * behind whichever icon is selected.
 *
 * On iOS 26 this is Apple's Liquid Glass, the real UIGlassEffect rather than a
 * blurred rectangle pretending to be one. The bar is positioned absolutely so
 * the page scrolls underneath it, which is the entire point of the material: a
 * glass surface with nothing moving behind it is just a grey strip.
 *
 * IT IS SQUARE, AND FULL WIDTH, ON PURPOSE. The fashionable Liquid Glass tab
 * bar is a floating rounded pill, and this one deliberately is not, because
 * theme.ts states the rule the whole product is drawn to: traditional signage
 * is square-cornered, and pills are for status chips only. The shop's own
 * corner radius is two pixels. A capsule at the bottom of the screen would be
 * the one round thing in a square product, which reads as a component borrowed
 * from somewhere else rather than as part of the shop.
 *
 * TWO WAYS IT CAN FALL BACK, and both are honest rather than approximated:
 *
 *   1. Below iOS 26 there is no Liquid Glass. It paints the panel colour the
 *      rest of the app already uses. Not a worse glass, simply not glass.
 *   2. If the person has turned Reduce Transparency on, the same solid panel.
 *      That setting exists because translucency makes text harder to read, and
 *      quietly ignoring it is exactly the sort of thing it is there to stop.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  View,
  type ColorValue,
} from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import Feather from '@expo/vector-icons/Feather';
import { color, radius } from '../theme';
import { duration, easeOut, NATIVE_DRIVER, scaleFrom, useReducedMotion } from '../lib/motion';

/**
 * Resolved once, at module load. Guarded because this file is imported by the
 * web build as well, where the native module behind it does not exist.
 */
const HAS_LIQUID_GLASS = (() => {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
})();

export function TabBarBackground() {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (!HAS_LIQUID_GLASS) return;
    let alive = true;

    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((on) => {
        if (alive) setReduceTransparency(on);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    );

    return () => {
      alive = false;
      subscription?.remove();
    };
  }, []);

  if (HAS_LIQUID_GLASS && !reduceTransparency) {
    return (
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        // The app is dark whatever the phone is set to, so the glass is told
        // the same rather than being left to read the system appearance and
        // come out light over a black page.
        colorScheme="dark"
      />
    );
  }

  return <View style={[StyleSheet.absoluteFill, styles.solid]} />;
}

/* ------------------------------------------------------------------ */
/* the selected tab                                                     */
/* ------------------------------------------------------------------ */

/**
 * A tab's icon, with the glass plate that arrives behind the selected one.
 *
 * WHY IT IS THIS RESTRAINED. lib/motion.ts sets the rule the product is built
 * to: how much a thing animates is decided by how often it is seen, and
 * something touched forty times a visit gets feedback and nothing else, because
 * at that frequency animation stops reading as polish and starts reading as
 * lag. A tab bar is the most-touched surface in the app. So the plate arrives
 * in 140ms, the same press interval as every button, and nothing bounces.
 *
 * THE PLATE IS SQUARE. Apple's own selected tab is a capsule, and this one is
 * not, for the reason given at the top of this file: the shop's radius is two
 * pixels and a capsule would be the one round thing in a square product. At
 * this size it reads as a small enamel tile behind the icon, which is closer to
 * what is actually screwed to the front of a barber's shop.
 *
 * Under reduced motion it fades and does not scale, which is the rule motion.ts
 * states: movement is what makes people ill, a short fade is what stops things
 * appearing out of nowhere. scaleFrom returns 1 on its own when that is set, so
 * there is no branch here for it.
 */
export function TabBarIcon({
  name,
  focused,
  color: tint,
  size,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  focused: boolean;
  /** React Navigation hands out a ColorValue, not a plain string. */
  color: ColorValue;
  size: number;
}) {
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    const to = focused ? 1 : 0;
    const ms = reduced ? 0 : duration.press;

    const animation = Animated.timing(enter, {
      toValue: to,
      duration: ms,
      easing: easeOut,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();

    // The same rule the booking sheet is built on: a value never depends on an
    // animation frame arriving to reach its end state. A tab whose plate never
    // finished arriving is only cosmetic, the icon still turns gold, but the
    // timer costs nothing and the file next door already learned this twice.
    const settle = setTimeout(() => enter.setValue(to), ms + 60);

    return () => {
      animation.stop();
      clearTimeout(settle);
    };
  }, [enter, focused, reduced]);

  return (
    <View style={styles.icon}>
      <Animated.View
        // Decoration. The selected state is already announced by the tab's own
        // accessibility role, and a screen reader has no use for the plate.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.plate,
          {
            opacity: enter,
            transform: [
              {
                scale: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [scaleFrom(0.82), 1],
                }),
              },
            ],
          },
        ]}
      >
        {HAS_LIQUID_GLASS ? (
          <GlassView
            style={StyleSheet.absoluteFill}
            // Clear rather than regular: this sits on top of the bar's own
            // glass, and two regular layers stack into a milky patch that hides
            // the very thing underneath they are supposed to be refracting.
            glassEffectStyle="clear"
            colorScheme="dark"
            tintColor={color.goldDeep}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.plateSolid]} />
        )}
      </Animated.View>

      <Feather name={name} size={size} color={tint as string} />
    </View>
  );
}

const styles = StyleSheet.create({
  solid: {
    backgroundColor: color.ink,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },

  icon: { alignItems: 'center', justifyContent: 'center' },
  plate: {
    position: 'absolute',
    width: 46,
    height: 32,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  plateSolid: { backgroundColor: color.panel2 },
});

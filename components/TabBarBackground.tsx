/**
 * The material behind the tab bar.
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
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { color } from '../theme';

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

const styles = StyleSheet.create({
  solid: {
    backgroundColor: color.ink,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
});

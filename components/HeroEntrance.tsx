/**
 * The page arriving.
 *
 * Each child rises a little and fades in, one behind the next. That is the only
 * choreography in the product, it runs once, and the whole thing is over in
 * under half a second: badge, strapline, open chip, button.
 *
 * The reason it is worth having at all is that it puts the hero in reading
 * order. Everything appearing at once gives the eye nowhere to start; 55ms of
 * offset per element is enough to say "this, then this" without anybody
 * consciously noticing a sequence happened. Longer than about 80ms and the page
 * stops feeling staggered and starts feeling slow.
 *
 * Nothing here blocks. The children are laid out and interactive from the first
 * frame; only opacity and transform are animated, so a customer who taps the
 * button 200ms in gets the booking sheet, not a swallowed press.
 *
 * Under reduced motion the rise is zero and only the fade remains. A fade is not
 * what makes people ill, and removing it entirely would make content appear out
 * of nowhere, which is worse for comprehension rather than better.
 */
import { Children, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { duration, easeOut, isReducedMotion, NATIVE_DRIVER, STAGGER_MS, travel } from '../lib/motion';

export function HeroEntrance({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const items = useMemo(() => Children.toArray(children).filter(Boolean), [children]);

  return (
    <View style={style}>
      {items.map((child, index) => (
        <Arrive key={index} index={index}>
          {child}
        </Arrive>
      ))}
    </View>
  );
}

function Arrive({ children, index }: { children: ReactNode; index: number }) {
  // Read once. If the answer changed between mount and now the entrance has
  // already happened, so there is nothing to correct.
  const reduced = useRef(isReducedMotion()).current;
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: duration.in,
      delay: index * STAGGER_MS,
      easing: easeOut,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();

    // The page must not depend on an animation frame arriving. A JS-driven
    // Animated value only advances when the browser paints, and a tab that is
    // never painted would leave the hero at opacity 0 forever. So a timer
    // settles it regardless; if the animation already finished, this is a
    // no-op on a value that is already 1.
    const settle = setTimeout(
      () => enter.setValue(1),
      index * STAGGER_MS + duration.in + 250
    );

    return () => {
      clearTimeout(settle);
      animation.stop();
    };
  }, [enter, index]);

  return (
    <Animated.View
      style={[
        styles.item,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [reduced ? 0 : travel(10), 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The wrapper must not become a layout of its own, or it would collapse the
  // gap the parent set between the hero's parts.
  item: { alignSelf: 'stretch' },
});

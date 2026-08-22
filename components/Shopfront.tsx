/**
 * The shopfront, photographed. Used on Visit and nowhere else.
 *
 * It does real work on that screen rather than decorating it: Old Cross is a
 * narrow street of similar frontages and the shop is easy to walk straight
 * past, so a picture of the front is better directions than another sentence of
 * address. The front page deliberately does not carry it. There the badge and
 * the name are the whole composition, and a photograph underneath them competes
 * with the mark instead of adding anything.
 *
 * The aspect ratio is fixed, so the space is reserved before the file has
 * loaded and the page never jumps as it arrives. The scrim underneath is what
 * lets the photograph end in the page's own colour rather than in a hard edge.
 */
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { color, radius } from '../theme';

/**
 * The photograph is square, 1400 across, and it is shown at its own proportions.
 * A wide letterbox crop keeps about a third of the picture and the third it
 * keeps is the doorway, throwing away the flower boxes along the top, which are
 * the best thing in the frame and the thing the caption tells you to look for.
 */
export const SHOPFRONT_RATIO = 1;

type Props = {
  /** Aspect ratio to crop to. Wider than the source crops top and bottom. */
  ratio?: number;
  /** Fade the bottom edge into the page. Off for a framed shot. */
  scrim?: boolean;
  /**
   * Load immediately rather than when it comes near the viewport.
   *
   * expo-image defaults to lazy, which is right for a photograph further down a
   * page and wrong for one above the fold, where it is the largest thing on
   * screen and lazy loading it is lazy loading the first impression.
   */
  eager?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Shopfront = memo(function Shopfront({
  ratio = SHOPFRONT_RATIO,
  scrim = false,
  eager = false,
  style,
}: Props) {
  return (
    <View style={[styles.frame, { aspectRatio: ratio }, style]}>
      <Image
        source={require('../assets/shopfront.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
        loading={eager ? 'eager' : 'lazy'}
        priority={eager ? 'high' : 'normal'}
        transition={400}
        accessibilityLabel="Perrin's Barber Shop on Old Cross, Hertford: an olive shopfront with gold signwriting and window boxes full of flowers"
      />

      {scrim ? (
        <LinearGradient
          // Three stops rather than two. A straight fade to the ground colour
          // greys the middle of the photograph; holding transparent for the top
          // two thirds keeps the flowers and the fascia untouched and only
          // resolves into the page right at the bottom.
          colors={['transparent', 'transparent', color.ink]}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: color.inkDeep,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
});

/**
 * The shop's badge: panther, rose, arched gold lettering, "THE HERTFORD BARBER".
 *
 * It is `assets/logo.png`, the artwork exactly as supplied. Transparent, no
 * plate behind it and no background of ours: it sits directly on the page, the
 * way a decal sits on a window.
 *
 * The one thing done to it is a crop, and it is done in the layout rather than
 * to the file. The badge occupies 416 of the artwork's 640 points and the rest
 * of that square is empty, so drawing it at its nominal size gives a mark two
 * thirds the size anyone asked for. Instead the image is drawn at `size` over
 * `ARTWORK` and centred, which means the `size` prop is what it says: how big
 * the badge appears. The overflow is transparent, so nothing is clipped and
 * nothing covers its neighbours.
 *
 * If the artwork is ever replaced, re-measure. The bounding box of every pixel
 * with an alpha above 8, divided by the width of the square, is the number.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

/** Measured from assets/logo.png: 416 drawn points across a 640 point square. */
const ARTWORK = 0.65;

type Props = {
  /** How wide the badge should appear, in points. It is square. */
  size?: number;
};

export const Logo = memo(function Logo({ size = 168 }: Props) {
  const drawn = Math.round(size / ARTWORK);

  return (
    <View
      style={[styles.mark, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel="Perrin's, the Hertford Barber, established 1999"
    >
      <Image
        source={require('../assets/logo.png')}
        style={{ width: drawn, height: drawn }}
        contentFit="contain"
        // Eager, not the default lazy. The badge sits in the header of every
        // screen and in the hero, so it is above the fold every time; deferring
        // it until it is "near the viewport" only delays the first paint.
        loading="eager"
        priority="high"
        // A short fade rather than a pop. The badge is the first thing on the
        // page and it should arrive, not appear.
        transition={260}
        // The badge is decoration for a screen reader; the label is on the
        // wrapper so the two do not announce twice.
        accessible={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
});

/**
 * The shop name, set the way the shop sets it: three lines of heavy capitals,
 * hard left, tight enough that the block reads as one shape rather than three
 * words. It is the largest thing on the front page and the only place the
 * Poster cut of Old Tom is used.
 *
 * Poster Letter has no lowercase, which is not a limitation here: it is a
 * poster face and this is the one thing on the site set at poster size. Its
 * leading is pulled well under 1, or the three lines drift apart and the lockup
 * stops being a lockup.
 */
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { color, font, size, space } from '../theme';

type Props = {
  /** 'lg' is the front page lockup. 'sm' is one line, for a header bar. */
  size?: 'sm' | 'lg';
  /** How wide the caller knows this can be, in points. */
  room?: number;
  style?: StyleProp<ViewStyle>;
};

const LINES = ['PERRIN’S', 'BARBER', 'SHOP'] as const;

/** The tracking on the lockup. Added per character, including the last one. */
const TRACKING = 1;

/**
 * How wide the longest line is, in multiples of the type size.
 *
 * Measured off the face rather than guessed: the glyphs of "PERRIN'S" set in
 * Old Tom Poster Letter come to 3.282 ems. The tracking is a fixed number of
 * points on top of that, not a fraction of the size, which is why it is added
 * separately below; folding it into this number overflows the box on a phone
 * and is exactly the bug that once put an ellipsis in the shop's name.
 *
 * Re-measure if the face changes. In a browser:
 *   c = document.createElement('canvas').getContext('2d')
 *   c.font = '100px OldTomPoster'; c.measureText('PERRIN’S').width / 100
 */
const GLYPH_EMS = 3.29;

/** Below this the didone hairlines start to disappear, so it stops shrinking. */
const FLOOR = 26;

/** The largest type that fits the longest line into `room` points. */
function fits(room: number): number {
  // Two points of slack, so a rounding difference between measuring the box and
  // laying out the glyphs cannot push the last letter onto its own line.
  return (room - TRACKING * LINES[0].length - 2) / GLYPH_EMS;
}

export function Wordmark({ size: variant = 'lg', room: known, style }: Props) {
  const [measured, setMeasured] = useState(0);

  if (variant === 'sm') {
    return (
      <Text style={styles.small} accessibilityRole="header">
        {LINES[0]}
      </Text>
    );
  }

  // The caller works out how much room there is from the window and passes it
  // in; the layout pass below confirms it. Belt and braces on purpose: the mark
  // has to be right on the first frame, so it cannot wait to be measured, and
  // it has to stay right if the caller's arithmetic is ever off.
  const room = Math.min(measured || Number.POSITIVE_INFINITY, known ?? Number.POSITIVE_INFINITY);
  const fontSize = Number.isFinite(room)
    ? Math.max(FLOOR, Math.min(size.wordmark, fits(room)))
    : size.wordmark;

  return (
    <View
      style={style}
      onLayout={(event: LayoutChangeEvent) => setMeasured(event.nativeEvent.layout.width)}
      accessibilityRole="header"
      accessibilityLabel="Perrin's Barber Shop"
    >
      {LINES.map((line) => (
        <Text
          key={line}
          style={[styles.line, { fontSize, lineHeight: fontSize * 0.92 }]}
          // Belt and braces. If the measurement is ever wrong the mark loses a
          // letter, which is obvious and fixable; wrapping mid-word is neither.
          numberOfLines={1}
          accessible={false}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    fontFamily: font.displayBold,
    color: color.gold,
    letterSpacing: TRACKING,
  },
  small: {
    fontFamily: font.displayBold,
    fontSize: size.h3,
    letterSpacing: 2,
    color: color.gold,
    // Bodoni Black has almost no sidebearing at small sizes, so the mark needs
    // a hair of space before whatever sits next to it in the header.
    paddingRight: space.xs,
  },
});

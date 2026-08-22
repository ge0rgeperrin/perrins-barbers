/**
 * "Open now · closes 17:00" — recomputed every minute so it is never stale on a
 * screen someone left sitting on their kitchen table.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, dsize, font, radius, size, space } from '../theme';
import { hours, holidays } from '../lib/content';
import { openState } from '../lib/hours';

export function OpenNowChip({ align = 'center' }: { align?: 'left' | 'center' }) {
  const [state, setState] = useState(() => openState(hours, holidays));

  useEffect(() => {
    const tick = setInterval(() => setState(openState(hours, holidays)), 60_000);
    return () => clearInterval(tick);
  }, []);

  const text = state.open
    ? `Open now · closes ${state.closesAt}`
    : [state.reason, state.opensLabel].filter(Boolean).join(' · ');

  return (
    <View
      style={[
        styles.chip,
        align === 'left' && styles.chipLeft,
        state.open ? styles.chipOpen : styles.chipClosed,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: state.open ? color.open : color.closed }]} />
      <Text style={[styles.text, { color: state.open ? color.open : color.closed }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: space.sm,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLeft: { alignSelf: 'flex-start' },
  chipOpen: { borderColor: 'rgba(111,191,115,0.40)' },
  chipClosed: { borderColor: 'rgba(196,87,79,0.40)' },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  text: {
    fontFamily: font.display,
    fontSize: dsize(size.caption),
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

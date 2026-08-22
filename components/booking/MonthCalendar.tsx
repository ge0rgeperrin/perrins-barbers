/**
 * A month at a time, Monday first, the way a wall calendar reads.
 *
 * Kept deliberately plain: seven columns, no bleed-through from neighbouring
 * months, no badges, no counts. A day is either bookable or it is not, and the
 * only thing carrying colour is the day you have chosen. Everything the shop's
 * own scheduler shows, without the clutter.
 *
 * The grid is square-cell and fluid, so the same component is a comfortable
 * calendar on a 375px phone and a compact one in a 560px sheet on a desktop.
 */
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { color, dsize, font, radius, size, space } from '../../theme';
import {
  monthGrid,
  monthLabel,
  today,
  WEEKDAY_INITIALS,
  type DateKey,
  type MonthKey,
} from '../../lib/calendar';

type Props = {
  month: MonthKey;
  /** Dates in this month that have at least one free slot. */
  open: Set<DateKey>;
  selected?: DateKey;
  /** True while this month's availability is still on its way. */
  loading: boolean;
  onSelect: (date: DateKey) => void;
  onPage: (delta: number) => void;
  canPage: (delta: number) => boolean;
};

export function MonthCalendar({
  month,
  open,
  selected,
  loading,
  onSelect,
  onPage,
  canPage,
}: Props) {
  const now = today();
  const weeks = monthGrid(month);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Arrow direction="left" enabled={canPage(-1)} onPress={() => onPage(-1)} />
        <Text style={styles.month} accessibilityRole="header">
          {monthLabel(month)}
        </Text>
        <Arrow direction="right" enabled={canPage(1)} onPress={() => onPage(1)} />
      </View>

      <View style={styles.weekdays} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <Text key={i} style={styles.weekday}>
            {initial}
          </Text>
        ))}
      </View>

      <View style={loading ? styles.dim : undefined}>
        {weeks.map((week, index) => (
          <View key={index} style={styles.week}>
            {week.map((date, column) =>
              date ? (
                <Day
                  key={date}
                  date={date}
                  bookable={open.has(date) && date >= now}
                  selected={date === selected}
                  isToday={date === now}
                  onSelect={onSelect}
                />
              ) : (
                <View key={`gap-${column}`} style={styles.cell} />
              )
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

function Arrow({
  direction,
  enabled,
  onPress,
}: {
  direction: 'left' | 'right';
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [styles.arrow, pressed && enabled && styles.arrowPressed]}
    >
      <Feather
        name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
        size={20}
        color={enabled ? color.cream : color.mutedDim}
      />
    </Pressable>
  );
}

/**
 * Memoised on its own props: paging a month re-renders 42 of these, and typing
 * elsewhere in the sheet should not re-render any of them.
 */
const Day = memo(function Day({
  date,
  bookable,
  selected,
  isToday,
  onSelect,
}: {
  date: DateKey;
  bookable: boolean;
  selected: boolean;
  isToday: boolean;
  onSelect: (date: DateKey) => void;
}) {
  const press = useCallback(() => onSelect(date), [date, onSelect]);
  const day = Number(date.slice(8));

  return (
    <Pressable
      onPress={press}
      disabled={!bookable}
      accessibilityRole="button"
      aria-selected={selected}
      accessibilityState={{ selected, disabled: !bookable }}
      accessibilityLabel={`${day}${bookable ? '' : ', not available'}`}
      style={styles.cell}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.pill,
            bookable && styles.pillOpen,
            pressed && bookable && !selected && styles.pillPressed,
            selected && styles.pillSelected,
          ]}
        >
          <Text
            style={[
              styles.number,
              !bookable && styles.numberClosed,
              selected && styles.numberSelected,
            ]}
          >
            {day}
          </Text>
          {isToday && !selected ? <View style={styles.todayDot} /> : null}
        </View>
      )}
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  wrap: { gap: space.sm },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontFamily: font.display, fontSize: dsize(size.h4), color: color.cream },
  arrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
  },
  arrowPressed: { backgroundColor: color.panel2 },

  weekdays: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font.semibold,
    fontSize: 10,
    letterSpacing: 1,
    color: color.mutedDim,
    paddingBottom: space.xs,
  },

  week: { flexDirection: 'row' },
  // aspectRatio keeps the cells square at any width, so the grid never needs
  // measuring and never reflows while the sheet is animating open.
  cell: { flex: 1, aspectRatio: 1, padding: 2 },

  pill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  pillOpen: { borderColor: color.line, backgroundColor: color.panel2 },
  pillPressed: { backgroundColor: color.panelPress, borderColor: color.goldDeep },
  pillSelected: { backgroundColor: color.gold, borderColor: color.gold },

  number: { fontFamily: font.medium, fontSize: size.body, color: color.cream },
  numberClosed: { color: color.mutedDim },
  numberSelected: { color: color.onGold, fontFamily: font.semibold },

  todayDot: {
    position: 'absolute',
    bottom: 5,
    width: 3,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: color.gold,
  },

  // A month still loading fades rather than disappearing: the grid keeps its
  // shape, so nothing under the pointer moves.
  dim: { opacity: 0.35 },
});

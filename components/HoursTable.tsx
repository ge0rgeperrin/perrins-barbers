/**
 * The week, twice, in two different shapes.
 *
 * <HoursStrip> is a board: seven columns, opening time over closing time, today
 * raised onto glass. It is what the home screen uses, because a page whose every
 * section is a left-aligned list reads as a template, and this is a timetable
 * rather than a list. Seven narrow columns also fit a 375px phone comfortably
 * once the times are stacked instead of written as a range.
 *
 * <HoursTable> is the plain seven-row version, for the Visit screen, where
 * somebody has come specifically to read the hours and a row per day is the
 * clearest thing you can give them.
 *
 * <HoursList> is the shop's own version: seven lines, no rules, no box, day and
 * range on one line. It sits in the front page column beside the address, where
 * a bordered table would read as a widget dropped into a piece of print.
 *
 * Both are ordered Monday first, the way a shop sign reads, rather than Sunday
 * first, the way JavaScript counts.
 */
import { StyleSheet, Text, View } from 'react-native';
import { color, font, labelSmall, radius, size, space } from '../theme';
import { hours, holidays } from '../lib/content';
import { DAY_NAMES, DAY_SHORT, londonNow } from '../lib/hours';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

/**
 * Seven columns, opening over closing, today raised.
 *
 * The times are stacked rather than written as "09:00 to 18:00" for a practical
 * reason: a range needs about 90px and a seventh of a phone screen is 45px. Two
 * short lines fit, and a timetable reads perfectly well down a column.
 */
export function HoursStrip() {
  const today = londonNow().day;

  return (
    <View
      style={styles.strip}
      accessibilityRole="summary"
      accessibilityLabel={`Opening hours. ${WEEK.map((day) => {
        const entry = hours.find((h) => h.day === day);
        return `${DAY_NAMES[day]}, ${
          !entry || entry.closed ? 'closed' : `${entry.opens} to ${entry.closes}`
        }`;
      }).join('. ')}`}
    >
      {WEEK.map((day) => {
        const entry = hours.find((h) => h.day === day);
        const shut = !entry || entry.closed;
        const isToday = day === today;

        return (
          <View
            key={day}
            style={[styles.column, isToday && styles.columnToday]}
            // The whole strip is announced once above; the columns are visual.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={[styles.columnDay, isToday && styles.columnDayToday]}>
              {DAY_SHORT[day]}
            </Text>

            {shut ? (
              <Text style={[styles.shut, isToday && styles.columnTimeToday]}>Closed</Text>
            ) : (
              <>
                <Text style={[styles.columnTime, isToday && styles.columnTimeToday]}>
                  {entry.opens}
                </Text>
                <Text style={[styles.columnTime, isToday && styles.columnTimeToday]}>
                  {entry.closes}
                </Text>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Seven lines, unruled. Today is the only thing that changes colour, because
 * "what time do they shut today" is the question this answers nine times in ten.
 */
export function HoursList() {
  const today = londonNow().day;

  return (
    <View style={styles.list}>
      {WEEK.map((day) => {
        const entry = hours.find((h) => h.day === day);
        const isToday = day === today;
        const value = !entry || entry.closed ? 'Closed' : `${entry.opens}-${entry.closes}`;

        return (
          <Text key={day} style={[styles.listRow, isToday && styles.listToday]}>
            {`${DAY_SHORT[day]}  ${value}`}
          </Text>
        );
      })}
    </View>
  );
}

export function HoursTable() {
  const today = londonNow().day;

  return (
    <View style={styles.table}>
      {WEEK.map((day, index) => {
        const entry = hours.find((h) => h.day === day);
        const isToday = day === today;
        const value = !entry || entry.closed ? 'Closed' : `${entry.opens}-${entry.closes}`;

        return (
          <View
            key={day}
            style={[styles.row, index === WEEK.length - 1 && styles.lastRow, isToday && styles.today]}
          >
            <Text style={[styles.day, isToday && styles.todayText]}>{DAY_NAMES[day]}</Text>
            <Text style={[styles.value, isToday && styles.todayText]}>{value}</Text>
          </View>
        );
      })}

      {holidays.map((holiday) => (
        <View key={holiday.date} style={[styles.row, styles.lastRow, styles.holiday]}>
          <Text style={styles.day}>{holiday.date}</Text>
          <Text style={styles.value}>{holiday.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.md,
    paddingHorizontal: 2,
  },
  // Today is lifted onto a panel rather than tinted. A tint on a black ground
  // reads as a smudge; a panel reads as a raised piece of the board.
  columnToday: { backgroundColor: color.panel },
  columnDay: { ...labelSmall, letterSpacing: 1, color: color.mutedDim, marginBottom: 2 },
  columnDayToday: { color: color.gold },
  columnTime: {
    fontFamily: font.medium,
    fontSize: size.micro,
    color: color.muted,
    fontVariant: ['tabular-nums'],
  },
  columnTimeToday: { color: color.cream },
  shut: {
    fontFamily: font.body,
    fontSize: size.micro,
    color: color.mutedDim,
  },
  list: { gap: 3 },
  listRow: {
    fontFamily: font.body,
    fontSize: size.body,
    lineHeight: size.body * 1.5,
    color: color.muted,
    fontVariant: ['tabular-nums'],
  },
  listToday: { fontFamily: font.medium, color: color.goldLift },

  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.lineSoft,
  },
  lastRow: { borderBottomWidth: 0 },
  today: { backgroundColor: color.panel },
  holiday: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line },
  day: { fontFamily: font.body, fontSize: size.body, color: color.muted },
  value: {
    fontFamily: font.medium,
    fontSize: size.body,
    color: color.muted,
    fontVariant: ['tabular-nums'],
  },
  todayText: { color: color.goldLift },
});

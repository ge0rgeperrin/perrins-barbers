/**
 * Steps one and two: which barber, then which service.
 *
 * Both are plain lists of rows because that is what they are. The only motion is
 * the press state — the step transition itself is handled by the sheet.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { color, dsize, font, label, labelSmall, radius, size, space } from '../../theme';
import { useBooking } from '../../lib/booking';
import { useServices } from '../../lib/app-state';
import { categorise, headlinePrice } from '../../lib/services';

export function PickBarber() {
  const { providers } = useServices();
  const { chooseProvider, prefetch } = useBooking();

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {providers.map((provider) => (
        <Pressable
          key={provider.id}
          onPress={() => chooseProvider(provider)}
          // Warm the calendar for this barber's first service the moment a
          // pointer lands on the row, so the next step has nothing to fetch.
          onHoverIn={() =>
            provider.services[0] && prefetch(provider, provider.services[0])
          }
          onFocus={() => provider.services[0] && prefetch(provider, provider.services[0])}
          accessibilityRole="button"
          accessibilityLabel={`Book with ${provider.name}, ${provider.role}`}
          style={({ pressed }) => [styles.row, styles.barberRow, pressed && styles.pressed]}
        >
          <View style={styles.grow}>
            <Text style={styles.barberName}>{provider.name}</Text>
            <Text style={styles.role}>{provider.role}</Text>
          </View>
          <Text style={styles.from}>{headlinePrice(provider)}</Text>
          <Feather name="chevron-right" size={18} color={color.goldDeep} />
        </Pressable>
      ))}

      <Text style={styles.footnote}>
        {providers.length === 2
          ? 'Both barbers keep their own diary and their own prices.'
          : 'Each barber keeps their own diary and their own prices.'}
      </Text>
    </ScrollView>
  );
}

export function PickService() {
  const { provider, chooseService } = useBooking();
  if (!provider) return null;

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {categorise(provider).map((category) => (
        <View key={category.name} style={styles.group}>
          <Text style={styles.groupTitle}>{category.name}</Text>
          {category.services.map((service) => (
            <Pressable
              key={service.id}
              onPress={() => chooseService(service)}
              accessibilityRole="button"
              accessibilityLabel={`${service.name}, ${service.priceLabel}${
                service.note ? `, ${service.note}` : ''
              }`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.grow}>
                <Text style={styles.serviceName}>{service.name}</Text>
                {service.note ? <Text style={styles.note}>{service.note}</Text> : null}
              </View>
              <Text style={styles.price}>{service.priceLabel}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // The sheet is wide enough for a side-by-side calendar; a list of five rows
  // stretched to that width would look abandoned, so it keeps its own measure.
  list: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.xs,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  grow: { flex: 1, gap: 3 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.lineSoft,
  },
  barberRow: {
    minHeight: 72,
    paddingHorizontal: space.base,
    marginBottom: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
    backgroundColor: color.panel2,
  },
  pressed: { backgroundColor: color.panelPress },

  barberName: { fontFamily: font.display, fontSize: dsize(size.h3), color: color.goldLift },
  role: { ...labelSmall, color: color.mutedDim },
  from: { fontFamily: font.body, fontSize: size.caption, color: color.muted },

  group: { marginBottom: space.base },
  groupTitle: { ...label, color: color.gold, marginBottom: space.xs },
  serviceName: { fontFamily: font.medium, fontSize: size.body, color: color.cream },
  note: { ...labelSmall, color: color.gold },
  price: {
    fontFamily: font.display,
    fontSize: dsize(size.h4),
    color: color.goldLift,
    fontVariant: ['tabular-nums'],
  },

  footnote: {
    fontFamily: font.body,
    fontSize: size.caption,
    color: color.mutedDim,
    marginTop: space.sm,
  },
});

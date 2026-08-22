/**
 * The price list, set the way a barbershop sets one: service on the left, price
 * on the right, a run of dots between them.
 *
 * The dot leader is not decoration — it is what stops a price list reading like
 * a settings screen. It also does the job tabular figures would: the eye tracks
 * the row rather than the digits, so the display face can keep its own widths.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, dsize, font, label, labelSmall, radius, size, space } from '../theme';
import { useBooking } from '../lib/booking';
import { overrideFor, type Provider, type Service } from '../lib/services';

type Props = {
  service: Service;
  provider: Provider;
  /** Name the barber on the row. Needed wherever both price lists are mixed. */
  showBarber?: boolean;
};

export const PriceRow = memo(function PriceRow({ service, provider, showBarber = false }: Props) {
  const { start, prefetch } = useBooking();
  const blurb = overrideFor(service.id).blurb ?? service.description;

  return (
    <Pressable
      onPress={() => start({ provider, service })}
      onHoverIn={() => prefetch(provider, service)}
      onFocus={() => prefetch(provider, service)}
      accessibilityRole="button"
      accessibilityLabel={`Book ${service.name} with ${provider.name}, ${service.priceLabel}${
        service.note ? `, ${service.note}` : ''
      }`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.line}>
        <Text style={styles.name}>
          {service.name}
          {showBarber ? <Text style={styles.barber}>  {provider.name}</Text> : null}
        </Text>
        <View style={styles.leader} />
        <Text style={styles.price}>{service.priceLabel}</Text>
      </View>

      {service.note || blurb ? (
        <View style={styles.under}>
          {service.note ? <Text style={styles.note}>{service.note}</Text> : null}
          {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
});

export function PriceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space.sm, borderRadius: radius.card },
  pressed: { backgroundColor: color.panel },

  // Baseline-aligned so the dots sit on the same line as the type, not below it.
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  name: { fontFamily: font.body, fontSize: size.lead, color: color.cream, flexShrink: 1 },
  barber: { ...labelSmall, color: color.mutedDim },
  leader: {
    flex: 1,
    minWidth: space.lg,
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: color.goldDeep,
    borderStyle: 'dotted',
    opacity: 0.6,
    transform: [{ translateY: -3 }],
  },
  price: { fontFamily: font.display, fontSize: dsize(size.h4), color: color.goldLift },

  under: { marginTop: 4, gap: 3 },
  note: { ...labelSmall, color: color.gold },
  blurb: { fontFamily: font.body, fontSize: size.caption, color: color.mutedDim },

  group: { marginBottom: space.lg },
  groupTitle: {
    ...label,
    letterSpacing: 2,
    color: color.gold,
    marginBottom: space.xs,
  },
});

/**
 * The one gold-filled control in the app. If a screen has two of these, one of
 * them is wrong.
 *
 * It opens the booking sheet in place — nobody is sent off to another site.
 * Seeding it with a barber, or a barber and a service, skips the steps we
 * already know the answer to.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, dsize, font, radius, size, space } from '../theme';
import { useBooking } from '../lib/booking';
import type { Provider, Service } from '../lib/services';

type Props = {
  provider?: Provider;
  service?: Service;
  label?: string;
  subtitle?: string;
};

export function BookButton({ provider, service, label = 'Book now', subtitle }: Props) {
  const { start, prefetch } = useBooking();
  const [hovered, setHovered] = useState(false);

  const warm = () => {
    // With both known we can warm the exact calendar; with only a barber, warm
    // their most popular service, which is what most people pick anyway.
    if (provider && service) prefetch(provider, service);
    else if (provider?.services[0]) prefetch(provider, provider.services[0]);
  };

  return (
    <View>
      <Pressable
        onPress={() => start({ provider, service })}
        onHoverIn={() => {
          warm();
          setHovered(true);
        }}
        onHoverOut={() => setHovered(false)}
        onFocus={warm}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.button,
          hovered && styles.hovered,
          // A transform, not a size change: nothing around the button reflows,
          // so the press is answered on the next frame with no layout work.
          { transform: [{ scale: pressed ? 0.985 : 1 }] },
        ]}
      >
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.gold,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  hovered: { backgroundColor: color.goldLift },
  label: {
    // The one gold sign in the product, so it is lettered rather than set:
    // Old Tom capitals, letterspaced, the way the fascia is painted.
    fontFamily: font.display,
    fontSize: dsize(size.lead),
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.onGold,
  },
  subtitle: {
    fontFamily: font.body,
    fontSize: size.caption,
    color: color.mutedDim,
    textAlign: 'center',
    marginTop: space.sm,
  },
});

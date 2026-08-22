/**
 * The shop's phone number.
 *
 * A "Call" button is only honest where tapping it actually dials. In the app it
 * does; in a desktop browser a tel: link opens whatever handler the machine
 * happens to have, or nothing at all, which is worse than useless. So the
 * website shows the number itself — readable, selectable, and on a phone browser
 * still tappable — while the app keeps the button.
 */
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { color, font, labelSmall, radius, size, space } from '../theme';
import { openExternal } from '../lib/links';
import { business } from '../lib/content';

export const IS_APP = Platform.OS !== 'web';

/** The tile that sits in the home screen's row of quick actions. */
export function PhoneAction() {
  if (IS_APP) {
    return (
      <Pressable
        onPress={() => openExternal(business.phoneHref)}
        accessibilityRole="button"
        accessibilityLabel={`Call the shop on ${business.phone}`}
        style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      >
        <Feather name="phone" size={15} color={color.gold} />
        <Text style={styles.tileLabel}>Call</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.tile} accessibilityRole="text">
      <Text style={styles.caption}>Telephone</Text>
      <Text style={styles.number} selectable>
        {business.phone}
      </Text>
    </View>
  );
}

/**
 * Inline in running text or a footer: a link on a phone, plain selectable text
 * on the desktop web.
 */
export function PhoneNumber({ style }: { style?: object }) {
  if (IS_APP) {
    return (
      <Text
        accessibilityRole="link"
        onPress={() => openExternal(business.phoneHref)}
        style={[styles.inlineLink, style]}
      >
        {business.phone}
      </Text>
    );
  }
  return (
    <Text selectable style={[styles.inline, style]}>
      {business.phone}
    </Text>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
    backgroundColor: color.panel,
  },
  tilePressed: { backgroundColor: color.panel2, borderColor: color.goldDeep },
  tileLabel: {
    fontFamily: font.semibold,
    fontSize: size.caption,
    letterSpacing: 0.6,
    color: color.cream,
  },
  caption: { ...labelSmall, color: color.mutedDim },
  number: {
    fontFamily: font.medium,
    fontSize: size.caption,
    color: color.cream,
    fontVariant: ['tabular-nums'],
  },
  inline: { fontFamily: font.medium, fontSize: size.caption, color: color.cream },
  inlineLink: { fontFamily: font.medium, fontSize: size.caption, color: color.goldLift },
});

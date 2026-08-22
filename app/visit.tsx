/**
 * Visit: where the shop is, when it is open, how to reach it.
 *
 * The photograph lives here and only here. Old Cross is a narrow street of
 * similar frontages and the shop is easy to walk straight past, so a picture of
 * the front is better directions than another sentence of address. The front
 * page does not carry it: there the badge and the name are the composition.
 *
 * One section label on the whole page, for the hours. The rest lead with their
 * content: an address does not need a heading that says "address", and a page
 * where every block wears the same small-caps label is the rhythm that makes a
 * site read as generated rather than designed.
 *
 * It is also the way into the legal pages from inside the app, which is not an
 * afterthought: both app stores require a privacy policy the customer can reach
 * without leaving, and this is the screen where "about the shop" lives.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { color, display, dsize, font, size, space } from '../theme';
import { ActionButton, Body, Reveal, Screen, SectionRule } from '../components/ui';
import { Shopfront } from '../components/Shopfront';
import { HoursTable } from '../components/HoursTable';
import { OpenNowChip } from '../components/OpenNowChip';
import { BookButton } from '../components/BookButton';
import { PhoneAction } from '../components/Phone';
import { PageHead } from '../components/PageHead';
import { business, addressLine, hours } from '../lib/content';
import { describeWeek } from '../lib/hours';
import { openExternal } from '../lib/links';

export default function Visit() {
  const router = useRouter();
  const week = describeWeek(hours);

  return (
    <Screen>
      <PageHead
        title={`Visit Perrin's Barber Shop, Hertford`}
        description={`Perrin's Barber Shop, ${addressLine}. Opening hours, directions and phone number.`}
        path="/visit"
      />

      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Old Cross,{'\n'}Hertford
        </Text>
        <Text style={styles.address}>{business.address.join(' · ')}</Text>
        <OpenNowChip align="left" />
      </View>

      <View style={styles.actions}>
        <PhoneAction />
        <ActionButton
          label="Directions"
          hint={addressLine}
          onPress={() => openExternal(business.mapsUrl)}
        />
      </View>

      {/* The caption belongs to the photograph and says the one useful thing
          an address cannot: which of the frontages is this one. */}
      <Reveal index={0} style={styles.photo}>
        <Shopfront />
        <Text style={styles.caption}>Look for the flower boxes.</Text>
      </Reveal>

      <Reveal index={1} style={styles.section}>
        <SectionRule>Opening hours</SectionRule>
        <HoursTable />
        <Body style={styles.small}>
          {/* Read off the same hours the table renders, so the two can never
              contradict each other after an edit. */}
          {week ? `${week} ` : ''}
          Walk in if a chair is free. Saturdays go quickly, so it is worth booking.
        </Body>
      </Reveal>

      <Reveal index={2} style={styles.cta}>
        <BookButton />
      </Reveal>

      <Reveal index={3} style={styles.section}>
        <View style={styles.actions}>
          <ActionButton label="Instagram" onPress={() => openExternal(business.instagram)} />
          <ActionButton label="Facebook" onPress={() => openExternal(business.facebook)} />
        </View>

        <View style={styles.legal}>
          <Text style={styles.legalLine}>
            {`What we do with your details, and the terms you book under.`}
          </Text>
          <View style={styles.legalLinks}>
            <Text
              accessibilityRole="link"
              onPress={() => router.push('/privacy' as never)}
              style={styles.legalLink}
            >
              Privacy policy
            </Text>
            <Text
              accessibilityRole="link"
              onPress={() => router.push('/terms' as never)}
              style={styles.legalLink}
            >
              Terms of use
            </Text>
          </View>
        </View>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.xl, gap: space.md, alignItems: 'flex-start' },
  title: {
    ...display,
    fontSize: dsize(size.h2),
    lineHeight: dsize(size.h2) * display.lineHeight,
    color: color.cream,
  },
  address: { fontFamily: font.body, fontSize: size.body, color: color.muted },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.base, maxWidth: 420 },
  section: { marginTop: space.xxl, gap: space.base },
  photo: { marginTop: space.xl, maxWidth: 460, gap: space.sm },
  caption: { fontFamily: font.body, fontSize: size.caption, color: color.mutedDim },
  cta: { marginTop: space.xxl, maxWidth: 320 },
  small: { fontSize: size.caption, lineHeight: size.caption * 1.7, maxWidth: 460 },

  legal: {
    marginTop: space.xl,
    paddingTop: space.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
    gap: space.sm,
  },
  legalLine: { fontFamily: font.body, fontSize: size.caption, color: color.mutedDim },
  legalLinks: { flexDirection: 'row', gap: space.lg },
  legalLink: {
    fontFamily: font.semibold,
    fontSize: size.caption,
    letterSpacing: 0.4,
    color: color.goldLift,
  },
});

/**
 * The privacy policy and the terms, rendered from content/legal.json.
 *
 * The text is data, not markup, for two reasons. The owners can edit a policy
 * without meeting JSX; and the shop's contact details, and the booking window,
 * are substituted in from the settings the rest of the app uses — so a policy
 * cannot end up quoting a phone number or a booking horizon that changed months
 * ago somewhere else.
 */
import { StyleSheet, Text, View } from 'react-native';
import { color, display, dsize, font, size, space } from '../theme';
import { Screen } from '../components/ui';
import { PageHead } from './PageHead';
import { addressLine, booking, business } from '../lib/content';
import { countWord } from '../lib/services';
import legal from '../content/legal.json';

export type LegalDoc = {
  title: string;
  intro: string;
  sections: Array<{ heading: string; body: string[]; bullets?: string[] }>;
};

const FIELDS: Record<string, string> = {
  '{name}': business.name,
  '{phone}': business.phone,
  '{address}': addressLine,
  '{monthsAhead}': `${countWord(booking.monthsAhead)} month${booking.monthsAhead === 1 ? '' : 's'}`,
};

function fill(text: string): string {
  return text.replace(/\{[a-zA-Z]+\}/g, (token) => FIELDS[token] ?? token);
}

export function LegalScreen({ which, path }: { which: 'privacy' | 'terms'; path: string }) {
  const doc = legal[which] as LegalDoc;

  return (
    <Screen>
      <PageHead
        title={`${doc.title}: ${business.name}`}
        description={fill(doc.intro)}
        path={path}
      />

      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {doc.title}
        </Text>
        <Text style={styles.updated}>Last updated {legal.updated}</Text>
        <Text style={styles.intro}>{fill(doc.intro)}</Text>
      </View>

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          {/* A real heading, not the small-caps section label the rest of the
              site uses. A privacy policy has a dozen sections and a dozen
              eyebrow labels down a page is the rhythm that makes a site read as
              generated. These are document headings and they should look it. */}
          <Text style={styles.heading} accessibilityRole="header">
            {section.heading}
          </Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {fill(paragraph)}
            </Text>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <View style={styles.bulletMark} />
              <Text style={styles.bullet}>{fill(bullet)}</Text>
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.xxl, paddingBottom: space.lg, gap: space.sm },
  title: {
    ...display,
    fontSize: dsize(size.h2),
    lineHeight: dsize(size.h2) * display.lineHeight,
    color: color.cream,
  },
  updated: {
    fontFamily: font.semibold,
    fontSize: size.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.mutedDim,
  },
  intro: {
    fontFamily: font.body,
    fontSize: size.lead,
    lineHeight: size.lead * 1.55,
    color: color.muted,
    maxWidth: 560,
    marginTop: space.sm,
  },

  section: { marginBottom: space.xl, gap: space.md },
  heading: {
    ...display,
    fontSize: dsize(size.h4),
    lineHeight: dsize(size.h4) * 1.2,
    color: color.cream,
    marginTop: space.sm,
  },
  paragraph: {
    fontFamily: font.body,
    fontSize: size.body,
    lineHeight: size.body * 1.65,
    color: color.muted,
    maxWidth: 620,
  },
  bulletRow: { flexDirection: 'row', gap: space.md, maxWidth: 620 },
  // A small gold square rather than a dash. The dash it replaced was an em
  // dash used as a decorative glyph, which is the one thing this project has
  // banned outright from anything a customer can read.
  bulletMark: {
    width: 5,
    height: 5,
    marginTop: size.body * 0.7,
    backgroundColor: color.gold,
  },
  bullet: {
    flex: 1,
    fontFamily: font.body,
    fontSize: size.body,
    lineHeight: size.body * 1.6,
    color: color.muted,
  },
});

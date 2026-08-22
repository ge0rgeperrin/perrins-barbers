/**
 * Home.
 *
 * The composition comes from the shop's own printed material: the badge and the
 * name locked up together on the left, the shopfront underneath them, and
 * everything a customer actually needs stacked in a column on the right. The
 * name is set as large as it will go, because that is how the shop sets it, and
 * the gold button is the only saturated thing on the page.
 *
 * The two columns are deliberately different shapes. The left is artwork and the
 * right is information, so the page reads as one composition rather than as two
 * matching halves, and it collapses to a single column on a phone with the
 * artwork first.
 *
 * The order of the blocks below still comes from layout.home in content.json,
 * so the owners can move or remove one without touching this file.
 */
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { color, display, dsize, font, label, maxContentWidth, size, space, TAP } from '../theme';
import { ActionButton, Body, Reveal, Rule, Screen, SectionRule } from '../components/ui';
import { Logo } from '../components/Logo';
import { Wordmark } from '../components/Wordmark';
import { BookButton } from '../components/BookButton';
import { OpenNowChip } from '../components/OpenNowChip';
import { HoursList, HoursStrip } from '../components/HoursTable';
import { PriceRow } from '../components/PriceBoard';
import { PhoneNumber } from '../components/Phone';
import { PageHead } from '../components/PageHead';
import { HeroEntrance } from '../components/HeroEntrance';
import { useServices } from '../lib/app-state';
import { bookingSubtitle, featured, priceRange, type ServicesDoc } from '../lib/services';
import { business, addressLine, layout } from '../lib/content';
import { openExternal } from '../lib/links';

export default function Home() {
  const services = useServices();
  const blocks = layout.home;

  return (
    <Screen>
      <PageHead
        title={`${business.name}, Hertford`}
        description={`${business.tagline} Haircuts, skin fades and beard work. Prices, opening hours and online booking.`}
        path="/"
      />

      {blocks.map((block, index) => (
        <Block key={block} name={block} services={services} index={index} />
      ))}

      <Footer />
    </Screen>
  );
}

/** One named block from content.json. An unknown name renders nothing. */
function Block({
  name,
  services,
  index,
}: {
  name: string;
  services: ServicesDoc;
  index: number;
}) {
  if (name === 'hero') return <Hero services={services} />;
  // The hero is never revealed on scroll: it is already there when the page
  // opens, and fading in the thing someone came to see is theatre.
  const wrap = (node: React.ReactNode) => <Reveal index={index}>{node}</Reveal>;

  if (name === 'about') return wrap(<Chairs services={services} />);
  if (name === 'prices') return wrap(<Prices services={services} />);
  if (name === 'hours') return wrap(<Hours />);
  if (name === 'find') return wrap(<Find />);
  return null;
}

/* ------------------------------------------------------------------ */
/* hero: the badge and the name, then everything you need to know       */
/* ------------------------------------------------------------------ */

/** Wide enough for the badge to sit beside the name rather than above it. */
const LOCKUP_ROW = 820;

/**
 * How big the badge is and how much room the name has beside it.
 *
 * Worked out rather than left to flexbox, because the wordmark has to pick its
 * type size before it is laid out. The badge is sized first and the name gets
 * what is left: the name can be any size, the badge cannot go below the point
 * where the panther stops being a panther.
 *
 * Under 820 the badge goes above the name instead of beside it, and the name
 * gets the whole column. That is the opposite of the usual "shrink everything"
 * response to a narrow screen, and it is the right one here: side by side on a
 * phone leaves the name at 35pt, stacked it is 60pt.
 */
function heroMetrics(windowWidth: number) {
  const content = Math.min(windowWidth - space.lg * 2, maxContentWidth);
  const beside = windowWidth >= LOCKUP_ROW;
  const badge = beside
    ? Math.max(190, Math.min(340, windowWidth * 0.26))
    : Math.max(132, Math.min(240, windowWidth * 0.38));

  return {
    beside,
    badge,
    name: beside ? content - badge - space.lg : content,
  };
}

/** The shop's own words, one <Body> per paragraph. */
function Intro() {
  return (
    <View style={styles.lede}>
      {business.about.split('\n\n').map((paragraph) => (
        <Body key={paragraph.slice(0, 24)} style={styles.ledeText}>
          {paragraph}
        </Body>
      ))}
    </View>
  );
}

function Hero({ services }: { services: ServicesDoc }) {
  const { width } = useWindowDimensions();
  const metrics = heroMetrics(width);

  return (
    <HeroEntrance style={styles.hero}>
      <View style={[styles.lockup, metrics.beside ? styles.lockupRow : styles.lockupStack]}>
        <Logo size={metrics.badge} />

        <View style={metrics.beside ? styles.lockupName : undefined}>
          <Wordmark room={metrics.name} />
          {/* The shop's own hashtag, not a strapline written for a website. It
              sits under the mark as a caption because that is what it is: the
              thing you type, not the thing the shop is called. */}
          <Text style={styles.hashtag}>{business.strapline}</Text>
        </View>
      </View>

      <Rule style={styles.heroRule} />

      {/* The introduction against the one gold button.
          Side by side on a laptop. On one column the button goes FIRST, above
          the introduction rather than under it: the shop's own order puts the
          story first, but seven lines of it at this size is a screen and a half
          on a phone, and the thing the page exists for cannot be below that. */}
      <View style={styles.heroSplit}>
        {metrics.beside ? <Intro /> : null}

        <View style={styles.act}>
          <OpenNowChip align="left" />
          <BookButton label="Book an appointment" subtitle={bookingSubtitle(services)} />
        </View>

        {metrics.beside ? null : <Intro />}
      </View>

      <View style={styles.facts}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Opening hours</Text>
          <HoursList />
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Find us at</Text>
          <Text style={styles.factAddress}>{business.address.join('\n')}</Text>
          <PhoneNumber style={styles.factPhone} />
        </View>
      </View>
    </HeroEntrance>
  );
}

/* ------------------------------------------------------------------ */
/* about: who is in today                                               */
/* ------------------------------------------------------------------ */

/**
 * The barbers, straight from Schedulista, one to a line. If somebody is added
 * or removed in the diary this list changes on its own: nothing here knows a
 * barber's name and nothing has to be edited when the chairs change.
 *
 * A list rather than a sentence. "David and Ben" needed the conjunction to
 * agree with the count, which is a small thing to get wrong every time a third
 * barber starts, and a name on its own line reads as a name rather than as
 * prose about names.
 */
function Chairs({ services }: { services: ServicesDoc }) {
  if (!services.providers.length) return null;

  return (
    <View style={styles.chairs}>
      <Text style={styles.chairsLabel}>Chairs available:</Text>
      <View>
        {services.providers.map((provider) => (
          <Text key={provider.id} style={styles.chairsNames}>
            {provider.name}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* prices: the board                                                    */
/* ------------------------------------------------------------------ */

function Prices({ services }: { services: ServicesDoc }) {
  const router = useRouter();
  const picks = featured(services);
  const total = services.providers.reduce((n, provider) => n + provider.services.length, 0);
  const many = services.providers.length > 1;

  if (!picks.length) return null;

  return (
    <View style={styles.section}>
      {/* The one section label on this page. A price board is the single place
          a heading earns itself, because the rows underneath are not
          self-explanatory the way a photograph or an address is. */}
      <SectionRule>Prices</SectionRule>

      <View style={styles.board}>
        {picks.map(({ provider, service }) => (
          <PriceRow
            key={`${provider.id}-${service.id}`}
            service={service}
            provider={provider}
            showBarber={many}
          />
        ))}
      </View>

      <Text accessibilityRole="link" onPress={() => router.push('/services')} style={styles.more}>
        {`All ${total} prices${many ? `, ${services.providers.length} barbers` : ''}`}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* hours and find: not on by default, but an owner may add either back   */
/* ------------------------------------------------------------------ */

function Hours() {
  return (
    <View style={styles.section}>
      <HoursStrip />
    </View>
  );
}

function Find() {
  return (
    <View style={styles.find}>
      <Text style={styles.address}>{business.address.join('\n')}</Text>

      <View style={styles.findSide}>
        <PhoneNumber style={styles.findPhone} />
        <ActionButton
          label="Directions"
          hint={addressLine}
          onPress={() => openExternal(business.mapsUrl)}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* footer: the two ways to reach the shop online                       */
/* ------------------------------------------------------------------ */

const SOCIAL = [
  { icon: 'instagram', name: 'Instagram', href: () => business.instagram },
  { icon: 'facebook', name: 'Facebook', href: () => business.facebook },
] as const;

function Footer() {
  const services = useServices();

  return (
    <View style={styles.footer}>
      <Text style={styles.followLabel}>Follow us on social media</Text>

      <View style={styles.social}>
        {SOCIAL.map((item) => (
          <Pressable
            key={item.name}
            accessibilityRole="link"
            accessibilityLabel={item.name}
            onPress={() => openExternal(item.href())}
            style={({ pressed }) => [styles.socialTap, pressed && styles.socialPressed]}
          >
            <Feather name={item.icon} size={34} color={color.gold} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.credit}>
        {`${addressLine}. ${priceRange(services)}. Bookings run on Schedulista.`}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  hero: { paddingTop: space.lg, paddingBottom: space.xxl, gap: space.lg },

  // The badge and the name are one object. Aligned at the top: the badge is a
  // circle, and centring it against a three line block of capitals reads as a
  // mistake rather than as a decision.
  lockup: { alignItems: 'flex-start' },
  lockupRow: { flexDirection: 'row', gap: space.lg },
  lockupStack: { flexDirection: 'column', gap: space.base },
  // The name takes a flex basis of zero rather than its own width, so it is
  // handed the rest of the row and sizes its type to fit instead of wrapping
  // when the badge grows.
  lockupName: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },

  hashtag: {
    fontFamily: font.semibold,
    fontSize: size.lead,
    letterSpacing: 1.2,
    color: color.goldLift,
    marginTop: space.xs,
  },

  heroRule: { marginTop: space.sm },

  // The introduction against the button. 1.5 to 1 rather than even, because
  // prose wants a measure and a button does not.
  heroSplit: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: space.xl,
  },
  lede: { flexGrow: 3, flexShrink: 1, flexBasis: 420, gap: space.base, maxWidth: 620 },
  ledeText: {
    fontSize: size.lead,
    lineHeight: size.lead * 1.55,
    color: color.cream,
  },
  act: { flexGrow: 2, flexShrink: 1, flexBasis: 300, gap: space.base, alignItems: 'stretch' },

  // Hours and address side by side under the button, the way the shop's own
  // card sets them. They wrap to a single column well before the page does.
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
    marginTop: space.sm,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  fact: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: space.sm },
  factLabel: { ...label, color: color.gold },
  factAddress: {
    fontFamily: font.body,
    fontSize: size.body,
    lineHeight: size.body * 1.5,
    color: color.muted,
  },
  factPhone: { fontSize: size.body },

  section: { marginBottom: space.xxl, gap: space.base },

  chairs: {
    marginBottom: space.xxl,
    gap: space.xs,
    borderLeftWidth: 2,
    borderLeftColor: color.gold,
    paddingLeft: space.base,
  },
  chairsLabel: { ...label, color: color.mutedDim },
  chairsNames: {
    ...display,
    fontSize: dsize(size.h3),
    lineHeight: dsize(size.h3) * 1.2,
    color: color.goldLift,
  },

  board: { marginTop: -space.xs },
  more: {
    fontFamily: font.semibold,
    fontSize: size.caption,
    letterSpacing: 0.4,
    color: color.goldLift,
    marginTop: space.sm,
  },

  find: {
    marginBottom: space.xxl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.lg,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  findSide: { flexDirection: 'row', alignItems: 'center', gap: space.base },
  findPhone: { fontSize: size.body },
  address: {
    ...display,
    fontSize: dsize(size.h3),
    lineHeight: dsize(size.h3) * 1.25,
    color: color.cream,
  },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
    paddingTop: space.lg,
    alignItems: 'center',
    gap: space.md,
  },
  followLabel: { ...label, color: color.cream, letterSpacing: 2.2 },
  social: { flexDirection: 'row', gap: space.lg },
  socialTap: {
    minWidth: TAP,
    minHeight: TAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialPressed: { opacity: 0.65 },
  credit: {
    fontFamily: font.body,
    fontSize: size.micro,
    color: color.mutedDim,
    textAlign: 'center',
  },
});

/**
 * Prices — a board, not a settings screen.
 *
 * Barbers keep separate diaries and separate rates, so the list is per barber.
 * Whichever one you last looked at is remembered, so a regular opens the app on
 * their own prices.
 *
 * Everything here sizes itself to however many barbers Schedulista is offering.
 * One barber and the picker disappears entirely — there is nothing to pick. Two
 * and they share the width. Three or more and the row scrolls sideways instead
 * of squeezing every name into a column too narrow to read.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { color, display, dsize, font, labelSmall, size, space } from '../theme';
import { Screen, SectionRule } from '../components/ui';
import { PriceGroup, PriceRow } from '../components/PriceBoard';
import { BookButton } from '../components/BookButton';
import { PageHead } from '../components/PageHead';
import { useAppState } from '../lib/app-state';
import { categorise, cheapest, money, priceRange, type Provider } from '../lib/services';

const USUAL_BARBER_KEY = 'perrins.usualBarber';

/** Past this many barbers the row scrolls rather than shrinking. */
const SCROLL_TABS_AT = 3;

export default function Prices() {
  const { services, refreshing } = useAppState();
  const providers = services.providers;
  const [usual, setUsual] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(USUAL_BARBER_KEY).then(setUsual).catch(() => {});
  }, []);

  // Held by id, not by index. A barber leaving must not silently switch someone
  // onto a different barber's price list because the array got shorter.
  const provider = useMemo(
    () => providers.find((p) => p.id === usual) ?? providers[0],
    [providers, usual]
  );

  const choose = (next: Provider) => {
    setUsual(next.id);
    AsyncStorage.setItem(USUAL_BARBER_KEY, next.id).catch(() => {});
  };

  if (!provider) return null;

  const from = cheapest(provider);

  return (
    <Screen>
      <PageHead
        title="Prices at Perrin's Barber Shop, Hertford"
        description={`Full price list for Perrin's Barber Shop on Old Cross, Hertford: ${priceRange(services)} across haircuts, skin fades and beard work.`}
        path="/services"
      />

      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          Price list
        </Text>
        <Text style={styles.lede}>
          Every price comes straight out of the shop diary, so what you see here is what you pay.
        </Text>
      </View>

      <BarberTabs providers={providers} selected={provider} onChoose={choose} />

      <View style={styles.board}>
        {categorise(provider).map((category) => (
          <PriceGroup key={category.name} title={category.name}>
            {category.services.map((service) => (
              <PriceRow key={service.id} service={service} provider={provider} />
            ))}
          </PriceGroup>
        ))}
      </View>

      <View style={styles.cta}>
        <BookButton
          provider={provider}
          label={providers.length > 1 ? `Book with ${provider.name}` : 'Book now'}
        />
      </View>

      <SectionRule>Small print</SectionRule>
      <Text style={styles.note}>
        {from === null
          ? 'Prices are confirmed when you book.'
          : `${provider.name}’s work starts at ${money(from)}. Any surcharge is shown against the cut it applies to. Prices are confirmed when you book.`}
        {refreshing ? ' Checking for changes…' : ''}
      </Text>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function BarberTabs({
  providers,
  selected,
  onChoose,
}: {
  providers: Provider[];
  selected: Provider;
  onChoose: (provider: Provider) => void;
}) {
  // Nothing to choose between.
  if (providers.length < 2) return null;

  const scrolls = providers.length >= SCROLL_TABS_AT;

  const tabs = providers.map((provider) => {
    const active = provider.id === selected.id;
    const from = cheapest(provider);
    return (
      <Pressable
        key={provider.id}
        onPress={() => onChoose(provider)}
        accessibilityRole="tab"
        // aria-selected rather than accessibilityState: react-native-web drops
        // the latter for a tab, so a screen reader would announce two tabs and
        // no indication of which one you are on.
        aria-selected={active}
        accessibilityLabel={`${provider.name}${provider.role ? `, ${provider.role}` : ''}`}
        style={[styles.tab, scrolls ? styles.tabFixed : styles.tabShared, active && styles.tabActive]}
      >
        <Text style={[styles.tabName, active && styles.tabNameActive]} numberOfLines={1}>
          {provider.name}
        </Text>
        <Text style={[styles.tabRole, active && styles.tabRoleActive]} numberOfLines={1}>
          {[provider.role, from === null ? null : `from ${money(from)}`].filter(Boolean).join(' · ')}
        </Text>
      </Pressable>
    );
  });

  if (!scrolls) {
    return (
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
      accessibilityRole="tablist"
      style={styles.tabScroller}
    >
      {tabs}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  head: { paddingTop: space.xxl, paddingBottom: space.lg, gap: space.md },
  title: {
    ...display,
    fontSize: dsize(size.h2),
    lineHeight: dsize(size.h2) * display.lineHeight,
    color: color.cream,
  },
  lede: {
    fontFamily: font.body,
    fontSize: size.body,
    lineHeight: size.body * 1.6,
    color: color.muted,
    maxWidth: 460,
  },

  tabScroller: { marginBottom: space.xl, flexGrow: 0 },
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.xl },
  tab: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: 3,
    borderBottomWidth: 2,
    borderBottomColor: color.lineSoft,
  },
  tabShared: { flex: 1 },
  tabFixed: { minWidth: 132 },
  tabActive: { borderBottomColor: color.gold },
  tabName: { fontFamily: font.display, fontSize: dsize(size.h4), color: color.muted },
  tabNameActive: { color: color.goldLift },
  tabRole: { ...labelSmall, color: color.mutedDim },
  tabRoleActive: { color: color.gold },

  board: { marginBottom: space.lg },
  cta: { marginBottom: space.xxl, maxWidth: 320 },

  note: {
    fontFamily: font.body,
    fontSize: size.caption,
    lineHeight: size.caption * 1.6,
    color: color.mutedDim,
    marginTop: space.md,
    maxWidth: 480,
  },
});

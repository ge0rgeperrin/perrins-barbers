/**
 * The small shared pieces every screen is built from. Anything that appears on
 * more than one screen lives here so the spacing and rules stay identical.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, display, dsize, font, label, maxContentWidth, radius, size, space, TAB_BAR_HEIGHT } from '../theme';
import { duration, easeOut, isReducedMotion, NATIVE_DRIVER, travel } from '../lib/motion';

/* ------------------------------------------------------------------ */
/* reaching a block                                                     */
/* ------------------------------------------------------------------ */

/**
 * How a <Reveal> finds out it has been scrolled to.
 *
 * The obvious implementations are both wrong. Putting the scroll offset in React
 * state re-renders the whole page on every frame of every scroll. Listening to
 * the window is worse and does not exist on a phone.
 *
 * So the ScrollView writes its offset into a plain ref and calls a set of
 * subscribers directly. No state, no re-render. Each block subscribes once,
 * flips itself on the first frame it is within reach, and immediately
 * unsubscribes. The total React work for a page of six blocks is six state
 * updates, ever.
 */
type Watcher = (scrollY: number, viewport: number) => void;

const ScrollWatch = createContext<{
  add: (watcher: Watcher) => () => void;
} | null>(null);

/** A block counts as reached once its top passes this far up the viewport. */
const REACH = 0.85;

/**
 * The page. Painted ground, one centred column, bottom padding clear of the tab
 * bar.
 *
 * `bleed` lets a single child (the hero photograph) escape the column and run to
 * the edges of the screen while everything after it stays in the measure.
 */
export function Screen({
  children,
  bleed,
}: {
  children: ReactNode;
  /** Rendered full width, above the column. */
  bleed?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const watchers = useRef(new Set<Watcher>()).current;
  // Seeded from the window rather than left at zero. onLayout is authoritative
  // and overwrites this on the first pass, but until then a block that is
  // already on screen can be revealed straight away instead of waiting for a
  // layout event that may be a frame or two behind the first paint.
  const viewport = useRef(Dimensions.get('window').height);
  const offset = useRef(0);

  const api = useMemo(
    () => ({
      add(watcher: Watcher) {
        watchers.add(watcher);
        // Answer immediately as well: anything already on screen at mount has
        // been reached, and should not wait for the first scroll to admit it.
        watcher(offset.current, viewport.current);
        return () => {
          watchers.delete(watcher);
        };
      },
    }),
    [watchers]
  );

  return (
    <ScrollWatch.Provider value={api}>
      <ScrollView
        style={styles.screen}
        // Room at the end for the tab bar, which floats over the page rather
        // than sitting below it, so the last line of content would otherwise
        // finish underneath the glass. The bar's own height plus the home
        // indicator, and then space.huge on top of that, which is the same
        // trailing gap the page had before the bar started floating.
        //
        // There is no tab bar on the web, where the shell is a header.
        contentContainerStyle={[
          styles.screenContent,
          {
            paddingBottom:
              space.huge + insets.bottom + (Platform.OS === 'web' ? 0 : TAB_BAR_HEIGHT),
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={32}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height;
          for (const watcher of watchers) watcher(offset.current, viewport.current);
        }}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
          for (const watcher of watchers) watcher(offset.current, viewport.current);
        }}
      >
        {bleed}
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </ScrollWatch.Provider>
  );
}

/**
 * Content that arrives as you reach it: a short fade and a small rise, once.
 *
 * Once is the important word. A block that re-animates every time it crosses the
 * viewport turns a page into a slideshow, so this fires a single time and then
 * never touches the element again. Under reduced motion the rise is zero and
 * only the fade remains, which is enough to stop things appearing out of nowhere
 * without moving anything across the screen.
 */
export function Reveal({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  /** Position in a run of siblings, for the stagger. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const watch = useContext(ScrollWatch);
  const reduced = isReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const top = useRef(Number.POSITIVE_INFINITY);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    // No ScrollView above us, so there is nothing to be scrolled into. Show it.
    if (!watch) {
      setSeen(true);
      return;
    }
    if (seen) return;
    return watch.add((scrollY, viewport) => {
      if (viewport > 0 && top.current <= scrollY + viewport * REACH) setSeen(true);
    });
  }, [seen, watch]);

  useEffect(() => {
    if (!seen) return;
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: duration.reveal,
      delay: index * 60,
      easing: easeOut,
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();

    // Same rule as the hero: content is never left invisible because a frame
    // did not arrive. The timer settles the value whatever the browser does.
    const settle = setTimeout(() => enter.setValue(1), index * 60 + duration.reveal + 250);

    return () => {
      clearTimeout(settle);
      animation.stop();
    };
  }, [enter, index, seen]);

  return (
    <Animated.View
      onLayout={(event: LayoutChangeEvent) => {
        top.current = event.nativeEvent.layout.y;
      }}
      style={[
        style,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [travel(16), 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Small letterspaced caps above a heading. Rationed: see SectionRule. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

/**
 * A screen's own title, set in the display face at h2.
 *
 * Bodoni at this size needs the tracking pulled in and the leading tightened, or
 * the hairlines drift apart and it reads as a poster rather than a heading.
 */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

/**
 * A section marker: label, then a hairline running to the edge.
 *
 * USE THIS SPARINGLY. A small-caps label above every single section is the
 * rhythm that makes a page read as generated, and this site had four of them on
 * the home screen alone. The rule now is at most one per three sections; the
 * others simply lead with their content, because where a section sits on the
 * page already says what it is.
 */
export function SectionRule({ children }: { children: ReactNode }) {
  return (
    <View style={styles.sectionRule}>
      <Text style={styles.sectionRuleLabel} accessibilityRole="header">
        {children}
      </Text>
      <View style={styles.sectionRuleLine} />
    </View>
  );
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.rule, style]} />;
}

/**
 * A panel: one step up from the page, hairlined in gold. Everything raised off
 * the page ground uses this, and nothing else introduces a surface.
 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A secondary control: outlined, never filled. Gold fill is for booking only. */
export function ActionButton({
  label: text,
  hint,
  onPress,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${text}. ${hint}` : text}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      <Text style={styles.actionLabel}>{text}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ink },
  screenContent: { alignItems: 'center', paddingHorizontal: space.lg },
  column: { width: '100%', maxWidth: maxContentWidth },

  // Plain gold. On the black ground gold measures 8.1:1, so a small caps label
  // at 11px clears AA comfortably and does not need lifting.
  eyebrow: { ...label, color: color.gold, marginBottom: space.md },

  sectionTitle: {
    ...display,
    fontSize: dsize(size.h2),
    lineHeight: dsize(size.h2) * display.lineHeight,
    color: color.cream,
    marginBottom: space.md,
  },

  body: {
    fontFamily: font.body,
    fontSize: size.body,
    lineHeight: size.body * 1.6,
    color: color.muted,
  },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.line },

  sectionRule: { flexDirection: 'row', alignItems: 'center', gap: space.base },
  sectionRuleLabel: {
    ...label,
    color: color.gold,
    letterSpacing: 2.4,
  },
  sectionRuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color.line },

  card: {
    backgroundColor: color.panel,
    borderColor: color.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: space.base,
  },

  action: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
    backgroundColor: color.panel,
  },
  actionPressed: { backgroundColor: color.panel2, borderColor: color.goldDeep },
  actionLabel: {
    fontFamily: font.semibold,
    fontSize: size.caption,
    letterSpacing: 0.6,
    color: color.cream,
  },
});

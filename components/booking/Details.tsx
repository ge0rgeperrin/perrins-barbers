/**
 * Step four and the confirmation.
 *
 * By the time this renders, the hold — Schedulista's session and its CSRF token
 * — is usually already in hand, fetched the instant the time was tapped. So
 * "Confirm booking" has only the reservation itself left to do.
 *
 * Details are remembered locally after a successful booking, because a regular
 * should not type their phone number every six weeks.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { color, dsize, font, INPUT_FONT_SIZE, radius, size, space, TAP } from '../../theme';
import { duration, easeOut, NATIVE_DRIVER, useReducedMotion } from '../../lib/motion';
import { useBooking } from '../../lib/booking';
import { openHostedScheduler } from '../../lib/links';
import { booking as bookingSettings, business } from '../../lib/content';
import { longDate } from '../../lib/calendar';

const REMEMBERED = 'perrins.customer';

type Fields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
};

const EMPTY: Fields = { firstName: '', lastName: '', email: '', phone: '', notes: '' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "Tuesday, 25 August · 09:30" */
function whenLabel(date?: string, time?: string): string {
  if (!date) return '';
  return time ? `${longDate(date)} · ${time}` : longDate(date);
}

export function Details() {
  const booking = useBooking();
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [honeypot, setHoneypot] = useState('');
  const [smsReminder, setSmsReminder] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(REMEMBERED)
      .then((saved) => saved && setFields({ ...EMPTY, ...JSON.parse(saved), notes: '' }))
      .catch(() => {});
  }, []);

  // One stable setter per field, built once. Without this every keystroke hands
  // all five inputs a brand-new callback, defeating their memo and re-rendering
  // the whole form for one character — which is exactly what typing stutter is.
  const set = useMemo(() => {
    const make = (key: keyof Fields) => (value: string) =>
      setFields((current) => (current[key] === value ? current : { ...current, [key]: value }));
    return {
      firstName: make('firstName'),
      lastName: make('lastName'),
      email: make('email'),
      phone: make('phone'),
      notes: make('notes'),
    };
  }, []);

  const problems = {
    firstName: fields.firstName.trim() ? '' : 'Required',
    lastName: fields.lastName.trim() ? '' : 'Required',
    email: EMAIL.test(fields.email.trim()) ? '' : 'Check this',
    phone: fields.phone.replace(/\D/g, '').length >= 7 ? '' : 'Required',
  };
  const valid = Object.values(problems).every((problem) => !problem);

  const confirm = async () => {
    setTouched(true);
    if (!valid || booking.submitting) return;

    await booking.submit({
      firstName: fields.firstName.trim(),
      lastName: fields.lastName.trim(),
      email: fields.email.trim(),
      phone: fields.phone.trim(),
      notes: fields.notes.trim(),
      smsReminder,
      website: honeypot,
    });

    const { firstName, lastName, email, phone } = fields;
    AsyncStorage.setItem(REMEMBERED, JSON.stringify({ firstName, lastName, email, phone })).catch(
      () => {}
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Summary />

      <View style={styles.pair}>
        <Field
          label="First name"
          value={fields.firstName}
          onValue={set.firstName}
          error={touched ? problems.firstName : ''}
          autoComplete="given-name"
          textContentType="givenName"
        />
        <Field
          label="Last name"
          value={fields.lastName}
          onValue={set.lastName}
          error={touched ? problems.lastName : ''}
          autoComplete="family-name"
          textContentType="familyName"
        />
      </View>

      <Field
        label="Email"
        value={fields.email}
        onValue={set.email}
        error={touched ? problems.email : ''}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        hint="Your confirmation goes here."
      />

      <Field
        label="Phone"
        value={fields.phone}
        onValue={set.phone}
        error={touched ? problems.phone : ''}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <Field
        label="Anything the barber should know"
        value={fields.notes}
        onValue={set.notes}
        multiline
        optional
      />

      {bookingSettings.smsRemindersOffered ? (
        <Toggle label="Text me a reminder" value={smsReminder} onChange={setSmsReminder} />
      ) : null}

      {/* Honeypot: off-screen, never announced, never focusable by a person. */}
      <TextInput
        value={honeypot}
        onChangeText={setHoneypot}
        style={styles.honeypot}
        autoComplete="off"
        accessibilityElementsHidden
        importantForAccessibility="no"
        // eslint-disable-next-line react-native/no-raw-text
        placeholder="Leave this empty"
        tabIndex={-1}
      />

      {booking.error ? <Problem /> : null}

      <Pressable
        onPress={confirm}
        disabled={booking.submitting}
        accessibilityRole="button"
        accessibilityState={{ busy: booking.submitting, disabled: !valid && touched }}
        accessibilityLabel="Confirm booking"
        style={({ pressed }) => [
          styles.confirm,
          pressed && styles.confirmPressed,
          touched && !valid && styles.confirmBlocked,
        ]}
      >
        {booking.submitting ? (
          <ActivityIndicator color={color.onGold} />
        ) : (
          <Text style={styles.confirmLabel}>Confirm booking</Text>
        )}
      </Pressable>

      <Text style={styles.legal}>
        {`Booking goes straight into the shop diary. You’ll get a confirmation email from Schedulista, who handle ${business.name.replace(/ Barber Shop$/, '')}’s bookings. `}
        <Text
          accessibilityRole="link"
          onPress={() => {
            booking.close();
            router.push('/privacy' as never);
          }}
          style={styles.legalLink}
        >
          What happens to my details?
        </Text>
      </Text>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */

function Summary() {
  const { provider, service, date, slot } = useBooking();
  return (
    <View style={styles.summary}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryWhat}>{service?.name}</Text>
        <Text style={styles.summaryPrice}>{service?.priceLabel}</Text>
      </View>
      <Text style={styles.summaryWhen}>{whenLabel(date, slot?.label)}</Text>
      <Text style={styles.summaryWho}>with {provider?.name}</Text>
    </View>
  );
}

const Field = memo(function Field({
  label,
  value,
  onValue,
  error,
  hint,
  optional,
  multiline,
  ...input
}: {
  label: string;
  value: string;
  onValue: (value: string) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
  multiline?: boolean;
} & Omit<React.ComponentProps<typeof TextInput>, 'onChange' | 'value' | 'style'>) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>
          {label}
          {optional ? <Text style={styles.optional}>  optional</Text> : null}
        </Text>
        {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      </View>

      <TextInput
        {...input}
        value={value}
        onChangeText={onValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        placeholderTextColor={color.mutedDim}
        selectionColor={color.gold}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          Boolean(error) && styles.inputError,
        ]}
      />

      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={styles.toggle}
    >
      <View style={[styles.box, value && styles.boxOn]}>
        {value ? <Feather name="check" size={13} color={color.onGold} /> : null}
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

function Problem() {
  const { error } = useBooking();
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: reduced ? 0 : duration.in,
      easing: easeOut,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter, reduced]);

  if (!error) return null;

  return (
    <Animated.View
      accessibilityLiveRegion="assertive"
      style={[
        styles.problem,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        },
      ]}
    >
      <Text style={styles.problemTitle}>{error.message}</Text>
      {error.fields.map((line) => (
        <Text key={line} style={styles.problemLine}>
          {line}
        </Text>
      ))}
      {error.fallbackUrl ? (
        <Pressable onPress={() => openHostedScheduler(error.fallbackUrl)} accessibilityRole="button">
          <Text style={styles.problemLink}>Open the booking page instead</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */

export function Done() {
  const { provider, service, date, slot, close } = useBooking();
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(pop, {
      toValue: 1,
      duration: reduced ? 0 : duration.sheet,
      easing: easeOut,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [pop, reduced]);

  return (
    <View style={styles.done}>
      <Animated.View
        style={[
          styles.tick,
          { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] },
        ]}
      >
        <Feather name="check" size={26} color={color.onGold} />
      </Animated.View>

      <Text style={styles.doneWhat}>
        {service?.name} with {provider?.name}
      </Text>
      <Text style={styles.doneWhen}>{whenLabel(date, slot?.label)}</Text>
      <Text style={styles.doneBody}>
        A confirmation is on its way to your inbox. To change or cancel, use the link in that email
        or ring the shop on {business.phone}.
      </Text>

      <Pressable
        onPress={close}
        accessibilityRole="button"
        style={({ pressed }) => [styles.confirm, styles.doneButton, pressed && styles.confirmPressed]}
      >
        <Text style={styles.confirmLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  form: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.base,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },

  summary: {
    padding: space.base,
    gap: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
    backgroundColor: color.panel2,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryWhat: { fontFamily: font.medium, fontSize: size.body, color: color.cream, flex: 1 },
  summaryPrice: {
    fontFamily: font.display,
    fontSize: dsize(size.h4),
    color: color.goldLift,
    fontVariant: ['tabular-nums'],
  },
  summaryWhen: { fontFamily: font.display, fontSize: dsize(size.lead), color: color.cream },
  summaryWho: { fontFamily: font.body, fontSize: size.caption, color: color.muted },

  pair: { flexDirection: 'row', gap: space.sm },
  field: { flex: 1, gap: 6 },
  fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  fieldLabel: {
    fontFamily: font.semibold,
    fontSize: size.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.muted,
  },
  optional: { fontFamily: font.body, letterSpacing: 0, color: color.mutedDim },
  fieldError: { fontFamily: font.semibold, fontSize: size.micro, color: color.closed },

  input: {
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: font.body,
    // 16px, not the body size: anything smaller makes mobile Safari zoom the
    // page the moment the field takes focus, and it never zooms back out.
    fontSize: INPUT_FONT_SIZE,
    color: color.cream,
    backgroundColor: color.panel2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  inputFocused: { borderColor: color.gold, backgroundColor: color.panelPress },
  inputError: { borderColor: color.closed },
  hint: { fontFamily: font.body, fontSize: size.micro, color: color.mutedDim },

  honeypot: { position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TAP },
  box: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    borderRadius: radius.card,
  },
  boxOn: { backgroundColor: color.gold, borderColor: color.gold },
  toggleLabel: { fontFamily: font.body, fontSize: size.body, color: color.muted },

  problem: {
    padding: space.md,
    gap: space.xs,
    borderLeftWidth: 2,
    borderLeftColor: color.closed,
    backgroundColor: color.panel2,
  },
  problemTitle: { fontFamily: font.medium, fontSize: size.caption, color: color.cream },
  problemLine: { fontFamily: font.body, fontSize: size.caption, color: color.muted },
  problemLink: {
    fontFamily: font.semibold,
    fontSize: size.caption,
    color: color.goldLift,
    marginTop: space.xs,
  },

  confirm: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.gold,
    borderRadius: radius.card,
  },
  confirmPressed: { backgroundColor: color.goldLift },
  confirmBlocked: { backgroundColor: color.goldDeep },
  confirmLabel: {
    fontFamily: font.semibold,
    fontSize: size.body,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: color.onGold,
  },

  legal: {
    fontFamily: font.body,
    fontSize: size.micro,
    lineHeight: size.micro * 1.6,
    color: color.mutedDim,
    textAlign: 'center',
  },
  legalLink: { color: color.goldLift, fontFamily: font.medium },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md },
  tick: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: color.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  doneWhat: { fontFamily: font.display, fontSize: dsize(size.h4), color: color.cream, textAlign: 'center' },
  doneWhen: { fontFamily: font.display, fontSize: dsize(size.h3), color: color.goldLift, textAlign: 'center' },
  doneBody: {
    fontFamily: font.body,
    fontSize: size.caption,
    lineHeight: size.caption * 1.6,
    color: color.muted,
    textAlign: 'center',
    maxWidth: 340,
  },
  doneButton: { alignSelf: 'stretch', marginTop: space.base },
});

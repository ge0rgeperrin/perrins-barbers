# Getting the app onto the App Store and Google Play

What the two stores require, what this repository already provides, and what only
a person with the shop's accounts can do.

Everything under **In the build** is done. Everything under **You have to do
this** needs a human with a card and the shop's details.

---

## Before either store

| Thing | Status |
| --- | --- |
| A real domain with HTTPS | **You**, the app's booking calls go to `perrinsbarbers.co.uk`. Both stores reject an app pointing at localhost |
| Hosting that runs server code | **You**, the booking proxy is server-side. Cloudflare Workers runs the Expo `output: "server"` build |
| `BOOKING_SECRET` set in the host's environment | **You**, 32+ random characters. The server refuses to start in production without it |
| `EXPO_PUBLIC_SITE_URL` set for native builds | **You**, the phone has to be told where the site is |
| Privacy policy on a public URL | **In the build**, `/privacy`, reachable in the app from Visit → The small print |
| Terms on a public URL | **In the build**, `/terms` |
| An Expo account and `eas init` | **You**, writes `extra.eas.projectId` into `app.json` |

```bash
npx eas-cli@latest init
```

---

## Apple App Store

### Cost and accounts

- **Apple Developer Program, £79 a year.** Enrol at developer.apple.com.
- Enrol as an **organisation** if the shop is a limited company: you need a
  D-U-N-S number (free, but allow up to two weeks). Enrol as an **individual**
  if it is a sole trader, same day, but the app is listed under a person's name
  rather than "Perrin's Barber Shop".

### In the build

| Requirement | Where |
| --- | --- |
| Bundle identifier `uk.co.perrinsbarbers.app` | `app.json` → `ios.bundleIdentifier` |
| 1024×1024 icon, no alpha channel, square | `assets/icon.png`, written without an alpha channel on purpose; Apple rejects one that has it |
| Launch screen | `expo-splash-screen` plugin in `app.json` |
| Encryption declaration | `ITSAppUsesNonExemptEncryption: false`, true for us, HTTPS is exempt |
| Privacy manifest (`PrivacyInfo.xcprivacy`) | `app.json` → `ios.privacyManifests`. Declares name, email and phone as collected for app functionality, tracking off, and `CA92.1` as the reason for reading UserDefaults (the "remember my details" store) |
| Portrait-only, iPad supported | `orientation`, `ios.supportsTablet` |
| No account required to use the app | By design, there is nothing to sign into |

### You have to do this

1. **App Store Connect record.** Name (≤30 chars), subtitle (≤30), category
   **Lifestyle** with a secondary of **Business**, and a support URL, use
   `https://perrinsbarbers.co.uk/visit`.
2. **Screenshots.** Apple requires a 6.9-inch iPhone set (1290×2796 or
   1320×2868). Because `supportsTablet` is `true` you also need a 13-inch iPad
   set (2064×2752). If you would rather not produce iPad shots, set
   `"supportsTablet": false` in `app.json` and rebuild, the app is designed for
   a phone anyway.
   Capture them from the simulator: `npx expo run:ios`, then ⌘S in the simulator.
   Four is plenty, home, prices, the calendar, the confirmation.
3. **App privacy questionnaire.** Answer it to match the privacy manifest:

   | Question | Answer |
   | --- | --- |
   | Do you collect data? | Yes |
   | What | Contact Info → Name, Email Address, Phone Number |
   | Used for | App Functionality |
   | Linked to the user's identity | Yes |
   | Used for tracking | **No** |
   | Third-party partners | Schedulista (the booking system) |

4. **Age rating.** Answer everything "None" → **4+**.
5. **Privacy policy URL** → `https://perrinsbarbers.co.uk/privacy`.
6. **Review notes.** Tell the reviewer that bookings are real:

   > This app books appointments in a live barbershop diary. If you complete a
   > booking during review, please cancel it using the link in the confirmation
   > email, or ring 01992 500010. No account is needed to use any part of the app.

7. **Build and submit.**

   ```bash
   npx eas-cli@latest build --platform ios --profile production
   npx eas-cli@latest submit --platform ios
   ```

### Two guidelines worth reading before you submit

- **4.2 Minimum Functionality.** Apple rejects apps that are just a website in a
  wrapper. This one is not, the booking flow, the calendar and the price list
  are all native, but the review notes are a good place to say so.
- **5.1.1 Data Collection.** We only ask for details at the point of booking,
  which is what the guideline requires. Do not add a sign-up screen.

---

## Google Play

### Cost and accounts

- **Google Play Console, $25, once.** play.google.com/console.
- **Register as an organisation if you possibly can.** A *personal* developer
  account opened since November 2023 must run a closed test with **at least 12
  testers for 14 continuous days** before Google will let the app go to
  production. An organisation account skips that entirely. Registering the shop's
  limited company is worth the paperwork.

### In the build

| Requirement | Where |
| --- | --- |
| Application id `uk.co.perrinsbarbers.app` | `app.json` → `android.package` |
| Adaptive icon, foreground inside the safe zone | `assets/adaptive-icon.png` |
| Target API level Google currently requires | Handled by Expo SDK 57 |
| Only the permissions actually used | `android.permissions` is `ACCESS_NETWORK_STATE` only; camera, location, storage and microphone are explicitly blocked so no library can add them |
| 512×512 store icon | `assets/store/play-icon.png` |
| 1024×500 feature graphic | `assets/store/feature-graphic.png`, the shopfront cropped to the fascia and the flower boxes |

### You have to do this

1. **Store listing.** Title ≤30 characters, short description ≤80, full
   description ≤4000. A starting point:

   > **Short:** Book a chair at Perrin's Barber Shop, Old Cross, Hertford.
   >
   > **Full:** Perrin's has been cutting hair on Old Cross in Hertford since
   > 1999. See what each barber charges, check the opening hours, and book a
   > chair straight into the shop diary, no account, no sign-up, no payment
   > online. Prices come live from the shop's own booking system, so what you see
   > is what you pay.

2. **Screenshots.** At least two phone screenshots, 16:9 or 9:16, between 320px
   and 3840px on the long side. `npx expo run:android`, then the camera button in
   the emulator toolbar.
3. **Data safety form.** Same answers as Apple's:
   - Collected: Name, Email address, Phone number, and "Other in-app messages"
     for the note to the barber.
   - Purpose: **App functionality** only.
   - Shared with a third party: **yes, Schedulista**, for booking.
   - Encrypted in transit: **yes**.
   - Users can request deletion: **yes**, via the contact details in the policy.
4. **Content rating questionnaire (IARC).** Category "Reference, News or
   Educational" or "Utility"; answer everything "No" → rated for everyone.
5. **Target audience.** 18+ or 13+. **Not** "children", that triggers a much
   stricter policy set for no benefit.
6. **Ads declaration** → No ads.
7. **App access** → "All functionality is available without special access", no
   login, so no test credentials to provide.
8. **Privacy policy URL** → `https://perrinsbarbers.co.uk/privacy`.
9. **Build and submit.**

   ```bash
   npx eas-cli@latest build --platform android --profile production
   npx eas-cli@latest submit --platform android
   ```

---

## The icons

**These are the real badge now, not a placeholder.** `assets/icon.png`,
`adaptive-icon.png`, `splash-icon.png` and `store/play-icon.png` are all rendered
from the artwork the shop supplied, at the sizes and insets each store wants:

| File | Size | Note |
| --- | --- | --- |
| `icon.png` | 1024 | Opaque, badge on its own white, no rounding of ours. Apple applies its own mask |
| `adaptive-icon.png` | 1024 | Transparent, badge inset to 20% so Android's circular crop cannot clip the lettering |
| `splash-icon.png` | 512 | Transparent, shown on the black background |
| `store/play-icon.png` | 512 | Opaque, for the Play listing |

`scripts/make-icons.mjs` now draws **only the favicon**, and that is deliberate.
The badge is a ring of arched lettering around a panther; at 48px none of it is
legible and it turns into a brown smudge in a browser tab. The crossed scissors
from behind the lettering are two strokes and two rings, and they read cleanly at
that size, gold on black, unmistakably the same shop.

If you would rather have the panther in the tab, export just its head as a square
PNG, drop it in as `assets/favicon.png`, and stop running the script.

`public/og.jpg` is the social card, 1200x630, cropped from the shopfront photo to
keep the flower boxes and the fascia. Facebook and Instagram use it when the shop
shares a link.

The one thing still worth having is a **vector** of the badge. The raster is
6250px so every current size is covered, but a vector would give a legible
favicon and would survive any size the stores invent next.

## Order of work

1. Register the domain and deploy the site. Nothing else can be tested until the
   API routes are on a real HTTPS origin.
2. Set `BOOKING_SECRET` and `EXPO_PUBLIC_SITE_URL`.
3. Make **one real test booking** on the live site and then cancel it. This is
   the only part of the booking chain that has never been run end to end. Every
   step up to the final reservation has been verified, but no appointment has
   ever deliberately been created in the shop's diary.
4. Open the developer accounts. Apple's organisation enrolment is the long pole, so
   start it first.
5. Capture screenshots. The icons are done.
6. Submit. Apple review is usually a day or two; Google is usually a few days,
   or two weeks and a bit if you are on a personal account and have to run the
   closed test.

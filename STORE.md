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
| Build profiles (`eas.json`) | **In the build**, see below |
| An Expo account and `eas init` | **You**, writes `extra.eas.projectId` into `app.json` |

The Expo account is free, instant, and nothing to do with Apple or Google. It is
also not optional on a Windows machine: an iOS build needs macOS and Xcode, and
EAS renting a Mac in the cloud is the only way to get one from here.

```bash
npx eas-cli@latest init
```

### `eas.json`

Three profiles, all pinned to the live site so a build can never come out
pointing at localhost:

| Profile | What it makes | For |
| --- | --- | --- |
| `development` | Dev client. iOS internal distribution, Android APK | Running the app on your own phone with the debugger attached |
| `preview` | A real release build, installable without a store. Android APK | Letting the shop hold the finished app before either store sees it |
| `production` | iOS archive, Android App Bundle | The actual submission |

`appVersionSource` is `remote` and `production` sets `autoIncrement`, so EAS
keeps the build number and nobody has to remember to bump `app.json` before
every upload. The `1`s still in `app.json` are only the starting point EAS reads
once.

Both iOS profiles need the Apple Developer account before they can sign
anything. Android's `preview` APK needs no account at all.

---

### Over-the-air updates

`expo-updates` is installed and `.github/workflows/publish-update.yml` publishes
automatically, so a change to `content/content.json` reaches phones the same way
it reaches the website: commit, push, done. Without it, a bank holiday closure
would show on the site and not in the app until a new build cleared App Store
review.

**One thing to set up, once.** The workflow needs a robot token to publish as
you:

1. expo.dev, then your account, then **Access tokens**, then create one.
2. GitHub, the `perrins-barbers` repository, then **Settings, Secrets and
   variables, Actions**, then **New repository secret**, named `EXPO_TOKEN`.

Paste the token straight from Expo into GitHub. It never needs to be written
down anywhere else, and it does not belong in this repository.

**What an update cannot carry.** JavaScript and assets only, never native code.
That is why the workflow ignores `package.json` and `app.json`: a change to a
native dependency needs a real build, and publishing a JavaScript bundle the
installed native code cannot run would break the app on every phone at once.
When native things change, bump `version` in `app.json` and ship a build.


## Apple App Store

### Cost and accounts

**Done: enrolled, as an individual.** The Apple Developer Program is £79 a year,
at developer.apple.com.

One consequence of the individual route is better known before the listing is
live than after. The **app title still reads "Perrin's Barber Shop"**, but the
small seller line underneath it carries the enrolled person's legal name, not the
shop's. Only an organisation enrolment puts the shop's name there, and that needs
a D-U-N-S number and up to two weeks. Apple can transfer an app to an
organisation account later if the shop ever wants it; that is a form, not a
rebuild.

### In the build

| Requirement | Where |
| --- | --- |
| Bundle identifier `uk.co.perrinsbarbers.app` | `app.json` → `ios.bundleIdentifier` |
| 1024×1024 icon, no alpha channel, square | `assets/icon.png`, written without an alpha channel on purpose; Apple rejects one that has it |
| Launch screen | `expo-splash-screen` plugin in `app.json` |
| Encryption declaration | `ITSAppUsesNonExemptEncryption: false`, true for us, HTTPS is exempt |
| Privacy manifest (`PrivacyInfo.xcprivacy`) | `app.json` → `ios.privacyManifests`. Declares name, email and phone as collected for app functionality, tracking off, and `CA92.1` as the reason for reading UserDefaults (the "remember my details" store) |
| Portrait-only, iPhone only | `orientation`, and `ios.supportsTablet` is now `false`. The app is one column with a phone drawer for booking and there is nothing in it a tablet improves. Turning it off also drops a 2064x2752 iPad screenshot set from the submission, which would have meant borrowing an iPad |
| No account required to use the app | By design, there is nothing to sign into |

### You have to do this

The order matters. The build has to be on a real phone before the store listing
is worth filling in, because several of its fields depend on screenshots that do
not exist yet.

**Who types what.** Every command here authenticates against your Apple account.
Run them yourself. No password, no two-factor code and no signing key should ever
be pasted into a chat window, an email or this repository, for the same reason
`BOOKING_SECRET` is not in it.

#### 1. Expo account, and link the project

Free, instant, no card, nothing to do with Apple. Not optional on Windows: an
`.ipa` can only be built on macOS, and EAS renting a Mac in the cloud is the only
way to get one from here.

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` writes `extra.eas.projectId` into `app.json` in place of the `_note` that
sits there now. Commit it. It is an identifier, not a secret.

#### 2. Register the iPhone you will test on

```bash
npx eas-cli@latest device:create
```

Choose the QR option, open it on the phone, install the profile it offers. This
records the phone's UDID against your Apple team. Skip it and the build in the
next step installs on nothing.

#### 3. Build one you can actually hold

```bash
npx eas-cli@latest build --platform ios --profile preview
```

`preview` is a real release build with internal distribution: it installs
straight onto the registered phone, no TestFlight and no App Store review in the
way. The first run asks you to sign in to Apple, then generates the distribution
certificate and the provisioning profile for you. Let it. Managing signing by
hand is a category of problem worth never having.

Ten to twenty minutes, mostly queueing. It ends with a QR code. Scan it from the
phone.


#### 4. Check it on the phone

The first time this app has ever run on a phone, so this list is not ceremony.
Several of these confirm fixes that could not be tested any other way.

- [ ] It launches, and is still running ten seconds later
- [ ] Nothing on Home, Prices or Visit is hidden behind the clock or the Dynamic
      Island
- [ ] The waiting screen's footer line clears the home indicator
- [ ] Visit, then "Privacy policy", then **Back**, returns to Visit
- [ ] The prices on screen match the shop's Schedulista diary. If they are stale,
      the live price fetch is failing and the app is showing the snapshot bundled
      at build time
- [ ] Booking: the sheet rises, a barber and a service can be chosen, real times
      appear
- [ ] The sheet drags shut by its handle, and dragging over the calendar scrolls
      the calendar instead of throwing the booking away
- [ ] **On the details form, the keyboard does not cover the field you are typing
      into.** This one has never been exercised anywhere
- [ ] "Call" dials. "Directions" opens Maps
- [ ] Aeroplane mode shows the waiting screen, and turning it off recovers on its
      own without restarting the app

Then **make one real booking, from the app, for yourself, into a quiet slot.**
Check it appears in Schedulista. Then cancel it, using the link in the
confirmation email or by ringing the shop.

This is the last untested link in the whole project. Everything up to the final
reservation is covered by `npm test` and by the canary that runs every morning,
but no appointment has ever actually been created by this code. Doing it from the
app rather than the website proves both at once.

#### 5. Screenshots

Apple wants a **6.9 inch iPhone set: 1290x2796** portrait. 1320x2868 is also
accepted. There is no iPad set to produce any more.

**Done. Four of them are in `assets/store/ios`,** numbered in the order they
should be uploaded: Home, the price list, Visit, and the opening hours.

They came off an iPhone 16 Pro, which shoots 1206x2622, and they had been
trimmed before I saw them, so the four arrived at 1206 wide and three different
heights. An earlier version of this note guessed the aspect ratio would be close
enough for a plain resize. It was not: Apple's frame is proportionally taller
than any of them, so filling it would have cropped 43 pixels off each side and
clipped the text.

They are padded into the frame instead, with the colour sampled from each
image's own top edge, which on a screen this dark joins the picture invisibly
rather than at a step. To redo them after a change, the same recipe as the
icons, `@expo/image-utils`, with `resizeMode: 'contain'` and that sampled colour
as the background.

If you retake them, **do not trim them**. A whole 1206x2622 capture is almost
exactly Apple's ratio and needs nothing but a scale.

**One still worth adding: the booking flow.** These four show the shop, not the
thing the app does. Apple's 4.2 Minimum Functionality is the guideline this app
has to answer, and a picture of the calendar with real times on it answers it
better than the review notes can.


#### 6. The App Store Connect record

appstoreconnect.apple.com, then Apps, then New App. The bundle identifier
`uk.co.perrinsbarbers.app` is already in the list, because step 3 created it. The
SKU is internal and never shown to anybody, so it can be anything.

| Field | Limit | Value |
| --- | --- | --- |
| Name | 30 | `Perrin's Barber Shop` |
| Subtitle | 30 | `The Hertford barber since 1999` |
| Category | | **Lifestyle**, secondary **Business** |
| Support URL | | `https://perrinsbarbers.co.uk/visit` |
| Marketing URL | | `https://perrinsbarbers.co.uk` |
| Privacy policy URL | | `https://perrinsbarbers.co.uk/privacy` |

**Keywords**, 100 characters, comma separated, no spaces after the commas.
Nothing already in the name or the subtitle: Apple indexes those anyway and the
field is far too short to spend twice.

```
haircut,fade,skinfade,beardtrim,menshair,gentsbarber,walkin,appointment,SG14,OldCross,Ware
```

**Promotional text**, 170, and changeable later without a new build:

> Prices come straight from the shop's own diary, so what you see is what you
> pay. Book a chair in about thirty seconds. No account, no sign up, no card.

**Description**, 4000:

> Perrin's has been cutting hair on Old Cross in Hertford since 1999.
>
> Owned by the infamous David Perrin, Perrin's Barber Shop has been grooming the
> gentry of Hertford and the surrounding area since 1999. Trained in
> Knightsbridge and with over 40 years experience, David is a traditional barber
> who blends the best of old school technique with contemporary styles.
>
> Bookings available, or walk in.
>
> WHAT THE APP DOES
>
> See what each barber charges. Every price comes live from the shop's own
> booking system, so what you see is what you pay, and a price that changes in
> the shop changes here within minutes.
>
> Check the opening hours, including late nights and one off closures, and see at
> a glance whether the shop is open right now.
>
> Book a chair straight into the shop diary. Pick your barber, pick what you are
> having, pick a time from the real availability, and you are done. Your
> confirmation arrives by email, with a link to change or cancel it.
>
> No account. No sign up. No payment in the app. Your details are asked for once,
> at the point of booking, and remembered on your own phone so a regular never
> types their phone number twice.
>
> Perrin's Barber Shop, 5 Old Cross, Hertford, SG14 1HX. 01992 500010.

**Review notes.** Say this. A reviewer who completes a booking and leaves it puts
a real appointment in a working shop's diary:

> This app books appointments in a live barbershop diary. If you complete a
> booking during review, please cancel it using the link in the confirmation
> email, or ring 01992 500010. No account is needed to use any part of the app.

#### 7. The two questionnaires

**App privacy.** Answer it to match the privacy manifest in `app.json`, which is
the thing Apple checks it against:

| Question | Answer |
| --- | --- |
| Do you collect data? | Yes |
| What | Contact Info, then Name, Email Address, Phone Number |
| Used for | App Functionality |
| Linked to the user's identity | Yes |
| Used for tracking | **No** |
| Third-party partners | Schedulista, the booking system |

**Age rating.** Everything "None", which gives **4+**.

#### 8. Build the real one, and submit

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios
```

`production` sets `autoIncrement`, and `eas.json` sets `appVersionSource` to
`remote`, so EAS keeps the build number and nobody has to remember to bump
`app.json` before an upload.

After the first submission, `eas submit` can stop asking questions: put the
`ascAppId` and `appleTeamId` it used into `submit.production.ios` in `eas.json`.
Both are identifiers rather than secrets. Leave `appleId` out of the file, it is
an email address and EAS will prompt for it.

Review is usually a day or two.



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
| `icon-light.png` | 1024 | **iOS light mode.** Badge on white. No alpha channel at all, which is what Apple requires |
| `icon-dark.png` | 1024 | **iOS dark mode.** The same badge on the shop's own black, `#0C0B08`, the colour the splash screen already uses. Only the ground changes: the panther, the rose and the lettering are identical |
| `icon.png` | 1024 | Badge on white. Still the Android and web icon, and iOS's fallback |
| `adaptive-icon.png` | 1024 | Transparent, badge inset to 20% so Android's circular crop cannot clip the lettering |
| `splash-icon.png` | 512 | Transparent, shown on the black background |
| `store/play-icon.png` | 512 | Opaque, for the Play listing |

The two iOS icons are wired up in `app.json` under `ios.icon`, and iOS picks
between them by the phone's appearance setting. Nothing inside the app changes
with it: the app is dark either way, by design, and only the icon on the home
screen follows the system.

A **tinted** icon is deliberately not supplied. iOS 18 will derive one from the
light icon when somebody uses a tinted home screen, and a hand made one is worth
the effort only if that derived version turns out badly.

Both were generated from the 6250px master, `assets/source/logo.png`, with
`@expo/image-utils`, which ships with Expo. There is no script for it because it
is a thing that happens when the badge changes, which is close to never:

```
generateImageAsync({ projectRoot }, { src: 'assets/source/logo.png',
  width: 1024, height: 1024, resizeMode: 'contain',
  backgroundColor: '#FFFFFF' | '#0C0B08', removeTransparency: true })
```

`removeTransparency` is the part that matters. An earlier note here claimed
`icon.png` had been written without an alpha channel because Apple rejects one
that has it. It had not: it is a type 6 PNG, opaque but carrying an alpha
channel throughout. Expo flattens the icon while building, so it would not
actually have been rejected, but the claim was wrong and the two new files are
type 2, with no alpha channel to flatten.

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

Struck through is done. iOS is being taken all the way before Android starts, so
that a problem found on a phone is found once rather than twice.

1. ~~Register the domain and deploy the site.~~ Live on Cloudflare Workers at
   perrinsbarbers.co.uk. See `DEPLOY.md`.
2. ~~Set `BOOKING_SECRET` and `EXPO_PUBLIC_SITE_URL`.~~ Done. `eas.json` also
   pins `EXPO_PUBLIC_SITE_URL` into all three build profiles, so no build can
   come out of EAS pointing anywhere else.
3. ~~Open the Apple developer account.~~ Enrolled, as an individual.
4. Expo account, `eas init`, register the phone, and build the `preview` profile.
   Steps 1 to 3 of the Apple section above.
5. Check it on the phone, and **make the one real booking there**, from the app
   rather than the website. That single test proves the app and the last
   unverified link in the booking chain at the same time, which is why it is here
   rather than back at step 2 where it used to be.
6. Screenshots, off the same phone, resized to 1290x2796.
7. Fill in App Store Connect and submit. Review is usually a day or two.
8. **Then** Android. The Play Console account, the `production` App Bundle, and
   the one known Android-only gap: the hardware back button is not handled
   anywhere, so on Android it currently falls through to the system default.

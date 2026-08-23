# Perrin's Barber Shop, website & app

One Expo codebase that builds the website, the iPhone app and the Android app.
The whole booking flow, barber, service, live availability, customer details,
confirmation, happens inside our own interface. Schedulista is still the diary
and still sends the confirmation email; the customer never sees it.

The full build specification is in [perrins-build-spec.html](./perrins-build-spec.html) 
open it in a browser.

---

## For the shop

**[OWNERS.md](./OWNERS.md) is the guide.** It covers every setting in plain
English, with no assumed knowledge. The short version:

### Prices, services, barbers, time off

Do it in **Schedulista**, exactly as you do now. Nothing else to touch, ever.

The site re-reads Schedulista roughly every ten minutes, so a change is live
without a rebuild and without a developer. Add a barber and they appear 
grouped, priced, bookable, on the front page and in the price list, with the
layout rearranged around them. Take one off and every trace of them goes.

If a price ever looks wrong on the site, check Schedulista first. The site only
ever shows what Schedulista says.

### Everything else

Two files, both with a note above every section explaining what it does:

| To change | Edit |
| --- | --- |
| Opening hours, one-off closures | `content/content.json` → `hours`, `holidays` |
| The words about the shop | `business.about`, `business.tagline` |
| Phone, email, address, Instagram, Facebook | `business` |
| A notice across the top of every screen | `banner`, set `active` to `true` |
| **Colours, corner radius, spacing** | `design` |
| **The order of the blocks on the front page** | `layout.home` |
| **How far ahead people can book** | `booking.monthsAhead` |
| The privacy policy and the terms | `content/legal.json` |

Opening hours are the ones from the Google Business Profile: open seven days,
late on Wednesdays and Fridays, 08:00 starts on Saturdays. The sentence on the
Visit screen that describes the week is generated from those numbers, so it can
never contradict the table.

---

## For a developer

```bash
npm install
npm run sync      # pull the live price list from Schedulista
npm test          # parser, opening hours, booking proxy, no network
npm run canary    # live check that Schedulista's booking flow has not moved
npm run icons     # redraw the favicon
npm run check:dashes  # refuse any long dash a customer could read
npm run web       # dev server, API routes included, at http://localhost:8081
npm run ios       # or: npm run android
npm run build:web # server export into dist/
npm run build:cf  # that, plus the Worker entry, ready for wrangler deploy
npm run serve     # run that export the way the host will, at :8081
```

The web target is `output: "server"`, because the booking proxy needs somewhere
to run. Pages are still pre-rendered at build time, so SEO is unaffected.

**Deployment: Cloudflare Workers, at perrinsbarbers.co.uk. [DEPLOY.md](DEPLOY.md)
is the runbook**, including the nameserver change at 123 Reg and the two
variables. `wrangler.toml` and `worker/index.mjs` are committed and need no
editing; the module rules in `wrangler.toml` are load-bearing and commented
there. `expo-server` ships adapters for Express, plain Node, Netlify, Vercel,
Cloudflare Workers, Bun and EAS, so moving host later is a new entry file and
nothing else.

`npm run serve` matters more than it looks: it runs the exported `dist/` through
the same handler the host uses, so a deploy is never the first time the built
output has been executed. One trap it documents, in a comment at the top of
`scripts/serve.mjs`: `expo-server`'s ESM build uses extensionless relative
imports, which every bundler resolves and Node's own ESM loader refuses, so
plain Node has to require the CommonJS build.

### How the data flows

```
Schedulista (perrins1)
   │
   ├─ at request time ──► server/catalog.ts ──► GET /api/services  (10 min cache)
   │                                               │
   │                                               ▼
   │                                     the site and both apps
   │
   └─ at build time ────► scripts/sync-services.mjs (3× daily, GitHub Actions)
                             │
                             ├─► public/services.json   the deployed snapshot
                             └─► assets/services.json   bundled, for first paint
```

Both paths use **the same parser**, `server/catalog.ts`. The build-time snapshot
exists only so the first frame has real prices with no round trip; the live route
is what keeps it from ever being the newest thing a customer sees. If Schedulista
is down, the last good answer is served stale rather than blanking the shop.

Schedulista owns names, prices, which barber offers what, and **who the barbers
are**. `content.json` owns presentation only, and its `serviceOverrides` block is
normally empty:

### Nothing in the code knows a barber's name

This is the property the whole thing is built to keep. A barber added in
Schedulista this morning is bookable this morning, and:

- their services group themselves from their names (`classify` in
  `lib/services.ts`), Haircuts, Beard, Haircut & Beard, Colour, Extras, so
  they never land in an undifferentiated "More"
- one of their prices is taken onto the front page in rotation with the others,
  so no barber can be silently left off it
- the price list gives them a tab; past two barbers the tab row scrolls sideways
  rather than squeezing
- "In the chairs: …", the Book now subtitle, the "all N prices" link and the
  footnote in the booking sheet all count what is actually there
- with **one** barber the "who would you like?" step disappears from booking and
  the price list loses its tabs entirely
- the server's booking whitelist consults the live list too, so a new pair is
  accepted without a redeploy, with the build-time list as the floor, so an
  outage cannot lock customers out of services that have not changed

`lib/services.test.ts` covers all of it against barbers this codebase has never
seen.

### The guardrails

- `npm test` parses `fixtures/schedulista.html`, a frozen copy of the scheduler
  page. If Schedulista changes their markup this fails in CI **before** the sync
  can overwrite good prices with a bad parse.
- The sync refuses to write a file with fewer than five services, a provider with
  none, or a service missing an id. On any failure the previous `services.json`
  stays live and GitHub emails the repo owner.
- After genuinely fixing the parser for a Schedulista change, refresh the fixture
  with `npm run fixture`.

### Booking, in our own interface

Schedulista's scheduler sends **no CORS headers** and its session cookie is
`SameSite=Lax`, so a browser on our domain cannot call it and a cross-site form
POST would arrive without the session its CSRF token is bound to. The booking
conversation therefore happens server-side, in `server/schedulista.ts`, behind
three of our own API routes:

| Route | What it does |
| --- | --- |
| `GET /api/services` | The live service list, re-read from the scheduler on a 10-minute cache. What makes the site self-maintaining. |
| `GET /api/booking/availability` | A calendar month of free slots for one barber and service, in one reply. Days fanned out in batches upstream, cached 60s at the edge. Refuses a month past the booking horizon. |
| `GET /api/booking/hold` | Fetches Schedulista's details form and returns its session + CSRF token as an encrypted, 10-minute blob. Reserves nothing. |
| `POST /api/booking/reserve` | Validates, unseals the blob, submits the reservation. |

The three upstream endpoints are undocumented, so:

- **`npm run canary`** checks the live contract every morning in CI, slot shape,
  form fields, and that an invalid CSRF token is still rejected with 422. It
  never creates an appointment. When Schedulista changes something, a build fails
  instead of a customer's booking.
- Every failure that cannot be recovered returns a `fallbackUrl`, and the UI
  offers the hosted scheduler rather than pretending.
- A reservation whose outcome we cannot read is reported as **indeterminate** 
  the customer is told to ring the shop, never shown a confirmation that might be
  a lie.
- `assertKnownPair` allows only this shop's own barber/service ids through, so
  the endpoint cannot be pointed at another Schedulista business.
- `BOOKING_SECRET` (32+ characters) must be set in the hosting environment.
  Booking refuses to start in production without it.

**Why it feels instant.** Hovering a price row or the Book button warms the
calendar. Availability arrives a whole month in a single request, so every date
tap after that is pure re-render with no network. The month after the one on
screen is fetched in the background, so paging forward costs nothing either.
Tapping a time opens the hold in the background while the customer types, so
Confirm has only the reservation itself left to do. Steps mount and animate in 
there is no exit animation to sit through.

**Two rules the sheet is built on**, both learned the hard way:

1. **Never let `flex: 0` size a dialog.** In React Native it expands to
   `flexBasis: 0`, so a panel that sizes to its contents has a hypothetical
   height of zero and nothing grows it, the sheet collapsed to the two
   hairlines of its own border, mounted, on top of the page and invisible. The
   Book now button looked dead. `flexGrow: 0, flexShrink: 1, flexBasis: 'auto'`
   is what "as tall as your contents, capped by maxHeight" actually means.
2. **Never let correctness depend on an animation frame.** A browser that is
   not painting hands out no frames, so an `Animated` value stays at its start
   and an `animation.start(callback)` never fires. The sheet's opacity and its
   unmount are both settled by a `setTimeout`, which always fires; the animation
   only makes the settled state prettier. The same rule is why the step
   transition is enter-only, and why the time step seeds its width from
   `Dimensions` instead of waiting for `onLayout`, starting at zero laid it out
   stacked and then jumped to side-by-side on every single open.

Rule 2 applies to the front page as well: the hero entrance and every scroll
reveal start an animation *and* set a timer that settles the value regardless, so
a tab that never paints shows the page rather than a column of invisible text.

**Where the jank was.** Three more things, all fixed and all worth not
reintroducing: every animated component asked `AccessibilityInfo` separately, so
each one rendered, settled, and only *then* started moving; the time grid
remounted and re-staggered on every date tap; and every keystroke in the details
form re-rendered all five fields. Reduced motion is now resolved once at module
load and shared, the time grid does not animate at all, and each field has one
stable setter built once. Everything that does move moves opacity and transform
only, so no frame ever waits on a reflow.

> **Not yet exercised in production:** the final POST creates a real appointment
> in a real diary, so it has never been run for real. Everything up to it is
> verified against the live system. Before launch, have the shop make one test
> booking through the site and cancel it from the confirmation email.

### The calendar

A month at a time, Monday first. Paging stops at **three months**, which is what
the shop takes, `booking.monthsAhead` in `content.json`, and **enforced on the
server as well** by `assertWithinHorizon`, because the arrows stopping is a
courtesy and not a rule. Ask `/api/booking/availability` for a month past the
horizon and it answers with a refusal, not a diary.

- `lib/calendar.ts` holds every date calculation. Dates are `YYYY-MM-DD` strings
  in Europe/London, never `Date` objects passed around: a `Date` carries the
  visitor's own timezone with it, and a phone set to Madrid must not move a
  Hertford appointment by a day.
- The API takes `from`/`to` and returns up to 42 days, so one request covers a
  month. Every day in it is then free to browse.
- The month after the one on screen is fetched in the background, so paging
  forward costs nothing.
- Cells outside the month are blank rather than showing the neighbouring
  month's greyed-out numbers, which is the main thing that makes booking
  calendars look cluttered.
- Wide enough and the calendar sits beside the times; narrow and they stack.
  The breakpoint is measured with `onLayout` on the panel, not read from the
  window, so it responds to the space the component actually has.
- A day that could not be read is reported as **unknown**, never as closed. A
  fan-out of 31 requests makes Schedulista shed load; each day retries once with
  a backoff, the reply carries `partial` and `unreadable`, the flow refuses to
  auto-advance through a partial month, and the customer is told. Without that
  chain a throttled morning silently walked people six months forward.

### Typefaces and palette

**LHF Old Tom**, the shop's own face, licensed and supplied by the shop. It is
what the badge is lettered in, so the type on the page and the type on the mark
are the same drawing rather than a near miss. Two of its five cuts are loaded:

| Token | Cut | Used for |
| --- | --- | --- |
| `font.display` | Old Tom **Plain** | headings, prices, barber names, addresses, every small capital label, the Book button |
| `font.displayBold` | Old Tom **Poster Letter** | the shop's name, and nothing else. Heavy poster cut, capitals only: lowercase comes out as capitals |

The other three are in `assets/fonts` and are not loaded, so they cost nothing.
Poster Full and Poster Highlights are the layered pair that gives the inline
poster look; the badge does not use it, so neither does the site. Bodoni Moda,
which stood in while the licence was being sorted out, is gone. **Outfit** stays
as the body face: running prose, navigation and form fields are on it, because a
Victorian display face is for signage and not for paragraphs.

`DISPLAY_SCALE` in `theme.ts` exists because of one measurement. Old Tom's
capitals are exactly as tall as Outfit's, 71 against 70 at the same point size,
but an `H` is 46.8 units wide against 70.6: the face is a third narrower, so at
a matched size it covers much less of the line and reads as small type. Every
size in the display face goes through `dsize()`, which scales it by 1.3. It is
an optical correction, not a change to the scale, and body copy is untouched.

The wordmark sizes itself. The glyphs of `PERRIN'S` in Old Tom Poster Letter
measure 3.282 ems and the tracking is a fixed number of points on top of that,
so `components/Wordmark.tsx` solves for the size that fits the room it is given.
The front page sizes the badge first and hands the mark the rest, which is why
there is not a single type breakpoint between a 320px phone and a 1600px
desktop.

The palette is **black and gold**. `ink` is a true neutral black: an earlier
version carried a little warmth and read as brown next to the gold, which is the
one thing this palette cannot afford. `panel` is one step up from it, and gold
is the signwriting off the badge and the fascia. On that ground the accent
clears AA everywhere, which it did not on the olive the site wore for a
fortnight:

The gold is not chosen, it is **sampled**: `#C6A43C` is the exact value of the
lettering on the badge, read off the file, and the two status colours are the
rose and its leaves read the same way. Gold text on the site and gold text on
the shop's own mark are the same colour to the byte.

| against `ink` `#050505` | measured |
| --- | --- |
| cream `#F2EADA` | 17.0:1 |
| goldLift `#D8C17A` | 11.5:1 |
| muted `#B4B0A8` | 9.4:1 |
| gold `#C6A43C` | 8.5:1 |
| mutedDim `#8A867E` | 5.6:1 |
| gold on `panel` `#111111` | 7.9:1 |

Measured in the browser, not estimated, and written into the header of `theme.ts`
so the next person does not have to rediscover it. Because gold passes at label
size, small caps labels are plain gold and `goldLift` is free to mean what it
says: gold catching the light, for hover states and prices.

The vermilion and the leaf green are the rose and its leaves from the badge, used
for "closed" and "open now". They are the only two colours in the product that
are not black or gold.

### Motion

Reanimated 4 with gesture-handler, so springs and the drag run on the UI thread.
`lib/motion.ts` holds every curve, spring and duration, and its header explains
the rule that decides them: **whether a thing animates at all is decided by how
often it is seen.**

| Interaction | Frequency | What it gets |
| --- | --- | --- |
| Opening the sheet | occasional | 400ms, spring, no bounce |
| Step to step in the sheet | tens per session | 180ms, opacity plus 12px |
| **Choosing a day or a time** | **constant** | **press feedback only** |
| Page load | once | staggered entrance, under 500ms |
| Scroll reveals | once each | 500ms, once, never again |
| Confirmation | once per booking | the only bounce in the product |

The third row is the important one. The time grid does not animate when you
change day, and that is deliberate: the month is already in memory, so the list
simply differs on the next frame. At that frequency an animation stops reading as
polish and starts reading as lag.

No `ease-in` anywhere. It starts slow, which delays the exact instant the
customer is watching hardest and makes the same duration feel longer. Curves are
the strong variants (`cubic-bezier(0.23, 1, 0.32, 1)` and friends), because the
built-in easings are too weak to read as deliberate.

**Drag to dismiss.** On a phone the sheet follows a finger exactly. Release is
decided by distance **or** velocity: past 110px it goes, and under that a flick
over 0.11 px/ms still goes, because requiring a long drag makes a sheet feel
stuck. Pulling up gets progressively harder rather than stopping dead. All of it
is on the UI thread, so it keeps up with a finger while the calendar is fetching.

**Reduced motion means fewer and gentler, not none.** The previous version
switched everything off, which is the obvious reading and the wrong one. What
makes people ill is movement, so `travel()` and `scaleFrom()` in `lib/motion.ts`
collapse to zero while short opacity fades stay. Removing the fades too would
make content appear out of nowhere, which is worse for comprehension, not better.

### The badge and the photograph

**The badge is the artwork exactly as supplied, transparent, on no plate.** It
had a white plate behind it for a day and that was wrong. What it does have is a
crop, done in the layout rather than to the file: the drawn part of the badge
covers 416 of the artwork's 640 points and the rest of that square is empty, so
`components/Logo.tsx` draws the image at `size / 0.65` and centres it. The
overflow is transparent, nothing is clipped, and the `size` prop means what it
says. Re-measure that constant if the artwork is ever replaced.

Just over half the badge is drawn in pure black, which on a black page is
invisible. The shop looked at the reverse of it, cream linework instead of
black, and preferred the original: the cream fills, the rose and the gold ring
carry it, and the black reads as separation rather than as a hole.

**The photograph lives on Visit and nowhere else.** On the front page the badge
and the name are the composition and a photograph under them competes with the
mark. On Visit it is doing a job: Old Cross is a row of similar frontages and a
picture of the front is better directions than another line of address.

Two rules held while wiring the images in:

- **Fixed aspect ratio before the file loads.** `components/Shopfront.tsx` and
  `components/Logo.tsx` are both sized by prop, so the space is reserved and the
  page never jumps as an image arrives.
- **Nothing above the fold is lazy.** expo-image defaults to `loading="lazy"`,
  which for a hero image means lazy-loading the largest contentful paint. The
  badge passes `loading="eager"` everywhere it appears.

The supplied files were 5MB and 890KB of PNG. `assets/source/` keeps them
untouched; `assets/` holds a 384KB JPEG and a 68KB PNG, and `public/og.jpg` is
the 1200x630 social card. That is a 5MB saving on first paint.

### Telephone

A "Call" button is only honest where tapping it dials. `components/Phone.tsx`
shows a button in the app and the number itself on the website, still tappable
on a phone browser, no dead button on a desktop.

### No offline mode, on purpose

The shop asked for an app that does not work without a connection. `lib/app-state.tsx`
holds the entire app behind a live connectivity check and shows the waiting
screen until the device is back on the network, retrying every three seconds.
Nothing is written to disk, so nobody is ever shown a stale price.

On the web the check runs after hydration, so the pre-rendered HTML still
contains the real page for Google, and dropping Wi-Fi mid-visit still shows the
waiting screen.

### Layout

```
app/                    Expo Router, one file per route, all three platforms
  _layout.tsx             fonts, connection gate, tabs (phone) / header (web)
  +html.tsx               web-only HTML shell: meta, JSON-LD HairSalon schema
  index.tsx               Home, blocks rendered in the owners' chosen order
  services.tsx            Prices
  visit.tsx               Visit
  privacy.tsx             both render content/legal.json
  terms.tsx
  api/
    services+api.ts       the live service list
    booking/              server routes, never bundled into the native app
      availability+api.ts
      hold+api.ts
      reserve+api.ts
server/                 server-only; must never be imported by a screen
  catalog.ts              the one parser, and the live-list cache
  schedulista.ts          the entire conversation with Schedulista
  seal.ts                 encrypts the hold so no cookie reaches a browser
  http.ts                 JSON replies, error translation, rate limit
  booking.test.ts
components/
  booking/                the sheet and its four steps
  LegalScreen.tsx         renders a legal document from JSON
  ...                     shared UI; ui.tsx holds the primitives
lib/
  booking.tsx             flow state, caching, prefetching
  booking-api.ts          typed client for /api/booking
  motion.ts               durations, easings, reduced-motion switch
  services.ts             grouping, featuring and every sentence about the shop
  content.ts              CMS stand-in; hours.ts; calendar.ts; links.ts
theme.ts                every colour, size and typeface, read from content.json
content/
  content.json            the owner-editable settings
  legal.json              the privacy policy and the terms
scripts/                sync-services.mjs, make-icons.mjs, save-fixture.mjs,
                        canary-booking.mjs
fixtures/               frozen scheduler page for the parser test
assets/                 generated icons; store/ holds the Play listing art
public/                 served as-is; services.json lands here
```

Also worth reading: **[OWNERS.md](./OWNERS.md)** (what the shop can change) and
**[STORE.md](./STORE.md)** (what each app store requires, and what is already
in the build).

### Legal

`/privacy` and `/terms` are rendered from `content/legal.json` and reachable from
the web footer, from Visit → The small print in the app, and from a link under
the Confirm button. `{name}`, `{phone}`, `{email}`, `{address}` and
`{monthsAhead}` are substituted from the same settings the rest of the app uses,
so a policy cannot quote a phone number or a booking window that changed
elsewhere.

They were written to describe **what this code actually does**, name, email,
phone and the optional note go to Schedulista and nowhere else; nothing is
written to a database of ours; the only thing stored is on the customer's own
device; there are no cookies, no analytics, no trackers; the app asks the phone
for network state and nothing else. If the way booking works changes, they have
to change with it.

### Still to do

- **One end-to-end test booking**, then cancel it. The final POST has never been
  run for real; everything before it has.
- **Tell Schedulista.** The booking integration uses three undocumented
  endpoints of theirs, plus a read of their public scheduler page. Email support,
  explain what the site does, and ask whether they will support it or offer a
  proper API. If they do, only `server/schedulista.ts` and `server/catalog.ts`
  change.
- **Store accounts and listings**, see [STORE.md](./STORE.md). Screenshots and
  the developer accounts are the only things nobody but the shop can do.
- **A vector of the badge** would still be worth having. The raster is 6250px and
  scales fine for every current use, but a vector would give a legible favicon
  and would survive any future size.
- **Gallery screen**, deliberately not built. There are no photographs of the
  work yet, and an empty gallery tab is worse than no tab.
- **Sanity CMS**, `content.json` matches the planned schema field for field, so
  the swap is `lib/content.ts` and nothing else.
- **Deploy**, set `BOOKING_SECRET` and `EXPO_PUBLIC_SITE_URL`, then confirm the
  origin in `lib/services.ts` points at the real domain.
- **Push notifications** for cancellations, after launch, once the shop asks.

### Known cost

Adding Reanimated and gesture-handler took the web bundle from 1.3MB to 2.4MB.
That buys UI-thread springs and the drag-to-dismiss sheet, which is the right
trade for an app that is also two app store builds. If the website alone ever
needs to be leaner, the sheet is the only thing that depends on either library.

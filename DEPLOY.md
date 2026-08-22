# Putting the site live

The domain is **perrinsbarbers.co.uk**, registered at 123 Reg. The host is
**Cloudflare Workers**. This is the whole runbook, in order. It takes about half
an hour, most of which is waiting for DNS.

The domain stays registered at 123 Reg. Only its nameservers move to Cloudflare,
which is free and is not a transfer. Nothing in this runbook costs anything: the
Cloudflare free plan covers DNS, the certificate, the CDN and the Worker, and the
123 Reg renewal is the same bill it always was.

Read the two boxes at the bottom before you start: one is a secret you must
generate yourself, the other is a booking that has never been tested for real.

---

## Why it cannot be plain static hosting

Schedulista sends **no CORS headers** and its session cookie is `SameSite=Lax`,
so a browser on our domain cannot talk to it at all. Every booking therefore
goes through four of our own API routes, server-side. 123 Reg's own web hosting
will not run those. Cloudflare will.

The build produces two folders:

| Folder | What it is | Who serves it |
| --- | --- | --- |
| `dist/client` | the JS bundle, the fonts, the badge, `og.jpg` | Cloudflare's asset store, straight off the edge, without waking the Worker |
| `dist/server` | the pre-rendered pages and the four API routes | the Worker, `worker/index.mjs` |

`wrangler.toml` already wires both up. Nothing in this section needs changing,
but do not tidy the module `rules` in it: Workers has no filesystem, so
`dist/server` ships as modules inside the Worker, and those rules are what decide
whether `node:crypto` reaches the booking code. The comments in that file say
which change breaks what, and `npm test` fails if one of them is undone.

---

## 1. Put the code on GitHub

Cloudflare can deploy from your machine, but from GitHub it redeploys on every
change and, more importantly, the two scheduled jobs in `.github/workflows/`
start running: the price sync three times a day and the booking canary every
morning before the shop opens. Those only work in a repository.

```bash
git init && git add -A && git commit -m "Perrin's Barber Shop"
```

Then create a **private** repository on GitHub and push to it. Private matters:
`content.json` carries the shop's phone number and email, and there is no
reason for the world to have the source.

`.gitignore` already excludes `.env`, so no secret goes up with it.

## 2. Connect Cloudflare

1. Sign up at cloudflare.com. The **Free** plan is the whole of what this needs.
2. **Compute, then Workers, then Create, then Import a repository**, and pick the
   repository.
3. Set the build command to `npm run build:cf` and the deploy command to
   `npx wrangler deploy`. Cloudflare reads everything else out of `wrangler.toml`.
   Do not override the name, the assets folder or the module rules.
4. Deploy. The first build takes two or three minutes.

You get a URL like `perrins-barbers.workers.dev`. Booking will not work on it
yet, because the secret in step 3 is not set. Everything else will.

## 3. Set the two variables

These go in **two different places**, and putting either in the other one fails
quietly rather than loudly.

| Variable | Where | Value | Why |
| --- | --- | --- | --- |
| `BOOKING_SECRET` | the Worker's **secret**: Worker, then Settings, then Variables and Secrets. Or `npx wrangler secret put BOOKING_SECRET` | 32+ random characters, see the box below | Encrypts the ten minute booking hold. Read at request time, server side only. Booking refuses to start in production without it, deliberately: a guessable key would let somebody forge a hold. |
| `EXPO_PUBLIC_SITE_URL` | the **build's** environment: Workers Builds, then Build configuration, then Variables | `https://perrinsbarbers.co.uk` | Written into the `canonical` and `og:` tags, and it is the address the phone apps call. |

> **Generate the secret yourself, and do not paste it into a chat window, an
> email or a commit.** On any machine with Node:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
> ```
>
> Cloudflare's secret store is the only place it needs to exist. It can be
> changed whenever you like; the only cost is that anybody mid-booking in the
> previous ten minutes has to pick their time again.

`EXPO_PUBLIC_SITE_URL` is read when the site is **built**, not when it is
visited, which is why it is a build variable rather than a Worker one. After
changing it, redeploy.

## 4. Move the domain's DNS to Cloudflare

**In Cloudflare: Add a site**, enter `perrinsbarbers.co.uk`, choose the **Free**
plan. Cloudflare reads the records 123 Reg is publishing today and shows you what
it found.

**Check that list before you go on**, and in particular check the **MX records**
if email is set up on this domain. Anything missing from Cloudflare's copy stops
working the moment the nameservers change, and mail is the one that hurts.

Cloudflare then gives you two nameservers. In 123 Reg: **Manage domains, then
perrinsbarbers.co.uk, then Change nameservers**, and enter those two in place of
the 123 Reg ones. The domain is still registered at 123 Reg, still renews there,
and still shows in that account. Only who answers DNS questions changes.

Then wait. Usually under an hour. Cloudflare emails when the zone goes active.

To check from your own machine:

```bash
nslookup -type=ns perrinsbarbers.co.uk
```

## 5. Point the domain at the Worker

**Compute, then the Worker, then Settings, then Domains and Routes, then Add,
Custom domain.** Add both:

- `perrinsbarbers.co.uk`
- `www.perrinsbarbers.co.uk`

Cloudflare writes the DNS records and issues the HTTPS certificate itself. There
is nothing to buy: no SSL from 123 Reg, no add-on, and no records to type by
hand.

The Worker sends `www` to the bare domain with a 301, which is what the rest of
the site assumes: every canonical tag it writes is the bare domain, and having
both answer independently would split the shop's search ranking in two.

Last, in **SSL/TLS, then Edge Certificates**, turn **Always Use HTTPS** on, and
set the encryption mode to **Full (strict)**.

## 6. Check it properly

Once the padlock is showing, go through all of this. It is the difference
between "the site loads" and "the shop can take bookings".

- [ ] `https://perrinsbarbers.co.uk` loads, badge and name and all
- [ ] `https://www.perrinsbarbers.co.uk` redirects to it, rather than serving a
      second copy
- [ ] `http://` redirects to `https://`
- [ ] Prices show, and match the shop's Schedulista diary
- [ ] **Book an appointment opens the sheet, a barber and a service can be
      chosen, and real times appear.** If the times never load, `BOOKING_SECRET`
      is missing or the deploy predates it
- [ ] Page forward in the calendar: it stops three months out
- [ ] The Instagram, Facebook and email icons in the footer go somewhere real
- [ ] On a phone, on mobile data, not just on the shop's wifi
- [ ] Paste the link into a WhatsApp or Facebook message: the shopfront photo
      and the shop's name should appear, not a grey box
- [ ] `/robots.txt` and `/sitemap.xml` both answer

Then **one real booking**, described in the box at the end of this file.

## 7. Tell Google it exists

Not urgent, and worth ten minutes. Add the site at Google Search Console
(search.google.com/search-console), verify by DNS, which gives you a TXT record
to add: it now goes in Cloudflare's DNS panel rather than 123 Reg's. Then submit
`https://perrinsbarbers.co.uk/sitemap.xml`.

While you are there: the shop's **Google Business Profile** is what most people
in Hertford will actually see. Put the website link on it.

---

## Afterwards

**Changing the shop's words, hours or colours.** Edit `content/content.json`,
commit, push. Cloudflare rebuilds and the change is live in about two minutes.
`OWNERS.md` explains every field in plain English.

**Prices and barbers change on their own.** They come from Schedulista at
request time on a ten minute cache. A barber added at nine is bookable before
ten, with no deploy and no edit here.

**Deploying without GitHub**, if you ever need to:

```bash
npm ci
npm run build:cf
npx wrangler deploy
```

**Running the production build on your own machine**, which is worth doing
before any deploy you are unsure about. There are two ways and they prove
different things:

```bash
npm run build:web
BOOKING_SECRET=a-long-development-value npm run serve
```

That serves the exported files through the same Expo handler on plain Node, at
`:8081`. It is the quickest way to see whether the booking flow itself works.

```bash
npm run build:cf
npx wrangler dev
```

That runs Cloudflare's real runtime on your machine, at `:8787`, and it is the
only thing that proves the Worker's module rules are right. Open
`/api/booking/availability` on it: that route is the first to reach
`node:crypto`, so it is the one that fails if they are not.

Booking needs the secret there too, and `wrangler dev` will not read `.env`.
Put a throwaway one in a `.dev.vars` file at the top of the project:

```
BOOKING_SECRET=any-32-plus-character-string-for-local-use
```

`.gitignore` already excludes it. It is a local development value and has
nothing to do with the real secret in Cloudflare.

---

> **Two things this deployment does not do for you.**
>
> **The final booking POST has never been run for real.** Every step up to it is
> verified against the live Schedulista, including the canary that runs each
> morning, but creating an appointment in a working shop's diary to prove a
> point is not something to do unasked. Before you tell anyone the site is open:
> make one booking through it, check it appears in Schedulista, then cancel it.
>
> **`hello@perrinsbarbers.co.uk` is in the footer and in the privacy policy, and
> nobody has created it yet.** It is the address a customer uses to ask what
> data the shop holds. Either set the mailbox up at 123 Reg, or change
> `business.email` in `content/content.json` to an address that is actually read.
> If you do set it up, remember its MX records have to live in Cloudflare's DNS
> now, not 123 Reg's.

---

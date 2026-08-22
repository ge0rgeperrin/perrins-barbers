# Putting the site live

The domain is **perrinsbarbers.co.uk**, registered at 123 Reg. The host is
**Netlify**. This is the whole runbook, in order. It takes about half an hour,
most of which is waiting for DNS.

Read the two boxes at the bottom before you start: one is a secret you must
generate yourself, the other is a booking that has never been tested for real.

---

## Why it cannot be plain static hosting

Schedulista sends **no CORS headers** and its session cookie is `SameSite=Lax`,
so a browser on our domain cannot talk to it at all. Every booking therefore
goes through four of our own API routes, server-side. 123 Reg's own web hosting
will not run those. Netlify will.

The build produces two folders:

| Folder | What it is | Who serves it |
| --- | --- | --- |
| `dist/client` | the JS bundle, the fonts, the badge, `og.jpg` | Netlify's CDN, straight off disk |
| `dist/server` | the pre-rendered pages and the four API routes | one Netlify function, `netlify/functions/server.mjs` |

`netlify.toml` already wires both up. Nothing in this section needs changing.

---

## 1. Put the code on GitHub

Netlify can deploy from your machine, but from GitHub it redeploys on every
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

## 2. Connect Netlify

1. Sign up at netlify.com with the GitHub account.
2. **Add new site, then Import an existing project**, and pick the repository.
3. Netlify reads `netlify.toml` and fills in the build command, the publish
   folder and the functions folder. Do not override them.
4. Deploy. The first build takes two or three minutes.

You get a URL like `perrins-barbers.netlify.app`. Booking will not work on it
yet, because the secret in step 3 is not set. Everything else will.

## 3. Set the two environment variables

**Site configuration, then Environment variables.** Both are needed before the
site is usable, and one of them is why the first deploy could not book.

| Variable | Value | Why |
| --- | --- | --- |
| `BOOKING_SECRET` | 32+ random characters, see the box below | Encrypts the ten minute booking hold. Server side only. Booking refuses to start in production without it, deliberately: a guessable key would let somebody forge a hold. |
| `EXPO_PUBLIC_SITE_URL` | `https://perrinsbarbers.co.uk` | Written into the `canonical` and `og:` tags, and it is the address the phone apps call. |

> **Generate the secret yourself, and do not paste it into a chat window, an
> email or a commit.** On any machine with Node:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
> ```
>
> Netlify's environment variables are the only place it needs to exist. It can
> be changed whenever you like; the only cost is that anybody mid-booking in the
> previous ten minutes has to pick their time again.

`EXPO_PUBLIC_SITE_URL` is read when the site is **built**, not when it is
visited, so after changing it use **Deploys, then Trigger deploy, then Clear
cache and deploy site**.

## 4. Tell Netlify about the domain

**Domain management, then Add a domain**, and enter `perrinsbarbers.co.uk`.

Netlify will say the domain is registered elsewhere and ask you to point DNS at
it. Add `www.perrinsbarbers.co.uk` as well, and set the **bare domain as the
primary**. Netlify then redirects `www` to it automatically, which is what the
rest of the site assumes: every canonical tag it writes is the bare domain, and
having both answer independently would split the shop's search ranking in two.

## 5. The DNS records at 123 Reg

In 123 Reg: **Manage domains, then perrinsbarbers.co.uk, then Manage DNS**.

Add these two. Leave every other record alone, and in particular **do not touch
the MX records** if email is set up on this domain, or the shop's mail stops.

| Type | Host or Name | Points to | TTL |
| --- | --- | --- | --- |
| A | `@` (the bare domain) | `75.2.60.5` | 3600 |
| CNAME | `www` | `your-site-name.netlify.app` (Netlify shows the exact name) | 3600 |

If there is already an A record on `@` pointing at a 123 Reg parking page,
**edit that one** rather than adding a second. Two A records means the domain
answers from two places at random.

Then wait. Usually ten minutes, occasionally a couple of hours. Netlify's domain
panel shows a green tick when it sees the change, and issues the HTTPS
certificate on its own a minute later. There is nothing to buy: no SSL from
123 Reg, no add-on.

To check from your own machine:

```bash
nslookup perrinsbarbers.co.uk
```

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
to add at 123 Reg in the same place as step 5, and submit
`https://perrinsbarbers.co.uk/sitemap.xml`.

While you are there: the shop's **Google Business Profile** is what most people
in Hertford will actually see. Put the website link on it.

---

## Afterwards

**Changing the shop's words, hours or colours.** Edit `content/content.json`,
commit, push. Netlify rebuilds and the change is live in about two minutes.
`OWNERS.md` explains every field in plain English.

**Prices and barbers change on their own.** They come from Schedulista at
request time on a ten minute cache. A barber added at nine is bookable before
ten, with no deploy and no edit here.

**Deploying without GitHub**, if you ever need to:

```bash
npm ci
npx netlify-cli deploy --build --prod
```

**Running the production build on your own machine**, which is worth doing
before any deploy you are unsure about:

```bash
npm run build:web
BOOKING_SECRET=any-32-characters-will-do-locally npm run serve
```

That serves the exported files the same way Netlify does, so if booking works
there it will work in production.

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

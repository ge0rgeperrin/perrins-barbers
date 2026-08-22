# Running the site yourself

Everything on this page can be changed without a developer. You need two files
and nothing else:

| File | What it controls |
| --- | --- |
| `content/content.json` | The shop's details, opening hours, colours, layout, how far ahead people can book |
| `content/legal.json` | The privacy policy and the terms |

**You never edit prices, services or barbers.** Those come out of Schedulista on
their own, see [Barbers and prices](#barbers-and-prices) below.

---

## Before you start

1. Everything in these files is inside quote marks and separated by commas. If
   you delete a comma or a quote mark the site will not build. Paste the file
   into <https://jsonlint.com> if you are unsure, it will point at the mistake.
2. Any line whose name starts with an underscore (`_readme`, `_hoursNote`) is a
   note to you. It does nothing. Leave it or delete it, whichever you prefer.
3. Save the file, commit it, and the site rebuilds itself. Nothing else to do.
4. If you break something, every setting has a safe fallback, a bad number or a
   misspelled block name is ignored rather than taking the site down.

---

## Opening hours

```json
"hours": [
  { "day": 0, "opens": "10:00", "closes": "14:00" },
  { "day": 1, "opens": "", "closes": "", "closed": true },
  ...
]
```

`day` is 0 for Sunday through to 6 for Saturday. Times are 24-hour. For a day the
shop does not open, set `"closed": true`.

Change these and **four things update at once**: the hours table, the "Open now"
chip on the front page, the sentence on the Visit screen that says which days are
late and which are closed, and what Google reads about the shop. You do not have
to edit that sentence, it is written from these numbers.

### One-off closures

```json
"holidays": [
  { "date": "2026-12-25", "label": "Christmas Day" },
  { "date": "2026-12-26", "label": "Boxing Day" }
]
```

A holiday closes the whole day and takes priority over the normal hours. Delete
old ones when they have passed.

---

## A notice across the top

```json
"banner": {
  "active": true,
  "text": "Closed for refurbishment, back Tuesday 3rd",
  "link": ""
}
```

Set `active` back to `false` to take it down.

---

## How far ahead people can book

```json
"booking": {
  "monthsAhead": 3,
  "autoAdvanceMonths": 2,
  "smsRemindersOffered": true
}
```

- **`monthsAhead`**, `3` means today plus three months, and the calendar arrows
  stop there. This is enforced on the server as well, so nobody can book further
  out by fiddling with the web address.
- **`autoAdvanceMonths`**, if this month is completely full, how many months
  the calendar will skip forward on its own before it stops and lets the
  customer page. Keep it low. `0` turns it off.
- **`smsRemindersOffered`**, the "Text me a reminder" tick box on the booking
  form. Turn it off if you do not want Schedulista sending texts.

---

## Colours and the general look

Black and gold. The gold, the green and the red are not chosen, they are read
straight off your badge, pixel for pixel.

```json
"design": {
  "palette": {
    "ink":      "#050505",   the page. A true black, with no warmth in it
    "panel":    "#111111",   anything raised off the page: prices, the form
    "panel2":   "#1B1B1B",   something raised again, or pressed, on a panel
    "gold":     "#C6A43C",   the exact gold of the lettering on your badge
    "goldLift": "#D8C17A",   gold catching the light. Hover, and the prices
    "goldDeep": "#877029",   thin rules and the dots on the price list
    "cream":    "#F2EADA",   the main text
    "muted":    "#B4B0A8",   secondary text
    "mutedDim": "#8A867E",   small print
    "open":     "#3C8F6A",   the leaves on the rose in your logo
    "closed":   "#ED2F0A"    the rose itself
  },
  "corner": 2,
  "density": 1
}
```

**No other file in the whole project holds a colour.** Change `gold` here and
every gold thing on the site and in the app changes with it, including the
hairlines, which are worked out from it automatically.

On black, gold is readable at every size, which is why the small capital labels
are gold and not something paler. The one thing to watch is the other direction:
if you make `ink` much lighter, gold stops passing on it. Anything above about
`#3A3A30` and the small gold labels need changing to `goldLift`.

- **`corner`** is `0` for square corners like a painted sign, `2` for what
  ships, `10` for a modern rounded look.
- **`density`** multiplies every gap and margin. `0.9` is tighter, `1.15` is
  airier. Stay between `0.8` and `1.3`.

## The order of the front page

```json
"layout": {
  "home": ["hero", "about", "prices"],
  "featuredCount": 4
}
```

Move a name to move that block up or down the page. Delete a name to remove the
block. The names you may use:

| Name | The block |
| --- | --- |
| `hero` | The badge, the shop name, the hashtag, the introduction, Book an appointment, and the hours and address under them |
| `about` | Who is in the chairs today |
| `prices` | A few featured prices, and the link to the full list |
| `hours` | The opening hours as a seven-day board. Off by default: the hero already carries them |
| `find` | The address, the phone number and the directions button. Off by default for the same reason |

`featuredCount` is how many prices show in the `prices` block before the "all
prices" link.

A name you have spelled wrongly is simply skipped, so a typo cannot leave you
with a blank page.

---

## Words

In `content/content.json`, under `business`:

- **`strapline`** is the line under the shop name on the front page. It is your
  hashtag, `#TheHertfordBarber`.
- **`tagline`** is the one sentence that shows up in Google results and when
  somebody shares the link.
- **`about`** is the introduction on the front page, under the shop name.
  Leave a blank line between paragraphs and each one is set as its own
  paragraph. Do not name the barbers in it. The line further down that says who
  is in the chairs is written from Schedulista, so it is always right without
  anyone remembering to change it.
- **`phone`**, **`phoneHref`**, **`email`**, **`address`** change in one place
  and change everywhere, including in the privacy policy and the terms.

If you change the phone number, change **both** `phone` (what people read) and
`phoneHref` (what a phone dials). `phoneHref` has no spaces and uses the
international form: `tel:+441992500010`.

### One rule about punctuation

**Do not use long dashes.** Not the em dash, not the en dash. Use a full stop, a
comma, a colon, brackets, or a plain hyphen for ranges.

This sounds fussy and it is not. Long dashes are the single most recognisable
sign that text was written by a computer rather than a person, and this site had
sixty of them. There is a check that will refuse to build the site if one gets
in:

```bash
npm run check:dashes
```

## The privacy policy and the terms

`content/legal.json`. Each section is a heading and a list of paragraphs:

```json
{
  "heading": "Changing or cancelling",
  "body": [
    "First paragraph.",
    "Second paragraph."
  ]
}
```

Add, remove or reword sections freely. Four things are filled in for you and
should be left as they are: `{name}`, `{phone}`, `{email}`, `{address}` and
`{monthsAhead}`. They pick up whatever is in `content.json`, so the policy can
never quote a phone number or a booking window that changed somewhere else.

Update the `"updated"` date at the top whenever you change anything.

**These were written to describe exactly what the site and the app actually do.**
If the way bookings work ever changes, the policy has to change with it.

---

## Barbers and prices

You do not edit these. Ever.

Everything about who works at the shop and what they charge is read from
**Schedulista**. Add a barber there, change a price there, take a service off
there, the site and the app follow, and everything rearranges itself:

- a new barber appears in the price list with their own tab, in the booking
  flow, and in "In the chairs" on the front page
- their services sort themselves into Haircuts, Beard, and so on, from the names
  they were given in Schedulista
- one of their prices is pulled onto the front page automatically, so no barber
  can be quietly left off it
- if the shop goes down to one barber, the "which barber?" step disappears from
  booking and the price list loses its tabs, because there is nothing to choose
- if a barber leaves, every trace of them goes with them

This takes **about ten minutes** to show up on the site. The app picks it up when
it is next opened.

### If a service lands in the wrong group

It will sort itself out from the name nine times in ten. If it does not, add one
line to `serviceOverrides` in `content.json`, keyed by the service id (you can
read the ids off `public/services.json`):

```json
"serviceOverrides": {
  "1074625170": { "category": "Beard" },
  "1074625199": { "hidden": true }
}
```

| Setting | What it does |
| --- | --- |
| `"category": "Beard"` | Force a service into a named group |
| `"hidden": true` | Keep it off the site without removing it from Schedulista |
| `"featured": true` | Pin it to the front page (once you pin *any*, only pinned ones show) |
| `"order": 1` | Move it up inside its group |
| `"blurb": "..."` | A line of description under the name |

Group headings, and the order they appear in, are the `categoryOrder` list.

---

## The typefaces

The gold lettering is **LHF Old Tom**, your own font, from the files you
supplied. It is the same face the badge is lettered in, so the type on the site
and the type on your logo match exactly.

You sent five cuts. Two are in use:

| Cut | Where |
| --- | --- |
| **Plain** | Headings, prices, the barbers' names, the address, every small capital label, the Book button. This is the cut your badge is lettered in. |
| **Poster Letter** | The shop's name on the front page and in the header, and nothing else. It is the heavy poster cut, and it has capitals only: type lowercase in it and you get capitals. |

The other three (Spurred, Poster Full, Poster Highlights) are kept in
`assets/fonts` and are not switched on. They cost nothing sitting there. Poster
Full and Poster Highlights are the pair that gives the two-colour inline poster
effect, which your badge does not use, so the site does not either. If you ever
want one of them, `assets/fonts/README.md` says how.

The plain text is **Outfit**, a rounded geometric sans matched to your printed
card. Paragraphs, the menu and anything typed into a form stay on it, because a
Victorian display face is for signage and hard work to read at length.

**One thing worth checking with Letterhead.** Make sure your licence covers a
website and two phone apps, not only a desktop computer. The site sends the font
to every visitor and both apps carry it inside them. Letterhead sell those
separately.

The shop name on the front page picks its own size from the space it has, so it
fills the column on a laptop and still fits a phone without anybody choosing a
number. There is nothing to set.

## The logo and the photograph

Both are in `assets/`:

| File | Where it shows up |
| --- | --- |
| `logo.png` | The badge: large on the front page, in the header of every page, on the waiting screen, and as the app icon on a phone |
| `shopfront.jpg` | The Visit page only. The front page is the badge and the name, and a photograph under them competes with the badge |
| `source/` | The originals you sent, untouched. The two above are resized copies, because a 5MB photograph makes a page slow to open |

The badge is used exactly as you drew it: transparent, no white square behind
it, nothing recoloured.

If you replace either one, keep the same file name and put the original in
`source/` as well. After replacing the badge, run:

```bash
npm run icons
```

One thing to check after replacing the badge. The site crops the empty space
around your artwork so the mark fills the space it is given, and it does that
with a number measured from the current file: `ARTWORK` at the top of
`components/Logo.tsx`. If a new badge sits differently in its square, that
number needs changing, or the mark will look too big or too small.

## What to do if something looks wrong

| It looks like | It usually is |
| --- | --- |
| The site will not build after an edit | A missing comma or quote mark. Paste the file into jsonlint.com |
| A price is wrong | Change it in Schedulista, not here. Give it ten minutes |
| A barber is missing | Check they are still listed on your Schedulista page |
| A colour did not change | Check the spelling of the name, and that you kept the `#` |
| The hours sentence contradicts the table | It cannot, they are the same numbers. Reload the page |

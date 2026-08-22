# The display typeface

**LHF Old Tom**, from [Letterhead Fonts](https://www.letterheadfonts.com/),
supplied and licensed by the shop. It is the face the badge is lettered in, so
the type on the site and the type on the mark are the same drawing.

Five cuts are here. Two are loaded:

| File | Used for |
| --- | --- |
| `LHFoldtomplain.otf` | **Loaded as `OldTom`.** Headings, prices, barber names, addresses, every small capital label, the Book button. The cut the badge's arched lettering is set in, and it has a full lowercase and real figures. |
| `LHFoldtomposterletter.otf` | **Loaded as `OldTomPoster`.** The shop's name on the front page and in the header, and nothing else. Heavy poster cut, CAPITALS ONLY: lowercase in this cut comes out as capitals. |
| `LHFoldtomspurred.otf` | Not loaded. Plain with spurs on the terminals. A drop-in alternative to `OldTom`. |
| `LHFoldtomposterfull.otf` | Not loaded. Poster Letter with its inline highlights baked into one colour. |
| `LHFoldtomposterhighlights.otf` | Not loaded. The highlight strokes on their own, to be laid over Poster Letter in a second colour. Together with Poster Letter this is the two-colour inline poster look. The badge does not use it, so neither does the site. |

Unloaded cuts cost nothing: they are not bundled unless something requires them.

**To swap a cut:** add its `require` in `app/_layout.tsx` next to the other two,
then point `font.display` or `font.displayBold` at the key you gave it in
`theme.ts`. Nothing else in the project names a typeface. Restart the dev server
afterwards, because fonts are read at startup and are not hot reloaded.

**Licensing.** Check the licence covers a website and two mobile apps, not only
a desktop machine. The site serves the file to every visitor and both apps carry
it inside the bundle. Letterhead sell those separately from the desktop licence.

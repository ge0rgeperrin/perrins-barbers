/**
 * Draws the favicon.
 *
 *   npm run icons
 *
 * This script used to draw every icon in the product, because the only artwork
 * the shop had was a small raster and neither store accepts a build without a
 * 1024px icon. That is no longer true: assets/icon.png, adaptive-icon.png,
 * splash-icon.png and store/play-icon.png are all the real badge now.
 *
 * What is left is the favicon, and it is left for a reason. The badge is a
 * circle of arched lettering around a panther, and at 48px none of that is
 * legible; it turns into a brown smudge in a browser tab. The crossed scissors
 * from behind the lettering are two strokes and two rings, which read perfectly
 * at that size and are unmistakably the same shop. Better a legible piece of
 * the mark than an illegible copy of all of it.
 *
 * If you would rather have the panther, export just its head as a square PNG
 * and use that instead. See STORE.md.
 *
 * No image library. PNG is a deflate stream in four chunks, and Node has zlib.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

/* ------------------------------------------------------------------ */
/* png                                                                 */
/* ------------------------------------------------------------------ */

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/**
 * RGBA pixel buffer -> a PNG file.
 *
 * `alpha: false` writes RGB with no alpha channel at all. That is not a size
 * optimisation: Apple rejects an app icon that carries an alpha channel, even a
 * fully opaque one, so the icons that need to be flat have to be written flat.
 */
function png(width, height, rgba, alpha = true) {
  const channels = alpha ? 4 : 3;
  // Each scanline is prefixed with its filter byte. Filter 0 (none) compresses
  // perfectly well for flat colour and keeps this readable.
  const stride = width * channels + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      const to = y * stride + 1 + x * channels;
      raw[to] = rgba[from];
      raw[to + 1] = rgba[from + 1];
      raw[to + 2] = rgba[from + 2];
      if (alpha) raw[to + 3] = rgba[from + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // truecolour with alpha, or truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* colours                                                             */
/* ------------------------------------------------------------------ */

const INK = [12, 11, 8, 255];
const GOLD = [201, 162, 39, 255];
const GOLD_LIFT = [228, 201, 126, 255];

const shade = (rgba, factor) => [
  Math.max(0, Math.min(255, Math.round(rgba[0] * factor))),
  Math.max(0, Math.min(255, Math.round(rgba[1] * factor))),
  Math.max(0, Math.min(255, Math.round(rgba[2] * factor))),
  rgba[3],
];

/* ------------------------------------------------------------------ */
/* the scissors                                                        */
/* ------------------------------------------------------------------ */

/** Shortest distance from a point to a line segment, and how far along it. */
function toSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const span = dx * dx + dy * dy;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return [Math.hypot(px - cx, py - cy), t];
}

/**
 * Everything below is a fraction of the side, so the same drawing is correct at
 * 32px and at 512px. The two blades cross a little above centre, which is where
 * a real pair of scissors crosses; put the pivot in the middle and it reads as
 * a letter X instead.
 */
const HANDLE_R = 0.108;
const HANDLE_STROKE = 0.042;
const BLADE_WIDE = 0.052;
const BLADE_TIP = 0.014;

const BLADES = [
  // [handle centre, tip]
  [[0.33, 0.80], [0.71, 0.14]],
  [[0.67, 0.80], [0.29, 0.14]],
];

function sample(x, y, size, { ground }) {
  // Work in fractions of the side rather than pixels.
  const px = x / size;
  const py = y / size;

  for (const [[hx, hy], [tx, ty]] of BLADES) {
    // The handle ring.
    const ring = Math.abs(Math.hypot(px - hx, py - hy) - HANDLE_R);
    if (ring < HANDLE_STROKE / 2) return GOLD;

    // The blade, tapering from the handle to the tip.
    const [distance, along] = toSegment(px, py, hx, hy, tx, ty);
    const width = BLADE_WIDE + (BLADE_TIP - BLADE_WIDE) * along;
    if (distance < width / 2) {
      // The upper half of each blade catches the light, which is what stops the
      // two of them reading as one solid cross.
      return along > 0.55 ? shade(GOLD_LIFT, 1) : GOLD;
    }
  }

  // The pivot, sitting on top of both blades.
  if (Math.hypot(px - 0.5, py - 0.47) < 0.045) return shade(GOLD_LIFT, 1);

  return ground;
}

/**
 * Render at twice the size and average four pixels into one. Cheap, and the
 * only reason the diagonal stripes do not look like a staircase.
 */
function draw(width, height, options) {
  const scale = 2;
  const out = Buffer.alloc(width * height * 4);
  // The drawing is sized against the shorter side, so a wide banner and a
  // square icon put the same scissors on the page.
  const reference = Math.min(width, height) * scale;
  const offsetX = (width * scale - reference) / 2;
  const offsetY = (height * scale - reference) / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const [pr, pg, pb, pa] = sample(
            x * scale + dx + 0.5 - offsetX,
            y * scale + dy + 0.5 - offsetY,
            reference,
            options
          );
          // Premultiplied, so a transparent ground does not bleed grey into the
          // edges of the pole.
          r += pr * pa;
          g += pg * pa;
          b += pb * pa;
          a += pa;
        }
      }
      const i = (y * width + x) * 4;
      out[i] = a ? Math.round(r / a) : 0;
      out[i + 1] = a ? Math.round(g / a) : 0;
      out[i + 2] = a ? Math.round(b / a) : 0;
      out[i + 3] = Math.round(a / (scale * scale));
    }
  }
  return png(width, height, out, options.ground[3] !== 255);
}

/* ------------------------------------------------------------------ */

const FILES = [
  // The one icon still drawn rather than photographed. See the note at the top.
  ['assets/favicon.png', 64, 64, { ground: INK }],
];

mkdirSync('assets', { recursive: true });
for (const [path, width, height, options] of FILES) {
  const buffer = draw(width, height, options);
  writeFileSync(path, buffer);
  console.log(`${path}  ${width}×${height}  ${(buffer.length / 1024).toFixed(1)} kB`);
}
console.log('\nThe other icons are the real badge and are not generated. See STORE.md.');

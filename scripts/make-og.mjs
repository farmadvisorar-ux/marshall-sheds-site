/**
 * Regenerates every link-preview image in public/og/.
 *
 * These are the only place the brand is baked into a pixel rather than read
 * from site.json, so they are the one thing a rebrand cannot fix by editing
 * data. Rather than keep a hand-made list, this derives the whole set from the
 * same JSON the pages are built from: one image per building type, portable
 * model and clearance listing, plus the default. Add a product and its preview
 * appears the next time this runs.
 *
 *   node scripts/make-og.mjs
 *
 * Fonts are fetched from Google Fonts into scripts/.fonts/ on first run and
 * cached there — they are not committed, so nothing here redistributes them.
 * Requires fontconfig to see them; the script installs them for the current
 * user and refreshes the cache itself.
 */
import { mkdir, readFile, writeFile, access, readdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const run = promisify(execFile);
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));

const W = 1200;
const H = 630;
const PAD = 64;
const RULE = 8;

// Pulled from src/styles/global.css so the previews and the site agree.
const INK = '#14100d';       // --timber-950
const ACCENT = '#d4695a';    // --barn-400, lifted for legibility over a photo
const ACCENT_DEEP = '#c04435'; // --barn-500, the bottom rule
const PAPER = '#ffffff';
const PAPER_DIM = '#e3dcd1'; // --timber-200

const FONT_DISPLAY = 'Bitter Bold';
const FONT_SANS = 'Source Sans 3';

const FONTS = [
  ['Bitter:wght@700', 'Bitter-Bold.ttf'],
  ['Source+Sans+3:wght@400', 'SourceSans3-Regular.ttf'],
  ['Source+Sans+3:wght@700', 'SourceSans3-Bold.ttf'],
];

async function ensureFonts() {
  const dir = join('scripts', '.fonts');
  await mkdir(dir, { recursive: true });
  let fetched = 0;
  for (const [spec, file] of FONTS) {
    const dest = join(dir, file);
    if (existsSync(dest)) continue;
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    }).then((r) => r.text());
    const url = css.match(/https:\/\/fonts\.gstatic\.com[^)]*/)?.[0];
    if (!url) throw new Error(`could not resolve a font file for ${spec}`);
    await writeFile(dest, Buffer.from(await fetch(url).then((r) => r.arrayBuffer())));
    fetched++;
  }
  // librsvg and Pango find fonts through fontconfig, not through a path we
  // can pass in, so they have to be visible to the user's font config.
  const userFonts = join(homedir(), '.local', 'share', 'fonts');
  await mkdir(userFonts, { recursive: true });
  for (const [, file] of FONTS) {
    await writeFile(join(userFonts, file), await readFile(join(dir, file)));
  }
  await run('fc-cache', ['-f']).catch(() => {});
  console.log(`fonts ready${fetched ? ` (${fetched} downloaded)` : ' (cached)'}`);
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Render a run of text to RGBA using Pango, which gives real font metrics and word wrapping. */
async function textLayer(markup, { font, width, letterSpacing }) {
  const spacing = letterSpacing ? ` letter_spacing="${letterSpacing}"` : '';
  const { data, info } = await sharp({
    text: {
      text: `<span${spacing}>${markup}</span>`,
      font,
      rgba: true,
      dpi: 72, // 1pt == 1px, so the sizes below read as pixels
      align: 'low',
      ...(width ? { width, wrap: 'word' } : {}),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { input: data, width: info.width, height: info.height };
}

/** Title at the largest size that still fits two comfortable lines. */
async function fitTitle(text, maxWidth) {
  for (const size of [54, 46, 40, 34]) {
    const layer = await textLayer(`<span foreground="${PAPER}">${esc(text)}</span>`, {
      font: `${FONT_DISPLAY} ${size}`,
      width: maxWidth,
    });
    if (layer.height <= 150 || size === 34) return layer;
  }
}

/** Gambrel mark, the same geometry as the header logo. */
const markSvg = (size) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
     <path d="M3 15 L9 7.5 L16 4 L23 7.5 L29 15 L29 28 L3 28 Z" fill="none" stroke="${ACCENT}" stroke-width="2.4" stroke-linejoin="round"/>
     <path d="M12.5 28 L12.5 19.5 L19.5 19.5 L19.5 28" fill="none" stroke="${ACCENT}" stroke-width="2.4" stroke-linejoin="round"/>
   </svg>`
);

/** Scrims and the bottom rule, in one overlay. */
const scrimSvg = () => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <defs>
       <linearGradient id="down" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${INK}" stop-opacity="0.55"/>
         <stop offset="1" stop-color="${INK}" stop-opacity="0"/>
       </linearGradient>
       <linearGradient id="up" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${INK}" stop-opacity="0"/>
         <stop offset="0.55" stop-color="${INK}" stop-opacity="0.72"/>
         <stop offset="1" stop-color="${INK}" stop-opacity="0.93"/>
       </linearGradient>
     </defs>
     <rect x="0" y="0" width="${W}" height="200" fill="url(#down)"/>
     <rect x="0" y="${H - 340}" width="${W}" height="340" fill="url(#up)"/>
     <rect x="0" y="${H - RULE}" width="${W}" height="${RULE}" fill="${ACCENT_DEEP}"/>
   </svg>`
);

async function compose({ photo, eyebrow, title, out, brand }) {
  const base = photo && existsSync(photo)
    ? sharp(photo).resize(W, H, { fit: 'cover', position: 'centre' })
    : sharp({ create: { width: W, height: H, channels: 3, background: '#3d332a' } });

  const layers = [{ input: scrimSvg(), top: 0, left: 0 }];

  // brand lockup, top left
  const MARK = 34;
  layers.push({ input: markSvg(MARK), top: 54, left: PAD });
  const [name, ...rest] = brand.split(' ');
  const wordmark = await textLayer(
    `<span foreground="${PAPER}" weight="bold">${esc(name)}</span>` +
      `<span foreground="${PAPER_DIM}"> ${esc(rest.join(' '))}</span>`,
    { font: `${FONT_SANS} 23` }
  );
  layers.push({
    input: wordmark.input,
    top: Math.round(54 + MARK / 2 - wordmark.height / 2),
    left: PAD + MARK + 14,
  });

  // eyebrow + title, stacked up from the rule
  const titleLayer = await fitTitle(title, W - PAD * 2);
  const eyebrowLayer = await textLayer(
    `<span foreground="${ACCENT}" weight="bold">${esc(eyebrow.toUpperCase())}</span>`,
    { font: `${FONT_SANS} 17`, letterSpacing: 2400 }
  );

  const titleTop = H - RULE - 30 - titleLayer.height;
  layers.push({ input: titleLayer.input, top: titleTop, left: PAD });
  layers.push({
    input: eyebrowLayer.input,
    top: titleTop - 14 - eyebrowLayer.height,
    left: PAD,
  });

  await mkdir(dirname(out), { recursive: true });
  await base.composite(layers).jpeg({ quality: 82, chromaSubsampling: '4:4:4' }).toFile(out);
}

const asset = (webPath) => (webPath ? join('public', webPath.replace(/^\//, '')) : null);

async function main() {
  await ensureFonts();

  const [site, types, portable, inventory, images] = await Promise.all([
    read('src/data/site.json'),
    read('src/data/building-types.json'),
    read('src/data/portable-buildings.json'),
    read('src/data/inventory.json'),
    read('src/data/images.json'),
  ]);

  const brand = site.name;
  const jobs = [];

  jobs.push({
    photo: asset(images.hero),
    eyebrow: 'Steel & Portable Buildings',
    title: site.tagline,
    out: 'public/og/default.jpg',
    brand,
  });

  for (const t of types) {
    jobs.push({
      photo: asset(images.types[t.slug]?.[0]),
      eyebrow: 'Steel Buildings',
      title: t.name,
      out: `public/og/types/${t.slug.replace(/\//g, '-')}.jpg`,
      brand,
    });
  }

  const catName = Object.fromEntries(portable.categories.map((c) => [c.slug, c.name]));
  for (const p of portable.products) {
    jobs.push({
      photo: asset(images.portable?.products?.[p.slug]?.[0]),
      eyebrow: catName[p.category] ?? 'Portable Buildings',
      title: p.name,
      out: `public/og/portable/${p.slug}.jpg`,
      brand,
    });
  }

  for (const i of inventory) {
    jobs.push({
      photo: asset(images.inventory[i.slug]),
      eyebrow: 'Clearance Inventory',
      title: i.title,
      out: `public/og/inventory/${i.slug}.jpg`,
      brand,
    });
  }

  const expected = new Set(jobs.map((j) => j.out));
  let missing = 0;
  for (const job of jobs) {
    if (!job.photo || !existsSync(job.photo)) missing++;
    await compose(job);
  }

  // A preview left behind by a product that no longer exists is dead weight
  // that still gets served, so drop anything this run did not write.
  let removed = 0;
  for (const sub of ['types', 'portable', 'inventory']) {
    const dir = join('public', 'og', sub);
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      const p = join(dir, f);
      if (!expected.has(p)) {
        await unlink(p);
        removed++;
        console.log(`  removed stale ${p}`);
      }
    }
  }

  console.log(
    `wrote ${jobs.length} preview images` +
      (missing ? ` (${missing} had no photo and fell back to a plain ground)` : '') +
      (removed ? `, removed ${removed} stale` : '')
  );
}

await main();

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

/**
 * Palette, type and the brand mark are READ from the site rather than copied
 * here. An earlier version hardcoded them with a comment promising they matched
 * global.css; they did, until the next rebrand, after which every preview
 * quietly kept the old brand's colours and logo while the site moved on. A
 * duplicated design token is a stale design token, so these are derived.
 */
function declBlock(css, selector) {
  const i = css.indexOf(selector);
  if (i < 0) return '';
  const s = css.indexOf('{', i);
  const e = css.indexOf('}', s);
  return css.slice(s + 1, e);
}
const decls = (block) =>
  Object.fromEntries(
    [...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => ['--' + m[1], m[2].trim()])
  );

/** Follow `var(--a)` -> `var(--b)` -> `#hex`. */
function resolve(value, scope, base) {
  let v = (value ?? '').trim();
  for (let i = 0; i < 10 && v.startsWith('var('); i++) {
    const name = v.match(/var\((--[\w-]+)\)/)?.[1];
    v = (scope[name] ?? base[name] ?? '').trim();
  }
  return v;
}
/** First real family out of a CSS font stack. */
const family = (stack) => (stack ?? '').split(',')[0].replace(/["']/g, '').trim();

async function readTheme() {
  const css = await readFile('src/styles/global.css', 'utf8');
  const light = decls(declBlock(css, ':root {'));
  const dark = decls(declBlock(css, ':root[data-theme="dark"]'));

  // The dark-mode accent is the one lifted for legibility, which is what a
  // photo needs; the light accent is deeper and reads better as a solid rule.
  const accent = resolve(dark['--accent'] ?? light['--accent'], { ...light, ...dark }, light);
  const accentDeep = resolve(light['--accent'], light, light);
  const ink = resolve(light['--bg-inverse'], light, light);

  const display = family(light['--font-display']) || family(light['--font-sans']);
  const sans = family(light['--font-sans']);

  // The mark is lifted straight from the header so the two cannot diverge.
  const header = await readFile('src/components/Header.astro', 'utf8');
  const svg = header.match(/<svg class="brand__mark"[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/);
  if (!svg) throw new Error('could not find .brand__mark in Header.astro');

  // Dimmer half of the wordmark: the light-mode border tone, which is a
  // brand-tinted near-white in every palette here.
  const paperDim = resolve(light['--border'], light, light) || '#e5e5e5';

  return {
    ink, accent, accentDeep, display, sans, paperDim,
    markViewBox: svg[1],
    markBody: svg[2].replace(/currentColor/g, accent),
  };
}

/** Fallback ground when a job has no photo: the mid neutral from the ramp. */
function resolveGround(theme) {
  return theme.ink;
}

/** Google Fonts serves a static TTF per weight; fetch just what is rendered. */
const fontJobs = (theme) => [
  [`${theme.display.replace(/ /g, '+')}:wght@700`, `${theme.display.replace(/ /g, '-')}-700.ttf`],
  [`${theme.sans.replace(/ /g, '+')}:wght@400`, `${theme.sans.replace(/ /g, '-')}-400.ttf`],
  [`${theme.sans.replace(/ /g, '+')}:wght@700`, `${theme.sans.replace(/ /g, '-')}-700.ttf`],
];

async function ensureFonts(jobs) {
  const dir = join('scripts', '.fonts');
  await mkdir(dir, { recursive: true });
  let fetched = 0;
  for (const [spec, file] of jobs) {
    const dest = join(dir, file);
    if (existsSync(dest)) continue;
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    }).then((r) => r.text());
    const url = css.match(/https:\/\/fonts\.gstatic\.com[^)]*/)?.[0];
    if (!url) throw new Error(`could not resolve a font file for ${spec} — is it on Google Fonts?`);
    await writeFile(dest, Buffer.from(await fetch(url).then((r) => r.arrayBuffer())));
    fetched++;
  }
  // librsvg and Pango find fonts through fontconfig, not through a path we can
  // pass in, so they have to be visible to this user's font config.
  const userFonts = join(homedir(), '.local', 'share', 'fonts');
  await mkdir(userFonts, { recursive: true });
  for (const [, file] of jobs) {
    await writeFile(join(userFonts, file), await readFile(join(dir, file)));
  }
  await run('fc-cache', ['-f']).catch(() => {});
  console.log(`fonts ready${fetched ? ` (${fetched} downloaded)` : ' (cached)'}`);
}

const PAPER = '#ffffff';

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

/**
 * Title at the largest size that reads well.
 *
 * A single line beats a slightly larger one that drops a lone word onto a
 * second — the display face changes with the brand, so what fits at 54 in one
 * palette wraps in the next. Only a modest step down is worth taking for that:
 * below 46 a one-liner is smaller than a well-set two-liner, so past that the
 * rule is simply the biggest size that fits the height.
 */
async function fitTitle(text, maxWidth, theme) {
  const render = (size, width) =>
    textLayer(`<span foreground="${PAPER}">${esc(text)}</span>`, {
      font: `${theme.display} Bold ${size}`,
      ...(width ? { width } : {}),
    });

  for (const size of [54, 50, 46]) {
    const natural = await render(size);
    if (natural.width <= maxWidth) return natural;
  }
  for (const size of [54, 46, 40, 34]) {
    const layer = await render(size, maxWidth);
    if (layer.height <= 150 || size === 34) return layer;
  }
}

/** The header's own brand mark, recoloured to the accent. */
const markSvg = (size, theme) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${theme.markViewBox}">${theme.markBody}</svg>`
);

/** Scrims and the bottom rule, in one overlay. */
const scrimSvg = (theme) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <defs>
       <linearGradient id="down" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${theme.ink}" stop-opacity="0.55"/>
         <stop offset="1" stop-color="${theme.ink}" stop-opacity="0"/>
       </linearGradient>
       <linearGradient id="up" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${theme.ink}" stop-opacity="0"/>
         <stop offset="0.55" stop-color="${theme.ink}" stop-opacity="0.72"/>
         <stop offset="1" stop-color="${theme.ink}" stop-opacity="0.93"/>
       </linearGradient>
     </defs>
     <rect x="0" y="0" width="${W}" height="200" fill="url(#down)"/>
     <rect x="0" y="${H - 340}" width="${W}" height="340" fill="url(#up)"/>
     <rect x="0" y="${H - RULE}" width="${W}" height="${RULE}" fill="${theme.accentDeep}"/>
   </svg>`
);

async function compose({ photo, eyebrow, title, out, brand, theme }) {
  const base = photo && existsSync(photo)
    ? sharp(photo).resize(W, H, { fit: 'cover', position: 'centre' })
    : sharp({ create: { width: W, height: H, channels: 3, background: theme.ground } });

  const layers = [{ input: scrimSvg(theme), top: 0, left: 0 }];

  // brand lockup, top left
  const MARK = 34;
  layers.push({ input: markSvg(MARK, theme), top: 54, left: PAD });
  const [name, ...rest] = brand.split(' ');
  const wordmark = await textLayer(
    `<span foreground="${PAPER}" weight="bold">${esc(name)}</span>` +
      `<span foreground="${theme.paperDim}"> ${esc(rest.join(' '))}</span>`,
    { font: `${theme.sans} 23` }
  );
  layers.push({
    input: wordmark.input,
    top: Math.round(54 + MARK / 2 - wordmark.height / 2),
    left: PAD + MARK + 14,
  });

  // eyebrow + title, stacked up from the rule
  const titleLayer = await fitTitle(title, W - PAD * 2, theme);
  const eyebrowLayer = await textLayer(
    `<span foreground="${theme.accent}" weight="bold">${esc(eyebrow.toUpperCase())}</span>`,
    { font: `${theme.sans} 17`, letterSpacing: 2400 }
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
  const theme = await readTheme();
  theme.ground = theme.markViewBox ? resolveGround(theme) : '#333';
  await ensureFonts(fontJobs(theme));
  console.log(
    `theme from global.css — ${theme.display} / ${theme.sans}, accent ${theme.accent}, rule ${theme.accentDeep}`
  );

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
    theme,
  });

  for (const t of types) {
    jobs.push({
      photo: asset(images.types[t.slug]?.[0]),
      eyebrow: 'Steel Buildings',
      title: t.name,
      out: `public/og/types/${t.slug.replace(/\//g, '-')}.jpg`,
      brand,
      theme,
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
      theme,
    });
  }

  for (const i of inventory) {
    jobs.push({
      photo: asset(images.inventory[i.slug]),
      eyebrow: 'Clearance Inventory',
      title: i.title,
      out: `public/og/inventory/${i.slug}.jpg`,
      brand,
      theme,
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

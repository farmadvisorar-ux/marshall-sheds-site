# Marshall Sheds

Marketing and catalog site for Marshall Sheds, an authorized independent dealer
carrying two lines:

- **Engineered steel buildings** — bolt-together kits, engineered per site, shipped nationwide.
- **Wood portable buildings** — built complete and delivered finished, within a
  six-state regional area (TX, LA, MO, IL, TN, IN).

The two are kept deliberately separate throughout. They are different products
sold to different buyers with different constraints, and conflating them in the
copy would mislead people about delivery area, foundations and permitting.

Built with [Astro](https://astro.build) as a static site. 159 pages, no runtime
dependencies, deploys anywhere that serves static files.

> **This site is not live yet.** `indexable` and `emailPending` are both set in
> `src/data/site.json`, so every page carries `noindex` and the email address is
> withheld everywhere including the schema. There is no phone number and no form
> endpoint yet. Work through **Before launch** below before flipping either flag.

---

## Running locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
npm run preview  # serve the built site
```

Two checks worth running before you push:

```bash
npm run build && npm run check:meta   # titles and descriptions Google will print
npm run make:og                       # regenerate link-preview images
```

## Environment variables

| Variable | Required | What it does |
|---|---|---|
| `PUBLIC_FORM_ENDPOINT` | Yes, to receive leads | URL the quote and contact forms POST to. Overrides `formEndpoint` in `site.json`. |

Until one of those is set, both forms validate normally and show a "not
connected" notice instead of pretending a submission was sent. **Set this before
launch or you will silently lose every enquiry.**

Any of these work with a static deploy:

- **Formspree** — `https://formspree.io/f/xxxxxxx`
- **Web3Forms** — `https://api.web3forms.com/submit` (add a hidden `access_key` field)

---

## Editing content

All content lives in `src/data/` as JSON. No code changes needed to update the catalog.

| File | Contents |
|---|---|
| `site.json` | Business name, phone, email, address, hours, dealer notice, launch flags |
| `building-types.json` | The 24 steel building categories — copy, specs, sizes, models |
| `models.json` | The 8 building profiles (A, B, C, R, S, T, X, M) |
| `options.json` | Options & finishes catalog — 12 items across arch and straight-wall |
| `inventory.json` | 51 clearance listings with dimensions and regions |
| `portable-buildings.json` | The 16 portable models, construction spec, warranty, financing, delivery states |
| `faqs.json` | 84 FAQ entries, grouped by category |
| `locations.json` | 8 counties, 77 communities, 15 detailed city pages |
| `images.json` | Maps content slugs to photo files |

`site.json` is the single source of truth for identity. The footer, contact page,
JSON-LD schema and OG tags all read from it, so a change there lands everywhere
at once.

Three flags gate what a half-configured site is allowed to publish:

| Flag | While true |
|---|---|
| `indexable: false` | `noindex` on every page; the sitemap is withheld from `robots.txt` while crawling stays allowed, so engines can actually see the directive |
| `emailPending` | The address is withheld everywhere, schema included |
| `phonePending` | The number is withheld everywhere, schema included — so it can be recorded before the line is answered |

Everything that renders the phone goes through `src/lib/contact.ts`, so there is
one place to get it wrong rather than nine.

### Before launch — required

- [ ] **Get a phone number for this business**, put it in `site.json` (`phone`
      and `phoneRaw`), and set `phonePending: false` once the line is answered.
      Both fields are blank today and the flag is on, so the header, footer,
      contact page, quote page, warranty page, privacy page and business schema
      all omit the number rather than showing a placeholder or an empty
      `tel:` link. The flag exists so a number can be recorded before it is
      live — without it, typing one in publishes it everywhere at once,
      including the NAP that directories cross-reference. This is the one field
      that cannot be borrowed from another operation: Google resolves a Business
      Profile by address plus phone, and a second profile on a number already in
      use is filed as a duplicate and suspended. A free second line takes
      minutes to issue.
- [ ] **Set up a form endpoint** of this site's own, and test a real submission
      end to end. Sharing an endpoint with another site mixes both inboxes.
- [ ] **Set up email forwarding** for `info@`, `sales@` and `quotes@`, then set
      `emailPending: false`.
- [ ] **Point `astro.config.mjs` and `public/CNAME` at the real domain.** Both
      currently read `marshallsheds.com` as a placeholder. They drive canonical
      URLs, the sitemap, OG image URLs and the custom domain — all four are
      wrong until this is right.
- [ ] **Warranty page** (`src/pages/about/warranty.astro`) — fill in the real terms
      from the dealer agreement and remove the red publish note. Do not publish
      specific durations that are not confirmed in writing.
- [ ] **Privacy and Terms** (`src/pages/privacy.astro`, `terms.astro`) — templates
      only, carrying a visible "remove before launch" note. They are starting
      points, not legal documents. Have them reviewed, then remove the notes.
- [ ] **Set your own pricing.** Inventory pages currently say "Request pricing".
      As a dealer you set your own margins — add a `price` field to
      `inventory.json` and surface it if you want prices shown publicly.
- [ ] **Confirm the portable delivery states** (`portable-buildings.json` →
      `line.deliveryStates`). It is stated prominently on every product page and
      on the homepage, so it needs to be right.
- [ ] **Confirm financing terms.** Rates and programs are the finance providers',
      not ours, and they change. Verify before launch and re-check periodically.
- [ ] **Regenerate the link previews** (`npm run make:og`) after any change to the
      brand name, tagline or accent colour, and test a real link in a DM before
      trusting it.
- [ ] **Create the Google Business Profile on the new number**, not one already
      attached to another listing.
- [ ] **`indexable: true`** — last step, once everything above is done.

## Images

Photos come from the manufacturer's media library and are used with their
permission. They are downloaded, resized and converted to WebP at build-prep
time and served from `public/img/` — nothing is hotlinked, so the site has no
runtime dependency on the manufacturer.

| Folder | Count | Used for |
|---|---|---|
| `public/img/types/` | 69 | Building-type heroes, cards, and per-page galleries |
| `public/img/inventory/` | 52 | One photo per clearance listing |
| `public/img/options/` | 8 | Options & finishes pages |
| `public/img/portable/` | 70 | Portable model heroes, galleries, and the colour chart |
| `public/img/portable/plans/` | 22 | Floor plan drawings, keyed by plan number |
| `public/img/portable/details/` | 4 | Construction detail shots |

Four options pages (foundations, roof accessories, trim & flashing,
straight-wall insulation) intentionally still use placeholders.

### Link previews are generated, not hand-made

`public/og/` holds 92 preview images — one per building type, portable model and
clearance listing, plus a default. They are the only place the brand is baked
into a pixel rather than read from `site.json`, which is exactly why they are
generated rather than drawn:

```bash
npm run make:og
```

`scripts/make-og.mjs` reads the same JSON the pages are built from, composites
the photo, scrim, wordmark, eyebrow and title, and deletes any preview whose
product no longer exists. Add a product and its preview appears on the next run.
Fonts are fetched into `scripts/.fonts/` on first run and cached there.

### Screening

Screen any image you add for three things: identifiable people, third-party
branding or signage, and any visible manufacturer mark. The current set was
reviewed on a contact sheet and excludes photos of identifiable people, service
vans and buildings carrying another company's livery, rental-company branding on
equipment, and the manufacturer's own logo.

### Floor plans are flattened onto white — do not undo this

The floor plan drawings arrived as PNGs with transparent backgrounds and black
line art. Served as-is they are invisible in dark mode. They are flattened onto
a white background at download time and their container is explicitly
`background: #fff`, so they read correctly in both themes. If you replace them,
flatten them the same way.

### Swapping in your own photography

`src/data/images.json` maps content to files. Replace a file in `public/img/`
keeping the same name and nothing else needs to change. To add a photo where
one is missing, drop the file in and add its path to `images.json` — the
`Placeholder` component falls back to a styled placeholder whenever a path is
absent, so partial coverage always renders cleanly. Re-run `npm run make:og`
afterwards so the previews pick up the new lead photos.

---

## Content notes

Two deliberate decisions worth preserving if you extend the site:

**The site does not claim to be the manufacturer.** Marshall Sheds is an
authorized dealer. Copy consistently says "our manufacturing partner" rather
than "we manufacture", because the latter would be inaccurate — and it is a
claim a customer can rely on to their cost. Keep that distinction if you add
pages.

**There are no testimonials.** A testimonials section was deliberately left out
rather than populated with borrowed reviews. Add real ones as customers give
them. Inventing social proof for a new brand is fabrication, and review fraud is
separately illegal.

**Component brands are named; manufacturer brands are not.** The portable
buildings pages name LP SmartSide siding and Glidden paint, because those are
factual component specs, they are what the buildings are actually built from,
and buyers recognise them. Neither building manufacturer is named anywhere. If
you would rather drop the component names too, they live in
`portable-buildings.json` under `construction` and are a one-line edit.

**The two lines are never blurred.** Portable buildings state their six-state
delivery area on every product page, the homepage and the line index. Specialty
models flag their 1-year warranty rather than inheriting the 5-year term. Steel
pages say kits ship nationwide. Keep those distinctions if you extend the site —
they are the facts most likely to cause a complaint if they are wrong.

---

## Deploying — GitHub Pages

`.github/workflows/deploy.yml` builds on every push to `main` and publishes the
result to a `gh-pages` branch. It needs `permissions: contents: write`, and it
refuses to publish unless the build produced a sane page count, a `CNAME`, a
`.nojekyll`, an `_astro/` directory, a sitemap, and forms that are either wired
to a real endpoint or visibly marked as not connected.

After the first green run, set **Settings → Pages → Branch → `gh-pages` /
`(root)` → Save**. Nothing is publicly reachable until that switch is thrown.

Registrar DNS for the custom domain:

```
A     @    185.199.108.153
A     @    185.199.109.153
A     @    185.199.110.153
A     @    185.199.111.153
CNAME www  <github-username>.github.io.
```

Tick **Enforce HTTPS** once the certificate provisions. Until it is ticked,
GitHub also serves the domain over plain HTTP; `Base.astro` carries an inline
upgrade script that redirects those visitors, which closes the ordinary case but
is not a substitute for the setting.

## Deploying — Vercel

`vercel.json` pins the framework, build command, output directory and trailing
slashes, so importing the repo needs no further setup. Set two environment
variables in the project:

| Variable | Value |
|---|---|
| `PUBLIC_SITE_URL` | the real origin, e.g. `https://marshallsheds.com` |
| `PUBLIC_FORM_ENDPOINT` | the form endpoint |

`PUBLIC_SITE_URL` overrides the fallback in `astro.config.mjs`. Until it is set
the canonical URLs, sitemap and OG image URLs all point at the placeholder
domain — harmless while the site is `noindex`, wrong the moment it is not.

Netlify works the same way: build `npm run build`, publish `dist`.

The two routes do not conflict. `public/CNAME` is inert on Vercel, and the
Pages workflow only fires on a push to `main`.

---

## Load-bearing details that fail silently

- **`public/.nojekyll`** — GitHub Pages runs Jekyll, Jekyll ignores any path
  starting with an underscore, and Astro emits all CSS and JS into `_astro/`.
  Without that file the site deploys successfully and renders with zero styling
  and no error anywhere. The workflow asserts it for this reason.
- **OG images must be absolute URLs.** `Base.astro` builds them with `new URL(...)`.
  Scrapers ignore root-relative paths and render no preview at all.
- **`noindex`, not `robots.txt Disallow`.** Blocking the crawl stops engines from
  ever seeing the noindex directive, leaving bare URLs indexable and much harder
  to remove. `robots.txt.ts` keeps crawling allowed while `indexable` is false
  and withholds only the sitemap.
- **`sitemap.xml.ts` is hand-rolled.** `@astrojs/sitemap` v3.7.3 crashes on
  Astro 4 — it expects Astro 5's hook signature. The local version generates from
  the same data as the pages, so it cannot drift. Do not reinstall the integration.
- **Inventory slugs must be ASCII.** Prime marks (′) in source titles cause
  `NoMatchingStaticPathFound` at build time.
- **`[hidden]` needs `!important`.** Author styles override the UA sheet
  regardless of specificity, so any element with a `display` value ignores
  `el.hidden = true`. That silently broke the inventory filter and the quote
  form's conditional fields. The rule lives at the top of `global.css`.
- **Form endpoints coalesce with `||`, not `??`.** A missing GitHub Actions
  variable interpolates as `""` rather than being left unset, and `??` treats
  `""` as a real value — which ships live forms wired to nothing while local
  builds look fine.
- **Titles are capped at 60 characters.** `scripts/check-meta.mjs` fails the
  build on an over-long or duplicated title. The brand name is part of every
  title, so renaming the business can push pages over on its own — and the
  tagline rides in the homepage title, which caps it at 43 characters.
- **A withheld contact detail must not leave a dead link.** With no phone set,
  an unguarded `tel:${site.phone}` renders as `href="tel:"` — a link to nowhere
  next to a dangling "or call". The warranty page hit the worse version of
  this: with the email withheld too, an empty link was the only claim route
  offered. Guard on `phoneLive`, and give the copy somewhere to fall back to.

## Structure

```
src/
├── data/           JSON content — edit here
├── layouts/        Base.astro (head, OG, schema), Article.astro
├── components/     Header, Footer, Placeholder
├── lib/            images.ts (slug → path), contact.ts (phone visibility)
├── scripts/        form-submit.js — shared fetch handler for both forms
├── pages/
│   ├── building-types/      index + [...slug] → 24 pages  (steel)
│   ├── portable-buildings/  index + [slug] → 16 pages     (wood)
│   ├── models/              index + [code] → 8 pages
│   ├── inventory/           index + [slug] → 51 pages
│   ├── options-and-finishes/ index + [family]/[slug] → 12 pages
│   ├── service-area/        index + [slug] → 23 pages  (15 cities, 8 counties)
│   ├── resources/           6 guides + FAQ
│   ├── about/               about, advantage, warranty, pricing
│   ├── quote.astro          lead form with prefill
│   └── contact.astro
└── styles/global.css        design tokens, light + dark
scripts/
├── check-meta.mjs  title and description check, run in CI
└── make-og.mjs     regenerates public/og/ from the catalog
```

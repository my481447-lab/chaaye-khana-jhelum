# Chaaye Khana · Jhelum — Website Foundation

Static foundation for the Chaaye Khana restaurant website. Layout, design system,
and section scaffolding only — no finished content yet.

## Structure

```
index.html            All sections, semantic markup, placeholder copy
css/variables.css     Design tokens — colour palette, typography, spacing, radii, shadows
css/style.css         Reset, layout primitives, components (buttons, cards), responsive rules
js/main.js            Mobile nav toggle + footer year
```

## Sections

Home · About · Menu · Offers · Gallery · Reviews · Location · Contact · Footer

## Content policy — verified information only

**Nothing about the restaurant is invented or guessed.** Every factual claim
(menu items, prices, offers, reviews, ratings, names, address, phone, hours,
facilities, social URLs) is traceable to a source noted in an HTML comment next
to it; unknowns are clearly-marked editable placeholders, never filler presented
as real. Sources: official menu `chaayekhana.com/copy-of-menu-1` (24 names +
prices — re-verified verbatim), promos `chaayekhana.com/services-1`, the official
locations page, booking/Google listings (address, phones, hours — hours always
shown with "confirm on Google"), the Facebook page description (cuisine),
Wanderlog aggregator (4.1/2,524 Google rating + 3 real review excerpts), and web
search (the four verified social profiles; no official YouTube → placeholder).
Photos are licensed stock (Unsplash), disclosed in HTML comments. Menu-card
descriptions are generic ("what the dish is"), disclosed in the `.menu-note`.
The hero category strip and About copy were trimmed to menu-verified items
(removed "Burgers" — not on the menu — plus "curbside pickup" and other
unconfirmed embellishments).

## SEO

All in the `<head>` of `index.html` plus a hidden H1 extension — **no visual
change**, verified facts only.

- **Title:** `Chaaye Khana Jhelum — Tea House & Restaurant on GT Road, Jhelum Cantt`
- **Meta description** carries the alt spelling *(Chai Khana)*, the area
  *(Jhelum Cantt / GT Road)*, the offering and *dine-in / outdoor seating*.
- **`keywords`** — Chai Khana Jhelum · Chai Khana Restaurant Jhelum · restaurant
  in Jhelum · cafes in Jhelum · tea house Jhelum · GT Road Jhelum Cantt.
- **Local signals:** `geo.region = PK-PB`, `geo.placename = Jhelum`,
  `og:locale = en_PK`, and the same phrasing echoed in the JSON-LD `address`,
  `areaServed` and `alternateName`.
- **Open Graph + Twitter card** — title / description / `og:image` (the licensed
  hero photo for now — see the head comment to swap for a real branch photo).
- **Headings:** one `<h1>` (`Chaaye Khana` + a `.visually-hidden` span "— tea
  house & restaurant in Jhelum, Pakistan" for crawlers/screen readers); each
  content section is an `<h2>`, items/sub-parts are `<h3>` — no levels skipped.
- **Image alt text** — every `<img>` already had alt; the one vague gallery alt
  was made descriptive. Stock/representative photos are **not** labelled as the
  real branch.
- **Structured data:** one `Restaurant` JSON-LD block — name + `alternateName`,
  description, `address` (GT Road, next to Adventura Park, Jhelum Cantt · Jhelum
  · Punjab · 49600 · PK), `telephone`, `email`, `openingHoursSpecification`
  (Sun–Thu 08:00–00:00 / Fri–Sat 08:00–01:00), `servesCuisine`,
  `currenciesAccepted: PKR`, `acceptsReservations: true`, `hasMenu`,
  `parentOrganization` (chaayekhana.com) and `sameAs` (the four verified social
  profiles). **No `aggregateRating`** (Google disallows self-serving review
  markup) and **no `priceRange` / `geo`** (not verified).
- **Deploy step:** replace every `https://www.example.com` in the head
  (canonical, `og:url`, JSON-LD `url` / `@id` / `hasMenu`) with the live domain.

## Navigation

`.site-header` is a **sticky** bar (`position: fixed`) — transparent over the
hero, solid cream once scrolled past 24px. It holds the brand, the eight
section links, and a `.site-header__actions` group with a **search** button and
a **cart** icon (`.icon-btn`, cart shows an `.icon-btn__count` badge that hides
at `0`). The search button opens `#site-search`, a working live search of the menu
(Esc / ✕ to close). Below 960px the links collapse into the hamburger
(`.nav-toggle`) which slides `#primary-nav` down; search + cart stay visible.
Smooth scrolling is CSS-only — `scroll-behavior: smooth` plus
`scroll-padding-top: var(--header-h)` so anchors clear the fixed bar (disabled
under `prefers-reduced-motion`). Logic lives in `js/main.js`.

## Footer

`.site-footer` (espresso) — a four-column `.site-footer__inner` grid:

1. **Brand** (`.site-footer__col--brand`) — "Chaaye Khana", a one-line
   description, and the `.social-links--on-dark` icon row (mirrors Contact).
   The description echoes the About section — *"a tea house and kitchen on GT
   Road, Jhelum Cantt — specialty chai, all-day breakfast and a full menu"* —
   **no story, dates or claims**.
2. **Quick links** — Home / About / Menu / Offers / Gallery / Reviews (Location
   and Contact have their own columns).
3. **Location** — the verified address (Next to Adventura Park, GT Road, Jhelum
   Cantt; near PSO Riverside) + a `.site-footer__cta` link to `#location`.
4. **Contact** — the two verified phone numbers (`tel:` links, second tagged
   *reservations*), the email, and a `.site-footer__cta` link to `#contact`.

Headings use the site's saffron eyebrow style. A `.site-footer__bottom` bar
(top border) holds the copyright: `© <span id="year"> Chaaye Khana, Jhelum.
All rights reserved.` (year set in `js/main.js`). Grid collapses to 2 columns
≤ 860px (brand spans full width) and 1 column ≤ 460px. All figures are the same
verified details used in the Location / Contact sections — nothing new was
introduced.

## Design system

- **Type:** Cormorant Garamond (display) + Jost (body), fluid `clamp()` scale
- **Palette:** warm cream canvas, espresso ink, saffron / terracotta / tea-green accents
- **Components:** `.btn` (`--primary`, `--ghost`, `--sm`), `.card` (`--feature`), `.quote-card`
- **Breakpoints:** 960px (nav collapses), 720px (grids stack), 420px (fine-tuning)

## Preview

Serve the folder over HTTP (linked CSS/JS need a server, not `file://`):

```bash
npx serve .
```

## Search

The header search reads the live `#menu .menu-card` elements (no build step, no
data file) and matches the query against **name + category + description**,
all-terms-must-match. Results render inside the dropdown with the hit
highlighted (`<mark>`); an empty query shows a hint, no match shows
"No results found for …". Enter or a click closes the panel, scrolls the card
into view, and flashes it (`.menu-card.is-search-target`, a rule that is inert
until search adds the class). Input is debounced 110 ms and the index is built
once on first open. All logic is in `js/main.js`; the menu markup is untouched.

## About

`#about` — framed photo + prose (`The place` / `The setting` /
`For families & groups`) + a `.about__highlights` chip list. Copy is drawn
**only** from public listings for the Jhelum restaurant of this name
(TripAdvisor, foodpanda, Wanderlog, the brand site chaayekhana.com) — cuisine
mix, location on GT Road near PSO Riverside, dine-in / outdoor seating, and
known items (specialty teas, all-day breakfast, Nihari, signature Nutella
French toast, cakes, steaks). **No founding story, dates, awards, or family
policy were invented** — those are left for the owner to add (see the HTML
comments in the section). The photo is a placeholder — replace `src` on
`.about__photo` (or add `assets/about.jpg`) with a verified photo.

## Contact

`#contact` — the message form + a `.contact-details` block (**Phone**: (0544)
610711 and reservations mobile +92 329 1509505, tap-to-call; `mailto:` email;
**Address**; **Opening hours** Sun–Thu 8am–midnight / Fri–Sat 8am–1am;
**Social**: a `.social-links` icon row — see the **Social media links** section below)
+ a `.contact-details__map` line linking to `#location`. **The map + Get
Directions live only in the Location section** — the user asked not to show the
same map twice. Phone/address from the official locations page; email from the
Tripadvisor listing (confirm it's customer-facing); hours are the Google-fed
directory times (confirm on Google). Provenance in an HTML comment. Overlaps
`#location` by design — the user asked for the same details in both.

## Location

`#location` (nav "Location") — a `.location-grid`: a **keyless Google Maps
embed** (`.location-map__embed`, query "Chaaye Khana GT Road Jhelum Cantt" —
resolves to the correct branch, 4.1★ next to River View / PSO filling station;
swap for a proper Share→Embed iframe), a full-width **Get Directions** button
(`maps/dir/?api=1&destination=…`, opens turn-by-turn / the Maps app on mobile)
and a **Call for reservations** button (`tel:+923291509505`, the reservations
mobile — not the landline; opens the dialer on mobile, needs a calling app on
desktop), then an `.info-list` card of Address / Phone / Opening
hours. On mobile the grid stacks, the map stays tall, and the two action
buttons go full-width and column.

**Data provenance:** address + phone `(0544) 610711` from the official Chaaye
Khana locations page; the reservations mobile `+92 329 1509505` is the number
on booking listings; **opening hours** (Sun–Thu 8am–midnight, Fri–Sat 8am–1am)
are the times shown across Google-fed directories for this branch — confirm on
the branch's Google listing. `#contact` was not touched.

## Reviews & Ratings

`#reviews` — a `.reviews-summary` band (big score + `.stars` bar + count, plus
the Tripadvisor figure), a provenance note, three `.quote-card`s (star bar +
excerpt + name + source line), and a **View All Reviews** button → the
restaurant's Google Maps listing. `.stars` is a CSS-only fractional bar driven
by `style="--rating: 4.1"`.

**Data provenance:** the 4.1/5 (2,524) Google figure, the 2.8/5 (13) Tripadvisor
figure, and the three review excerpts (Sufyan S · 5, JahanZeb B · 4, Jamal Z ·
3) are **real, from public Google reviews via a third-party aggregator**
(wanderlog.com/place/details/3410955/chaaye-khana-jhelum). Names, stars and
dates are as published; review text is shown **exactly as the source gives it**
— it is truncated (`…`) and has NOT been completed or reworded. Verify current
figures and pull full text from the Google Business listing before publishing.
Nothing was invented. Static section, no JS.

## Gallery

`#gallery` — a `.gallery-grid` (3-col with a 2×2 featured tile → 2-col on
mobile) of `<button class="gallery-grid__item" data-category="…">` tiles, plus
a `#lightbox` overlay. Each tile's `<img src>` points at a file in
`assets/gallery/` (`atmosphere-1.jpg`, `food-1.jpg`, `outdoor-1.jpg`,
`indoor-1.jpg`, `food-2.jpg`, `atmosphere-2.jpg` — see that folder's
`README.txt`). **If the file is missing, the `onerror` handler swaps in a
representative Unsplash stock photo** so the section isn't empty — those are
**not** the Jhelum branch. Drop the real, rights-cleared branch photos into
`assets/gallery/` (its own feed: instagram.com/chaaye_khana_jhelum) to replace
them. `.has-photo` (hover zoom + caption slide-up) is added once whichever image
loads; the lightbox shows `data-full`. Same fallback pattern for
`.info-photo__img` in Restaurant Information (`assets/gallery/storefront.jpg`).
Categories carried: **Food, Outdoor, Indoor, Restaurant atmosphere**.
Lightbox: click a tile to open, `‹ ›` / arrow keys to move, `×` / backdrop /
Esc to close. All in `js/main.js`; respects `prefers-reduced-motion`.

## Offers

`#offers` — a `.grid--3` of `.offer-card` (icon/photo, badge, title, description,
an `Offer`/`Valid` meta pair, and a **View Offer** button → `#contact`). Two
cards are **verified programmes from the official Chaaye Khana promos page**
(`chaayekhana.com/services-1`): *Ladies' Tuesday* (complimentary tea for women,
every Tuesday) and *Chess Competitions* (regular, all levels). These are
brand-wide, not Jhelum-confirmed, and the page publishes **no price, discount %
or expiry** — none was invented; unknown values show an italic placeholder
(`dd.is-placeholder`). The third card (`.offer-card--placeholder`, dashed) is an
editable template — duplicate it for each verified branch deal and fill in real
title / price / dates. Static section, no JS.

## Social media links

`.social-links` — a reusable row of circular icon buttons (inline SVG, no icon
font / no external requests) used in **two places**: the Contact section's
**Social** heading and the **footer** (`.social-links--on-dark` variant for the
dark footer). Same five items in both, kept in sync by hand.

Each icon carries its platform's **official brand colour** via a
`.social-links__link--<platform>` modifier: Facebook `#1877F2`, Instagram the
official corner-origin gradient, X/Twitter `#1DA1F2`, YouTube `#FF0000`, TikTok
`#010101` with a cyan `#25F4EE` / magenta `#FE2C55` drop-shadow offset on the
glyph (its signature look). Live links are a filled circle + white glyph; hover
lifts and brightens.

**Verified official Chaaye Khana Jhelum accounts** (checked Aug 2026 via web
search — page names / handles confirm the Jhelum branch, FB page phone matches
the reservations number, TikTok bio references the GT Road / PSO Riverside
branch):

| Platform | URL |
|---|---|
| Facebook | `https://www.facebook.com/ChaayeKhanaOfficial/` (page titled "Chaaye' Khana Jhelum") |
| Instagram | `https://www.instagram.com/chaaye_khana_jhelum/` |
| X (Twitter) | `https://x.com/chaayekhanajhel` |
| TikTok | `https://www.tiktok.com/@chaayekhana.jhelum` ("ChaayeKhana Jhelum Official") |
| YouTube | **none found** — no official Jhelum channel exists |

The **YouTube** item is an **editable placeholder**: a `<span
class="social-links__link social-links__link--youtube social-links__link--todo">`
— it still shows in YouTube red but sits **hollow with a dashed ring**, dimmed,
`aria-disabled`, no `href`, so it reads as "not yet linked". To activate it once
a real channel URL is known: change the `<span>` to an `<a href="…"
target="_blank" rel="noopener">` and drop the `--todo` class + the
role/aria-disabled/title attributes. Do this in **both** the Contact block and
the footer (instructions are in the HTML comment above the Contact list). All
real links are `target="_blank" rel="noopener"` with a descriptive `aria-label`;
nothing about the URLs was guessed. Static, no JS.

## Chat widget

`.chat` — a floating FAQ assistant fixed bottom-right (sits at the end of
`<body>`, `z-index: 150`). A circular `.chat__launcher` (saffron, speech-bubble
icon → ✕ when open) toggles `.chat__panel`; the panel header carries a
**minimise** button (chevron) and Esc also closes. On screens ≤ 480px the panel
goes near-full-width above the launcher.

**Styling is all design tokens — it reads as part of the same system as the
header and cart drawer:** cream panel, `--color-ivory` header with a
`--color-border` rule, the brand's bordered "CK" mark as the avatar, a Cormorant
(`--font-display`) title, `--color-surface` bot bubbles with `--shadow-sm`,
saffron user bubbles (like `.btn--primary`), `.btn--ghost`-style `.chat__action`
links, `--color-ivory` suggestion chips (like `.about__highlights`), and the
same saffron focus glow as `.field input`. No hard-coded colours.

**It has no backend and does not call an LLM.** `js/main.js` holds a fixed
`CHAT_ANSWERS` map — every reply is text drawn *only* from information already
verified elsewhere on this page (menu, the two offers, the address, the listed
opening hours) or from the published phone numbers. Where a detail isn't
verified the answer says "confirm with the branch" rather than inventing one
(e.g. it never quotes a price — it points at the menu; asked about delivery it
gives the fallback, not a guess).

The five `.chat__chip` suggested questions — *Show me the menu · What are the
prices? · What offers are available? · Where are you located? · What are your
opening hours?* — map to those answers; menu / prices / offers / location
answers also render a `.chat__action` deep-link to the relevant section. The
free-text box keyword-matches the same six intents (menu, prices, offers,
location, hours, contact); anything unmatched returns
`CHAT_FALLBACK`, which points to the branch phone numbers. To edit an answer,
change the string in `CHAT_ANSWERS`; nothing else needs touching.

## Shopping cart

The header cart button opens `#cart`, a right-side drawer (`.cart`, full-width
on mobile) with a backdrop; Esc / backdrop / × close it. Clicking **Add** on a
menu card adds a line; menu-card and cart `− / +` steppers both drive one store
(`cartLines` in `js/main.js`), so a card and its cart line always match, and
removing a line (`×` or stepping to 0) reverts the card. Each line shows unit
price and line total; the footer shows **Subtotal** and **Total** (equal — no
tax or delivery fee is assumed). The nav badge shows total quantity.
**Prices are never hard-coded in the cart** — `parsePrice()` reads them from
each `.menu-card__price`, i.e. the verified menu figures. Opening the cart
closes the nav and search.

## Menu

`#menu` = a note + a `.menu-filters` category bar + a `.menu-grid` of
`.menu-card` (3 → 2 → 1 columns). Each card: a **large 4:3 photo** (capped at
300px) with a category badge, then a compact body — name + exact price on one
row, a 2-line-clamped description, and a full-width **Add** button that swaps
in place to a **− / qty / +** stepper once tapped (down to 0 → back to Add).
Adding also outlines the card (`.menu-card.is-in-cart`). All state is local to
the card — the nav cart badge is not touched. Filtering + the stepper live in
`js/main.js`.

**Category chips:** clicking a `.menu-filter` (all / breakfast / sandwiches /
specials / pizzas / snacks / chefs-special / tea-coffee / desserts) sets the
`hidden` attribute on every card outside that category — `.menu-card[hidden] {
display: none }` (specificity beats `.menu-card { display: flex }`, which is why
the plain UA `[hidden]` rule wasn't enough) — then `scrollIntoView`s the filter
bar (`block: "start"`, `smooth` unless `prefers-reduced-motion`) so the visitor
lands on just the filtered results. `.menu-empty` shows if a filter matches
nothing. The header search's "jump to card" resets the filter to **all** first
if the target card is hidden.

**Data provenance — read before editing:** item **names and prices are verbatim
from the Chaaye Khana brand menu** (`chaayekhana.com/copy-of-menu-1`), 24 items
across 8 categories. This is the chain menu, **not** a Jhelum-branch-confirmed
list — verify current names, prices and availability with the branch. The menu
gives no descriptions, so each card now carries a **generic one-line
description of the dish** (what it is — not the restaurant's own copy; swap for
theirs if available). Verified serving notes (bread choice, rice choice) are
kept. **Card photos are representative
Unsplash stock images, not the branch's real plating** — replace the `src` on
each `.menu-card__img` before publishing (an emoji fallback shows if one fails).
Nothing about names, prices, ingredients, portions or availability was invented.

## Hero

`#home` is a split hero on a warm dark gradient: left column has the location
line, the **Chaaye Khana** name (large Cormorant), a one-line tagline, and two
buttons — **Explore Menu** (`#menu`) and **View Offers** (`#offers`). The right
column is a prominent framed photo (`.hero__photo`) with an offset saffron
frame and a small stamp. Stacks to one column below 900px. The floating
category strip (`.hero-categories`) still straddles the hero's bottom edge.

**Hero image:** a licensed Unsplash stock photo — a tea service with a teapot
and cups beside plates of sandwiches and fried snacks (tea **and** food, matching
the menu categories) — **not** an actual photo of the Jhelum premises. The same
URL feeds `og:image` / `twitter:image` / the JSON-LD `image`. Replace all four
with a real, rights-cleared photograph of Chaaye Khana by changing the `src` on
`.hero__photo` in `index.html` (or save it as `assets/hero.jpg` and point `src`
there). Portrait / 4:5 crops sit best in the frame.

## Next steps

Replace placeholder copy in the remaining sections, add real imagery to the
media frames / gallery / cards, wire the contact form, and embed a map in
`.map-frame`.

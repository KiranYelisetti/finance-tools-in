# QuickTools India design system: Desi Pop (v2, November 2026)

Live reference page: `/design-system/` (built with every deploy, marked noindex, not in the sitemap).
Source: `src/css/ds/` for styles, `src/js/ui.js` for behaviour, `tailwind.config.js` for utilities.

## Why it looks like this

The site is for Indian money questions, and much of its audience is young: a first salary, a first SIP, an exam form
that wants a 50 KB photo. The look borrows from Indian print and street colour: haldi yellow, rani pink, peacock teal
and henna green on chai cream, with ink outlines and hard shadows, like stickers on a notebook. It avoids the signs
of a template site: no gradients, no glass blur, no stock blue or purple, no Inter, no row of three icon cards, no
centred everything.

Calculators stay calm where it matters. Inputs, answers and tables are plain to read. The colour and motion sit around
them, never inside a figure.

## Layers

1. **Primitives** (`tokens.css`): colour scales `--chai-*`, `--haldi-*`, `--rani-*`, `--mor-*`, `--mehendi-*`,
   `--neel-*`, `--sindoor-*`. Never used by pages.
2. **Roles** (`tokens.css`): what a colour is for. `--qt-canvas`, `--qt-surface`, `--qt-sunken`, `--qt-ink`,
   `--qt-ink-2`, `--qt-muted`, `--qt-line`, `--qt-line-soft`, `--qt-shadow`, `--qt-primary`, `--qt-accent`,
   `--qt-link`, `--qt-focus`, `--qt-success`, `--qt-danger`. The night theme (`html.dark`) swaps these and nothing
   else.
3. **Component tokens**: type scale `--qt-text-xs` to `--qt-text-5xl` (fluid), radii `--qt-r-sm/md/lg/pill`, border
   `--qt-bw`, shadows `--qt-sh-1/2/3`, card padding `--qt-pad`, motion `--qt-dur-1..4`, `--qt-ease-out`,
   `--qt-ease-pop`, layers `--qt-z-*`.

Tailwind utilities map to roles: `bg-surface`, `text-muted`, `border-line`, `bg-primary` and so on.

## Themes

- Day ("Din") is the default. Night ("Raat") follows the device setting until the visitor picks one with the header
  button. The choice is stored as `qt-theme` in localStorage and applied before first paint (inline script in
  `base.njk`).
- Paper things stay paper at night: the cheque and anything with a bright fill (`.is-haldi`, `.is-loans` and the
  rest). They reset the roles to day values, so text on them is always ink. Wrap anything else that must stay light
  in `.qt-light`.

## Tool groups

Each group in `src/_data/tools.js` has a `key` that picks its colour: `amounts` (haldi), `loans` (rani), `tax`
(mehendi), `savings` (mor), `everyday` (neel). Use `.is-<key>` on a sticker, card, tile or menu group.

## Type

Bricolage Grotesque, variable (weight 200 to 800, optical size 12 to 96), self-hosted under the SIL Open Font License
(`src/fonts/OFL.txt`). The rupee sign lives in a 1.4 KB subset of its own so it matches the digits. Figures use
tabular numbers.

| Class | Use |
|---|---|
| `.qt-display` | the home hero only |
| `.qt-h1` | one per page |
| `.qt-h2` | section titles |
| `.qt-h3`, `.qt-card-title` | card and sub-section titles |
| `.qt-lede` | the paragraph under a page title |
| `.qt-eyebrow` | small capital label above a title or figure |
| `.qt-big` | the main result figure |
| `.qt-answer` | a result in words |
| `.qt-prose` | long reads: guides, explanations, FAQs |

## Components

| Component | Classes | Notes |
|---|---|---|
| Button | `.qt-btn` + `--secondary`, `--ink`, `--accent`, `--ghost`, `--sm`, `--lg`, `--block` | Presses into its shadow. Primary is haldi with ink text (12.9:1). |
| Chip | `.qt-chips` > `.qt-chip`, `aria-pressed` | Example values and filters |
| Segmented control | `.qt-seg` > `button[aria-pressed]` | Scrolls sideways on phones |
| Field | `.qt-fields`, `.qt-label`, `.qt-label-value`, `.qt-input`, `.qt-input--xl`, `.qt-hint`, `.qt-error` | Error state is `aria-invalid="true"` |
| Affix | `.qt-affix.is-prefix` or `.is-suffix` (+ `.is-xl`) > `.qt-affix-text` + `.qt-input` | ₹ before, units after |
| Select | `.qt-select` > `select.qt-input` | |
| Slider | `input.qt-range` | `ui.js` paints the filled part. Pair with a box through `data-sync` on the page. |
| Checkbox | `.qt-check` > `input` + `span` | |
| Card | `.qt-card` (+ `.is-<colour>`, `--flat`, `--sunken`), `.qt-card-head`, `.qt-well` | |
| Result rows | `.qt-rows` (+ `.is-stacked`) > `.qt-row` (+ `.is-total`) > `.qt-row-key`, `.qt-row-val`, `.qt-copy` | |
| Split bar | `.qt-split` > `span.is-a` + `span.is-b`, `.qt-legend` | |
| Table | `.qt-table-wrap` > `table.qt-table`, `td.num`, `tr.is-total` | Scrolls inside its box on phones |
| FAQ | `.qt-faq` > `details` > `summary` | |
| Note | `.qt-note` (+ `.is-tip`, `.is-danger`) | |
| Sticker, stamp | `.qt-sticker` (+ colour, `.is-flat`, `.is-ink`, `--tilt`), `.qt-stamp` | |
| Page head | `.qt-toolhead`, `.qt-crumbs` | Crumbs, group sticker, updated stamp, h1, lede |
| Home | `.qt-bento` > `.qt-tile` (+ `.is-wide`, `.is-half`, `.is-full`), `.qt-ticker`, `.qt-cheque` | Tile examples come from `src/_data/homeTiles.js` |
| Toast | `#qtToast`, `qt.toast(message)` | One in the footer include |

## Motion

Transform and opacity only. `ui.js` adds `.js` to `<html>`, and only then do `.qt-reveal` elements start hidden, so
the page works without JavaScript. Reveals run both ways: scroll back up and they return to where they came from.
Buttons press, stickers wiggle on hover, the ticker scrolls, fresh answers settle in (`.qt-fresh`). Result figures are
written at once, never counted up, so screen readers and tests read the final value. `prefers-reduced-motion` turns
all of it off.

## Behaviour helpers (`src/js/ui.js`)

`qt.copy(text, button)`, `qt.toast(message)`, `qt.fill(rangeInput)`, `qt.setTheme(isDark)`, `qt.countTo(el, value,
format)` (for decoration only).

## Rules for new pages

1. Use components and roles. No raw hex, no stock Tailwind colours, no gradients.
2. One `.qt-h1`. Page head: crumbs, group sticker, updated stamp, title, lede.
3. Inputs on the left, results on the right on desktop. Results directly under inputs on phones.
4. Keep element IDs stable. The end-to-end tests find controls by ID.
5. Check both themes and 360, 390 and 1366 px before shipping. No sideways scroll, no console errors.

## Legacy bridge

Every page moved to the components on 2026-11-06 (the converter kept IDs, scripts and Nunjucks tags as they were).
Two small pieces of the bridge stay on purpose:

- `tailwind.config.js` still points the stock palettes at the Desi Pop scales, because a few page scripts set stock
  classes at run time (the income tax verdict colours). Any stock class therefore stays on the palette.
- `src/css/ds/legacy.css` keeps outlines for stock form controls and tables inside old blog HTML.

New work never uses stock colour classes. When no script sets one any more, delete both.

## Pages and their parts

- Tool pages: `.qt-toolhead` (crumbs, group sticker, updated stamp, h1, lede), then `.qt-card` for inputs, a result
  card in the tool's group colour (`.qt-card.is-<group>`), `.qt-well` and `.qt-panel` inside it, `.qt-table-wrap`
  for tables, `details.qt-faq-item` for questions, `.qt-note` for callouts, `.qt-preset` for preset cards.
- Toggles are `.qt-seg` with `aria-pressed`. The script sets `aria-pressed`, the style follows it.
- Guides use `src/_includes/article.njk`: the first tag picks the colour (filter `tagKey` in eleventy.config.js),
  the body is `.qt-prose`, and the closing card lists the tools of the same group.

# Design — Maia

The visual and interaction system as **built**. Product truth lives in
[PRODUCT.md](PRODUCT.md); the brief that drove this build is
[DIRECTION.md](DIRECTION.md). Where the two disagree, this file describes the
code, and the divergence is named in §11.

The direction contract is an HTML comment at the top of `<body>` in
`index.html` (seed `4bbaadd2`) and survives into `dist/index.html`.

---

## 1. The world

**The Panel** — Braun domestic instruments (SK4, T3, ET66). Maia is a domestic
instrument: one panel face carrying a large display window and smaller
readouts.

Light and dark are **two real objects**, not one inverted: pale ABS and
charcoal ABS. Neither is derived from the other, and both are first-class.

**Materials.** Flat tones only. No blur, no `backdrop-filter`, no gradients, no
ambient washes. Radii are 2–5px (`--r-xs`…`--r-xl`). There is exactly one
exemption from the gradient ban, in §7.

**Depth is a three-part vocabulary**, not just a seam:

| Device | Token | Means | Applied to |
|---|---|---|---|
| Seam | `--seam` 1px + `--border-*` | two regions meet | region edges, rules, the control column |
| Molded edge | `--highlight-inner` | this part sits proud of the face | user turn, composer, armed send key, switch knob, lifted panels |
| Recess | `--recess` | this part is pressed into the face | struck segment, unarmed send key, code block, switch track |
| Engraving | `--engrave` | this label is silkscreened into the panel | `.legend` only |

Molded plastic catches light on its top edge and pressed parts sit in shadow;
both are inset, so neither counts as an elevation declaration. **Elevation is
declared once**: a real drop shadow, never a drop shadow plus a border. Verified
zero border-plus-drop-shadow pairs across the stylesheets.

**The face is continuous.** Regions abut. `--panel-gap` is `0px` at every
density. Grouping is done by seam, surface tone, and alignment — never by a
gutter, because a frame plus a gutter is a card.

---

## 2. Colour

Semantic tokens are declared per theme in `theme-light.css` / `theme-dark.css`.

| Role | Token | Light | Dark |
|---|---|---|---|
| Panel ground | `--bg-root` | `#cfccc3` | `#262624` |
| Display field (prose) | `--bg-workspace` | `#edebe5` | `#1a1a18` |
| Control column | `--surface-1` | `#c4c1b7` | `#201f1e` |
| Raised control | `--surface-2` | `#dad7ce` | `#302f2c` |
| Recessed / inert | `--surface-3` | `#b6b3a9` | `#3a3936` |
| Primary text | `--text-primary` | `#22221e` | `#e6e4dc` |
| Secondary text | `--text-secondary` | `#4a4a43` | `#a8a69d` |
| Tertiary text | `--text-tertiary` | `#5f5f57` | `#8c8a82` |
| Signal (text) | `--accent` | `#b4470a` | `#ee7524` |
| Signal (fill) | `--accent-fill` | `#b4470a` | `#ee7524` |
| Ink on signal fill | `--accent-on-fill` | `#fff7f0` | `#1a1a18` |
| Neutral focus ring | `--focus-neutral` | `#22221e` | `#e6e4dc` |
| Drop shadow | `--shadow-float` / `--shadow-menu` | `rgba(46,41,30,…)` | `rgba(10,9,6,…)` |
| Success | `--success` | `#3f6b36` | `#7ba86a` |
| Danger | `--danger` | `#a33218` | `#e2765a` |

The fill is **per theme**: one shared orange cannot carry legible ink against
both grounds.

### 2.1 The rationing rule — and how it is enforced

The accent is the **single lit element on screen at any moment**. This is not a
guideline; it is wired mechanically.

**Precedence: in-flight > armed primary action > focused > selected.**

`App.tsx` raises two attributes on `.app`:

- `data-busy` — a turn is in flight (`isStreaming`).
- `data-armed` — the composer holds a sendable draft, and nothing is in flight.
  `Composer` reports this upward through `onArmedChange`.

Every lower claim demotes under those attributes rather than disappearing:

| Claim | Lit | Demoted to | Selector |
|---|---|---|---|
| In-flight | stop button, accent fill | never demoted | — |
| Armed primary action | `.send-btn` accent fill | `--surface-3` when unarmed | `.app[data-armed='true'] .send-btn:not(:disabled)` |
| Focused control | accent ring / border | `--focus-neutral`, `--border-strong` | `.app[data-busy] , .app[data-armed] .composer:focus-within` |
| Selected conversation | 2px accent inset seam | `--border-strong` seam | `.app[data-busy], .app[data-armed] .column__row--on` / `.column__convo--on` |

`--ring-active` resolves to `--focus-neutral` under `data-busy` (`global.css`),
so focus visibility never depends on unrelated application state.

Verified by scanning every painted element against the live accent tokens:
**one** lit element with a focused, armed composer; **zero** when idle; **one**
(the stop control) while a turn is in flight — in both themes.

### 2.2 Semantic colour is demoted

Success and danger exist as **text and icon colours only**. No filled status
chips, no coloured badges, no tinted rows. The error state carries
`--danger` on its text and icon with `background: transparent` and no border.

---

## 3. Type

One family — **Archivo Variable** (`--sans`), self-hosted via
`@fontsource-variable/archivo`. JetBrains Mono (`--mono`) is confined to code
blocks and inline code; it is never a costume for "technical".

Six steps, ratio ≈1.15. **Weight promotes before size does.**

| Step | Token | Size | Weight | Use |
|---|---|---|---|---|
| Display | `--t-display` / `--w-display` | 21px | 500 | Surface title, startup identity, `h1` in prose |
| Title | `--t-title` / `--w-title` | 17px | 500 | Conversation title (`.region__title`), `h2` |
| Body | `--t-body` / `--w-body` | 15px | 400 | Prose, messages, composer input |
| Label | `--t-label` / `--w-label` | 13px | 500 | Controls, menu rows, settings, turn actions |
| Meta | `--t-meta` / `--w-meta` | 12px | 400 | Elapsed readout, captions, standing lines |
| Legend | `--legend-size` | 11px | 620 | Engraved panel legends only |

`font-variant-numeric: tabular-nums` is global; the elapsed clock is its
justification — a clock that changes width while counting is the defect the
setting exists to prevent.

**The legend is rationed.** Uppercase at `--legend-tracking` (`0.09em`) appears
**only on panel faces** — region heads and the startup track. It is banned in
menus, settings rows, prose, buttons, and empty states; those use the Label step
in a secondary tone (`.model-menu__title`, `.settings__title`).

**Italic is not a status voice.** It marks quoted or de-emphasised prose only
(`.md em`, `.md-quote`). A stopped generation is set in normal weight.

---

## 4. Layout

```
.app                      flex row, 100% height
├── nav.column            pinned; 56px rail, 244px expanded
└── main.deck             flex row
    ├── section.region--chat      flex: 1 1 auto  (absorbs remaining width)
    └── .deck__stack             fixed width; contains two dormant regions
```

The chat region's **left edge is structurally fixed**: it is the flex child that
absorbs remaining width, so only its right edge can move. Measured at 56px in
every state at every width tested.

Density is driven by `[data-style='snug' | 'roomy']` overriding the `:root`
scale. `--panel-gap` stays `0px` in all three.

### Responsive

| Width | Behaviour |
|---|---|
| ≤1100px | `.deck__stack-inner` narrows to 232px (`useStackWidth()` in `Deck.tsx` keeps the animated value in step) |
| ≤720px | Thread column, chat empty state, and expanded composer switch to `--thread-mobile-pad-x` |
| ≤680px | `.deck__stack` hides; `.region--chat` drops its right seam |

Maia ships as an **800×600** Tauri window, which is why the stack narrows rather
than disappearing at that size — both readouts are present there.

---

## 5. The chat surface

### Turns are bounded by tone, never by a container

| | Assistant turn | User turn |
|---|---|---|
| Ground | `--bg-workspace` (the page tone) | `--message-user-bg` |
| Edge | none | 1px `--message-user-border` |
| Radius | none | `--r-xs` (2px) |
| Width | full measure | full measure (`--user-message-width: 100%`) |
| Alignment | flush left | flush left — never right-aligned |
| Label | "Maia" as rendered text | none |

The assistant turn has **no container at all** — verified: transparent
background, `0px` border, `0px` radius. The **"Maia" label is rendered text**,
not decoration: with the container gone it is the turn's only non-visual
distinction and its accessible name.

The reading measure is `68ch` inside a `--thread-width` column.

### The five statuses

- **`thinking`** — an elapsed readout, never a spinner and never fake progress.
  `ThinkingReadout` renders the model, an optional inference-path segment, and a
  tabular clock counting from `startedAt` via `useElapsed`. `role="status"`,
  `aria-live="polite"`. At 20s (`REASSURE_AFTER_S`) the startup screen's
  reassurance line appears beneath it so both of the product's waits speak one
  language. The inference segment renders **only** when the orchestrator
  actually reported a GPU probe (`inferencePathFromStatus`); it is omitted
  rather than guessed.
- **`streaming`** — text replaces the clock. No cursor artifact.
- **`complete`** — the action row (Copy, Regenerate, model name) at the Label
  step, always present rather than hover-only, so keyboard and touch reach it.
- **`stopped`** — a Meta-step line, `font-style: normal`. Not an apology.
- **`error`** — `--danger` on text and icon only, no tint, no border,
  `role="alert"`. It renders `msg.error`, the adapter's own message, so the
  permanent line carries the diagnosis instead of a transient toast. Retry
  survives as a real control.

### The composer

A flat module on `--composer-face`, 2px radius, 1px seam. No pill, no shadow,
no blur. The attachment button is **absent** until a backend contract exists.
Enter sends, Shift+Enter breaks, **Esc stops an in-flight turn** — bound both on
the textarea and globally in `App.tsx`.

**Axis:** the slot owns width and centring, and the composer fills it.
`.region__composer` sits on the region axis on the dashboard (with the legend
and recents); `.region__composer--measure` adopts the thread container when
expanded, so it shares the reading axis exactly. Verified delta 0 in both
states at 1055px and 375px.

### Empty state

Quick starts render as seam-separated rows in the panel vocabulary — not a grid
of suggestion cards.

### Session honesty

A standing Meta-step line in the control column's history region reads *"Held in
memory for this session. Stored history is coming."* A standing condition gets a
standing line, not a toast.

---

## 6. Dormant regions

Tasks and weather are **instruments with no signal on that input**. The region,
its legend, and its readout structure are drawn precisely; the reading is simply
absent. Tasks renders a **ruled ledger** (`.readout__rule`, uniform widths) and
weather a **graduated scale with no needle** (`.readout__tick`, every fourth
major). Varied row widths were deliberately removed: they read as a skeleton
loader mid-fetch rather than an input with nothing connected. A short line names
what each waits on.

There is **no fabricated data anywhere** — which is why nothing needs
disclaiming. Neither region makes a network call, so the local-and-private
principle in PRODUCT.md stays unamended.

They carry `aria-disabled="true"` and contain zero focusable descendants.

---

## 7. Motion

**One authored moment: the face re-registers.** Not a container transform.

The control column stays pinned. The secondary stack's width animates to zero
and its inner block translates off-frame. The chat region's left edge does not
move; only its right edge travels. Measured: left `56` in both states, right
`1144 → 1440` at 1440px.

Everything else is 150–250ms state feedback (`--dur-fast`, `--dur-med`).

Reduce-motion is honoured from both the OS and Maia's own preference — read from
`documentElement.dataset.reduceMotion` before React mounts, then combined
through `MotionConfig` — and the re-registration becomes an immediate cut.

**The one exemption from the ambient-wash ban:** the thread's top and bottom
`mask-image` fade (`chat.css`). It is a legibility device that stops text
colliding with the region edge as it scrolls under it. Every other gradient in
the incumbent was removed.

`.thread` also sets `scrollbar-gutter: stable both-edges` so the centred reading
column cannot shift by half a scrollbar and fall off the composer's axis.

---

## 8. Identity

`MaiaMark` — four overlapping petals around a core. Rendered in **flat tones**;
the incumbent's radial gradient is gone, and depth comes from overlap and
opacity.

The mark is **silkscreened, not lamped**: `--mark-mid` is the secondary tone and
`--mark-core` the panel ground, so the mark never claims the signal. It doubles
as the in-thread thinking indicator at 17px beside the "Maia" label, but the
**elapsed clock carries the status** — a brand mark animating is decoration, a
clock counting is information.

---

## 9. Accessibility

- **Landmarks:** `nav[aria-label="Navigation"]`, `main.deck`, and one
  `section[aria-labelledby]` per region pointing at its own legend, so the
  engraved label is also the accessible name. Structure carried by surface tone
  alone does not exist in the accessibility tree, which is why these are part of
  the layout rather than an afterthought.
- **Contrast** is verified, not assumed. Measured against composited
  backgrounds in both themes: body 13.4 / 13.7, secondary 7.5 / 7.1, legend on
  the control column 4.96 / 6.74, placeholder 6.21 / 5.49, code comment 5.69 /
  5.30, error text 5.79. All small text clears 4.5:1.
- **Focus** is a hard 2px outline (`--ring-active`), never a soft glow, and
  never varies with unrelated application state.
- **Keyboard:** Cmd/Ctrl+K search, Cmd/Ctrl+B column, Esc stops a turn, Enter
  sends. Turn actions are always rendered.
- Browser surfaces are themed: selection, caret (`--accent`), scrollbars,
  focus ring.
- One icon family (lucide-react) at a single `strokeWidth` of `1.8`; the sole
  exception is the filled stop square, which is a fill rather than a stroke.
- Layer scale is tokenised: `--z-overlay` 50, `--z-popover` 55, `--z-toast` 60,
  `--z-tooltip` 70, `--z-startup` 80. Nothing declares a raw z-index.

---

## 10. Startup

The one ceremony the brief pinned, rebuilt in the panel's material language.

Three stages — **Docker / Services / Maia** — as a fixed track with a real
position, because startup genuinely has one. The active stage's lamp is the only
lit element on the screen. There is **no indeterminate progress bar**: the
sweeping animation was removed and `.startup-screen__progress` is a static
hairline.

Not observable live in the build environment (the local stub reports ready
before React mounts); documented from `startup.css` and `StartupScreen.tsx`.

---

## 11. Divergences and accepted trade-offs

Recorded so the next contributor does not read them as defects to "fix".

1. **The reading measure is centred** in the chat region, so it recentres when
   the region widens. DIRECTION.md's fixed-edge invariant is about the region
   edge and the chrome, not the measure. Left-pinning a 68ch column would
   strand roughly 800px of void at 1440px. Composer and prose travel together;
   they no longer drift independently.
2. **The expanded chat head shows the engraved legend and the conversation
   title together**, which reads slightly redundant. Accepted so the primary
   region is not the only one on the face without a legend.
3. **`.switch` is a panel switch, not a pill** — a rectangular recessed track
   with a molded rectangular knob at `--r-xs`. The 10px pill radius, previously
   the only radius outside the 2–5px law, is gone. Its on-state stays neutral
   (`--control-on`, `--switch-knob-on`) so it never competes for the signal.
4. **The inference-path segment** (`CPU`) could not be exercised in the build
   environment; it renders only when the orchestrator reports a probe. The
   readout carries one separator: `Llama 3.1 · CPU 0:14`.
6. **Three components animate `width`/`height`** (`ControlColumn`, the deck
   stack, the composer input) rather than `transform`. For the first two this is
   load-bearing: the re-registration works because the stack's width collapses
   and the chat region absorbs it, which a transform cannot do without changing
   the mechanic. Accepted as a design trade, not an oversight.
5. **`design-system/maia/MASTER.md`** is still on disk and specifies a
   violet/pink system that contradicts this one. PRODUCT.md records it as
   non-binding research.

---

## 12. Verification notes

`detect.mjs` reports zero findings, and that result carries little weight: it
runs **degraded** here (`htmlparser2`, `css-select`, `css-tree`, `domutils`
missing), token indirection hides every font behind `var(--sans)`, and its rule
registry has **no rule for `backdrop-filter` or gradients at all** — the two
prohibitions this system leans on hardest. The material laws were verified by
grep and computed style instead:

```bash
grep -rn "backdrop-filter" src/styles/   # 0
grep -rn "gradient" src/styles/          # 1: the thread mask exemption
grep -rn "blur(" src/components/         # 0
```

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
instrument: a display window and smaller readouts, now carried as **separate
panels floating on a ground** rather than cut into one continuous face.

This is a softening of the same world, not a replacement of it. The palette,
the type, the layout, and the accent-rationing mechanic in §2.1 are unchanged.
What changed is the material: generous radii, layered elevation, and a real
frame in place of hard edges and 1px seams.

Light and dark are **two real objects**, not one inverted: pale ABS and
charcoal ABS. Neither is derived from the other, and both are first-class.

**Materials.** Softened, deliberately: the object is the same instrument, made
in a finer material. No blur and no `backdrop-filter` — that ban holds. Radii
are 5–18px (`--r-xs`…`--r-xl`), regions take `--r-panel` 16px, and `--r-pill` is
spent only on small controls (the switch, the send key, chips, text buttons).
Two gradient exemptions now exist: the thread mask in §7, and `--sheen`, a ~3%
top-down wash on panel surfaces so a large flat field reads as lit rather than
printed. Both are legibility and material devices, not decoration.

**Depth is a three-part vocabulary**, not just a seam:

| Device | Token | Means | Applied to |
|---|---|---|---|
| Elevation | `--elev-panel` / `--elev-raised` | this panel floats above the ground | regions, control column, composer, overlays |
| Seam | `--seam` 1px + `--border-*` | a rule *inside* a panel | head rules, table rules, settings rows |
| Molded edge | `--highlight-inner` | this part sits proud of the face | user turn, composer, armed send key, switch knob, lifted panels |
| Recess | `--recess` | this part is pressed into the face | struck segment, unarmed send key, code block, switch track |
| ~~Engraving~~ | `--engrave` | retired: set to `none` in both themes. Legends read by tone and tracking alone; a text-shadow belonged to the hard panel. | — |

Molded plastic catches light on its top edge and pressed parts sit in shadow;
both are inset, so neither counts as an elevation declaration. **Elevation is
declared once**: a real drop shadow, never a drop shadow plus a border. Verified
zero border-plus-drop-shadow pairs across the stylesheets.

**The face is a set of floating panels.** The shell holds a `--frame-pad` 10px
margin and the regions a `--panel-gap` 8px gutter, so ground shows around and
between every panel — which is what makes a radius mean anything. Both are
constant across densities: the frame is a property of the object, not of the
reading density.

Grouping is now done by panel boundary, surface tone, and alignment. Elevation
is declared **once**: a floating panel carries `--elev-panel` and therefore no
border. `--elev-panel` and `--elev-raised` are two-layer — a tight contact
shadow plus a wide ambient one — because a single-stop shadow reads as a sticker.

---

## 2. Colour

Semantic tokens are declared per theme in `theme-light.css` / `theme-dark.css`.

Four planes, in both themes: the **ground** is the deepest tone, panels float
above it, raised surfaces (menus, composer) sit above those, and inset surfaces
(switch tracks, segmented trough) sit below. The direction is the same in light
and dark — the dark ground was deepened to `#0f0f0e` so its panels genuinely
read as floating rather than as holes cut in the face.

| Role | Token | Light | Dark |
|---|---|---|---|
| Ground | `--bg-root` | `#d6d3ca` | `#0f0f0e` |
| Display field (prose) | `--bg-workspace` | `#f6f4ef` | `#1e1e1c` |
| Control column | `--surface-1` | `#eeece5` | `#1a1a19` |
| Raised control | `--surface-2` | `#fcfbf7` | `#292825` |
| Recessed / inert | `--surface-3` | `#e2dfd6` | `#333230` |
| Primary text | `--text-primary` | `#22221e` | `#e6e4dc` |
| Secondary text | `--text-secondary` | `#4a4a43` | `#a8a69d` |
| Tertiary text | `--text-tertiary` | `#5f5f57` | `#918f87` |
| Signal (text) | `--accent` | `#a8420a` | `#ee7524` |
| Signal (fill) | `--accent-fill` | `#a8420a` | `#ee7524` |
| Ink on signal fill | `--accent-on-fill` | `#fff7f0` | `#1a1a18` |
| Neutral focus ring | `--focus-neutral` | `#22221e` | `#e6e4dc` |
| Drop shadow | `--shadow-float` / `--shadow-menu` | `rgba(46,41,30,…)` | `rgba(10,9,6,…)` |
| Success | `--success` | `#3b6432` | `#7ba86a` |
| Danger | `--danger` | `#993016` | `#e2765a` |

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
.app                      flex row, 100% height, --frame-pad 10px, gap 8px
├── nav.column            pinned; 56px rail, 244px expanded; floating panel
└── main.deck             flex row, gap 0
    ├── section.region--chat      flex: 1 1 auto  (absorbs remaining width)
    └── .deck__stack             animated width; clips .deck__stack-inner,
                                 which carries margin-left: --panel-gap
```

**The gutter lives inside the stack, not on the deck's flex gap.** A flex gap
would survive the stack collapsing to zero and strand 8px of dead ground at the
right edge in the expanded state. Putting it on `.deck__stack-inner` means the
animated outer width carries panel *and* gutter, so the two collapse as one and
the chat panel lands flush against the frame. `useStackWidth()` in `Deck.tsx`
adds the computed `--panel-gap` to the breakpoint width for exactly this reason;
the token is constant across densities so a single read cannot drift.

The chat region's **left edge is structurally fixed**: it is the flex child that
absorbs remaining width, so only its right edge can move. Measured at **74px**
(`--frame-pad` 10 + rail 56 + `--panel-gap` 8) in both states at 1280px; its
right edge travels `966 → 1270`, landing exactly on the frame inset.

Density is driven by `[data-style='snug' | 'roomy']` overriding the `:root`
scale. `--frame-pad` and `--panel-gap` are deliberately **not** among the
overridden tokens.

### Responsive

| Width | Behaviour |
|---|---|
| ≤1100px | `.deck__stack-inner` narrows to 232px (`useStackWidth()` in `Deck.tsx` keeps the animated value in step) |
| ≤720px | Thread column, chat empty state, and expanded composer switch to `--thread-mobile-pad-x` |
| ≤680px | `.deck__stack` hides; `.app` drops its frame inset to `--panel-gap` so the panels give the margin back to content |

Maia ships as an **800×600** Tauri window, which is why the stack narrows rather
than disappearing at that size — both readouts are present there.

---

## 5. The chat surface

### Turns are bounded by tone, never by a container

| | Assistant turn | User turn |
|---|---|---|
| Ground | `--bg-workspace` (the panel tone) | `--message-user-bg` |
| Edge | none | none — `--message-user-border` rests transparent, and is spent on the editing state |
| Radius | none | `--user-bubble-radius` (`--r-lg`, 14px) |
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

A raised module on `--composer-face` at `--composer-radius` 18px, carrying
`--elev-raised`. No blur. Its border **rests transparent**: elevation is the
shadow, so the border is free to be spent on state instead — `--accent-border`
on focus, `--border-strong` dashed in temporary mode, which is the same dashed
language the region flag uses. The attachment button is **absent** until a
backend contract exists.
Enter sends, Shift+Enter breaks, **Esc stops an in-flight turn** — bound both on
the textarea and globally in `App.tsx`.

**Axis:** the slot owns width and centring, and the composer fills it.
`.region__composer` sits on the region axis on the dashboard (with the legend
and recents); `.region__composer--measure` adopts the thread container when
expanded, so it shares the reading axis exactly. Verified delta 0 in both
states at 1055px and 375px.

### Empty state

Quick starts render as rows in the panel vocabulary — not a grid of suggestion
cards. They are separated by rhythm and a hover fill rather than by a rule under
each one, because a stack of hairlines reads as a ledger. Same treatment on the
dashboard's recents rows.

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

They sit on `--surface-1`, the quieter plane: still floating panels, but not the
display field, because there is nothing on them to read. Their head rule is
suppressed for the same reason.

There is **no fabricated data anywhere** — which is why nothing needs
disclaiming. Neither region makes a network call, so the local-and-private
principle in PRODUCT.md stays unamended.

They carry `aria-disabled="true"` and contain zero focusable descendants.

---

## 7. Motion

**One authored moment: the face re-registers.** Not a container transform.

The control column stays pinned. The secondary stack's width animates to zero —
gutter included — and its inner block translates off-frame. The chat region's
left edge does not move; only its right edge travels. Measured at 1280px: left
`74` in both states, right `966 → 1270`.

Everything else is 150–220ms state feedback (`--dur-fast`, `--dur-med`).
`--ease-standard` is `cubic-bezier(0.32, 0.72, 0, 1)`: fast departure, long
settle. The softness lives in the tail, which is what reads as composure.

Reduce-motion is honoured from both the OS and Maia's own preference — read from
`documentElement.dataset.reduceMotion` before React mounts, then combined
through `MotionConfig` — and the re-registration becomes an immediate cut.

**Gradients are limited to two devices**, both material rather than decorative:
the thread's top and bottom `mask-image` fade (`chat.css`), which stops text
colliding with the region edge as it scrolls under it, and `--sheen` (§1). No
`backdrop-filter` anywhere.

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
- **Contrast** is verified, not assumed — and re-measured after the palette
  moved. Light / dark, against the surface each role actually sits on: body on
  the chat panel 14.52 / 13.12, secondary 8.12 / 6.84, tertiary legend on the
  control column 5.45 / 5.38, accent text on the panel 5.54 / 5.73, ink on the
  accent fill 5.75 / 5.98, danger 6.85 / 5.54, code comment 5.69 / 5.30. Every
  small-text pair clears 4.5:1; the lowest is 4.55 (tertiary on `--surface-2`).
- **Focus** is a 2px outline (`--ring-active`) at `outline-offset: 2px`, never a
  soft glow, and never varies with unrelated application state. The offset is
  what lets it read *around* a rounded control instead of cutting across it.
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

One rounded card floating on the ground. Three stages — **Docker / Services /
Maia** — as an inset track with a real position, because startup genuinely has
one. **Only the stage in play sits proud**; completed stages stay flat with a lit
dot. Raising every visited stage was tried and reverted: it made the track read
as filled rather than as a position, which is the one thing this screen exists to
show. The active stage's lamp is the only lit element. There is **no
indeterminate progress bar**: `.startup-screen__progress` is a static rule.

Observed live this time, in both themes, by holding the gate on a stub
orchestrator.

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
3. **`.switch` is a pill again** — an inset track with a round knob, which is
   what `--r-pill` exists for: small controls. Its on-state stays neutral
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

`detect.mjs` reports zero findings, and that result still carries little weight
for the same reasons as before: it cannot see `backdrop-filter` or gradients at
all. The material laws were verified by grep, by computed style in a live
browser, and by a scripted contrast pass over every text/surface pair:

```bash
grep -rn "backdrop-filter" src/          # 0
grep -rn "blur(" src/                    # 0
grep -rn "gradient" src/styles/          # 3: --sheen ×2, the thread mask
```

Measured live at 1280×800, both themes: `.column` / `.region` radius 16px with
`--elev-panel` and **0px border**; composer radius 18px; send key 999px; chat
panel `[74 … 1270]` expanded against a 1280px viewport with `--frame-pad` 10 —
i.e. flush, with the gutter collapsed. Reading measure 68ch. Also exercised at
800×600 (the shipped window) and 375px.

Two defects found and fixed during that pass, both pre-existing: `.search-result`
stacked its icon above the title instead of beside it, and
`.search-result--cursor` had **no CSS at all**, so keyboard navigation through
search results was invisible.

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
are 5–18px (`--r-xs`…`--r-xl`), and `--r-pill` is spent only on small controls
(the switch, the send key, chips, text buttons). Cards that float inside the
frame — the startup screen's, the popovers — take `--r-panel` 16px; the shell's
own panels take `--r-frame`, which is 0 (§4).
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

**The face is continuous.** Both insets are closed: `--frame-pad` is 0, so the
panels run to the window's edges with no band of ground between the title bar
and the face, and `--panel-gap` is 0, so they run to each other. The ground is
still the deepest tone in the palette and still the surface everything is
described against — it simply has nowhere to show through any more.

What divides the face is therefore **tone and seam**, not a channel. Adjacent
panels are different planes (`--surface-1` against `--bg-workspace`), and where
two of the same plane meet — the stacked readouts — a 1px seam is drawn inside
the lower one as an inset shadow, so no layout moves to make room for a line.
Elevation stays: at a flush boundary its horizontal bleed is a soft groove of a
pixel or two, which is what a divided face wants there anyway.

A panel that meets the window has no ground behind its corner to round against,
so `--r-frame` is 0 and the outer corners are square. Radius returns wherever
something genuinely floats — the startup card, popovers, menus, the composer.

Both tokens are still read rather than assumed (`Deck.tsx` measures
`--panel-gap` at runtime), so the face opens back up from a single value.

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
.app                      flex row, 100% height, --frame-pad 0, gap 8px
├── nav.column            pinned; 56px rail, 244px expanded; floating panel
└── main.deck             flex row, gap 0
    ├── section.region--chat      flex: 1 1 auto  (absorbs remaining width)
    ├── .resizer                 absolute, in the gutter; dashboard only
    └── .deck__stack             animated width; clips .deck__stack-inner,
                                 which carries margin-left: --panel-gap
```

**The gutter lives inside the stack, not on the deck's flex gap.** A flex gap
would survive the stack collapsing to zero and strand 8px of dead ground at the
right edge in the expanded state. Putting it on `.deck__stack-inner` means the
animated outer width carries panel *and* gutter, so the two collapse as one and
the chat panel lands flush against the frame. `useDeckSizing()` in `Deck.tsx`
adds the computed `--panel-gap` to the resting panel width for exactly this
reason; the token is constant across densities so a single read cannot drift.

**Every split is the reader's.** One `Separator` component (`Separator.tsx`,
styled in `shell.css`, storage helpers in `lib/panel_split.ts`) serves two axes
and three splits, each a focusable `role="separator"` sitting in the gutter it
moves. The third is the bench's, in §13:

| | Vertical (`--x`) | Horizontal (`--y`) |
|---|---|---|
| Splits | conversation ↔ readouts | the two readouts |
| Stores | `harness.dashboard.stackWidth`, in px | `harness.dashboard.readoutSplit`, as a fraction |
| Floors | readouts 160px, conversation 340px | 104px per readout |
| Keys | ←/→ by 16px | ↑/↓ by 24px |

**Floored, never capped.** Each side declares the size below which it stops
being readable and everything between those floors belongs to whoever is
dragging. 160px is measured, not guessed: it is where `PENDING TASKS` exactly
fills its head. Shift triples a key step, Home and End go to the two floors,
double-click or Enter clears the preference — the width back to its breakpoint
default, the readouts back to an even split. The stored value is kept, not
rewritten, when a small window forces a tighter split; it returns when the room
does. A fraction is the right unit vertically for the same reason pixels are
horizontally: the stack's height follows the window, its width does not.

A separator draws nothing at rest — between two floating panels the ground
already is the line — and shows a 2px rule under the pointer, running the whole
gutter while held. Both exist only on the dashboard: they unmount when the face
expands, which is also what keeps a focusable element out of the `aria-hidden`
stack.

`.deck__stack-inner` keeps its **resting** width while the outer collapses, so
expanding clips the readouts away rather than squeezing them. The width comes
from `Deck.tsx` now; the stylesheet no longer names it.

The chat region's **left edge is structurally fixed**: it is the flex child that
absorbs remaining width, so only its right edge can move. It now starts at
**64px** (rail 56 + `--panel-gap` 8, with the frame closed) and its right edge
travels to the window's own edge. The invariant is unchanged; the numbers moved
with the frame, and the ones quoted in §12 were measured before it closed.

Density is driven by `[data-style='snug' | 'roomy']` overriding the `:root`
scale. `--frame-pad` and `--panel-gap` are deliberately **not** among the
overridden tokens.

### Responsive

| Width | Behaviour |
|---|---|
| ≤1100px | The stack's default resting width is 232px rather than 296px (`useStackSizing()` in `Deck.tsx` owns both, so the animated value and the laid-out value cannot disagree). A stored preference survives the breakpoint; the CHAT_MIN floor clamps it |
| ≤720px | Thread column, chat empty state, and expanded composer switch to `--thread-mobile-pad-x` |
| ≤680px | `.deck__stack` and the deck's `.resizer` hide. Neither the frame nor the gutter has an inset left to give back at any width |

Maia ships as an **800×600** Tauri window, which is why the stack narrows rather
than disappearing at that size — both readouts are present there.

---

## 5. The chat surface

### Turns are bounded by tone, never by a container

| | Assistant turn | User turn |
|---|---|---|
| Ground | `--bg-workspace` (the panel tone) | `--message-user-bg` |
| Edge | none | none — `--message-user-border` rests transparent; the tint is the whole boundary |
| Radius | none | `--user-bubble-radius` (`--r-lg`, 14px) |
| Width | full measure | full measure (`--user-message-width: 100%`) |
| Alignment | flush left | flush left — never right-aligned |
| Label | "Maia" as rendered text | none |

The assistant turn has **no container at all** — verified: transparent
background, `0px` border, `0px` radius. The **"Maia" label is rendered text**,
not decoration: with the container gone it is the turn's only non-visual
distinction and its accessible name.

**The reading measure is a share of the card, not a fixed width.**
`--thread-fill` (0.78) is what the thread column, the composer, the quick
starts, and the recents rows each take of the conversation card, so all four
are exactly as wide as one another at every card width — same axis, both edges.
`--thread-width-cap` (`--thread-measure-cap`, 108ch) and `--thread-width-floor`
(`--thread-measure-floor`, 54ch), each plus two `--thread-pad-x`, bound the
share at either end. Raising any of them widens all four together.

A fixed width snapped. Under it the column was card-wide; over it the column
stopped while the card kept going — so expanding the conversation, or a view
change that resized the card, moved the prose between two unrelated widths. A
share is constant whenever the card is and travels with the card whenever it is
not, which is the rule the reader can actually see. The token is unitless so the
thread and the composer can each multiply it against their own containing block
— the thread's is inset by the scrollbar gutter it reserves, the composer gives
the same gutter back before taking its share — and still land on one axis.

Both bounds are legibility, not taste. The `ch` unit resolves against the
shell's 14px rather than the prose size, so the two read in Default prose as
about **101 characters** and about **50**.

The **ceiling** stops the column growing when the card has not: past roughly a
hundred characters the eye stops finding the next line reliably. It sits far
enough out that a 1280px window reaches it in neither view — it is for the
large display, where the share alone would run the measure past reading.

The **floor** is the opposite case, and the reason it is a floor rather than a
second share: a wide card can afford a tenth of itself as margin on each side
and a narrow one cannot. Under the floor the margin is what gives way — the
column takes the whole card rather than a share of it, so shrinking the
conversation costs the reader margin before it costs them words. At the 340px
drag floor that is 264px of text rather than 194px. Between floor and share the
column rests at the floor while the card catches up, which is what keeps the
run continuous: **the width only ever grows with the card, never against it** —
verified monotonic across every card width from 340 to 1500px, in all three
densities.

`--thread-column` and `--thread-slot` resolve the whole expression once each
(the two differ only in base — the thread's containing block is already inset
by the scrollbar gutter it reserves; the slot gives the same gutter back before
it measures). Both are declared on `.app`, not `:root`: a `var()` inside a
custom property is substituted where the property is *declared*, so a bound
resolved at `:root` could not see a density variant retuning `--thread-pad-x`.
The variants live on `.app`, which carries `data-style`, so resolving there
keeps the bounds and the padding reading one value.

**One card, one axis.** The composer used to sit on the region axis under
history and adopt the reading axis everywhere else, which meant toggling
temporary mode — a change that only swaps one empty state for another and never
touches the card's width — moved the input under the reader's hands. History is
now measured the same way the quick starts are, and the composer holds the
reading axis under every view.

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
- **`complete`** — the action row (Copy, model name) at the Label step. Copy is
  the only action a turn carries: regenerate and edit-and-resend were both
  removed, so nothing in the thread rewrites history any more.
- **`stopped`** — a Meta-step line, `font-style: normal`. Not an apology.
- **`error`** — `--danger` on text and icon only, no tint, no border,
  `role="alert"`. It renders `msg.error`, the adapter's own message, so the
  permanent line carries the diagnosis instead of a transient toast. Retry
  survives as a real control.

### The action row is reserved; the ink is not

Every turn keeps its action row in the layout, so the thread never reflows
under the pointer and the rhythm is the same hovered or not. On turns **behind
the current one** the buttons are held at `opacity: 0` and revealed by
`.turn:hover` or `:focus-within` — opacity only, so the control stays in the
layout, in the accessibility tree, and in the tab order, and a keyboard reveals
it exactly the way the pointer does. The last turn keeps its actions lit,
`@media (hover: none)` restores them everywhere, and the model name never fades:
it is a reading, not a control. This is a deliberate reversal of the previous
always-visible rule — see §11.

The user turn now carries Copy too, in the same row and the same vocabulary as
the assistant's.

### What the dashboard panel holds

The conversation panel shows **the conversation it is holding**, expanded or
not: opening one from recents, from the column's history, or from search loads
it in place rather than throwing the reader into the full surface. History
appears in the panel only when there is nothing loaded to show, and quick starts
take its place when the reader is on a new or temporary chat. Sending never
moves the surface either — expanding stays the reader's call, made with the
panel's Expand control or the column's Conversation row, which toggles the
surface the way the row beneath it toggles temporary mode.

The composer follows whatever it sits under: the reading axis when a
conversation or the quick starts are on the panel, the region axis under
history.

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
`.region__composer` adopts the thread's container under **every** view — the
thread, the quick starts, and history alike — so it shares the reading axis
exactly and never moves when the reader toggles between them. It used to sit on
the region axis under history, which meant toggling temporary mode moved the
input even though the card had not changed width at all.

The thread reserves a scrollbar gutter on **both** edges, which is what keeps
the centred column from shifting by half a scrollbar. The slot gives back the
same gutter before taking its share — `calc((100% - 2 * var(--scrollbar-size))
* var(--thread-fill))` inside `--thread-slot`, shared by the composer slot, the
quick starts, and the recents list, with `--scrollbar-size` also feeding the
scrollbar rule itself so one value cannot drift from the other. Both are
centred on the card, so the axis holds at the floor and the ceiling too.
Verified across every card width from 340 to 1500px in all three densities —
thread turn, user bubble, quick start row, and recents row all flush with the
composer on both edges, worst delta 0.016px (sub-pixel layout rounding).

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

### 5.1 Expanding is a trade

Collapsing the readout stack is only half of what expanding does. The other
half arrives inside the chat region: a **detail rail**, the same instrument
logic pointed at the conversation instead of at the machine around it. It is
the reason to expand rather than read the card.

The region becomes two columns — `.region__main` carries the head, the thread
and the composer; `.region__aside` carries the rail — so the head's controls
end where the rail begins and travel with it. The rail runs the full height of
the panel with its own head on the panel head's line, and it opens and closes
by the same mechanic the stack collapses with: an animated width clipping a
block that keeps its own. Widths live in `Deck.tsx` (296px, 236px at ≤1120px,
nothing at ≤900px where the reading column would fall under its floor); the
state is a preference, stored under `harness.conversation.detail`.

What it reads: turns, last activity, model, whether the conversation is kept,
what it has cost in tokens, the slowest and fastest answer, an index of turns
that scrolls the thread to any of them, and the session id — which is the
conversation's own id, and therefore the id its records are on the bench under.
`Open in Investigate` carries it there and narrows the whole bench to it.

Every reading comes from the conversation in hand. Usage and wall clock are
kept on the turn as it completes (`AssistantMessage.usage`, `durationMs`);
turns that reported none say so rather than reading zero, and a stored
conversation says why it has none. The cost block **settles** rather than
jumps: the figures travel to their new reading on `--ease-standard` over 0.62s
and the split bar travels with them, so a turn landing is announced by
movement rather than by a flash. Tabular figures keep the width still while it
counts.

**Search is the history's, not the shell's.** The card's head carries the
history control, an icon like every other control in that head, with its name
and `Ctrl+K` in the tooltip. The view behind it is the history and the search
of it; the field is what greets the reader inside. It is focused on open and
filters what is loaded — and because a
filtered list is short, the page sentinel comes back into view and the rest
loads on its own. Ctrl+K opens that view rather than a surface of its own; the
overlay it replaced is gone, along with its styles. The control column is down
to the two surfaces (Conversation, Investigate) and Preferences: temporary
mode belongs to the composer that will send the turn, and a row for it would
have been a second place to reach the same switch.

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

**Views travel on a rail.** A view that replaces another slides rather than
dissolves: what arrives comes from the side it lives on, what leaves goes the
other way, and the frame never moves. Direction is derived, never remembered —
the bench is to the right of the deck, history is to the right of what it
covers — and it rides on the `AnimatePresence` boundary as `custom`, so the
outgoing view leaves against the incoming one rather than on the direction it
happened to arrive with. Two distances, in `lib/motion.ts`: 34px for a whole
surface, 18px for a view inside a panel that is staying put. Entrances are
0.22–0.28s and exits 0.13–0.16s, so the arriving view never waits on the
leaving one. The one exception is the bench's record, which rises 4px with no
exit at all: the reader walking the ledger with the arrow keys is moving on
purpose, and an outgoing record would put a queue in front of them.

Everything else is 150–220ms state feedback (`--dur-fast`, `--dur-med`).
`--ease-standard` is `cubic-bezier(0.32, 0.72, 0, 1)`: fast departure, long
settle. The softness lives in the tail, which is what reads as composure. Every
one of these collapses to a cut under reduce-motion, which is read from both
the OS and Maia's own preference.

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
  sends. Turn actions are always rendered and always focusable; behind the
  current turn they are revealed by hover or focus rather than removed. The
  separators are focusable `role="separator"` controls with live
  `aria-valuenow`, and both unmount rather than sit inside the `aria-hidden`
  stack when the face expands.
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
   edge and the chrome, not the measure. Left-pinning the column would
   strand roughly 800px of void at 1440px. Composer and prose travel together;
   they no longer drift independently.
2. **The chat head shows the engraved legend and the conversation title
   together**, which reads slightly redundant, and now does so on the dashboard
   as well. Accepted so the primary region is not the only one on the face
   without a legend; the legend shrinks first when the panel is narrow.
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
11. **`--scrollbar-size` assumes the WebKit scrollbar rule**, 10px, because
   Maia ships in a Chromium WebView. Firefox's `scrollbar-width: thin` reserves
   its own width and the axis would be off by the difference there; the shipped
   runtime is the one that is verified.
7. **Turn actions are hover-revealed behind the current turn**, reversing the
   earlier always-visible rule. Requested directly, and the cost is paid rather
   than dodged: the row keeps its space so nothing reflows, opacity is the only
   thing withheld, focus reveals it as reliably as hover, and touch pointers get
   it unconditionally. The always-visible rule stands for the current turn, for
   Retry, and for the model name.
10. **The reading measure is proportional, and leaves the band at both ends.**
   `--thread-fill` 0.78 puts Default prose at ~73 characters on the dashboard
   and ~101 expanded, against 65–75 guidance; under `--thread-width-floor` a
   dragged-narrow card falls to ~31. Accepted: the ask was
   for a width that stays put when the card does and moves when the card moves,
   and a fixed measure cannot do both — it snaps at the width where its cap
   starts binding, which is exactly the seam the reader was seeing. The
   overshoot is bounded by `--thread-measure-cap`, and the whole thing is two
   tokens to walk back.
9. **The separator's focus indicator is its own rule, not an outline.** A 14px
   invisible strip outlined at `outline-offset: 2px` draws two full-height
   lines around something that is not a visible object. On `:focus-visible` the
   strip suppresses the outline and paints `.resizer-line` at
   `var(--ring-active)`, full height — still 2px, still the ring token, and it
   marks exactly what moves. The only control in the app with a custom focus
   treatment.
8. **Regenerate and edit-and-resend are gone**, at the owner's request, along
   with `handleEditUser`, the user turn's editing state, and the toast that
   explained the session reset an edit caused. Retry stays: it recovers a turn
   that failed rather than rewriting one that succeeded, and it is the only
   resend left. `PRODUCT.md` still lists regenerate under the message lifecycle
   — product truth on that point is now ahead of the build, deliberately.

---

13. **The face is continuous — no frame, no gutter.** §1 originally held a
   10px inset around every panel and an 8px gutter between them, on the
   reasoning that a radius means nothing without ground behind it. Closing
   both was asked for directly: the bands read as gaps rather than as a frame.
   The consequences were taken rather than dodged. Panels flush to the window
   have nothing to round against, so `--r-frame` is 0 and their outer corners
   are square. Panels flush to each other have no ground to separate them, so
   separation moved to tone and to a 1px seam drawn *inside* the lower panel.
   This is close to the hard-panel world this design softened away from, which
   is worth saying plainly rather than discovering later. Two tokens —
   `--frame-pad` and `--panel-gap` — walk the whole thing back, and nothing
   that lays out against them assumes their value.

12. **Investigate shipped seeded; it no longer does.** §6's "no fabricated
   data anywhere" held everywhere but the bench, which stood on captured
   snapshots and hand-written records because the backend wrote its logs to a
   volume it did not serve. That exception is closed. `GET /api/traces` serves
   both streams, `HttpLogStreamAdapter` reads them, and the seed adapter, its
   fixtures and `scripts/snapshot-logs.mjs` are gone — with the `seed` row
   mark, the split count in the ledger head, and the `Seed data` flag. The
   record envelope no longer carries an origin either: a field whose only
   value is `captured` says nothing. The head reports what the response
   reports instead — where the records were read from, when they were read,
   and whether the ledger is the whole stream or its most recent window. §6's
   sentence now holds without an exception.

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

Measured again after the two-axis separator work, at 1280×800 in headless
Chromium. Prose, user field, and composer share both edges exactly —
`199 … 841`, 642px — in the dashboard panel. The vertical separator runs the
conversation from 340px (`Home`) to 1028px (`End`) at that viewport, where the
readouts sit at their 160px floor with `PENDING TASKS` filling its head to the
pixel and no clipping. The horizontal separator splits the readouts 386/386 by
default, holds a 104px floor at both ends, steps 24px per arrow key, and clears
back to even on Enter; a stored 0.8653 renders 668/104 at 800px tall, clamps to
268/104 in a 400px window, and returns to 668/104 when the room does. Expanding
the face removes both separators — zero focusable descendants inside the
`aria-hidden` stack — and restores them with the stored split on the way back.

Measured before that at 1280×800 in headless Chromium after the dashboard work,
both themes. The chat panel rests at `[74 … 966]` on the dashboard with the
stack outer at 304 (296 + the 8px gutter) and the separator centred on the
gutter at 970, 14px wide. Dragging it 90px right lands chat `[74 … 1056]`,
stack 214/206, `aria-valuenow` 982, and `harness.dashboard.stackWidth` = 206;
ArrowRight steps it to the 176 floor, Home to the 420 ceiling, Enter clears the
preference back to 296. At 800×600 the split settles at chat 476 / stack 232 —
the 460px conversation floor holds — and at 600px the stack and the separator
are both `display: none`. Toggling the column's Conversation row expands to
`[74 … 1270]` and back to the stored split; the separator unmounts while
expanded. Thread column and composer share the axis exactly on the dashboard
(both start at 198px, delta 0). Older turns report `opacity: 0` on their action
buttons and `1` under `:hover` or `:focus-within`, in both themes and all three
densities; the current turn stays at `1`.

Measured previously at 1280×800, both themes: `.column` / `.region` radius 16px with
`--elev-panel` and **0px border**; composer radius 18px; send key 999px; chat
panel `[74 … 1270]` expanded against a 1280px viewport with `--frame-pad` 10 —
i.e. flush, with the gutter collapsed. Also exercised at
800×600 (the shipped window) and 375px.

Two defects found and fixed during that pass, both pre-existing: `.search-result`
stacked its icon above the title instead of beside it, and
`.search-result--cursor` had **no CSS at all**, so keyboard navigation through
search results was invisible.

---

## 13. Investigate — the bench

A third surface, mounted where the deck is: the control column does not know
which one is up, and `Surface` in `App.tsx` is one union rather than a pair of
booleans, so no two of them can be open at once. The column row toggles it the
way Conversation toggles the expanded chat.

**The bench is the same object in a cooler material.** The face is warm ABS;
this is the grey of the chassis under it. `investigate.css` re-declares a
scoped set of semantic tokens on `.bench` per theme — the four planes, the
three borders, the surface washes, the text ramp, and the sheen — at the same
luminance in a cooler hue. Nothing structural changes: frame, elevation, radii,
type scale, accent rationing, and §2.2's ban on filled status chips all hold.
Three things do:

| | The face | The bench |
|---|---|---|
| Material | warm neutral ABS | cool grey chassis |
| Data | one sans everywhere | `--mono` for clocks, ids, counts, payloads |
| Grouping | panel boundary and tone; stacked hairlines avoided | ruled rows, because it is a ledger |

Mono is not a costume here: a log record is measurement, which is the same
justification §3 gives code. It is confined to recorded values and never used
for prose or labels.

**Two speeds.** A ledger column scans (336px, grouped by `invocation_id`,
because a turn can hold a tool round-trip and three gate passes and they only
read stacked together) and an inspector opens one record in full. Below 900px
the two stack, ledger over record. The channel selector in the head is the
segmented control from Preferences, wearing `role="tablist"` with arrow keys;
the filter pills carry their own counts, so a filter that would empty the
ledger says so before it is pressed.

**States are the log's, not the reader's.** An outcome is a word plus a mark in
one tone — `--success`, `--danger`, or neutral, on text and icon only. A field
the log did not record renders its reason (`structure` mode keeps decisions and
drops text), because an empty block would read as a defect in the surface
rather than as the logger working correctly. Row selection is the lowest claim
on the accent and demotes under `data-busy` and `data-armed`, the same rule the
column's open conversation follows.

**The split is the reader's**, the same `Separator` the dashboard uses, on
the same terms: floored at 232px of ledger and 380px of record, stored in
pixels under `harness.investigate.ledgerWidth`, arrow keys at 16px, Home and
End to the two floors, double-click or Enter to clear. The record takes
whatever the ledger is not using and carries no measure cap — only its one
prose line does — because a payload reads better wide than wrapped early. Below
900px the panes stack and the separator unmounts rather than sitting in the
`aria-hidden` stack.

**A read, not a feed.** The bench asks for one window of one stream, scoped by
the backend to this reader and — when they arrived from a conversation — to
that session, so the filter counts describe what was actually asked for rather
than what a client-side filter kept. `Read again` asks again and leaves the
ledger up while it does; a read that fails reports itself over records that are
still good rather than in place of them, because what is on the ledger was
recorded and was read. When the window comes back full the head says so, since
a ledger that is only the most recent 200 records should not read as the whole
stream.

**Adding a stream** is one entry in `components/log-registry.ts` — label,
summary, filters — plus a body case in `LogRecordView`. The records arrive
through `ReadLogStream` → `LogStreamPort` → `HttpLogStreamAdapter`, which is
the only file that knows the transport is `GET /api/traces`; which sink they
were recorded to — the `.logs` files or Postgres — is the response's to name,
not the registry's.

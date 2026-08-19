# Direction — Maia visual world replacement

Status: **built and reviewed.** This document is now the historical brief: it
records how the direction was chosen, what it committed to, and what it got
wrong along the way. The system that actually shipped is documented in
[DESIGN.md](DESIGN.md), written from the built world after the finish review —
read that one first when working on the code.

Product truth lives in [PRODUCT.md](PRODUCT.md). This file records visual and
structural decisions only.

---

## 1. The brief

From the user, verbatim in substance:

- Complete replacement visual world, **Operate** mode.
- Character: **cozy, native-feeling, Apple-like desktop software** — clear
  hierarchy, restrained materials, precise alignment, transparent Maia
  responses, minimal unnecessary containers.
- Explicitly ruled out: Material Design styling, card-everything layouts,
  excessive rounding, ornamental gradients, marketing-site aesthetic.
- `design-system/maia/MASTER.md` is **research, not specification.**

Answers collected during the round:

| Question | Answer |
|---|---|
| Scope | Materials **and** structure both open |
| Light vs dark | **Genuinely equal** — neither leads |
| Load-bearing, must survive | **Startup ceremony only** (three-stage Docker → Services → Maia) |
| Landing surface | **Dashboard** replacing the greeting home, extensible panel system |
| Panels | Chat live and expandable; tasks and weather **placeholders**, no expansion |
| Expansion | **Panel grows into full page**, preserving spatial continuity |

---

## 2. The decision round

Seven grounded candidates were derived from the audience's world (a person
running a model on their own machine), spanning industrial product design,
architecture/paper, screen/OS tradition, metal instrument, print/editorial,
bookbinding, and mechanical/correspondence families.

Deliberately excluded as the category rut: the ChatGPT/Claude desktop clone
(which is what the incumbent already is, in brown), and its predictable
opposite, the terminal/hacker aesthetic.

`concept-seed.mjs --scope direction --mode operate` → **seed key `4bbaadd2`**,
assigned index **5** (Service Manual / Swiss technical documentation).

Six catalog challengers were fused with the product and judged on audience
identification and product clarity:

| Challenger | Verdict | Reason |
|---|---|---|
| Copy-Shop Sheet (photocopied zine) | **competitive** | Fixed single-column measure is what a chat thread already is; loses on clarity at the dashboard pivot |
| Struck Cathode (nixie gauze) | declined | A glow world cannot render light and dark as equals; ghost layers damage prose |
| Step Row (rhythm machine) | declined | Wins the startup screen, loses the dashboard and thread |
| Pop Sleeve (yé-yé) | declined | Flooded saturated ground is the marketing aesthetic the brief rules out |
| Orizuru Sequence (origami) | declined | Linear recoverable procedure has no analogue in open-ended conversation |
| Iridescent Edge (cloud optics) | declined | Sound discipline, no tie to the audience's world |

**The user chose the pick card — "The Panel" — over the roll's assignment.**
Service Manual stepped aside. The five disciplines donated by declined
challengers carry into the build (§4).

---

## 3. The committed world — The Panel

**Lineage:** Braun domestic instruments — the SK4, the T3 radio, the ET66
calculator. Chosen over a literal macOS replica because Rams is where Apple's
own design language came from, so it reaches "Apple-like" without copying
macOS chrome.

**Thesis:** Maia is a domestic instrument. One panel face carries a large
display window and smaller readouts — which is what a dashboard has always
been in the physical world, long before it was a grid of cards.

**Color strategy: Restrained, rationed to near-zero.** Panel neutrals carry
everything. Signal orange is not "the accent colour" applied consistently
across roles — that consistency is Material's system, and it is what made the
first draft of this plan generic. On the objects this world comes from, the
signal colour appears on almost nothing: one lit dot, one switch. Function is
carried by typography, alignment, and surface tone.

**The rationing rule:** orange is the single lit thing on screen at any given
moment. If two things are orange at once, one of them is wrong. It marks the
focused primary action, or the current selection, or an in-flight state — never
two of those simultaneously.

**Semantic colour is demoted.** Success and danger exist as text and icon
colours only. No filled status chips, no coloured badges, no tinted rows. A
red word and a red icon say "error" without importing a colour system.

Light and dark are **both real Braun objects**, not an inversion trick: pale
ABS and charcoal ABS. Neither is derived from the other.

| Role | Light (pale ABS) | Dark (charcoal ABS) |
|---|---|---|
| Panel face / ground | `#CFCCC3` | `#262624` |
| Display field (prose) | `#EDEBE5` | `#1A1A18` |
| Control column | `#C4C1B7` | `#201F1E` |
| Raised control | `#DAD7CE` | `#302F2C` |
| Primary text | `#22221E` | `#E6E4DC` |
| Secondary text | `#55554D` | `#A8A69D` |
| Signal (text-safe) | `#B4470A` | `#EE7524` |
| Signal (fills) | `#B4470A` | `#EE7524` |
| Ink on signal fill | `#FFF7F0` | `#1A1A18` |
| Neutral focus ring | `#22221E` | `#E6E4DC` |
| Success / ready — text and icon only | `#3F6B36` | `#7BA86A` |
| Danger — text and icon only | `#A33218` | `#E2765A` |

The fill value is **per theme**. Rev 2 used one `#D2540A` for both, which cannot
carry legible ink against `#EDEBE5` and `#1A1A18` alike — light mode's
white-on-orange landed near 4:1. Light fills use the darker orange with bone
ink; dark fills use the lighter orange with panel ink.

**Contrast is verified, not assumed.** Body and placeholder text ≥4.5:1, large
text ≥3:1, and every signal fill measured against the ink that sits on it, in
both themes. PRODUCT.md records no conformance standard, which is why nothing
currently forces this check — that absence is the defect, and this line is the
local fix until the product record sets a standard.

### Precedence when the signal is contested

The rationing rule needs an order, because the working state has three
claimants at once — a focused composer, a selected conversation, and an
in-flight turn. Rev 2 named this gap and stopped.

**Order: in-flight beats focused beats selected.**

Demotion is not disappearance. Each loser has a specified neutral expression,
because an invisible selection is worse than two oranges:

| State | Lit | Demoted to |
|---|---|---|
| In-flight turn | signal | never demoted; it is the top claim |
| Focused control | signal ring | **neutral focus ring** token, 2px, same geometry |
| Selected conversation | signal | `Raised control` tone plus a 2px left seam |

The neutral focus ring is a named token so that focus visibility never varies
with unrelated application state. A focus ring that dims because something
else is loading is a keyboard defect, not a design decision.

### Type

One grotesque family, **Archivo Variable**, for headings, body, labels,
buttons, and data. JetBrains Mono is retained strictly for code blocks — never
as a costume for "technical".

Naming a family is not designing a system. The scale is tight, per Operate
mode, and **weight carries hierarchy wherever size can be held constant**:

| Step | Size | Weight | Use |
|---|---|---|---|
| Display | 21px | 500 | Surface title, startup identity |
| Title | 17px | 500 | Panel headings, conversation title |
| Body | 15px | 400 | Prose, messages, input |
| Label | 13px | 500 | Controls, menu rows, settings labels |
| Meta | 12px | 400 | Elapsed timers, model readouts, captions |
| Legend | 11px | 620 | Engraved panel legends only |

Ratio is roughly 1.15 between adjacent steps. Within a panel, promotion is a
weight change at the same size before it is ever a size change; this is where
calm desktop software gets its character, not from tracked capitals.

**The legend is 11px, not 10.** It is load-bearing — it names every region on
the face, and those are exactly the labels a low-vision or screen-reader user
most needs. Ten pixels at 620 weight and heavy tracking sits below the floor
desktop software normally holds, and the legend is the wrong place to save a
pixel.

**The legend is rationed.** Uppercase at `0.09em` tracking appears only on the
panel face, where it is literally silkscreened onto the instrument. It is
banned in menus, settings rows, prose, buttons, and empty states — applying it
as a general label voice is the tic this world is trying to avoid.

**Italic is in the system.** It marks quoted or de-emphasised prose only:
markdown `em`, `blockquote` attribution. It is banned as a status voice — a
stopped generation is not an apology and must not be set in apologetic italic,
which is what the incumbent does.

Tabular figures are on globally, and the elapsed timer is their justification:
a clock that shifts width while counting is the thing this setting exists to
prevent. Token counts and any future numeric readout inherit the same benefit.

### Materials

Flat panel tones. **No blur, no backdrop-filter, no gradients, no ambient
washes.** Depth is a 1px seam plus a molded-edge inner highlight. Radii 2–5px
throughout — panel geometry, not web bubbles.

**The face is continuous.** Regions abut. There are no gutters between panels,
because a frame plus a gutter is a card no matter what it is called, and cards
are what this brief rules out. Grouping is done by seam, by surface tone, and
by alignment — the way regions are machined into one instrument face. The
deck's gap token is zero; `--panel-gap` survives only as the internal padding
name and no longer opens space between regions.

**One exemption from the ambient-wash ban.** The thread's top and bottom
`mask-image` fade survives. It is a legibility device — it stops text colliding
with the region edge as it scrolls under it — not decoration, and every other
gradient in the incumbent is removed. Named here because a categorical ban with
a silent exception is how bans erode.

### Motion

**One authored moment: the face re-registers.** When chat expands, this is
explicitly *not* a container transform — a card inflating to fill the window is
the Material pattern and reads as Android on a desktop.

Instead: the control column stays pinned and visibly unmoved. The secondary
regions translate off-frame. The chat region's **left edge does not move at
all**, and only its right edge travels outward. One mechanism reconfiguring,
not one container growing — and the fixed edge is what preserves the sense of
where you came from.

Everything else is 150–250ms state feedback. Reduce-motion is honored from both
the OS and Maia's own preference, and under it the re-registration becomes an
immediate cut with no translation.

---

## 4. Raises carried from declined challengers

Each declined challenger donated one discipline. Three are adopted; two are
refused.

1. **From Struck Cathode** — the full option set stays visible as one struck
   value among its siblings, never collapsed behind a disclosure arrow. A Braun
   panel shows every switch position.

   **Bounded:** this governs *value sets inside an already-visible control
   group* — things that are literally switch positions, like the theme choice
   or the Snug/Default/Roomy selector. It does **not** govern navigational
   menus, the model picker, or the profile menu, which are not switch positions
   on a panel face. Unbounded, this rule unfolds every menu in the app
   permanently and destroys progressive disclosure, which is the primary tool
   for managing cognitive load.

2. **From Step Row** — **no indeterminate spinner survives anywhere in the
   app.**

   Rev 2 stated this as "position on a fixed track," which works for startup —
   a genuine three-stage sequence — but was impossible for an in-flight turn,
   because the backend returns one complete JSON response and there is no
   position to report. That rule banned the honest treatment and mandated a
   fictional one.

   Corrected: **show elapsed, never fake progress.** An instrument reports real
   values; it does not invent a percentage. Startup keeps its fixed track
   because it genuinely has one. A turn in flight shows a counting clock. See
   §5.1's thinking state.

3. **From Iridescent Edge** — the reading field stays fully achromatic. Color
   lives only on hairline edges and small state marks.

4. **From Pop Sleeve — REFUSED.** "One committed saturated field at page scale"
   fights Braun restraint directly. Translated instead as a second *neutral*
   layer for the control column, which is what Operate mode asks for anyway.

5. **From Orizuru — ADOPTED IN REV 2, DROPPED IN REV 3.** Numbered margin turns,
   "each addressable and re-enterable."

   The number was never given an address. No jump, no `Cmd+[n]`, no
   copy-link-to-turn was ever specified, so the raise shipped a decoration that
   claimed to be a mechanism. It was also expensive: a screen reader either
   announces "12" before every turn as noise or hides it, in which case the
   addressability does not exist for that user at all. And a number carrying no
   content does nothing for recall — "which turn had the migration script" stays
   in the user's head either way.

   Two options were on the table: build the addressing to justify the number, or
   delete it. **Deleted.** If turn addressing is wanted later it returns as a
   feature with a real mechanism, not as a margin ornament.

---

## 5. Surface architecture

```
app  (one continuous instrument face — no gutters anywhere)
├── control column (replaces the 64px icon rail) · pinned, never moves
└── deck
    ├── chat region     · primary   · LIVE · re-registers to full surface
    ├── tasks region    · secondary · DORMANT · no signal on this input
    └── weather region  · secondary · DORMANT · no signal on this input
```

- The dashboard **replaces** the greeting-and-quick-starts home.
- Regions are registry-driven (`src/components/panels.tsx`), so a fourth region
  is a data entry plus an optional body component, not surgery.
- Regions **abut**; they are divided by seam and surface tone, never by a gap.
  Nothing on this face floats.
- **Only chat expands**, by the re-registration described under Motion — the
  control column pinned, the secondary regions translating off, the chat
  region's left edge fixed.

### Dormant regions, not fabricated content

Tasks and weather have no data source. The plan's first draft invented
plausible task rows and a temperature reading, then disclaimed them in a
footnote — demo-ware that made the landing surface two-thirds fictional and put
the honesty burden on a caption nobody reads.

They are instead **instruments with no signal on that input**: the region, its
legend, and its readout structure are fully and precisely drawn, and the
reading is simply at rest. A short line names what would appear here and what
it is waiting on.

This is the more Braun answer as well as the more honest one — a well-drawn
dormant state beats a populated fake one — and it dissolves the labelling
problem completely, because there is no invented data left to disclaim. Neither
region makes a network call, so the local-and-private principle stays
unamended.

### Landmarks and the accessibility tree

The gapless face removes gutters, which were the only non-visual boundary
between regions. Nothing replaced them, and structure carried by surface tone
does not exist in the accessibility tree at all. Landmarks are therefore part
of the layout spec, not a build-time discovery:

- Control column is `<nav aria-label="Navigation">`.
- The deck is `<main>`.
- Each region is `<section aria-labelledby>` pointing at its own legend, so the
  engraved label is also the accessible name.
- Dormant regions carry `aria-disabled` and are not in the tab order. They are
  not buttons, because they do not do anything.

---

## 5.1 The chat surface

Rev 2 specified an instrument face and went silent at the point where the
product is actually used. The chat surface is roughly 70% of the pixels a user
looks at, and "restyle the chat surface" was one unelaborated row in the build
plan. Left that way it would have been built by re-deriving the incumbent and
repainting it in Braun tokens, which is the category default in new colours.

### The reading field

One measure, 68ch, on `Display field`. The thread is the one place the panel
world gets out of the way: no frame, no inner border, no card. The region's
own seam is the only edge.

### Turns: bounded by tone, never by a container

The brief asked for transparent Maia responses and minimal unnecessary
containers. The face already has a grouping law — seam plus surface tone — so
the turn uses it rather than inventing a second one.

| | Assistant turn | User turn |
|---|---|---|
| Ground | `Display field` (the page tone) | `Raised control` |
| Edge | none | 1px seam, full width of the measure |
| Radius | none | 2px |
| Width | full measure | full measure |
| Alignment | flush left | flush left, **not** right-aligned |
| Label | "Maia" as text | none |

The assistant turn has no container at all — its prose sits directly on the
page tone, which is what "transparent" has to mean if it means anything. The
user turn is distinguished by being *slightly raised*, the way a pressed key
sits proud of a panel face. Neither is a bubble.

**The "Maia" label stays as rendered text.** It is the assistant turn's
accessible name and, once the container is gone, its only non-visual
distinction. "Minimal unnecessary containers" may not take it. A turn whose
role is carried by surface tone alone does not exist for a screen reader.

This supersedes two undocumented decisions already made in the token layer:
`--user-message-width: 100%` (correct, now recorded) and `--message-user-bg`
(now `Raised control`, not a filled orange bubble).

### The five statuses

Every status gets a specified treatment. Rev 2 named none of them.

**`thinking` — the most-seen state in the product.** The backend returns one
complete JSON response, so there is no progress to report and any bar would be
fiction. Show what is true instead:

> `Maia · CPU · 0:14`

A Meta-step readout under the turn's label: the model, the inference path when
known, and a tabular-figure clock counting up from send. This is determinate,
honest, and native to the world — instruments show elapsed time and never fake
progress. It is also the most product-specific detail available anywhere in
this brief: a local client that reads `CPU · 0:22` while it thinks is telling a
truth no hosted assistant can tell.

At 20 seconds the reassurance line from the startup screen appears beneath it,
in the same voice, so both of the product's waits speak one language. The clock
reads from the same source as the abort controller so the two cannot drift.
When streaming lands, the clock is **replaced** by streaming text, not
supplemented by it.

**`streaming`** — text arrives; the clock is gone. No cursor artifact, no
typewriter simulation.

**`complete`** — the turn's action row appears: copy, regenerate, model name.
Actions are Label step, secondary tone, and become fully toned on hover or
focus. They do not appear on hover alone, which would hide them from keyboard
and touch.

**`stopped`** — a Meta-step line reading that generation was stopped. Not
italic, not apologetic. The user did this deliberately and the interface should
not flinch.

**`error`** — Danger tone on text and icon only, no filled tint, no bordered
container; the §3 colour law applies here and the incumbent's tinted row goes.
**Retry survives** as a real control on the Label step — it is the entire
recovery path. Error copy names the problem and the recovery and claims nothing
it does not know: the incumbent's "The connection dropped" is asserted for
every thrown error including ones that are not connection failures, and it is
replaced with wording that does not diagnose what it cannot see.

### The composer

A flat input module on `Raised control`, 2px radius, 1px seam, sitting at the
foot of the region. Not a floating pill, no shadow, no blur.

- **Esc stops an in-flight turn.** Rev 2 specified no keyboard path to the stop
  control, which is mouse-only in the incumbent. The state a user most wants to
  escape had no key.
- The disabled attachment button **is removed** rather than restyled. A
  permanently dead control in the most reachable slot, tooltipped "not
  supported yet", is chrome for a feature that does not exist. It returns when
  the backend has an attachment contract.
- Enter sends, Shift+Enter breaks. Unchanged.

### Markdown inside the panel world

- **Code blocks** are recessed display windows — the one place a dark field
  appears in the light theme, which is consistent with how a real panel treats
  a readout. Mono is confined here.
- **Tables** use hairline rules and tabular figures, no zebra striping and no
  filled header row.
- **Lists** keep the marker column; no filled or rounded list items.
- **Blockquote** is a 2px left seam, no tint, no background.

### Empty state

Neither document owned the first screen of a new conversation. It belongs to
the chat surface: the composer, and the quick starts that PRODUCT.md parks
here. They are set as plain rows in the panel's own vocabulary — seam-separated
and flush — not as a grid of suggestion cards, which is the incumbent's
card-everything pattern in a new palette.

### Session honesty

Conversations live in React state and are destroyed by a reload. Neither
document acknowledged this anywhere in the experience, and Cmd+R is muscle
memory.

A standing Meta-step line sits in the control column's history region, in the
same voice the dormant readouts invented:

> Held in memory for this session. Stored history is coming.

A standing condition gets a standing line, not a toast. This also settles a
question the plan had left open: while nothing persists, **temporary chat is a
distinction without a difference**, and that stays true until the backend owns
history.

### Reaching chat directly

The dashboard sits between the user and the only working surface. Every launch
routing through an instrument panel that is two-thirds at rest is a cost paid
by the person who opened the app to talk to a model. The control column's chat
control goes straight to the expanded surface, skipping the re-registration.
The dashboard is where you land, not a toll.

### Preserved without change

Backend contracts (`/api/chat`, `/api/health`), the ports-and-adapters
boundary, startup orchestration and its `/orchestrator/*` endpoints, the
three-stage startup ceremony, chat behavior (abort, regenerate, retry, edit),
preferences persistence, Cmd/Ctrl+K and Cmd/Ctrl+B, temporary chat as a
feature and a term, and all product terminology.

**One inherited decision made explicit:** `MaiaMark` doubles as the in-thread
thinking indicator. That is a brand commitment for the startup ceremony and was
never a decision for the thread. It stays, at 17px beside the "Maia" label, but
the elapsed readout — not the mark — carries the status. A brand mark animating
is decoration; a clock counting is information.

---

## 6. Build plan and current state

| # | Step | Status |
|---|---|---|
| 1 | Archivo swap + token layer rewrite | **done** |
| 2 | Dashboard panel system | **done** |
| 3 | Panel-grows-into-page expansion | **done** |
| 4 | Chat surface, composer, overlays, startup restyle (§5.1) | **done** |
| 5 | Direction contract in markup, build verify, detector, finish review, DESIGN.md | **done** |

Changed on disk so far: `src/styles/global.css`, `theme-light.css`,
`theme-dark.css` rewritten; `src/components/panels.tsx` added; Archivo added to
`package.json`. **No component logic has been touched yet**, so the app is
currently in a broken intermediate state — the new tokens are live but the
old chat/shell/composer CSS still expects glass and gradients.

**All three recorded contradictions are cleared.** `panels.tsx` renders dormant
readouts with no fabricated data; `--panel-gap` is `0px` at every density and
`--legend-size` is 11px; the tinted error row is gone along with
`--danger-tint` itself.

**Naming debt to clear in the same pass.** `--composer-glass` and
`--accent-gradient` survive as names while §3 bans blur and gradients;
`--accent-gradient` currently holds a flat hex. Names outlive materials, and
the next contributor reads a name as permission. Rename to `--composer-face`
and `--accent-fill` when the component CSS is rewritten.

**One product-surface ruling.** The control column replaces the 64px rail, and
the profile block goes with it: the hardcoded name and the "Sign out" row that
toasts "Accounts arrive after the preview" are both removed. In a local-only
product with no account, a sign-out affordance actively misleads about where
data goes. Preferences moves to the control column foot on its own.

**Still on disk, still contradictory.** `design-system/maia/MASTER.md` specifies
a violet and pink palette against this document's Braun panel. PRODUCT.md
records it as non-binding, and the design detector's loader does not currently
resolve it — but two conflicting design systems in one repository is a trap for
the next contributor or tool that does resolve it.

---

## 7. Open risks — the honest list

These are the places this plan is most likely to be wrong. A red team should
start here.

1. **Cozy is the weakest link.** Braun is precise and restrained; "cozy" is
   warm and forgiving. If the pale ABS reads institutional rather than
   domestic, the brief fails on its first adjective. Mitigation is stock
   warmth and generous leading, which is not yet proven.
2. **Panel metaphor vs. a text-heavy surface.** Ninety-plus percent of this app
   is prose. An instrument face is built for controls and readouts, not for
   reading. The display-window framing may fight the thread.
3. **Invented affordances.** "True button geometry" is one step from custom
   controls that behave subtly wrong — the exact Operate-mode failure mode.
   The line between molded-panel character and reinvented form controls is not
   yet drawn.
4. **Familiarity.** This was flagged on its own card: Rams → Apple is where
   most attempts at "Apple-like" land. The result may be competent and
   unsurprising.
5. **Two dormant regions out of three.** The honesty problem is solved, but the
   composition problem is not: two-thirds of the landing surface is at rest.
   Drawn well this reads as an instrument awaiting input; drawn poorly it reads
   as an unfinished app. This is now a craft risk rather than an ethical one.
6. **Density system survival.** Snug/Default/Roomy must keep working across an
   entirely new geometry, and tight panel radii leave less room to express
   density than the old rounded world did.
7. **Equal light/dark is expensive.** Two genuinely-authored themes double the
   contrast and state-vocabulary surface. Dark charcoal ABS with orange is
   also closer to the near-black-plus-accent cluster than the light theme is.
8. **The startup ceremony is pinned but its world changed.** It must stay
   recognizable as the same moment while being rebuilt in a different material
   language.
9. **No comps.** This harness has no image generation, so the build is
   code-led. Ambition rides on the written contract and is audited in behavior
   at the finish review, with no approved image to measure against.

Risks introduced by the Rev 2 revision:

10. **A gapless face has no fallback separator.** With gutters gone, region
    boundaries rest entirely on seam contrast and surface tone. In the light
    theme those tones sit close together (`#CFCCC3` against `#EDEBE5`, roughly
    a 4% luminance step), and if the seam is too quiet the deck reads as one
    undifferentiated slab. **Still open** — this is the highest-priority
    unknown for the build, and the one thing screenshots would settle fastest.
11. **~~"One orange at a time" has no enforcement.~~** **Closed in Rev 3** by
    the precedence order and demoted-expression table in §3.
12. **Banning the legend from menus leaves a hole.** The 13px Label step in a
    secondary tone is the named substitute. **Still unproven**, but now at
    least specified rather than implied.

Risks that remain after Rev 3, and one the revision created:

13. **§5.1 is a specification, not a proof.** Whether an assistant turn with no
    container reads as a distinct turn — especially through a long response
    with code blocks, tables, and lists — cannot be settled on paper. Tone
    alone may not be enough separation, and the fallback (a hairline rule above
    each turn) is a container by another name.
14. **The elapsed readout could read as latency shaming.** `CPU · 0:47` is
    honest, and honest can also be uncomfortable when the number is large. It
    may make a slow local model feel slower than an unmarked wait does.
15. **Two dormant regions and a direct-to-chat path may hollow the dashboard.**
    §5.1 lets users skip straight to chat. If most launches take that path, the
    dashboard becomes a surface nobody looks at — which is an argument for
    shipping it with one region, raised as an open question and not yet
    decided.

---

## 8. Revision log

**Rev 2 — red-team critique applied.** A critique-only pass reviewed this plan
for places the design was still rendering in a safe, familiar dialect rather
than committing to its own world. All five findings were adopted.

| # | Finding | Change |
|---|---|---|
| 1 | Deck was an admin-template grid; "panel" was a rename of "card" | §3 Materials, §5 — continuous face, regions abut, gap goes to zero |
| 2 | Three semantic hues is Material's colour system in Braun clothing | §3 Colour — orange rationed to one lit thing at a time; success and danger demoted to text and icon only |
| 3 | Placeholder panels fabricated content | §5 — dormant readouts replace invented tasks and temperature; no data left to disclaim |
| 4 | Type was named, not designed; tracked caps used as general label voice | §3 Type — six-step scale at ~1.15, weight-before-size rule, legend confined to the panel face |
| 5 | Expansion as written was a Material container transform | §3 Motion — face re-registers; control column pinned, chat's left edge fixed, only the right edge travels |

Findings 2 and 4 were flagged at review time as judgment calls rather than
clear defects, and were adopted on the user's instruction. The trade in 2 is
real: stripping semantic colour to text-and-icon is a genuine usability cost in
an Operate surface, and risk 11 is its residue.

The direction itself survived the critique unchanged. What the review found was
execution drifting toward the category default, not a wrong world.

**Rev 3 — Impeccable critique applied.** A dual-agent critique scored the chat
experience **22/40 (Acceptable)** with 4 of 8 cognitive-load checks failing.
The verdict was split: the visual world scored strongly and product-specific,
the chat experience scored 1s and 2s on every state, error, and recovery
heuristic — the signature of a plan that designed a look and called it a
redesign. Snapshot at
`.impeccable/critique/2026-08-18T06-13-23Z__direction-md.md`.

All findings were acted on.

| Severity | Finding | Change |
|---|---|---|
| P0 | The chat experience was unspecified — 70% of the pixels, one build-plan row | **§5.1 written**: reading field, turn treatment, all five statuses, composer, markdown, empty state |
| P0 | "Position on a fixed track" made the thinking state unbuildable — no position exists in a single JSON response | §4.2 corrected to "show elapsed, never fake progress"; §5.1 specifies the `Maia · CPU · 0:14` readout |
| P1 | Conversations die on reload, unacknowledged anywhere | §5.1 Session honesty — a standing line, not a toast; temporary chat conceded as currently a distinction without a difference |
| P2 | "One orange at a time" had no precedence order | §3 precedence table: in-flight > focused > selected, each with a specified demoted expression and a named neutral focus ring |
| P3 | §4.1 and the legend ban collided with no arbitration | §4.1 bounded to switch-position value sets; menus and the model picker exempted |
| — | Turn numbers: "addressable" with no address | **§4.5 dropped**, at the user's direction, rather than building addressing to justify it |
| a11y | Turn role carried by paint alone | "Maia" label protected as the turn's accessible name |
| a11y | Gapless face removed the only non-visual boundary | §5 Landmarks: `nav`, `main`, `section aria-labelledby` on the legend |
| a11y | One signal fill for both themes; no contrast standard | Per-theme fills with named ink; explicit contrast rule in §3 |
| a11y | 10px load-bearing legend | Raised to 11px |
| a11y | Esc did nothing during a wait | §5.1 composer: Esc stops an in-flight turn |
| UX | Dashboard was mandatory transit to the only working surface | §5.1: direct-to-chat path from the control column |
| UX | Permanently disabled attachment button in the most reachable slot | Removed until a backend contract exists |
| — | `chat.css` tinted error row; naming debt; profile block; italic outside the type system | §3 italic rule; §6 contradictions list extended; profile block and sign-out removed |

**On the detector's clean pass.** `detect.mjs` returned zero findings, and that
result carries almost no weight: it runs degraded here (`htmlparser2`,
`css-select`, `css-tree`, `domutils` all missing), token indirection hides every
`font-family` behind `var(--sans)`, the design-system loader does not resolve,
and the registry has **no rule for `backdrop-filter` or gradients at all**. The
prohibitions this plan leans on hardest cannot be mechanically verified by the
tool that will be run at the finish. Treat a green detector as evidence of
nothing in particular.

# Runar — Frontend spec

Source: `runar-prd.md` v1.0 (2026-10-28). Art direction from the `design-taste-frontend` skill:
the public page was dealt **"The page is the object"** (seed 844222107, palette "Navy on white",
type Bricolage Grotesque); the app screens were dealt **"Accent ladder"** (seed 1734038918) with the
page's palette and type kept. Both sheets live in `.taste-skill/`.

---

## 1. Who it is for, and what each page drives

Runar is for people who already train and want the record to count: the casual runner who wants a
streak nobody can reset, the competitor who wants a public leaderboard, the community lead who runs a
challenge for their group, and the skeptic who wants to check a record against the chain. Most of them
open it **on a phone, at the gym or at the end of a run**, for under a minute. The landing page is read
once, on any device, by someone deciding whether to connect a wallet.

| Page | File | The one question it answers | The one action it drives |
| --- | --- | --- | --- |
| Landing | `index.html` | What is this, and why on-chain? | **Log a workout** (opens the Log screen) |
| Log | `app/log.html` | What did I just do, and what will it earn? | **Sign and log** (one transaction) |
| Dashboard | `app/index.html` | Is my streak alive today? | **Log today's workout** |
| Leaderboard | `app/leaderboard.html` | Where do I stand, and is it real? | **Open an athlete's record** |
| Challenges | `app/challenges.html` | What can I join right now? | **Join** (one transaction) |
| Challenge | `app/challenge.html?id=` | Who is winning, and how long is left? | **Join**, or **Close challenge** after the end day |
| Athlete record | `app/athlete.html?a=` | Does this record hold up? | **Replay from events** (re-derive streak and points in the browser) |

Build order follows the PRD's first flow (land → log → see streak → compete → verify):
Landing → Log → Dashboard → Leaderboard → Challenges → Challenge → Athlete record.

---

## 2. Visual direction

### Thesis

**The race bib.** A bib is the one printed thing every athlete has worn: a number, a name, safety-pin
holes, and it belongs to one effort. Runar gives every workout a number that never changes (its
on-chain `workoutId`), so on the landing page the workout *is* a bib: a filled white panel with a big
number, pin holes, and the tx hash where the sponsor bar would be. The name supplies the second half:
*Runar* comes from runes, records carved to outlast the carver. One runestone photograph carries that
idea; nothing else on the page is "Norse".

The app keeps the bib only where it carries meaning: a confirmed workout shows its number as a small
bib, and the streak is drawn as the **day chain** (one cell per UTC day, linked while consecutive),
which is the product's signature element.

### Palette (exact values)

One ground, one ink, one accent. Tangerine is the bib's print colour and stays small.

| Role | Value | Use |
| --- | --- | --- |
| `--bg` | `#ffffff` | Page ground, bib paper |
| `--surface` | `#f4f4f2` | One tone step: sheets, wells, inputs on white |
| `--ink` | `#1f2b4d` | All running text, headings, the primary button fill |
| `--muted` | `#5d6479` | Secondary text (darkened from the sheet's `#6a7186` to hold 4.5:1 on `--surface`) |
| `--accent` | `#f7941d` | Marks only: bib number, flame, today's chain cell, chart series, active nav icon. Never text on white (2.2:1) |
| `--accent-ink` | `#9a4f00` | When an accent word must be read as text (5.6:1 on white) |
| `--field-1` | `#05070a` | Dark field: hero ground under the photo, the scoring section |
| `--field-1-ink` | `#ffffff` | Text on field-1 |
| `--field-2` | `#e3e1dc` | Warm grey field: footer, FAQ cards |

App ladder (tints of the accent, area work only): `--tint-50 #fff5e9`, `--tint-100 #fde6c8`,
`--tint-200 #fbcd91`. App neutrals: ground `#f6f7f9` (one step toward the navy), surface `#ffffff`,
border `#e6e8ee`, rule `#f0f1f4`, control `#cfd3dd`. Status: positive `#247b50` (pill `#dcfae5` /
`#04250e`), negative `#c4242a` (pill `#ffedea` / `#831c1e`).

### Type — one family

**Bricolage Grotesque** (Google Fonts, 400/500/600), for everything. Display: 600, tracking -0.04em,
leading 0.92, sentence case. Text: 400, leading 1.5. Figures: `font-variant-numeric: tabular-nums`
wherever numbers align or update.

| Step | Landing | App |
| --- | --- | --- |
| Display | `clamp(2.75rem, 1.4rem + 6vw, 7.5rem)` (hero, bib number) | — |
| Head | `clamp(2rem, 1.3rem + 3.2vw, 4rem)` | 24px page title |
| Lead | `clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem)` | 30px answer figure, 18px card title |
| Body | `clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)` | 14px (16px on phone inputs) |
| Small | `clamp(0.8125rem, 0.79rem + 0.1vw, 0.875rem)` | 12px labels |

### Spacing scale

4px base: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192`. Landing outer margin `clamp(16px, 2.5vw, 32px)`,
section gap 128–192px desktop, 96px phone. App: one gutter of 16px, card padding 20px, canvas padding
29px desktop / 16px phone, touch targets 44px.

### Shape

Square corners on the landing page (bibs, sheets, slips have real edges: notches, pin holes, zigzag and
scallop cuts with `clip-path`). App: radius 8 on cards, 6 on controls, 999 on pills. Buttons are flat,
one fill, decided once: square on the landing, 6px in the app.

### Motion rules

- Transform and opacity only. Every move has a `prefers-reduced-motion` fallback that keeps content.
- **Landing signature:** the hero bib is pinned while the first photographs pass, then shrinks to a
  stub in the bottom-left corner (sticky + scroll-linked scale). One held stage only.
- **Landing entrances:** heading → text → picture, staggered 70ms, rising 24px, once per section.
  Content is visible without script.
- **Landing moving picture:** one muted looping marathon clip with a poster frame.
- **App:** no entrances. Motion is feedback: press (scale .98), hover, focus ring, sheet open, a row
  arriving. One earned moment: after a log confirms, the streak figure rolls to its new value and the
  new chain cell fills (400ms, ease-out); points count up.
- Durations 120ms (feedback), 240ms (sheets), 400–600ms (the confirm moment). Easing
  `cubic-bezier(.2,.7,.2,1)`.

---

## 3. Pages and sections, in build order, with copy

All numbers in the app come from one dataset (`src/data.js`) whose aggregates are computed with the
same rules as `Runar.sol` (§3.0), so every figure that appears twice agrees.

### 3.0 Rules the frontend mirrors

Taken from PRD §5.1. The exact point weights are not in the PRD; these are the v1 proposal the UI is
built against and must be matched to the contract before launch.

- `dayId = floor(timestamp / 86400)`: days roll over at **00:00 UTC**.
- Streak: next day → +1; same day → unchanged; any gap → back to 1. Best streak kept.
- Base points = activity weight × 10-minute buckets (`ceil(durationSec / 600)`).
  Weights: Run 3, Swim 4, Cycle 2, Gym 2, Walk 1.
- Streak multiplier = `min(1.0 + 0.1 × (streak − 1), 2.0)`; points = `floor(base × multiplier)`.
- Note ≤ 140 characters. Duration > 0. Distance optional (hidden for Gym).

### 3.1 Landing — `index.html`

**Nav (inside the bib, no bar):** wordmark "Runar" · Leaderboard · Challenges · How it works · button
**Log a workout**.

**Hero — the bib over the night track.** Full-bleed night photograph of a running track (Tokyo,
CC0) at `brightness(.7)`. Centred: a white bib panel with four pin holes, the `h1`, the bib number and
the facts.

- h1: **Every workout, on the record**
- Bib number: **214** (small beside it: "workoutId")
- Facts on the bib: "Run · 5.02 km · 27:41" / "Day 14 of a streak" / "tx 0x8c1f…a3e9 · BOT Chain"
- Supporting line: "Runar logs your runs, rides, swims and gym sessions on BOT Chain. Your streak and
  points are public, checkable by anyone, and still yours if this app ever closes."
- Action: **Log a workout** · text link "See this week's leaderboard"
- Caption (14px, bottom-left of the bib): "Track beside the National Stadium, Tokyo"

**Intro — "Apps close. Records stay."** Heading left, three-line note right:
"Trackers shut down, accounts get banned, streaks reset when a product team decides. A workout written
to BOT Chain stays where you put it." Facts row (from the PRD):

- **1 transaction** — per workout: type, duration, distance, a note
- **140 characters** — for the note, stored on-chain
- **2× cap** — on the streak multiplier
- **0 tokens** — points are a score, not an asset

Photograph under the facts' right half: runners with race bibs at a 24-hour ultramarathon, night.

**How it works — "From run to record" (the itinerary slip).** Left: heading and paragraph
"Logging takes one signature. The contract does the counting: your streak, your points and every
challenge you joined update in the same transaction." Below it, the Sofia marathon photograph.
Right: a paper slip with a zigzag foot:

- *Once* — Connect a wallet · 1 signature · Set a display name (optional) · 1 transaction
- *Every workout* — Pick run, walk, gym, cycle or swim · Duration and distance · A note, up to 140
  characters · Sign and send · about a second
- *Automatically* — Streak checked against yesterday · in-contract · Points credited · in-contract ·
  Challenge standings updated · in-contract
- Inverted last row: "A workout nobody can delete · 1 tx"

**Live thing — "How a streak counts."** A strip of the last 14 UTC days. Tap a day to log or unlog a
workout on it (a second tap adds a same-day second workout). Under the strip, computed with the
contract's rule: current streak, best streak, points multiplier, and the rule that fired on the last
tap ("Next day: streak 6 → 7", "Same day: second workout, streak unchanged", "Gap of 2 days: streak back
to 1"). Starts with a real-looking 9-day run broken once. Without script: the strip renders as a static
example with its numbers. Keyboard: each day is a toggle button.

**Showcase — "Carved, not saved" (square plate, spare text).** Left: square crop of runestone U 614,
Torsätra (CC BY-SA 4.0). Right: tabs "Profile · Streaks · Challenges" switching a short text each:

- Profile: "Total workouts, current streak, best streak, points and last workout day are kept by the
  contract. Anyone can read them with one call."
- Streaks: "No server decides your streak. The contract compares today's day number with your last
  one, and that is the whole rule."
- Challenges: "Join with one transaction. Every matching workout you log in the window counts
  automatically. After the end day anyone can close it, and the contract names the winner."

Title: **Carved, not saved**. Description: "Runar is named for runes: marks cut into stone so the record
outlived the person who made it. This one was carved in Uppland around the year 1050 and can still be
read." Two action cells: **Read an athlete's record** (ink) · **Browse challenges** (tone).

**List — "The scoring sheet" (printed menu sheet).** Dark field. Left: three tipped-in plates (pool,
road cyclists, bench press) with captions. Right: a scalloped paper sheet:

- *Points per 10 minutes* — Swim 4 · Run 3 · Cycle 2 · Gym 2 · Walk 1
- *Streak multiplier* — Day 1 ×1.0 · Day 2 ×1.1 · Day 3 ×1.2 · Day 5 ×1.4 · Day 8 ×1.7 · Day 11 and on ×2.0
- *Challenge goals* — Most distance · Most workouts · Reach a count (e.g. 3 workouts in 7 days)
- Foot: "Points are a non-transferable score. There is no token and nothing to cash out."

**Challenges — "Genesis 7-day."** The muted marathon clip runs full width as the section's picture.
Beside it, an interface fragment (`data-ui`) of the Genesis challenge's final standings, built from the
same dataset as the app: "Log 3 or more workouts in 7 days · closed · 9 athletes". Heading: **Open
competition**. Text: "Anyone can create a challenge and anyone can join. Nothing is staked and the
contract never holds funds. Standings are kept as you log, so closing never replays history."

**FAQ — "What Runar is not" (tabbed index cards).**

- *Tokens* — Is there a token or move-to-earn reward? — No. Points are a counter in the contract with
  no transfer function. They rank you; they are not worth anything.
- *Privacy* — Who can see my workouts? — Everyone. Everything you log is public by design. Log what you
  are happy to be seen; Runar never asks for medical data.
- *Cheating* — Can someone fake a workout? — Entries are self-reported. What can't be faked is the
  history: every workout has a timestamp and a transaction anyone can check.
- *Escrow* — Do challenges hold money? — No. Challenges are stake-free. The contract never holds funds.
- *Wearables* — Does it sync with Strava or Apple Health? — Not in v1. Signed imports are planned for
  a later milestone.
- *Cost* — What does a workout cost to log? — Only gas, paid in BOT: about 0.002 BOT a workout, roughly
  2 cents at BOT's price in November 2026. A year of daily workouts comes to about 0.7 BOT.

**CTA — a sentence with a blank.** "Put my first [run ▾] on the **record**" — the blank is an activity
select; "record" is the submit button (accent block) and opens `app/log.html?type=<activity>`. Line
under: "You'll connect a wallet, then sign one transaction."

**Footer — the mark, built large.** "RUNAR" knocked out of five navy and tangerine blocks of differing
heights. Links: App (Dashboard, Log, Leaderboard, Challenges) · Project (How it works, Scoring, FAQ) ·
Chain (BOT Chain, Contract, Explorer). Credits line for every photograph and the clip.
"Runar · built on BOT Chain · 2026".

### 3.2 Log — `app/log.html`

Title: **Log a workout**. Subline: "Day 15 starts when you log today. Streak resets at 00:00 UTC."

- **Not connected:** the form shows, disabled, with a single panel at its head: "Connect a wallet to
  log. Your address is your athlete ID." **Connect wallet**.
- **Activity:** five large toggle buttons — Run, Walk, Gym, Cycle, Swim (drawn outline glyphs, labels
  always visible).
- **Duration:** hours / minutes / seconds number fields, plus quick picks "20 min · 30 min · 45 min ·
  1 h".
- **Distance (km):** decimal field; hidden for Gym with the line "Gym sessions log duration only."
- **Note:** textarea, counter "0 / 140", tied with `aria-describedby`.
- **Preview panel (the answer):** "+57 points" large; breakdown "Run 3 × 4 buckets = 12 base · ×1.4 day
  5 multiplier"; streak outcome "Streak 4 → 5" or "Second workout today: streak stays 5"; "Counts toward:
  Runs only: most distance (14 days)".
- **Submit:** **Sign and log**. States: Waiting for signature → Confirming → Confirmed in 0.6 s, with
  the workout's bib (number, activity, tx hash linked to the explorer), the streak figure rolling up,
  the chain gaining a cell, and links "Back to dashboard" / "Log another".
- **Error:** "Transaction rejected in wallet. Nothing was logged." with Retry.

### 3.3 Dashboard — `app/index.html`

Title: the athlete's display name (or short address). Subline = the finding: "You haven't logged today.
9 h 12 m left to make it 15 days." or "Logged today. Streak is safe until 00:00 UTC tomorrow."
Primary: **Log today's workout**.

- **Streak block (largest):** flame mark + current streak "14 days" (30px), best streak, and the
  **day chain** of the last 28 UTC days, today outlined.
- **KPI strip (one container, 4 cells):** Points · Workouts · This week (minutes) · This week (km).
  Week = the 7 UTC days ending today; caption names it.
- **This week by day:** columns of minutes per day, today's bar in the accent.
- **Workout history:** last 6 rows — activity, date, duration, distance, points, tx link ("0x8c1f…" →
  explorer). "View all" → athlete record.
- **Rail:** "Your challenges" (rank and stat in each) and "Leaderboard this week" (you ±2 places).
- Empty (new wallet): frame kept, "No workouts yet. Your first log starts a 1-day streak." + Log.

### 3.4 Leaderboard — `app/leaderboard.html`

Title: **Leaderboard**. Subline: "Read live from the contract. Every row links to the workouts behind it."
Tabs: **Points** (all-time) · **Current streak** · **This week** (minutes). Your row is pinned at the
foot when off-screen. Columns: rank, athlete (display name + short address), the tab's figure, a
secondary figure (workouts / best streak / km), "Record" link. Search by name or address. Phone: two-
line rows.

### 3.5 Challenges — `app/challenges.html`

Title: **Challenges**. Primary: **Create challenge** (opens a sheet: name, start and end day, activities,
goal type and goal). Tabs: **Open** · **Upcoming** · **Closed**, with counts from the rows shown. Rows:
name, rule in words ("Runs only · most distance"), window ("Oct 22 – Nov 4 · 7 days left"), athletes,
your status ("Joined · 3rd" / **Join**). Closed rows show the winner.

### 3.6 Challenge — `app/challenge.html?id=`

Header card: name, rule, window, creator, athletes. Actions: **Join** (before close) or
**Close challenge** (anyone, after the end day; disabled before with "Closes after Nov 4, 00:00 UTC").
Closed: winner banner "Won by ama.lifts with 6 workouts". Body: standings table (rank, athlete, stat,
workouts counted, last counted), progress to the goal for count goals, and "How it's scored" in one
paragraph. Live countdown to the end day.

### 3.7 Athlete record — `app/athlete.html?a=`

Title: display name, address with copy. Profile figures exactly as `getProfile` returns them: total
workouts, current streak, best streak, points, last workout day (as a date and as its dayId). The day
chain for 28 days. Full workout list with tx links. **Replay from events**: recomputes streak, best
streak and points from the listed `WorkoutLogged` events in the browser and shows each against the
contract's value ("Points 1,284 · replayed 1,284 · match").

---

## 4. Components

| Component | Desktop | Phone (≤ 640px) |
| --- | --- | --- |
| Landing bib | 55% width centred over the photo, sticky, shrinks to a stub bottom-left | Full width minus 16px, 70svh; stub 120px |
| Itinerary slip | 460px in cols 7–11, zigzag foot | Full width, dots kept between label and value |
| Streak strip (live thing) | 14 day cells in a row, 56px each | 7 × 2 grid, 44px cells |
| Scoring sheet | 640px scalloped sheet beside plates | Full width minus 10px, plates after it |
| Index cards (FAQ) | Stacked, tabs stepping 150px | Tabs 120px stepping 48px |
| App shell | 224px sidebar + 64px top bar (ruled T-frame), wallet switcher at top-right | 52px top bar + bottom bar: Dashboard · Log · Ranks · Challenges |
| KPI strip | 4 cells split by 1px | 2 × 2 grid |
| Day chain | 28 cells, 20px, 4px gaps, linked while consecutive | 14 cells per row, two rows |
| Activity picker | 5 buttons in a row, 72px | 5 in a row at 64px, labels under glyphs |
| Tables | Rows 48px, numbers right-aligned, tabular | Two-line rows: identity + key figure, rest in grey line 2 |
| Tabs | Underline, 2px indicator on a 1px rule | Scroll sideways in their own row |
| Sheet (create challenge) | Right-side panel 440px | Full-screen sheet |
| Toast / confirm | Inline in the Log panel, never a modal | Same |
| Workout bib (app) | 120 × 84 white mini bib with accent number | Same |

---

## 5. Avoid

- A centred hero over a soft gradient with a pill badge ("Now live on BOT Chain") above it.
- Eyebrow labels, tiny letter-spaced uppercase captions, 01/02/03 numbering, monospace "crypto" text.
- Three icon-topped feature cards ("Permanent · Social · Verifiable"), or any row of identical cards.
- Neon-on-black "web3" styling, glows, glass panels, gradient text, purple or indigo.
- KPI tiles with icons in tinted circles, sparklines, or a green "+12%" on an account a week old.
- Invented proof: user counts, testimonials, partner logos. Day-one numbers are small and shown as such.
- Emoji, including a fire emoji for the streak: the flame is a drawn mark.
- Stock "athlete silhouette" art or fake app screenshots of grey bars.
- A floating pill nav, or a dark sidebar against a light canvas.

---

## 6. Open items before launch

- Done: the contract is live at `0x41782c0A753f5B2cde7c9e5bA814ABEC899489BD`, and `src/config.js` holds the RPC,
  explorer and chain ID confirmed from BOT Chain's docs. Point weights and the multiplier ladder (§3.0) match it.
- `src/data.js` reads the contract's events and caches them in the browser. First-visit load grows with chain age, so
  an indexer (PRD M3) will be needed as the record gets long.
- Connection is by injected wallet only (`src/wallet.js`), so a phone needs a wallet app's built-in browser.
- Add team wallets to `TEAM_WALLETS` in `src/config.js` when they join Genesis, so the leaderboard marks them.

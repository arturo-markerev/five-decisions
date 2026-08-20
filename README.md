# FIVE DECISIONS

**Play Smarter. Score Lower.**

A strategic golf caddie for one specific player: handicap 18, planning around a repeatable shot, not a best shot.

This is **not** a replacement for TheGrint. Official score, handicap and stats stay there. This app answers exactly one question:

> What is the smartest decision for this shot?

---

## Non-negotiables baked into the code

| Principle | Where it lives |
|---|---|
| Plan with **Planning Distance**, never Good Strike | `lib/dispersion-engine.ts` |
| Evaluate the **whole dispersion pattern**, not the center | `lib/dispersion-engine.ts`, `lib/decision-engine.ts` |
| Not conservative by default, not aggressive by default — optimize | `lib/decision-engine.ts` |
| A bad outcome is not a bad decision | `lib/round-stats.ts` (`decisionReview`) |
| No fake strokes-gained numbers, ever | `lib/distance-engine.ts` (`costBand`) |
| Nothing about a real course is invented | `data/courses/*.json` |

The engine is **deterministic** (no randomness, no API calls) so it runs offline and its recommendations are reproducible and testable.

---

## Status by phase

| Phase | Scope | State |
|---|---|---|
| 1 | Repo, types, mobile shell, PWA, localStorage, My Game, Play Mode | Done |
| 2 | Flag selector, laser, decision engine, risk engine | Done |
| 3 | Shot logging, putting, Tiger Five H18, score | Done |
| 4 | Round review, decision vs execution, learning, insights | Done |
| 5 | Course Builder | Form-based editor + reference image + live schematic. **Polygon drawing over an image is not built yet.** |
| 6 | Real data for Ventanas / Zibatá / San Miguel | Not started — waiting on your numbers |

**Ventanas ships with MOCK geometry** so the engine can be exercised end to end. Every hole is flagged `dataQuality: "MOCK"` and the UI says so. **Zibatá and San Miguel ship empty** — no yardages, hazards or greens were guessed. San Miguel's official name is marked `nameConfirmed: false`.

---

## Run it locally

Requires Node 18.18+ (Node 20 recommended). Node is **not** currently installed on this Mac — install it from https://nodejs.org or via Homebrew first.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Checks:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

---

## Install on the iPhone

1. Open the Vercel URL in **Safari** (not Chrome — only Safari can install PWAs on iOS).
2. Share → **Add to Home Screen**.
3. Launch from the Home Screen. It opens full screen with no browser chrome.
4. Play Mode keeps working with no signal: profile, courses, current round and the engine are all local.

---

## Architecture

```
app/
  page.tsx              Home — last round, Tiger Five, entry points
  play/                 Course → tee → hide score → start
  play/round/           Play Mode state machine (the whole round)
  courses/              Course list + ADD COURSE + confidence
  course-builder/       Desktop hole editor (Phase 5)
  my-game/              Handicap, clubs, distances, dispersion
  rounds/               History
  rounds/[id]/          Round review, Tiger Five report, decision vs execution
  insights/             Learning engine, sample bands, UPDATE MY GAME
  settings/             Hide Score default, theme, export / import

components/             HoleHeader HoleMap FlagSelector LaserInput
                        ClubRecommendation RiskBadge TigerFiveWidget
                        ShotResult PuttDistance PuttCaddie BottomNav

lib/
  decision-engine.ts    Which shot produces the lowest expected score
  risk-engine.ts        Where the ball ends up and what it costs
  dispersion-engine.ts  Deterministic weighted dispersion grid
  distance-engine.ts    H18 expected-strokes estimate (internal ranking only)
  putting-engine.ts     Objectives by steps
  tiger-five-engine.ts  The five error events, adapted for H18
  round-stats.ts        Stats, decision vs execution, coach report
  player-learning.ts    Per-club learning with sample-size protection
  course-learning.ts    Per course + hole learning, course confidence
  shot-flow.ts          Result → lie, penalty, correct-miss
  storage.ts            localStorage today, Supabase-shaped for later

data/courses/           ventanas.json  zibata.json  san-miguel.json
types/golf.ts           The whole domain model
tests/                  vitest
```

### The hole model

Holes are described in a **corridor model**, not lat/long:

- longitudinal axis = yards from the tee
- lateral axis = yards left (−) or right (+) of the fairway centre

A hazard is a band: `startDistanceFromTee → endDistanceFromTee`, `lateralStart → lateralEnd`, on a side. `CROSS` spans the whole hole (forced carry). This is enough for real strategy and it is something you can actually fill in from a yardage book or a Google Earth screenshot. Polygons are already in the type and get used when we have them.

---

## FIVE DECISIONS vs TIGER FIVE H18

- **FIVE DECISIONS** = strategy *before* the shot: keep the ball in play, respect risk, play your number, miss smart, avoid big numbers.
- **TIGER FIVE H18** = big-error control *after*: penalty, double+, three-putt, double short game, bad decision inside 150.

Tiger Five H18 is **adapted for a handicap 18 player**. These are not Tiger Woods' original numbers and the app never claims they are.

---

## Deploy

Push to `main` → Vercel builds and deploys. No environment variables, no database, no API keys.

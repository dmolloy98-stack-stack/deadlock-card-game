# Deadlock Card Game

## Where things live

- **Rules (master copy):** the Google Doc "Deadlock Card Game: Rules Draft",
  https://docs.google.com/document/d/1edwDQUn3-cXCgaMvpa3WL4LbzzBeSOuDyISLG1FrQCU/edit
  Read it before designing or coding any rule. Its "Working notes" and "Still open" sections hold the current plan.
- **Code:** this repository.
- An old `.odt` copy of the rules sits on the owner's desktop. It is a frozen backup marked outdated; ignore it.

## How the owner works

- Design moves in phases. Finish one phase, get the owner's sign-off, then start the next. Don't jump ahead.
- When a rule is decided, update the Google Doc: bump the version number in its title heading, and move the item out of "Still open".
- Numbers marked "(placeholder)" in the doc are guesses to tune in playtests, not decisions.
- The owner is a designer, not a programmer. Explain technical steps in plain words, and say what they need to do themselves.

## Design rules

- Everything is adapted from Deadlock. Hero kits follow each hero's current Deadlock abilities.
- Items follow Deadlock's real build paths (check the "Upgrades From" line on deadlock.wiki item pages). Most items have no component. Never invent same-color upgrade chains.
- Stats are priced on one budget: Health ÷ 2 + 2 × Gun + 2 × Spirit.

## Code plan (confirmed by the owner)

- Browser game first: plain HTML, CSS and TypeScript, built with Vite, rule tests in Vitest.
- Published as a GitHub Pages site: every push to `main` builds, tests and deploys it (`.github/workflows/deploy.yml`).
- Card data (heroes, items, camps, buffs, tunable rule numbers) in JSON files under `data/`, so numbers can be tuned without touching code.
- Keep the rules logic (`src/rules/`) separate from the display (`src/ui/`). The rules engine takes a game state and a move, and returns the new state plus a list of events; the display animates the events. The AI (`src/ai/`) picks from the same list of legal moves as the player. Dice and coins use a seeded random source so games can be replayed.
- First build: desktop layout, simple animations, no 3D, one player against a basic AI, the two 20-card test decks, placeholder camps and buffs, no Patron abilities. Multiplayer and a phone layout come later.

## Build steps

Each step needs the owner's sign-off before the next one starts.

0. Setup: tooling, blank page, Pages deploy. (done)
1. Core rules: setup, souls, deploying, items and upgrades, moving items, color bonuses, camps, combat, Down timers, winning. Plain hot-seat screen. (built, waiting for sign-off)
2. Real board: desktop layout, card visuals, clicks, simple animations.
3. Basic AI. This is the first playable version.
4. Midboss and Sinner's Sacrifice altars.
5. Abilities: unlocks, cooldowns, status effects, skillshots, then the six hero kits.

## Commands

- `npm install` once, then `npm run dev` to play locally, `npm test` for the rule tests, `npm run build` for the site.

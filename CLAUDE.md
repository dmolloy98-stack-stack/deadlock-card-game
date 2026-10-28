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

## Code plan (proposed, not yet confirmed by the owner)

- Browser game first: plain HTML, CSS and TypeScript.
- Card data (heroes, items, camps, buffs) in JSON files, so numbers can be tuned without touching code.
- Keep the rules logic separate from the display, so either can change on its own.
- First build: desktop layout, simple animations, no 3D, one player against a basic AI. Multiplayer and a phone layout come later.

# Deadlock Card Game

A one-on-one card game based on Deadlock. Each player is a Patron with three heroes, and builds them with items, buffs and camp cards from a mixed deck.

This is a fan made game with no affiliation with the actual Deadlock team. This is a passion project for creative fun

## Rules

The rules live in a Google Doc, not in this repository:
[Deadlock Card Game: Rules Draft](https://docs.google.com/document/d/1edwDQUn3-cXCgaMvpa3WL4LbzzBeSOuDyISLG1FrQCU/edit)

That doc is the master copy. When the rules and the code disagree, the doc wins.

## Play

Once GitHub Pages is switched on, the game is at https://dmolloy98-stack-stack.github.io/deadlock-card-game/ and updates every time `main` changes.

## Code

A browser game in HTML, CSS and TypeScript, built with Vite and tested with Vitest. Card data lives in JSON files. See `CLAUDE.md` for the build steps and how the work is organized.

To run it on your own computer (needs Node.js):

```bash
npm install
npm run dev
```

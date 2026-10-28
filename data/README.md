# Card data

Every number the game uses lives in these files, so they can be tuned without touching code.
Change a number, push it, and the game on the website updates. If a change breaks a rule
(for example a deck that isn't 20 cards), the automatic tests fail and the site isn't updated.

| File | What's in it |
|---|---|
| `rules.json` | Patron health, deck size and copy limit, opening hand, souls income (base + per turn, cap, second-player bonus), item slots, item tier costs, move cost, color bonus thresholds, free first deploy, hit-back fraction, death timers |
| `heroes.json` | The 6 heroes: stats, soul cost, main path |
| `items.json` | The 25 starter items: color, tier (the cost comes from the tier), stats, build path, card text, and the numbers in their effects |
| `camps.json` | Camp tiers: cost, damage, reward, first round playable. Placeholder. |
| `buffs.json` | Permanent buffs. Placeholder. |
| `decks/` | The two 20-card test decks: card id and number of copies |

Item text is what the player reads; `effects` is what the game does. When you change a number in an
effect (say Headshot Booster's +2), change the text to match.

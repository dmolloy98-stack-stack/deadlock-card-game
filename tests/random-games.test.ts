import { describe, expect, it } from "vitest";
import { applyAction, legalActions, RULES } from "../src/rules";
import { startGame } from "./helpers";

// Plays many games of random legal moves and checks that nothing breaks along the way.
describe("random games", () => {
  it("never crashes or breaks the basic limits", () => {
    let finished = 0;
    for (let seed = 1; seed <= 60; seed++) {
      let state = startGame(seed);
      let pick = seed;
      for (let step = 0; step < 1500 && state.phase !== "over"; step++) {
        const actions = legalActions(state);
        expect(actions.length).toBeGreaterThan(0);
        pick = (pick * 1103515245 + 12345) & 0x7fffffff;
        const action = actions[pick % actions.length];
        state = applyAction(state, action).state;
        for (const p of state.players) {
          expect(p.souls).toBeGreaterThanOrEqual(0);
          expect(p.hand.length + p.deck.length + p.discard.length + p.heroes.reduce((n, h) => n + h.items.length, 0)).toBe(RULES.deck.size);
          for (const h of p.heroes) {
            expect(h.items.length).toBeLessThanOrEqual(RULES.heroItemSlots);
            expect(h.damage).toBeGreaterThanOrEqual(0);
          }
        }
      }
      if (state.phase === "over") finished++;
    }
    expect(finished).toBeGreaterThan(0);
  }, 60_000);
});

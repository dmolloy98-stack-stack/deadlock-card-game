import { describe, expect, it } from "vitest";
import { legalActions, newGame } from "../src/rules";
import { P1_HEROES, P2_HEROES, play, startGame } from "./helpers";

describe("setup and turns", () => {
  it("deals 5 cards, then the first player draws 1 and gains 3 souls", () => {
    const state = startGame();
    expect(state.active).toBe(0);
    expect(state.players[0].hand).toHaveLength(6);
    expect(state.players[1].hand).toHaveLength(5);
    expect(state.players[0].souls).toBe(3);
    expect(state.players[0].deck).toHaveLength(14);
  });

  it("gives souls of 2 + turn number, capped at 8, and carries unspent souls over", () => {
    let state = startGame();
    const incomes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const before = state.players[0].souls;
      state = play(state, { type: "endTurn" }, { type: "endTurn" });
      incomes.push(state.players[0].souls - before);
    }
    expect(incomes).toEqual([4, 5, 6, 7, 8, 8, 8, 8]);
  });

  it("gives the second player +2 souls on their first turn only", () => {
    let state = play(startGame(), { type: "endTurn" });
    expect(state.players[1].souls).toBe(3 + 2);
    state = play(state, { type: "endTurn" }, { type: "endTurn" });
    expect(state.players[1].souls).toBe(5 + 4);
  });

  it("makes the first deploy free and charges full cost after that", () => {
    let state = startGame();
    state = play(state, { type: "deploy", hero: 2 });
    expect(state.players[0].souls).toBe(3);
    expect(legalActions(state)).not.toContainEqual({ type: "deploy", hero: 0 });
    state = play(state, { type: "endTurn" }, { type: "endTurn" }, { type: "endTurn" }, { type: "endTurn" });
    expect(state.players[0].souls).toBe(3 + 4 + 5);
    state = play(state, { type: "deploy", hero: 0 });
    expect(state.players[0].souls).toBe(12 - 5);
  });

  it("replays the same game from the same seed", () => {
    const config = { lineups: [P1_HEROES, P2_HEROES] as [string[], string[]], decks: ["gun-health", "spirit-health"] as [string, string], seed: 42 };
    expect(newGame(config).state).toEqual(newGame(config).state);
    expect(newGame({ ...config, seed: 43 }).state.players[0].hand).not.toEqual(newGame(config).state.players[0].hand);
  });

  it("doesn't let a hero attack on the turn it is deployed", () => {
    let state = play(startGame(), { type: "deploy", hero: 0 }, { type: "startCombat" });
    expect(legalActions(state).some((a) => a.type === "attack")).toBe(false);
    state = play(state, { type: "endTurn" }, { type: "endTurn" }, { type: "startCombat" });
    expect(legalActions(state)).toContainEqual({ type: "attack", hero: 0, target: { kind: "patron" } });
  });
});

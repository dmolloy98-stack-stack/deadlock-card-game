import { describe, expect, it } from "vitest";
import { legalActions } from "../src/rules";
import { equip, field, give, hero, play, startGame } from "./helpers";

describe("camps", () => {
  it("costs souls, damages the hero and pays the reward, without exhausting it", () => {
    const state = startGame();
    field(state, 0, 0);
    const card = give(state, 0, "camp-t1");
    const after = play(state, { type: "playCamp", card, hero: 0 });
    expect(after.players[0].souls).toBe(3 - 1 + 3);
    expect(after.players[0].soulsEarned).toBe(3 + 3);
    expect(hero(after, 0, 0).damage).toBe(3);
    expect(hero(after, 0, 0).status).toBe("ready");
  });

  it("unlocks higher tiers in later rounds", () => {
    let state = startGame();
    field(state, 0, 0);
    const t2 = give(state, 0, "camp-t2");
    expect(legalActions(state)).not.toContainEqual({ type: "playCamp", card: t2, hero: 0 });
    state = play(state, { type: "endTurn" }, { type: "endTurn" });
    expect(legalActions(state)).toContainEqual({ type: "playCamp", card: t2, hero: 0 });
  });

  it("can put a hero Down, and Fortitude halves camp damage", () => {
    const state = startGame();
    state.players[0].souls = 10;
    state.turn = 5;
    field(state, 0, 0);
    field(state, 0, 2);
    equip(state, 0, 2, "fortitude");
    const a = give(state, 0, "camp-t3");
    const b = give(state, 0, "camp-t3");
    const after = play(state, { type: "playCamp", card: a, hero: 0 }, { type: "playCamp", card: b, hero: 0 });
    expect(hero(after, 0, 0).status).toBe("down");
    const c = give(after, 0, "camp-t3");
    expect(hero(play(after, { type: "playCamp", card: c, hero: 2 }), 0, 2).damage).toBe(5);
  });
});

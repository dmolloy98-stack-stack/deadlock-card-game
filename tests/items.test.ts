import { describe, expect, it } from "vitest";
import { colorInvestment, heroStats, legalActions } from "../src/rules";
import { equip, field, give, hero, play, startGame } from "./helpers";

describe("items", () => {
  it("pays the item's cost and adds its stats", () => {
    const state = startGame();
    field(state, 0, 0);
    const card = give(state, 0, "extended-magazine");
    const after = play(state, { type: "playItem", card, hero: 0 });
    expect(after.players[0].souls).toBe(2);
    expect(heroStats(after, { player: 0, hero: 0 }).gun).toBe(5 + 2);
  });

  it("holds at most 3 items per hero", () => {
    const state = startGame();
    field(state, 0, 0);
    equip(state, 0, 0, "extra-health", "extra-health", "extra-regen");
    const card = give(state, 0, "extended-magazine");
    expect(legalActions(state)).not.toContainEqual({ type: "playItem", card, hero: 0 });
  });

  it("upgrades along a build path for the cost difference, even with 3 items, and discards the component", () => {
    const state = startGame();
    state.players[0].souls = 10;
    field(state, 0, 2);
    equip(state, 0, 2, "extended-magazine", "extra-health", "extra-regen");
    const colossus = give(state, 0, "colossus");
    const after = play(state, { type: "upgradeItem", card: colossus, hero: 2, slot: 1 });
    expect(after.players[0].souls).toBe(10 - 7);
    expect(hero(after, 0, 2).items.map((i) => i.cardId)).toEqual(["extended-magazine", "colossus", "extra-regen"]);
    expect(after.players[0].discard.map((c) => c.cardId)).toContain("extra-health");
  });

  it("never upgrades into an item that doesn't list the component", () => {
    const state = startGame();
    state.players[0].souls = 10;
    field(state, 0, 0);
    equip(state, 0, 0, "extended-magazine");
    const card = give(state, 0, "headhunter");
    expect(legalActions(state).some((a) => a.type === "upgradeItem")).toBe(false);
    expect(legalActions(state)).toContainEqual({ type: "playItem", card, hero: 0 });
  });

  it("moves an item for half its cost, rounded up", () => {
    const state = startGame();
    state.players[0].souls = 5;
    field(state, 0, 0);
    field(state, 0, 1);
    equip(state, 0, 0, "extended-magazine", "fortitude");
    let after = play(state, { type: "moveItem", fromHero: 0, slot: 0, toHero: 1 });
    expect(after.players[0].souls).toBe(4);
    after = play(after, { type: "moveItem", fromHero: 0, slot: 0, toHero: 1 });
    expect(after.players[0].souls).toBe(2);
    expect(hero(after, 0, 1).items.map((i) => i.cardId)).toEqual(["extended-magazine", "fortitude"]);
  });

  it("gives color bonuses to every hero at 4, 10 and 20 souls invested", () => {
    const state = startGame();
    field(state, 0, 0);
    field(state, 0, 1);
    equip(state, 0, 0, "extended-magazine", "titanic-magazine");
    expect(colorInvestment(state.players[0]).gun).toBe(3);
    expect(heroStats(state, { player: 0, hero: 1 }).gun).toBe(4);
    equip(state, 0, 0, "extended-magazine");
    expect(heroStats(state, { player: 0, hero: 1 }).gun).toBe(4 + 2);
    equip(state, 0, 1, "glass-cannon");
    expect(heroStats(state, { player: 0, hero: 2 }).gun).toBe(3 + 5);
    equip(state, 0, 1, "glass-cannon");
    expect(heroStats(state, { player: 0, hero: 2 }).gun).toBe(3 + 12);
  });

  it("gives a buff's stats permanently without using a slot", () => {
    const state = startGame();
    field(state, 0, 0);
    equip(state, 0, 0, "extra-health", "extra-health", "extra-regen");
    const card = give(state, 0, "buff-gun");
    const after = play(state, { type: "playBuff", card, hero: 0 });
    expect(heroStats(after, { player: 0, hero: 0 }).gun).toBe(6);
    expect(hero(after, 0, 0).items).toHaveLength(3);
  });
});

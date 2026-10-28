import { describe, expect, it } from "vitest";
import { legalActions } from "../src/rules";
import type { GameState } from "../src/rules";
import { equip, field, hero, play, startGame } from "./helpers";

/** Player 1's Haze (5 Gun, 16 Health) and Abrams, against player 2's Mina, Grey Talon and Victor, in player 1's combat step. */
function combat(setup?: (s: GameState) => void): GameState {
  const state = startGame();
  field(state, 0, 0);
  field(state, 0, 2);
  field(state, 1, 0);
  field(state, 1, 1);
  field(state, 1, 2);
  setup?.(state);
  return play(state, { type: "startCombat" });
}

const attackHero = (hero: number, target: number) => ({ type: "attack" as const, hero, target: { kind: "hero" as const, hero: target } });
const attackPatron = (hero: number) => ({ type: "attack" as const, hero, target: { kind: "patron" as const } });

describe("combat", () => {
  it("makes the defender hit back for half its Gun, rounded up", () => {
    // Haze (5 Gun) attacks Grey Talon (3 Gun): deals 5, takes 2 (3 / 2 rounded up).
    const after = play(combat(), attackHero(0, 1));
    expect(hero(after, 1, 1).damage).toBe(5);
    expect(hero(after, 0, 0).damage).toBe(2);
  });

  it("matches the rules doc example: a 3 Gun hero attacking a 6 Gun hero takes 3 back", () => {
    const after = play(combat((s) => { s.players[1].heroes[1].buffs.gun = 3; }), attackHero(2, 1));
    expect(hero(after, 1, 1).damage).toBe(3);
    expect(hero(after, 0, 2).damage).toBe(3);
  });

  it("lets an exhausted hero hit back", () => {
    const after = play(combat((s) => { s.players[1].heroes[1].status = "exhausted"; }), attackHero(0, 1));
    expect(hero(after, 0, 0).damage).toBe(2);
  });

  it("lets the defender block a Patron attack, and the blocker deals full Gun damage", () => {
    let state = play(combat(), attackPatron(0));
    expect(state.pending).toEqual({ kind: "block", attacker: 0 });
    state = play(state, { type: "block", hero: 2 });
    expect(hero(state, 1, 2).damage).toBe(5);
    expect(hero(state, 0, 0).damage).toBe(2);
    expect(state.players[1].patronHealth).toBe(100);
  });

  it("lets each hero block only once per turn", () => {
    let state = play(combat(), attackPatron(0), { type: "block", hero: 2 }, attackPatron(2));
    expect(legalActions(state)).not.toContainEqual({ type: "block", hero: 2 });
    state = play(state, { type: "block", hero: null });
    expect(state.players[1].patronHealth).toBe(97);
  });

  it("hits the Patron when the defender has no Ready heroes", () => {
    const state = combat((s) => {
      for (const h of s.players[1].heroes) h.status = "exhausted";
    });
    const after = play(state, attackPatron(0));
    expect(after.pending).toBeNull();
    expect(after.players[1].patronHealth).toBe(95);
  });

  it("ends the game when a Patron reaches 0", () => {
    const state = combat((s) => {
      s.players[1].patronHealth = 5;
      for (const h of s.players[1].heroes) h.status = "exhausted";
    });
    const after = play(state, attackPatron(0));
    expect(after.phase).toBe("over");
    expect(after.winner).toBe(0);
    expect(legalActions(after)).toEqual([]);
  });

  it("clears hero damage at the end of the turn", () => {
    const after = play(combat(), attackHero(0, 1), { type: "endTurn" });
    expect(hero(after, 1, 1).damage).toBe(0);
    expect(hero(after, 0, 0).damage).toBe(0);
  });
});

describe("Down and respawn", () => {
  it("puts a hero Down for 2 turns the first time, and it returns at the start of its owner's turn", () => {
    let state = combat((s) => { s.players[1].heroes[1].buffs.health = -12; });
    state = play(state, attackHero(0, 1));
    expect(hero(state, 1, 1).status).toBe("down");
    state = play(state, { type: "endTurn" });
    expect(hero(state, 1, 1).status).toBe("down");
    state = play(state, { type: "endTurn" });
    expect(hero(state, 1, 1).status).toBe("down");
    state = play(state, { type: "endTurn" });
    expect(hero(state, 1, 1).status).toBe("ready");
    expect(hero(state, 1, 1).items).toEqual([]);
  });

  it("adds a turn to the timer for each earlier death", () => {
    let state = combat((s) => {
      s.players[1].heroes[1].buffs.health = -12;
      s.players[1].heroes[1].deaths = 2;
    });
    state = play(state, attackHero(0, 1));
    expect(hero(state, 1, 1).downTimer).toBe(4);
  });

  it("keeps a Down hero's items", () => {
    let state = combat((s) => {
      s.players[1].heroes[1].buffs.health = -12;
      equip(s, 1, 1, "extra-spirit");
    });
    state = play(state, attackHero(0, 1));
    expect(hero(state, 1, 1).items.map((i) => i.cardId)).toEqual(["extra-spirit"]);
  });
});

describe("item effects in combat", () => {
  it("Headshot Booster adds damage only against heroes", () => {
    const state = combat((s) => equip(s, 0, 0, "headshot-booster"));
    expect(hero(play(state, attackHero(0, 1)), 1, 1).damage).toBe(6 + 2);
  });

  it("Swift Striker strikes first, so a defender it puts Down never hits back", () => {
    const state = combat((s) => {
      equip(s, 0, 0, "swift-striker");
      s.players[1].heroes[1].buffs.health = -9;
    });
    const after = play(state, attackHero(0, 1));
    expect(hero(after, 1, 1).status).toBe("down");
    expect(hero(after, 0, 0).damage).toBe(0);
  });

  it("Bullet Armor takes 2 off each hit, to a minimum of 1", () => {
    const state = combat((s) => equip(s, 1, 1, "bullet-armor"));
    expect(hero(play(state, attackHero(0, 1)), 1, 1).damage).toBe(3);
  });

  it("Colossus halves all damage, rounded down", () => {
    const state = combat((s) => equip(s, 1, 1, "colossus"));
    expect(hero(play(state, attackHero(0, 1)), 1, 1).damage).toBe(2);
  });

  it("Metal Skin prevents the first attack each turn", () => {
    let state = combat((s) => equip(s, 1, 1, "metal-skin"));
    state = play(state, attackHero(0, 1));
    expect(hero(state, 1, 1).damage).toBe(0);
    expect(hero(state, 0, 0).damage).toBe(2);
    state = play(state, attackHero(2, 1));
    expect(hero(state, 1, 1).damage).toBe(3);
  });

  it("Suppressor makes the hero fighting it deal 2 less, including in that fight", () => {
    const state = combat((s) => equip(s, 1, 1, "suppressor"));
    expect(hero(play(state, attackHero(0, 1)), 1, 1).damage).toBe(3);
  });

  it("Mystic Vulnerability adds 2 to every hit on that hero for the rest of the turn", () => {
    let state = combat((s) => equip(s, 0, 0, "mystic-vulnerability"));
    state = play(state, attackHero(0, 1), attackHero(2, 1));
    expect(hero(state, 1, 1).damage).toBe(5 + 2 + 3 + 2);
  });

  it("Spirit Shredder Bullets gives 2 souls for putting a hero Down", () => {
    const state = combat((s) => {
      equip(s, 0, 0, "spirit-shredder-bullets");
      s.players[1].heroes[1].buffs.health = -8;
    });
    const before = state.players[0].souls;
    expect(play(state, attackHero(0, 1)).players[0].souls).toBe(before + 2);
  });

  it("Burst Fire lets the hero attack again after a kill, once per turn", () => {
    let state = combat((s) => {
      equip(s, 0, 0, "burst-fire");
      s.players[1].heroes[1].buffs.health = -8;
      s.players[1].heroes[0].buffs.health = -8;
    });
    state = play(state, attackHero(0, 1));
    expect(hero(state, 0, 0).status).toBe("ready");
    state = play(state, attackHero(0, 0));
    expect(hero(state, 1, 0).status).toBe("down");
    expect(hero(state, 0, 0).status).toBe("exhausted");
  });

  it("Headhunter removes all damage from the hero when it gets a kill", () => {
    const state = combat((s) => {
      equip(s, 0, 0, "headhunter");
      s.players[1].heroes[1].buffs.health = -8;
    });
    expect(hero(play(state, attackHero(0, 1)), 0, 0).damage).toBe(0);
  });

  it("Return Fire adds 3 to a block", () => {
    let state = combat((s) => equip(s, 1, 2, "return-fire"));
    state = play(state, attackPatron(0), { type: "block", hero: 2 });
    expect(hero(state, 0, 0).damage).toBe(2 + 3);
  });

  it("Extra Regen removes 3 damage at the start of combat", () => {
    const state = startGame();
    field(state, 0, 2);
    equip(state, 0, 2, "extra-regen");
    state.players[0].heroes[2].damage = 5;
    expect(hero(play(state, { type: "startCombat" }), 0, 2).damage).toBe(2);
  });

  it("Torment Pulse makes its owner pick an enemy hero for half its Spirit at the start of combat", () => {
    let state = startGame();
    field(state, 0, 0);
    field(state, 1, 1);
    equip(state, 0, 0, "torment-pulse");
    state = play(state, { type: "startCombat" });
    expect(legalActions(state)).toEqual([{ type: "tormentPulse", target: 1 }]);
    state = play(state, { type: "tormentPulse", target: 1 });
    // Haze: 1 Spirit + 3 from the item + 2 purple color bonus (4 souls invested) = 6, halved = 3.
    expect(hero(state, 1, 1).damage).toBe(3);
    expect(state.pending).toBeNull();
  });

  it("Cursed Relic exhausts an enemy hero so it can't block, and it skips its next ready", () => {
    let state = startGame();
    field(state, 0, 0);
    field(state, 1, 1);
    equip(state, 0, 0, "cursed-relic");
    state = play(state, { type: "useCursedRelic", hero: 0, slot: 0, target: 1 }, { type: "startCombat" });
    state = play(state, attackPatron(0));
    expect(state.pending).toBeNull();
    state = play(state, { type: "endTurn" });
    expect(hero(state, 1, 1).status).toBe("exhausted");
  });
});

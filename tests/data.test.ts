import { describe, expect, it } from "vitest";
import { BUFFS, CAMPS, DECKS, HEROES, ITEMS, RULES, cardKind, getItem } from "../src/rules";

describe("card data", () => {
  it("prices every hero on the stat budget: Health / 2 + 2 x Gun + 2 x Spirit", () => {
    for (const hero of HEROES) {
      const { health, gun, spirit } = hero.stats;
      const points = health / 2 + 2 * gun + 2 * spirit;
      const expected = 22 + 3 * (hero.cost - 5) - (hero.passive ? 2 : 0);
      expect(points, hero.name).toBe(expected);
    }
  });

  it("has the 25 starter items: 9 orange, 7 green, 9 purple", () => {
    expect(ITEMS).toHaveLength(25);
    expect(ITEMS.filter((i) => i.color === "gun")).toHaveLength(9);
    expect(ITEMS.filter((i) => i.color === "health")).toHaveLength(7);
    expect(ITEMS.filter((i) => i.color === "spirit")).toHaveLength(9);
  });

  it("only builds items from real, cheaper components", () => {
    for (const item of ITEMS) {
      if (!item.buildsFrom) continue;
      const component = getItem(item.buildsFrom);
      expect(component.tier, item.name).toBeLessThan(item.tier);
    }
  });

  it("uses unique card ids", () => {
    const ids = [...HEROES, ...ITEMS, ...CAMPS, ...BUFFS].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds legal test decks", () => {
    for (const deck of DECKS) {
      const counts = Object.entries(deck.cards);
      const size = counts.reduce((sum, [, n]) => sum + n, 0);
      expect(size, deck.name).toBe(RULES.deck.size);
      for (const [cardId, copies] of counts) {
        expect(() => cardKind(cardId), cardId).not.toThrow();
        expect(copies, cardId).toBeLessThanOrEqual(RULES.deck.maxCopies);
      }
    }
  });
});

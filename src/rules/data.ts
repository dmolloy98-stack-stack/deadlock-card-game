// Loads the card data from data/*.json and looks cards up by id.

import rulesJson from "../../data/rules.json";
import heroesJson from "../../data/heroes.json";
import itemsJson from "../../data/items.json";
import campsJson from "../../data/camps.json";
import buffsJson from "../../data/buffs.json";
import gunHealthDeck from "../../data/decks/gun-health.json";
import spiritHealthDeck from "../../data/decks/spirit-health.json";
import type { BuffCard, CampCard, DeckList, HeroCard, ItemCard, RulesConfig } from "./types";

export const RULES = rulesJson as RulesConfig;
export const HEROES = heroesJson as HeroCard[];
export const ITEMS = itemsJson as ItemCard[];
export const CAMPS = campsJson as CampCard[];
export const BUFFS = buffsJson as BuffCard[];
export const DECKS = [gunHealthDeck, spiritHealthDeck] as DeckList[];

export type CardKind = "item" | "buff" | "camp";

function byId<T extends { id: string }>(list: T[]): Map<string, T> {
  return new Map(list.map((c) => [c.id, c]));
}

const heroMap = byId(HEROES);
const itemMap = byId(ITEMS);
const campMap = byId(CAMPS);
const buffMap = byId(BUFFS);
const deckMap = byId(DECKS);

function lookup<T>(map: Map<string, T>, id: string, what: string): T {
  const found = map.get(id);
  if (!found) throw new Error(`Unknown ${what}: ${id}`);
  return found;
}

export const getHero = (id: string) => lookup(heroMap, id, "hero");
export const getItem = (id: string) => lookup(itemMap, id, "item");
export const getCamp = (id: string) => lookup(campMap, id, "camp");
export const getBuff = (id: string) => lookup(buffMap, id, "buff");
export const getDeck = (id: string) => lookup(deckMap, id, "deck");

export function cardKind(cardId: string): CardKind {
  if (itemMap.has(cardId)) return "item";
  if (buffMap.has(cardId)) return "buff";
  if (campMap.has(cardId)) return "camp";
  throw new Error(`Unknown card: ${cardId}`);
}

export function cardName(cardId: string): string {
  switch (cardKind(cardId)) {
    case "item":
      return getItem(cardId).name;
    case "buff":
      return getBuff(cardId).name;
    case "camp":
      return getCamp(cardId).name;
  }
}

export function itemCost(itemId: string): number {
  return RULES.itemTierCosts[getItem(itemId).tier - 1];
}

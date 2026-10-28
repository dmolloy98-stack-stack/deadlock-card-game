// A hero's current stats: base card + buffs + items + color bonuses.

import { getHero, getItem, itemCost, RULES } from "./data";
import { COLORS } from "./types";
import type { Color, GameState, HeroRef, HeroState, ItemEffect, PlayerState, Stats } from "./types";

export function hero(state: GameState, ref: HeroRef): HeroState {
  return state.players[ref.player].heroes[ref.hero];
}

export function inPlay(h: HeroState): boolean {
  return h.status === "ready" || h.status === "exhausted";
}

/** Souls invested in each color: the printed cost of every item on the player's side. */
export function colorInvestment(player: PlayerState): Record<Color, number> {
  const invested: Record<Color, number> = { gun: 0, health: 0, spirit: 0 };
  for (const h of player.heroes) {
    for (const item of h.items) invested[getItem(item.cardId).color] += itemCost(item.cardId);
  }
  return invested;
}

export function colorBonus(invested: number): number {
  let bonus = 0;
  for (const step of RULES.colorBonuses) if (invested >= step.invested) bonus = step.bonus;
  return bonus;
}

const COLOR_STAT: Record<Color, keyof Stats> = { gun: "gun", health: "health", spirit: "spirit" };

export function heroStats(state: GameState, ref: HeroRef): Stats {
  const player = state.players[ref.player];
  const h = player.heroes[ref.hero];
  const stats = { ...getHero(h.heroId).stats };
  for (const key of Object.keys(stats) as (keyof Stats)[]) stats[key] += h.buffs[key];
  for (const item of h.items) {
    const itemStats = getItem(item.cardId).stats;
    for (const key of Object.keys(itemStats) as (keyof Stats)[]) stats[key] += itemStats[key] ?? 0;
  }
  const invested = colorInvestment(player);
  for (const color of COLORS) stats[COLOR_STAT[color]] += colorBonus(invested[color]);
  return stats;
}

export function effects(h: HeroState): ItemEffect[] {
  return h.items.flatMap((item) => getItem(item.cardId).effects);
}

export function findEffects<T extends ItemEffect["type"]>(h: HeroState, type: T): Extract<ItemEffect, { type: T }>[] {
  return effects(h).filter((e): e is Extract<ItemEffect, { type: T }> => e.type === type);
}

export function hasEffect(h: HeroState, type: ItemEffect["type"]): boolean {
  return findEffects(h, type).length > 0;
}

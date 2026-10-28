// Turns each legal move into "click this, then click that".
// A source is what you pick up first (a hand card, one of your heroes, an item);
// a target is where it goes (a hero or a Patron), or "none" for moves that need no target.

import { other } from "../rules";
import type { Action, GameState } from "../rules";

export type Key = string;

export const heroKey = (player: number, hero: number): Key => `hero:${player}:${hero}`;
export const patronKey = (player: number): Key => `patron:${player}`;
export const cardKey = (uid: number): Key => `card:${uid}`;
export const itemKey = (player: number, hero: number, slot: number): Key => `item:${player}:${hero}:${slot}`;
export const NONE: Key = "none";

export interface Move {
  index: number;
  action: Action;
  source: Key | null;
  target: Key;
}

export function toMoves(state: GameState, actions: Action[]): Move[] {
  const me = state.active;
  const enemy = other(me);
  return actions.map((action, index) => {
    const move = (source: Key | null, target: Key): Move => ({ index, action, source, target });
    switch (action.type) {
      case "deploy":
        return move(heroKey(me, action.hero), NONE);
      case "playItem":
      case "upgradeItem":
      case "playBuff":
      case "playCamp":
        return move(cardKey(action.card), heroKey(me, action.hero));
      case "moveItem":
        return move(itemKey(me, action.fromHero, action.slot), heroKey(me, action.toHero));
      case "useCursedRelic":
        return move(itemKey(me, action.hero, action.slot), heroKey(enemy, action.target));
      case "attack":
        return move(
          heroKey(me, action.hero),
          action.target.kind === "patron" ? patronKey(enemy) : heroKey(enemy, action.target.hero),
        );
      case "block":
        return move(null, action.hero === null ? NONE : heroKey(enemy, action.hero));
      case "tormentPulse":
        return move(null, heroKey(enemy, action.target));
      case "startCombat":
      case "endTurn":
        return move(null, NONE);
    }
  });
}

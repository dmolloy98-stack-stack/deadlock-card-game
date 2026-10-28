import { applyAction, newGame } from "../src/rules";
import type { Action, GameState, HeroStatus, PlayerId } from "../src/rules";

export const P1_HEROES = ["haze", "wraith", "abrams"];
export const P2_HEROES = ["mina", "grey-talon", "victor"];

/** A new game where player 1 (index 0) goes first. */
export function startGame(seed = 1): GameState {
  return newGame({ lineups: [P1_HEROES, P2_HEROES], decks: ["gun-health", "spirit-health"], seed, firstPlayer: 0 }).state;
}

export function play(state: GameState, ...actions: Action[]): GameState {
  for (const action of actions) state = applyAction(state, action).state;
  return state;
}

/** Puts a card straight into a player's hand and returns its uid. */
export function give(state: GameState, player: PlayerId, cardId: string): number {
  const uid = state.nextUid++;
  state.players[player].hand.push({ uid, cardId });
  return uid;
}

/** Puts a hero into play as if it had been deployed on an earlier turn. */
export function field(state: GameState, player: PlayerId, hero: number, status: HeroStatus = "ready"): void {
  const h = state.players[player].heroes[hero];
  h.status = status;
  h.deployedOnTurn = 0;
}

export function equip(state: GameState, player: PlayerId, hero: number, ...itemIds: string[]): void {
  for (const cardId of itemIds) {
    state.players[player].heroes[hero].items.push({ uid: state.nextUid++, cardId, usedThisTurn: false });
  }
}

export function hero(state: GameState, player: PlayerId, index: number) {
  return state.players[player].heroes[index];
}

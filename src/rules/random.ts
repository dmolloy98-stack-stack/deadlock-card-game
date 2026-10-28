// Seeded random numbers (mulberry32), so a game can be replayed from its seed.
// The generator's state lives in GameState.rng.

import type { GameState } from "./types";

export function nextRandom(state: GameState): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(state: GameState, maxExclusive: number): number {
  return Math.floor(nextRandom(state) * maxExclusive);
}

export function shuffle<T>(state: GameState, list: T[]): void {
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(state, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
}

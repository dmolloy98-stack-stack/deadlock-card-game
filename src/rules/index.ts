// The rules engine's public surface. Nothing in src/rules touches the page.

export * from "./types";
export * from "./data";
export { newGame, roundOf } from "./turn";
export type { GameConfig } from "./turn";
export { legalActions, applyAction, actingPlayer, actionCost, canAttack } from "./actions";
export { heroStats, colorInvestment, colorBonus, inPlay } from "./stats";
export { other, attackDamage, hitBackDamage, blockDamage, tormentPulseDamage } from "./combat";

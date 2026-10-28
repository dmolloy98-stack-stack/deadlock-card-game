// Damage, going Down, attacks, blocks and start-of-combat triggers.

import { RULES } from "./data";
import { findEffects, hasEffect, hero, heroStats, inPlay } from "./stats";
import type { GameEvent, GameState, HeroRef, PlayerId } from "./types";

/**
 * attack: an attacker's damage landing on the hero it attacked or on a blocker.
 * hitBack: a defender hitting back. block: a blocker's damage to the attacker.
 * spirit: damage from items and (later) abilities, which never causes a hit back.
 */
export type DamageKind = "attack" | "hitBack" | "block" | "camp" | "spirit";

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

export function dealDamage(
  state: GameState,
  events: GameEvent[],
  target: HeroRef,
  amount: number,
  kind: DamageKind,
  source: string,
): void {
  const h = hero(state, target);
  if (!inPlay(h) || amount <= 0) return;
  if (kind === "attack" && hasEffect(h, "preventAttackOncePerTurn") && !h.turn.metalSkinUsed) {
    h.turn.metalSkinUsed = true;
    events.push({ type: "damagePrevented", target, source: "Metal Skin" });
    return;
  }
  let damage = amount + h.turn.vulnerable;
  if (kind === "attack" || kind === "hitBack" || kind === "block") {
    for (const armor of findEffects(h, "armor")) damage = Math.max(armor.min, damage - armor.amount);
  }
  if (kind === "camp" && hasEffect(h, "campDamageHalved")) damage = Math.floor(damage / 2);
  if (hasEffect(h, "damageHalved")) damage = Math.floor(damage / 2);
  if (damage <= 0) return;
  h.damage += damage;
  events.push({ type: "heroDamaged", target, amount: damage, source });
}

export function healHero(state: GameState, events: GameEvent[], target: HeroRef, amount: number, source: string): void {
  const h = hero(state, target);
  const healed = Math.min(h.damage, amount);
  if (healed <= 0) return;
  h.damage -= healed;
  events.push({ type: "heroHealed", target, amount: healed, source });
}

/** Puts every hero whose damage has reached its Health Down, all at once. Returns who went Down. */
export function checkDowns(state: GameState, events: GameEvent[]): HeroRef[] {
  const downed: HeroRef[] = [];
  for (const player of [0, 1] as PlayerId[]) {
    state.players[player].heroes.forEach((h, index) => {
      const ref = { player, hero: index };
      if (inPlay(h) && h.damage >= heroStats(state, ref).health) downed.push(ref);
    });
  }
  const { base, perPreviousDeath, cap } = RULES.deathTimer;
  for (const ref of downed) {
    const h = hero(state, ref);
    h.downTimer = Math.min(cap, base + perPreviousDeath * h.deaths);
    h.deaths += 1;
    h.status = "down";
    h.damage = 0;
    h.skipNextReady = false;
    events.push({ type: "heroDown", target: ref, timer: h.downTimer });
  }
  return downed;
}

/** Triggers on a hero that just put an enemy hero Down. */
function onKill(state: GameState, events: GameEvent[], killer: HeroRef): void {
  const h = hero(state, killer);
  const player = state.players[killer.player];
  for (const effect of findEffects(h, "soulsOnKill")) {
    player.souls += effect.amount;
    player.soulsEarned += effect.amount;
    events.push({ type: "soulsGained", player: killer.player, amount: effect.amount, reason: "Spirit Shredder Bullets" });
  }
  if (!inPlay(h)) return;
  if (hasEffect(h, "healOnKill")) healHero(state, events, killer, h.damage, "Headhunter");
  if (
    hasEffect(h, "attackAgainOnKill") &&
    h.status === "exhausted" &&
    !h.turn.burstFireUsed &&
    state.active === killer.player &&
    state.phase === "combat"
  ) {
    h.turn.burstFireUsed = true;
    h.status = "ready";
    events.push({ type: "extraAttack", player: killer.player, hero: killer.hero });
  }
}

const sameRef = (a: HeroRef, b: HeroRef) => a.player === b.player && a.hero === b.hero;

/** Resolves Downs after a fight between two heroes and credits each kill to the other fighter. */
function finishFight(state: GameState, events: GameEvent[], one: HeroRef, two: HeroRef): void {
  const downed = checkDowns(state, events);
  if (downed.some((r) => sameRef(r, two))) onKill(state, events, one);
  if (downed.some((r) => sameRef(r, one))) onKill(state, events, two);
}

/** Suppressor and Mystic Vulnerability, applied as two heroes start a fight. */
function applyFightEffects(state: GameState, attacker: HeroRef, defender: HeroRef, attackOnHero: boolean): void {
  const a = hero(state, attacker);
  const d = hero(state, defender);
  for (const e of findEffects(a, "suppress")) d.turn.suppressed = Math.max(d.turn.suppressed, e.amount);
  for (const e of findEffects(d, "suppress")) a.turn.suppressed = Math.max(a.turn.suppressed, e.amount);
  if (attackOnHero) {
    for (const e of findEffects(a, "vulnerability")) d.turn.vulnerable = Math.max(d.turn.vulnerable, e.amount);
  }
}

/** The damage an attacker deals. Bonuses "when this hero attacks an enemy hero" only count against a hero target. */
export function attackDamage(state: GameState, attacker: HeroRef, target: "hero" | "patron" | "blocker"): number {
  const a = hero(state, attacker);
  const stats = heroStats(state, attacker);
  let damage = stats.gun;
  if (target === "hero") {
    for (const e of findEffects(a, "bonusVsHero")) damage += e.amount;
    for (const _ of findEffects(a, "spiritStrike")) damage += Math.floor(stats.spirit / 2);
  }
  return Math.max(0, damage - a.turn.suppressed);
}

export function hitBackDamage(state: GameState, defender: HeroRef): number {
  const d = hero(state, defender);
  return Math.max(0, Math.ceil(heroStats(state, defender).gun * RULES.hitBackFraction) - d.turn.suppressed);
}

export function blockDamage(state: GameState, blocker: HeroRef): number {
  const b = hero(state, blocker);
  let damage = heroStats(state, blocker).gun;
  for (const e of findEffects(b, "returnFire")) damage += e.amount;
  return Math.max(0, damage - b.turn.suppressed);
}

/** Two heroes damage each other; with Swift Striker the attacker goes first and the other side answers only if it survives. */
function exchange(
  state: GameState,
  events: GameEvent[],
  attacker: HeroRef,
  defender: HeroRef,
  outgoing: number,
  answer: number,
  answerKind: DamageKind,
): void {
  const answerSource = answerKind === "hitBack" ? "hit back" : "block";
  if (hasEffect(hero(state, attacker), "firstStrike")) {
    dealDamage(state, events, defender, outgoing, "attack", "attack");
    const d = hero(state, defender);
    if (d.damage < heroStats(state, defender).health) dealDamage(state, events, attacker, answer, answerKind, answerSource);
  } else {
    dealDamage(state, events, defender, outgoing, "attack", "attack");
    dealDamage(state, events, attacker, answer, answerKind, answerSource);
  }
}

export function attackHero(state: GameState, events: GameEvent[], attackerIndex: number, defenderIndex: number): void {
  const attacker = { player: state.active, hero: attackerIndex };
  const defender = { player: other(state.active), hero: defenderIndex };
  applyFightEffects(state, attacker, defender, true);
  const outgoing = attackDamage(state, attacker, "hero");
  const back = hitBackDamage(state, defender);
  exchange(state, events, attacker, defender, outgoing, back, "hitBack");
  finishFight(state, events, attacker, defender);
}

export function damagePatron(state: GameState, events: GameEvent[], player: PlayerId, amount: number): void {
  if (amount <= 0) return;
  const p = state.players[player];
  p.patronHealth -= amount;
  events.push({ type: "patronDamaged", player, amount });
  if (p.patronHealth <= 0) {
    state.phase = "over";
    state.pending = null;
    state.winner = other(player);
    events.push({ type: "gameOver", winner: other(player) });
  }
}

export function canBlock(state: GameState, ref: HeroRef): boolean {
  const h = hero(state, ref);
  return h.status === "ready" && !h.turn.blocked;
}

export function resolveBlock(state: GameState, events: GameEvent[], attackerIndex: number, blockerIndex: number | null): void {
  const attacker = { player: state.active, hero: attackerIndex };
  const defenderPlayer = other(state.active);
  if (blockerIndex === null) {
    events.push({ type: "notBlocked", player: defenderPlayer });
    damagePatron(state, events, defenderPlayer, attackDamage(state, attacker, "patron"));
    return;
  }
  const blocker = { player: defenderPlayer, hero: blockerIndex };
  hero(state, blocker).turn.blocked = true;
  events.push({ type: "blocked", player: defenderPlayer, hero: blockerIndex });
  applyFightEffects(state, attacker, blocker, false);
  const outgoing = attackDamage(state, attacker, "blocker");
  const back = blockDamage(state, blocker);
  exchange(state, events, attacker, blocker, outgoing, back, "block");
  finishFight(state, events, attacker, blocker);
}

export function tormentPulseDamage(state: GameState, source: HeroRef): number {
  return Math.floor(heroStats(state, source).spirit / 2);
}

export function resolveTormentPulse(state: GameState, events: GameEvent[], sourceIndex: number, targetIndex: number): void {
  const source = { player: state.active, hero: sourceIndex };
  const target = { player: other(state.active), hero: targetIndex };
  dealDamage(state, events, target, tormentPulseDamage(state, source), "spirit", "Torment Pulse");
  const downed = checkDowns(state, events);
  if (downed.some((r) => sameRef(r, target))) onKill(state, events, source);
}

// Every move a player can make: which moves are legal right now, and what each one does.
// The display and the AI both pick from legalActions(), so neither can break a rule.

import { cardKind, getBuff, getCamp, getHero, getItem, itemCost, RULES } from "./data";
import {
  attackHero,
  canBlock,
  checkDowns,
  dealDamage,
  healHero,
  other,
  resolveBlock,
  resolveTormentPulse,
} from "./combat";
import { findEffects, hasEffect, inPlay } from "./stats";
import { endTurn, roundOf } from "./turn";
import type { Action, CardInstance, GameEvent, GameState, PlayerId, Stats } from "./types";

/** The player who must act next: the active player, or the defender while a block is being decided. */
export function actingPlayer(state: GameState): PlayerId {
  return state.pending?.kind === "block" ? other(state.active) : state.active;
}

export function deployCost(state: GameState, heroIndex: number): number {
  const p = state.players[state.active];
  if (RULES.firstDeployFree && !p.firstDeployUsed) return 0;
  return getHero(p.heroes[heroIndex].heroId).cost;
}

export function moveCost(itemId: string): number {
  return Math.ceil(itemCost(itemId) * RULES.moveItemCostFraction);
}

export function upgradeCost(fromId: string, toId: string): number {
  return itemCost(toId) - itemCost(fromId);
}

export function actionCost(state: GameState, action: Action): number {
  const p = state.players[state.active];
  const card = (uid: number) => p.hand.find((c) => c.uid === uid)!;
  switch (action.type) {
    case "deploy":
      return deployCost(state, action.hero);
    case "playItem":
      return itemCost(card(action.card).cardId);
    case "upgradeItem":
      return upgradeCost(p.heroes[action.hero].items[action.slot].cardId, card(action.card).cardId);
    case "moveItem":
      return moveCost(p.heroes[action.fromHero].items[action.slot].cardId);
    case "playBuff":
      return getBuff(card(action.card).cardId).cost;
    case "playCamp":
      return getCamp(card(action.card).cardId).cost;
    default:
      return 0;
  }
}

function mainPhaseActions(state: GameState): Action[] {
  const actions: Action[] = [];
  const p = state.players[state.active];
  const deployed = p.heroes.map((h, i) => ({ h, i })).filter(({ h }) => h.status !== "line");
  const standing = deployed.filter(({ h }) => inPlay(h));
  const affordable = (a: Action) => actionCost(state, a) <= p.souls;
  const push = (a: Action) => {
    if (affordable(a)) actions.push(a);
  };

  p.heroes.forEach((h, i) => {
    if (h.status === "line") push({ type: "deploy", hero: i });
  });

  for (const card of p.hand) {
    switch (cardKind(card.cardId)) {
      case "item": {
        const item = getItem(card.cardId);
        for (const { h, i } of deployed) {
          if (h.items.length < RULES.heroItemSlots) push({ type: "playItem", card: card.uid, hero: i });
          h.items.forEach((held, slot) => {
            if (item.buildsFrom === held.cardId) push({ type: "upgradeItem", card: card.uid, hero: i, slot });
          });
        }
        break;
      }
      case "buff":
        for (const { i } of deployed) push({ type: "playBuff", card: card.uid, hero: i });
        break;
      case "camp":
        if (roundOf(state.turn) >= getCamp(card.cardId).fromRound) {
          for (const { i } of standing) push({ type: "playCamp", card: card.uid, hero: i });
        }
        break;
    }
  }

  for (const from of deployed) {
    from.h.items.forEach((_, slot) => {
      for (const to of deployed) {
        if (to.i !== from.i && to.h.items.length < RULES.heroItemSlots) {
          push({ type: "moveItem", fromHero: from.i, slot, toHero: to.i });
        }
      }
    });
  }
  return actions;
}

function cursedRelicActions(state: GameState): Action[] {
  const actions: Action[] = [];
  const enemy = state.players[other(state.active)];
  state.players[state.active].heroes.forEach((h, i) => {
    if (!inPlay(h)) return;
    h.items.forEach((item, slot) => {
      if (item.usedThisTurn || !getItem(item.cardId).effects.some((e) => e.type === "cursedRelic")) return;
      enemy.heroes.forEach((target, t) => {
        if (inPlay(target)) actions.push({ type: "useCursedRelic", hero: i, slot, target: t });
      });
    });
  });
  return actions;
}

export function canAttack(state: GameState, heroIndex: number): boolean {
  const h = state.players[state.active].heroes[heroIndex];
  return h.status === "ready" && h.deployedOnTurn !== state.turn;
}

function combatActions(state: GameState): Action[] {
  const actions: Action[] = [];
  const enemy = state.players[other(state.active)];
  state.players[state.active].heroes.forEach((_, i) => {
    if (!canAttack(state, i)) return;
    actions.push({ type: "attack", hero: i, target: { kind: "patron" } });
    enemy.heroes.forEach((target, t) => {
      if (inPlay(target)) actions.push({ type: "attack", hero: i, target: { kind: "hero", hero: t } });
    });
  });
  return actions;
}

function tormentPulseTargets(state: GameState): number[] {
  return state.players[other(state.active)].heroes.flatMap((h, i) => (inPlay(h) ? [i] : []));
}

export function legalActions(state: GameState): Action[] {
  if (state.phase === "over") return [];
  const pending = state.pending;
  if (pending?.kind === "block") {
    const defender = other(state.active);
    const blockers = state.players[defender].heroes.flatMap((_, i) =>
      canBlock(state, { player: defender, hero: i }) ? [i] : [],
    );
    return [...blockers.map((hero): Action => ({ type: "block", hero })), { type: "block", hero: null }];
  }
  if (pending?.kind === "tormentPulse") {
    return tormentPulseTargets(state).map((target): Action => ({ type: "tormentPulse", target }));
  }
  if (state.phase === "main") {
    return [...mainPhaseActions(state), ...cursedRelicActions(state), { type: "startCombat" }, { type: "endTurn" }];
  }
  return [...combatActions(state), ...cursedRelicActions(state), { type: "endTurn" }];
}

const sameAction = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

function takeFromHand(hand: CardInstance[], uid: number): CardInstance {
  const index = hand.findIndex((c) => c.uid === uid);
  return hand.splice(index, 1)[0];
}

function addStats(target: Stats, extra: Partial<Stats>): void {
  for (const key of Object.keys(extra) as (keyof Stats)[]) target[key] += extra[key] ?? 0;
}

/** Moves on past a Torment Pulse whose holder has nothing left to hit. */
function advanceTormentPulse(state: GameState): void {
  const pending = state.pending;
  if (pending?.kind !== "tormentPulse") return;
  if (pending.heroes.length === 0 || tormentPulseTargets(state).length === 0) state.pending = null;
}

function startCombat(state: GameState, events: GameEvent[]): void {
  state.phase = "combat";
  events.push({ type: "combatStarted", player: state.active });
  const heroes = state.players[state.active].heroes;
  heroes.forEach((h, i) => {
    if (!inPlay(h)) return;
    for (const e of findEffects(h, "regenAtCombat")) healHero(state, events, { player: state.active, hero: i }, e.amount, "Extra Regen");
  });
  const pulses = heroes.flatMap((h, i) => (inPlay(h) && hasEffect(h, "tormentPulse") ? findEffects(h, "tormentPulse").map(() => i) : []));
  state.pending = { kind: "tormentPulse", heroes: pulses };
  advanceTormentPulse(state);
}

/**
 * Plays one move and returns the new game state plus a list of what happened.
 * The state passed in is left unchanged.
 */
export function applyAction(previous: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  if (!legalActions(previous).some((a) => sameAction(a, action))) {
    throw new Error(`Illegal action: ${JSON.stringify(action)}`);
  }
  const state = structuredClone(previous);
  const events: GameEvent[] = [];
  const player = state.active;
  const p = state.players[player];
  const cost = actionCost(state, action);
  p.souls -= cost;

  switch (action.type) {
    case "deploy": {
      const h = p.heroes[action.hero];
      h.status = "ready";
      h.deployedOnTurn = state.turn;
      p.firstDeployUsed = true;
      events.push({ type: "heroDeployed", player, hero: action.hero, cost });
      break;
    }
    case "playItem": {
      const card = takeFromHand(p.hand, action.card);
      p.heroes[action.hero].items.push({ ...card, usedThisTurn: false });
      events.push({ type: "itemPlayed", player, hero: action.hero, cardId: card.cardId, cost });
      break;
    }
    case "upgradeItem": {
      const card = takeFromHand(p.hand, action.card);
      const items = p.heroes[action.hero].items;
      const component = items[action.slot];
      p.discard.push({ uid: component.uid, cardId: component.cardId });
      items[action.slot] = { ...card, usedThisTurn: false };
      events.push({ type: "itemUpgraded", player, hero: action.hero, from: component.cardId, to: card.cardId, cost });
      break;
    }
    case "moveItem": {
      const [item] = p.heroes[action.fromHero].items.splice(action.slot, 1);
      p.heroes[action.toHero].items.push(item);
      events.push({ type: "itemMoved", player, fromHero: action.fromHero, toHero: action.toHero, cardId: item.cardId, cost });
      break;
    }
    case "playBuff": {
      const card = takeFromHand(p.hand, action.card);
      addStats(p.heroes[action.hero].buffs, getBuff(card.cardId).stats);
      p.discard.push(card);
      events.push({ type: "buffPlayed", player, hero: action.hero, cardId: card.cardId, cost });
      break;
    }
    case "playCamp": {
      const card = takeFromHand(p.hand, action.card);
      const camp = getCamp(card.cardId);
      p.discard.push(card);
      events.push({ type: "campCleared", player, hero: action.hero, cardId: card.cardId, cost });
      dealDamage(state, events, { player, hero: action.hero }, camp.damage, "camp", camp.name);
      p.souls += camp.reward;
      p.soulsEarned += camp.reward;
      events.push({ type: "soulsGained", player, amount: camp.reward, reason: camp.name });
      break;
    }
    case "useCursedRelic": {
      p.heroes[action.hero].items[action.slot].usedThisTurn = true;
      const target = state.players[other(player)].heroes[action.target];
      target.status = "exhausted";
      target.skipNextReady = true;
      events.push({ type: "cursedRelicUsed", player, hero: action.hero, target: action.target });
      break;
    }
    case "startCombat":
      startCombat(state, events);
      break;
    case "attack": {
      const h = p.heroes[action.hero];
      h.status = "exhausted";
      events.push({ type: "attackDeclared", player, hero: action.hero, target: action.target });
      if (action.target.kind === "hero") {
        attackHero(state, events, action.hero, action.target.hero);
      } else {
        const defender = other(player);
        const anyBlocker = state.players[defender].heroes.some((_, i) => canBlock(state, { player: defender, hero: i }));
        if (anyBlocker) state.pending = { kind: "block", attacker: action.hero };
        else resolveBlock(state, events, action.hero, null);
      }
      break;
    }
    case "block": {
      const pending = state.pending;
      if (pending?.kind !== "block") throw new Error("No attack to block");
      state.pending = null;
      resolveBlock(state, events, pending.attacker, action.hero);
      break;
    }
    case "tormentPulse": {
      const pending = state.pending;
      if (pending?.kind !== "tormentPulse") throw new Error("No Torment Pulse waiting");
      const source = pending.heroes.shift()!;
      resolveTormentPulse(state, events, source, action.target);
      advanceTormentPulse(state);
      break;
    }
    case "endTurn":
      endTurn(state, events);
      break;
  }

  // Health can drop outside a fight too, e.g. when a camp is cleared or an item moves away.
  if (state.phase !== "over") checkDowns(state, events);
  return { state, events };
}

// Plain-English text for moves and for the game log.

import { actionCost, cardName, getHero, getItem } from "../rules";
import type { Action, GameEvent, GameState, HeroRef, PlayerId, Target } from "../rules";

export const playerName = (p: PlayerId) => `Player ${p + 1}`;

export function heroName(state: GameState, ref: HeroRef): string {
  return getHero(state.players[ref.player].heroes[ref.hero].heroId).name;
}

const souls = (n: number) => (n === 0 ? "free" : n === 1 ? "1 soul" : `${n} souls`);

function targetName(state: GameState, attacker: PlayerId, target: Target): string {
  const enemy = (attacker === 0 ? 1 : 0) as PlayerId;
  return target.kind === "patron" ? `${playerName(enemy)}'s Patron` : heroName(state, { player: enemy, hero: target.hero });
}

export function describeAction(state: GameState, action: Action): string {
  const me = state.active;
  const enemy = (me === 0 ? 1 : 0) as PlayerId;
  const mine = (hero: number) => heroName(state, { player: me, hero });
  const handCard = (uid: number) => cardName(state.players[me].hand.find((c) => c.uid === uid)!.cardId);
  const cost = ` (${souls(actionCost(state, action))})`;
  switch (action.type) {
    case "deploy":
      return `Deploy ${mine(action.hero)}${cost}`;
    case "playItem":
      return `${handCard(action.card)} on ${mine(action.hero)}${cost}`;
    case "upgradeItem": {
      const from = getItem(state.players[me].heroes[action.hero].items[action.slot].cardId).name;
      return `Upgrade ${mine(action.hero)}'s ${from} into ${handCard(action.card)}${cost}`;
    }
    case "moveItem": {
      const item = getItem(state.players[me].heroes[action.fromHero].items[action.slot].cardId).name;
      return `Move ${item} from ${mine(action.fromHero)} to ${mine(action.toHero)}${cost}`;
    }
    case "playBuff":
      return `${handCard(action.card)} on ${mine(action.hero)}${cost}`;
    case "playCamp":
      return `Send ${mine(action.hero)} to ${handCard(action.card)}${cost}`;
    case "useCursedRelic":
      return `Cursed Relic on ${heroName(state, { player: enemy, hero: action.target })}`;
    case "startCombat":
      return "Go to combat";
    case "attack":
      return `${mine(action.hero)} attacks ${targetName(state, me, action.target)}`;
    case "block": {
      const attacker = state.pending?.kind === "block" ? mine(state.pending.attacker) : "the attacker";
      return action.hero === null
        ? `Don't block (the Patron takes the hit)`
        : `Block ${attacker} with ${heroName(state, { player: enemy, hero: action.hero })}`;
    }
    case "tormentPulse":
      return `Torment Pulse on ${heroName(state, { player: enemy, hero: action.target })}`;
    case "endTurn":
      return "End turn";
  }
}

export function describeEvent(state: GameState, event: GameEvent): string | null {
  const hero = (ref: HeroRef) => `${playerName(ref.player)}'s ${heroName(state, ref)}`;
  switch (event.type) {
    case "gameStarted":
      return `${playerName(event.firstPlayer)} goes first.`;
    case "turnStarted":
      return `— Round ${event.round}, turn ${event.turn}: ${playerName(event.player)} —`;
    case "soulsGained":
      return `${playerName(event.player)} gains ${souls(event.amount)} (${event.reason}).`;
    case "cardDrawn":
      return null;
    case "deckEmpty":
      return `${playerName(event.player)}'s deck is empty.`;
    case "heroReturned":
      return `${hero({ player: event.player, hero: event.hero })} returns.`;
    case "heroDeployed":
      return `${playerName(event.player)} deploys ${heroName(state, { player: event.player, hero: event.hero })}.`;
    case "itemPlayed":
      return `${hero({ player: event.player, hero: event.hero })} gets ${cardName(event.cardId)}.`;
    case "itemUpgraded":
      return `${hero({ player: event.player, hero: event.hero })} upgrades ${cardName(event.from)} into ${cardName(event.to)}.`;
    case "itemMoved":
      return `${playerName(event.player)} moves ${cardName(event.cardId)} from ${heroName(state, { player: event.player, hero: event.fromHero })} to ${heroName(state, { player: event.player, hero: event.toHero })}.`;
    case "buffPlayed":
      return `${hero({ player: event.player, hero: event.hero })} gets ${cardName(event.cardId)}.`;
    case "campCleared":
      return `${hero({ player: event.player, hero: event.hero })} clears a ${cardName(event.cardId)}.`;
    case "combatStarted":
      return `${playerName(event.player)} goes to combat.`;
    case "attackDeclared":
      return `${hero({ player: event.player, hero: event.hero })} attacks ${targetName(state, event.player, event.target)}.`;
    case "blocked":
      return `${hero({ player: event.player, hero: event.hero })} blocks.`;
    case "notBlocked":
      return `${playerName(event.player)} doesn't block.`;
    case "heroDamaged":
      return `${hero(event.target)} takes ${event.amount} damage (${event.source}).`;
    case "damagePrevented":
      return `${hero(event.target)}'s ${event.source} prevents the damage.`;
    case "patronDamaged":
      return `${playerName(event.player)}'s Patron takes ${event.amount} damage.`;
    case "heroHealed":
      return `${hero(event.target)} removes ${event.amount} damage (${event.source}).`;
    case "heroDown":
      return `${hero(event.target)} goes Down for ${event.timer} turns.`;
    case "extraAttack":
      return `${hero({ player: event.player, hero: event.hero })} may attack again (Burst Fire).`;
    case "cursedRelicUsed":
      return `${hero({ player: event.player, hero: event.hero })} uses Cursed Relic on ${heroName(state, { player: event.player === 0 ? 1 : 0, hero: event.target })}.`;
    case "turnEnded":
      return null;
    case "gameOver":
      return `${playerName(event.winner)} wins!`;
  }
}

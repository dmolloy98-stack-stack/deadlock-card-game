// New games, and the start and end of each turn.

import { getDeck, RULES } from "./data";
import { other } from "./combat";
import { randomInt, shuffle } from "./random";
import { inPlay } from "./stats";
import type { CardInstance, GameEvent, GameState, HeroState, PlayerId, PlayerState, TurnFlags } from "./types";

export interface GameConfig {
  /** Three hero ids for each player. */
  lineups: [string[], string[]];
  /** A deck id for each player (see data/decks). */
  decks: [string, string];
  seed: number;
  /** Who goes first; flipped with the seed when left out. */
  firstPlayer?: PlayerId;
}

export const freshTurnFlags = (): TurnFlags => ({
  vulnerable: 0,
  suppressed: 0,
  blocked: false,
  metalSkinUsed: false,
  burstFireUsed: false,
});

function newHero(heroId: string): HeroState {
  return {
    heroId,
    status: "line",
    deployedOnTurn: null,
    damage: 0,
    items: [],
    buffs: { health: 0, gun: 0, spirit: 0 },
    deaths: 0,
    downTimer: 0,
    skipNextReady: false,
    turn: freshTurnFlags(),
  };
}

function newPlayer(state: GameState, heroIds: string[], deckId: string): PlayerState {
  const deck: CardInstance[] = [];
  for (const [cardId, copies] of Object.entries(getDeck(deckId).cards)) {
    for (let i = 0; i < copies; i++) deck.push({ uid: state.nextUid++, cardId });
  }
  shuffle(state, deck);
  return {
    patronHealth: RULES.patronHealth,
    souls: 0,
    soulsEarned: 0,
    turnsTaken: 0,
    firstDeployUsed: false,
    deck,
    hand: [],
    discard: [],
    heroes: heroIds.map(newHero),
  };
}

function draw(state: GameState, events: GameEvent[], player: PlayerId, count: number): void {
  const p = state.players[player];
  for (let i = 0; i < count; i++) {
    const card = p.deck.shift();
    if (!card) {
      events.push({ type: "deckEmpty", player });
      return;
    }
    p.hand.push(card);
    events.push({ type: "cardDrawn", player, cardId: card.cardId });
  }
}

export const roundOf = (turn: number) => Math.ceil(turn / 2);

export function newGame(config: GameConfig): { state: GameState; events: GameEvent[] } {
  const state = {
    rng: config.seed | 0,
    nextUid: 1,
    turn: 0,
    phase: "main",
    pending: null,
    winner: null,
  } as unknown as GameState;
  state.players = [
    newPlayer(state, config.lineups[0], config.decks[0]),
    newPlayer(state, config.lineups[1], config.decks[1]),
  ];
  state.firstPlayer = config.firstPlayer ?? (randomInt(state, 2) as PlayerId);
  state.active = other(state.firstPlayer);
  const events: GameEvent[] = [{ type: "gameStarted", firstPlayer: state.firstPlayer }];
  draw(state, events, 0, RULES.openingHand);
  draw(state, events, 1, RULES.openingHand);
  startTurn(state, events);
  return { state, events };
}

/** Passes the turn to the other player and runs their start step. */
export function startTurn(state: GameState, events: GameEvent[]): void {
  state.turn += 1;
  state.active = other(state.active);
  state.phase = "main";
  const player = state.active;
  const p = state.players[player];
  p.turnsTaken += 1;
  events.push({ type: "turnStarted", player, turn: state.turn, round: roundOf(state.turn) });

  // Death timers count every turn, both players'. A hero comes back at the start of its owner's turn.
  for (const side of state.players) {
    for (const h of side.heroes) if (h.status === "down") h.downTimer = Math.max(0, h.downTimer - 1);
  }
  p.heroes.forEach((h, index) => {
    if (h.status === "down" && h.downTimer === 0) {
      h.status = "ready";
      h.damage = 0;
      events.push({ type: "heroReturned", player, hero: index });
    } else if (h.status === "exhausted") {
      if (h.skipNextReady) h.skipNextReady = false;
      else h.status = "ready";
    }
  });

  const { base, perTurn, cap, secondPlayerBonus } = RULES.souls;
  const income = Math.min(cap, base + perTurn * p.turnsTaken);
  p.souls += income;
  p.soulsEarned += income;
  events.push({ type: "soulsGained", player, amount: income, reason: "income" });
  if (player !== state.firstPlayer && p.turnsTaken === 1 && secondPlayerBonus > 0) {
    p.souls += secondPlayerBonus;
    p.soulsEarned += secondPlayerBonus;
    events.push({ type: "soulsGained", player, amount: secondPlayerBonus, reason: "going second" });
  }

  const skipDraw = RULES.firstPlayerSkipsFirstDraw && player === state.firstPlayer && p.turnsTaken === 1;
  if (!skipDraw) draw(state, events, player, RULES.drawPerTurn);
}

export function endTurn(state: GameState, events: GameEvent[]): void {
  events.push({ type: "turnEnded", player: state.active });
  for (const side of state.players) {
    for (const h of side.heroes) {
      if (inPlay(h)) h.damage = 0;
      h.turn = freshTurnFlags();
      for (const item of h.items) item.usedThisTurn = false;
    }
  }
  startTurn(state, events);
}

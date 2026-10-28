// Shapes of the card data (data/*.json) and of a game in progress.

export type Color = "gun" | "health" | "spirit";
export const COLORS: Color[] = ["gun", "health", "spirit"];

export interface Stats {
  health: number;
  gun: number;
  spirit: number;
}

export interface HeroCard {
  id: string;
  name: string;
  mainPath: Color;
  passive: boolean;
  cost: number;
  stats: Stats;
}

export type ItemEffect =
  | { type: "bonusVsHero"; amount: number }
  | { type: "bonusVsMidboss"; amount: number }
  | { type: "firstStrike" }
  | { type: "soulsOnKill"; amount: number }
  | { type: "attackAgainOnKill" }
  | { type: "healOnKill" }
  | { type: "regenAtCombat"; amount: number }
  | { type: "armor"; amount: number; min: number }
  | { type: "returnFire"; amount: number }
  | { type: "campDamageHalved" }
  | { type: "preventAttackOncePerTurn" }
  | { type: "damageHalved" }
  | { type: "spiritStrike" }
  | { type: "vulnerability"; amount: number }
  | { type: "suppress"; amount: number }
  | { type: "silenceWave" }
  | { type: "tormentPulse" }
  | { type: "cursedRelic" };

export interface ItemCard {
  id: string;
  name: string;
  color: Color;
  tier: number;
  stats: Partial<Stats>;
  buildsFrom: string | null;
  text: string;
  effects: ItemEffect[];
}

export interface BuffCard {
  id: string;
  name: string;
  cost: number;
  stats: Partial<Stats>;
  text: string;
}

export interface CampCard {
  id: string;
  name: string;
  tier: number;
  fromRound: number;
  cost: number;
  damage: number;
  reward: number;
}

export interface DeckList {
  id: string;
  name: string;
  cards: Record<string, number>;
}

export interface RulesConfig {
  patronHealth: number;
  deck: { size: number; maxCopies: number };
  openingHand: number;
  drawPerTurn: number;
  firstPlayerSkipsFirstDraw: boolean;
  souls: { base: number; perTurn: number; cap: number; secondPlayerBonus: number };
  heroItemSlots: number;
  itemTierCosts: number[];
  moveItemCostFraction: number;
  colorBonuses: { invested: number; bonus: number }[];
  firstDeployFree: boolean;
  hitBackFraction: number;
  deathTimer: { base: number; perPreviousDeath: number; cap: number };
}

// ---- Game state ----

export type PlayerId = 0 | 1;

export interface CardInstance {
  uid: number;
  cardId: string;
}

export interface ItemInstance extends CardInstance {
  usedThisTurn: boolean;
}

export type HeroStatus = "line" | "ready" | "exhausted" | "down";

// Effects that last until the end of the current turn.
export interface TurnFlags {
  vulnerable: number;
  suppressed: number;
  blocked: boolean;
  metalSkinUsed: boolean;
  burstFireUsed: boolean;
}

export interface HeroState {
  heroId: string;
  status: HeroStatus;
  deployedOnTurn: number | null;
  damage: number;
  items: ItemInstance[];
  buffs: Stats;
  deaths: number;
  downTimer: number;
  skipNextReady: boolean;
  turn: TurnFlags;
}

export interface PlayerState {
  patronHealth: number;
  souls: number;
  soulsEarned: number;
  turnsTaken: number;
  firstDeployUsed: boolean;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  heroes: HeroState[];
}

export type Pending =
  | { kind: "block"; attacker: number }
  | { kind: "tormentPulse"; heroes: number[] };

export interface GameState {
  players: [PlayerState, PlayerState];
  firstPlayer: PlayerId;
  active: PlayerId;
  turn: number;
  phase: "main" | "combat" | "over";
  pending: Pending | null;
  winner: PlayerId | null;
  rng: number;
  nextUid: number;
}

export interface HeroRef {
  player: PlayerId;
  hero: number;
}

export type Target = { kind: "patron" } | { kind: "hero"; hero: number };

export type Action =
  | { type: "deploy"; hero: number }
  | { type: "playItem"; card: number; hero: number }
  | { type: "upgradeItem"; card: number; hero: number; slot: number }
  | { type: "moveItem"; fromHero: number; slot: number; toHero: number }
  | { type: "playBuff"; card: number; hero: number }
  | { type: "playCamp"; card: number; hero: number }
  | { type: "useCursedRelic"; hero: number; slot: number; target: number }
  | { type: "startCombat" }
  | { type: "attack"; hero: number; target: Target }
  | { type: "block"; hero: number | null }
  | { type: "tormentPulse"; target: number }
  | { type: "endTurn" };

export type GameEvent =
  | { type: "gameStarted"; firstPlayer: PlayerId }
  | { type: "turnStarted"; player: PlayerId; turn: number; round: number }
  | { type: "soulsGained"; player: PlayerId; amount: number; reason: string }
  | { type: "cardDrawn"; player: PlayerId; cardId: string }
  | { type: "deckEmpty"; player: PlayerId }
  | { type: "heroReturned"; player: PlayerId; hero: number }
  | { type: "heroDeployed"; player: PlayerId; hero: number; cost: number }
  | { type: "itemPlayed"; player: PlayerId; hero: number; cardId: string; cost: number }
  | { type: "itemUpgraded"; player: PlayerId; hero: number; from: string; to: string; cost: number }
  | { type: "itemMoved"; player: PlayerId; fromHero: number; toHero: number; cardId: string; cost: number }
  | { type: "buffPlayed"; player: PlayerId; hero: number; cardId: string; cost: number }
  | { type: "campCleared"; player: PlayerId; hero: number; cardId: string; cost: number }
  | { type: "combatStarted"; player: PlayerId }
  | { type: "attackDeclared"; player: PlayerId; hero: number; target: Target }
  | { type: "blocked"; player: PlayerId; hero: number }
  | { type: "notBlocked"; player: PlayerId }
  | { type: "heroDamaged"; target: HeroRef; amount: number; source: string }
  | { type: "damagePrevented"; target: HeroRef; source: string }
  | { type: "patronDamaged"; player: PlayerId; amount: number }
  | { type: "heroHealed"; target: HeroRef; amount: number; source: string }
  | { type: "heroDown"; target: HeroRef; timer: number }
  | { type: "extraAttack"; player: PlayerId; hero: number }
  | { type: "cursedRelicUsed"; player: PlayerId; hero: number; target: number }
  | { type: "turnEnded"; player: PlayerId }
  | { type: "gameOver"; winner: PlayerId };

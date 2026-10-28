// HTML for the pieces of the board: hero cards, Patrons, hand cards, the player strip.

import {
  actionCost,
  canAttack,
  cardKind,
  colorBonus,
  colorInvestment,
  COLORS,
  getBuff,
  getCamp,
  getHero,
  getItem,
  heroStats,
  itemCost,
  RULES,
} from "../rules";
import type { Color, GameState, PlayerId, Stats } from "../rules";
import { cardKey, heroKey, itemKey, patronKey } from "./interactions";
import type { Key, Move } from "./interactions";
import { playerName } from "./describe";

export interface View {
  /** Things you can pick up right now. */
  sources: Set<Key>;
  /** Where the picked-up thing (or a prompt) can go. */
  targets: Set<Key>;
  selected: Key | null;
  /** Deploy buttons, keyed by hero. */
  deploys: Map<Key, Move>;
}

export const esc = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export const soulsText = (n: number) => `${n} soul${n === 1 ? "" : "s"}`;
export const costText = (n: number) => (n === 0 ? "free" : soulsText(n));

const STAT_LABEL: Record<string, string> = { health: "Health", gun: "Gun", spirit: "Spirit" };

function statsText(stats: Partial<Stats>): string {
  return Object.entries(stats)
    .filter(([, v]) => v)
    .map(([k, v]) => `${v! > 0 ? "+" : ""}${v} ${STAT_LABEL[k]}`)
    .join(", ");
}

function interactive(view: View, key: Key): string {
  const classes = [];
  if (view.sources.has(key)) classes.push("pickable");
  if (view.targets.has(key)) classes.push("target");
  if (view.selected === key) classes.push("selected");
  return classes.join(" ");
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function heroCardHtml(state: GameState, view: View, player: PlayerId, index: number): string {
  const h = state.players[player].heroes[index];
  const card = getHero(h.heroId);
  const key = heroKey(player, index);
  const stats = heroStats(state, { player, hero: index });
  const deploy = view.deploys.get(key);

  let badge = "";
  if (h.status === "line") badge = `<div class="badge">In hero line · costs ${card.cost}</div>`;
  else if (h.status === "down") badge = `<div class="badge down">Down · back in ${h.downTimer} turn${h.downTimer === 1 ? "" : "s"}</div>`;
  else if (h.status === "exhausted") badge = `<div class="badge">Exhausted</div>`;
  else if (player === state.active && h.deployedOnTurn === state.turn) badge = `<div class="badge">Just deployed · can't attack yet</div>`;
  else if (player === state.active && state.phase === "combat" && canAttack(state, index)) badge = `<div class="badge ready">Ready to attack</div>`;
  else badge = `<div class="badge ready">Ready</div>`;

  const slots = Array.from({ length: RULES.heroItemSlots }, (_, slot) => {
    const item = h.items[slot];
    if (!item) return `<div class="slot empty">empty slot</div>`;
    const data = getItem(item.cardId);
    const ik = itemKey(player, index, slot);
    return `<div class="slot ${data.color} ${interactive(view, ik)}" data-key="${ik}" title="${esc(data.text)}">
      <span class="tier">T${data.tier}</span> ${esc(data.name)}</div>`;
  }).join("");

  const buffs = statsText(h.buffs);
  const hpLeft = Math.max(0, stats.health - h.damage);
  const hpPct = h.status === "down" ? 0 : Math.round((hpLeft / Math.max(1, stats.health)) * 100);

  return `<div class="hero-card path-${card.mainPath} status-${h.status} ${interactive(view, key)}" data-key="${key}">
    <div class="portrait"><span class="initials">${initials(card.name)}</span><span class="path">${card.mainPath} hero</span></div>
    <div class="hero-name">${esc(card.name)}</div>
    <div class="stats">
      <span class="stat health" title="Health">♥ ${h.status === "line" ? stats.health : `${hpLeft}/${stats.health}`}</span>
      <span class="stat gun" title="Gun damage">Gun ${stats.gun}</span>
      <span class="stat spirit" title="Spirit power">Spirit ${stats.spirit}</span>
    </div>
    <div class="hpbar"><div style="width:${hpPct}%"></div></div>
    ${badge}
    <div class="slots">${slots}</div>
    ${buffs ? `<div class="buffs">Buffs: ${buffs}</div>` : ""}
    ${h.deaths ? `<div class="deaths">Deaths: ${h.deaths}</div>` : ""}
    ${deploy ? `<button class="deploy" data-move="${deploy.index}">Deploy · ${costText(actionCost(state, deploy.action))}</button>` : ""}
  </div>`;
}

export function patronHtml(state: GameState, view: View, player: PlayerId): string {
  const p = state.players[player];
  const key = patronKey(player);
  const pct = Math.max(0, Math.round((p.patronHealth / RULES.patronHealth) * 100));
  return `<div class="patron team-${player} ${interactive(view, key)}" data-key="${key}">
    <div class="patron-label">${playerName(player)}'s Patron</div>
    <div class="patron-hp">${Math.max(0, p.patronHealth)}</div>
    <div class="hpbar big"><div style="width:${pct}%"></div></div>
  </div>`;
}

function colorMeter(color: Color, invested: number): string {
  const max = RULES.colorBonuses[RULES.colorBonuses.length - 1].invested;
  const pct = Math.min(100, Math.round((invested / max) * 100));
  const ticks = RULES.colorBonuses.map((b) => `<i style="left:${(b.invested / max) * 100}%"></i>`).join("");
  const next = RULES.colorBonuses.find((b) => b.invested > invested);
  const title = next ? `${invested} souls in ${color} items. ${next.invested - invested} more for +${next.bonus}.` : `${invested} souls in ${color} items. Maxed.`;
  return `<div class="meter ${color}" title="${title}">
    <span class="meter-label">${color}</span>
    <span class="meter-bar"><b style="width:${pct}%"></b>${ticks}</span>
    <span class="meter-bonus">+${colorBonus(invested)}</span>
  </div>`;
}

export function playerStripHtml(state: GameState, player: PlayerId): string {
  const p = state.players[player];
  const invested = colorInvestment(p);
  return `<div class="strip team-${player}">
    <div class="souls" data-key="souls:${player}" title="Souls to spend. ${p.soulsEarned} earned all game.">
      <span class="gem">${p.souls}</span><span>souls</span>
    </div>
    <div class="piles">
      <span title="Cards left in deck">Deck ${p.deck.length}</span>
      <span title="Cards in hand">Hand ${p.hand.length}</span>
      <span title="Discard pile">Discard ${p.discard.length}</span>
    </div>
    <div class="meters" title="Color bonuses: souls invested in each color's items">${COLORS.map((c) => colorMeter(c, invested[c])).join("")}</div>
  </div>`;
}

export function handCardHtml(view: View, uid: number, cardId: string): string {
  const key = cardKey(uid);
  const cls = `${interactive(view, key)} ${view.sources.has(key) ? "" : "unplayable"}`;
  const wrap = (color: string, cost: number, name: string, type: string, body: string) =>
    `<div class="hand-card ${color} ${cls}" data-key="${key}">
      <div class="cost-gem">${cost}</div>
      <div class="card-name">${esc(name)}</div>
      <div class="card-type">${type}</div>
      <div class="card-body">${body}</div>
    </div>`;
  switch (cardKind(cardId)) {
    case "item": {
      const item = getItem(cardId);
      const from = item.buildsFrom ? `<div class="builds">Upgrades from ${esc(getItem(item.buildsFrom).name)}</div>` : "";
      return wrap(item.color, itemCost(cardId), item.name, `Item · Tier ${item.tier}`, `<p>${esc(item.text)}</p>${from}`);
    }
    case "buff": {
      const buff = getBuff(cardId);
      return wrap("buff", buff.cost, buff.name, "Buff · permanent", `<p>${esc(buff.text)}</p>`);
    }
    case "camp": {
      const camp = getCamp(cardId);
      return wrap(
        "camp",
        camp.cost,
        camp.name,
        `Camp · from round ${camp.fromRound}`,
        `<p>Send a hero into the jungle.</p><p class="camp-line">Hero takes <b>${camp.damage}</b> damage</p><p class="camp-line">You gain <b>${camp.reward}</b> souls</p>`,
      );
    }
  }
}

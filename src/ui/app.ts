// The plain step-1 screen: both sides on one page, every legal move as a button.

import {
  actingPlayer,
  applyAction,
  attackDamage,
  canAttack,
  cardKind,
  colorBonus,
  colorInvestment,
  COLORS,
  getBuff,
  getCamp,
  getHero,
  getItem,
  HEROES,
  heroStats,
  itemCost,
  legalActions,
  newGame,
  roundOf,
} from "../rules";
import type { Action, GameEvent, GameState, PlayerId } from "../rules";
import { describeAction, describeEvent, heroName, playerName } from "./describe";
import { helpHtml } from "./help";

interface Session {
  state: GameState;
  log: string[];
}

const DEFAULT_LINEUPS: [string[], string[]] = [
  ["haze", "wraith", "abrams"],
  ["mina", "grey-talon", "victor"],
];
const DECK_FOR: [string, string] = ["gun-health", "spirit-health"];

const soulsText = (n: number) => `${n} soul${n === 1 ? "" : "s"}`;

const esc = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

interface ActionGroup {
  title: string;
  hint: string;
  types: Action["type"][];
  collapsed?: boolean;
}

const ACTION_GROUPS: ActionGroup[] = [
  { title: "Block", hint: "Block with a Ready hero: it and the attacker deal their full Gun damage to each other. Or let your Patron take the hit.", types: ["block"] },
  { title: "Torment Pulse", hint: "Pick an enemy hero to hit.", types: ["tormentPulse"] },
  { title: "Deploy a hero", hint: "Put a hero from your hero line into play. It can't attack this turn.", types: ["deploy"] },
  { title: "Play an item", hint: "Give a hero an item. Each hero holds up to 3.", types: ["playItem"] },
  { title: "Upgrade an item", hint: "Pay only the difference. The old item is discarded and the new one takes its slot.", types: ["upgradeItem"] },
  { title: "Play a buff", hint: "A permanent bonus for one hero. Doesn't use an item slot.", types: ["playBuff"] },
  { title: "Clear a camp", hint: "Pay the cost, your hero takes the damage, and you gain the souls.", types: ["playCamp"] },
  { title: "Move an item", hint: "Costs half the item's cost, rounded up.", types: ["moveItem"], collapsed: true },
  { title: "Item powers", hint: "Once per turn per item.", types: ["useCursedRelic"] },
  { title: "Attack", hint: "Each Ready hero may attack once. Attacking a hero: it hits back for half its Gun. Attacking the Patron: the enemy may block.", types: ["attack"] },
  { title: "Next", hint: "", types: ["startCombat", "endTurn"] },
];

export function startApp(root: HTMLElement): void {
  let session: Session | null = null;

  const help = document.createElement("dialog");
  help.id = "help";
  help.innerHTML = `<button class="close" autofocus>Close</button>${helpHtml()}`;
  help.querySelector(".close")!.addEventListener("click", () => help.close());
  document.body.append(help);

  const record = (state: GameState, events: GameEvent[]) => {
    for (const e of events) {
      const line = describeEvent(state, e);
      if (line) session!.log.push(line);
    }
  };

  function begin(lineups: [string[], string[]], seed: number) {
    const { state, events } = newGame({ lineups, decks: DECK_FOR, seed });
    session = { state, log: [`New game, seed ${seed}.`] };
    record(state, events);
    render();
  }

  function act(action: Action) {
    const { state, events } = applyAction(session!.state, action);
    session!.state = state;
    record(state, events);
    render();
  }

  function render() {
    root.innerHTML = session ? gameHtml(session) : setupHtml();
    root.querySelectorAll("[data-help]").forEach((button) => button.addEventListener("click", () => help.showModal()));
    if (!session) {
      root.querySelector("form")!.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const form = new FormData(ev.target as HTMLFormElement);
        const lineups = [0, 1].map((p) => [0, 1, 2].map((i) => String(form.get(`p${p}h${i}`)))) as [string[], string[]];
        if (lineups.some((l) => new Set(l).size < 3)) {
          alert("Each player needs three different heroes.");
          return;
        }
        const seed = Number(form.get("seed")) || Math.floor(Math.random() * 1e9);
        begin(lineups, seed);
      });
      return;
    }
    const actions = legalActions(session.state);
    root.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => {
      button.addEventListener("click", () => act(actions[Number(button.dataset.action)]));
    });
    root.querySelector("#new-game")!.addEventListener("click", () => {
      session = null;
      render();
    });
  }

  render();
}

function setupHtml(): string {
  const select = (p: number, i: number) => `
    <select name="p${p}h${i}">
      ${HEROES.map((h) => `<option value="${h.id}" ${DEFAULT_LINEUPS[p][i] === h.id ? "selected" : ""}>${esc(h.name)}</option>`).join("")}
    </select>`;
  return `
    <form class="setup">
      <h1>Deadlock Card Game</h1>
      <p class="muted">Test build: you play both sides, passing the screen between turns.
        New here? Read <button type="button" data-help>How to play</button> first.</p>
      ${[0, 1]
        .map(
          (p) => `
        <fieldset>
          <legend>${playerName(p as PlayerId)} (${p === 0 ? "Gun / Health" : "Spirit / Health"} deck)</legend>
          ${[0, 1, 2].map((i) => select(p, i)).join("")}
        </fieldset>`,
        )
        .join("")}
      <label>Seed (leave empty for a random game) <input name="seed" inputmode="numeric" /></label>
      <button type="submit">Start game</button>
    </form>`;
}

function cardHtml(cardId: string, playable: boolean): string {
  const tag = playable ? `<div class="tag">Can play now</div>` : "";
  const cls = playable ? "playable" : "";
  switch (cardKind(cardId)) {
    case "item": {
      const item = getItem(cardId);
      const from = item.buildsFrom ? ` Builds from ${esc(getItem(item.buildsFrom).name)}.` : "";
      return `<div class="card ${item.color} ${cls}"><b>${esc(item.name)}</b> <span class="cost">${soulsText(itemCost(cardId))}</span>
        <div class="kind">Item · tier ${item.tier}</div>
        <div class="small">${esc(item.text)}${from}</div>${tag}</div>`;
    }
    case "buff": {
      const buff = getBuff(cardId);
      return `<div class="card buff ${cls}"><b>${esc(buff.name)}</b> <span class="cost">${soulsText(buff.cost)}</span>
        <div class="kind">Buff</div>
        <div class="small">${esc(buff.text)}</div>${tag}</div>`;
    }
    case "camp": {
      const camp = getCamp(cardId);
      return `<div class="card camp ${cls}"><b>${esc(camp.name)}</b> <span class="cost">${soulsText(camp.cost)}</span>
        <div class="kind">Camp</div>
        <div class="small">Send a hero: it takes ${camp.damage} damage and you gain ${camp.reward} souls. Playable from round ${camp.fromRound}.</div>${tag}</div>`;
    }
  }
}

function playerHtml(state: GameState, player: PlayerId, playableCards: Set<number>): string {
  const p = state.players[player];
  const invested = colorInvestment(p);
  const colorLine = COLORS.map((c) => `<span class="${c}">${c}: ${invested[c]} invested, +${colorBonus(invested[c])}</span>`).join(" · ");
  const heroes = p.heroes
    .map((h, i) => {
      const card = getHero(h.heroId);
      const stats = heroStats(state, { player, hero: i });
      let status: string = h.status;
      if (h.status === "line") status = `in hero line, costs ${card.cost}`;
      if (h.status === "down") status = `Down, ${h.downTimer} turn${h.downTimer === 1 ? "" : "s"} left`;
      if (h.status === "ready" && h.deployedOnTurn === state.turn) status = "ready (deployed this turn, can't attack)";
      const items = h.items
        .map((it) => `<li class="${getItem(it.cardId).color}" title="${esc(getItem(it.cardId).text)}">${esc(getItem(it.cardId).name)}</li>`)
        .join("");
      return `<div class="hero ${h.status}">
        <b>${esc(card.name)}</b> <span class="small">${status}</span>
        <div>Health ${stats.health - h.damage}/${stats.health} · Gun ${stats.gun} · Spirit ${stats.spirit}</div>
        <div class="small">Deaths: ${h.deaths}</div>
        <ul class="items">${items || '<li class="muted">no items</li>'}</ul>
      </div>`;
    })
    .join("");
  const showHand = state.phase === "over" || player === actingPlayer(state);
  const hand = showHand
    ? `<details open><summary>Hand (${p.hand.length})</summary><div class="hand">${p.hand
        .map((c) => cardHtml(c.cardId, playableCards.has(c.uid)))
        .join("")}</div></details>`
    : `<div class="small">Hand: ${p.hand.length} cards (hidden)</div>`;
  return `<section class="player ${state.active === player ? "active" : ""}">
    <h2>${playerName(player)} · Patron ${p.patronHealth} · Souls ${p.souls} <span class="small">(${p.soulsEarned} earned all game)</span></h2>
    <div class="small">${colorLine} · Deck ${p.deck.length} · Discard ${p.discard.length}</div>
    <div class="heroes">${heroes}</div>
    ${hand}
  </section>`;
}

function hintFor(state: GameState): string {
  const pending = state.pending;
  if (state.phase === "over") return `${playerName(state.winner!)} wins! Press New game to play again.`;
  if (pending?.kind === "block") {
    const attacker = { player: state.active, hero: pending.attacker };
    return `${playerName(state.active)}'s ${heroName(state, attacker)} is attacking your Patron for ${attackDamage(state, attacker, "patron")} damage. Block it, or let your Patron take the hit.`;
  }
  if (pending?.kind === "tormentPulse") return "Your Torment Pulse goes off: pick an enemy hero to hit.";
  if (state.phase === "main") return "Main phase: deploy heroes and play cards from your hand. When you're done, Go to combat to attack, or End turn.";
  const anyAttack = state.players[state.active].heroes.some((_, i) => canAttack(state, i));
  return anyAttack
    ? "Combat: each Ready hero may attack once. Heroes deployed this turn can't attack yet."
    : "Combat: none of your heroes can attack right now. End your turn when you're ready.";
}

function actionsHtml(state: GameState, actions: Action[]): string {
  return ACTION_GROUPS.map((group) => {
    const buttons = actions
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => group.types.includes(a.type))
      .map(({ a, i }) => `<button data-action="${i}" class="${a.type}">${esc(describeAction(state, a))}</button>`)
      .join("");
    if (!buttons) return "";
    const hint = group.hint ? `<div class="small">${esc(group.hint)}</div>` : "";
    return `<details class="group" ${group.collapsed ? "" : "open"}><summary>${group.title}</summary>${hint}<div class="actions">${buttons}</div></details>`;
  }).join("");
}

function gameHtml({ state, log }: Session): string {
  const actions = legalActions(state);
  const who = actingPlayer(state);
  const playable = new Set(actions.flatMap((a) => ("card" in a ? [a.card] : [])));
  let prompt = `${playerName(state.active)}'s turn · ${state.phase === "main" ? "Main phase" : "Combat"}`;
  if (state.pending?.kind === "block") prompt = `${playerName(who)}: block the attack?`;
  if (state.phase === "over") prompt = "Game over";
  const top = (who === 0 ? 1 : 0) as PlayerId;
  return `
    <header>
      <b>Round ${roundOf(state.turn)} · Turn ${state.turn}</b>
      <span class="prompt">${esc(prompt)}</span>
      <button data-help>How to play</button>
      <button id="new-game">New game</button>
    </header>
    <div class="hint">${esc(hintFor(state))}</div>
    <main class="layout">
      <div class="board">${playerHtml(state, top, playable)}${playerHtml(state, who, playable)}</div>
      <aside>
        <h3>${state.phase === "over" ? "Game over" : `${playerName(who)}: your moves`}</h3>
        ${actionsHtml(state, actions)}
        <h3>Log</h3>
        <ul class="log">${[...log].reverse().map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      </aside>
    </main>`;
}

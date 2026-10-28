// The plain step-1 screen: both sides on one page, every legal move as a button.

import {
  actingPlayer,
  applyAction,
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
import { describeAction, describeEvent, playerName } from "./describe";

interface Session {
  state: GameState;
  log: string[];
}

const DEFAULT_LINEUPS: [string[], string[]] = [
  ["haze", "wraith", "abrams"],
  ["mina", "grey-talon", "victor"],
];
const DECK_FOR: [string, string] = ["gun-health", "spirit-health"];

const esc = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function startApp(root: HTMLElement): void {
  let session: Session | null = null;

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
      <p class="muted">Step 1 test build: you play both sides.</p>
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

function cardHtml(cardId: string): string {
  switch (cardKind(cardId)) {
    case "item": {
      const item = getItem(cardId);
      const from = item.buildsFrom ? ` Builds from ${esc(getItem(item.buildsFrom).name)}.` : "";
      return `<div class="card ${item.color}"><b>${esc(item.name)}</b> <span class="cost">${itemCost(cardId)}</span>
        <div class="small">Tier ${item.tier}. ${esc(item.text)}${from}</div></div>`;
    }
    case "buff": {
      const buff = getBuff(cardId);
      return `<div class="card buff"><b>${esc(buff.name)}</b> <span class="cost">${buff.cost}</span>
        <div class="small">${esc(buff.text)} (placeholder)</div></div>`;
    }
    case "camp": {
      const camp = getCamp(cardId);
      return `<div class="card camp"><b>${esc(camp.name)}</b> <span class="cost">${camp.cost}</span>
        <div class="small">Hero takes ${camp.damage} damage, you gain ${camp.reward} souls. Playable from round ${camp.fromRound}. (placeholder)</div></div>`;
    }
  }
}

function playerHtml(state: GameState, player: PlayerId): string {
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
  const hand = p.hand.map((c) => cardHtml(c.cardId)).join("");
  return `<section class="player ${state.active === player ? "active" : ""}">
    <h2>${playerName(player)} · Patron ${p.patronHealth} · Souls ${p.souls} <span class="small">(${p.soulsEarned} earned all game)</span></h2>
    <div class="small">${colorLine} · Deck ${p.deck.length} · Discard ${p.discard.length}</div>
    <div class="heroes">${heroes}</div>
    <details open><summary>Hand (${p.hand.length})</summary><div class="hand">${hand}</div></details>
  </section>`;
}

function gameHtml({ state, log }: Session): string {
  const actions = legalActions(state);
  const who = actingPlayer(state);
  let prompt = `${playerName(state.active)}'s turn · ${state.phase === "main" ? "Main phase" : "Combat"}`;
  if (state.pending?.kind === "block") prompt = `${playerName(who)}: block the attack?`;
  if (state.pending?.kind === "tormentPulse") prompt = `${playerName(who)}: pick a target for Torment Pulse`;
  if (state.phase === "over") prompt = `${playerName(state.winner!)} wins!`;
  const buttons = actions
    .map((a, i) => `<button data-action="${i}" class="${a.type}">${esc(describeAction(state, a))}</button>`)
    .join("");
  return `
    <header>
      <b>Round ${roundOf(state.turn)} · Turn ${state.turn}</b>
      <span class="prompt">${esc(prompt)}</span>
      <button id="new-game">New game</button>
    </header>
    <main class="layout">
      <div class="board">${playerHtml(state, 1)}${playerHtml(state, 0)}</div>
      <aside>
        <h3>${state.phase === "over" ? "Game over" : `${playerName(who)}'s moves`}</h3>
        <div class="actions">${buttons}</div>
        <h3>Log</h3>
        <ul class="log">${[...log].reverse().map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
      </aside>
    </main>`;
}

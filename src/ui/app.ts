// The game screen: a card table you play by clicking.
// Pick up a card, hero or item (it glows when you can), then click where it goes.

import {
  actingPlayer,
  applyAction,
  attackDamage,
  canAttack,
  cardName,
  getItem,
  HEROES,
  legalActions,
  newGame,
  other,
  roundOf,
  tormentPulseDamage,
} from "../rules";
import type { Action, GameEvent, GameState, PlayerId } from "../rules";
import { animate } from "./animate";
import { esc, handCardHtml, heroCardHtml, patronHtml, playerStripHtml } from "./board";
import type { View } from "./board";
import { describeAction, describeEvent, heroName, playerName } from "./describe";
import { helpHtml } from "./help";
import { NONE, toMoves } from "./interactions";
import type { Key, Move } from "./interactions";

interface Session {
  state: GameState;
  log: string[];
  selected: Key | null;
  /** Several moves share the clicked source and target, e.g. play an item or upgrade into it. */
  choice: Move[] | null;
}

const DEFAULT_LINEUPS: [string[], string[]] = [
  ["haze", "wraith", "abrams"],
  ["mina", "grey-talon", "victor"],
];
const DECK_FOR: [string, string] = ["gun-health", "spirit-health"];

interface ActionGroup {
  title: string;
  types: Action["type"][];
}

const ACTION_GROUPS: ActionGroup[] = [
  { title: "Block", types: ["block"] },
  { title: "Torment Pulse", types: ["tormentPulse"] },
  { title: "Deploy a hero", types: ["deploy"] },
  { title: "Play an item", types: ["playItem"] },
  { title: "Upgrade an item", types: ["upgradeItem"] },
  { title: "Play a buff", types: ["playBuff"] },
  { title: "Clear a camp", types: ["playCamp"] },
  { title: "Move an item", types: ["moveItem"] },
  { title: "Item powers", types: ["useCursedRelic"] },
  { title: "Attack", types: ["attack"] },
  { title: "Next", types: ["startCombat", "endTurn"] },
];

export function startApp(root: HTMLElement): void {
  let session: Session | null = null;
  let moves: Move[] = [];
  let view: View = { sources: new Set(), targets: new Set(), selected: null, deploys: new Map() };

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
    session = { state, log: [`New game, seed ${seed}.`], selected: null, choice: null };
    record(state, events);
    render(events);
  }

  function act(move: Move) {
    const { state, events } = applyAction(session!.state, move.action);
    session = { ...session!, state, selected: null, choice: null };
    record(state, events);
    render(events);
  }

  function clickKey(key: Key) {
    const s = session!;
    s.choice = null;
    const prompt = s.state.pending !== null;
    if (view.targets.has(key)) {
      const options = moves.filter((m) => m.target === key && (prompt ? m.source === null : m.source === s.selected));
      if (options.length === 1) return act(options[0]);
      s.choice = options;
      return render();
    }
    s.selected = view.sources.has(key) && s.selected !== key ? key : null;
    render();
  }

  root.addEventListener("click", (ev) => {
    const el = ev.target as HTMLElement;
    if (el.closest("[data-help]")) return help.showModal();
    if (!session) return;
    if (el.closest("#new-game")) {
      session = null;
      return render();
    }
    const moveButton = el.closest<HTMLElement>("[data-move]");
    if (moveButton) return act(moves[Number(moveButton.dataset.move)]);
    if (el.closest("details, .choice")) return;
    const keyed = el.closest<HTMLElement>("[data-key]");
    if (keyed) return clickKey(keyed.dataset.key!);
    if (session.selected || session.choice) {
      session.selected = null;
      session.choice = null;
      render();
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && session && (session.selected || session.choice)) {
      session.selected = null;
      session.choice = null;
      render();
    }
  });

  function render(events: GameEvent[] = []) {
    if (!session) {
      root.innerHTML = setupHtml();
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
    const { state } = session;
    moves = toMoves(state, legalActions(state));
    view = buildView(session, moves);
    root.innerHTML = gameHtml(session, moves, view);
    const log = root.querySelector(".log");
    if (log) log.scrollTop = 0;
    animate(root.querySelector<HTMLElement>(".table")!, events);
  }

  render();
}

function buildView(session: Session, moves: Move[]): View {
  const view: View = { sources: new Set(), targets: new Set(), selected: session.selected, deploys: new Map() };
  if (session.state.pending) {
    for (const m of moves) if (m.target !== NONE) view.targets.add(m.target);
    return view;
  }
  for (const m of moves) {
    if (m.action.type === "deploy") view.deploys.set(m.source!, m);
    else if (m.source) view.sources.add(m.source);
    if (m.source && m.source === session.selected && m.target !== NONE) view.targets.add(m.target);
  }
  return view;
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
        <fieldset class="team-${p}">
          <legend>${playerName(p as PlayerId)} (${p === 0 ? "Gun / Health" : "Spirit / Health"} deck)</legend>
          ${[0, 1, 2].map((i) => select(p, i)).join("")}
        </fieldset>`,
        )
        .join("")}
      <label>Seed (leave empty for a random game) <input name="seed" inputmode="numeric" /></label>
      <button type="submit" class="primary">Start game</button>
    </form>`;
}

/** What to do right now, in one or two plain sentences. */
function hintFor(session: Session, moves: Move[]): string {
  const { state, selected } = session;
  const me = state.active;
  const pending = state.pending;
  if (state.phase === "over") return `${playerName(state.winner!)} wins! Press New game to play again.`;
  if (pending?.kind === "block") {
    const attacker = { player: me, hero: pending.attacker };
    return `${playerName(other(me))}: ${heroName(state, attacker)} is attacking your Patron for ${attackDamage(state, attacker, "patron")} damage. Click one of your glowing heroes to block it, or take the hit.`;
  }
  if (pending?.kind === "tormentPulse") {
    const source = { player: me, hero: pending.heroes[0] };
    return `Torment Pulse: click an enemy hero to deal ${tormentPulseDamage(state, source)} damage to it.`;
  }
  if (session.choice) return "Two ways to do that. Pick one.";
  if (selected) {
    const [kind, ...rest] = selected.split(":");
    if (kind === "card") {
      const card = state.players[me].hand.find((c) => c.uid === Number(rest[0]))!;
      return `Click a glowing hero to play ${cardName(card.cardId)} on it. Click the card again to put it back.`;
    }
    if (kind === "hero") {
      const hero = { player: me, hero: Number(rest[1]) };
      return `Click what ${heroName(state, hero)} should attack: a glowing enemy hero (it hits back for half its Gun) or the enemy Patron (they may block).`;
    }
    if (kind === "item") {
      const item = getItem(state.players[me].heroes[Number(rest[1])].items[Number(rest[2])].cardId);
      return `Click a glowing hero for ${item.name}.`;
    }
  }
  if (state.phase === "main") {
    return "Main phase: click a glowing card in your hand, then the hero to play it on. Deploy heroes with their Deploy button. When you're done, Go to combat.";
  }
  const anyAttack = state.players[me].heroes.some((_, i) => canAttack(state, i));
  if (anyAttack) return "Combat: click one of your Ready heroes, then what it should attack. Each hero attacks once.";
  return moves.length ? "Combat: none of your heroes can attack now. End your turn when you're ready." : "";
}

function phaseTrackerHtml(state: GameState): string {
  const steps = ["Start", "Main phase", "Combat", "End"];
  const current = state.phase === "main" ? 1 : state.phase === "combat" ? 2 : -1;
  return `<ol class="phases">${steps.map((s, i) => `<li class="${i === current ? "now" : i < current ? "done" : ""}">${s}</li>`).join("")}</ol>`;
}

function promptButtonsHtml(session: Session, moves: Move[]): string {
  const { state } = session;
  if (session.choice) {
    return `<div class="choice">${session.choice
      .map((m) => `<button data-move="${m.index}">${esc(describeAction(state, m.action))}</button>`)
      .join("")}</div>`;
  }
  if (!state.pending) return "";
  return moves
    .filter((m) => m.target === NONE)
    .map((m) => `<button class="take-hit" data-move="${m.index}">${esc(describeAction(state, m.action))}</button>`)
    .join("");
}

function nextStepHtml(state: GameState, moves: Move[]): string {
  if (state.pending) return "";
  return moves
    .filter((m) => m.action.type === "startCombat" || m.action.type === "endTurn")
    .map((m) => {
      const label = m.action.type === "startCombat" ? "Go to combat ▸" : "End turn ▸";
      return `<button class="next ${m.action.type}" data-move="${m.index}">${label}</button>`;
    })
    .join("");
}

function allMovesHtml(state: GameState, moves: Move[]): string {
  const groups = ACTION_GROUPS.map((group) => {
    const buttons = moves
      .filter((m) => group.types.includes(m.action.type))
      .map((m) => `<button data-move="${m.index}">${esc(describeAction(state, m.action))}</button>`)
      .join("");
    return buttons ? `<div class="group"><div class="group-title">${group.title}</div>${buttons}</div>` : "";
  }).join("");
  return `<details class="all-moves"><summary>All moves as a list (${moves.length})</summary>${groups}</details>`;
}

function sideHtml(state: GameState, view: View, player: PlayerId, label: string): string {
  const heroes = state.players[player].heroes.map((_, i) => heroCardHtml(state, view, player, i)).join("");
  return `<section class="side team-${player} ${state.active === player ? "active" : ""}">
    <div class="side-info">
      <div class="side-label">${label}</div>
      ${patronHtml(state, view, player)}
      ${playerStripHtml(state, player)}
    </div>
    <div class="hero-row">${heroes}</div>
  </section>`;
}

function gameHtml(session: Session, moves: Move[], view: View): string {
  const { state, log } = session;
  const me = state.active;
  const enemy = other(me);
  const who = actingPlayer(state);
  const hand = state.players[me].hand
    .map((c) => handCardHtml(view, c.uid, c.cardId))
    .join("");
  const statLine = (p: PlayerId) =>
    state.players[p].heroes.filter((h) => h.status !== "line").length
      ? ""
      : `<div class="empty-note">No heroes deployed yet.</div>`;
  return `
    <header>
      <div class="title">Round ${roundOf(state.turn)} · Turn ${state.turn}</div>
      <div class="whose team-${who}">${state.phase === "over" ? "Game over" : `${playerName(who)} to act`}</div>
      ${state.phase === "over" ? "" : phaseTrackerHtml(state)}
      <div class="spacer"></div>
      <button data-help>How to play</button>
      <button id="new-game">New game</button>
    </header>
    <div class="screen">
      <div class="table">
        ${sideHtml(state, view, enemy, `Opponent · ${playerName(enemy)}`)}
        ${statLine(enemy)}
        <div class="midline">
          <div class="hint team-${who}">${esc(hintFor(session, moves))}</div>
          <div class="prompt-buttons">${promptButtonsHtml(session, moves)}</div>
        </div>
        ${sideHtml(state, view, me, `You · ${playerName(me)}`)}
        ${statLine(me)}
        <div class="hand-row ${state.pending ? "waiting" : ""}">
          <div class="hand">${hand || '<div class="empty-note">No cards in hand.</div>'}</div>
          <div class="next-steps">${nextStepHtml(state, moves)}</div>
        </div>
      </div>
      <aside>
        <h3>What happened</h3>
        <ul class="log">${[...log].reverse().map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
        ${state.phase === "over" ? "" : allMovesHtml(state, moves)}
        <div class="legend">
          <div><span class="dot pickable"></span> glowing gold: you can pick this up</div>
          <div><span class="dot target"></span> pulsing: a place you can send it</div>
          <div class="small">Hover an item for its card text.</div>
        </div>
      </aside>
    </div>`;
}

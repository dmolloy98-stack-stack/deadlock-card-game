// Simple animations for the events of the last move: floating numbers, flashes, a turn banner.

import type { GameEvent } from "../rules";
import { heroKey, patronKey } from "./interactions";
import { playerName } from "./describe";

const STEP_MS = 140;

function find(root: HTMLElement, key: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-key="${key}"]`);
}

function floatText(el: HTMLElement | null, text: string, kind: string, delay: number): void {
  if (!el) return;
  setTimeout(() => {
    const float = document.createElement("div");
    float.className = `float ${kind}`;
    float.textContent = text;
    el.append(float);
    setTimeout(() => float.remove(), 1400);
  }, delay);
}

function flash(el: HTMLElement | null, cls: string, delay: number): void {
  if (!el) return;
  setTimeout(() => {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation if it is already running
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 700);
  }, delay);
}

function banner(root: HTMLElement, text: string, delay: number): void {
  setTimeout(() => {
    const el = document.createElement("div");
    el.className = "banner";
    el.textContent = text;
    root.append(el);
    setTimeout(() => el.remove(), 1500);
  }, delay);
}

export function animate(root: HTMLElement, events: GameEvent[]): void {
  let delay = 0;
  for (const e of events) {
    switch (e.type) {
      case "attackDeclared":
        flash(find(root, heroKey(e.player, e.hero)), "lunge", delay);
        break;
      case "heroDamaged":
        flash(find(root, heroKey(e.target.player, e.target.hero)), "hit", delay);
        floatText(find(root, heroKey(e.target.player, e.target.hero)), `−${e.amount}`, "damage", delay);
        break;
      case "damagePrevented":
        floatText(find(root, heroKey(e.target.player, e.target.hero)), "Blocked!", "heal", delay);
        break;
      case "patronDamaged":
        flash(find(root, patronKey(e.player)), "hit", delay);
        floatText(find(root, patronKey(e.player)), `−${e.amount}`, "damage", delay);
        break;
      case "heroHealed":
        floatText(find(root, heroKey(e.target.player, e.target.hero)), `+${e.amount}`, "heal", delay);
        break;
      case "heroDown":
        flash(find(root, heroKey(e.target.player, e.target.hero)), "downed", delay);
        floatText(find(root, heroKey(e.target.player, e.target.hero)), "DOWN", "damage", delay);
        break;
      case "heroDeployed":
      case "heroReturned":
        flash(find(root, heroKey(e.player, e.hero)), "arrive", delay);
        break;
      case "itemPlayed":
      case "itemUpgraded":
      case "buffPlayed":
      case "campCleared":
        flash(find(root, heroKey(e.player, e.hero)), "glow", delay);
        break;
      case "itemMoved":
        flash(find(root, heroKey(e.player, e.toHero)), "glow", delay);
        break;
      case "soulsGained":
        floatText(find(root, `souls:${e.player}`), `+${e.amount}`, "souls", delay);
        break;
      case "turnStarted":
        banner(root, `${playerName(e.player)}'s turn`, delay);
        break;
      case "gameOver":
        banner(root, `${playerName(e.winner)} wins!`, delay);
        break;
      default:
        continue;
    }
    delay += STEP_MS;
  }
}

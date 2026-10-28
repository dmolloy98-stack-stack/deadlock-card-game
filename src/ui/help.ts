// The "How to play" manual. Numbers come from data/rules.json and the card files,
// so the manual stays right when they are tuned.

import { BUFFS, CAMPS, getItem, HEROES, ITEMS, itemCost, RULES } from "../rules";
import type { Color } from "../rules";

const esc = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const COLOR_NAMES: Record<Color, string> = { gun: "Orange (Gun)", health: "Green (Health)", spirit: "Purple (Spirit)" };

function itemTable(color: Color): string {
  const rows = ITEMS.filter((i) => i.color === color)
    .map((i) => {
      const from = i.buildsFrom ? getItem(i.buildsFrom).name : "—";
      return `<tr><td>${i.tier}</td><td>${itemCost(i.id)}</td><td><b>${esc(i.name)}</b></td><td>${esc(i.text)}</td><td>${esc(from)}</td></tr>`;
    })
    .join("");
  return `<h4 class="${color}">${COLOR_NAMES[color]}</h4>
    <table><tr><th>Tier</th><th>Cost</th><th>Item</th><th>What it does</th><th>Builds from</th></tr>${rows}</table>`;
}

export function helpHtml(): string {
  const { base, perTurn, cap, secondPlayerBonus } = RULES.souls;
  const firstIncomes = [1, 2, 3, 4, 5, 6].map((t) => Math.min(cap, base + perTurn * t)).join(", ");
  const bonuses = RULES.colorBonuses.map((b) => `<tr><td>${b.invested}</td><td>+${b.bonus}</td></tr>`).join("");
  const { base: downBase, perPreviousDeath, cap: downCap } = RULES.deathTimer;
  const heroes = HEROES.map(
    (h) =>
      `<tr><td><b>${esc(h.name)}</b></td><td>${h.mainPath}</td><td>${h.stats.health}</td><td>${h.stats.gun}</td><td>${h.stats.spirit}</td><td>${h.cost}</td></tr>`,
  ).join("");
  const camps = CAMPS.map(
    (c) => `<tr><td><b>${esc(c.name)}</b></td><td>${c.cost}</td><td>${c.damage}</td><td>+${c.reward}</td><td>${c.fromRound}</td></tr>`,
  ).join("");
  const buffs = BUFFS.map((b) => `<li><b>${esc(b.name)}</b> (${b.cost} soul): ${esc(b.text)}</li>`).join("");

  return `
  <h2>How to play</h2>

  <h3>How to win</h3>
  <p>Each player has a <b>Patron</b> with ${RULES.patronHealth} health. Bring the enemy Patron to 0 and you win.
  Your heroes hurt the enemy Patron by attacking it in combat. Damage to a Patron never heals.</p>

  <h3>What you start with</h3>
  <ul>
    <li><b>3 heroes</b> waiting in your hero line. They aren't in play until you deploy them.</li>
    <li><b>A deck of ${RULES.deck.size} cards</b>: items, buffs and camps. You start with ${RULES.openingHand} cards in hand and draw ${RULES.drawPerTurn} at the start of each turn.
      ${RULES.firstPlayerSkipsFirstDraw ? "The player who goes first skips the draw on their very first turn." : ""}</li>
    <li><b>Souls</b>, the only thing you spend. You gain 2 + your turn number each turn (${firstIncomes}, then ${cap} every turn).
      Souls you don't spend are kept. The second player gets +${secondPlayerBonus} souls on their first turn.</li>
  </ul>

  <h3>Your turn, step by step</h3>
  <ol>
    <li><b>Start</b> (automatic): gain souls, draw a card, your heroes become Ready, and Down heroes count down.</li>
    <li><b>Main phase</b>: do any of these, in any order, as many times as you can pay for them:
      <ul>
        <li><b>Deploy a hero</b> from your hero line by paying its cost. Your first deploy each game is free.</li>
        <li><b>Play an item</b> on one of your heroes.</li>
        <li><b>Upgrade an item</b> a hero already holds (see Items).</li>
        <li><b>Play a buff</b> on one of your heroes.</li>
        <li><b>Send a hero to a camp</b> to earn souls.</li>
        <li><b>Move an item</b> from one of your heroes to another.</li>
      </ul>
      <b>How to click it:</b> anything you can use right now glows gold. Click a glowing card in your hand, then click the hero
      it should go on (the heroes you can pick pulse white). Deploy a hero with the <i>Deploy</i> button on its card. To move an item,
      click it on its hero, then click the hero it should go to. Every move is also listed under <i>All moves as a list</i> on the right.</li>
    <li><b>Combat</b>: press <i>Go to combat</i>. Click one of your Ready heroes, then click the enemy hero or the enemy Patron it should
      attack. Each Ready hero may attack once. You can't go back to the main phase after this.</li>
    <li><b>End turn</b>: all damage on heroes heals, and it's the other player's turn. You can end your turn without fighting.</li>
  </ol>

  <h3>Heroes</h3>
  <p>A hero has three stats. <b>Health</b>: the damage it can take before going Down. <b>Gun</b>: the damage it deals when it attacks.
  <b>Spirit</b>: powers some purple items now, and hero abilities later.</p>
  <ul>
    <li><b>Ready</b>: can attack on your turn and can block on the other player's turn.</li>
    <li><b>Exhausted</b>: has attacked. It readies again at the start of your next turn, so it can't block in between.</li>
    <li>A hero <b>can't attack on the turn it's deployed</b>.</li>
  </ul>
  <table><tr><th>Hero</th><th>Path</th><th>Health</th><th>Gun</th><th>Spirit</th><th>Cost</th></tr>${heroes}</table>

  <h3>Combat</h3>
  <p>Each Ready hero picks one target:</p>
  <ul>
    <li><b>Attack an enemy hero</b>: your hero deals its Gun damage. The defender <b>hits back</b> at the same time for half its Gun,
      rounded up, even if it's exhausted. Only gun attacks cause a hit back.</li>
    <li><b>Attack the enemy Patron</b>: the other player may <b>block</b> with one of their Ready heroes. The blocker and your hero
      deal their full Gun damage to each other, and the Patron takes nothing. Each hero can block once per turn.
      If they don't block, or have no Ready hero, the Patron takes your hero's Gun damage. When you're the one being attacked,
      the game asks you: click one of your glowing heroes to block, or press the button to take the hit.</li>
  </ul>
  <p>Damage on heroes heals at the end of every turn, so a hero only goes Down if it takes its full Health in one turn.</p>

  <h3>Going Down</h3>
  <p>A hero at 0 health goes <b>Down</b>. It keeps its items and comes back at the start of one of your turns:
  it's Down for ${downBase} turns the first time, +${perPreviousDeath} for each earlier death, up to ${downCap}.
  Both players' turns count.</p>

  <h3>Items</h3>
  <ul>
    <li>Items come in three colors and four tiers costing ${RULES.itemTierCosts.join(" / ")} souls.</li>
    <li>Each hero holds up to <b>${RULES.heroItemSlots} items</b>. Buffs don't use a slot.</li>
    <li><b>Upgrading</b>: some items build from another item. If your hero holds that item, you can upgrade it by paying only the
      difference. The old item is discarded and the new one takes its slot, so this works even when the hero is full.</li>
    <li><b>Moving</b> an item to another of your heroes costs half its cost, rounded up.</li>
  </ul>

  <h3>Color bonuses</h3>
  <p>Add up the cost of every item of one color across all your heroes. At these totals, <b>all</b> your heroes get a bonus to that color's stat
  (orange: Gun, green: Health, purple: Spirit):</p>
  <table><tr><th>Souls in one color</th><th>Bonus to every hero</th></tr>${bonuses}</table>

  <h3>Camps</h3>
  <p>A camp card sends one of your heroes into the jungle: pay its cost, your hero takes the damage, and you gain the souls.
  It doesn't tire the hero out, so it can still attack and block. If the damage takes the hero to 0, it goes Down
  (you still get the souls). Stronger camps unlock in later rounds. A round is one turn for each player. All camp numbers are placeholders.</p>
  <table><tr><th>Camp</th><th>Cost</th><th>Damage to hero</th><th>Souls</th><th>From round</th></tr>${camps}</table>

  <h3>Buffs</h3>
  <p>A buff gives one hero a bonus for the rest of the game. Placeholders for now:</p>
  <ul>${buffs}</ul>

  <h3>Not in this test build yet</h3>
  <p>The Midboss, the Sinner's Sacrifice altars, and hero abilities. Silence Wave and Rapid Rounds' Midboss bonus wait for those.</p>

  <h3>All items</h3>
  ${itemTable("gun")}${itemTable("health")}${itemTable("spirit")}
  `;
}

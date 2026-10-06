import test from "node:test";
import assert from "node:assert/strict";
import { createOpeningPractice } from "../src/tutorial.js";
import { experimentChoices, applyCondition, compareCondition } from "../src/experiment.js";
import { buildCoach } from "../src/coach.js";
import { FORMATS, MENUS } from "../src/data.js";

test("opening practice creates a seat and serves a real order, counting labor", () => {
  const sim = createOpeningPractice();
  assert(sim.tables.every(table => table.state === "dirty"));
  assert.equal(sim.metrics.served, 0);
  sim.moveOwner("hall");
  sim.setSpeed(1);
  let spawned = false;
  for (let frame = 0; frame < 900 && !sim.metrics.served; frame++) {
    sim.update(.1);
    if (!spawned && sim.tables.some(table => table.state === "free")) {
      sim.spawnAgent({ id: "practice-guest", day: 1, hour: sim.openHour, spawnMinute: sim.gameMinute, customerId: "local_resident", guaranteed: true, randomKey: 1 });
      sim.activeAgents.at(-1).channel = "dine";
      spawned = true;
    }
  }
  assert.equal(sim.metrics.served, 1);
  assert(sim.metrics.revenue > 0);
  assert(sim.ownerInterventionMinutes > 0);
});

test("menu experiment swaps one legal item, is reproducible, and leaves live state intact", () => {
  const sim = createOpeningPractice();
  const saved = sim.exportState();
  const choices = experimentChoices(saved).filter(item => item.key === "menu");
  assert(choices.length > 0);
  const change = choices[0];
  const result = compareCondition(saved, { monthNumber: 1 }, change);
  assert.deepEqual(result, compareCondition(saved, { monthNumber: 1 }, change));
  assert.deepEqual(sim.exportState(), saved);
  const old = sim.menus.map(menu => menu.id);
  applyCondition(sim, change);
  assert.equal(sim.menus.length, old.length);
  assert.equal(sim.menus.filter(menu => !old.includes(menu.id)).length, 1);
  assert(!sim.menus.some(menu => menu.bakeryOnly));
  assert.throws(() => applyCondition(sim, change));
  assert.throws(() => applyCondition(sim, { key: "menu", id: "fake>fake" }));
  const cards = buildCoach(saved, { monthNumber: 1, losses: { menu: 9, wait: 1 } });
  assert.equal(cards[0].change.key, "menu");
  assert(cards[0].observation.includes("9"));
  assert.equal(cards[0].facts.profitDelta, cards[0].facts.afterProfit - cards[0].facts.beforeProfit);
});

test("bakery menu experiments honor installed equipment and the two-item supply limit", () => {
  const sim = createOpeningPractice();
  sim.format = FORMATS.find(format => format.id === "specialty_cafe");
  assert(sim.format);
  const bakery = MENUS.filter(menu => menu.bakeryOnly);
  assert(bakery.length >= 2);
  const choices = experimentChoices(sim.exportState(), { bakeryGearBought: true });
  const add = choices.find(item => item.key === "menu" && item.id.endsWith(`>${bakery[0].id}`));
  assert(add);
  assert.throws(() => applyCondition(sim, add));
  applyCondition(sim, add, { bakeryGearBought: true });
  sim.setMenus([...sim.menus, bakery[1]]);
  const limited = experimentChoices(sim.exportState(), { bakeryGearBought: true });
  for (const item of limited.filter(item => item.key === "menu")) {
    const [old, next] = item.id.split(">");
    if (bakery.some(menu => menu.id === next)) assert(bakery.some(menu => menu.id === old));
  }
});

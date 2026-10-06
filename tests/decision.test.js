import test from "node:test";
import assert from "node:assert/strict";
import { createOpeningPractice } from "../src/tutorial.js";
import { experimentChoices, applyCondition, compareCondition, compareBudget, laborTradeoff } from "../src/experiment.js";
import { buildCoach } from "../src/coach.js";
import { FORMATS, MENUS, STAFFING_PLANS, OWNER_ROLES, SUPPLY_MODES } from "../src/data.js";

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

test("staffing changes require paid staff, including legacy saves and supplied bakery", () => {
  const sim = createOpeningPractice();
  sim.ownerRole = OWNER_ROLES.find(item => item.id === "peak");
  sim.hires = [];
  const full = STAFFING_PLANS.find(item => item.id === "full");
  const trim = STAFFING_PLANS.find(item => item.id === "trim");
  sim.staffing = full;
  const minutes = sim.ownerBaseMinutes();
  sim.staffing = trim; // old save with invalid no-staff plan
  assert.equal(sim.ownerBaseMinutes(), minutes);
  assert(!experimentChoices(sim.exportState()).some(item => item.key === "staffing"));
  assert.throws(() => applyCondition(sim, { key: "staffing", id: "lean" }));
  assert(!buildCoach(sim.exportState(), { monthNumber: 1, losses: { wait: 20 } }).some(card => card.id === "staffing"));
  assert.equal(sim.setStaffing(trim).id, "full");
  sim.addHire({ role: "홀 알바", hours: 4, wageMultiplier: 1 });
  assert(experimentChoices(sim.exportState()).some(item => item.key === "staffing" && item.label.includes("+2시간")));
  applyCondition(sim, { key: "staffing", id: "trim" });
  assert.equal(sim.ownerBaseMinutes(), minutes + 120);
  sim.removeHire(0);
  assert.equal(sim.ownerBaseMinutes(), minutes);
  sim.hires = [{ role: "베이커", hours: 8, wageMultiplier: 1.35 }];
  sim.supplyMode = SUPPLY_MODES.find(item => item.id === "buy");
  assert(!experimentChoices(sim.exportState()).some(item => item.key === "staffing"));
  assert.equal(sim.ownerBaseMinutes(), minutes);
});

test("labor interpretation handles more work, saved time and no hour difference", () => {
  const describe = (profit, hours) => laborTradeoff({ delta: { profit, ownerMinutes: hours * 60 } });
  assert(describe(3.1837, 62).includes("₩514"));
  assert(describe(-10, 20).includes("이익은 늘지"));
  assert(describe(-10, -20).includes("₩5,000"));
  assert(describe(10, -20).includes("이익도 줄지"));
  assert(describe(10, 0).includes("거의 같습니다"));
});

test("personal budget changes only rent and cash assumptions, rejects invalid money", () => {
  const summary = { monthNumber: 1, profit: 400, costs: { rent: 200 }, ownerMinutes: 12000 };
  const inputs = { capital: 9000, investment: 8000, rent: 300, living: 400 };
  const original = structuredClone({ summary, inputs });
  const result = compareBudget(summary, inputs);
  assert.equal(result.profit, 300);
  assert.equal(result.afterLiving, -100);
  assert.equal(result.openingCash, 1000);
  assert.equal(result.runway, 10);
  assert.equal(result.ownerHours, 200);
  assert.deepEqual({ summary, inputs }, original);
  assert.equal(compareBudget(summary, { ...inputs, investment: 10000 }).runway, 0);
  assert.equal(compareBudget(summary, { ...inputs, living: 100 }).runway, null);
  assert.equal(compareBudget(summary, { ...inputs, living: 300 }).runway, null);
  assert.equal(compareBudget(summary, { ...inputs, investment: 8500 }).profit, result.profit);
  for (const key of Object.keys(inputs)) for (const bad of [-1, NaN, Infinity, "300", null, 1000001]) {
    assert.throws(() => compareBudget(summary, { ...inputs, [key]: bad }));
  }
  assert.throws(() => compareBudget({}, inputs));
});

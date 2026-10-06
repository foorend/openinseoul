import test from "node:test";
import assert from "node:assert/strict";
import { DISTRICTS, FORMATS, MENUS, GAME_CONFIG } from "../src/data.js";
import { RestaurantSimulation } from "../src/sim.js";
import { compareCondition } from "../src/experiment.js";

function create() {
  return new RestaurantSimulation({ seed: "SAVE-REPLAY", district: DISTRICTS[2], format: FORMATS[1], menus: MENUS.slice(0, 3), cash: 5000, reputation: GAME_CONFIG.reputationBase, awareness: GAME_CONFIG.awarenessBase, hygiene: GAME_CONFIG.hygieneBase });
}

test("JSON save and resume preserves active orders, sets, non-finite timers and closing result", () => {
  const sim = create();
  sim.startDay(1);
  sim.toggleOwnerWork(true);
  sim.setOwnerAuto(true);
  sim.setSpeed(4);
  for (let i = 0; i < 150; i++) sim.update(0.1);
  const restored = RestaurantSimulation.fromState(JSON.parse(JSON.stringify(sim.exportState())));
  assert.deepEqual(restored.snapshot(), sim.snapshot());
  assert.deepEqual(restored.runToEnd(), sim.runToEnd());
  assert.throws(() => RestaurantSimulation.fromState({ version: "old", data: {} }), /버전/);
  assert.throws(() => RestaurantSimulation.fromState({ version: sim.exportState().version, data: {} }), /손상/);
  const broken = sim.exportState();
  delete broken.data.hourPlan;
  assert.throws(() => RestaurantSimulation.fromState(broken), /손상/);
});

test("one-condition experiment is repeatable and never changes the live game", () => {
  const sim = create();
  const original = sim.exportState();
  const a = compareCondition(original, { monthNumber: 1 }, { key: "hourPlan", id: "office" });
  const b = compareCondition(original, { monthNumber: 1 }, { key: "hourPlan", id: "office" });
  assert.deepEqual(a, b);
  assert.deepEqual(sim.exportState(), original);
  assert.equal(a.before.costs.rent, a.after.costs.rent);
  assert.equal(a.delta.profit, a.after.profit - a.before.profit);
  assert.equal(a.from, "standard");
  assert.equal(a.to, "office");
  assert.throws(() => compareCondition(original, { monthNumber: 1 }, { key: "cash", id: "office" }), /조건/);
});

test("shared opening hours retain the same potential customer identities", () => {
  const a = create();
  const b = create();
  b.hourPlan = { ...b.hourPlan, open: 8 };
  a.startDay(1);
  b.startDay(1);
  const common = b.arrivals.filter((arrival) => arrival.hour >= a.openHour);
  assert.deepEqual(common, a.arrivals);
});

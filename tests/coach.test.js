import test from "node:test";
import assert from "node:assert/strict";
import { buildCoach, narrateCoach } from "../src/coach.js";
import { DISTRICTS, FORMATS, MENUS, DATA_VERSION } from "../src/data.js";
import { RestaurantSimulation } from "../src/sim.js";

test("coach uses reproducible one-condition evidence and safely falls back", async () => {
  const sim = new RestaurantSimulation({ seed: "COACH", district: DISTRICTS[2], format: FORMATS[1], menus: MENUS.slice(0, 3), cash: 5000 });
  const saved = sim.exportState();
  const cards = buildCoach(saved, { monthNumber: 1 });
  assert.equal(cards.length, 3);
  assert.deepEqual(buildCoach(saved, { monthNumber: 1 }), cards);
  assert.deepEqual(sim.exportState(), saved);
  cards.forEach((card) => assert.equal(card.facts.profitDelta, card.facts.afterProfit - card.facts.beforeProfit));
  assert((await narrateCoach(cards)).mode.includes("미연결"));
  const payload = { version: DATA_VERSION, cards: cards.map((card) => ({ id: card.id, sources: card.sources, text: "시간과 이익을 함께 비교해 보세요." })) };
  const request = async () => ({ ok: true, json: async () => payload });
  assert((await narrateCoach(cards, "/api/coach", request)).mode.startsWith("AI 정성"));
  for (const text of ["이익 100만원 보장", "인력을 줄이면 무조건 성공", "", "법인전환 하세요"]) {
    payload.cards[0].text = text;
    assert((await narrateCoach(cards, "/api/coach", request)).mode.includes("실패"));
  }
  assert((await narrateCoach(cards, "https://other.test", request)).mode.includes("설정 오류"));
  assert((await narrateCoach(cards, "/api/coach", async () => { throw new Error("offline"); })).mode.includes("실패"));
});

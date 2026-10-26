import test from "node:test";
import assert from "node:assert/strict";
import { eligible, excessProfit, rankRound, roundPoints } from "../tools/league.mjs";

const round = { code: "s0r1", district: "seongsu", formats: ["specialty_cafe"], minOwnerHours: 3600 };
const row = (over) => ({ classCode: "S0R1", completed: true, district: "seongsu", format: "specialty_cafe", ownerHours: 4000, netProfit: 3000, hourlyWon: 7500, ...over });

test("league ranks by profit above minimum wage, keeps each player's best eligible run and shares ties", () => {
  assert.equal(excessProfit(row({ netProfit: 3000, ownerHours: 1000 })), 3000 - 1032);
  assert.equal(eligible(row({ district: "gangnam" }), round), false);
  assert.equal(eligible(row({ ownerHours: 730 }), round), false, "오너 매니저는 풀타임 조건을 못 지킨다");
  assert.equal(eligible(row({ completed: false }), round), false);
  const ranked = rankRound([
    { name: "가", row: row({ netProfit: 2000 }) },
    { name: "가", row: row({ netProfit: 5000 }) },
    { name: "나", row: row({ netProfit: 5000 }) },
    { name: "다", row: row({ netProfit: 9000, ownerHours: 730 }) },
    { name: "라", row: row({ netProfit: 1000 }) },
  ], round);
  assert.deepEqual(ranked.map((item) => [item.name, item.rank, item.attempts]), [["가", 1, 2], ["나", 1, 1], ["라", 3, 1]]);
  assert.equal(roundPoints(1), 20);
  assert.equal(roundPoints(15), 10);
});

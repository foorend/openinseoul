import test from "node:test";
import assert from "node:assert/strict";
import { SOURCES, sourceLine, survivalFor } from "../src/sources.js";
import { GAME_CONFIG, DISTRICTS, LEASE_RULE, PUBLIC_META } from "../src/data.js";
import { yearEndSettlement } from "../src/campaign.js";

test("official reference units and tax brackets are explicit", () => {
  assert.equal(GAME_CONFIG.minimumWage, 10320);
  assert(DISTRICTS.every((district) => district.hourlyWage >= GAME_CONFIG.minimumWage));
  assert.equal(110 * GAME_CONFIG.taxRate, 10);
  const tax = (base) => yearEndSettlement({ months: [{ revenue: base, totalCost: 0, costs: { insurance: 0, labor: 0, rent: 0 } }], businessTypeId: "corp" }).tax;
  assert.equal(tax(20000), 2000);
  assert(Math.abs(tax(20001) - 2000.2) < 1e-8);
  assert.equal(tax(2000000), 398000);
  assert.equal(tax(30000000), 6558000);
  assert.equal(tax(30000001), 6558000.25);
});

test("public data drives rent, deposit, competition and demand", () => {
  for (const district of DISTRICTS) {
    const { area, rentFloor } = district.public;
    const perPyeong = rentFloor === "1층" ? area.rentFirstFloor : area.rentUpperFloor;
    assert.equal(district.lease.monthlyRent, Math.round((perPyeong * LEASE_RULE.basePyeong) / 10000));
    assert.equal(district.lease.deposit, district.lease.monthlyRent * LEASE_RULE.depositMonths);
    assert.ok(district.competition >= 50 && district.competition <= 90);
    assert.ok(district.demand > 0);
  }
  const busiest = DISTRICTS.reduce((a, b) => (a.public.area.stores >= b.public.area.stores ? a : b));
  assert.equal(busiest.competition, 90, "점포가 가장 많은 동네가 경쟁 90");
  assert.ok(SOURCES.filter((source) => source.url?.includes("golmok")).every((source) => source.period.includes(PUBLIC_META.quarter)));
});

test("a thin survival sample falls back to the 자치구 value", () => {
  const sample = { public: { gu: "테스트구", dongs: ["테스트동"], area: { survival3y: 10, survival3yBase: 10, operatingYears: 3 }, guAvg: { survival3y: 47, survival3yBase: 214, operatingYears: 2.9 } } };
  assert.deepEqual(survivalFor(sample), { rate: 47, base: 214, years: 2.9, where: "테스트구 전체(동 표본 10곳)" });
  sample.public.area.survival3yBase = 30;
  assert.equal(survivalFor(sample).rate, 10);
});

test("every screen shows where its numbers come from", () => {
  for (const view of ["landing", "wizard", "brief", "operations", "report", "monthClose", "final"]) {
    assert.match(sourceLine({ view, stepId: "format", district: DISTRICTS[0] }), /출처 보기/);
  }
  assert.ok(sourceLine({ view: "wizard", stepId: "district", district: DISTRICTS[2] }).includes(DISTRICTS[2].public.dongs[0]));
});

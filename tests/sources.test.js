import test from "node:test";
import assert from "node:assert/strict";
import { readPopulation, SEOUL_SAMPLE, SOURCES } from "../src/sources.js";
import { GAME_CONFIG, DISTRICTS } from "../src/data.js";
import { yearEndSettlement } from "../src/campaign.js";

test("official reference units, tax brackets and missing public fields are explicit", () => {
  assert.equal(GAME_CONFIG.minimumWage, 10320);
  assert(DISTRICTS.every((district) => district.hourlyWage >= GAME_CONFIG.minimumWage));
  assert.equal(110 * GAME_CONFIG.taxRate, 10);
  const tax = (base) => yearEndSettlement({ months: [{ revenue: base, totalCost: 0, costs: { insurance: 0, labor: 0, rent: 0 } }], businessTypeId: "corp" }).tax;
  assert.equal(tax(20000), 2000);
  assert(Math.abs(tax(20001) - 2000.2) < 1e-8);
  assert.equal(tax(2000000), 398000);
  assert.equal(tax(30000000), 6558000);
  assert.equal(tax(30000001), 6558000.25);
  const row = readPopulation(SEOUL_SAMPLE);
  assert.equal(row.area, "3120213");
  assert.equal(row.quarter, "20251");
  assert.equal(row.bands[2].index, 1);
  assert.equal(row.bands[0].perHour, 389302 / 6);
  assert.throws(() => readPopulation({ ...SEOUL_SAMPLE, TMZON_11_14_FLPOP_CO: undefined }), /누락/);
  assert.throws(() => readPopulation({ ...SEOUL_SAMPLE, STDR_YYQU_CD: "20255" }), /분기/);
  for (const invalid of [" ", false, [], null, -1]) assert.throws(() => readPopulation({ ...SEOUL_SAMPLE, TMZON_11_14_FLPOP_CO: invalid }), /누락/);
  assert(SOURCES.find((source) => source.id === "seoul").kind.includes("미적용"));
});

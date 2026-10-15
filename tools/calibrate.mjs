// 상권 수요 계수(DEMAND_INDEX) 산출: 기준 매장(스페셜티·18석)의 연평균 월매출이
// '행정동 커피-음료 점포당 실제 월매출 × STORE_SCALE'에 맞도록 반복 보정한다.
// 사용: node tools/calibrate.mjs  → 출력된 DEMAND_INDEX를 src/data.js에 붙여 넣는다.
import { BEAN_TIERS, DISTRICTS, FORMATS, GAME_CONFIG, HOUR_PLANS, MENUS, OWNER_ROLES, STORE_SCALE, getById } from "../src/data.js";
import { RestaurantSimulation } from "../src/sim.js";
import { buildMonthSummary, seasonFactor } from "../src/campaign.js";

export function referenceYear(districtId) {
  const sim = new RestaurantSimulation({
    seed: "CALIBRATE", district: getById(DISTRICTS, districtId), format: getById(FORMATS, "specialty_cafe"),
    menus: ["americano", "latte", "signature"].map((id) => getById(MENUS, id)),
    beanTier: getById(BEAN_TIERS, "standard"), ownerRole: getById(OWNER_ROLES, "fulltime"), hourPlan: getById(HOUR_PLANS, "standard"),
    cash: 5000, reputation: GAME_CONFIG.reputationBase, awareness: GAME_CONFIG.awarenessBase, hygiene: GAME_CONFIG.hygieneBase,
  });
  const months = [];
  for (let month = 1; month <= 12; month += 1) {
    sim.demandFactor = seasonFactor(month, districtId);
    sim.startDay(1); const weekdayReport = sim.runToEnd();
    sim.startDay(6); const weekendReport = sim.runToEnd();
    months.push(buildMonthSummary({ monthNumber: month, districtId, weekdayReport, weekendReport }));
  }
  const avg = (key) => months.reduce((sum, m) => sum + key(m), 0) / 12;
  return { revenue: avg((m) => m.revenue), profit: avg((m) => m.profit), rent: avg((m) => m.costs.rent ?? 0) };
}

if (process.argv[1]?.endsWith("calibrate.mjs")) {
  const target = (district) => (district.public.area.salesPerStoreMonthly / 10000) * STORE_SCALE;
  for (let round = 0; round < 6; round += 1) {
    for (const district of DISTRICTS) district.demand *= target(district) / referenceYear(district.id).revenue;
  }
  for (const district of DISTRICTS) {
    const r = referenceYear(district.id);
    console.log(`${district.id.padEnd(9)} 수요 ${district.demand.toFixed(3)} | 월매출 ${r.revenue.toFixed(0)}만 (목표 ${target(district).toFixed(0)}) | 이익 ${r.profit.toFixed(0)}만 | 월세 ${r.rent.toFixed(0)}만`);
  }
  console.log(`const DEMAND_INDEX = { ${DISTRICTS.map((d) => `${d.id}: ${d.demand.toFixed(3)}`).join(", ")} };`);
}

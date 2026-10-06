import { DATA_VERSION, HOUR_PLANS, STAFFING_PLANS, OWNER_ROLES, getById } from "./data.js?release=20261006";
import { RestaurantSimulation } from "./sim.js?release=20261006";
import { buildMonthSummary } from "./campaign.js?release=20261006";

export function compareCondition(saved, { monthNumber, businessTypeId, loanAmount = 0 }, change) {
  const choices = { hourPlan: HOUR_PLANS, staffing: STAFFING_PLANS, ownerRole: OWNER_ROLES };
  if (!choices[change.key] || !getById(choices[change.key], change.id)) throw new Error("지원하지 않는 비교 조건입니다");
  const baseline = RestaurantSimulation.fromState(saved);
  const candidate = RestaurantSimulation.fromState(saved);
  candidate[change.key] = getById(choices[change.key], change.id);
  const run = (sim) => {
    sim.startDay(1);
    const weekdayReport = sim.runToEnd();
    sim.startDay(6);
    const weekendReport = sim.runToEnd();
    return buildMonthSummary({ monthNumber, districtId: sim.district.id, businessTypeId, loanAmount, weekdayReport, weekendReport, oneOff: sim.monthSpending });
  };
  const before = run(baseline);
  const after = run(candidate);
  return {
    version: DATA_VERSION, seed: baseline.seed, change,
    from: baseline[change.key].id, to: candidate[change.key].id,
    before, after,
    delta: { profit: after.profit - before.profit, ownerMinutes: after.ownerMinutes - before.ownerMinutes, served: after.served - before.served },
    policy: "두 조건 모두 사장 자동 배치 · 같은 시작 상태/난수 기준 · 실제 매출 예측 아님",
  };
}

import { DATA_VERSION, HOUR_PLANS, STAFFING_PLANS, OWNER_ROLES, MENUS, getById } from "./data.js?release=20261006d";
import { RestaurantSimulation, hasScheduledStaff, formatMoney } from "./sim.js?release=20261006d";
import { buildMonthSummary } from "./campaign.js?release=20261006d";

export function experimentChoices(saved, { bakeryGearBought = false } = {}) {
  const data = saved.data;
  const groups = [["hourPlan", "영업시간", HOUR_PLANS], ["staffing", "직원 편성", STAFFING_PLANS], ["ownerRole", "사장 근무", OWNER_ROLES]];
  const choices = groups.flatMap(([key, label, items]) => items.filter(item => item.id !== data[key].id && (key !== "staffing" || hasScheduledStaff(data.format, data.supplyMode, data.hires))).map(item => ({ key, id: item.id, label: `${label} · ${item.name}${key === "staffing" && item.ownerExtraHours ? ` (사장 하루 +${item.ownerExtraHours}시간, 영업시간 한도)` : ""}` })));
  for (const old of data.menus) for (const menu of MENUS) {
    if (data.menus.some(item => item.id === menu.id)) continue;
    if (menu.bakeryOnly && !data.format.bakes && (data.format.id === "solo_cafe" || !bakeryGearBought || data.menus.filter(item => item.bakeryOnly && item.id !== old.id).length >= 2)) continue;
    choices.push({ key: "menu", id: `${old.id}>${menu.id}`, label: `메뉴 · ${old.name} → ${menu.name}` });
  }
  return choices;
}

export function applyCondition(sim, change, context) {
  if (!experimentChoices(sim.exportState(), context).some(item => item.key === change?.key && item.id === change.id)) throw new Error("현재 가게에 적용할 수 없는 비교 조건입니다");
  if (change.key === "menu") {
    const [old, next] = change.id.split(">");
    sim.setMenus(sim.menus.map(menu => menu.id === old ? getById(MENUS, next) : menu));
  } else if (change.key === "staffing") sim.setStaffing(getById(STAFFING_PLANS, change.id));
  else sim[change.key] = getById({ hourPlan: HOUR_PLANS, ownerRole: OWNER_ROLES }[change.key], change.id);
}

export function laborTradeoff(result) {
  const hours = result.delta.ownerMinutes / 60;
  const profit = result.delta.profit;
  if (Math.abs(hours) < .01) return "내 노동시간은 거의 같습니다. 이익과 제공 인원, 내 운영 목표를 함께 판단하세요.";
  if (hours > 0) return profit > 0
    ? `월 ${hours.toFixed(1)}시간을 더 일해 ${formatMoney(profit)}가 늘어납니다. 추가 노동 1시간당 증가 이익은 ${formatMoney(profit / hours)}입니다. 전체 사장 시급이나 보장 수입이 아닙니다.`
    : `월 ${hours.toFixed(1)}시간을 더 일하지만 이익은 늘지 않습니다. 더 일할 이유가 있는지 확인하세요.`;
  return profit < 0
    ? `월 ${Math.abs(hours).toFixed(1)}시간을 덜 일하는 대신 이익 ${formatMoney(-profit)}를 포기합니다. 확보한 시간 1시간당 ${formatMoney(profit / hours)}의 비용입니다.`
    : `월 ${Math.abs(hours).toFixed(1)}시간을 덜 일하고 이익도 줄지 않습니다. 같은 가정 아래의 결과이며 실제 현장에서는 확인이 필요합니다.`;
}

// ponytail: 임대료만 바꾸는 장부 민감도 비교. 수요·설비·매출은 재추정하지 않는다.
export function compareBudget(summary, inputs) {
  for (const key of ["capital", "investment", "rent", "living"]) {
    if (typeof inputs[key] !== "number" || !Number.isFinite(inputs[key]) || inputs[key] < 0 || inputs[key] > 1000000) throw new Error("금액은 0~1,000,000만원 범위의 숫자로 입력하세요.");
  }
  if (![summary?.profit, summary?.costs?.rent, summary?.ownerMinutes].every(Number.isFinite)) throw new Error("비교할 월 마감 기록이 없습니다.");
  const profit = summary.profit + summary.costs.rent - inputs.rent;
  const openingCash = inputs.capital - inputs.investment;
  const afterLiving = profit - inputs.living;
  return { month: summary.monthNumber, inputs: { ...inputs }, baselineProfit: summary.profit, baselineRent: summary.costs.rent, profit, openingCash, afterLiving,
    ownerHours: summary.ownerMinutes / 60, runway: openingCash < 0 ? 0 : afterLiving < 0 ? openingCash / -afterLiving : null };
}

export function compareCondition(saved, { monthNumber, businessTypeId, loanAmount = 0, bakeryGearBought = false }, change) {
  const baseline = RestaurantSimulation.fromState(saved);
  const candidate = RestaurantSimulation.fromState(saved);
  applyCondition(candidate, change, { bakeryGearBought });
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
    from: change.key === "menu" ? change.id.split(">")[0] : baseline[change.key].id,
    to: change.key === "menu" ? change.id.split(">")[1] : candidate[change.key].id,
    before, after,
    delta: { profit: after.profit - before.profit, ownerMinutes: after.ownerMinutes - before.ownerMinutes, served: after.served - before.served },
    policy: "두 조건 모두 사장 자동 배치 · 같은 시작 상태/난수 기준 · 실제 매출 예측 아님",
  };
}

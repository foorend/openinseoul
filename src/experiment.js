import { DATA_VERSION, HOUR_PLANS, STAFFING_PLANS, OWNER_ROLES, MENUS, getById } from "./data.js?release=20261006c";
import { RestaurantSimulation } from "./sim.js?release=20261006c";
import { buildMonthSummary } from "./campaign.js?release=20261006c";

export function experimentChoices(saved, { bakeryGearBought = false } = {}) {
  const data = saved.data;
  const groups = [["hourPlan", "영업시간", HOUR_PLANS], ["staffing", "직원 편성", STAFFING_PLANS], ["ownerRole", "사장 근무", OWNER_ROLES]];
  const choices = groups.flatMap(([key, label, items]) => items.filter(item => item.id !== data[key].id).map(item => ({ key, id: item.id, label: `${label} · ${item.name}` })));
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
  } else sim[change.key] = getById({ hourPlan: HOUR_PLANS, staffing: STAFFING_PLANS, ownerRole: OWNER_ROLES }[change.key], change.id);
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

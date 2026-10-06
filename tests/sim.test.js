import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_ACTIONS,
  BEAN_TIERS,
  CUSTOMERS,
  DISTRICTS,
  DELIVERY_COMMISSION,
  DILEMMAS,
  FORMATS,
  GAME_CONFIG,
  HOUR_PLANS,
  MANAGER_WEAR_LIMIT,
  STAFFING_PLANS,
  MENUS,
  OWNER_ROLES,
  getById,
} from "../src/data.js";
import { phaseAt, hiredLaborCost, RestaurantSimulation, clamp, keyedRandom } from "../src/sim.js";
import { buildMonthSummary, monthInfo, seasonFactor, yearEndSettlement, yearGrade } from "../src/campaign.js";
import { compareCondition } from "../src/experiment.js";

function configuration({
  district = "gangnam",
  format = "specialty_cafe",
  menus = ["americano", "latte", "signature"],
  beanTier = "standard",
  ownerRole = "fulltime",
  hourPlan = "standard",
  upgrades = [],
  campaigns = [],
  ownerStats = undefined,
} = {}) {
  return {
    seed: "OPEN_IN_SEOUL_CAFE_TEST_V1",
    district: getById(DISTRICTS, district),
    format: getById(FORMATS, format),
    menus: menus.map((id) => getById(MENUS, id)),
    beanTier: getById(BEAN_TIERS, beanTier),
    ownerRole: getById(OWNER_ROLES, ownerRole),
    hourPlan: getById(HOUR_PLANS, hourPlan),
    cash: 5000,
    reputation: GAME_CONFIG.reputationBase,
    awareness: GAME_CONFIG.awarenessBase,
    hygiene: GAME_CONFIG.hygieneBase,
    upgrades,
    campaigns,
    ownerStats,
  };
}

function run(config, step = 0.1) {
  const simulation = new RestaurantSimulation(config);
  simulation.startDay(1);
  return { simulation, report: simulation.runToEnd(step) };
}

test("keyed random values are stable and clamped", () => {
  const values = Array.from({ length: 100 }, (_, index) => keyedRandom("seed", index, "stage"));
  assert.deepEqual(values, Array.from({ length: 100 }, (_, index) => keyedRandom("seed", index, "stage")));
  assert.ok(values.every((value) => value >= 0 && value < 1 && Number.isFinite(value)));
  assert.equal(clamp(Number.NaN), 0);
  assert.equal(clamp(2), 1);
});

test("same seed and setup produce an identical close report", () => {
  const first = run(configuration()).report;
  const second = run(configuration()).report;
  assert.deepEqual(first, second);
});

test("render/update cadence cannot change the simulation result", () => {
  const fastFrames = run(configuration(), 1 / 240).report;
  const slowFrames = run(configuration(), 0.37).report;
  assert.deepEqual(fastFrames, slowFrames);
});

test("the customer funnel is monotonic and the consulting ledger balances", () => {
  const { report } = run(configuration());
  const m = report.metrics;
  assert.ok(m.footfall >= m.aware);
  assert.ok(m.aware >= m.entered);
  assert.ok(m.entered >= m.ordered);
  assert.ok(m.ordered >= m.served);
  assert.ok(m.served >= m.satisfied);
  assert.ok(m.served >= m.reviewed);
  assert.ok(m.waits.every((wait) => wait >= 0 && Number.isFinite(wait)));
  assert.ok(m.satisfactions.every((score) => score >= 0 && score <= 1 && Number.isFinite(score)));

  // 세금 10% + 공과금·복리후생 5%가 매출 기준으로 정확히 계산된다
  assert.ok(Math.abs(m.taxCost - m.revenue * GAME_CONFIG.taxRate) < 1e-9);
  assert.ok(Math.abs(m.utilityCost - m.revenue * GAME_CONFIG.utilityRate) < 1e-9);

  const expectedCash = 5000 - m.laborCost - m.rentCost + m.revenue
    - m.foodCost - m.platformCost - m.wasteCost - m.actionCost - m.taxCost - m.utilityCost;
  assert.ok(Math.abs(report.cash - expectedCash) < 1e-9);
  assert.ok(Math.abs(m.profit - (m.revenue - m.foodCost - m.platformCost - m.wasteCost - m.laborCost - m.rentCost - m.taxCost - m.utilityCost - m.actionCost)) < 1e-9);
});

test("cheap beans lower food cost but also satisfaction", () => {
  const cheap = run(configuration({ beanTier: "value" })).report.metrics;
  const premium = run(configuration({ beanTier: "specialty" })).report.metrics;
  const cheapRatio = cheap.foodCost / Math.max(1e-9, cheap.revenue);
  const premiumRatio = premium.foodCost / Math.max(1e-9, premium.revenue);
  assert.ok(cheapRatio < premiumRatio);
  assert.ok(cheap.averageSatisfaction < premium.averageSatisfaction);
});

function runStation(station, overrides = {}) {
  const simulation = new RestaurantSimulation(configuration(overrides));
  simulation.startDay(1);
  const report = simulation.runToEnd();
  return { simulation, report };
}

// 하루 종일 한 자리에만 서 있게 고정한다 (자동 판단을 끈다).
function runFixedStation(station, overrides = {}) {
  const simulation = new RestaurantSimulation(configuration(overrides));
  simulation.startDay(1);
  simulation.toggleOwnerWork(true);
  simulation.ownerStation = station;
  simulation.stationArrivesAt = simulation.gameMinute;
  simulation.setSpeed(4);
  let guard = 0;
  while (!simulation.finished && guard < 6000) {
    simulation.ownerStation = station;
    simulation.stationArrivesAt = Math.min(simulation.stationArrivesAt, simulation.gameMinute);
    simulation.update(0.1);
    guard += 1;
  }
  return { simulation, report: simulation.lastReport };
}

test("standing at the bar clears the queue; standing in the hall clears the seats", () => {
  const bar = runFixedStation("bar").report.metrics;
  const hall = runFixedStation("hall").report.metrics;
  // 각 자리는 자기 병목만 고친다 — 그래서 어디에 설지가 결정이 된다
  assert.ok(bar.losses.wait <= hall.losses.wait, "바에 서면 대기 이탈이 줄어든다");
  assert.ok(hall.losses.full <= bar.losses.full, "홀에 서면 좌석 이탈이 줄어든다");
  assert.ok(bar.averageWait <= hall.averageWait + 1e-9, "바에 서면 평균 대기가 짧아진다");
});

test("the door station converts passers-by that the other stations never see", () => {
  const door = runFixedStation("door").report.metrics;
  const bar = runFixedStation("bar").report.metrics;
  assert.ok(door.aware > bar.aware, "입구에 서면 더 많은 사람이 가게를 인지한다");
  assert.ok(door.losses.awareness < bar.losses.awareness, "그냥 지나치는 사람이 줄어든다");
  assert.ok((door.ownerActions?.flyers ?? 0) > 0, "전단지가 자동으로 나간다 — 따로 클릭할 필요가 없다");
});

test("a solo cafe has nobody to bus tables, so the hall is the owner's job", () => {
  const solo = { district: "gangnam", format: "solo_cafe", menus: ["americano", "latte", "cheesecake"] };
  const atBar = runFixedStation("bar", solo).report.metrics;
  const atHall = runFixedStation("hall", solo).report.metrics;
  // 고용이 0명이면 사장이 홀에 서지 않는 한 아무도 테이블을 치우지 않는다
  assert.ok(atHall.losses.full < atBar.losses.full, "1인 카페에서 홀을 비우면 좌석이 막힌다");
  assert.ok(atHall.served > atBar.served, "그래서 홀에 서는 편이 더 많이 판다");
});

test("hired labor scales with opening hours; severance and insurance are billed monthly", () => {
  const { report } = run(configuration({ district: "gangnam", format: "bakery_cafe", menus: ["americano", "latte", "croissant"] }));
  const district = getById(DISTRICTS, "gangnam");
  const format = getById(FORMATS, "bakery_cafe");
  // 일 단위 인건비는 순수 시급 × 시간. 퇴직금·4대보험은 월 원장에서 따로 잡는다.
  const expected = format.hires.reduce(
    (sum, hire) => sum + (district.hourlyWage * hire.wageMultiplier * hire.hours) / 10000,
    0,
  );
  assert.ok(Math.abs(report.metrics.laborCost - expected) < 1e-9, "standard 13h plan is the baseline");

  // 짧게 열면 인건비가 그만큼 줄고, 길게 열면 늘어난다.
  const short = run(configuration({ district: "gangnam", format: "bakery_cafe", menus: ["americano", "latte", "croissant"], hourPlan: "short" })).report;
  const long = run(configuration({ district: "gangnam", format: "bakery_cafe", menus: ["americano", "latte", "croissant"], hourPlan: "long" })).report;
  assert.ok(short.metrics.laborCost < report.metrics.laborCost);
  assert.ok(long.metrics.laborCost > report.metrics.laborCost);
  assert.ok(Math.abs(short.metrics.laborCost - expected * (8 / 13)) < 1e-9);
});

test("opening hours bound the day, the arrivals, and the owner's clock", () => {
  for (const plan of HOUR_PLANS) {
    const { simulation, report } = run(configuration({ hourPlan: plan.id }));
    assert.equal(simulation.gameMinute, plan.close * 60, `${plan.id} closes on time`);
    assert.equal(report.metrics.hourly.length, plan.close - plan.open);
    assert.ok(report.metrics.hourly.every((slot) => slot.hour >= plan.open && slot.hour < plan.close));
    assert.ok(simulation.arrivals.every((arrival) => arrival.hour >= plan.open && arrival.hour < plan.close));
    assert.ok(report.metrics.ownerMinutes <= (plan.close - plan.open) * 60 + simulation.ownerInterventionMinutes);
  }
});

test("an early opening in Gangnam catches commute demand a standard opening misses", () => {
  const early = run(configuration({ district: "gangnam", hourPlan: "early" })).report.metrics;
  const standard = run(configuration({ district: "gangnam", hourPlan: "standard" })).report.metrics;
  const earlyMorning = early.hourly.filter((slot) => slot.hour < 10).reduce((sum, slot) => sum + slot.footfall, 0);
  assert.ok(earlyMorning > 0, "early plan sees pre-10am footfall");
  assert.ok(standard.hourly.every((slot) => slot.hour >= 10));
});

test("re-opening the same day after changing hours does not double-charge fixed costs", () => {
  const simulation = new RestaurantSimulation(configuration());
  simulation.startDay(1);
  const afterFirst = simulation.cash;
  const firstCharge = 5000 - afterFirst;
  assert.ok(firstCharge > 0, "고정비가 한 번 청구된다");

  // 아침 브리핑에서 영업시간을 바꾸면 startDay가 같은 날에 다시 호출된다.
  simulation.setHourPlan(getById(HOUR_PLANS, "short"));
  simulation.startDay(1);
  const shortCharge = 5000 - simulation.cash;
  assert.ok(shortCharge < firstCharge, "짧게 열면 고정비가 줄어든다");
  assert.ok(Math.abs(shortCharge - (simulation.metrics.laborCost + simulation.metrics.rentCost)) < 1e-9,
    "직전 청구가 되돌려져 이중 청구가 없다");
});

test("actions charge once and permanent upgrades cannot duplicate", () => {
  const simulation = new RestaurantSimulation(configuration());
  const sign = getById(ALL_ACTIONS, "sidewalk_sign");
  const flyer = getById(ALL_ACTIONS, "local_flyer");
  const cost = simulation.applyActions([sign, flyer]);
  assert.equal(cost, sign.cost + flyer.cost);
  assert.equal(simulation.cash, 5000 - cost);
  simulation.applyActions([sign]);
  assert.equal(simulation.upgrades.filter((id) => id === "sidewalk_sign").length, 1);
});

test("all legal district and cafe-type combinations complete without invalid numbers", () => {
  for (const district of DISTRICTS) {
    for (const format of FORMATS) {
      const menus = format.id === "bakery_cafe"
        ? ["americano", "latte", "saltbread"]
        : ["americano", "latte", "signature"];
      const { report } = run(configuration({ district: district.id, format: format.id, menus }));
      const m = report.metrics;
      assert.ok(Number.isFinite(report.cash), `${district.id}/${format.id} cash`);
      assert.ok(Number.isFinite(m.profit), `${district.id}/${format.id} profit`);
      assert.ok(m.footfall > 0, `${district.id}/${format.id} demand`);
      assert.ok(m.ownerMinutes > 0, `${district.id}/${format.id} owner hours`);
      for (const customer of CUSTOMERS) {
        assert.ok(m.byType[customer.id].footfall >= 0);
        assert.ok(m.byType[customer.id].served >= 0);
      }
    }
  }
});

// ── 캠페인·세금 ──────────────────────────────────────────────

test("a month extrapolates from the two played days and adds monthly-only costs", () => {
  const weekday = run(configuration()).report;
  const weekend = run(configuration()).report;
  const summary = buildMonthSummary({
    monthNumber: 3,
    districtId: "gangnam",
    weekdayReport: weekday,
    weekendReport: weekend,
  });

  const info = monthInfo(3);
  assert.equal(summary.days.weekdays, info.weekdays);
  // 일 단위 시뮬레이션에 없던 비용이 반드시 추가된다
  assert.ok(summary.costs.insurance >= 0);
  assert.ok(summary.costs.cardFee > 0, "카드 수수료가 붙는다");
  assert.ok(summary.costs.supplies > 0, "소모품비가 붙는다");
  assert.ok(summary.monthlyOnly > 0);
  // 하루 이익 × 일수보다 월 이익이 반드시 작다 — 이게 이 게임의 교육 포인트
  const naive = weekday.metrics.profit * info.weekdays + weekend.metrics.profit * info.weekends;
  assert.ok(summary.profit < naive, "월 단위로 보면 하루 장사 감각보다 항상 적게 남는다");
});

test("flyer minigame hooks — walk-ins, random reviewers, jinsang, troll lockout", () => {
  const simulation = new RestaurantSimulation(configuration());
  simulation.startDay(1);
  simulation.setSpeed(1);
  for (let i = 0; i < 40; i += 1) simulation.update(0.2);
  assert.equal(simulation.finished, false, "아직 영업 중이어야 한다");

  // 전단지로 잡은 행인은 반드시 들어오는 손님이 된다
  const before = simulation.activeAgents.length;
  const agent = simulation.injectWalkin("maybe");
  assert.ok(agent && agent.forcedEntry, "미니게임 손님은 강제 입장 플래그를 단다");
  assert.equal(simulation.activeAgents.length, before + 1);

  // 리뷰어는 복불복 — 좋은 리뷰와 나쁜 리뷰가 각각 카운트에 쌓인다
  for (let i = 0; i < 30; i += 1) simulation.injectWalkin("reviewer");
  const good = simulation.pendingGoodReviews ?? 0;
  const bad = simulation.pendingBadReviews;
  assert.equal(good + bad, 30, "리뷰어 30명은 전부 어느 한쪽으로 판정된다");
  assert.ok(good > 0 && bad > 0, `복불복이 실제로 갈린다 (호평 ${good} · 혹평 ${bad})`);
  simulation.startDay(2);
  const expected = Math.min(1.2, Math.max(0.5, 1 - 0.01 * bad + 0.01 * good));
  assert.ok(Math.abs(simulation.reviewPenalty - expected) < 1e-9, "다음 날 수요에 ±1%/명으로 반영된다");

  // 진상 워크인 — 돈은 안 내고 평판과 스트레스만 갉는다
  const reputationBefore = simulation.reputation;
  const stressBefore = simulation.ownerStress;
  const result = simulation.jinsangWalkin();
  assert.ok(result.ok);
  assert.ok(simulation.reputation < reputationBefore, "평판이 긁힌다");
  assert.ok(simulation.ownerStress > stressBefore, "사장 스트레스가 오른다");

  // 시비꾼 API(진상 딜레마 등에서 재사용): 30분 입구 봉쇄
  simulation.setSpeed(1);
  for (let i = 0; i < 60; i += 1) simulation.update(0.2);
  const troll = simulation.trollEncounter();
  assert.ok(troll.ok);
  assert.ok(simulation.doorBlockedUntil >= simulation.gameMinute + 30, "30분간 입구가 막힌다");
});
test("jinsang customers haunt Gangnam hall shifts more than anywhere else", () => {
  // 같은 시드로 강남과 강동에서 사장을 홀에 세워 두고 30일을 돌려 출몰 횟수를 센다
  const countJinsang = (districtId) => {
    let count = 0;
    for (let day = 1; day <= 30; day += 1) {
      const simulation = new RestaurantSimulation(configuration({ district: districtId }));
      simulation.startDay(day);
      simulation.toggleOwnerWork(true);
      simulation.ownerStation = "hall";
      simulation.stationArrivesAt = simulation.gameMinute;
      simulation.setOwnerAuto(false);
      simulation.setSpeed(4);
      let guard = 0;
      while (!simulation.finished && guard < 4000) {
        simulation.ownerStation = "hall";
        simulation.stationArrivesAt = Math.min(simulation.stationArrivesAt, simulation.gameMinute);
        simulation.update(0.5);
        guard += 1;
      }
      count += simulation.jinsangToday;
    }
    return count;
  };
  const gangnam = countJinsang("gangnam");
  const gangdong = countJinsang("gangdong");
  assert.ok(gangnam > 0, `강남에는 진상이 출몰한다 (${gangnam}회/30일)`);
  assert.ok(gangnam > gangdong, `강남(${gangnam})이 강동(${gangdong})보다 잦다`);
});

test("hall service calls — hall staff cover slowly, nobody at all costs satisfaction", () => {
  const simulation = new RestaurantSimulation(configuration({ format: "solo_cafe" }));
  simulation.startDay(1);
  simulation.setSpeed(4);
  let called = 0;
  let guard = 0;
  while (!simulation.finished && guard < 6000) {
    simulation.update(0.5);
    called = Math.max(called, simulation.activeAgents.filter((a) => a.serviceRequested).length);
    guard += 1;
  }
  assert.ok(called > 0, "식사 중 손님이 실제로 손을 든다");
  // 1인 카페 + 사장이 안 가면 페널티가 박힌다
  const report = simulation.lastReport;
  assert.ok(report, "하루가 정상 종료된다");
});

test("the month summary aggregates loss causes so the close report can coach", () => {
  const simulation = new RestaurantSimulation(configuration());
  simulation.startDay(1);
  const weekdayReport = simulation.runToEnd();
  simulation.startDay(6);
  const weekendReport = simulation.runToEnd();
  const summary = buildMonthSummary({ monthNumber: 4, districtId: "gangnam", weekdayReport, weekendReport });

  assert.ok(summary.losses && typeof summary.losses === "object", "월 요약에 이탈 원인이 집계된다");
  for (const [key, weekdayCount] of Object.entries(weekdayReport.metrics.losses)) {
    const expected = Math.round(weekdayCount * summary.days.weekdays + (weekendReport.metrics.losses[key] ?? 0) * summary.days.weekends);
    assert.equal(summary.losses[key], expected, `${key} 이탈이 영업일수만큼 확장된다`);
  }
});

test("seasonality bends by district — 신촌 empties out in the school holidays", () => {
  assert.ok(seasonFactor(8, "sinchon") < seasonFactor(8, "seongsu"));
  assert.ok(seasonFactor(1, "sinchon") < 0.8, "방학에는 대학가가 비워진다");
  assert.equal(seasonFactor(3, "gangdong"), monthInfo(3).season, "예외가 없으면 기본 계수를 쓴다");
});

test("income tax is progressive and the corporate route wins only at scale", () => {
  const smallMonths = Array.from({ length: 12 }, () => ({
    revenue: 900, totalCost: 800, costs: { vat: 90, insurance: 5, labor: 300, rent: 160 },
  }));
  const bigMonths = Array.from({ length: 12 }, () => ({
    revenue: 4200, totalCost: 2600, costs: { vat: 420, insurance: 30, labor: 900, rent: 400 },
  }));

  const smallSole = yearEndSettlement({ months: smallMonths, businessTypeId: "sole", ownerHours: 2000 });
  const bigSole = yearEndSettlement({ months: bigMonths, businessTypeId: "sole", ownerHours: 2000 });

  // 누진세: 이익이 커지면 실효세율도 올라간다
  assert.ok(smallSole.tax / Math.max(1, smallSole.taxableBase) < bigSole.tax / bigSole.taxableBase);
  // 이익이 작을 때는 개인이, 클 때는 법인이 유리하다
  assert.ok(smallSole.tax <= smallSole.alternativeTax + 1e-9, "작은 이익에선 개인이 불리하지 않다");
  assert.ok(bigSole.tax > bigSole.alternativeTax, "큰 이익에선 법인세가 더 싸다");
  // 세후 순이익과 시급이 함께 계산된다
  assert.ok(bigSole.netProfit < bigSole.operatingProfit);
  assert.equal(bigSole.hourlyWon, Math.round((bigSole.netProfit * 10000) / 2000));
});

test("a loss-making year pays no income tax but still grades D", () => {
  const months = Array.from({ length: 12 }, () => ({
    revenue: 600, totalCost: 900, costs: { vat: 60, insurance: 5, labor: 300, rent: 200 },
  }));
  const settlement = yearEndSettlement({ months, businessTypeId: "sole", ownerHours: 2400 });
  assert.equal(settlement.tax, 0);
  assert.ok(settlement.netProfit < 0);
  assert.equal(yearGrade(settlement, GAME_CONFIG.minimumWage), "D");
});

// ── 밸런스 잠금 ──────────────────────────────────────────────
// 이 게임의 교육 명제: "잘 고른 카페만 최저시급을 넘고, 대부분은 못 넘는다".
// 밸런스를 건드릴 때 이 곡선이 깨지면 게임의 메시지 자체가 무너지므로 테스트로 잠근다.

function runYearHeadless({ district, format, menus, bean, role, hours, upgrades = [] }) {
  const simulation = new RestaurantSimulation({
    seed: "BALANCE_LOCK",
    district: getById(DISTRICTS, district),
    format: getById(FORMATS, format),
    menus: menus.map((id) => getById(MENUS, id)),
    beanTier: getById(BEAN_TIERS, bean),
    ownerRole: getById(OWNER_ROLES, role),
    hourPlan: getById(HOUR_PLANS, hours),
    cash: 5000,
    reputation: GAME_CONFIG.reputationBase,
    awareness: GAME_CONFIG.awarenessBase,
    hygiene: GAME_CONFIG.hygieneBase,
    upgrades,
  });
  const months = [];
  let ownerMinutes = 0;
  for (let month = 1; month <= 12; month += 1) {
    simulation.demandFactor = seasonFactor(month, district);
    simulation.startDay(1);
    const weekdayReport = simulation.runToEnd();
    simulation.startDay(6);
    const weekendReport = simulation.runToEnd();
    const summary = buildMonthSummary({ monthNumber: month, districtId: district, weekdayReport, weekendReport });
    ownerMinutes += summary.ownerMinutes;
    months.push(summary);
  }
  const settlement = yearEndSettlement({ months, businessTypeId: "sole", ownerHours: ownerMinutes / 60 });
  return { months, settlement, grade: yearGrade(settlement, GAME_CONFIG.minimumWage) };
}

test("the manager covers for an absent owner, just slower", () => {
  // 사장이 하루 종일 자리를 비워도 매니저가 머신을 닦고 발주를 넣는다.
  // 다만 사장이 붙어 있을 때보다 늦게, 그래서 그 사이의 기회는 날아간다.
  const build = (role) => new RestaurantSimulation({
    seed: "MANAGER", district: getById(DISTRICTS, "seongsu"), format: getById(FORMATS, "bakery_cafe"),
    menus: ["americano", "latte", "saltbread"].map((id) => getById(MENUS, id)),
    beanTier: getById(BEAN_TIERS, "standard"), ownerRole: getById(OWNER_ROLES, role),
    hourPlan: getById(HOUR_PLANS, "standard"), cash: 5000,
    reputation: GAME_CONFIG.reputationBase, awareness: GAME_CONFIG.awarenessBase, hygiene: GAME_CONFIG.hygieneBase,
  });

  const absent = build("manager");
  absent.startDay(1);
  absent.toggleOwnerWork(false);          // 사장은 오늘 하루 가게에 들어오지 않는다
  absent.autoPilotOwner = () => {};
  const report = absent.runToEnd();

  assert.ok(report.metrics.ownerActions.machineCleans > 0, "사장이 없어도 머신은 청소된다");
  assert.ok(report.metrics.served > 0, "매니저만으로도 장사는 굴러간다");
  assert.ok(absent.machine.wear < MANAGER_WEAR_LIMIT, "매니저가 마모를 방치하지 않는다");

  // 직원이 없는 1인 카페에는 대신해 줄 사람이 없다.
  const solo = new RestaurantSimulation({
    seed: "MANAGER", district: getById(DISTRICTS, "gangdong"), format: getById(FORMATS, "solo_cafe"),
    menus: ["americano", "latte", "cheesecake"].map((id) => getById(MENUS, id)),
    beanTier: getById(BEAN_TIERS, "standard"), ownerRole: getById(OWNER_ROLES, "manager"),
    hourPlan: getById(HOUR_PLANS, "standard"), cash: 5000,
    reputation: GAME_CONFIG.reputationBase, awareness: GAME_CONFIG.awarenessBase, hygiene: GAME_CONFIG.hygieneBase,
  });
  solo.startDay(1);
  solo.toggleOwnerWork(false);
  solo.autoPilotOwner = () => {};
  solo.runToEnd();
  assert.equal(solo.hallStaffCount(), 0, "1인 카페에는 직원이 없다");
  assert.ok(solo.machine.wear > MANAGER_WEAR_LIMIT, "1인 카페에서 사장이 손을 놓으면 아무도 닦지 않는다");
});

test("Saturday has no office lunch rush", () => {
  // 토요일 점심에 직장인이 줄을 서는 카페는 없다.
  const build = () => new RestaurantSimulation({
    seed: "WEEKEND", district: getById(DISTRICTS, "gangnam"), format: getById(FORMATS, "specialty_cafe"),
    menus: ["americano", "latte", "cheesecake"].map((id) => getById(MENUS, id)),
    beanTier: getById(BEAN_TIERS, "standard"), ownerRole: getById(OWNER_ROLES, "peak"),
    hourPlan: getById(HOUR_PLANS, "standard"), cash: 5000,
    reputation: GAME_CONFIG.reputationBase, awareness: GAME_CONFIG.awarenessBase, hygiene: GAME_CONFIG.hygieneBase,
  });
  const weekday = build(); weekday.startDay(1);
  const weekdayShare = weekday.runToEnd().metrics.byType.office_worker.footfall / weekday.metrics.footfall;
  const weekend = build(); weekend.startDay(6);
  const weekendReport = weekend.runToEnd();
  const weekendShare = weekendReport.metrics.byType.office_worker.footfall / weekend.metrics.footfall;

  // 강남은 직장인 62% 상권이다. 평일에는 그 비중이 그대로 나와야 한다.
  assert.ok(weekdayShare > 0.5, `평일 강남은 직장인 상권이다 (${weekdayShare.toFixed(2)})`);
  // 주말에는 그 직장인들이 출근을 안 한다.
  assert.ok(weekendShare < 0.12, `토요일에는 직장인이 사라진다 (${weekendShare.toFixed(2)})`);
  // 대신 나들이·동네 손님이 그 자리를 채운다 — 손님 자체가 없어지는 게 아니다.
  assert.ok(weekendReport.metrics.footfall > 0, "주말에도 사람은 지나간다");
});

test("each district keeps its own rhythm — no office rush on a cafe street at noon", () => {
  const gangnam = getById(DISTRICTS, "gangnam");
  const seongsu = getById(DISTRICTS, "seongsu");
  // 강남 평일: 12시 반은 "식사 중 — 한산", 13시 반이 진짜 러시다
  assert.equal(phaseAt(750, gangnam, false).busy, undefined);
  assert.ok(phaseAt(810, gangnam, false).busy, "강남의 러시는 밥 먹고 난 다음이다");
  // 강남 주말: 출근 러시가 없다
  assert.ok(!phaseAt(540, gangnam, true).busy, "주말 강남에 출근 러시는 없다");
  // 성수 주말: 브런치·카페 투어가 피크다
  assert.ok(phaseAt(700, seongsu, true).busy, "성수 주말 낮은 피크다");
  // 상권 정보가 없으면 기본 페이즈로 안전하게 돌아간다
  assert.ok(phaseAt(840, null, false).id.length > 0);
});

test("overtime is unlimited but the body pays — stress climbs and hours are billed", () => {
  const simulation = new RestaurantSimulation(configuration());
  simulation.startDay(1);
  simulation.setOwnerAuto(false);
  simulation.setSpeed(4);
  // 정한 시간을 소진시킨다
  simulation.ownerBudgetLeft = 0;
  simulation.ownerWorking = false;

  // 시간이 0이어도 다시 출근할 수 있다 — 초과 근무
  const result = simulation.toggleOwnerWork(true);
  assert.ok(result.ok && result.overtime, "예산이 0이어도 초과 근무로 출근한다");

  const minutesBefore = simulation.ownerInterventionMinutes;
  const stressBefore = simulation.ownerStress;
  for (let i = 0; i < 600; i += 1) simulation.update(0.5);

  assert.ok(simulation.ownerInterventionMinutes > minutesBefore, "초과 근무 시간도 시급 계산에 들어간다");
  assert.ok(simulation.ownerStress > stressBefore, "초과 근무는 스트레스를 쌓는다");
  // 지친 사장은 보너스가 깎인다
  simulation.ownerStress = 100;
  assert.ok(simulation.stressFactor() <= 0.01, "스트레스 100이면 사장 보너스가 사라진다");
  simulation.ownerStress = 30;
  assert.equal(simulation.stressFactor(), 1, "50까지는 멀쩡하다");
  // 밤사이 회복
  simulation.ownerStress = 80;
  simulation.startDay(2);
  assert.ok(simulation.ownerStress < 80, "자고 나면 회복된다");
});

test("monthly hires change labor cost, hall coverage, and bar speed", () => {
  const simulation = new RestaurantSimulation(configuration({ format: "specialty_cafe" }));
  simulation.startDay(1);
  const baseLabor = hiredLaborCost(simulation.format, simulation.district, simulation.hourPlan, simulation.supplyMode, simulation.staffing, simulation.hires);
  const baseHall = simulation.hallStaffCount();

  simulation.addHire({ role: "홀 알바", hours: 8, wageMultiplier: 1.0 });
  simulation.addHire({ role: "바리스타", hours: 8, wageMultiplier: 1.15 });
  const grownLabor = hiredLaborCost(simulation.format, simulation.district, simulation.hourPlan, simulation.supplyMode, simulation.staffing, simulation.hires);
  assert.ok(grownLabor > baseLabor, "채용하면 인건비가 는다");
  assert.equal(simulation.hallStaffCount(), baseHall + 1, "홀 알바를 뽑으면 홀 인원이 는다");
  assert.equal(simulation.extraBaristaCount(), 1, "추가 바리스타가 잡힌다");

  // 해고: 명단에서 실제로 사라진다
  const fired = simulation.removeHire(simulation.hires.length - 1);
  assert.ok(fired.ok);
  assert.equal(simulation.extraBaristaCount(), 0);

  // 베이커리에서 굽는 중이면 마지막 베이커는 못 내보낸다
  const bakery = new RestaurantSimulation(configuration({ format: "bakery_cafe" }));
  const bakerIndex = bakery.hires.findIndex((hire) => hire.role === "베이커");
  const blocked = bakery.removeHire(bakerIndex);
  assert.equal(blocked.ok, false, "빵 구울 사람이 없어지는 해고는 막힌다");
});

test("owner stats bend the simulation — smart lowers cost, manual click turns off auto", () => {
  const dull = new RestaurantSimulation(configuration({ ownerStats: { kind: 3, smart: 1, charm: 3 } }));
  const sharp = new RestaurantSimulation(configuration({ ownerStats: { kind: 3, smart: 5, charm: 3 } }));
  const menu = dull.menus[0];
  assert.ok(sharp.menuCostRatio(menu) < dull.menuCostRatio(menu), "지성이 높으면 원가가 덜 샌다");

  // 수동이 기본 — 자동은 "결과를 빨리 보고 싶을 때" 켜는 모드다
  const simulation = new RestaurantSimulation(configuration());
  assert.equal(simulation.autoOwner, false, "기본은 수동 — 미니게임을 직접 뛴다");
  simulation.startDay(1);
  simulation.toggleOwnerWork(true);
  simulation.setOwnerAuto(true);
  assert.equal(simulation.autoOwner, true, "자동을 켜면 사장이 알아서 움직인다");
  simulation.moveOwner("hall");
  assert.equal(simulation.autoOwner, false, "직접 자리를 찍으면 자동이 꺼진다");
});

test("mid-campaign menu changes take effect from the next day", () => {
  const simulation = new RestaurantSimulation(configuration());
  const before = simulation.menus.length;
  const ade = getById(MENUS, "ade");
  const result = simulation.setMenus([...simulation.menus, ade]);
  assert.ok(result.ok);
  assert.equal(simulation.menus.length, before + 1);
  simulation.startDay(1);
  const report = simulation.runToEnd();
  assert.ok(report.metrics.served >= 0, "새 메뉴가 들어가도 하루가 정상 완주된다");
});

test("cutting staff hours moves the cost onto the owner, it does not delete it", () => {
  // 인건비가 감당이 안 될 때 쓰는 레버. 장부에서는 줄지만 사장의 하루가 길어진다.
  const build = (staffingId) => {
    const s = new RestaurantSimulation({
      seed: "STAFFING", district: getById(DISTRICTS, "seongsu"), format: getById(FORMATS, "bakery_cafe"),
      menus: ["americano", "latte", "saltbread"].map((id) => getById(MENUS, id)),
      beanTier: getById(BEAN_TIERS, "standard"), ownerRole: getById(OWNER_ROLES, "peak"),
      hourPlan: getById(HOUR_PLANS, "standard"), staffing: getById(STAFFING_PLANS, staffingId),
      cash: 5000, reputation: GAME_CONFIG.reputationBase, awareness: GAME_CONFIG.awarenessBase, hygiene: GAME_CONFIG.hygieneBase,
    });
    s.startDay(1);
    return { sim: s, report: s.runToEnd() };
  };

  const full = build("full");
  const lean = build("lean");

  assert.ok(lean.report.metrics.laborCost < full.report.metrics.laborCost, "편성을 줄이면 인건비가 줄어든다");
  assert.ok(lean.report.metrics.ownerMinutes > full.report.metrics.ownerMinutes, "줄인 만큼 사장이 더 나온다");
  assert.ok(lean.sim.hallStaffCount() < full.sim.hallStaffCount(), "홀에서 실제로 한 명이 사라진다");
  // 사라진 인건비는 연말에 사장의 시급으로 청구된다 — 공짜가 아니다.
  const saved = full.report.metrics.laborCost - lean.report.metrics.laborCost;
  const extraHours = (lean.report.metrics.ownerMinutes - full.report.metrics.ownerMinutes) / 60;
  assert.ok(extraHours > 0 && saved > 0, "아낀 돈과 늘어난 시간이 둘 다 잡힌다");
});

test("a well-chosen cafe clears the minimum wage; an over-staffed one does not", () => {
  const good = runYearHeadless({
    district: "seongsu", format: "specialty_cafe",
    menus: ["signature", "latte", "cheesecake"], bean: "specialty", role: "peak", hours: "standard",
    upgrades: ["lunch_prep", "kitchen_upgrade"],
  });
  const overstaffed = runYearHeadless({
    district: "sinchon", format: "specialty_cafe",
    menus: ["americano", "latte", "ade"], bean: "value", role: "fulltime", hours: "standard",
  });
  const absentee = runYearHeadless({
    district: "euljiro", format: "specialty_cafe",
    menus: ["signature", "drip", "cheesecake"], bean: "specialty", role: "manager", hours: "standard",
  });

  assert.ok(good.settlement.hourlyWon >= GAME_CONFIG.minimumWage, `잘 고른 셋업은 최저시급을 넘는다 (실제 ${good.settlement.hourlyWon})`);
  assert.ok(["S", "A"].includes(good.grade), `good run graded ${good.grade}`);
  assert.ok(overstaffed.settlement.netProfit < 0, "약한 상권에 과잉 인력이면 적자다");
  assert.equal(overstaffed.grade, "D");
  assert.ok(absentee.settlement.netProfit < 0, "사장이 없으면 적자다");
});

test("a solo cafe's hourly return uses actual hours, without requiring a losing outcome", () => {
  const solo = runYearHeadless({
    district: "gangdong", format: "solo_cafe",
    menus: ["americano", "latte", "cheesecake"], bean: "standard", role: "fulltime", hours: "standard",
  });
  const revenue = solo.months.reduce((sum, m) => sum + m.revenue, 0);
  const profit = solo.months.reduce((sum, m) => sum + m.profit, 0);
  // 인건비가 0이라 장부상 마진은 두 자리로 좋아 보인다
  assert.ok(profit / revenue > 0.3, "1인 카페는 장부 마진이 좋아 보인다 — 인건비가 0이라서다");
  assert.ok(solo.settlement.netProfit > 0, "그리고 실제로 돈은 남는다");
  // 기존의 '반드시 최저시급 이하' 기대는 노동시간을 두 번 센 버그에 의존했다.
  assert.equal(solo.settlement.hourlyWon, Math.round(solo.settlement.netProfit * 10000 / solo.settlement.ownerHours));
  assert.ok(solo.settlement.ownerHours <= 365 * 13);
  assert.equal(solo.grade, yearGrade(solo.settlement, GAME_CONFIG.minimumWage));
});

test("owner clock counts rest, work and concurrent tasks exactly once", () => {
  const resting = new RestaurantSimulation(configuration());
  resting.startDay(1);
  resting.setSpeed(4);
  while (!resting.finished) resting.update(0.1);
  assert.equal(resting.lastReport.metrics.ownerMinutes, 0);

  const working = new RestaurantSimulation(configuration());
  working.startDay(1);
  working.toggleOwnerWork(true);
  working.ownerStation = "bar";
  working.stationArrivesAt = working.gameMinute;
  working.machine.wear = 0.6;
  assert.ok(working.cleanMachine().ok);
  assert.equal(working.ownerInterventionMinutes, 0, "starting a task doesn't add clock time");
  working.ownerBoost();
  const report = working.runToEnd();
  assert.equal(report.metrics.ownerMinutes, working.ownerBaseMinutes());
  assert.ok(report.metrics.ownerMinutes <= (working.closeHour - working.openHour) * 60);
});

test("one-off costs and investments reconcile monthly cash without repeating", () => {
  const sim = new RestaurantSimulation(configuration());
  const opening = sim.cash;
  sim.applyActions([getById(ALL_ACTIONS, "sidewalk_sign"), getById(ALL_ACTIONS, "local_flyer")]);
  sim.spendOnce(4, "event");
  sim.spendOnce(20, "staff transition");
  sim.spendOnce(600, "equipment", true);
  sim.startDay(1);
  const weekdayReport = sim.runToEnd();
  sim.startDay(6);
  const weekendReport = sim.runToEnd();
  const plain = buildMonthSummary({ monthNumber: 1, districtId: sim.district.id, weekdayReport, weekendReport });
  const summary = buildMonthSummary({ monthNumber: 1, districtId: sim.district.id, weekdayReport, weekendReport, oneOff: sim.monthSpending });
  assert.equal(summary.oneOff.expense, 35 + 18 + 4 + 20);
  assert.equal(summary.investmentOutflow, 600);
  assert.ok(Math.abs(plain.profit - summary.profit - summary.oneOff.expense) < 1e-9);
  sim.cash += summary.profit - weekdayReport.metrics.profit - weekendReport.metrics.profit + sim.monthSpending.expense;
  assert.ok(Math.abs(sim.cash - opening - summary.cashChange) < 1e-9);
});

test("delivery commission uses the shared rate on received revenue", () => {
  const sim = new RestaurantSimulation(configuration());
  sim.startDay(1);
  const agent = { price: 0.5, channel: "delivery", menu: sim.menus[0], customer: getById(CUSTOMERS, "delivery_customer"), id: "delivery-fee", hour: 12 };
  sim.serveAgent(agent);
  assert.equal(sim.metrics.platformCost, sim.metrics.revenue * DELIVERY_COMMISSION);
});

test("automatic closing resolves an already-open dilemma", () => {
  const sim = new RestaurantSimulation(configuration());
  sim.startDay(1);
  sim.onDilemma(() => {});
  sim.debugForceDilemma();
  assert.ok(sim.activeDilemma);
  assert.ok(sim.runToEnd());
  assert.equal(sim.finished, true);
});

test("every dilemma option reconciles cash and profit at close", () => {
  for (const dilemma of DILEMMAS) {
    for (const option of dilemma.options) {
      const sim = new RestaurantSimulation(configuration());
      sim.startDay(1);
      sim.applyDilemmaOption(dilemma, option);
      const report = sim.runToEnd();
      assert.ok(Math.abs(report.cash - 5000 - report.metrics.profit) < 1e-8, `${dilemma.id}/${option.id}`);
      const cash = sim.cash;
      sim.finishDay();
      assert.equal(sim.cash, cash, "closing twice must not collect the receivable twice");
    }
  }
});

test("realistic monthly scale — a cafe does not print money", () => {
  const run = runYearHeadless({
    district: "seongsu", format: "specialty_cafe",
    menus: ["signature", "latte", "cheesecake"], bean: "specialty", role: "peak", hours: "standard",
  });
  const avgRevenue = run.months.reduce((sum, m) => sum + m.revenue, 0) / 12;
  const avgProfit = run.months.reduce((sum, m) => sum + m.profit, 0) / 12;
  // 만원 단위: 월매출 1,500~4,500만원, 순이익률 25% 이하
  assert.ok(avgRevenue > 1500 && avgRevenue < 4500, `월평균 매출 ${Math.round(avgRevenue)}만원`);
  assert.ok(avgProfit / avgRevenue < 0.3, "직원을 쓰는 카페의 순이익률이 30%를 넘으면 현실을 잃은 것이다");
  const laborShare = run.months.reduce((sum, m) => sum + m.costs.labor, 0)
    / run.months.reduce((sum, m) => sum + m.revenue, 0);
  // 실제 카페 인건비 밴드: 스페셜티 30~35%, 베이커리 27~30%
  assert.ok(laborShare > 0.25 && laborShare < 0.4, `인건비 비중 ${(laborShare * 100).toFixed(0)}%`);
});

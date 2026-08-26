// 캠페인 — 하루 시뮬레이션을 월/연 단위 경영으로 확장한다.
//
// 구조: 평일 1일 + 주말 1일을 실제로 플레이 → 그 두 날을 근거로 한 달을 추정 →
// 2월부터는 월 단위 경영 결정 + 대표 영업일 → 12월 뒤 연말정산.
//
// 교육적 의도: 하루 장사가 잘 돼도 월 단위로 4대보험·카드수수료·소모품이 붙고,
// 연 단위로는 종합소득세/법인세가 한 번 더 들어온다는 것을 숫자로 보여준다.

import {
  LOAN_ANNUAL_RATE,
  BUSINESS_TYPES,
  CORPORATE_TAX_BRACKETS,
  INCOME_TAX_BRACKETS,
  MONTHLY_RATES,
  MONTHS,
  SEASON_OVERRIDES,
  getById,
} from "./data.js";
import { RestaurantSimulation } from "./sim.js";

export function monthInfo(monthNumber) {
  return MONTHS[(monthNumber - 1) % 12];
}

// 그 달, 그 상권의 계절 계수. 상권별 예외가 있으면 그것이 우선한다.
export function seasonFactor(monthNumber, districtId) {
  const override = SEASON_OVERRIDES[districtId]?.[monthNumber];
  return override ?? monthInfo(monthNumber).season;
}

// 대표 영업일을 헤드리스로 돌려 결과만 얻는다. 라이브 플레이와 동일한 엔진.
export function simulateDay(config, { day, weekend }) {
  const simulation = new RestaurantSimulation({ ...config, seed: `${config.seed}:M${config.month ?? 1}` });
  // 주말 판정은 day >= 6 규칙을 그대로 쓴다.
  simulation.startDay(weekend ? 6 : 1);
  const report = simulation.runToEnd();
  return { report, simulation, weekend, day };
}

// 하루 결과 두 개(평일·주말)로 한 달을 추정한다.
//
// 원장은 "실매출(부가세 제외)"에서 시작해 하나씩 빼고 마지막에 남는 돈을 보여준다.
// 각 항목이 실매출의 몇 %인지가 바로 읽혀야 창업 상담으로서 의미가 있다.
export function buildMonthSummary({
  monthNumber,
  districtId,
  weekdayReport,
  weekendReport,
  businessTypeId = "sole",
  loanAmount = 0,
}) {
  const info = monthInfo(monthNumber);
  const season = seasonFactor(monthNumber, districtId);
  const business = getById(BUSINESS_TYPES, businessTypeId);

  // 계절은 이미 시뮬레이션 단계에서 손님 수로 반영됐다. 여기서는 일수만 곱한다.
  const scale = (report, days) => {
    const m = report.metrics;
    return {
      gross: m.revenue * days,
      vat: m.taxCost * days,
      food: m.foodCost * days,
      platform: m.platformCost * days,
      waste: m.wasteCost * days,
      action: m.actionCost * days,
      utility: m.utilityCost * days,
      labor: m.laborCost * days,
      rent: m.rentCost * days,
      served: Math.round(m.served * days),
      ownerMinutes: (m.ownerMinutes ?? 0) * days,
      losses: Object.fromEntries(Object.entries(m.losses ?? {}).map(([key, count]) => [key, count * days])),
    };
  };

  const weekdayPart = scale(weekdayReport, info.weekdays);
  const weekendPart = scale(weekendReport, info.weekends);
  const sum = (key) => weekdayPart[key] + weekendPart[key];

  const gross = sum("gross");
  const vat = sum("vat");
  const netRevenue = gross - vat;          // 실매출 — 여기서부터 빠져나간다
  const labor = sum("labor");

  const severance = labor * MONTHLY_RATES.severance;   // 퇴직금 적립
  const insurance = labor * MONTHLY_RATES.insurance;   // 4대보험 사업자부담
  const cardFee = netRevenue * MONTHLY_RATES.cardFee;
  const supplies = netRevenue * MONTHLY_RATES.supplies;
  const keeping = business.annualKeeping / 12;
  const interest = loanAmount * LOAN_ANNUAL_RATE / 12;   // 대출 이자 — 매달 꼬박꼬박
  const delivery = sum("platform");                    // 배달 중개·결제 수수료
  const waste = sum("waste") + sum("action");
  const food = sum("food");
  const rent = sum("rent");
  const utility = sum("utility");

  const monthlyOnly = severance + insurance + cardFee + supplies + keeping + interest;
  const totalCost = food + labor + severance + insurance + rent + utility + cardFee + supplies + delivery + waste + keeping + interest;
  const profit = netRevenue - totalCost;

  // 실매출 대비 비중 — 창업 상담에서 제일 먼저 보는 숫자들
  const share = (value) => (netRevenue > 0 ? value / netRevenue : 0);

  return {
    monthNumber,
    name: info.name,
    note: info.note,
    season,
    days: { weekdays: info.weekdays, weekends: info.weekends },
    gross,
    vat,
    revenue: netRevenue,
    netRevenue,
    served: weekdayPart.served + weekendPart.served,
    ownerMinutes: weekdayPart.ownerMinutes + weekendPart.ownerMinutes,
    // 한 달치 이탈 원인 — 마감 리포트가 "다음 달 무엇을 고칠지"를 말해줄 근거
    losses: Object.fromEntries(
      [...new Set([...Object.keys(weekdayPart.losses), ...Object.keys(weekendPart.losses)])]
        .map((key) => [key, Math.round((weekdayPart.losses[key] ?? 0) + (weekendPart.losses[key] ?? 0))]),
    ),
    loanAmount,
    costs: {
      food, labor, severance, insurance, rent, utility,
      cardFee, supplies, delivery, waste, keeping, interest, vat,
    },
    shares: {
      food: share(food),
      labor: share(labor),
      severance: share(severance),
      insurance: share(insurance),
      rent: share(rent),
      utility: share(utility),
      cardFee: share(cardFee),
      supplies: share(supplies),
      delivery: share(delivery),
      profit: share(profit),
    },
    monthlyOnly,
    totalCost,
    profit,
    weekdayProfit: weekdayReport.metrics.profit,
    weekendProfit: weekendReport.metrics.profit,
  };
}

function applyBrackets(base, brackets) {
  if (base <= 0) return { tax: 0, rate: 0, bracket: null };
  const bracket = brackets.find((item) => base <= item.upTo) ?? brackets.at(-1);
  const tax = Math.max(0, base * bracket.rate - bracket.deduct);
  return { tax, rate: bracket.rate, bracket };
}

// 연말정산 — 12개월 손익을 모아 세금을 한 번 더 낸다.
export function yearEndSettlement({ months, businessTypeId = "sole", ownerHours = 0 }) {
  const business = getById(BUSINESS_TYPES, businessTypeId);
  const revenue = months.reduce((sum, m) => sum + m.revenue, 0);
  const cost = months.reduce((sum, m) => sum + m.totalCost, 0);
  const operatingProfit = revenue - cost;

  // 이미 매달 낸 부가세는 비용에 반영되어 있고, 여기서는 소득/법인세만 정산한다.
  const taxableBase = Math.max(0, operatingProfit);
  const sole = applyBrackets(taxableBase, INCOME_TAX_BRACKETS);
  const corp = applyBrackets(taxableBase, CORPORATE_TAX_BRACKETS);
  const chosen = businessTypeId === "corp" ? corp : sole;
  const alternative = businessTypeId === "corp" ? sole : corp;

  const netProfit = operatingProfit - chosen.tax - business.setupCost;
  const hourlyWon = ownerHours > 0 ? Math.round((netProfit * 10000) / ownerHours) : 0;

  return {
    business,
    revenue,
    cost,
    operatingProfit,
    taxableBase,
    tax: chosen.tax,
    taxRate: chosen.rate,
    alternativeTax: alternative.tax,
    alternativeName: businessTypeId === "corp" ? "개인사업자" : "법인사업자",
    netProfit,
    ownerHours,
    hourlyWon,
    vatPaid: months.reduce((sum, m) => sum + (m.costs.vat ?? 0), 0),
    insurancePaid: months.reduce((sum, m) => sum + m.costs.insurance, 0),
    laborPaid: months.reduce((sum, m) => sum + m.costs.labor, 0),
    rentPaid: months.reduce((sum, m) => sum + m.costs.rent, 0),
  };
}

// 연말 등급 — 이 게임의 명제는 "남은 돈"이 아니라 "시간당 얼마"다.
export function yearGrade(settlement, minimumWage) {
  const { netProfit, hourlyWon } = settlement;
  if (netProfit > 0 && hourlyWon >= minimumWage * 2) return "S";
  if (netProfit > 0 && hourlyWon >= minimumWage) return "A";
  if (netProfit > 0 && hourlyWon >= minimumWage * 0.5) return "B";
  if (netProfit > 0) return "C";
  return "D";
}

export function yearVerdict(grade) {
  return {
    S: "최저시급의 두 배를 넘겼습니다. 2호점을 이야기할 자격이 생겼습니다.",
    A: "최저시급을 넘겼습니다. 1년을 버텨 사업이 됐습니다.",
    B: "흑자지만 시급은 최저시급 아래입니다. 당신의 1년이 반값에 팔렸습니다.",
    C: "돈은 남았지만 당신의 시간값은 거의 0입니다. 이게 창업의 가장 흔한 결말입니다.",
    D: "1년을 일하고 돈을 냈습니다. 그리고 이건 드문 일이 아닙니다.",
  }[grade];
}

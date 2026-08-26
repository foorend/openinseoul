import {
  BEAN_TIERS,
  CUSTOMERS,
  DAY_NAMES,
  DILEMMAS,
  FEEDBACK,
  GAME_CONFIG,
  HOUR_PLANS,
  OWNER_ROLES,
  OWNER_STATIONS,
  STAFFING_PLANS,
  STRESS,
  JINSANG_RATE,
  SUPPLY_MODES,
  PHASES,
  MANAGER_CLEAN_MINUTES,
  MANAGER_LEAD_MINUTES,
  MANAGER_NOTICE_MINUTES,
  MANAGER_WEAR_LIMIT,
  STATION_MOVE_MINUTES,
  REGULAR_NAMES,
  WEATHER,
  getById,
} from "./data.js";

const FORMAT_FIT = {
  solo_cafe: { office_worker: 1, cafe_studier: 0.7, mz_hotple: 0.55, local_resident: 0.82, delivery_customer: 0.6 },
  specialty_cafe: { office_worker: 0.85, cafe_studier: 0.85, mz_hotple: 0.95, local_resident: 0.85, delivery_customer: 0.65 },
  bakery_cafe: { office_worker: 0.7, cafe_studier: 0.75, mz_hotple: 0.9, local_resident: 1, delivery_customer: 0.9 },
};

const ATMOSPHERE = {
  solo_cafe: 0.55,
  specialty_cafe: 0.85,
  bakery_cafe: 0.8,
};

const STAGE_LABEL = {
  awareness: "매장 인지",
  price: "가격 거부",
  value: "가격 대비 가치",
  menu: "메뉴 불일치",
  wait: "대기 병목",
  full: "좌석 부족",
  delivery: "배달 품질",
  taste: "맛·품질",
  atmosphere: "공간·서비스",
};

const LOGIC_STEP_MINUTES = 0.25;
const BUS_MINUTES = 8;    // 직원이 테이블 하나를 치우는 데 걸리는 시간 (사장이 홀에 있으면 2분)
const OWNER_CLEAN_MINUTES = 3;

export function tableCountFor(format) {
  if (format.seats <= 0) return 0;
  // 테이블이 적어야 "자리 회전"이 실제 병목이 된다 — 홀에 선 사장이 일할 거리가 생긴다.
  return Math.min(6, Math.max(3, Math.round(format.seats / 6)));
}

// 시급 × 시간 — 상담 엑셀의 인건비 공식 그대로. (퇴직금·4대보험은 월 원장에서 따로 잡는다)
// 근무시간은 영업시간에 비례한다: 오래 열면 그만큼 시급이 더 나간다.
// 납품을 받으면 베이커 인건비가 통째로 사라진다.
export function hiredLaborCost(format, district, hourPlan, supplyMode, staffing, hires) {
  const openHours = hourPlan ? hourPlan.close - hourPlan.open : GAME_CONFIG.baselineOpenHours;
  const scale = openHours / GAME_CONFIG.baselineOpenHours;
  const boughtIn = supplyMode?.id === "buy";
  const staffScale = staffing?.staffScale ?? 1;
  return (hires ?? format.hires)
    .filter((hire) => !(boughtIn && hire.role === "베이커"))
    .reduce((sum, hire) => sum + (district.hourlyWage * hire.wageMultiplier * hire.hours * scale * staffScale) / 10000, 0);
}

export function phaseAt(gameMinute, district = null, weekend = false) {
  const table = (weekend ? district?.weekendPhases : district?.phases) ?? district?.phases ?? PHASES;
  return table.find((phase) => gameMinute < phase.until) ?? table.at(-1);
}

const FIT_GRADES = [
  { min: 0.72, symbol: "◎", label: "찰떡" },
  { min: 0.55, symbol: "○", label: "무난" },
  { min: 0, symbol: "△", label: "불일치" },
];

export function fitGrade(average) {
  return FIT_GRADES.find((grade) => average >= grade.min) ?? FIT_GRADES.at(-1);
}

export function clamp(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function hash32(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

export function keyedRandom(seed, ...keys) {
  return hash32([seed, ...keys].join("|")) / 4294967296;
}

export function formatMoney(manwon, compact = false) {
  const won = Math.round(manwon * 10000);
  if (compact) {
    if (Math.abs(won) >= 100000000) return `${(won / 100000000).toFixed(1)}억`;
    if (Math.abs(won) >= 10000) return `${Math.round(won / 10000).toLocaleString("ko-KR")}만`;
  }
  return `${won < 0 ? "−" : ""}₩${Math.abs(won).toLocaleString("ko-KR")}`;
}

export function hourToClock(gameMinute) {
  const minute = Math.max(0, Math.floor(gameMinute));
  const hours = Math.floor(minute / 60) % 24;
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function pickWeighted(items, weights, randomValue) {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (total <= 0) return items[0];
  let cursor = randomValue * total;
  for (let i = 0; i < items.length; i += 1) {
    cursor -= Math.max(0, weights[i]);
    if (cursor <= 0) return items[i];
  }
  return items.at(-1);
}

function tagAffinity(menu, customer, hour) {
  const overlap = menu.tags.filter((tag) => customer.tags.includes(tag)).length;
  let daypart = 0.5;
  if (hour < 12 && menu.tags.includes("모닝")) daypart += 0.28;
  if (hour >= 12 && hour < 15 && menu.tags.includes("점심후")) daypart += 0.3;
  if (hour >= 14 && hour < 18 && menu.tags.includes("오후")) daypart += 0.24;
  if (hour >= 18 && (menu.tags.includes("저녁") || menu.tags.includes("디저트"))) daypart += 0.26;
  return clamp(0.2 + overlap * 0.14 + daypart * 0.22);
}

function affordability(price, customer) {
  if (price <= customer.budget.preferred) return 1;
  if (price >= customer.budget.max) return 0;
  return clamp((customer.budget.max - price) / (customer.budget.max - customer.budget.preferred));
}

function timeTypeMultiplier(typeId, hour, weekend = false) {
  const morning = hour < 12;
  const lunch = hour >= 12 && hour < 14;
  const afternoon = hour >= 14 && hour < 18;
  const evening = hour >= 18 && hour < 21;
  const late = hour >= 21;

  // 주말에는 오피스 상권이 통째로 비고, 대신 나들이·동네 손님이 늦게 나온다.
  // 토요일 점심에 직장인이 줄을 서는 카페는 없다.
  if (weekend) {
    if (typeId === "office_worker") return morning ? 0.06 : lunch ? 0.08 : 0.05;
    if (typeId === "cafe_studier") return afternoon ? 1.6 : evening ? 1.35 : late ? 1.0 : lunch ? 0.9 : 0.45;
    if (typeId === "mz_hotple") return afternoon ? 1.9 : evening ? 1.7 : lunch ? 1.35 : late ? 1.1 : 0.5;
    if (typeId === "local_resident") return morning ? 1.35 : lunch ? 1.4 : afternoon ? 1.5 : evening ? 1.3 : 0.6;
    if (typeId === "delivery_customer") return evening ? 1.6 : late ? 1.8 : afternoon ? 0.8 : 0.45;
    return 1;
  }

  if (typeId === "office_worker") return lunch ? 1.6 : morning ? 1.25 : afternoon ? 0.85 : evening ? 0.3 : 0.12;
  if (typeId === "cafe_studier") return afternoon ? 1.5 : evening ? 1.2 : late ? 0.95 : lunch ? 0.7 : 0.5;
  if (typeId === "mz_hotple") return evening ? 1.5 : afternoon ? 1.25 : late ? 1.05 : 0.7;
  if (typeId === "local_resident") return morning ? 1.15 : afternoon ? 1.1 : evening ? 1.35 : late ? 0.6 : 0.9;
  if (typeId === "delivery_customer") return evening ? 1.5 : late ? 1.7 : 0.5;
  return 1;
}

function getWeatherForDay(day, seed) {
  const fixed = ["clear", "cloudy", "rain", "clear", "hot", "cloudy", "clear"];
  const id = fixed[(day - 1) % fixed.length];
  const weather = WEATHER.find((item) => item.id === id);
  if (day <= fixed.length) return weather;
  return WEATHER[Math.floor(keyedRandom(seed, day, "weather") * WEATHER.length)];
}

function makeEmptyMetrics(openHour = 10, closeHour = 23) {
  return {
    footfall: 0,
    aware: 0,
    entered: 0,
    ordered: 0,
    served: 0,
    satisfied: 0,
    repeatIntent: 0,
    reviewed: 0,
    revenue: 0,
    foodCost: 0,
    laborCost: 0,
    rentCost: 0,
    platformCost: 0,
    wasteCost: 0,
    actionCost: 0,
    taxCost: 0,
    utilityCost: 0,
    ownerMinutes: 0,
    profit: 0,
    ratingAverage: 0,
    averageWait: 0,
    averageSatisfaction: 0,
    waits: [],
    satisfactions: [],
    reviews: [],
    losses: { awareness: 0, price: 0, menu: 0, wait: 0, full: 0, delivery: 0, taste: 0, atmosphere: 0 },
    openHour,
    closeHour,
    hourly: Array.from({ length: Math.max(1, closeHour - openHour) }, (_, index) => ({ hour: openHour + index, footfall: 0, entered: 0, served: 0, revenue: 0 })),
    byType: Object.fromEntries(CUSTOMERS.map((customer) => [customer.id, { footfall: 0, served: 0, satisfied: 0 }])),
  };
}

function createArrivalSchedule({ seed, day, district, campaigns, awareness, weather, openHour, closeHour, demandFactor = 1 }) {
  const arrivals = [];
  const weekend = day >= 6;
  const weekendFactor = weekend ? district.weekend : district.weekday;
  const campaignMap = new Map(campaigns.filter((campaign) => campaign.remaining > 0).map((campaign) => [campaign.id, campaign]));
  let arrivalIndex = 0;

  district.traffic.forEach((trafficValue, hourIndex) => {
    const hour = GAME_CONFIG.earliestOpenHour + hourIndex;
    if (hour < openHour || hour >= closeHour) return;
    const base = trafficValue * GAME_CONFIG.demandScale * weekendFactor * weather.footfall * demandFactor;
    const baseCount = Math.floor(base);
    const extra = keyedRandom(seed, day, hour, "count") < base - baseCount ? 1 : 0;
    const count = Math.max(2, baseCount + extra);

    for (let i = 0; i < count; i += 1) {
      const typeWeights = CUSTOMERS.map((customer) => {
        let weight = district.mix[customer.id] * timeTypeMultiplier(customer.id, hour, weekend);
        for (const campaign of campaignMap.values()) {
          if (campaign.targets?.includes(customer.id)) weight *= campaign.demand ?? 1;
        }
        if (customer.id === "delivery_customer") {
          weight *= (0.5 + district.deliveryDemand / 100) * weather.delivery;
        }
        return weight;
      });
      const customer = pickWeighted(CUSTOMERS, typeWeights, keyedRandom(seed, day, hour, i, "type"));
      const minuteJitter = ((i + 0.18 + 0.64 * keyedRandom(seed, day, hour, i, "time")) / count) * 60;
      arrivals.push({
        id: `D${day}-${arrivalIndex}`,
        day,
        spawnMinute: hour * 60 + minuteJitter,
        customerId: customer.id,
        hour,
        awarenessBaseline: awareness,
        randomKey: arrivalIndex,
      });
      arrivalIndex += 1;
    }
  });

  return arrivals.sort((a, b) => a.spawnMinute - b.spawnMinute || a.id.localeCompare(b.id));
}

export class RestaurantSimulation {
  constructor({ seed = "OPEN_IN_SEOUL_V1", district, format, menus, cash, reputation, awareness, hygiene, campaigns = [], upgrades = [], beanTier, ownerRole, hourPlan, supplyMode, staffing, ownerStats, ownerLook, hires, equipment }) {
    this.seed = seed;
    this.district = district;
    this.format = format;
    this.menus = menus;
    this.beanTier = beanTier ?? getById(BEAN_TIERS, "standard");
    this.ownerRole = ownerRole ?? getById(OWNER_ROLES, "fulltime");
    this.hourPlan = hourPlan ?? getById(HOUR_PLANS, "standard");
    this.staffing = staffing ?? getById(STAFFING_PLANS, "full");
    this.supplyMode = supplyMode ?? getById(SUPPLY_MODES, "bake");
    this.supplyBoughtIn = this.supplyMode.id === "buy";
    // 사장 캐릭터 — 3이 보통 사람. 스탯이 없으면 보통 사람으로 시작한다.
    this.ownerStats = { kind: 3, smart: 3, charm: 3, ...(ownerStats ?? {}) };
    // 집기 등급 — 중고는 느리고, 하이엔드는 빠르고 맛있다
    this.equipment = equipment ?? { cookSpeed: 1, quality: 0 };
    this.flyerSeq = 0;
    this.pendingBadReviews = 0;   // 악성리뷰어에게 전단지를 준 값 — 다음 날부터 수요가 깎인다
    this.doorBlockedUntil = 0;
    // 스트레스는 하루로 안 끝난다 — 캠페인 내내 누적되고, 자야 회복된다.
    this.ownerStress = 0;
    this.ownerOvertime = false;
    this.ownerLook = ownerLook ?? null;
    // 직원 명단 — 업태의 기본 편성에서 시작해 월 단위로 채용·퇴사가 반영된다.
    this.hires = (hires ?? format.hires).map((hire) => ({ ...hire }));
    // 계절·프로모션이 만드는 수요 배수. 결과가 아니라 손님 수를 바꾼다.
    this.demandFactor = 1;
    this.cash = cash;
    this.reputation = reputation;
    this.awareness = awareness;
    this.hygiene = hygiene;
    this.campaigns = campaigns.map((campaign) => ({ ...campaign }));
    this.upgrades = [...upgrades];
    this.day = 0;
    this.running = false;
    this.finished = false;
    this.speed = 1;
    this.gameMinute = this.hourPlan.open * 60;
    this.activeAgents = [];
    this.arrivals = [];
    this.nextArrival = 0;
    this.kitchenLanes = [];
    this.seatReleases = [];
    this.metrics = makeEmptyMetrics(this.hourPlan.open, this.hourPlan.close);
    this.weather = WEATHER[0];
    this.feed = [];
    this.feedListeners = new Set();
    this.lastReport = null;
    this.totalHistory = [];
    this.dayOpeningCash = cash;
    this.pendingEffectiveSeconds = 0;
    this.dayMods = this.freshDayMods();
    this.activeDilemma = null;
    this.dilemmaHandler = null;
    this.firedDilemmas = new Set();
    this.usedDilemmas = new Set();
    this.dilemmasToday = 0;
    this.jinsangToday = 0;
    this.jinsangBucket = -1;
    this.fitStats = {};
    this.revealedFits = new Set();
    this.ownerBoostUntil = -Infinity;
    this.ownerBoostReadyAt = 0;
    // 사장은 정해진 시간 예산 안에서 자유롭게 일하고 쉰다
    this.ownerWorking = false;
    this.ownerBudgetLeft = 0;
    // 사장의 자리 — 이 게임의 코어 결정
    this.ownerStation = "bar";
    this.stationArrivesAt = 0;
    this.stationMinutes = { bar: 0, hall: 0, door: 0 };
    this.monthEffects = {};
    this.tables = [];
    this.busSlots = [];
    this.flyersLeft = 0;
    this.ownerTask = { type: "idle", until: 0, tableId: null };
    this.dayLabor = { called: false, arrivesAt: 0, active: false };
    this.machine = { wear: 0 };
    this.caseStock = {};
    this.pendingRestock = null;
    this.managerTask = null;
    this.soldOutSince = null;
    this.visualEvents = [];
    this.ownerInterventionMinutes = 0;
    this.ownerMinutesTotal = 0;
    this.lastRepeatIntent = 0;
    this.chargedDay = null;
    this.chargedAmount = 0;
    // 자동 배치가 기본 — 사장이 병목을 보고 알아서 움직인다.
    // 자리를 직접 찍는 순간 수동으로 바뀐다.
    this.autoOwner = true;
    this.autoNextDecision = 0;
  }

  get openHour() {
    return this.hourPlan.open;
  }

  get closeHour() {
    return this.hourPlan.close;
  }

  // 사장이 실제로 매장에 있는 시간은 영업시간을 넘을 수 없다.
  // 다음 달부터 적용할 메뉴 구성. 영업 중에는 못 바꾼다 — 월 계획에서만 부른다.
  setMenus(menus) {
    if (!menus?.length) return { ok: false, reason: "메뉴가 비어 있습니다" };
    this.menus = menus;
    return { ok: true };
  }

  // 월 단위 채용 — 다음 영업일부터 인건비와 홀 인원에 반영된다.
  addHire(option) {
    this.hires.push({ role: option.role, wageMultiplier: option.wageMultiplier, hours: option.hours });
    return { ok: true };
  }

  // 퇴사 처리 — 절차의 값은 UI 쪽에서 청구한다(부당해고 위로금 등).
  removeHire(index) {
    const hire = this.hires[index];
    if (!hire) return { ok: false, reason: "그런 직원이 없습니다" };
    if (hire.role === "베이커" && this.format.bakes && this.supplyMode.id === "bake"
      && this.hires.filter((h) => h.role === "베이커").length === 1) {
      return { ok: false, reason: "빵 구울 사람이 없어집니다. 납품으로 전환하거나 베이커를 유지하세요." };
    }
    this.hires.splice(index, 1);
    return { ok: true, hire };
  }

  // 다음 달부터 적용할 인력 편성을 바꾼다.
  setStaffing(plan) {
    if (plan) this.staffing = plan;
    return this.staffing;
  }

  ownerBaseMinutes() {
    const openHours = this.closeHour - this.openHour;
    // 직원 시간을 깎은 만큼 사장이 더 나온다 — 인건비는 사라지지 않고 사장에게 옮겨간다.
    const hours = this.ownerRole.hoursPerDay + (this.staffing?.ownerExtraHours ?? 0);
    return Math.min(hours, openHours) * 60;
  }

  // 사장은 언제 일할지 스스로 정한다. 정해진 건 하루에 쓸 수 있는 총량뿐이다.
  toggleOwnerWork(force) {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    const want = force ?? !this.ownerWorking;
    if (want === this.ownerWorking) return { ok: false, reason: want ? "이미 일하는 중입니다" : "이미 쉬는 중입니다" };
    if (want && this.ownerBudgetLeft <= 0) {
      // 시간이 다 떨어졌어도 남고 싶으면 남는다 — 초과 근무. 몸으로 갚는 시간이다.
      if (this.ownerStress >= STRESS.collapseAt) return { ok: false, reason: "스트레스가 한계입니다. 오늘은 더 못 합니다" };
      this.ownerWorking = true;
      this.ownerOvertime = true;
      this.stationArrivesAt = this.gameMinute + STATION_MOVE_MINUTES;
      this.emit("사장이 초과 근무를 시작합니다. 스트레스가 쌓이고, 이 시간도 시급으로 청구됩니다.", "bad");
      return { ok: true, working: true, overtime: true };
    }
    this.ownerWorking = want;
    if (!want) this.ownerOvertime = false;
    if (want) {
      this.stationArrivesAt = this.gameMinute + STATION_MOVE_MINUTES;
      this.emit("사장이 매장에 들어왔습니다.", "good");
    } else {
      this.emit("사장이 쉬러 갑니다. 남은 시간은 아껴둡니다.", "neutral");
    }
    return { ok: true, working: want };
  }

  // ── 전단지 미니게임이 시뮬레이션과 만나는 지점 ─────────────
  // 미니게임에서 잡은 사람은 진짜 손님으로 걸어 들어온다.
  injectWalkin(kind = "maybe") {
    if (this.finished) return null;
    const pool = CUSTOMERS.filter((c) => c.id !== "delivery_customer");
    const weights = pool.map((c) => this.district.mix[c.id] ?? 1);
    const pick = pickWeighted(pool, weights, keyedRandom(this.seed, this.gameMinute, this.flyerSeq += 1, "inject"));
    const hour = Math.floor(this.gameMinute / 60);
    this.spawnAgent({
      id: `F${this.day}-${this.flyerSeq}`,
      day: this.day,
      hour,
      customerId: pick.id,
      spawnMinute: this.gameMinute,
    });
    const agent = this.activeAgents.at(-1);
    // 전단지를 받고 오는 손님은 반드시 들어온다
    agent.flyered = true;
    agent.forcedEntry = true;
    if (kind === "reviewer") {
      // 리뷰어는 복불복 — 잘 걸리면 입소문, 잘못 걸리면 별점 테러
      const lucky = keyedRandom(this.seed, this.day, this.flyerSeq, "review") < 0.5;
      if (lucky) this.pendingGoodReviews = (this.pendingGoodReviews ?? 0) + 1;
      else this.pendingBadReviews += 1;
      agent.badReviewer = !lucky;
      agent.reviewLucky = lucky;
    }
    return agent;
  }

  // 진상에게 전단지를 쥐여주면 들어와서 돈은 안 내고 짜증만 내고 간다.
  jinsangWalkin() {
    if (this.finished) return { ok: false };
    this.reputation = Math.max(5, this.reputation - 1.2);
    this.ownerStress = Math.min(100, this.ownerStress + 4);
    const victim = this.activeAgents.find((agent) => !agent.done && (agent.state === "eating" || agent.state === "queueing"));
    if (victim) {
      victim.serviceBonus = (victim.serviceBonus ?? 0) - 0.06;
      victim.bubble = "옆자리 너무 시끄러워요";
      victim.bubbleTone = "bad";
    }
    this.emit("전단지를 받은 진상이 들어와 소란을 피우고 갔습니다. 돈은 한 푼도 안 냈습니다.", "bad");
    return { ok: true };
  }

  // 키친 러시에서 완성한 잔 — 가장 오래 기다린 손님이 바로 받는다.
  expressServe() {
    const waiting = this.activeAgents
      .filter((agent) => !agent.done && agent.state === "queueing")
      .sort((a, b) => a.stateStart - b.stateStart)[0];
    if (!waiting) return { ok: false };
    waiting.stateUntil = this.gameMinute;
    return { ok: true };
  }

  // 홀 서빙에서 치운 테이블 — 즉시 비워진다.
  expressClean(tableId) {
    const table = this.tables[tableId];
    if (!table || table.state !== "dirty") return { ok: false };
    table.state = "free";
    table.cleanAt = 0;
    table.arcadeTaken = false;
    this.metrics.ownerActions.cleaned += 1;
    return { ok: true };
  }

  // 홀 서빙의 주문서·서빙 — 식사 중인 손님 하나의 경험이 좋아진다.
  hallDelight() {
    const diner = this.activeAgents.find((agent) => !agent.done && agent.state === "eating" && !(agent.serviceBonus > 0.03));
    if (diner) diner.serviceBonus = (diner.serviceBonus ?? 0) + 0.04;
    return { ok: true };
  }

  // 시비꾼과 부딪히면 30분간 아무도 들어오지 않고, 있던 손님도 나간다.
  trollEncounter() {
    if (this.finished) return { ok: false };
    const base = Math.max(this.gameMinute, this.doorBlockedUntil ?? 0);
    this.doorBlockedUntil = base + 30;
    let scared = 0;
    for (const agent of this.activeAgents) {
      if (agent.done) continue;
      if (agent.state === "queueing" || agent.state === "eating") {
        agent.bubble = "무서워서 나가요";
        agent.bubbleTone = "bad";
        agent.state = "leaving";
        agent.stateUntil = this.gameMinute + 4;
        scared += 1;
      }
    }
    this.emit(`입구에서 시비가 붙었습니다. 30분간 손님이 끊기고, ${scared}명이 자리를 떴습니다.`, "bad");
    return { ok: true, scared, blockedUntil: this.doorBlockedUntil };
  }

  // 스트레스가 쌓일수록 사장 보너스가 줄어든다. 50까지는 멀쩡, 100이면 보너스 0.
  stressFactor() {
    const over = Math.max(0, this.ownerStress - STRESS.slowdownFrom);
    return 1 - over / (STRESS.collapseAt - STRESS.slowdownFrom);
  }

  onDuty() {
    return this.ownerWorking && (this.ownerBudgetLeft > 0 || this.ownerOvertime);
  }

  // 이동 중에는 어느 자리의 효과도 받지 못한다.
  stationActive() {
    return this.onDuty() && this.gameMinute >= this.stationArrivesAt ? this.ownerStation : null;
  }

  atStation(stationId) {
    return this.stationActive() === stationId;
  }

  // 규모에 따라 같은 자리를 다르게 부른다. 1인 카페의 바 = 베이커리의 키친.
  stationName(stationId) {
    const station = OWNER_STATIONS.find((item) => item.id === stationId);
    if (!station) return "";
    const small = this.format.seats <= 12 || !this.format.bakes;
    return small && station.smallName ? station.smallName : station.name;
  }

  // 사장을 다른 자리로 보낸다. 이동에도 시간이 걸린다.
  moveOwner(stationId, { auto = false } = {}) {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    // 플레이어가 직접 자리를 찍으면 자동 배치는 물러난다
    if (!auto && this.autoOwner) this.autoOwner = false;
    if (!this.onDuty()) {
      return { ok: false, reason: this.ownerBudgetLeft > 0 ? "사장이 쉬는 중입니다" : "오늘 쓸 시간을 다 썼습니다" };
    }
    if (!OWNER_STATIONS.some((station) => station.id === stationId)) return { ok: false, reason: "그런 자리는 없습니다" };
    if (stationId === this.ownerStation && this.gameMinute >= this.stationArrivesAt) {
      return { ok: false, reason: "이미 그 자리에 있습니다" };
    }
    this.ownerStation = stationId;
    this.stationArrivesAt = this.gameMinute + STATION_MOVE_MINUTES;
    const station = OWNER_STATIONS.find((item) => item.id === stationId);
    const name = this.stationName(stationId);
    this.emit(`사장이 ${name}(으)로 이동합니다 — ${station.short}`, "neutral");
    return { ok: true, label: `${name}으로 이동`, station };
  }

  // 남은 근무 시간(분). 0이면 오늘은 더 이상 개입할 수 없다.
  ownerMinutesLeft() {
    return Math.max(0, this.ownerBudgetLeft);
  }

  // 영업시간이 바뀌어도 시간대별 집계가 배열 밖으로 나가지 않게 한다.
  hourSlot(hour) {
    const index = clamp(hour - this.metrics.openHour, 0, this.metrics.hourly.length - 1);
    return this.metrics.hourly[Math.round(index)];
  }

  hallStaffCount() {
    let staff = 0;
    if (this.format.id === "specialty_cafe") staff = 1;
    else if (this.format.id === "bakery_cafe") staff = 2;
    // 월 단위 채용·퇴사 — 기본 편성 대비 홀 알바가 늘거나 준 만큼 반영한다.
    const countHall = (list) => list.filter((hire) => hire.role === "홀 알바").length;
    staff += countHall(this.hires ?? this.format.hires) - countHall(this.format.hires);
    if (this.hasUpgrade("part_timer")) staff += 1;
    // 인력을 줄이면 실제로 홀에서 사람이 사라진다. 장부에서만 주는 게 아니다.
    staff = Math.max(0, staff - (this.staffing?.staffLoss ?? 0));
    if (this.dayLabor.active) staff += 1;
    return staff;
  }

  // 기본 편성 대비 추가로 뽑은 바리스타 수
  extraBaristaCount() {
    const count = (list) => list.filter((hire) => hire.role === "바리스타").length;
    return Math.max(0, count(this.hires ?? []) - count(this.format.hires));
  }

  pushVisual(event) {
    this.visualEvents.push(event);
    if (this.visualEvents.length > 24) this.visualEvents.shift();
  }

  drainVisualEvents() {
    const events = this.visualEvents;
    this.visualEvents = [];
    return events;
  }

  // 원두 등급이 커피의 원가와 품질을 결정한다.
  // 직접 굽는 베이커리는 같은 메뉴라도 재료비가 더 든다 (버터·생크림·폐기).
  menuCostRatio(menu) {
    let ratio = menu.bean ? this.beanTier.costRatio : menu.foodCost;
    if (menu.caseItem && this.format.bakes) ratio *= 1.25 * this.supplyMode.costMultiplier;
    // 지성 높은 사장은 발주량과 로스를 계산할 줄 안다 — 원가가 조금씩 덜 샌다.
    return ratio * (1 - 0.02 * (this.ownerStats.smart - 3));
  }

  menuBaseQuality(menu) {
    let quality = menu.quality;
    if (menu.caseItem && this.format.bakes) quality += this.supplyMode.quality;
    if (menu.bean) {
      quality += this.beanTier.quality;
      if (this.dayMods.beanDowngrade) quality -= 0.06;
    }
    return clamp(quality, 0.3, 0.98);
  }

  availableMenus() {
    return this.menus.filter((menu) => {
      if (menu.caseItem && (this.caseStock[menu.id] ?? 0) <= 0) return false;
      if (this.dayMods.noMilk && menu.milk) return false;
      return true;
    });
  }

  freshDayMods() {
    return {
      patience: 1,
      cookSpeed: 1,
      foodCost: 1,
      deliveryDemand: 1,
      deliveryQuality: 0,
      politeWait: false,
      stopOrders: false,
      noWaste: false,
      influencer: null,
      beanDowngrade: false,
      noMilk: false,
      stayCap: false,
      studierBonus: 0,
      closingBonus: { reputation: 0, awareness: 0 },
    };
  }

  onDilemma(handler) {
    this.dilemmaHandler = handler;
  }

  onFeed(listener) {
    this.feedListeners.add(listener);
    return () => this.feedListeners.delete(listener);
  }

  emit(message, tone = "neutral", customerId = null) {
    const entry = { id: `${this.day}-${this.feed.length}`, time: hourToClock(this.gameMinute), message, tone, customerId };
    this.feed.unshift(entry);
    this.feed = this.feed.slice(0, 40);
    for (const listener of this.feedListeners) listener(entry);
  }

  hasUpgrade(id) {
    return this.upgrades.includes(id);
  }

  getActiveCampaigns() {
    return this.campaigns.filter((campaign) => campaign.remaining > 0);
  }

  getCampaign(id) {
    return this.getActiveCampaigns().find((campaign) => campaign.id === id);
  }

  getEffects() {
    let capacity = 1;
    let cookSpeed = 1;
    let price = 1;
    let value = 0;
    let quality = 0;
    let dailyLabor = 0;
    let waste = 0.025;
    let hygiene = 0;
    if (this.hasUpgrade("lunch_prep")) { cookSpeed *= 1.18; waste += 0.04; }
    if (this.hasUpgrade("part_timer")) { capacity *= 1.22; dailyLabor += 9; }
    if (this.hasUpgrade("kitchen_upgrade")) { capacity *= 1.28; quality += 0.03; }
    cookSpeed *= this.equipment.cookSpeed ?? 1;
    quality += this.equipment.quality ?? 0;
    if (this.hasUpgrade("value_set")) { price *= 0.92; value += 0.12; }
    if (this.hasUpgrade("clean_routine")) hygiene += 0.1;
    cookSpeed *= this.dayMods.cookSpeed;
    if (this.gameMinute < this.ownerBoostUntil) cookSpeed *= 1.35;
    // 사장이 바에 서 있으면 직접 커피를 내린다 — 지쳐 있으면 손이 느려진다
    if (this.atStation("bar")) cookSpeed *= 1 + 0.4 * this.stressFactor();
    if (this.atStation("hall")) hygiene += 0.12;
    // 월 이벤트가 그 달 전체의 처리능력·원가를 바꾼다
    capacity *= this.monthEffects.capacity ?? 1;
    waste *= this.monthEffects.waste ?? 1;
    // 사장이 바에 서는 시간에는 제조속도가 올라간다 (주문 단위로 동적 적용)
    // "피크타임만 선다"의 피크는 상권마다 다르다 — busy 페이즈가 그 상권의 피크다.
    const ownerOnBar = this.ownerRole.schedule === "all"
      || (this.ownerRole.schedule === "peak" && this.currentPhase().busy);
    if (ownerOnBar) cookSpeed *= 1 + (this.ownerRole.capacityBonus - 1) * this.stressFactor();
    // 추가로 뽑은 바리스타는 제조 속도로 값을 한다
    cookSpeed *= 1 + 0.12 * this.extraBaristaCount();
    return { capacity, cookSpeed, price, value, quality, dailyLabor, waste, hygiene };
  }

  setHourPlan(plan) {
    if (plan) this.hourPlan = plan;
  }

  // 지금 이 상권의 페이즈 — 요일까지 반영한다.
  currentPhase() {
    return phaseAt(this.gameMinute, this.district, this.day >= 6);
  }

  startDay(day) {
    // 아침 브리핑에서 영업시간을 바꾸면 같은 날 startDay가 다시 호출된다.
    // 고정비가 두 번 빠지지 않도록 직전 청구를 되돌린다.
    if (this.chargedDay === day && this.chargedAmount) {
      this.cash += this.chargedAmount;
      this.chargedAmount = 0;
    }
    this.day = day;
    this.weather = getWeatherForDay(day, this.seed);
    this.metrics = makeEmptyMetrics(this.hourPlan.open, this.hourPlan.close);
    this.feed = [];
    this.milestones = new Set();
    this.activeAgents = [];
    this.nextArrival = 0;
    this.gameMinute = this.hourPlan.open * 60;
    this.pendingEffectiveSeconds = 0;
    this.finished = false;
    this.running = false;
    this.speed = 0;
    this.dayOpeningCash = this.cash;
    this.dayMods = this.freshDayMods();
    this.activeDilemma = null;
    this.firedDilemmas = new Set();
    this.dilemmasToday = 0;
    this.jinsangToday = 0;
    this.jinsangBucket = -1;
    this.ownerBoostUntil = -Infinity;
    this.ownerBoostReadyAt = this.gameMinute;
    this.stationArrivesAt = this.gameMinute;
    this.stationMinutes = { bar: 0, hall: 0, door: 0 };
    this.ownerWorking = false;
    this.ownerBudgetLeft = this.ownerBaseMinutes();
    this.ownerExtraMinutes = 0;
    this.ownerOvertime = false;
    this.ownerStress = Math.max(0, this.ownerStress - STRESS.overnightRecovery);
    this.doorBlockedUntil = 0;
    // 어제 리뷰어들의 성적표 — 나쁜 리뷰는 −1%/명, 좋은 리뷰는 +1%/명
    this.reviewPenalty = Math.min(1.2, Math.max(0.5, 1 - 0.01 * this.pendingBadReviews + 0.01 * (this.pendingGoodReviews ?? 0)));
    this.autoNextDecision = this.gameMinute;
    const effects = this.getEffects();
    const laneCount = Math.max(1, Math.round((this.format.capacity / 4) * effects.capacity));
    this.kitchenLanes = Array.from({ length: laneCount }, () => this.gameMinute);
    this.seatReleases = [];
    this.tables = Array.from({ length: tableCountFor(this.format) }, (_, index) => ({
      id: index,
      state: "free",
      until: 0,
      dirtyAt: 0,
      cleanAt: 0,
      cleaningBy: null,
      agentId: null,
    }));
    this.dayLabor = { called: false, arrivesAt: 0, active: false };
    this.flyersLeft = 8;
    this.ownerTask = { type: "idle", until: 0, tableId: null };
    this.busSlots = Array.from({ length: this.hallStaffCount() }, () => this.gameMinute);
    this.metrics.ownerActions = { flyers: 0, flyerEntered: 0, drinks: 0, drinksSaved: 0, cleaned: 0, machineCleans: 0, restocks: 0 };
    this.machine = { wear: 0.12 };
    this.pendingRestock = null;
    this.ownerInterventionMinutes = 0;
    // 쇼케이스 재고 — 베이커리는 직접 굽고, 나머지는 납품받는다
    this.caseStock = {};
    this.managerTask = null;
    this.soldOutSince = null;
    for (const menu of this.menus) {
      if (menu.caseItem) this.caseStock[menu.id] = this.format.bakes ? 24 : 10;
    }
    this.arrivals = createArrivalSchedule({
      seed: this.seed,
      day,
      district: this.district,
      campaigns: this.getActiveCampaigns(),
      awareness: this.awareness,
      weather: this.weather,
      openHour: this.openHour,
      closeHour: this.closeHour,
      demandFactor: this.demandFactor * (this.reviewPenalty ?? 1),
    });

    // 인건비 = Σ(시급 × 배수 × 시간 × 1.1 퇴직금 적립) + 추가 알바
    const fixedLabor = (hiredLaborCost(this.format, this.district, this.hourPlan, this.supplyMode, this.staffing, this.hires) * (this.monthEffects.labor ?? 1)) + effects.dailyLabor;
    // 시세표는 12평 기준 — 실제 계약 평수만큼 낸다
    const pyeongFactor = (this.format.pyeong ?? 12) / 12;
    const dailyRent = (this.district.lease.monthlyRent * pyeongFactor) / 30;
    this.metrics.laborCost = fixedLabor;
    this.metrics.rentCost = dailyRent;
    this.cash -= fixedLabor + dailyRent;
    this.chargedDay = day;
    this.chargedAmount = fixedLabor + dailyRent;
    this.injectRegulars(day);
    this.emit(`${DAY_NAMES[(day - 1) % 7]}요일 오픈 준비 완료. 예상 잠재수요 ${this.arrivals.length}명.`, "neutral");
    if (this.weather.id === "rain") this.emit("비가 시작됐습니다. 보행 유동은 줄고 배달 수요는 늘어납니다.", "neutral");
    return this.snapshot();
  }

  // 어제 재방문 의향이 오늘의 단골로 돌아온다
  injectRegulars(day) {
    if (day < 2 || this.lastRepeatIntent <= 0) return;
    const count = Math.min(3, Math.floor(this.lastRepeatIntent / 8) + 1);
    const types = ["office_worker", "local_resident", "cafe_studier", "mz_hotple"];
    for (let i = 0; i < count; i += 1) {
      const typeId = types[Math.floor(keyedRandom(this.seed, day, i, "regularType") * types.length)];
      const windowStart = this.openHour * 60 + 30;
      const windowEnd = this.closeHour * 60 - 60;
      const spawnMinute = windowStart + keyedRandom(this.seed, day, i, "regularTime") * Math.max(30, windowEnd - windowStart);
      const arrival = {
        id: `D${day}-R${i}`,
        day,
        spawnMinute,
        customerId: typeId,
        hour: Math.floor(spawnMinute / 60),
        awarenessBaseline: this.awareness,
        randomKey: 8000 + i,
        guaranteed: true,
        regular: true,
        regularName: REGULAR_NAMES[(day + i) % REGULAR_NAMES.length],
      };
      const index = this.arrivals.findIndex((item) => item.spawnMinute > arrival.spawnMinute);
      if (index === -1) this.arrivals.push(arrival);
      else this.arrivals.splice(index, 0, arrival);
    }
  }

  setSpeed(speed) {
    this.speed = [0, 1, 2, 4].includes(speed) ? speed : 1;
    this.running = this.speed > 0;
  }

  update(realDeltaSeconds) {
    if (this.finished || this.speed <= 0 || this.activeDilemma) return this.snapshot();
    this.pendingEffectiveSeconds += Math.max(0, realDeltaSeconds) * this.speed;
    const closingMinute = this.closeHour * 60;
    while (this.gameMinute < closingMinute && !this.activeDilemma) {
      const stepCost = LOGIC_STEP_MINUTES / this.currentPhase().rate;
      if (this.pendingEffectiveSeconds + 1e-9 < stepCost) break;
      this.pendingEffectiveSeconds -= stepCost;
      if (this.ownerWorking && this.ownerBudgetLeft > 0) {
        this.ownerBudgetLeft = Math.max(0, this.ownerBudgetLeft - LOGIC_STEP_MINUTES);
        this.ownerInterventionMinutes += LOGIC_STEP_MINUTES;
        if (this.ownerBudgetLeft <= 0) {
          // 정한 시간 끝. 나갈지 남을지는 사장 마음이지만, 남는 순간부터는 몸이 갚는다.
          this.ownerWorking = false;
          this.emit("정한 시간이 끝났습니다. 다시 출근하면 초과 근무 — 스트레스가 쌓입니다.", "bad");
        }
      } else if (this.ownerWorking && this.ownerOvertime) {
        // 초과 근무: 시간은 그대로 시급으로 청구되고, 스트레스가 차오른다.
        this.ownerInterventionMinutes += LOGIC_STEP_MINUTES;
        this.ownerExtraMinutes += LOGIC_STEP_MINUTES;
        this.ownerStress = Math.min(STRESS.collapseAt, this.ownerStress + (STRESS.perOvertimeHour / 60) * LOGIC_STEP_MINUTES);
        if (this.ownerStress >= STRESS.collapseAt) {
          this.ownerWorking = false;
          this.ownerOvertime = false;
          this.emit("몸이 버티지 못합니다. 사장이 쓰러지듯 퇴근합니다.", "bad");
        }
      } else if (!this.ownerWorking && this.ownerStress > 0) {
        this.ownerStress = Math.max(0, this.ownerStress - (STRESS.restDecayPerHour / 60) * LOGIC_STEP_MINUTES);
      }
      const active = this.stationActive();
      if (active) this.stationMinutes[active] += LOGIC_STEP_MINUTES;
      this.processUntil(Math.min(closingMinute, this.gameMinute + LOGIC_STEP_MINUTES));
    }
    if (this.gameMinute >= closingMinute) this.finishDay();
    return this.snapshot();
  }

  processUntil(targetMinute) {
    this.gameMinute = targetMinute;
    while (this.nextArrival < this.arrivals.length && this.arrivals[this.nextArrival].spawnMinute <= this.gameMinute) {
      // 입구가 막혀 있으면(시비꾼) 그 시간의 손님은 그냥 지나간다
      if (this.gameMinute < (this.doorBlockedUntil ?? 0)) { this.nextArrival += 1; continue; }
      this.spawnAgent(this.arrivals[this.nextArrival]);
      this.nextArrival += 1;
    }

    for (const agent of this.activeAgents) {
      let guard = 0;
      while (!agent.done && agent.stateUntil <= this.gameMinute && guard < 8) {
        this.advanceAgent(agent);
        guard += 1;
      }
    }
    this.activeAgents = this.activeAgents.filter((agent) => !agent.done || this.gameMinute - agent.stateUntil < 10);
    this.serviceCalls();
    this.autoPilotOwner();
    this.managerUpkeep();
    this.updateTables();
    this.checkDilemmas();
  }

  // 사람이 안 보고 있을 때 사장이 스스로 판단하는 규칙. 플레이어가 배워야 할 규칙과 같다.
  // 홀 콜 — 손을 든 손님은 12분 안에 응대해야 한다.
  // 홀 직원이 있으면 8분 안에 알아서 처리하고, 아무도 없으면 만족도가 깎인다.
  serviceCalls() {
    for (const agent of this.activeAgents) {
      if (agent.done || agent.state !== "eating") continue;
      if (agent.serviceAt && !agent.serviceRequested && this.gameMinute >= agent.serviceAt) {
        agent.serviceRequested = true;
        agent.serviceDeadline = this.gameMinute + 12;
        agent.bubble = "저기요! 🖐";
        agent.bubbleTone = "neutral";
      }
      if (!agent.serviceRequested || agent.serviceResolved) continue;
      // 홀 직원이 있으면 8분 뒤 알아서 받아준다 — 사장보다는 느리다
      if (this.hallStaffCount() > 0 && this.gameMinute >= agent.serviceDeadline - 4) {
        agent.serviceResolved = true;
        agent.serviceBonus = 0.02;
        agent.bubble = null;
        continue;
      }
      if (this.gameMinute >= agent.serviceDeadline) {
        agent.serviceResolved = true;
        agent.serviceBonus = -0.08;
        agent.bubble = "부르는데 아무도 안 와요";
        agent.bubbleTone = "bad";
      }
    }
  }

  // 사장이 직접 응대 — 홀에 있어야 하고, 제일 빠르고 제일 기분 좋게 만든다.
  attendCustomer(agentId) {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    if (!this.atStation("hall")) return { ok: false, reason: "홀에 있어야 응대할 수 있습니다" };
    const agent = this.activeAgents.find((item) => item.id === agentId);
    if (!agent || !agent.serviceRequested || agent.serviceResolved) return { ok: false, reason: "지금은 부르는 손님이 없습니다" };
    agent.serviceResolved = true;
    agent.serviceBonus = 0.06;
    agent.bubble = "사장님이 직접!";
    agent.bubbleTone = "good";
    this.metrics.ownerActions.attended = (this.metrics.ownerActions.attended ?? 0) + 1;
    this.ownerInterventionMinutes += 1;
    return { ok: true, label: "응대 완료 — 만족도 상승", tone: "good" };
  }

  // 자동 배치 — 사장이 병목을 보고 알아서 움직인다.
  // 수동으로 자리를 찍으면 꺼지고, 자동 버튼으로 다시 켤 수 있다.
  setOwnerAuto(on) {
    this.autoOwner = !!on;
    if (on) {
      this.autoNextDecision = 0;
      this.emit("사장이 알아서 움직입니다. 줄이 길면 제조로, 테이블이 밀리면 홀로.", "neutral");
    }
    return { ok: true, auto: this.autoOwner };
  }

  autoPilotOwner() {
    if (!this.autoOwner || !this.onDuty()) return;
    if (this.gameMinute < this.autoNextDecision) return;
    this.autoNextDecision = this.gameMinute + 20;
    const queue = this.activeAgents.filter((agent) => agent.state === "queueing" && !agent.willAbandon).length;
    const dirty = this.tables.filter((table) => table.state === "dirty").length;
    let want = "door";
    let reason = "손님이 없어 입구에서 호객합니다";
    if (queue >= Math.max(2, this.kitchenLanes.length * 2)) { want = "bar"; reason = `줄이 ${queue}명 — 직접 만들러 갑니다`; }
    else if (dirty >= Math.max(2, Math.ceil(this.tables.length / 2))) { want = "hall"; reason = `안 치운 테이블 ${dirty}개 — 홀을 돌립니다`; }
    if (want !== this.ownerStation) {
      const result = this.moveOwner(want, { auto: true });
      if (result.ok) {
        // 자동이 왜 움직였는지 화면에서 보이게 한다
        this.emit(`🤖 자동 배치: ${reason}`, "neutral");
        this.pushVisual({ type: "autoMove", station: want, reason });
      }
    }
  }

  updateTables() {
    const minute = this.gameMinute;
    if (this.dayLabor.called && !this.dayLabor.active && minute >= this.dayLabor.arrivesAt) {
      this.dayLabor.active = true;
      this.busSlots.push(minute);
      this.emit("일일알바가 도착했습니다. 홀 정리 속도가 올라갑니다.", "good");
    }
    if (this.pendingRestock && minute >= this.pendingRestock.readyAt) {
      const quantity = this.pendingRestock.quantity;
      for (const menu of this.menus) {
        if (menu.caseItem) this.caseStock[menu.id] = (this.caseStock[menu.id] ?? 0) + quantity;
      }
      this.pendingRestock = null;
      this.pushVisual({ type: "restock" });
      this.emit(this.format.bakes ? "갓 구운 빵이 쇼케이스에 채워졌습니다. 냄새가 거리까지 퍼집니다." : "디저트가 도착해 쇼케이스가 다시 찼습니다.", "good");
    }
    // 홀에 서 있으면 사장이 알아서 계속 치운다 — 클릭하지 않아도 된다
    if (this.atStation("hall")) {
      const waiting = this.tables.find((table) => table.state === "dirty" && (!table.cleanAt || table.cleanAt > minute + 2));
      if (waiting) {
        waiting.cleanAt = minute + 2;
        waiting.cleaningBy = "owner";
        this.metrics.ownerActions.cleaned += 1;
      }
    }
    for (const table of this.tables) {
      if (table.state === "dirty" && table.cleanAt && minute >= table.cleanAt) {
        table.state = "free";
        table.cleaningBy = null;
        table.agentId = null;
        table.cleanAt = 0;
      }
    }
    const dirtyCount = this.tables.filter((table) => table.state === "dirty").length;
    if (dirtyCount >= 2 && !this.milestones.has("dirty-warning")) {
      const queueCount = this.activeAgents.filter((agent) => agent.state === "queueing" && agent.channel === "dine").length;
      if (queueCount >= 1) {
        this.milestones.add("dirty-warning");
        this.emit("치울 손이 부족합니다. 테이블을 직접 클릭해 치우거나 일일알바를 부르세요.", "bad");
      }
    }
  }

  // 진상은 일반 돌발과 별개 쿼터로 하루 최대 1번, 사장이 홀에 있을 때 출몰한다.
  // 직접 응대하는 순간의 게임이라, 사장이 홀에 없으면 아예 일어나지 않는다.
  maybeJinsang() {
    if (this.jinsangToday >= 1 || !this.atStation("hall")) return;
    const progress = clamp((this.gameMinute - this.openHour * 60) / Math.max(1, (this.closeHour - this.openHour) * 60));
    if (progress < 0.2 || progress > 0.85) return;
    const rate = JINSANG_RATE[this.district.id] ?? 0.25;
    // 홀에 서 있는 시간대에 확률 판정 — 10분 버킷마다 한 번씩 굴린다
    const bucket = Math.floor(this.gameMinute / 10);
    if (this.jinsangBucket === bucket) return;
    this.jinsangBucket = bucket;
    if (keyedRandom(this.seed, this.day, bucket, "jinsang") > rate / 8) return;
    const pool = DILEMMAS.filter((item) => item.jinsang && !this.usedDilemmas.has(item.id));
    if (!pool.length) return;
    const dilemma = pool[Math.floor(keyedRandom(this.seed, this.day, bucket, "which") * pool.length)];
    this.jinsangToday += 1;
    this.usedDilemmas.add(dilemma.id);
    if (this.dilemmaHandler) {
      this.activeDilemma = dilemma;
      this.speed = 0;
      this.running = false;
      this.dilemmaHandler(dilemma);
    } else {
      this.applyDilemmaOption(dilemma, dilemma.options.find((o) => o.default) ?? dilemma.options[0]);
    }
  }

  checkDilemmas() {
    if (this.activeDilemma) return;
    this.maybeJinsang();
    if (this.activeDilemma || this.dilemmasToday >= 2) return;
    const minute = this.gameMinute;
    // 영업시간을 짧게 잡아도 이벤트가 고르게 오도록 진행률 기준으로 판단한다.
    const progress = clamp((minute - this.openHour * 60) / Math.max(1, (this.closeHour - this.openHour) * 60));
    const queueing = this.activeAgents.filter((agent) => agent.state === "queueing");
    const studiersSeated = this.activeAgents.filter((agent) => agent.state === "eating" && agent.customer.id === "cafe_studier").length;
    const triggers = {
      rush_hour: () => this.currentPhase().busy
        && (queueing.length >= 4 || this.metrics.losses.wait >= 6),
      bean_delay: () => this.day >= 2 && progress >= 0.32 && this.beanTier.id !== "value"
        && !this.usedDilemmas.has("bean_delay")
        && keyedRandom(this.seed, this.day, "beanDelay") < 0.5,
      cammer_takeover: () => this.district.mix.cafe_studier >= 25 && !this.currentPhase().busy
        && minute >= 840 && studiersSeated >= 2 && !this.usedDilemmas.has("cammer_takeover"),
      steamer_break: () => this.day >= 3 && progress >= 0.5
        && this.menus.some((menu) => menu.milk)
        && !this.usedDilemmas.has("steamer_break")
        && keyedRandom(this.seed, this.day, "steamer") < 0.4,
      influencer_visit: () => this.day >= 2 && progress >= 0.58 && this.reputation >= 58
        && !this.usedDilemmas.has("influencer_visit"),
      rain_delivery_surge: () => this.weather.id === "rain" && progress >= 0.66
        && queueing.filter((agent) => agent.channel === "delivery").length >= 3,
      group_reservation: () => this.format.seats >= 18 && this.day >= 2 && progress >= 0.35
        && !this.usedDilemmas.has("group_reservation"),
      // ── 상권 전용 ──
      corporate_order: () => this.day < 6 && progress >= 0.42 && progress <= 0.7
        && !this.usedDilemmas.has("corporate_order")
        && keyedRandom(this.seed, this.day, "corp") < 0.5,
      popup_shoot: () => progress >= 0.3 && this.reputation >= 55
        && !this.usedDilemmas.has("popup_shoot")
        && keyedRandom(this.seed, this.day, "popup") < 0.45,
      exam_week: () => this.day < 6 && progress >= 0.35 && studiersSeated >= 1
        && !this.usedDilemmas.has("exam_week"),
      print_alley: () => this.day < 6 && progress >= 0.25
        && !this.usedDilemmas.has("print_alley")
        && keyedRandom(this.seed, this.day, "alley") < 0.55,
      apt_group: () => progress >= 0.15 && progress <= 0.5
        && !this.usedDilemmas.has("apt_group")
        && keyedRandom(this.seed, this.day, "apt") < 0.5,
    };
    for (const dilemma of DILEMMAS) {
      if (this.firedDilemmas.has(dilemma.id)) continue;
      // 상권 전용 이벤트는 그 동네에서만 일어난다
      if (dilemma.districts && !dilemma.districts.includes(this.district.id)) continue;
      if (!triggers[dilemma.id]?.()) continue;
      this.firedDilemmas.add(dilemma.id);
      this.usedDilemmas.add(dilemma.id);
      this.dilemmasToday += 1;
      if (this.dilemmaHandler) {
        this.activeDilemma = dilemma;
        this.speed = 0;
        this.running = false;
        this.dilemmaHandler(dilemma);
      } else {
        const fallback = dilemma.options.find((option) => option.default) ?? dilemma.options[0];
        this.applyDilemmaOption(dilemma, fallback);
      }
      return;
    }
  }

  resolveDilemma(optionId) {
    const dilemma = this.activeDilemma;
    if (!dilemma) return;
    const option = dilemma.options.find((item) => item.id === optionId) ?? dilemma.options[0];
    this.activeDilemma = null;
    this.applyDilemmaOption(dilemma, option);
  }

  applyDilemmaOption(dilemma, option) {
    if (option.cost) {
      this.cash -= option.cost;
      this.metrics.actionCost += option.cost;
    }
    const mods = this.dayMods;
    if (dilemma.id === "rush_hour") {
      if (option.id === "drinks") {
        mods.patience *= 1.4;
        this.emit("웨이팅 쿠키를 돌렸습니다. 줄 선 손님들의 표정이 풀립니다.", "good");
      } else {
        mods.politeWait = true;
        mods.closingBonus.reputation += 1.5;
        this.emit("대기 손님에게 쿠폰과 함께 양해를 구했습니다. 악평은 남지 않습니다.", "neutral");
      }
    } else if (dilemma.id === "bean_delay") {
      if (option.id === "local_roaster") {
        mods.foodCost *= 1.1;
        this.emit("동네 로스터리에서 원두를 긴급 공수했습니다. 원가가 올랐지만 맛은 지켰습니다.", "neutral");
      } else {
        mods.beanDowngrade = true;
        this.emit("창고의 저가 원두로 버팁니다. 단골의 입맛이 눈치채지 않기를.", "bad");
      }
    } else if (dilemma.id === "cammer_takeover") {
      if (option.id === "limit") {
        mods.stayCap = true;
        mods.closingBonus.reputation -= 1.5;
        this.emit("2시간 이용 안내문을 붙였습니다. 회전은 살아나지만 야박하다는 말이 돕니다.", "neutral");
      } else {
        mods.studierBonus = 0.06;
        this.emit("공부하게 두었습니다. 조용한 카페라는 소문이 학생들 사이에 퍼집니다.", "good");
      }
    } else if (dilemma.id === "steamer_break") {
      if (option.id === "repair") {
        this.emit("출장 수리 기사가 도착했습니다. 스팀 완드가 되살아났습니다.", "good");
      } else {
        mods.noMilk = true;
        this.emit("오늘 라떼류 판매를 중단했습니다. 우유 메뉴를 찾는 손님을 돌려보냅니다.", "bad");
      }
    } else if (dilemma.id === "influencer_visit") {
      mods.influencer = option.id;
      this.emit(option.id === "special" ? "주방에 유튜버 방문을 알렸습니다. 오늘 경험이 내일을 결정합니다." : "평소처럼 조리합니다. 일관성도 실력입니다.", "neutral");
    } else if (dilemma.id === "rain_delivery_surge") {
      if (option.id === "take_all") {
        mods.deliveryDemand = 1.3;
        mods.cookSpeed *= 0.92;
        this.emit("밀려드는 배달 주문을 전부 받습니다. 주방이 한계까지 돌아갑니다.", "neutral");
      } else {
        mods.deliveryDemand = 0.75;
        mods.deliveryQuality = 0.08;
        this.emit("배달 반경을 줄였습니다. 가까운 주문만 받아 도착 품질을 지킵니다.", "good");
      }
    } else if (dilemma.id === "jinsang_refund") {
      if (option.id === "service") {
        this.ownerStress = Math.min(100, this.ownerStress + 8);
        this.emit("사과하고 새 음료를 냈습니다. 소란은 가라앉았지만 손이 떨립니다.", "neutral");
      } else {
        mods.closingBonus.reputation -= 2;
        this.ownerStress = Math.min(100, this.ownerStress + 14);
        this.emit("원칙대로 거절했습니다. 별점 1점이 올라왔고, 아직도 심장이 뜁니다.", "bad");
      }
    } else if (dilemma.id === "jinsang_seat") {
      if (option.id === "polite") {
        this.ownerStress = Math.min(100, this.ownerStress + 8);
        for (const table of this.tables) {
          if (table.state === "seated" && table.until > this.gameMinute + 30) table.until = this.gameMinute + 30;
        }
        this.emit("정중히 합석을 부탁했습니다. 자리가 돌기 시작합니다.", "good");
      } else {
        mods.patience *= 0.85;
        this.emit("그냥 두기로 했습니다. 대기 줄의 한숨이 들립니다.", "bad");
      }
    } else if (dilemma.id === "jinsang_review") {
      if (option.id === "give") {
        this.ownerStress = Math.min(100, this.ownerStress + 10);
        this.emit("디저트를 내줬습니다. 리뷰는 지워졌지만, 이게 맞나 싶습니다.", "neutral");
      } else {
        this.ownerStress = Math.min(100, this.ownerStress + 6);
        this.reviewPenalty = Math.max(0.5, (this.reviewPenalty ?? 1) - 0.04);
        mods.closingBonus.reputation += 1;
        this.emit("절차대로 신고했습니다. 오늘 신규 유입은 줄겠지만, 원칙이 섰습니다.", "good");
      }
    } else if (dilemma.id === "corporate_order") {
      if (option.id === "accept") {
        this.cash += 18;
        this.metrics.revenue += 18;
        mods.cookSpeed *= 0.85;
        this.emit("법인 주문 40잔을 받았습니다. 매출 +₩180,000 — 대신 오늘 홀 제조가 느려집니다.", "good");
      } else {
        this.emit("단체 주문을 거절했습니다. 지금 줄 서 있는 손님이 먼저입니다.", "neutral");
      }
    } else if (dilemma.id === "popup_shoot") {
      if (option.id === "allow") {
        this.cash += 30;
        mods.closingBonus.awareness += 6;
        mods.stayCap = true;
        this.emit("촬영팀이 들어왔습니다. 대관료 +₩300,000, 내일 인지도가 뜁니다. 오늘 좌석은 반쪽입니다.", "good");
      } else {
        mods.closingBonus.reputation += 1;
        this.emit("영업을 지켰습니다. 단골들이 조용히 고마워합니다.", "neutral");
      }
    } else if (dilemma.id === "exam_week") {
      if (option.id === "study_set") {
        mods.studierBonus = 0.08;
        mods.closingBonus.reputation += 1.5;
        this.emit("카공 세트를 냈습니다. 학생들 사이에 착한 카페로 소문납니다.", "good");
      } else {
        mods.studierBonus = 0.04;
        this.emit("그냥 두기로 했습니다. 회전은 죽지만 시험기간 단골이 생깁니다.", "neutral");
      }
    } else if (dilemma.id === "print_alley") {
      if (option.id === "tab") {
        this.metrics.revenue += 5;
        mods.closingBonus.reputation += 2;
        this.emit("장부를 만들었습니다. 골목 사장님들이 단골이 됩니다. 커피값은 월말에(아마도).", "good");
      } else {
        this.emit("현금만 받기로 했습니다. 깔끔하지만 골목이 조금 서늘해집니다.", "neutral");
      }
    } else if (dilemma.id === "apt_group") {
      if (option.id === "welcome") {
        this.cash += 6;
        this.metrics.revenue += 6;
        mods.closingBonus.awareness += 3;
        this.emit("부녀회를 모셨습니다. 매주 화요일 고정 매출과 동네 소문을 얻습니다.", "good");
      } else {
        this.emit("정중히 사양했습니다. 오전 좌석은 지켰습니다.", "neutral");
      }
    } else if (dilemma.id === "group_reservation") {
      if (option.id === "accept") {
        this.injectGroupReservation();
        this.emit("19시 스터디 모임 예약을 받았습니다. 저녁 좌석 계획을 다시 세우세요.", "good");
      } else {
        this.emit("스터디 예약을 정중히 거절했습니다. 피크 회전은 지켜집니다.", "neutral");
      }
    }
  }

  injectGroupReservation() {
    const base = Math.min(19 * 60, (this.closeHour - 2) * 60);
    for (let i = 0; i < 4; i += 1) {
      const arrival = {
        id: `D${this.day}-G${i}`,
        day: this.day,
        spawnMinute: base + i * 3,
        customerId: "cafe_studier",
        hour: 19,
        awarenessBaseline: this.awareness,
        randomKey: 9000 + i,
        guaranteed: true,
      };
      const index = this.arrivals.findIndex((item, position) => position >= this.nextArrival && item.spawnMinute > arrival.spawnMinute);
      if (index === -1) this.arrivals.push(arrival);
      else this.arrivals.splice(index, 0, arrival);
    }
  }

  ownerBusy() {
    return this.gameMinute < this.ownerTask.until;
  }

  ownerBoost() {
    if (this.finished || this.gameMinute < this.ownerBoostReadyAt || this.ownerBusy() || !this.onDuty()) return false;
    this.ownerBoostUntil = this.gameMinute + GAME_CONFIG.ownerBoostMinutes;
    this.ownerBoostReadyAt = this.gameMinute + GAME_CONFIG.ownerBoostCooldown;
    this.ownerTask = { type: "kitchen", until: this.ownerBoostUntil, tableId: null };
    this.ownerInterventionMinutes += GAME_CONFIG.ownerBoostMinutes;
    this.emit("사장이 직접 바에 들어갑니다. 잠시 제조속도가 올라갑니다.", "good");
    return true;
  }

  // 에스프레소 머신 청소 — 마모가 쌓이면 커피 맛이 떨어진다
  cleanMachine() {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    if (!this.atStation("bar")) return { ok: false, reason: `${this.stationName("bar")}에 있어야 머신을 만질 수 있습니다` };
    if (!this.onDuty()) return { ok: false, reason: this.ownerBudgetLeft > 0 ? "사장이 쉬는 중입니다" : "오늘 쓸 시간을 다 썼습니다" };

    if (this.ownerBusy()) return { ok: false, reason: "지금은 손이 안 빕니다" };
    if (this.machine.wear < 0.25) return { ok: false, reason: "머신이 아직 깨끗합니다" };
    this.machine.wear = 0;
    this.ownerTask = { type: "machine", until: this.gameMinute + 3, tableId: null };
    this.ownerInterventionMinutes += 3;
    this.metrics.ownerActions.machineCleans += 1;
    this.emit("그룹헤드를 백플러싱했습니다. 샷이 다시 달아집니다.", "good");
    return { ok: true, label: "머신 청소 완료", tone: "good" };
  }

  // 매니저가 알아서 하는 일 — 사장이 없어도 가게는 굴러간다. 다만 느리다.
  //
  // 사장은 머신 마모 0.25에서 바로 손을 대지만 매니저는 0.6이 돼야 눈치채고,
  // 품절도 사장은 즉시 알지만 매니저는 한참 뒤에야 발주를 넣는다.
  // 직원이 아예 없는 1인 카페에는 대신해 줄 사람이 없다 — 그게 1인 카페의 값이다.
  managerUpkeep() {
    if (this.finished) return;
    // 베이커는 아침에만 굽지 않는다 — 재고가 얇아지면 오븐 사이클이 돈다.
    // 베이커를 고용해 직접 굽는 가게만 누리는 자동화다.
    if (this.format.bakes && this.supplyMode.id === "bake" && !this.pendingRestock
      && this.hires.some((hire) => hire.role === "베이커")) {
      const caseMenus = this.menus.filter((menu) => menu.caseItem);
      const lowStock = caseMenus.length && caseMenus.some((menu) => (this.caseStock[menu.id] ?? 0) <= 6);
      if (lowStock) {
        this.pendingRestock = { readyAt: this.gameMinute + 35, quantity: 14, byBaker: true };
        this.emit("베이커가 다음 판을 오븐에 넣었습니다. 35분 뒤 갓 구운 빵이 나옵니다.", "neutral");
      }
    }
    if (this.hallStaffCount() <= 0) return;

    // 머신 청소 — 사장보다 한참 더러워진 뒤에야, 그리고 두 배 넘게 걸린다.
    if (!this.managerTask && this.machine.wear >= MANAGER_WEAR_LIMIT) {
      this.managerTask = { type: "machine", until: this.gameMinute + MANAGER_CLEAN_MINUTES };
      this.emit("매니저가 머신을 청소하러 갑니다. 사장이 하는 것보다는 느립니다.", "neutral");
    }
    if (this.managerTask?.type === "machine" && this.gameMinute >= this.managerTask.until) {
      this.machine.wear = 0;
      this.metrics.ownerActions.machineCleans += 1;
      this.managerTask = null;
      this.emit("매니저가 머신 청소를 끝냈습니다.", "good");
    }

    // 품절 발주 — 비었다는 걸 알아채는 데만 MANAGER_NOTICE_MINUTES가 걸린다.
    const caseMenus = this.menus.filter((menu) => menu.caseItem);
    if (!caseMenus.length || this.pendingRestock) {
      this.soldOutSince = null;
      return;
    }
    const soldOut = caseMenus.some((menu) => (this.caseStock[menu.id] ?? 0) <= 0);
    if (!soldOut) {
      this.soldOutSince = null;
      return;
    }
    if (this.soldOutSince == null) {
      this.soldOutSince = this.gameMinute;
      return;
    }
    if (this.gameMinute - this.soldOutSince < MANAGER_NOTICE_MINUTES) return;

    const bakes = !!this.format.bakes;
    const cost = bakes ? 0 : 2;
    if (this.cash < cost) return;
    this.cash -= cost;
    this.metrics.actionCost += cost;
    this.metrics.ownerActions.restocks += 1;
    this.soldOutSince = null;
    // 사장이 직접 넣을 때보다 도착이 늦다. 그 사이 팔 기회는 그냥 날아간다.
    this.pendingRestock = {
      readyAt: this.gameMinute + (bakes ? 30 : 15) + MANAGER_LEAD_MINUTES,
      quantity: bakes ? 12 : 8,
      byManager: true,
    };
    this.emit("품절을 뒤늦게 확인한 매니저가 발주를 넣었습니다. 사장이 봤으면 더 빨랐습니다.", "bad");
  }

  // 매니저 발주 승인 — 사장이 쉬고 있어도, 집에서 전화 한 통이면 된다.
  approveSupplyOrder() {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    const caseMenus = this.menus.filter((menu) => menu.caseItem);
    if (!caseMenus.length) return { ok: false, reason: "쇼케이스 메뉴가 없습니다" };
    if (this.pendingRestock) return { ok: false, reason: "이미 발주가 들어가 있습니다" };
    // 재료값은 팔릴 때 재료비로 빠진다. 여기서 무는 건 급하게 부르는 값뿐이다.
    const cost = 3;
    if (this.cash < cost) return { ok: false, reason: "현금이 부족합니다" };
    this.cash -= cost;
    this.metrics.actionCost += cost;
    this.metrics.ownerActions.restocks += 1;
    // 매니저가 받아서 처리하므로 사장의 시간은 쓰지 않는다
    this.pendingRestock = { readyAt: this.gameMinute + 40, quantity: 8, remote: true };
    this.emit("사장이 발주를 승인했습니다. 매니저가 받아서 처리합니다 — 40분 뒤 도착.", "neutral");
    return { ok: true, label: "발주 승인 · 40분 뒤 도착", tone: "good" };
  }

  // 쇼케이스 재고 보충 — 베이커리는 직접 굽고, 나머지는 긴급 납품
  restockCase() {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    if (!this.atStation("bar")) return { ok: false, reason: `${this.stationName("bar")}에 있어야 직접 채울 수 있습니다` };
    if (!this.onDuty()) return { ok: false, reason: this.ownerBudgetLeft > 0 ? "사장이 쉬는 중입니다" : "오늘 쓸 시간을 다 썼습니다" };

    const caseMenus = this.menus.filter((menu) => menu.caseItem);
    if (!caseMenus.length) return { ok: false, reason: "쇼케이스 메뉴가 없습니다" };
    if (this.pendingRestock) return { ok: false, reason: "이미 준비 중입니다" };
    const bakes = !!this.format.bakes;
    // 직접 구우면 재료는 이미 산 것이고, 납품은 퀵 배송비만 더 붙는다.
    const cost = bakes ? 0 : 2;
    if (this.cash < cost) return { ok: false, reason: "현금이 부족합니다" };
    this.cash -= cost;
    this.metrics.actionCost += cost;
    this.metrics.ownerActions.restocks += 1;
    this.ownerInterventionMinutes += 5;
    this.pendingRestock = {
      readyAt: this.gameMinute + (bakes ? 30 : 15),
      quantity: bakes ? 12 : 8,
    };
    this.emit(bakes ? "베이커가 오븐에 반죽을 넣었습니다. 30분 뒤 갓 구운 빵이 나옵니다." : "디저트 긴급 납품을 요청했습니다. 15분 뒤 도착합니다.", "neutral");
    return { ok: true, label: bakes ? "오븐 가동! 30분 뒤 완성" : "납품 요청 · 15분 뒤 도착", tone: "good" };
  }

  // 지저분한 테이블을 사장이 직접 치운다. 잠시 다른 일을 못 한다.
  ownerClean(tableId) {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    if (!this.atStation("hall")) return { ok: false, reason: "홀에 있어야 테이블을 치울 수 있습니다" };
    if (!this.onDuty()) return { ok: false, reason: this.ownerBudgetLeft > 0 ? "사장이 쉬는 중입니다" : "오늘 쓸 시간을 다 썼습니다" };

    if (this.ownerBusy()) return { ok: false, reason: this.ownerTask.type === "kitchen" ? "주방 지원 중입니다" : "이미 치우는 중입니다" };
    const table = this.tables[tableId];
    if (!table || table.state !== "dirty") return { ok: false, reason: "치울 것이 없습니다" };
    const finishAt = this.gameMinute + OWNER_CLEAN_MINUTES;
    if (!table.cleanAt || finishAt < table.cleanAt) {
      table.cleanAt = finishAt;
      table.cleaningBy = "owner";
    }
    this.ownerTask = { type: "clean", until: finishAt, tableId };
    this.metrics.ownerActions.cleaned += 1;
    this.ownerInterventionMinutes += OWNER_CLEAN_MINUTES;
    return { ok: true, label: "사장이 치우는 중" };
  }

  // 지나가는 행인에게 전단지를 건넨다. 하루 수량 제한.
  handFlyer(agentId) {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    if (!this.onDuty()) return { ok: false, reason: this.ownerBudgetLeft > 0 ? "사장이 쉬는 중입니다" : "오늘 쓸 시간을 다 썼습니다" };

    if (this.flyersLeft <= 0) return { ok: false, reason: "전단지가 다 떨어졌습니다" };
    const agent = this.activeAgents.find((item) => item.id === agentId);
    if (!agent || agent.state !== "walking" || agent.flyered) return { ok: false, reason: "지금은 건넬 수 없습니다" };
    this.flyersLeft -= 1;
    agent.flyered = true;
    this.metrics.ownerActions.flyers += 1;
    this.ownerInterventionMinutes += 1;
    const accepts = keyedRandom(this.seed, agent.id, "flyer") < 0.72;
    if (accepts) {
      this.metrics.aware += 1;
      this.metrics.ownerActions.flyerEntered += 1;
      agent.state = "considering";
      agent.stateStart = this.gameMinute;
      agent.stateUntil = this.gameMinute + 2 + keyedRandom(this.seed, agent.id, "consider") * 3;
      agent.bubble = null;
      return { ok: true, label: "전단지에 관심을 보입니다", tone: "good" };
    }
    agent.bubble = "오늘은 좀 바빠서요.";
    agent.bubbleTone = "neutral";
    return { ok: true, label: "지나쳤습니다", tone: "neutral" };
  }

  // 대기 중인 손님에게 음료를 서비스한다. 인내심이 크게 늘어난다.
  serveDrink(agentId) {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    if (!this.onDuty()) return { ok: false, reason: this.ownerBudgetLeft > 0 ? "사장이 쉬는 중입니다" : "오늘 쓸 시간을 다 썼습니다" };

    const agent = this.activeAgents.find((item) => item.id === agentId);
    if (!agent || agent.state !== "queueing" || agent.channel === "delivery" || agent.drinkServed) {
      return { ok: false, reason: "지금은 서비스할 수 없습니다" };
    }
    const cost = 0.4;
    if (this.cash < cost) return { ok: false, reason: "현금이 부족합니다" };
    agent.drinkServed = true;
    this.cash -= cost;
    this.metrics.actionCost += cost;
    this.metrics.ownerActions.drinks += 1;
    this.ownerInterventionMinutes += 1;
    agent.bubble = "음료 감사해요!";
    agent.bubbleTone = "good";
    if (agent.willAbandon) {
      const tolerance = agent.customer.wait * this.format.wait * this.dayMods.patience * 1.8;
      if (agent.waitMinutes <= tolerance) {
        agent.willAbandon = false;
        agent.primaryReason = null;
        agent.stateUntil = agent.stateStart + agent.waitMinutes;
        const earliestLane = this.kitchenLanes.reduce((best, value, index, array) => (value < array[best] ? index : best), 0);
        this.kitchenLanes[earliestLane] = Math.max(this.kitchenLanes[earliestLane], this.gameMinute) + agent.menu.cook / this.getEffects().cookSpeed;
        this.metrics.ownerActions.drinksSaved += 1;
        return { ok: true, label: "이탈 직전 손님을 붙잡았습니다!", tone: "good" };
      }
    }
    return { ok: true, label: "대기가 한결 편해졌습니다", tone: "good" };
  }

  // 일일알바 긴급 호출 — 30분 뒤 도착, 마감까지 홀 정리 지원.
  callDayLabor() {
    if (this.finished) return { ok: false, reason: "영업이 끝났습니다" };
    if (!this.onDuty()) return { ok: false, reason: this.ownerBudgetLeft > 0 ? "사장이 쉬는 중입니다" : "오늘 쓸 시간을 다 썼습니다" };

    if (this.dayLabor.called) return { ok: false, reason: "이미 불렀습니다" };
    const cost = 5;
    if (this.cash < cost) return { ok: false, reason: "현금이 부족합니다" };
    this.dayLabor = { called: true, arrivesAt: this.gameMinute + 30, active: false };
    this.cash -= cost;
    this.metrics.actionCost += cost;
    this.emit("일일알바를 불렀습니다. 30분 뒤 도착합니다.", "neutral");
    return { ok: true, label: "일일알바 호출 · 30분 뒤 도착", tone: "good" };
  }

  spawnAgent(arrival) {
    const customer = getById(CUSTOMERS, arrival.customerId);
    const isDelivery = customer.id === "delivery_customer";
    const agent = {
      ...arrival,
      customer,
      state: isDelivery ? "phone" : "walking",
      channel: isDelivery ? "delivery" : this.chooseChannel(customer, arrival),
      stateStart: arrival.spawnMinute,
      stateUntil: arrival.spawnMinute + 8 + keyedRandom(this.seed, arrival.id, "approach") * 8,
      done: false,
      partySize: customer.id === "mz_hotple" && keyedRandom(this.seed, arrival.id, "party") > 0.45 ? 2 : 1,
      visualLane: keyedRandom(this.seed, arrival.id, "lane"),
      facing: keyedRandom(this.seed, arrival.id, "direction") > 0.5 ? 1 : -1,
      bubble: null,
      bubbleTone: "neutral",
      outcome: null,
      menu: null,
      price: 0,
      waitMinutes: 0,
      satisfaction: null,
      primaryReason: null,
    };
    this.metrics.footfall += 1;
    this.hourSlot(arrival.hour).footfall += 1;
    this.metrics.byType[customer.id].footfall += 1;
    this.activeAgents.push(agent);
  }

  chooseChannel(customer, arrival) {
    const takeoutBias = this.format.channel.takeout * (customer.channels.includes("takeout") ? 1 : 0);
    const dineBias = this.format.channel.dine * (customer.channels.includes("dine") ? 1 : 0);
    if (takeoutBias <= 0 && dineBias <= 0) return "delivery";
    return keyedRandom(this.seed, arrival.id, "channel") < takeoutBias / (takeoutBias + dineBias) ? "takeout" : "dine";
  }

  campaignInfluence(customerId) {
    const relevant = this.getActiveCampaigns().filter((campaign) => campaign.targets?.includes(customerId));
    const awareness = 1 - relevant.reduce((remaining, campaign) => remaining * (1 - (campaign.awareness ?? 0)), 1);
    const demand = relevant.reduce((value, campaign) => value * (campaign.demand ?? 1), 1);
    return { awareness, demand, campaigns: relevant };
  }

  advanceAgent(agent) {
    if (agent.state === "walking" || agent.state === "phone") {
      this.resolveAwareness(agent);
      return;
    }
    if (agent.state === "considering") {
      this.resolveEntry(agent);
      return;
    }
    if (agent.state === "queueing") {
      if (agent.willAbandon) {
        const reason = agent.primaryReason === "full" ? "full" : "wait";
        this.rejectAgent(agent, reason, reason === "full" ? FEEDBACK.full : FEEDBACK.wait.negative, "bad");
      } else {
        this.serveAgent(agent);
      }
      return;
    }
    if (agent.state === "eating" || agent.state === "pickup") {
      this.completeExperience(agent);
      return;
    }
    if (agent.state === "leaving") {
      agent.done = true;
      agent.stateUntil = this.gameMinute;
    }
  }

  resolveAwareness(agent) {
    if (agent.guaranteed) {
      this.metrics.aware += 1;
      agent.state = "considering";
      agent.stateStart = this.gameMinute;
      agent.stateUntil = this.gameMinute + 2;
      return;
    }
    const influence = this.campaignInfluence(agent.customer.id);
    const signboard = this.hasUpgrade("sidewalk_sign") && agent.channel !== "delivery" ? 0.16 : 0;
    const physicalVisibility = agent.channel === "delivery"
      ? this.district.deliveryDemand / 100 * 0.62
      : this.district.visibility / 100 * 0.62;
    const reputationSignal = clamp((this.reputation - 35) / 65) * 0.17;
    const knownSignal = this.awareness / 100 * 0.24;
    // 입구에 서 있으면 지나가는 사람에게 직접 말을 건다
    let doorPull = 0;
    if (agent.channel !== "delivery" && this.atStation("door")) {
      // 외모 좋은 사장이 입구에 서면 발길이 한 번 더 멈춘다
      doorPull = 0.22 * (1 + 0.08 * (this.ownerStats.charm - 3));
      if (this.flyersLeft > 0 && !agent.flyered) {
        agent.flyered = true;
        this.flyersLeft -= 1;
        this.metrics.ownerActions.flyers += 1;
        doorPull += 0.1;
      }
    }
    const deliverySurge = agent.channel === "delivery" ? this.dayMods.deliveryDemand : 1;
    const eventAwareness = this.monthEffects.awareness ?? 0;
    const probability = clamp(
      (0.16 + physicalVisibility + reputationSignal + knownSignal + influence.awareness + signboard + doorPull + eventAwareness)
        * deliverySurge * (this.monthEffects.awarenessHard ? 0.72 : 1),
      0.05, 0.97,
    );
    // 미니게임에서 전단지를 직접 쥐여준 손님은 무조건 들어온다
    if (!agent.forcedEntry && keyedRandom(this.seed, agent.id, "aware") > probability) {
      this.rejectAgent(agent, "awareness", FEEDBACK.no_interest, "neutral");
      return;
    }
    if (agent.flyered) this.metrics.ownerActions.flyerEntered += 1;
    this.metrics.aware += 1;
    agent.state = "considering";
    agent.stateStart = this.gameMinute;
    agent.stateUntil = this.gameMinute + 2 + keyedRandom(this.seed, agent.id, "consider") * 4;
  }

  scoreMenu(menu, customer, hour) {
    const effects = this.getEffects();
    const price = menu.price * this.format.spend * effects.price * (this.monthEffects.spend ?? 1);
    const fit = tagAffinity(menu, customer, hour);
    const afford = affordability(price, customer);
    const formatFit = FORMAT_FIT[this.format.id][customer.id];
    const channelFit = this.format.channel[customer.id === "delivery_customer" ? "delivery" : "dine"] || 0.4;
    const deliveryFit = customer.id === "delivery_customer" ? menu.delivery : 0.75;
    return { menu, price, fit, afford, formatFit, score: fit * 0.43 + afford * 0.27 + formatFit * 0.2 + channelFit * 0.04 + deliveryFit * 0.06 };
  }

  resolveEntry(agent) {
    if (this.dayMods.stopOrders) {
      this.rejectAgent(agent, "menu", ["아쉽지만 품절이래요. 내일 다시 올게요.", "일찍 다 팔렸나 봐요. 다음엔 서둘러야겠어요."], "neutral");
      return;
    }
    const candidates = this.availableMenus();
    if (!candidates.length) {
      this.rejectAgent(agent, "menu", ["오늘 메뉴가 다 떨어졌대요.", "품절이라니… 내일 일찍 와야겠어요."], "neutral");
      return;
    }
    const menuScores = candidates.map((menu) => this.scoreMenu(menu, agent.customer, agent.hour));
    menuScores.sort((a, b) => b.score - a.score || a.menu.id.localeCompare(b.menu.id));
    const best = menuScores[0];
    agent.menu = best.menu;
    agent.price = best.price;
    if (agent.guaranteed) {
      this.metrics.entered += 1;
      this.hourSlot(agent.hour).entered += 1;
      this.metrics.ordered += 1;
      this.scheduleOrder(agent);
      return;
    }
    const reputationFit = clamp(this.reputation / 100);
    const competitionRelief = clamp(1 - this.district.competition / 100 * (1 - agent.menu.quality) * 0.55);
    const enterScore = best.fit * 0.35 + best.afford * 0.27 + best.formatFit * 0.2 + reputationFit * 0.1 + competitionRelief * 0.08;
    const enterProbability = clamp(0.06 + enterScore * 1.02, 0.02, 0.96);

    if (best.afford <= 0.05) {
      this.rejectAgent(agent, "price", FEEDBACK.price_reject, "bad");
      return;
    }
    if (best.fit < 0.42 || keyedRandom(this.seed, agent.id, "enter") > enterProbability) {
      const reason = best.afford < best.fit ? "price" : "menu";
      this.rejectAgent(agent, reason, reason === "price" ? FEEDBACK.price_reject : FEEDBACK.no_interest, "neutral");
      return;
    }

    this.metrics.entered += 1;
    this.hourSlot(agent.hour).entered += 1;
    this.metrics.ordered += 1;
    if (agent.regular) {
      this.emit(`단골 ${agent.regularName}이(가) 다시 찾아왔습니다 ♥`, "good", agent.id);
    } else if (!this.milestones.has("first-order")) {
      this.milestones.add("first-order");
      this.emit(`첫 주문! ${agent.customer.short}이(가) ${agent.menu.name}을 선택했습니다.`, "good", agent.id);
    }
    this.scheduleOrder(agent);
  }

  scheduleOrder(agent) {
    const effects = this.getEffects();
    const earliestLane = this.kitchenLanes.reduce((bestIndex, value, index, array) => value < array[bestIndex] ? index : bestIndex, 0);
    const start = Math.max(this.gameMinute, this.kitchenLanes[earliestLane]);
    const queueLoad = this.activeAgents.filter((item) => item.state === "queueing").length / Math.max(1, this.kitchenLanes.length * 4);
    const cookMinutes = agent.menu.cook / effects.cookSpeed * (1 + clamp(queueLoad) * 0.2);
    let finish = start + cookMinutes;
    let seatBottleneck = false;

    if (agent.channel === "dine" && this.tables.length) {
      const freeTable = this.tables.find((table) => table.state === "free");
      if (!freeTable) {
        let earliest = Infinity;
        for (const table of this.tables) {
          const availableAt = table.state === "seated"
            ? table.until + BUS_MINUTES
            : (table.cleanAt || this.gameMinute + BUS_MINUTES);
          if (availableAt < earliest) earliest = availableAt;
        }
        if (Number.isFinite(earliest) && earliest > finish) {
          finish = earliest;
          seatBottleneck = true;
        }
      }
    }

    agent.waitMinutes = Math.max(0, finish - this.gameMinute);
    const stationPatience = this.atStation("door") ? 1.25 : 1;
    const tolerance = agent.customer.wait * this.format.wait * this.dayMods.patience * stationPatience
      * (this.monthEffects.patience ?? 1) * (0.9 + keyedRandom(this.seed, agent.id, "patience") * 0.2);
    agent.willAbandon = agent.waitMinutes > tolerance;
    agent.state = "queueing";
    agent.stateStart = this.gameMinute;
    agent.stateUntil = this.gameMinute + (agent.willAbandon ? Math.max(3, tolerance) : agent.waitMinutes);
    agent.primaryReason = agent.willAbandon ? (seatBottleneck ? "full" : "wait") : null;

    const visibleQueue = this.activeAgents.filter((item) => item.state === "queueing").length + 1;
    if (visibleQueue >= this.kitchenLanes.length * 3 && !this.milestones.has("queue-warning")) {
      this.milestones.add("queue-warning");
      this.emit(`주방 경고: 대기 ${visibleQueue}명. 지금은 홍보보다 처리속도를 봐야 합니다.`, "bad");
    }

    if (!agent.willAbandon) {
      this.kitchenLanes[earliestLane] = finish;
    }
  }

  serveAgent(agent) {
    const effects = this.getEffects();
    let received = agent.price;
    let platform = 0;
    const deliveryCampaign = this.getCampaign("delivery_coupon");
    if (agent.channel === "delivery") {
      const discount = deliveryCampaign?.discount ?? 0;
      received -= discount;
      platform = received * 0.22 * (this.monthEffects.platform ?? 1);
    }
    const ingredient = agent.menu.price * this.menuCostRatio(agent.menu) * this.dayMods.foodCost * (this.monthEffects.foodCost ?? 1);
    this.metrics.revenue += received;
    this.metrics.foodCost += ingredient;
    this.metrics.platformCost += platform;
    this.cash += received - ingredient - platform;
    this.metrics.served += 1;
    // 쇼케이스 재고와 머신 마모
    if (agent.menu.caseItem) {
      this.caseStock[agent.menu.id] = Math.max(0, (this.caseStock[agent.menu.id] ?? 0) - 1);
      if (this.caseStock[agent.menu.id] === 0) {
        this.emit(`${agent.menu.name} 품절! 쇼케이스를 클릭해 ${this.format.bakes ? "추가로 구울" : "긴급 납품받을"} 수 있습니다.`, "bad");
      }
    }
    if (agent.menu.bean) this.machine.wear = clamp(this.machine.wear + 0.02, 0, 1);
    this.pushVisual({ type: "sale", amount: received, menuId: agent.menu.id });
    // 세트 판매 — 커피 손님이 쇼케이스의 디저트를 함께 집어간다
    if (!agent.menu.caseItem && agent.channel !== "delivery") {
      const attachRates = { mz_hotple: 0.45, local_resident: 0.4, cafe_studier: 0.2, office_worker: 0.12 };
      // 빵집에서는 커피 손님이 그냥 못 지나간다 — 좌석이 없어도 봉투는 나간다
      const bakeryPull = this.format.bakes ? 0.18 : 0;
      const rate = (attachRates[agent.customer.id] ?? 0) + bakeryPull;
      const caseMenu = this.menus.find((menu) => menu.caseItem && (this.caseStock[menu.id] ?? 0) > 0);
      if (caseMenu && rate > 0 && keyedRandom(this.seed, agent.id, "attach") < rate) {
        // 베이커리에서는 한 손님이 두세 개씩 집어간다
        const extra = this.format.bakes && keyedRandom(this.seed, agent.id, "attachQty") < 0.45
          ? Math.min(1, Math.max(0, (this.caseStock[caseMenu.id] ?? 0) - 1)) : 0;
        const quantity = 1 + extra;
        const attachPrice = caseMenu.price * 0.9 * quantity;
        const attachCost = caseMenu.price * this.menuCostRatio(caseMenu) * this.dayMods.foodCost * quantity;
        this.caseStock[caseMenu.id] -= quantity;
        this.metrics.revenue += attachPrice;
        this.metrics.foodCost += attachCost;
        this.hourSlot(agent.hour).revenue += attachPrice;
        this.cash += attachPrice - attachCost;
        agent.attachedMenu = caseMenu;
        this.pushVisual({ type: "sale", amount: attachPrice, menuId: caseMenu.id });
        if (this.caseStock[caseMenu.id] === 0) {
          this.emit(`${caseMenu.name} 품절! 쇼케이스를 클릭해 ${this.format.bakes ? "추가로 구울" : "긴급 납품받을"} 수 있습니다.`, "bad");
        }
      }
    }
    this.hourSlot(agent.hour).served += 1;
    this.hourSlot(agent.hour).revenue += received;
    this.metrics.byType[agent.customer.id].served += 1;
    this.metrics.waits.push(agent.waitMinutes);

    if (this.metrics.served === 1 || this.metrics.served % 25 === 0) {
      const averageWait = this.metrics.waits.reduce((sum, value) => sum + value, 0) / this.metrics.waits.length;
      this.emit(`${this.metrics.served}번째 메뉴 제공 · 평균 대기 ${averageWait.toFixed(1)}분`, "good", agent.id);
    }

    agent.state = agent.channel === "dine" ? "eating" : "pickup";
    agent.stateStart = this.gameMinute;
    let stayFactor = (agent.customer.stayFactor ?? 1) * (this.monthEffects.stay ?? 1);
    if (agent.customer.id === "cafe_studier" && this.dayMods.stayCap) stayFactor *= 0.5;
    const experienceMinutes = agent.channel === "dine" ? Math.max(9, this.format.stay * 0.48 * stayFactor) : 4;
    agent.stateUntil = this.gameMinute + experienceMinutes;
    if (agent.channel === "dine" && this.tables.length) {
      const table = this.tables.find((item) => item.state === "free")
        ?? this.tables.reduce((best, item) => (item.until < best.until ? item : best));
      table.state = "seated";
      table.until = agent.stateUntil;
      table.agentId = agent.id;
      agent.tableId = table.id;
    }
    agent.bubble = agent.waitMinutes < agent.customer.wait * 0.55 ? "빠르다!" : null;
    agent.bubbleTone = "good";
    agent.qualityBonus = effects.quality;
    // 식사 중 손님의 35%는 도중에 뭔가를 부탁한다 — 물, 포크, 콘센트 위치.
    if (agent.channel === "dine" && keyedRandom(this.seed, agent.id, "call") < 0.35) {
      agent.serviceAt = this.gameMinute + 4 + keyedRandom(this.seed, agent.id, "callAt") * (experienceMinutes * 0.5);
    }
  }

  completeExperience(agent) {
    const effects = this.getEffects();
    const fit = tagAffinity(agent.menu, agent.customer, agent.hour);
    const afford = affordability(agent.price, agent.customer);
    const load = clamp(this.activeAgents.filter((item) => item.state === "queueing").length / Math.max(1, this.kitchenLanes.length * 5));
    const machinePenalty = agent.menu.bean && this.machine.wear > 0.65 ? 0.07 : 0;
    const taste = clamp(this.menuBaseQuality(agent.menu) + effects.quality - load * 0.12 - machinePenalty);
    const value = clamp(afford * 0.72 + (1 - agent.menu.foodCost) * 0.18 + effects.value);
    const wait = clamp(1 - agent.waitMinutes / Math.max(1, agent.customer.wait * 1.2));
    const hygiene = clamp(this.hygiene / 100 + effects.hygiene - load * 0.08);
    // 사장이 홀에 있으면 손님이 앉는 자리가 눈에 띄게 정돈되어 있다
    const hallCare = this.atStation("hall") ? 0.08 : 0;
    const atmosphere = agent.channel === "delivery"
      ? clamp(agent.menu.delivery * 0.7 + 0.2)
      : clamp(ATMOSPHERE[this.format.id] * 0.72 + hygiene * 0.28 + hallCare);
    const delivery = agent.channel === "delivery" ? clamp(agent.menu.delivery + this.dayMods.deliveryQuality) : 0.78;
    const p = agent.customer.priorities;
    const weights = {
      taste: 0.28,
      value: 0.2 + p.value * 0.07,
      wait: 0.14 + p.speed * 0.09,
      atmosphere: agent.channel === "delivery" ? 0.05 : 0.13 + p.atmosphere * 0.05,
      delivery: agent.channel === "delivery" ? 0.2 + p.delivery * 0.06 : 0,
      fit: 0.11,
    };
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const components = { taste, value, wait, atmosphere, delivery, fit };
    // 인성 좋은 사장의 가게는 응대가 다르다. 손님이 그걸 느낀다.
    const studierBonus = 0.012 * (this.ownerStats.kind - 3)
      + (agent.customer.id === "cafe_studier" ? this.dayMods.studierBonus : 0)
      + (agent.serviceBonus ?? 0)
      + (this.monthEffects.satisfaction ?? 0);
    const satisfaction = clamp(Object.entries(weights).reduce((sum, [key, weight]) => sum + components[key] * weight, 0) / totalWeight + studierBonus);
    agent.satisfaction = satisfaction;
    this.metrics.satisfactions.push(satisfaction);
    const fitKey = `${agent.menu.id}:${agent.customer.id}`;
    const stat = this.fitStats[fitKey] ?? { count: 0, total: 0 };
    stat.count += 1;
    stat.total += satisfaction;
    this.fitStats[fitKey] = stat;

    if (satisfaction >= 0.67) {
      this.metrics.satisfied += 1;
      this.metrics.byType[agent.customer.id].satisfied += 1;
    }
    // 한국 카페에 팁은 없다. 만족한 손님이 남기는 건 돈이 아니라 "다시 온다"는 마음이다.
    // 그래서 이 게임의 즉각 보상은 팁이 아니라 쿠폰 도장 — 단골이 한 명 늘었다는 신호다.
    const repeatProbability = clamp(0.04 + satisfaction * satisfaction * 0.55 + value * 0.15);
    if (keyedRandom(this.seed, agent.id, "repeat") < repeatProbability) {
      this.metrics.repeatIntent += 1;
      this.pushVisual({ type: "regular" });
    }

    const weightedShortfalls = [
      ["taste", (0.68 - taste) * 0.29],
      ["value", (0.68 - value) * (0.2 + p.value * 0.06)],
      ["wait", (0.68 - wait) * (0.18 + p.speed * 0.07)],
      ["atmosphere", (0.68 - atmosphere) * (0.14 + p.atmosphere * 0.05)],
      ["delivery", agent.channel === "delivery" ? (0.68 - delivery) * 0.28 : -1],
    ].sort((a, b) => b[1] - a[1]);
    const primary = weightedShortfalls[0][1] > 0 ? weightedShortfalls[0][0] : weightedShortfalls.at(-1)?.[0] ?? "taste";
    agent.primaryReason = primary;

    const onlineHabit = agent.customer.id === "mz_hotple" ? 0.88 : agent.customer.id === "cafe_studier" ? 0.7 : agent.customer.id === "delivery_customer" ? 0.78 : 0.44;
    const reviewProbability = clamp(0.05 + onlineHabit * 0.28 + Math.abs(satisfaction - 0.5) * 0.4);
    if (keyedRandom(this.seed, agent.id, "review") < reviewProbability) {
      this.addReview(agent, primary, satisfaction);
    }

    const positive = satisfaction >= 0.67;
    const feedbackGroup = primary === "delivery" ? FEEDBACK.delivery : FEEDBACK[primary] ?? FEEDBACK.taste;
    const pool = positive ? feedbackGroup.positive : feedbackGroup.negative;
    agent.bubble = pool[Math.floor(keyedRandom(this.seed, agent.id, "bubble") * pool.length)];
    agent.bubbleTone = positive ? "good" : "bad";
    if (!positive) this.metrics.losses[primary] = (this.metrics.losses[primary] ?? 0) + 1;
    agent.state = "leaving";
    agent.stateStart = this.gameMinute;
    agent.stateUntil = this.gameMinute + 8;
    agent.outcome = positive ? "satisfied" : "dissatisfied";
    if (agent.channel === "dine" && agent.tableId != null) {
      const table = this.tables[agent.tableId];
      if (table && table.agentId === agent.id) {
        table.state = "dirty";
        table.dirtyAt = this.gameMinute;
        const slotIndex = this.busSlots.reduce((best, value, index, array) => (value < array[best] ? index : best), 0);
        const hasStaff = this.hallStaffCount() > 0;
        if (hasStaff) {
          const start = Math.max(this.gameMinute, this.busSlots[slotIndex]);
          table.cleanAt = start + BUS_MINUTES;
          table.cleaningBy = "staff";
          this.busSlots[slotIndex] = table.cleanAt;
        } else {
          table.cleanAt = 0;
          table.cleaningBy = null;
        }
      }
    }
  }

  addReview(agent, primary, satisfaction) {
    const stars = clamp(Math.round((1 + satisfaction * 4) * 2) / 2, 1, 5);
    const positive = satisfaction >= 0.67;
    const group = primary === "delivery" ? FEEDBACK.delivery : FEEDBACK[primary] ?? FEEDBACK.taste;
    const pool = positive ? group.positive : group.negative;
    const text = pool[Math.floor(keyedRandom(this.seed, agent.id, "reviewText") * pool.length)];
    this.metrics.reviews.push({
      id: agent.id,
      customer: agent.customer.short,
      customerId: agent.customer.id,
      stars,
      text,
      tone: positive ? "good" : "bad",
      reason: primary,
    });
    this.metrics.reviewed += 1;
    if (!positive && !this.milestones.has("first-bad-review")) {
      this.milestones.add("first-bad-review");
      this.emit(`${stars.toFixed(1)}점 리뷰: “${text}”`, "bad", agent.id);
    } else if (positive && !this.milestones.has("first-good-review")) {
      this.milestones.add("first-good-review");
      this.emit(`${stars.toFixed(1)}점 리뷰: “${text}”`, "good", agent.id);
    }
  }

  rejectAgent(agent, reason, messages, tone) {
    this.metrics.losses[reason] = (this.metrics.losses[reason] ?? 0) + 1;
    agent.primaryReason = reason;
    agent.outcome = `lost_${reason}`;
    if (reason === "wait" && this.dayMods.politeWait) tone = "neutral";
    agent.bubble = messages[Math.floor(keyedRandom(this.seed, agent.id, reason, "copy") * messages.length)];
    agent.bubbleTone = tone;
    agent.state = "leaving";
    agent.stateStart = this.gameMinute;
    agent.stateUntil = this.gameMinute + 7;
    if (reason === "wait" && (this.metrics.losses.wait <= 3 || this.metrics.losses.wait % 7 === 0)) {
      this.emit(`${agent.customer.short}: “${agent.bubble}”`, "bad", agent.id);
    }
  }

  finishDay() {
    if (this.finished) return this.lastReport;
    for (const agent of this.activeAgents) {
      if (agent.done) continue;
      if (agent.state === "queueing") {
        const reason = agent.primaryReason === "full" ? "full" : "wait";
        this.metrics.losses[reason] += 1;
        agent.outcome = `lost_${reason}`;
      }
      agent.done = true;
    }
    const effects = this.getEffects();
    this.metrics.wasteCost = this.dayMods.noWaste ? 0 : this.metrics.foodCost * effects.waste;
    // 상담 엑셀의 마지막 줄: 세금 10%, 공과금·복리후생 5%
    this.metrics.taxCost = this.metrics.revenue * GAME_CONFIG.taxRate;
    this.metrics.utilityCost = this.metrics.revenue * GAME_CONFIG.utilityRate * (this.monthEffects.utility ?? 1);
    this.cash -= this.metrics.wasteCost + this.metrics.taxCost + this.metrics.utilityCost;
    this.metrics.ownerMinutes = this.ownerBaseMinutes() + this.ownerInterventionMinutes;
    this.ownerMinutesTotal += this.metrics.ownerMinutes;
    this.lastRepeatIntent = this.metrics.repeatIntent;
    this.metrics.profit = this.metrics.revenue
      - this.metrics.foodCost
      - this.metrics.platformCost
      - this.metrics.wasteCost
      - this.metrics.laborCost
      - this.metrics.rentCost
      - this.metrics.taxCost
      - this.metrics.utilityCost
      - this.metrics.actionCost;
    this.metrics.averageWait = this.metrics.waits.length
      ? this.metrics.waits.reduce((sum, value) => sum + value, 0) / this.metrics.waits.length
      : 0;
    this.metrics.averageSatisfaction = this.metrics.satisfactions.length
      ? this.metrics.satisfactions.reduce((sum, value) => sum + value, 0) / this.metrics.satisfactions.length
      : 0;
    this.metrics.ratingAverage = this.metrics.reviews.length
      ? this.metrics.reviews.reduce((sum, review) => sum + review.stars, 0) / this.metrics.reviews.length
      : this.reputation / 20;

    const reviewSpread = this.getCampaign("short_video")?.reviewSpread ?? 1;
    const reviewGain = this.getCampaign("map_review")?.reviewGain ?? 1;
    let reputationDelta = this.metrics.reviews.length
      ? (this.metrics.ratingAverage - 3.5) * 1.8 * reviewSpread * reviewGain
      : (this.metrics.averageSatisfaction - 0.6) * 0.8;
    let awarenessBonus = 0;
    let influencerNote = null;
    if (this.dayMods.influencer === "special") {
      if (this.metrics.averageSatisfaction >= 0.62) {
        awarenessBonus += 12;
        reputationDelta += 3;
        influencerNote = { tone: "good", text: "리뷰어 영상이 올라왔습니다. “서비스가 아니라 실력이 좋은 집.” 내일 인지도가 뜁니다." };
      } else {
        reputationDelta -= 4;
        influencerNote = { tone: "bad", text: "리뷰어 영상이 올라왔습니다. “기대만 못했다.” 혹평이 빠르게 퍼집니다." };
      }
    } else if (this.dayMods.influencer === "same") {
      reputationDelta += 1;
      influencerNote = { tone: "neutral", text: "리뷰어는 조용히 먹고 갔습니다. 평범하게 대하는 태도가 신뢰를 남겼습니다." };
    }
    reputationDelta += this.dayMods.closingBonus.reputation;
    this.reputation = clamp(this.reputation + reputationDelta, 10, 95);
    this.awareness = clamp(this.awareness + awarenessBonus + this.dayMods.closingBonus.awareness + Math.min(5, this.metrics.served / 30) + this.getActiveCampaigns().reduce((sum, campaign) => sum + (campaign.awareness ?? 0) * 8, 0), 8, 95);
    this.influencerNote = influencerNote;
    const hygieneDrop = this.metrics.served * 0.018 + this.menus.length * 0.3;
    this.hygiene = clamp(this.hygiene - hygieneDrop + effects.hygiene * 8, 35, 98);

    for (const campaign of this.campaigns) campaign.remaining -= 1;
    const report = this.buildReport();
    this.totalHistory.push(report);
    this.lastReport = report;
    this.finished = true;
    this.running = false;
    this.speed = 0;
    return report;
  }

  buildReport() {
    const effects = this.getEffects();
    const lowestPrice = Math.min(...this.menus.map((menu) => menu.price * this.format.spend * effects.price));
    const lossDetails = {
      awareness: `상권 가시성 ${this.district.visibility}/100 · 현재 인지도 ${Math.round(this.awareness)}/100`,
      price: `가장 낮은 판매가 ${formatMoney(lowestPrice)} · 고객별 편안한 예산과 비교`,
      value: `정상 제공 ${this.metrics.served}명 중 가격 대비 구성 불만`,
      menu: `대표 메뉴 ‘${this.menus[0].name}’ · ${this.district.tags.slice(0, 2).join("·")} 수요와 비교`,
      wait: `주문 ${this.metrics.ordered}건 중 정상 제공 ${this.metrics.served}건 · 제공 평균 ${this.metrics.averageWait.toFixed(1)}분`,
      full: `${this.format.seats}석 · 체류 ${this.format.stay}분`,
      delivery: `배달 적합도 ${Math.round(this.menus[0].delivery * 100)}/100 · 플랫폼 주문 경험`,
      taste: `대표 메뉴 기본 품질 ${Math.round(this.menus[0].quality * 100)}/100`,
      atmosphere: `${this.format.name} 공간 적합도 ${Math.round(ATMOSPHERE[this.format.id] * 100)}/100`,
    };
    const denominators = {
      awareness: Math.max(1, this.metrics.footfall),
      price: Math.max(1, this.metrics.aware),
      value: Math.max(1, this.metrics.served),
      menu: Math.max(1, this.metrics.aware),
      wait: Math.max(1, this.metrics.ordered),
      full: Math.max(1, this.metrics.ordered),
      delivery: Math.max(1, this.metrics.served),
      taste: Math.max(1, this.metrics.served),
      atmosphere: Math.max(1, this.metrics.served),
    };
    const impactWeights = {
      // 지나가는 사람보다 이미 선택·주문한 손님을 놓친 원인을 더 무겁게 진단한다.
      awareness: 0.55,
      price: 1,
      value: 1.05,
      menu: 1,
      wait: 1.15,
      full: 1.15,
      delivery: 1.05,
      taste: 1.05,
      atmosphere: 1.05,
    };
    const topLosses = Object.entries(this.metrics.losses)
      .map(([id, count]) => ({
        id,
        label: STAGE_LABEL[id] ?? id,
        count,
        detail: lossDetails[id],
        rate: count / denominators[id],
        score: count / denominators[id] * impactWeights[id],
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.score - a.score || b.count - a.count || a.id.localeCompare(b.id));
    const topLoss = topLosses[0] ?? { id: "awareness", label: "매장 인지", count: 0 };
    const verdicts = {
      awareness: "사람은 지나갔지만, 가게가 선택지에 들어오지 못했습니다.",
      price: "수요가 없는 게 아니라, 가격의 이유가 보이지 않았습니다.",
      value: "구매는 일어났지만 양과 구성에서 가격의 이유가 약했습니다.",
      menu: "상권의 식사 목적과 대표 메뉴가 어긋났습니다.",
      wait: "수요는 충분했습니다. 지금 필요한 것은 홍보가 아니라 처리능력입니다.",
      full: "주방보다 좌석 회전이 먼저 막혔습니다.",
      delivery: "주문은 만들었지만 도착 품질이 재주문을 막았습니다.",
      taste: "화제성보다 제품의 기본 완성도를 먼저 고쳐야 합니다.",
      atmosphere: "음식뿐 아니라 머무는 경험이 기대에 못 미쳤습니다.",
    };
    const fitReveals = [];
    for (const [key, stat] of Object.entries(this.fitStats)) {
      if (stat.count < GAME_CONFIG.fitRevealCount || this.revealedFits.has(key)) continue;
      this.revealedFits.add(key);
      const [menuId, customerId] = key.split(":");
      const grade = fitGrade(stat.total / stat.count);
      fitReveals.push({ key, menuId, customerId, symbol: grade.symbol, label: grade.label, average: stat.total / stat.count });
    }
    return {
      day: this.day,
      dayName: DAY_NAMES[(this.day - 1) % 7],
      weather: this.weather,
      cash: this.cash,
      reputation: this.reputation,
      awareness: this.awareness,
      hygiene: this.hygiene,
      metrics: structuredClone(this.metrics),
      topLosses,
      topLoss,
      verdict: verdicts[topLoss.id],
      fitReveals,
      stationMinutes: { ...this.stationMinutes },
      influencerNote: this.influencerNote ?? null,
      runId: `${this.seed}:DAY_${this.day}`,
    };
  }

  applyActions(actions) {
    let totalCost = 0;
    for (const action of actions) {
      if (action.type === "marketing") {
        totalCost += action.cost;
        const existing = this.campaigns.find((campaign) => campaign.id === action.id);
        if (existing) Object.assign(existing, action, { remaining: Math.max(existing.remaining, action.days) });
        else this.campaigns.push({ ...action, remaining: action.days });
      } else if (!this.upgrades.includes(action.id)) {
        totalCost += action.cost;
        this.upgrades.push(action.id);
      }
    }
    this.cash -= totalCost;
    return totalCost;
  }

  snapshot() {
    return {
      day: this.day,
      dayName: DAY_NAMES[(this.day - 1) % 7],
      gameMinute: this.gameMinute,
      clock: hourToClock(this.gameMinute),
      progress: clamp((this.gameMinute - this.openHour * 60) / Math.max(1, (this.closeHour - this.openHour) * 60)),
      running: this.running,
      finished: this.finished,
      speed: this.speed,
      weather: this.weather,
      phase: this.currentPhase(),
      cash: this.cash,
      reputation: this.reputation,
      awareness: this.awareness,
      hygiene: this.hygiene,
      agents: this.activeAgents,
      metrics: this.metrics,
      feed: this.feed,
      activeCampaigns: this.getActiveCampaigns(),
      upgrades: [...this.upgrades],
      queueLength: this.activeAgents.filter((agent) => agent.state === "queueing").length,
      diningCount: this.activeAgents.filter((agent) => agent.state === "eating").length,
      activeDilemma: this.activeDilemma,
      ownerBoostActive: this.gameMinute < this.ownerBoostUntil,
      ownerBoostReady: this.gameMinute >= this.ownerBoostReadyAt && !this.ownerBusy() && this.onDuty(),
      ownerBoostCooldownRatio: clamp((this.ownerBoostReadyAt - this.gameMinute) / GAME_CONFIG.ownerBoostCooldown),
      fitStats: this.fitStats,
      revealedFits: [...this.revealedFits],
      tables: this.tables,
      dirtyCount: this.tables.filter((table) => table.state === "dirty").length,
      flyersLeft: this.flyersLeft,
      ownerTask: this.ownerTask,
      ownerBusy: this.ownerBusy(),
      dayLabor: this.dayLabor,
      hallStaff: this.hallStaffCount(),
      machineWear: this.machine.wear,
      caseStock: { ...this.caseStock },
      pendingRestock: this.pendingRestock,
      beanTier: this.beanTier,
      ownerRole: this.ownerRole,
      supplyMode: this.supplyMode,
      hourPlan: this.hourPlan,
      demandFactor: this.demandFactor,
      openHour: this.openHour,
      closeHour: this.closeHour,
      ownerMinutesToday: this.ownerBaseMinutes() + this.ownerInterventionMinutes,
      ownerStation: this.ownerStation,
      stationActive: this.stationActive(),
      stationMoving: this.onDuty() && this.gameMinute < this.stationArrivesAt,
      stationArrivesIn: Math.max(0, this.stationArrivesAt - this.gameMinute),
      stationMinutes: { ...this.stationMinutes },
      monthEffects: this.monthEffects,
      ownerWorking: this.ownerWorking,
      ownerBudgetLeft: this.ownerBudgetLeft,
      ownerBudgetTotal: this.ownerBaseMinutes() + (this.ownerExtraMinutes ?? 0),
      stationNames: Object.fromEntries(OWNER_STATIONS.map((item) => [item.id, this.stationName(item.id)])),
      onDuty: this.onDuty(),
      ownerLook: this.ownerLook,
      ownerStats: this.ownerStats,
      ownerAuto: !!this.autoOwner,
      ownerStress: this.ownerStress,
      ownerOvertime: this.ownerOvertime,
      ownerMinutesLeft: this.ownerMinutesLeft(),
      laneBusy: this.kitchenLanes.map((until) => until > this.gameMinute),
    };
  }

  runToEnd(stepSeconds = 0.1) {
    // 자동 진행에서도 사장은 자기 시간을 쓴다. 다만 자리는 병목을 보고 알아서 옮긴다.
    this.autoOwner = true;
    this.toggleOwnerWork(true);
    this.setSpeed(4);
    let guard = 0;
    const maxIterations = Math.ceil(260 / Math.max(1e-4, stepSeconds * 4)) + 100;
    while (!this.finished && guard < maxIterations) {
      this.update(stepSeconds);
      guard += 1;
    }
    return this.lastReport;
  }
}

export function simulateDay(config, day = 1) {
  const sim = new RestaurantSimulation(config);
  sim.startDay(day);
  return sim.runToEnd();
}

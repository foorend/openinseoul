import {
  ALL_ACTIONS,
  BEAN_TIERS,
  CUSTOMERS,
  DAY_NAMES,
  DISTRICTS,
  FORMATS,
  BUSINESS_TYPES,
  GAME_CONFIG,
  OWNER_STATIONS,
  STAFFING_PLANS,
  OWNER_LOOKS,
  OWNER_HAIRS,
  OWNER_STAT_DEFS,
  OWNER_STAT_POOL,
  OWNER_STAT_MAX,
  OWNER_STAT_MIN,
  CAPITAL_OPTIONS,
  EQUIPMENT_TIERS,
  RESEARCH_COST,
  LEASE_BASE_PYEONG,
  LOAN_UNIT,
  LOAN_MAX_UNITS,
  LOAN_ANNUAL_RATE,
  HIRE_OPTIONS,
  BAKERY_GEAR_COST,
  SUPPLY_MODES,
  TIME_LINE,
  MONEY_LINE,
  endingFor,
  eventsForMonth,
  HOUR_PLANS,
  MARKETING,
  MENUS,
  OWNER_ROLES,
  getById,
} from "./data.js";
import { RestaurantSimulation, clamp, fitGrade, formatMoney, hiredLaborCost } from "./sim.js";
import { GameScene, HeroScene } from "./scene.js";
import { mountIllustration } from "./visuals.js";
import { ACHIEVEMENTS, campaignScore, evaluateAchievements, platform } from "./platform.js";
import { buildMonthSummary, monthInfo, seasonFactor, yearEndSettlement, yearGrade, yearVerdict } from "./campaign.js";
import { Tutorial } from "./tutorial.js";
import { ARCADE_BY_STATION, FlyerRun } from "./arcade.js";

const screen = document.querySelector("#screen");
const topbarStatus = document.querySelector("#topbar-status");
const brandHome = document.querySelector("#brand-home");
const soundToggle = document.querySelector("#sound-toggle");
const helpToggle = document.querySelector("#help-toggle");
const helpDialog = document.querySelector("#help-dialog");
const helpClose = document.querySelector("#help-close");
const toastRegion = document.querySelector("#toast-region");

const state = {
  view: "landing",
  step: 0,
  selectedDistrictId: DISTRICTS[0].id,
  districtId: null,
  formatId: null,
  menuIds: [],
  beanTierId: null,
  ownerRoleId: null,
  supplyModeId: null,
  hourPlanId: "standard",
  businessTypeId: "sole",
  campaign: null,
  simulation: null,
  reports: [],
  selectedActions: [],
  soundOn: false,
  tutorialShown: false,
  staffingId: "full",
  restaurantName: "온도커피",
  setupCash: GAME_CONFIG.startingCash,
  // 사장 캐릭터 — 기본은 "보통 사람". 위저드 첫 화면에서 바꾼다.
  ownerLookId: "classic",
  ownerHairId: "black",
  ownerStats: { kind: 1, smart: 1, charm: 1 },
  capitalId: "standard",
  equipmentId: null,
  researchBought: [],
  // 인사 기록 — 한 번이라도 해고를 겪으면 이후엔 권고사직 절차를 밟는다
  everFired: false,
  bakeryGearBought: false,
  arcadeOpen: false,
  pendingArcade: null,
  lastRemaining: null,
  loanUnits: 0,
  pageStart: null,
};

let heroScene = null;
let gameScene = null;
let illustrationDisposers = [];
let operationRaf = null;
let lastFrame = 0;
let reportReadyNotified = false;

class SoundManager {
  constructor() {
    this.context = null;
    this.enabled = false;
  }

  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && !this.context) this.context = new AudioContext();
    if (this.context?.state === "suspended") await this.context.resume();
    return this.enabled;
  }

  tone(frequency = 440, duration = 0.08, type = "sine", volume = 0.035, delay = 0) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  click() { this.tone(320, 0.055, "square", 0.022); }
  good() { this.tone(520, 0.08, "sine", 0.03); this.tone(720, 0.12, "sine", 0.025, 0.065); }
  bad() { this.tone(180, 0.12, "sawtooth", 0.025); }
  bell() { this.tone(880, 0.13, "triangle", 0.03); this.tone(1174, 0.18, "sine", 0.018, 0.04); }
}

const sounds = new SoundManager();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function directionParticle(word) {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return "로";
  const jongseong = (last - 0xac00) % 28;
  return jongseong === 0 || jongseong === 8 ? "로" : "으로";
}

function toast(message, duration = 2600) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  toastRegion.append(element);
  setTimeout(() => element.remove(), duration);
}

function stopAnimatedViews() {
  for (const dispose of illustrationDisposers) dispose();
  illustrationDisposers = [];
  heroScene?.stop();
  heroScene = null;
  if (operationRaf) cancelAnimationFrame(operationRaf);
  operationRaf = null;
  gameScene = null;
  lastFrame = 0;
}

function statusMarkup(label) {
  return label ? `<span class="status-dot"></span><span>${escapeHtml(label)}</span>` : "";
}

function setView(view) {
  stopAnimatedViews();
  state.view = view;
  render();
  requestAnimationFrame(() => screen.focus({ preventScroll: true }));
}

function resetGame() {
  stopAnimatedViews();
  Object.assign(state, {
    view: "landing",
    step: 0,
    selectedDistrictId: DISTRICTS[0].id,
    districtId: null,
    formatId: null,
    menuIds: [],
    beanTierId: null,
    ownerRoleId: null,
    supplyModeId: null,
    hourPlanId: "standard",
    businessTypeId: "sole",
    campaign: null,
    simulation: null,
    reports: [],
    selectedActions: [],
    restaurantName: "온도커피",
    setupCash: GAME_CONFIG.startingCash,
    ownerStats: { kind: 1, smart: 1, charm: 1 },
    ownerLookId: "classic",
    ownerHairId: "black",
    capitalId: "standard",
    equipmentId: null,
    researchBought: [],
    lastRemaining: null,
  loanUnits: 0,
  pageStart: null,
    lastSpendLines: null,
  });
  render();
}

// ── 한 화면 맞춤 ─────────────────────────────────────────────
// 내용이 뷰포트를 넘치면 화면 전체를 조금 줄여 스크롤 없이 다 보이게 한다.
// 가독성이 최우선 — 화면마다 줄여도 되는 하한을 따로 둔다.
// 리포트류: 글씨가 우선, 스크롤 허용(최대 6%만 축소).
// 창업준비/브리핑: 다음 버튼이 늘 보여야 하므로 한 화면에 담되 덜 줄인다(최대 18%).
// 운영(미니게임): 조작을 위해 한 화면(최대 22%).
const FIT_FLOOR = {
  report: 0.94, monthClose: 0.94, monthPlan: 0.94, final: 0.94,
  landing: 0.94, wizard: 0.82, brief: 0.82, operations: 0.78,
};

function fitScreenToViewport() {
  screen.style.zoom = "";
  const chrome = 62 + 30 + 4; // 상단바 + 하단 스트립 + 여유
  const available = window.innerHeight - chrome;
  const content = screen.scrollHeight;
  if (content > available + 2) {
    const floor = FIT_FLOOR[state.view] ?? 0.82;
    screen.style.zoom = String(Math.max(floor, available / content));
  }
}

window.addEventListener("resize", () => fitScreenToViewport());

function render() {
  if (state.view === "landing") renderLanding();
  else if (state.view === "wizard") renderWizard();
  else if (state.view === "brief") renderBrief();
  else if (state.view === "operations") renderOperations();
  else if (state.view === "report") renderReport();
  else if (state.view === "monthClose") renderMonthClose();
  else if (state.view === "monthPlan") renderImprovements();
  else if (state.view === "final") renderYearEnd();
  // 렌더 직후 두 프레임 뒤(폰트·캔버스 마운트 반영 후)에 화면을 맞춘다
  requestAnimationFrame(() => requestAnimationFrame(fitScreenToViewport));
}

function renderLanding() {
  topbarStatus.innerHTML = "";
  screen.innerHTML = `
    <section class="hero-screen enter-up">
      <div class="hero-copy">
        <div>
          <p class="eyebrow">서울 카페 창업 시뮬레이션</p>
          <h1>OPEN<br />IN <em>SEOUL</em><small class="hero-cafe-tag">: CAFE</small></h1>
          <p class="hero-subtitle">나도 서울에서<br /><em>카페 하나 차려보려고~</em></p>

          <div class="hero-cta-row is-primary">
            <button class="primary-button is-hero is-mega" id="start-game" type="button"><span>카페 차리러 가기</span><span aria-hidden="true">→</span></button>
          </div>

          <p class="hero-subcopy">강남·을지로·성수·신촌·강동.<br />자본 규모부터 상권까지 직접 정하는<br /><em>현실적인 서울에서 카페 차리기 대작전!</em></p>
        </div>
        <div class="hero-meta">
          <div><span class="meta-label">캠페인</span><strong>1월 → 12월</strong></div>
          <div><span class="meta-label">상권</span><strong>서울 5곳</strong></div>
          <div><span class="meta-label">시작 자본</span><strong>9천만 ~ 2.4억 · 선택</strong></div>
        </div>
      </div>
      <div class="hero-visual" aria-label="해질녘 서울 골목의 카페 일러스트레이션">
        <canvas class="hero-city-canvas" id="hero-canvas"></canvas>
        <div class="hero-sticker">ONE<br />MORE<br />SHIFT</div>
        <div class="hero-budget">
          <span class="meta-label">수천만 원을 쓰기 전에,</span>
          <strong>먼저 15분만 투자해서<br />카페 한 번 운영해보세요.</strong>
          <span class="meta-label">매출보다 중요한 ‘사장 시급’까지 계산합니다.</span>
        </div>
      </div>
    </section>
  `;
  document.querySelector("#start-game").addEventListener("click", () => {
    sounds.click();
    state.step = 0;
    state.pageStart = null;
    recordPageStart();
    setView("wizard");
  });
  heroScene = new HeroScene(document.querySelector("#hero-canvas"));
  heroScene.start();
}

function sparklineSvg(values, color) {
  const width = 260;
  const height = 56;
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - (value / max) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = points.split(" ").at(-1).split(",");
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <line x1="0" y1="52" x2="260" y2="52" stroke="#c9c4b8" stroke-width="1" />
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${color}" />
  </svg>`;
}

const WIZARD_STEPS = [
  {
    id: "owner", label: "사장", kicker: "00 / WHO ARE YOU",
    title: "이 가게, 누가", accent: "하는 겁니까.",
    lede: "가게보다 사장이 먼저입니다. 어떤 사람인지, 얼마를 들고 시작하는지 — 이게 1년 내내 따라다닙니다.",
  },
  {
    id: "name", label: "가게 이름", kicker: "00-2 / NAME THE PLACE",
    title: "간판에 뭐라고", accent: "적을 겁니까.",
    lede: "이 이름으로 1년을 삽니다. 리포트에도, 리뷰에도, 연말정산 서류에도 이 이름이 적힙니다.",
  },
  {
    id: "district", label: "상권", kicker: "01 / READ THE CITY",
    title: "어디에 열 것인가.", accent: "먼저, 동네를 보세요.",
    lede: "유동인구 총량은 아무것도 알려주지 않습니다. 시세·매출·시급을 나란히 놓고 고르세요.",
  },
  {
    id: "format", label: "카페 유형", kicker: "02 / CHOOSE THE SHOP",
    title: "누가 이 커피를", accent: "만들 것인가.",
    lede: "혼자 다 할지, 바리스타를 둘지, 베이커까지 둘지. 이 선택이 좌석·제조력·매일 나가는 시급을 통째로 정합니다.",
  },
  {
    id: "bean", label: "원두", kicker: "03 / CHOOSE THE BEAN",
    title: "원가율과 맛은", accent: "같은 손잡이입니다.",
    lede: "싼 원두는 원가를 줄이고 리뷰를 깎습니다. 스페셜티는 그 반대고요. 크레마 두께를 보세요.",
  },
  {
    id: "equipment", label: "집기", kicker: "03-2 / BUY THE GEAR",
    title: "머신과 집기에", accent: "얼마를 쓸 겁니까.",
    lede: "중고로 아끼면 손이 느려지고, 하이엔드는 자본을 먹습니다. 이 돈은 지금, 통장에서 바로 나갑니다.",
  },
  {
    id: "supply", label: "디저트 조달", kicker: "04 / SUPPLY THE CASE",
    title: "직접 구울 것인가,", accent: "받아서 팔 것인가.",
    lede: "베이커를 두면 인건비가 무겁지만 갓 구운 것이 무기가 됩니다. 납품받으면 원가와 인건비가 내려가는 대신 어디서나 먹을 수 있는 맛이 됩니다.",
    onlyBakery: true,
  },
  {
    id: "menu", label: "메뉴", kicker: "05 / BUILD THE MENU",
    title: "세 잔으로", accent: "승부합니다.",
    lede: "첫 번째로 고른 것이 시그니처입니다. 커피만으로는 객단가가 오르지 않고, 디저트만으로는 아침이 비어요.",
  },
  {
    id: "role", label: "내 노동", kicker: "06 / YOUR OWN HOURS",
    title: "당신은 하루", accent: "몇 시간 일할 겁니까.",
    lede: "여기서 정하는 건 기본 근무시간입니다. 시간이 끝나도 원하면 얼마든지 더 일할 수 있어요 — 대신 초과 근무는 스트레스가 쌓이고, 그 시간까지 전부 연말에 사장 시급으로 청구됩니다.",
  },
  {
    id: "business", label: "사업자", kicker: "07 / REGISTER THE BUSINESS",
    title: "개인입니까,", accent: "법인입니까.",
    lede: "1년 뒤 연말정산에서 갈립니다. 개인은 누진세 최대 45%, 법인은 2억까지 9% 평평 — 대신 매년 기장료가 나갑니다.",
  },
];

function setupCosts() {
  const district = getById(DISTRICTS, state.districtId);
  const format = getById(FORMATS, state.formatId);
  // 보증금·권리금·인테리어는 평수에 비례한다. 상권만 골라서는 계약이 아니다 —
  // 평수(업태)까지 정해야 임대 비용이 청구된다. 시세표는 12평 기준.
  const pyeongFactor = format ? (format.pyeong ?? LEASE_BASE_PYEONG) / LEASE_BASE_PYEONG : 0;
  const lease = district && format
    ? Math.round((district.lease.deposit + district.lease.keyMoney + district.lease.fitout) * pyeongFactor)
    : 0;
  const formatCost = format?.setupCost ?? 0;
  // 준비 단계의 선택 하나하나가 여기로 모여 자본금에서 빠진다
  const equipment = getById(EQUIPMENT_TIERS, state.equipmentId);
  const equipmentCost = equipment?.cost ?? 0;
  const beanStock = getById(BEAN_TIERS, state.beanTierId)?.initialStock ?? 0;
  const researchSpend = (state.researchBought?.length ?? 0) * RESEARCH_COST;
  const checklist = district ? GAME_CONFIG.openingChecklistCost : 0;
  // 베이커리라면 디저트 조달 방식이 집기 비용을 정한다 — 직접 굽기는 오븐·발효기, 납품은 쇼케이스
  const supplyMode = state.formatId === "bakery_cafe" ? getById(SUPPLY_MODES, state.supplyModeId) : null;
  const supplyGear = supplyMode?.gearCost ?? 0;
  const total = lease + formatCost + equipmentCost + beanStock + researchSpend + checklist + supplyGear;
  const baseCapital = getById(CAPITAL_OPTIONS, state.capitalId)?.amount ?? GAME_CONFIG.startingCash;
  const loan = (state.loanUnits ?? 0) * LOAN_UNIT;
  const capital = baseCapital + loan;
  return {
    district, format, lease, formatCost, equipment, equipmentCost, beanStock, researchSpend,
    total, capital, baseCapital, loan, remaining: capital - total,
    lines: [
      lease ? { label: `${district.shortName} ${format.pyeong}평 보증금·권리금·인테리어`, value: lease } : null,
      format ? { label: `${format.name} 시설`, value: formatCost } : null,
      equipment ? { label: equipment.name, value: equipmentCost } : null,
      supplyGear ? { label: supplyMode.gearLabel, value: supplyGear } : null,
      beanStock ? { label: "원두·부자재 선매입", value: beanStock } : null,
      researchSpend ? { label: `상권 분석 ${state.researchBought.length}부`, value: researchSpend } : null,
      checklist ? { label: "개업 행정·보험", value: checklist } : null,
    ].filter(Boolean),
  };
}

function restaurantNameFor(menu) {
  if (!menu) return "온도커피";
  const names = {
    americano: "온도커피",
    latte: "밀크앤샷",
    signature: "구름상점",
    drip: "슬로우드립",
    ade: "과수원상회",
    cheesecake: "바스크하우스",
    croissant: "버터문",
    saltbread: "소금빵연구소",
  };
  return names[menu.id] ?? "온도커피";
}

// 베이커리를 고르지 않았다면 조달 스텝은 아예 나타나지 않는다.
function activeSteps() {
  return WIZARD_STEPS.filter((step) => !step.onlyBakery || state.formatId === "bakery_cafe");
}

function stepComplete(stepId) {
  if (stepId === "owner") {
    const spent = state.ownerStats.kind + state.ownerStats.smart + state.ownerStats.charm;
    return !!state.ownerLookId && !!state.capitalId && spent === OWNER_STAT_POOL;
  }
  if (stepId === "equipment") return !!state.equipmentId;
  if (stepId === "name") return (state.restaurantName ?? "").trim().length >= 1;
  if (stepId === "supply") return !!state.supplyModeId;
  if (stepId === "district") return !!state.districtId;
  if (stepId === "format") return !!state.formatId;
  if (stepId === "bean") return !!state.beanTierId;
  if (stepId === "menu") return state.menuIds.length === GAME_CONFIG.maxMenuChoices;
  if (stepId === "role") return !!state.ownerRoleId;
  if (stepId === "business") return !!state.businessTypeId;
  return false;
}

function clearIllustrations() {
  for (const dispose of illustrationDisposers) dispose();
  illustrationDisposers = [];
}

function mountStepArt(root) {
  root.querySelectorAll("canvas[data-art-kind]").forEach((canvas) => {
    const extra = canvas.dataset.artDistrict ? getById(DISTRICTS, canvas.dataset.artDistrict) : undefined;
    const artId = canvas.dataset.artKind === "hours"
      ? getById(HOUR_PLANS, canvas.dataset.artId)
      : canvas.dataset.artId;
    illustrationDisposers.push(mountIllustration(canvas, canvas.dataset.artKind, artId, extra));
  });
}

// 페이지에 들어선 순간의 잔액을 기억해 둔다 — "이 페이지에서 뭐가 얼마 빠졌나"의 기준점
function recordPageStart() {
  const costs = setupCosts();
  state.pageStart = {
    remaining: costs.remaining,
    lines: Object.fromEntries(costs.lines.map((line) => [line.label, line.value])),
  };
}

function goToStep(index) {
  if (index < 0) {
    resetGame();
    return;
  }
  state.step = Math.min(index, WIZARD_STEPS.length - 1);
  recordPageStart();
  sounds.click();
  setView("wizard");
}

function advanceStep() {
  const step = activeSteps()[state.step];
  if (!stepComplete(step.id)) return;
  if (state.step === activeSteps().length - 1) {
    startCampaign();
    return;
  }
  recordPageStart();
  state.step += 1;
  sounds.bell();
  setView("wizard");
}

function choiceCard({ id, attr, name, sub, art, artExtra, meta, selected, disabled, size = "" }) {
  return `
    <button class="choice-card ${size} ${selected ? "is-selected" : ""}" data-${attr}="${id}" type="button" ${disabled ? "disabled" : ""}>
      <span class="choice-art"><canvas data-art-kind="${art.kind}" data-art-id="${art.id}" ${artExtra ? `data-art-district="${artExtra}"` : ""} aria-hidden="true"></canvas></span>
      <span class="choice-body">
        <span class="choice-name">${name}</span>
        ${sub ? `<span class="choice-sub">${sub}</span>` : ""}
        ${meta?.length ? `<span class="choice-meta">${meta.map((m) => `<b>${m}</b>`).join("")}</span>` : ""}
      </span>
      <span class="choice-check" aria-hidden="true">✓</span>
    </button>`;
}

function districtStepMarkup() {
  const selected = getById(DISTRICTS, state.selectedDistrictId);
  const lease = selected.lease;
  return `
    <div class="district-layout">
      <div class="district-picker">
        ${DISTRICTS.map((district) => choiceCard({
          id: district.id, attr: "district", name: district.name, sub: district.tagline,
          art: { kind: "district", id: district.id },
          meta: [`12평 기준 월세 ${formatMoney(district.lease.monthlyRent, true)}`, `시급 ₩${district.hourlyWage.toLocaleString("ko-KR")}`],
          selected: district.id === state.selectedDistrictId,
          size: "is-compact",
        })).join("")}
      </div>
      <aside class="district-detail">
        <div class="detail-art"><canvas data-art-kind="district" data-art-id="${selected.id}" aria-hidden="true"></canvas>
          <div class="detail-art-label"><span>${selected.number}</span><strong>${selected.shortName}</strong></div>
        </div>
        <div class="detail-body">
          <p class="detail-desc">${selected.description}</p>
          <div class="chip-row">${selected.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
          <div class="research-block">
            <span class="label">이 동네 숫자</span>
            ${state.researchBought.includes(selected.id)
              ? Object.entries(selected.research).map(([key, insight]) => `
                <div class="research-row is-open">
                  <span class="research-title">${insight.title}</span>
                  <span class="research-text">${insight.text}</span>
                </div>`).join("")
              : `${Object.entries(selected.research).map(([key, insight]) => `
                <div class="research-row is-locked">
                  <span class="research-title">${insight.title}</span>
                  <span class="research-text is-blurred" aria-hidden="true">${insight.text}</span>
                </div>`).join("")}
              <button class="research-buy" id="buy-research" type="button">
                <b>📊 상권 분석 리포트 구매 — ${formatMoney(RESEARCH_COST)}</b>
                <span>부동산 시세 · 동종업계 매출 · 시급 시세. 발품 대신 돈으로 삽니다.</span>
              </button>`}
          </div>
          <div class="lease-sheet">
            <span class="lease-note">12평 기준 시세 — 실제 금액은 평수를 정하는 순간 계약됩니다</span>
            <div><span>보증금</span><b>${formatMoney(lease.deposit)}</b></div>
            <div><span>권리금</span><b>${formatMoney(lease.keyMoney)}</b></div>
            <div><span>월세</span><b>${formatMoney(lease.monthlyRent)}</b></div>
            <div><span>인테리어</span><b>${formatMoney(lease.fitout)}</b></div>
          </div>
          <p class="detail-warning">${selected.warning}</p>
        </div>
      </aside>
    </div>`;
}

function renderWizard() {
  const steps = activeSteps();
  if (state.step >= steps.length) state.step = steps.length - 1;
  const step = steps[state.step];
  const costs = setupCosts();
  // 방금 선택으로 "뭐 때문에 얼마"가 빠졌는지 — 항목 diff로 사유까지 보여준다
  const budgetDelta = state.lastRemaining == null ? 0 : costs.remaining - state.lastRemaining;
  let deltaReason = "";
  if (budgetDelta !== 0) {
    const prevLines = state.lastSpendLines ?? {};
    const changed = costs.lines.find((line) => (prevLines[line.label] ?? 0) < line.value)
      ?? costs.lines.find((line) => !(line.label in prevLines));
    deltaReason = changed?.label ?? "";
  }
  state.lastSpendLines = Object.fromEntries(costs.lines.map((line) => [line.label, line.value]));
  state.lastRemaining = costs.remaining;
  const spentLines = costs.lines.filter((line) => line.value > 0);
  const spentTotal = costs.total;
  // 이 페이지에 들어온 뒤 무엇이 얼마나 빠졌나 — 항목별로 보여준다
  const pageDiffLines = state.pageStart
    ? costs.lines
      .map((line) => ({ label: line.label, delta: line.value - (state.pageStart.lines[line.label] ?? 0) }))
      .filter((line) => line.delta > 0)
    : [];
  topbarStatus.innerHTML = statusMarkup(`STEP ${String(state.step + 1).padStart(2, "0")} / ${step.label}`);

  let body = "";
  let lockedChoices = false;  // 이 페이지에 자본 부족으로 잠긴 카드가 있나 — 있으면 대출 버튼을 연다
  if (step.id === "owner") {
    const spent = state.ownerStats.kind + state.ownerStats.smart + state.ownerStats.charm;
    const remaining = OWNER_STAT_POOL - spent;
    body = `
      <div class="owner-setup">
        <div class="owner-col">
          <span class="meta-label">스타일</span>
          <div class="choice-grid cols-2 owner-looks">
            ${OWNER_LOOKS.map((look) => `
              <button class="choice-card is-tile ${state.ownerLookId === look.id ? "is-selected" : ""}" data-look="${look.id}" type="button">
                <span class="owner-swatch" style="background:${look.color}">${look.icon}</span>
                <h3>${look.name}</h3><p>${look.description}</p>
              </button>`).join("")}
          </div>
        </div>
        <div class="owner-col">
          <span class="meta-label">헤어</span>
          <div class="hair-row">
            ${OWNER_HAIRS.map((hairOption) => `
              <button class="hair-swatch ${state.ownerHairId === hairOption.id ? "is-selected" : ""}" data-hair="${hairOption.id}" type="button" title="${hairOption.name}">
                <i style="background:${hairOption.color}"></i><span>${hairOption.name}</span>
              </button>`).join("")}
          </div>
          <div class="stat-heading ${remaining === 0 ? "is-done" : ""}">
            <strong>스탯</strong>
            <span>남은 포인트</span>
            <b class="${remaining === 0 ? "is-good" : "is-warn"}">${remaining}</b>
          </div>
          <div class="stat-rows">
            ${OWNER_STAT_DEFS.map((stat) => {
              const value = state.ownerStats[stat.id];
              return `<div class="stat-row">
                <div class="stat-name"><span>${stat.icon} ${stat.name}</span><p>${stat.description}</p></div>
                <div class="stat-ctrl">
                  <button class="stat-btn" data-stat="${stat.id}" data-delta="-1" type="button" ${value <= OWNER_STAT_MIN ? "disabled" : ""}>−</button>
                  <span class="stat-dots">${Array.from({ length: OWNER_STAT_MAX }, (_, i) => `<i class="${i < value ? "on" : ""}"></i>`).join("")}</span>
                  <button class="stat-btn" data-stat="${stat.id}" data-delta="1" type="button" ${value >= OWNER_STAT_MAX || remaining <= 0 ? "disabled" : ""}>＋</button>
                </div>
              </div>`;
            }).join("")}
          </div>
        </div>
        <div class="owner-col">
          <span class="meta-label">시작 자본</span>
          <div class="capital-list">
            ${CAPITAL_OPTIONS.map((option) => `
              <button class="repday ${state.capitalId === option.id ? "is-selected" : ""}" data-capital="${option.id}" type="button">
                <b>${option.icon} ${option.name} — ${formatMoney(option.amount, true)}</b><span>${option.description}</span>
              </button>`).join("")}
          </div>
        </div>
      </div>`;
  } else if (step.id === "name") {
    const suggestions = ["온도커피", "구름상점", "소금빵연구소", "밀크앤샷", "슬로우드립", "바스크하우스"];
    body = `
      <div class="name-stage">
        <div class="name-sign" aria-hidden="true">
          <span class="name-sign-glow"></span>
          <b id="name-preview">${escapeHtml(state.restaurantName || "간판이 비어 있습니다")}</b>
        </div>
        <input id="shop-name-input" class="name-input" type="text" maxlength="14" value="${escapeHtml(state.restaurantName ?? "")}" placeholder="가게 이름을 적어주세요" autocomplete="off" />
        <div class="name-suggestions">
          ${suggestions.map((name) => `<button class="name-chip" data-name-pick="${name}" type="button">${name}</button>`).join("")}
        </div>
        <p class="name-hint">직접 짓는 이름이 제일 오래갑니다. 언제든 아침 브리핑에서 바꿀 수 있어요.</p>
      </div>`;
  } else if (step.id === "district") {
    body = districtStepMarkup();
  } else if (step.id === "format") {
    const leaseDistrict = getById(DISTRICTS, state.districtId);
    body = `<div class="choice-grid cols-3">${FORMATS.map((format) => {
      const factor = (format.pyeong ?? LEASE_BASE_PYEONG) / LEASE_BASE_PYEONG;
      const leaseHere = leaseDistrict
        ? Math.round((leaseDistrict.lease.deposit + leaseDistrict.lease.keyMoney + leaseDistrict.lease.fitout) * factor)
        : 0;
      const rentHere = leaseDistrict ? Math.round(leaseDistrict.lease.monthlyRent * factor) : 0;
      // 지금 잔액으로 감당 못 하는 평수는 잠근다 — 마지막에 가서 당황하지 않게
      const currentCost = state.formatId
        ? (() => { const cur = getById(FORMATS, state.formatId); const curFactor = (cur.pyeong ?? LEASE_BASE_PYEONG) / LEASE_BASE_PYEONG; return (leaseDistrict ? Math.round((leaseDistrict.lease.deposit + leaseDistrict.lease.keyMoney + leaseDistrict.lease.fitout) * curFactor) : 0) + cur.setupCost; })()
        : 0;
      const wouldRemain = costs.remaining + currentCost - (leaseHere + format.setupCost);
      const unaffordable = wouldRemain < 0;
      if (unaffordable) lockedChoices = true;
      return choiceCard({
        id: format.id, attr: "format", name: format.name, sub: format.description,
        art: { kind: "format", id: format.id },
        meta: unaffordable ? [`${format.pyeong}평 · ${format.seats}석`, `계약 ${formatMoney(leaseHere + format.setupCost, true)}`, "🔒 자본 부족 — 대출 필요"] : [
          `${format.pyeong}평 · ${format.seats}석`,
          leaseHere ? `계약 ${formatMoney(leaseHere + format.setupCost, true)}` : formatMoney(format.setupCost, true),
          rentHere ? `월세 ${formatMoney(rentHere, true)}` : (format.hires.length ? `고용 ${format.hires.length}명` : "고용 없음"),
        ],
        selected: state.formatId === format.id,
        disabled: unaffordable,
      });
    }).join("")}</div>`;
  } else if (step.id === "bean") {
    body = `<div class="choice-grid cols-3">${BEAN_TIERS.map((tier) => choiceCard({
      id: tier.id, attr: "bean", name: tier.name, sub: tier.description,
      art: { kind: "bean", id: tier.id },
      meta: [`원가 ${Math.round(tier.costRatio * 100)}%`, tier.quality > 0 ? `맛 +${Math.round(tier.quality * 100)}` : tier.quality < 0 ? `맛 ${Math.round(tier.quality * 100)}` : "맛 ±0"],
      selected: state.beanTierId === tier.id,
    })).join("")}</div>`;
  } else if (step.id === "menu") {
    const isBakery = state.formatId === "bakery_cafe";
    body = `<div class="choice-grid cols-4">${MENUS.map((menu) => {
      const order = state.menuIds.indexOf(menu.id);
      const locked = menu.bakeryOnly && !isBakery;
      return choiceCard({
        id: menu.id, attr: "menu", name: `${order === 0 ? "<i class='sig'>시그니처</i> " : ""}${menu.name}`,
        sub: locked ? "베이커리 카페에서만 만들 수 있습니다" : `${formatMoney(menu.price)} · 제조 ${menu.cook}분`,
        art: { kind: "menu", id: menu.id },
        meta: locked ? [] : [menu.bean ? "원두 등급 적용" : `원가 ${Math.round(menu.foodCost * 100)}%`, ...menu.tags.slice(0, 2)],
        selected: order >= 0, disabled: locked, size: "is-tile",
      });
    }).join("")}</div>`;
  } else if (step.id === "equipment") {
    body = `<div class="choice-grid cols-3">${EQUIPMENT_TIERS.map((tier) => {
      const currentCost = getById(EQUIPMENT_TIERS, state.equipmentId)?.cost ?? 0;
      const unaffordable = costs.remaining + currentCost - tier.cost < 0;
      if (unaffordable) lockedChoices = true;
      return choiceCard({
        id: tier.id, attr: "equipment", name: `${tier.icon} ${tier.name}`, sub: tier.description,
        art: { kind: "equipment", id: tier.id },
        meta: unaffordable ? [`지금 결제 ${formatMoney(tier.cost, true)}`, "🔒 자본 부족 — 대출 필요"] : [`지금 결제 ${formatMoney(tier.cost, true)}`, tier.cookSpeed !== 1 ? `제조 ${tier.cookSpeed > 1 ? "+" : ""}${Math.round((tier.cookSpeed - 1) * 100)}%` : "제조 기준", tier.quality ? `맛 ${tier.quality > 0 ? "+" : ""}${Math.round(tier.quality * 100)}` : "맛 ±0"],
        selected: state.equipmentId === tier.id,
        disabled: unaffordable,
      });
    }).join("")}</div>`;
  } else if (step.id === "supply") {
    const baseSeats = getById(FORMATS, "bakery_cafe").seats;
    body = `<div class="choice-grid cols-3">${SUPPLY_MODES.map((mode) => choiceCard({
      id: mode.id, attr: "supply", name: `${mode.icon} ${mode.name}`, sub: mode.description,
      art: { kind: "format", id: mode.id === "bake" ? "bakery_cafe" : "specialty_cafe" },
      meta: [
        `${mode.gearLabel} +${formatMoney(mode.gearCost, true)}`,
        mode.seatsDelta >= 0 && mode.id === "buy"
          ? `좌석 ${baseSeats + mode.seatsDelta}석 — 주방이 작아 +${mode.seatsDelta}석`
          : `좌석 ${baseSeats}석 — 주방 확장이 좌석을 먹습니다`,
        mode.needsBaker ? "베이커 고용" : "베이커 없음",
        mode.quality > 0 ? "맛 +6" : "맛 −5 · 재료비 −28%",
      ],
      selected: state.supplyModeId === mode.id,
    })).join("")}</div>`;
  } else if (step.id === "business") {
    body = `<div class="choice-grid cols-3">${BUSINESS_TYPES.map((type) => choiceCard({
      id: type.id, attr: "business", name: type.name, sub: `${type.description}<br /><em class="advice">${type.advice}</em>`,
      art: { kind: "business", id: type.id },
      meta: [type.setupCost ? `설립 ${formatMoney(type.setupCost, true)}` : "설립비 없음", `기장 ${formatMoney(type.annualKeeping, true)}/년`],
      selected: state.businessTypeId === type.id,
    })).join("")}</div>`;
  } else if (step.id === "role") {
    body = `<div class="choice-grid cols-3">${OWNER_ROLES.map((role) => choiceCard({
      id: role.id, attr: "role", name: role.name, sub: role.description,
      art: { kind: "role", id: role.id },
      meta: [`하루 ${role.hoursPerDay}시간`, role.capacityBonus > 1 ? "제조 +25%" : "제조 보너스 없음"],
      selected: state.ownerRoleId === role.id,
    })).join("")}</div>`;
  }

  // 돈이 안 되면 문을 못 연다. 자본을 늘리거나 더 싼 선택으로 돌아가야 한다.
  const broke = costs.remaining < 0 && !!state.districtId && !!state.formatId;
  const ready = stepComplete(step.id) && !(broke && state.step === steps.length - 1);
  const last = state.step === steps.length - 1;
  const nextLabel = last ? (broke ? "자본이 부족합니다 — 선택을 바꾸세요" : "가게 문 열 준비") : `${steps[state.step + 1].label} 고르기`;
  const hint = step.id === "menu" ? `${state.menuIds.length} / ${GAME_CONFIG.maxMenuChoices} 선택` : "";

  screen.innerHTML = `
    <section class="wizard">
      <header class="wizard-bar">
        <button class="back-control" id="wizard-back" type="button"><span aria-hidden="true">←</span>${state.step === 0 ? "처음으로" : steps[state.step - 1].label}</button>
        <ol class="step-rail">
          ${steps.map((item, index) => `<li class="${index === state.step ? "is-current" : ""} ${index < state.step || stepComplete(item.id) ? "is-done" : ""}"><button data-step="${index}" type="button" ${index > state.step && !stepComplete(step.id) ? "disabled" : ""}><b>${String(index + 1).padStart(2, "0")}</b><span>${item.label}</span></button></li>`).join("")}
        </ol>
        <div class="capital-tracker ${budgetDelta < 0 ? "is-flash" : ""}">
          <div class="ct-now"><span class="ct-label">남는<br />운전자금</span><strong class="${costs.remaining < 300 ? "is-danger" : ""}">${formatMoney(costs.remaining)}</strong></div>
          ${pageDiffLines.length ? `<div class="ct-diff">
            <em>이 페이지에서 ${formatMoney(state.pageStart.remaining)} →</em>
            ${pageDiffLines.map((line) => `<span class="ct-diff-line"><i>${line.label}</i><b>−${formatMoney(line.delta)}</b></span>`).join("")}
          </div>` : ""}
          ${costs.loan ? `<div class="ct-loan">대출 ${formatMoney(costs.loan, true)} · 월 이자 ${formatMoney(costs.loan * LOAN_ANNUAL_RATE / 12)}</div>` : ""}
          ${(costs.remaining < 1500 || lockedChoices) && state.loanUnits < LOAN_MAX_UNITS ? `<button class="ct-loan-btn" id="take-loan" type="button">＋ ${formatMoney(LOAN_UNIT, true)} 대출받기 <small>월 이자 ${formatMoney(LOAN_UNIT * LOAN_ANNUAL_RATE / 12)}</small></button>` : ""}
        </div>
      </header>

      <div class="wizard-head">
        <p class="kicker">${step.kicker}</p>
        <h1>${step.title}<em>${step.accent}</em></h1>
        <p class="lede">${step.lede}</p>
      </div>

      <div class="wizard-body">${body}</div>

      <footer class="wizard-foot">
        <div class="foot-summary">
          ${state.districtId ? `<span class="chip">${getById(DISTRICTS, state.districtId).shortName}</span>` : ""}
          ${state.formatId ? `<span class="chip">${getById(FORMATS, state.formatId).name}</span>` : ""}
          ${state.beanTierId ? `<span class="chip">${getById(BEAN_TIERS, state.beanTierId).name}</span>` : ""}
          ${state.menuIds.map((id, index) => `<span class="chip ${index === 0 ? "is-accent" : ""}">${getById(MENUS, id).name}</span>`).join("")}
          ${state.ownerRoleId ? `<span class="chip">${getById(OWNER_ROLES, state.ownerRoleId).name}</span>` : ""}
          ${state.step >= 5 && state.businessTypeId ? `<span class="chip">${getById(BUSINESS_TYPES, state.businessTypeId).name}</span>` : ""}
          ${hint ? `<span class="foot-hint">${hint}</span>` : ""}
        </div>
        <div class="spend-strip" title="지금까지의 개업 지출">
          ${spentLines.length
            ? `${spentLines.map((line) => `<span class="spend-item">${line.label} <b>−${formatMoney(line.value, true)}</b></span>`).join("")}
               <span class="spend-total">합계 −${formatMoney(spentTotal, true)}</span>`
            : `<span class="spend-item">아직 쓴 돈이 없습니다. 지금부터의 선택 하나하나가 여기 쌓입니다.</span>`}
        </div>
        <button class="cta" id="wizard-next" type="button" ${ready ? "" : "disabled"}><span>${nextLabel}</span><span aria-hidden="true">→</span></button>
      </footer>
    </section>`;

  clearIllustrations();
  mountStepArt(screen);

  document.querySelector("#take-loan")?.addEventListener("click", () => {
    if (state.loanUnits >= LOAN_MAX_UNITS) return;
    state.loanUnits += 1;
    sounds.good();
    toast(`${formatMoney(LOAN_UNIT, true)} 대출 실행. 매달 이자 ${formatMoney(LOAN_UNIT * LOAN_ANNUAL_RATE / 12)}이 원장에 찍힙니다.`);
    setView("wizard");
  });
  document.querySelector("#wizard-back").addEventListener("click", () => goToStep(state.step - 1));
  document.querySelector("#wizard-next").addEventListener("click", advanceStep);
  screen.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.step);
    if (index > state.step && !stepComplete(WIZARD_STEPS[state.step].id)) return;
    goToStep(index);
  }));

  const nameInput = screen.querySelector("#shop-name-input");
  if (nameInput) {
    nameInput.addEventListener("input", () => {
      state.restaurantName = nameInput.value;
      const preview = screen.querySelector("#name-preview");
      if (preview) preview.textContent = nameInput.value.trim() || "간판이 비어 있습니다";
      const next = screen.querySelector("#wizard-next");
      if (next) next.disabled = !nameInput.value.trim();
    });
    setTimeout(() => nameInput.focus(), 60);
    screen.querySelectorAll("[data-name-pick]").forEach((button) => button.addEventListener("click", () => {
      state.restaurantName = button.dataset.namePick;
      sounds.click();
      setView("wizard");
    }));
  }
  screen.querySelectorAll("[data-look]").forEach((button) => button.addEventListener("click", () => {
    state.ownerLookId = button.dataset.look;
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-hair]").forEach((button) => button.addEventListener("click", () => {
    state.ownerHairId = button.dataset.hair;
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-stat]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.stat;
    const delta = Number(button.dataset.delta);
    const next = state.ownerStats[id] + delta;
    const spent = state.ownerStats.kind + state.ownerStats.smart + state.ownerStats.charm;
    if (next < OWNER_STAT_MIN || next > OWNER_STAT_MAX) return;
    if (delta > 0 && spent >= OWNER_STAT_POOL) return;
    state.ownerStats = { ...state.ownerStats, [id]: next };
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-capital]").forEach((button) => button.addEventListener("click", () => {
    state.capitalId = button.dataset.capital;
    sounds.click();
    setView("wizard");
  }));
  document.querySelector("#buy-research")?.addEventListener("click", () => {
    const districtId = state.selectedDistrictId;
    if (state.researchBought.includes(districtId)) return;
    const costsNow = setupCosts();
    if (costsNow.remaining < RESEARCH_COST) { toast("자본이 부족합니다. 분석은 포기하고 감으로 가야 할 수도요."); sounds.bad(); return; }
    state.researchBought = [...state.researchBought, districtId];
    sounds.good();
    toast(`${getById(DISTRICTS, districtId).shortName} 분석 리포트 구매 — ${formatMoney(RESEARCH_COST)} 차감`);
    setView("wizard");
  });
  screen.querySelectorAll("[data-district]").forEach((button) => button.addEventListener("click", () => {
    state.selectedDistrictId = button.dataset.district;
    state.districtId = button.dataset.district;
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-format]").forEach((button) => button.addEventListener("click", () => {
    state.formatId = button.dataset.format;
    if (state.formatId !== "bakery_cafe") state.menuIds = state.menuIds.filter((id) => !getById(MENUS, id)?.bakeryOnly);
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-bean]").forEach((button) => button.addEventListener("click", () => {
    state.beanTierId = button.dataset.bean;
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-equipment]").forEach((button) => button.addEventListener("click", () => {
    state.equipmentId = button.dataset.equipment;
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-supply]").forEach((button) => button.addEventListener("click", () => {
    state.supplyModeId = button.dataset.supply;
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-business]").forEach((button) => button.addEventListener("click", () => {
    state.businessTypeId = button.dataset.business;
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-role]").forEach((button) => button.addEventListener("click", () => {
    state.ownerRoleId = button.dataset.role;
    sounds.click();
    setView("wizard");
  }));
  screen.querySelectorAll("[data-menu]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.menu;
    if (state.menuIds.includes(id)) state.menuIds = state.menuIds.filter((menuId) => menuId !== id);
    else if (state.menuIds.length < GAME_CONFIG.maxMenuChoices) state.menuIds = [...state.menuIds, id];
    else toast("메뉴는 세 개까지만 운영할 수 있습니다.");
    sounds.click();
    setView("wizard");
  }));
}

function startCampaign() {
  const { district, format: baseFormat, remaining } = setupCosts();
  // 디저트 조달이 좌석을 정한다 — 납품이면 주방이 작아 좌석이 늘어난다
  const supplyPick = baseFormat?.bakes ? getById(SUPPLY_MODES, state.supplyModeId ?? "bake") : null;
  const format = supplyPick?.seatsDelta
    ? { ...baseFormat, seats: baseFormat.seats + supplyPick.seatsDelta }
    : baseFormat;
  const menus = state.menuIds.map((id) => getById(MENUS, id));
  // 위저드에서 이미 간판을 달았다. 비어 있을 때만 시그니처 기반 추천으로 채운다.
  if (!(state.restaurantName ?? "").trim()) state.restaurantName = restaurantNameFor(menus[0]);
  state.setupCash = remaining;
  state.simulation = new RestaurantSimulation({
    seed: "OPEN_IN_SEOUL_CAFE_V1",
    district,
    format,
    menus,
    beanTier: getById(BEAN_TIERS, state.beanTierId ?? "standard"),
    ownerRole: getById(OWNER_ROLES, state.ownerRoleId ?? "fulltime"),
    hourPlan: getById(HOUR_PLANS, state.hourPlanId ?? "standard"),
    supplyMode: getById(SUPPLY_MODES, state.supplyModeId ?? "bake"),
    ownerStats: state.ownerStats,
    equipment: getById(EQUIPMENT_TIERS, state.equipmentId ?? "standard"),
    ownerLook: {
      ...getById(OWNER_LOOKS, state.ownerLookId ?? "classic"),
      hair: getById(OWNER_HAIRS, state.ownerHairId ?? "black")?.color,
    },
    cash: remaining,
    reputation: GAME_CONFIG.reputationBase,
    awareness: GAME_CONFIG.awarenessBase,
    hygiene: GAME_CONFIG.hygieneBase,
  });
  state.reports = [];
  state.campaign = {
    month: 1,
    stage: "weekday",
    weekdayReport: null,
    weekendReport: null,
    months: [],
    businessTypeId: state.businessTypeId ?? "sole",
    loanAmount: (state.loanUnits ?? 0) * LOAN_UNIT,
    ownerMinutesTotal: 0,
    repDay: "weekday",
    events: [],
    eventChoices: {},
  };
  rollMonthEvents();
  state.simulation.demandFactor = seasonFactor(1, district.id);
  state.simulation.startDay(1);
  state.simulation.onFeed((entry) => {
    if (entry.tone === "bad") sounds.bad();
    else if (entry.tone === "good") sounds.good();
  });
  sounds.bell();
  setView("brief");
}

function dailyGoal() {
  const previous = state.reports.at(-1);
  if (!previous) return { title: "첫 손님을 만나세요", detail: "오늘은 기준선을 만드는 날입니다. 어디서 손님이 새는지 눈으로 확인하세요." };
  if (previous.metrics.profit < 0) return { title: "흑자 전환", detail: `어제 ${formatMoney(previous.metrics.profit)}. 오늘은 하루 영업이익을 0 위로 올리세요.` };
  if (previous.metrics.averageWait > 8) return { title: "평균 대기 8분 이하", detail: `어제 평균 ${previous.metrics.averageWait.toFixed(1)}분. 처리속도가 매출보다 먼저입니다.` };
  if (previous.reputation < 72) return { title: "평판 3.6 넘기", detail: "이익이 났다면 이제 리뷰가 자산입니다. 만족 경험을 쌓으세요." };
  return { title: "연속 흑자 지키기", detail: "생존 판정은 최근 3일 이익으로 계산됩니다. 오늘도 무너지지 않는 것이 목표입니다." };
}

// 이벤트 선택에 붙은 비용은 그 달에 한 번만 청구한다
function chargeEventChoices() {
  const campaign = state.campaign;
  const sim = state.simulation;
  campaign.chargedEvents = campaign.chargedEvents ?? {};
  for (const event of campaign.events ?? []) {
    const key = `${campaign.month}:${event.id}`;
    if (campaign.chargedEvents[key]) continue;
    const option = event.choice?.options.find((item) => item.id === campaign.eventChoices?.[event.id]);
    if (!option?.cost) continue;
    sim.cash -= option.cost;
    campaign.chargedEvents[key] = true;
  }
}

function renderBrief() {
  const sim = state.simulation;
  const snapshot = sim.snapshot();
  const day = snapshot.day;
  const previous = state.reports.at(-1);
  const goal = dailyGoal();
  const isWeekend = day >= 6;
  const dayName = DAY_NAMES[(day - 1) % 7];
  const isOpeningDay = day === 1;
  const plan = getById(HOUR_PLANS, state.hourPlanId);
  const laborFor = (candidate) => hiredLaborCost(sim.format, sim.district, candidate);
  topbarStatus.innerHTML = statusMarkup(`${monthInfo(state.campaign?.month ?? 1).name} ${isWeekend ? "주말" : "평일"} · 아침 브리핑`);

  screen.innerHTML = `
    <section class="brief">
      <header class="brief-bar">
        <button class="back-control" id="brief-back" type="button"><span aria-hidden="true">←</span>${isOpeningDay ? "설계 다시" : "어제 리포트"}</button>
        <div class="brief-daytag"><b>${monthInfo(state.campaign?.month ?? 1).name}</b><span>${isWeekend ? "주말 영업" : "평일 영업"} · ${dayName}요일</span></div>
        <div class="brief-weather"><span class="glyph">${snapshot.weather.icon}</span><b>${snapshot.weather.name}</b><small>${snapshot.weather.id === "rain" ? "보행 −28% · 배달 +34%" : snapshot.weather.id === "hot" ? "보행 −16% · 배달 +15%" : snapshot.weather.id === "cloudy" ? "보행 −7%" : "평온"}</small></div>
      </header>

      <div class="brief-grid">
        <div class="brief-main">
          ${isOpeningDay ? `
            <section class="brief-card naming-card">
              <span class="card-label">간판을 답니다</span>
              <h2>가게 이름을 정하세요</h2>
              <div class="name-field">
                <span class="name-prefix" aria-hidden="true">▮</span>
                <input id="cafe-name" type="text" maxlength="14" value="${escapeHtml(state.restaurantName)}" aria-label="카페 이름" autocomplete="off" />
              </div>
              <div class="name-suggestions">
                ${["온도커피", "구름상점", "소금빵연구소", "슬로우드립", "밤과낮"].map((name) => `<button class="name-chip" data-name="${name}" type="button">${name}</button>`).join("")}
              </div>
            </section>` : `
            <section class="brief-card recap-card">
              <span class="card-label">어제</span>
              <div class="recap-row">
                <div><span>영업이익</span><b class="${previous.metrics.profit >= 0 ? "is-good" : "is-bad"}">${formatMoney(previous.metrics.profit)}</b></div>
                <div><span>최다 이탈</span><b>${previous.topLoss.label} ${previous.topLoss.count}</b></div>
                <div><span>사장 노동</span><b>${((previous.metrics.ownerMinutes ?? 0) / 60).toFixed(1)}시간</b></div>
              </div>
              <p class="recap-verdict">"${previous.verdict}"</p>
            </section>`}

          ${(state.campaign.events ?? []).map((event) => `
            <section class="brief-card event-card">
              <div class="event-head"><span class="event-icon" aria-hidden="true">${event.icon}</span><div><span class="card-label">${monthInfo(state.campaign.month).name} 이벤트</span><h2>${event.title}</h2></div></div>
              <p class="event-situation">${event.situation}</p>
              ${event.choice ? `
                <p class="event-prompt">${event.choice.prompt}</p>
                <div class="event-options">
                  ${event.choice.options.map((option) => `
                    <button class="event-option ${state.campaign.eventChoices?.[event.id] === option.id ? "is-selected" : ""}" data-event="${event.id}" data-option="${option.id}" type="button">
                      <b>${option.name}</b><span>${option.detail}</span>
                    </button>`).join("")}
                </div>` : ""}
            </section>`).join("")}

          <section class="brief-card hours-card">
            <span class="card-label">오늘의 영업시간</span>
            <h2>몇 시에 열고 몇 시에 닫을까</h2>
            <div class="hours-preview"><canvas data-art-kind="hours" data-art-id="${plan.id}" data-art-district="${sim.district.id}" aria-hidden="true"></canvas></div>
            <div class="hours-options">
              ${HOUR_PLANS.map((option) => `
                <button class="hours-option ${option.id === state.hourPlanId ? "is-selected" : ""}" data-hours="${option.id}" type="button">
                  <b>${option.name}</b>
                  <span>${option.open}:00–${option.close}:00 · ${option.close - option.open}h</span>
                  <em>인건비 ${formatMoney(laborFor(option), true)}</em>
                </button>`).join("")}
            </div>
            <p class="hours-note"><b>${plan.description}</b> ${plan.note}</p>
          </section>
        </div>

        <aside class="brief-side">
          <section class="brief-card goal-card">
            <span class="card-label">오늘의 목표</span>
            <h2>${goal.title}</h2>
            <p>${goal.detail}</p>
          </section>

          <section class="brief-card ledger-preview">
            <span class="card-label">오늘 확정 고정비</span>
            <div class="preview-row"><span>인건비 <small>퇴직금 10% 포함</small></span><b>${formatMoney(laborFor(plan))}</b></div>
            <div class="preview-row"><span>월세 1/30</span><b>${formatMoney((sim.district.lease.monthlyRent * (sim.format.pyeong ?? 12)) / 12 / 30)}</b></div>
            <div class="preview-row is-total"><span>문 열기 전 이미 나간 돈</span><b>${formatMoney(laborFor(plan) + (sim.district.lease.monthlyRent * (sim.format.pyeong ?? 12)) / 12 / 30)}</b></div>
            <p class="preview-note">이 금액을 넘겨야 오늘 흑자입니다.</p>
          </section>

          ${snapshot.activeCampaigns.length || snapshot.upgrades.length ? `
            <section class="brief-card applied-card">
              <span class="card-label">적용 중</span>
              <div class="chip-row">
                ${snapshot.upgrades.map((id) => `<span class="chip">${getById(ALL_ACTIONS, id)?.name ?? id}</span>`).join("")}
                ${snapshot.activeCampaigns.map((campaign) => `<span class="chip is-accent">${campaign.name} D-${campaign.remaining}</span>`).join("")}
              </div>
            </section>` : ""}

          <button class="cta is-large" id="start-service" type="button"><span>${plan.open}:00 · 영업 시작</span><span aria-hidden="true">→</span></button>
          <p class="brief-hint">피크는 실제 속도로, 한산한 시간은 빠르게 흐릅니다. 돌발 상황이 오면 시간이 멈춥니다.</p>
        </aside>
      </div>
    </section>`;

  clearIllustrations();
  mountStepArt(screen);

  document.querySelector("#brief-back").addEventListener("click", () => {
    if (isOpeningDay) {
      if (window.confirm("설계 화면으로 돌아가면 지금 가게를 버리고 다시 세웁니다. 계속할까요?")) {
        state.simulation = null;
        state.step = WIZARD_STEPS.length - 1;
        setView("wizard");
      }
      return;
    }
    setView("report");
  });

  const nameInput = document.querySelector("#cafe-name");
  if (nameInput) {
    nameInput.addEventListener("input", () => {
      state.restaurantName = nameInput.value.trim() || "온도커피";
    });
    screen.querySelectorAll("[data-name]").forEach((button) => button.addEventListener("click", () => {
      state.restaurantName = button.dataset.name;
      nameInput.value = button.dataset.name;
      sounds.click();
    }));
  }

  screen.querySelectorAll("[data-hours]").forEach((button) => button.addEventListener("click", () => {
    state.hourPlanId = button.dataset.hours;
    sim.setHourPlan(getById(HOUR_PLANS, state.hourPlanId));
    sounds.click();
    setView("brief");
  }));
  screen.querySelectorAll("[data-event]").forEach((button) => button.addEventListener("click", () => {
    const event = (state.campaign.events ?? []).find((item) => item.id === button.dataset.event);
    const option = event?.choice?.options.find((item) => item.id === button.dataset.option);
    if (!option) return;
    if (option.cost && sim.cash < option.cost) { toast("현금이 부족합니다."); sounds.bad(); return; }
    state.campaign.eventChoices[button.dataset.event] = option.id;
    sounds.click();
    setView("brief");
  }));

  document.querySelector("#start-service").addEventListener("click", () => {
    state.restaurantName = (nameInput?.value.trim() || state.restaurantName || "온도커피").slice(0, 14);
    sim.setHourPlan(getById(HOUR_PLANS, state.hourPlanId));
    chargeEventChoices();
    applySeasonDemand();
    sim.startDay(day);
    sounds.bell();
    // 튜토리얼이 뜰 차례라면 시계를 켜지 않는다. setView가 동기라 플래그를 먼저 읽어둔다.
    const willTutorial = !state.tutorialShown;
    setView("operations");
    if (!willTutorial) {
      state.simulation.setSpeed(1);
      state.lastSpeed = 1;
      document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", Number(item.dataset.speed) === 1));
    }
  });
}

// 지금 얼마나 붐비는가 — 페이즈(피크)와 달(성수기)이 미니게임의 밀도를 정한다.
function crowdInfoFor(sim) {
  const phase = sim.currentPhase();
  const season = sim.demandFactor ?? 1;
  const factor = (phase.busy ? 1.6 : 1) * (season >= 1.12 ? 1.3 : season >= 0.95 ? 1 : 0.85);
  const info = monthInfo(state.campaign?.month ?? 1);
  let label = null;
  if (phase.busy && season >= 1.12) label = `🔥 ${phase.korean} × ${info.name} 성수기 — 거리가 터져나갑니다`;
  else if (phase.busy) label = `🔥 ${phase.korean} — 사람이 몰리는 시간대`;
  else if (season >= 1.12) label = `🌸 ${info.name} 성수기 — 평소보다 붐빕니다`;
  else if (season <= 0.88) label = `🍂 ${info.name} 비수기 — 거리가 한산합니다`;
  return { factor, label };
}

// 미니게임은 클릭 또는 1·2·3 키로만 열린다 — 자동 배치는 절대 열지 않는다.
// 왼쪽 미니게임 자리에 열리고, 그동안 카페 씬과 크기를 맞바꾼다.
function launchArcade(stationId, { practice = false } = {}) {
  const sim = state.simulation;
  if (!sim || state.arcadeOpen || sim.finished) return;
  if (!practice && (document.querySelector(".tutorial-card") || sim.activeDilemma)) return;
  const GameClass = ARCADE_BY_STATION[stationId];
  if (!GameClass) return;
  state.arcadeOpen = true;
  if (!practice) sim.setSpeed(1);
  const dock = document.querySelector("#arcade-dock");
  const home = document.querySelector("#arcade-home");
  if (home) home.hidden = true;
  document.querySelector(".ops-grid")?.classList.add("arcade-live");
  const game = new GameClass({
    sim, sounds, practice,
    crowd: practice ? { factor: 1, label: "연습 모드 — 결과는 반영되지 않습니다" } : crowdInfoFor(sim),
    mount: dock ?? undefined,
    onEnd: (stats) => {
      state.arcadeOpen = false;
      state.activeArcade = null;
      document.querySelector(".ops-grid")?.classList.remove("arcade-live");
      const homeAfter = document.querySelector("#arcade-home");
      if (homeAfter) homeAfter.hidden = false;
      if (practice) {
        state.tutorial?.advance();
        return;
      }
      if (stationId === "door") toast(`전단지 영업 끝 — ${stats.score ?? 0}점, 손님 ${stats.converted ?? 0}명 확보`);
      else if (stationId === "bar") toast(`키친 러시 끝 — ${stats.made ?? 0}잔을 직접 만들었습니다`);
      else toast(`홀 서빙 끝 — ${stats.handled ?? 0}건 처리`);
    },
  });
  state.activeArcade = game;
  game.start();
}

function renderOperations() {
  const sim = state.simulation;
  const snapshot = sim.snapshot();
  topbarStatus.innerHTML = statusMarkup(`${monthInfo(state.campaign?.month ?? 1).name} ${snapshot.day >= 6 ? "주말" : "평일"} · ${snapshot.clock}`);
  reportReadyNotified = false;
  lastPhaseId = snapshot.phase.id;
  ownerWasOnDuty = snapshot.onDuty;
  screen.innerHTML = `
    <section class="operations-screen enter-up"><div class="ops-grid">
      <div class="interior-column" id="arcade-column">
        <div class="interior-head"><span class="meta-label">MINIGAME</span><strong>사장의 자리 — 여기서 뜁니다</strong></div>
        <div class="interior-panel arcade-dock" id="arcade-dock">
          <div class="arcade-home" id="arcade-home">
            <p class="arcade-home-lede">미니게임은 자리를 <b>클릭</b>하거나 <b>1 · 2 · 3</b> 키를 눌러야만 시작됩니다.<br />자동으로는 절대 열리지 않아요.</p>
            <button class="arcade-home-card" data-station="bar" type="button">
              <span class="ah-key">1</span><span class="ah-icon" aria-hidden="true">☕</span>
              <span class="ah-body"><b>${snapshot.stationNames?.bar ?? "키친"} — 키친 러시</b><span>←→ 이동 · 키를 <i>꾹</i> 눌러 추출/굽기, 노란 구간에서 떼기</span></span>
            </button>
            <button class="arcade-home-card" data-station="hall" type="button">
              <span class="ah-key">2</span><span class="ah-icon" aria-hidden="true">🍽</span>
              <span class="ah-body"><b>${snapshot.stationNames?.hall ?? "홀"} — 홀 서빙</b><span>←→ 이동 · 말풍선 키 <i>Q/W/E/R</i> + <i>SPACE×2</i></span></span>
            </button>
            <button class="arcade-home-card" data-station="door" type="button">
              <span class="ah-key">3</span><span class="ah-icon" aria-hidden="true">📄</span>
              <span class="ah-body"><b>${snapshot.stationNames?.door ?? "입구"} — 전단지 돌리기</b><span>방향키 ↑↓←→ · 행인은 잡고, 진상은 피하고</span></span>
            </button>
            <p class="arcade-home-note">성과는 그대로 오늘 매출·만족도에 반영됩니다. 피크 시간대·성수기 달엔 훨씬 정신없어요.</p>
          </div>
        </div>
        <p class="interior-hint">미니게임이 시작되면 이 자리가 커지고, 카페는 옆에서 계속 돌아갑니다 — 시간도 흐릅니다</p>
      </div>
      <div class="scene-panel">
        <canvas id="game-canvas" aria-label="${escapeHtml(sim.district.name)}의 낮과 밤, 매장 내부와 움직이는 고객을 보여주는 실시간 영업 장면"></canvas>
        <div class="phase-banner" id="phase-banner" hidden><span id="phase-banner-label"></span><strong id="phase-banner-title"></strong></div>
        <div class="agent-popover" id="agent-popover" hidden></div>
        <div class="scene-hud">
          <div class="hud-top"><div class="day-clock"><span class="phase-label" id="phase-label">${snapshot.phase.label}</span><strong id="clock-value">${snapshot.clock}</strong><div class="day-progress"><i id="day-progress" style="width:${snapshot.progress * 100}%"></i></div></div><div class="weather-chip" id="weather-value">${snapshot.weather.icon} ${snapshot.weather.name}</div></div>
          <div class="hud-bottom">
            <div class="control-dock" role="group" aria-label="영업 속도">
              <button class="speed-button" data-speed="0" type="button">Ⅱ</button><button class="speed-button active" data-speed="1" type="button">1×</button><button class="speed-button" data-speed="2" type="button">2×</button><button class="speed-button" data-speed="4" type="button">4×</button>
            </div>
            <div class="station-dock" id="station-dock" role="group" aria-label="사장의 자리">
              <button class="work-toggle" id="work-toggle" type="button" title="스페이스 바로도 됩니다">
                <span class="work-gauge"><i id="work-fill"></i></span>
                <span class="stress-gauge" title="사장 스트레스"><i id="stress-fill"></i></span>
                <span class="work-label" id="work-label">출근</span>
                <span class="work-left" id="work-left">—</span>
                <span class="work-key" aria-hidden="true">SPACE</span>
              </button>
              <button class="station-button station-auto" id="station-auto" type="button" title="사장이 병목을 보고 알아서 움직입니다">
                <span class="station-icon" aria-hidden="true">🤖</span>
                <span class="station-name">자동</span>
                <span class="station-key">0</span>
              </button>
              <button class="station-button station-skip" id="skip-day" type="button" title="남은 하루를 즉시 계산하고 마감 리포트로 직행합니다">
                <span class="station-icon" aria-hidden="true">⏭</span>
                <span class="station-name">스킵</span>
                <span class="station-key">리포트</span>
              </button>
            </div>
            <div class="live-kpis"><div class="live-kpi"><span class="metric-label">CASH</span><strong id="hud-cash">${formatMoney(snapshot.cash, true)}</strong></div><div class="live-kpi"><span class="metric-label">SALES</span><strong id="hud-sales">${formatMoney(snapshot.metrics.revenue, true)}</strong></div></div>
          </div>
        </div>
        <div class="dilemma-overlay" id="dilemma-overlay" hidden></div>
      </div>
      <aside class="ops-rail">
        <section class="rail-card"><span class="meta-label">LIVE OPERATIONS</span><h2>${escapeHtml(state.restaurantName)} / ${sim.format.name}</h2><div class="operation-meters">
          <div class="meter-line"><span class="metric-label">주방 부하</span><div class="meter-bar"><i id="meter-kitchen" style="width:0%"></i></div><strong id="value-kitchen">0%</strong></div>
          ${sim.format.seats > 0 ? `<div class="meter-line"><span class="metric-label">홀 정리</span><div class="meter-bar"><i id="meter-hall" style="width:0%"></i></div><strong id="value-hall">0</strong></div>` : ""}
          <div class="meter-line"><span class="metric-label">평판</span><div class="meter-bar"><i id="meter-reputation" style="width:${snapshot.reputation}%"></i></div><strong id="value-reputation">${Math.round(snapshot.reputation)}</strong></div>
          <div class="meter-line"><span class="metric-label">청결</span><div class="meter-bar"><i id="meter-hygiene" style="width:${snapshot.hygiene}%"></i></div><strong id="value-hygiene">${Math.round(snapshot.hygiene)}</strong></div>
        </div></section>
        <section class="rail-card"><span class="meta-label">CUSTOMER FUNNEL</span><div class="live-funnel">
          <div><strong id="funnel-footfall">0</strong><span>유동·검색</span></div><div><strong id="funnel-entered">0</strong><span>입장</span></div><div><strong id="funnel-served">0</strong><span>제공</span></div><div><strong id="funnel-satisfied">0</strong><span>만족</span></div>
        </div></section>
        <section class="rail-card event-feed"><span class="meta-label">LIVE FEEDBACK</span><h3>손님 행동 로그</h3><div class="feed-list" id="feed-list"><div class="feed-item"><time>${snapshot.clock}</time><span>영업이 시작됐습니다. 손님을 클릭하면 속마음이 보입니다.</span></div></div></section>
        <button class="text-button notebook-button" id="open-notebook" type="button">장사 노트 열기</button>
        <button class="end-day-button" id="open-report" type="button" disabled>영업 중 · 23:00 마감</button>
      </aside>
    </div></section>`;

  document.querySelectorAll("[data-speed]").forEach((button) => button.addEventListener("click", () => {
    const speed = Number(button.dataset.speed);
    if (sim.activeDilemma) return;
    sim.setSpeed(speed);
    if (speed > 0) state.lastSpeed = speed;
    sounds.click();
    document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", Number(item.dataset.speed) === speed));
  }));
  // 자동 = "내 선택의 성적표를 빨리 본다": 출근시키고, 4배속으로 하루를 자동 진행해
  // 마감 리포트로 직행한다. 미니게임은 자동에서는 절대 열리지 않는다.
  document.querySelector("#station-auto").addEventListener("click", () => {
    const sim2 = state.simulation;
    const result = sim2.setOwnerAuto(!sim2.autoOwner);
    sounds.click();
    if (result.auto) {
      state.pendingArcade = null;
      if (!sim2.ownerWorking) sim2.toggleOwnerWork();
      sim2.setSpeed(4);
      state.lastSpeed = 4;
      document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", Number(item.dataset.speed) === 4));
      toast("자동 진행 — 4배속으로 하루를 돌려 마감 리포트를 보러 갑니다. 미니게임은 열리지 않습니다.");
    } else {
      sim2.setSpeed(1);
      state.lastSpeed = 1;
      document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", Number(item.dataset.speed) === 1));
      toast("수동 배치 — 자리를 직접 정하세요. 미니게임은 클릭·1/2/3으로 시작합니다.");
    }
  });
  // 스킵 = 기다림도 생략: 남은 하루를 즉시 계산하고 마감 리포트로 직행한다.
  // 계산 도중 돌발 상황이 떠서 시간이 멈추면 기본 선택으로 정리하고 끝까지 간다.
  document.querySelector("#skip-day").addEventListener("click", () => {
    if (state.arcadeOpen) { toast("미니게임을 끝내거나 그만둔 뒤에 스킵할 수 있습니다."); return; }
    const sim2 = state.simulation;
    for (let guard = 0; guard < 8 && !sim2.finished; guard += 1) {
      if (sim2.activeDilemma) {
        const fallback = sim2.activeDilemma.options.find((option) => option.default) ?? sim2.activeDilemma.options.at(-1);
        sim2.resolveDilemma(fallback.id);
      }
      sim2.runToEnd();
    }
    if (!sim2.finished || !sim2.lastReport) { toast("마감 계산이 끝나지 않았습니다. 다시 시도해 주세요."); return; }
    state.reports.push(sim2.lastReport);
    sounds.bell();
    toast("남은 하루를 스킵했습니다 — 바로 마감 리포트입니다.");
    setView("report");
  });
  // 스페이스 바로 출근/쉬기 — 손이 제일 빠른 키에 제일 자주 쓰는 동작을 둔다
  const spaceHandler = (event) => {
    if (event.code !== "Space") return;
    if (state.view !== "operations" || state.arcadeOpen) return;
    if (event.target instanceof Element && event.target.closest("input, textarea, [contenteditable]")) return;
    event.preventDefault();
    document.querySelector("#work-toggle")?.click();
  };
  window.removeEventListener("keydown", state.spaceHandler ?? (() => {}));
  state.spaceHandler = spaceHandler;
  window.addEventListener("keydown", spaceHandler);
  document.querySelector("#work-toggle").addEventListener("click", () => {
    const result = sim.toggleOwnerWork();
    if (result.ok) {
      sounds.good();
      toast(result.working ? "사장이 매장에 들어왔습니다." : "사장이 쉽니다. 남은 시간은 아껴둡니다.");
    } else {
      sounds.bad();
      toast(result.reason);
    }
  });
  screen.querySelectorAll("[data-station]").forEach((button) => button.addEventListener("click", () => {
    const stationId = button.dataset.station;
    // 튜토리얼 연습 스텝 — 이동 없이 바로 그 자리의 연습판을 연다
    const tutStep = state.tutorial?.step;
    if (tutStep?.practice) {
      if (tutStep.practice === stationId && !state.arcadeOpen) {
        state.tutorial.enterWaiting();
        launchArcade(stationId, { practice: true });
      }
      return;
    }
    const result = sim.moveOwner(stationId);
    if (result.ok) {
      state.pendingArcade = stationId;
      sounds.good();
      gameScene?.addFloater(gameScene.ownerSpot?.x ?? 600, (gameScene.ownerSpot?.y ?? 600) - 100, result.label, "good");
    } else {
      sounds.bad();
      toast(result.reason);
    }
  }));
  document.querySelector("#open-notebook").addEventListener("click", () => {
    sounds.click();
    openNotebook();
  });
  document.querySelector("#open-report").addEventListener("click", () => {
    if (!sim.finished) return;
    state.reports.push(sim.lastReport);
    sounds.bell();
    setView("report");
  });
  const canvas = document.querySelector("#game-canvas");
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const found = gameScene?.pick(cssX, cssY);
    if (!found) {
      showAgentPopover(null, cssX, cssY);
      return;
    }
    // 직접 개입: 테이블 치우기 · 전단지 · 음료 서비스
    // 씬을 눌러도 사장을 보낼 수 있다 — 도크와 같은 동작
    if (found.kind === "table" && !sim.atStation("hall")) {
      const move = sim.moveOwner("hall");
      if (move.ok) {
        sounds.good();
        gameScene.addFloater(found.x, found.y - 44, "사장이 홀로 갑니다", "good");
        return;
      }
    }
    if (found.kind === "table") {
      if (found.cleaning) {
        gameScene.addFloater(found.x, found.y - 44, "이미 정리 중입니다", "neutral");
        return;
      }
      const result = sim.ownerClean(found.id);
      gameScene.addFloater(found.x, found.y - 44, result.ok ? "사장이 치우러 갑니다" : result.reason, result.ok ? "good" : "bad");
      if (result.ok) sounds.good(); else sounds.bad();
      return;
    }
    const agent = found.agent;
    if (agent.state === "walking" && agent.channel !== "delivery" && !agent.flyered) {
      const result = sim.handFlyer(agent.id);
      gameScene.addFloater(found.x, found.y - 34, result.ok ? result.label : result.reason, result.ok ? result.tone : "bad");
      if (result.ok) sounds.click(); else sounds.bad();
      return;
    }
    if (agent.serviceRequested && !agent.serviceResolved) {
      const result = sim.attendCustomer(agent.id);
      gameScene.addFloater(found.x, found.y - 34, result.ok ? result.label : result.reason, result.ok ? "good" : "bad");
      if (result.ok) sounds.good(); else sounds.bad();
      return;
    }
    if (agent.state === "queueing" && agent.channel !== "delivery" && !agent.drinkServed) {
      const result = sim.serveDrink(agent.id);
      gameScene.addFloater(found.x, found.y - 34, result.ok ? result.label : result.reason, result.ok ? "good" : "bad");
      if (result.ok) sounds.good(); else sounds.bad();
      return;
    }
    showAgentPopover(found, cssX, cssY);
  });
  sim.onDilemma((dilemma) => {
    sounds.bell();
    showDilemma(dilemma);
  });
  gameScene = new GameScene(document.querySelector("#game-canvas"), { district: sim.district, format: sim.format, menus: sim.menus, restaurantName: state.restaurantName });
  beginOperationLoop();
  if (sim.activeDilemma) showDilemma(sim.activeDilemma);

  // 첫 영업일에는 튜토리얼을 먼저 돌린다. 그동안 시계는 멈춰 있다.
  if (!state.tutorialShown) {
    state.tutorialShown = true;
    sim.setSpeed(0);
    document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", Number(item.dataset.speed) === 0));
    const tutorial = new Tutorial({
      // 안내 문구가 실제 버튼에 적힌 자리 이름을 그대로 쓰게 한다.
      stationNames: sim.snapshot().stationNames,
      onFinish: ({ skipped }) => {
        state.tutorial = null;
        platform.logEvent("tutorial_finished", { skipped });
        toast(skipped ? "튜토리얼을 건너뛰었습니다. 언제든 HOW TO에서 다시 볼 수 있어요." : "이제 진짜 영업입니다. 직접 뛰든, 자동으로 결과를 보든 — 선택은 사장 몫입니다.");
        sim.setSpeed(1);
        state.lastSpeed = 1;
        document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", Number(item.dataset.speed) === 1));
      },
    });
    state.tutorial = tutorial;
    tutorial.start();
  }
}

const AGENT_STATE_LABEL = {
  walking: "지나가는 중",
  phone: "배달앱 주문 접수",
  considering: "들어갈지 고민 중",
  queueing: "대기 중",
  eating: "식사 중",
  pickup: "픽업 중",
  leaving: "떠나는 중",
};

function showAgentPopover(found, x, y) {
  const popover = document.querySelector("#agent-popover");
  if (!popover) return;
  if (!found) {
    popover.hidden = true;
    return;
  }
  const agent = found.agent;
  const lines = [];
  lines.push(`<strong>${agent.customer.name}</strong>`);
  lines.push(`<span>${AGENT_STATE_LABEL[agent.state] ?? agent.state}${agent.partySize > 1 ? ` · ${agent.partySize}명` : ""}</span>`);
  if (agent.menu) lines.push(`<span>주문: ${agent.menu.name} · ${formatMoney(agent.price)}</span>`);
  if (agent.state === "queueing") lines.push(`<span>예상 대기 ${agent.waitMinutes.toFixed(0)}분 / 허용 ${Math.round(agent.customer.wait)}분${agent.willAbandon ? " · <b class='will-leave'>곧 포기</b>" : ""}</span>`);
  if (agent.bubble) lines.push(`<em>“${escapeHtml(agent.bubble)}”</em>`);
  popover.innerHTML = lines.join("");
  popover.hidden = false;
  const panel = popover.parentElement.getBoundingClientRect();
  popover.style.left = `${Math.min(x, panel.width - 240)}px`;
  popover.style.top = `${Math.max(12, y - 130)}px`;
  clearTimeout(popover._timer);
  popover._timer = setTimeout(() => { popover.hidden = true; }, 3600);
}

function showDilemma(dilemma) {
  const overlay = document.querySelector("#dilemma-overlay");
  if (!overlay) return;
  // 상황 일러스트 — 진상은 진짜 진상 아줌마의 얼굴로 온다
  const artKey = dilemma.id?.startsWith("jinsang") ? "jinsang" : dilemma.id;
  overlay.innerHTML = `
    <div class="dilemma-card enter-up">
      <span class="meta-label">돌발 상황 · 시간 정지</span>
      <h2>${dilemma.title}</h2>
      <div class="dilemma-art"><img src="assets/art/dlm-${artKey}.webp" alt="" onerror="this.closest('.dilemma-art')?.remove()" /></div>
      <p>${dilemma.situation}</p>
      <div class="dilemma-options">
        ${dilemma.options.map((option) => `
          <button class="dilemma-option" data-option="${option.id}" type="button">
            <strong>${option.name}</strong>
            <span>${option.detail}</span>
          </button>`).join("")}
      </div>
    </div>`;
  overlay.hidden = false;
  overlay.querySelectorAll("[data-option]").forEach((button) => button.addEventListener("click", () => {
    state.simulation.resolveDilemma(button.dataset.option);
    overlay.hidden = true;
    sounds.click();
    const speed = state.lastSpeed ?? 1;
    state.simulation.setSpeed(speed);
    document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", Number(item.dataset.speed) === speed));
  }));
}

// 메뉴 × 손님 적합도 표 — 장사 노트 다이얼로그와 마감 리포트가 같은 표를 쓴다
function notebookTableMarkup(sim) {
  const snapshot = sim.snapshot();
  const rows = sim.menus.map((menu) => {
    const cells = CUSTOMERS.map((customer) => {
      const key = `${menu.id}:${customer.id}`;
      const stat = snapshot.fitStats[key];
      if (stat && stat.count >= GAME_CONFIG.fitRevealCount) {
        const grade = fitGrade(stat.total / stat.count);
        return `<td class="fit-cell fit-${grade.symbol === "◎" ? "great" : grade.symbol === "○" ? "ok" : "bad"}"><b>${grade.symbol}</b><small>${grade.label}</small></td>`;
      }
      if (stat?.count) return `<td class="fit-cell fit-unknown"><b>${stat.count}/${GAME_CONFIG.fitRevealCount}</b><small>관찰 중</small></td>`;
      return `<td class="fit-cell fit-none"><b>?</b><small>미확인</small></td>`;
    }).join("");
    return `<tr><th>${menu.name}</th>${cells}</tr>`;
  }).join("");
  return `<div class="notebook-table-wrap"><table class="notebook-table">
      <thead><tr><th></th>${CUSTOMERS.map((customer) => `<th>${customer.short}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// 메뉴 하나의 노트 요약 — "◎2 △1" 식으로, 다음 판 메뉴 개편의 근거가 된다
function menuFitBadge(sim, menuId) {
  const snapshot = sim.snapshot();
  let great = 0;
  let bad = 0;
  for (const customer of CUSTOMERS) {
    const stat = snapshot.fitStats[`${menuId}:${customer.id}`];
    if (!stat || stat.count < GAME_CONFIG.fitRevealCount) continue;
    const symbol = fitGrade(stat.total / stat.count).symbol;
    if (symbol === "◎") great += 1;
    else if (symbol === "△") bad += 1;
  }
  if (!great && !bad) return "";
  return `<span class="fit-badge">${great ? `<b class="is-great">◎${great}</b>` : ""}${bad ? `<b class="is-bad">△${bad}</b>` : ""}</span>`;
}

function openNotebook() {
  const sim = state.simulation;
  const lessons = state.reports.map((report) => `<li><b>${report.day >= 6 ? "주말" : "평일"}</b> ${report.verdict}</li>`).join("");
  const dialog = document.createElement("dialog");
  dialog.className = "notebook-dialog";
  dialog.innerHTML = `
    <button class="modal-close" type="button">CLOSE ×</button>
    <span class="meta-label">사장의 장사 노트</span>
    <h2>손님이 가르쳐 준 것</h2>
    <p class="notebook-lede">같은 메뉴도 손님에 따라 평가가 다릅니다. 3명 이상에게 제공하면 적합도가 기록됩니다.</p>
    ${notebookTableMarkup(sim)}
    ${lessons ? `<div class="notebook-lessons"><span class="meta-label">지난 마감의 교훈</span><ul>${lessons}</ul></div>` : ""}`;
  document.body.append(dialog);
  dialog.querySelector(".modal-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

let lastPhaseId = null;
let ownerWasOnDuty = true;

function announcePhase(phase) {
  const banner = document.querySelector("#phase-banner");
  if (!banner) return;
  const titles = {
    offduty: phase.korean,
    onduty: phase.korean,
    prep: "오픈 준비",
    lunch: "점심 피크 — 직장인이 몰려옵니다",
    afternoon: "한산한 오후 — 시간이 빠르게 흐릅니다",
    dinner: "저녁 피크 — 오늘의 승부처",
    late: "심야 — 배달의 시간",
  };
  document.querySelector("#phase-banner-label").textContent = phase.label;
  document.querySelector("#phase-banner-title").textContent = titles[phase.id] ?? phase.korean;
  banner.hidden = false;
  banner.classList.remove("show");
  void banner.offsetWidth;
  banner.classList.add("show");
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => { banner.hidden = true; }, 3400);
}

function beginOperationLoop() {
  const sim = state.simulation;
  const frame = (time) => {
    const delta = lastFrame ? Math.min(0.1, (time - lastFrame) / 1000) : 0.016;
    lastFrame = time;
    const snapshot = sim.update(delta);
    gameScene?.draw(snapshot, delta);
    consumeVisualEvents(sim);
    updateOperationsHud(snapshot);
    if (state.view === "operations") operationRaf = requestAnimationFrame(frame);
  };
  operationRaf = requestAnimationFrame(frame);
}

let lastSaleSoundAt = 0;

// 판매·단골 이벤트 → 즉각적인 시각·청각 보상
function consumeVisualEvents(sim) {
  const events = sim.drainVisualEvents();
  if (!events.length) return;
  let shown = 0;
  for (const event of events) {
    if (event.type === "sale" && shown < 3) {
      shown += 1;
      const spot = gameScene?.registerSpot;
      if (spot) gameScene.addFloater(spot.x, spot.y, `+${formatMoney(event.amount)}`, "good");
    } else if (event.type === "autoMove") {
      // 자동 배치가 사장을 움직일 때마다 이유가 화면에 뜬다
      const spot = gameScene?.ownerSpot;
      gameScene?.addFloater(spot?.x ?? 600, (spot?.y ?? 600) - 110, `🤖 ${event.reason}`, "neutral");
    }
  }
  const now = performance.now();
  if (now - lastSaleSoundAt > 350) {
    lastSaleSoundAt = now;
    sounds.tone(760, 0.05, "triangle", 0.02);
    sounds.tone(1020, 0.07, "sine", 0.016, 0.05);
  }
}

function updateOperationsHud(snapshot) {
  const byId = (id) => document.querySelector(`#${id}`);
  if (!byId("clock-value")) return;
  byId("clock-value").textContent = snapshot.clock;
  byId("phase-label").textContent = snapshot.phase.label;
  if (snapshot.phase.id !== lastPhaseId) {
    lastPhaseId = snapshot.phase.id;
    if (!snapshot.finished && snapshot.phase.id !== "prep") announcePhase(snapshot.phase);
  }
  // 사장은 스스로 출근하고 쉰다. 남은 시간만 정해져 있다.
  const workToggle = byId("work-toggle");
  if (workToggle) {
    const total = Math.max(1, snapshot.ownerBudgetTotal ?? 1);
    const left = snapshot.ownerBudgetLeft ?? 0;
    byId("work-fill").style.width = `${clamp(left / total) * 100}%`;
    const stressFill = byId("stress-fill");
    if (stressFill) {
      const stress = snapshot.ownerStress ?? 0;
      stressFill.style.width = `${clamp(stress / 100) * 100}%`;
      stressFill.classList.toggle("is-high", stress >= 50);
      stressFill.classList.toggle("is-critical", stress >= 80);
    }
    byId("work-label").textContent = snapshot.ownerWorking
      ? (snapshot.ownerOvertime ? "초과 근무 중" : "쉬기")
      : left > 0 ? "출근" : "초과 근무";
    byId("work-left").textContent = left > 0
      ? `${Math.floor(left / 60)}h ${Math.round(left % 60)}m`
      : snapshot.ownerOvertime ? "스트레스 ↑" : "0";
    workToggle.classList.toggle("is-working", !!snapshot.ownerWorking);
    workToggle.classList.toggle("is-overtime", !!snapshot.ownerOvertime);
    workToggle.classList.toggle("is-spent", left <= 0 && !snapshot.ownerWorking);
    // 시간이 0이어도 초과 근무로 다시 들어갈 수 있으니 버튼은 살아 있다
    workToggle.disabled = snapshot.finished || (snapshot.ownerStress ?? 0) >= 100 && !snapshot.ownerWorking;
  }
  // 예약된 아케이드 — 자리에 실제로 도착하는 순간 화면이 바뀐다 (자동 모드에서는 열지 않는다)
  if (snapshot.ownerAuto) state.pendingArcade = null;
  if (state.pendingArcade && snapshot.stationActive === state.pendingArcade && !state.arcadeOpen) {
    const stationId = state.pendingArcade;
    state.pendingArcade = null;
    launchArcade(stationId);
  }
  const dock = byId("station-dock");
  if (dock) {
    const autoButton = byId("station-auto");
    if (autoButton) {
      autoButton.classList.toggle("is-active", !!snapshot.ownerAuto);
      // 자동은 출근 전에도 켤 수 있다 — 켜는 순간 사장을 출근시키고 4배속으로 하루를 돌린다
      autoButton.disabled = snapshot.finished;
    }
    dock.querySelectorAll("[data-station]").forEach((button) => {
      const id = button.dataset.station;
      button.classList.toggle("is-active", snapshot.stationActive === id);
      button.classList.toggle("is-moving", snapshot.stationMoving && snapshot.ownerStation === id);
      button.disabled = !snapshot.onDuty || snapshot.finished;
      const label = button.querySelector("[data-station-name]");
      if (label && snapshot.stationNames?.[id]) label.textContent = snapshot.stationNames[id];
    });
  }
  document.querySelector(".operations-screen")?.classList.toggle("owner-off", !snapshot.onDuty);
  if (!snapshot.onDuty && ownerWasOnDuty && !snapshot.finished) {
    ownerWasOnDuty = false;
    if ((snapshot.ownerBudgetLeft ?? 0) <= 0) {
      announcePhase({ id: "offduty", label: "OWNER OFF DUTY", korean: "사장 퇴근 — 남은 영업은 직원에게" });
      toast("정한 시간이 끝났습니다. 스페이스를 다시 누르면 초과 근무 — 스트레스가 쌓입니다.");
      state.simulation.setSpeed(4);
      document.querySelectorAll("[data-speed]").forEach((item) => item.classList.toggle("active", Number(item.dataset.speed) === 4));
    }
  } else if (snapshot.onDuty && !ownerWasOnDuty) {
    ownerWasOnDuty = true;
  }

  const flyerCount = byId("flyer-count");
  if (flyerCount) flyerCount.textContent = snapshot.flyersLeft ?? 0;
  const hallMeter = byId("meter-hall");
  if (hallMeter && snapshot.tables?.length) {
    const dirtyRatio = snapshot.dirtyCount / snapshot.tables.length;
    hallMeter.style.width = `${dirtyRatio * 100}%`;
    hallMeter.style.background = dirtyRatio >= 0.5 ? "#c83b2f" : "#f4511e";
    byId("value-hall").textContent = snapshot.dirtyCount ? `치울 것 ${snapshot.dirtyCount}` : "깨끗함";
  }
  byId("day-progress").style.width = `${snapshot.progress * 100}%`;
  byId("hud-cash").textContent = formatMoney(snapshot.cash, true);
  byId("hud-sales").textContent = formatMoney(snapshot.metrics.revenue, true);
  const kitchenLoad = clamp(snapshot.queueLength / Math.max(1, state.simulation.kitchenLanes.length * 4)) * 100;
  byId("meter-kitchen").style.width = `${kitchenLoad}%`;
  byId("meter-kitchen").style.background = kitchenLoad > 78 ? "#c83b2f" : "#f4511e";
  byId("value-kitchen").textContent = `${Math.round(kitchenLoad)}%`;
  byId("meter-reputation").style.width = `${snapshot.reputation}%`;
  byId("value-reputation").textContent = Math.round(snapshot.reputation);
  byId("meter-hygiene").style.width = `${snapshot.hygiene}%`;
  byId("value-hygiene").textContent = Math.round(snapshot.hygiene);
  byId("funnel-footfall").textContent = snapshot.metrics.footfall;
  byId("funnel-entered").textContent = snapshot.metrics.entered;
  byId("funnel-served").textContent = snapshot.metrics.served;
  byId("funnel-satisfied").textContent = snapshot.metrics.satisfied;
  topbarStatus.innerHTML = statusMarkup(`${monthInfo(state.campaign?.month ?? 1).name} ${snapshot.day >= 6 ? "주말" : "평일"} · ${snapshot.clock}`);
  const feed = byId("feed-list");
  const latest = snapshot.feed.slice(0, 12);
  feed.innerHTML = latest.length ? latest.map((entry) => `<div class="feed-item ${entry.tone}"><time>${entry.time}</time><span>${escapeHtml(entry.message)}</span></div>`).join("") : `<div class="feed-item"><time>${snapshot.clock}</time><span>손님이 오기를 기다리는 중입니다.</span></div>`;
  if (snapshot.finished) {
    const reportButton = byId("open-report");
    reportButton.disabled = false;
    reportButton.textContent = "마감 완료 · 근거 리포트 열기 →";
    if (!reportReadyNotified) {
      reportReadyNotified = true;
      sounds.bell();
      toast("오늘 영업이 끝났습니다. 어떤 단계에서 손님을 놓쳤는지 확인하세요.");
    }
  }
}

const LOSS_EXPLANATIONS = {
  awareness: "매장을 보거나 검색 결과에서 발견하지 못했습니다.",
  price: "고객의 편안한 예산과 판매가격이 맞지 않았습니다.",
  value: "결제한 가격에 비해 양과 구성의 체감가치가 낮았습니다.",
  menu: "시간대·고객 목적과 대표 메뉴의 적합도가 낮았습니다.",
  wait: "예상 제공시간이 고객의 허용 대기시간을 넘었습니다.",
  full: "좌석 회전이 수요를 감당하지 못했습니다.",
  delivery: "이동 후 음식 상태가 기대에 미치지 못했습니다.",
  taste: "제품의 기본 품질이 기대보다 낮았습니다.",
  atmosphere: "공간·서비스 경험이 고객 목적과 맞지 않았습니다.",
};

// 월 마감 코치 — 이탈 원인마다 "그래서 다음 달에 뭘 하면 되는지"를 짚어준다
const LOSS_COACH = {
  awareness: { label: "매장 인지", tip: "월 계획에서 마케팅(전단·SNS)을 걸거나, 한가한 시간에 사장을 입구에 세우세요. 아는 사람이 없으면 맛볼 사람도 없습니다." },
  wait: { label: "대기 병목", tip: "주방이 밀립니다. 바리스타를 채용하거나 러시 때 사장이 키친에 서세요. 제조가 오래 걸리는 메뉴를 빼는 것도 방법입니다." },
  full: { label: "만석 이탈", tip: "자리가 안 돕니다. 홀 알바를 채용하거나 사장이 홀에서 테이블을 치우세요. 회전이 곧 좌석 수입니다." },
  menu: { label: "메뉴 불일치", tip: "장사 노트를 열어 메뉴×손님 적합도를 확인하세요. 안 맞는 메뉴는 월 계획에서 빼고 새 메뉴를 넣을 수 있습니다." },
  price: { label: "가격 부담", tip: "이 상권 손님의 예산과 가격대가 어긋납니다. 부담 없는 저가 메뉴를 하나 끼워 입장 문턱을 낮추세요." },
  value: { label: "체감가치 부족", tip: "가격 대비 구성이 약합니다. 디저트를 더하거나 원두 등급을 올려 '이 가격의 이유'를 만들어 주세요." },
  taste: { label: "맛 문제", tip: "기본 품질이 흔들립니다. 머신 청소를 미루지 말고, 원두 등급 업그레이드를 고려하세요." },
  delivery: { label: "배달 품질", tip: "이동 후 상태가 기대에 못 미칩니다. 배달 반경을 줄이거나 포장 개선 액션을 쓰세요." },
  atmosphere: { label: "공간 경험", tip: "방문 목적과 공간이 안 맞습니다. 인테리어·좌석 개선 액션을 고려하세요." },
};

const PRAISE_EXPLANATIONS = {
  wait: "빠른 제공과 매끄러운 회전이 만족도를 높였습니다.",
  value: "가격에 비해 양과 구성이 좋다는 평가입니다.",
  taste: "대표 메뉴의 맛과 완성도가 기대를 넘었습니다.",
  atmosphere: "공간과 서비스가 방문 목적에 잘 맞았습니다.",
  delivery: "포장과 도착 상태가 안정적으로 유지됐습니다.",
  menu: "시간대와 식사 목적에 맞는 메뉴 선택이었습니다.",
};

function renderReport() {
  const report = state.simulation.lastReport;
  const m = report.metrics;
  const previous = state.reports.length > 1 ? state.reports.at(-2) : null;
  const delta = (current, before, { money = false, unit = "", inverse = false, digits = 1 } = {}) => {
    if (!previous || !Number.isFinite(before)) return `<small class="kpi-delta">첫날 기준선</small>`;
    const change = current - before;
    const favorable = inverse ? change < 0 : change > 0;
    const neutral = Math.abs(change) < 0.005;
    const value = money
      ? `${change > 0 ? "+" : ""}${formatMoney(change)}`
      : `${change > 0 ? "+" : ""}${change.toFixed(digits)}${unit}`;
    return `<small class="kpi-delta ${neutral ? "" : favorable ? "good" : "bad"}">전일 ${value}</small>`;
  };
  const maxFunnel = Math.max(1, m.footfall);
  const funnel = [
    ["유동·검색", m.footfall], ["매장 인지", m.aware], ["입장", m.entered], ["주문", m.ordered],
    ["정상 제공", m.served], ["만족", m.satisfied], ["재방문 의향", m.repeatIntent],
  ];
  const totalCosts = m.foodCost + m.platformCost + m.wasteCost + m.laborCost + m.rentCost + m.taxCost + m.utilityCost + m.actionCost;
  const ownerHours = (m.ownerMinutes ?? 0) / 60;
  const reviews = m.reviews.length ? [...m.reviews].sort((a, b) => a.stars - b.stars).slice(0, 3) : [
    { customer: "마감 메모", stars: 0, text: "오늘은 공개 리뷰가 없었습니다. 행동 퍼널을 먼저 읽으세요.", tone: "neutral" },
  ];
  const isWeekendReport = report.day >= 6;
  topbarStatus.innerHTML = statusMarkup(`${monthInfo(state.campaign.month).name} / ${isWeekendReport ? "주말" : "평일"} 마감`);
  screen.innerHTML = `
    <section class="report-screen enter-up">
      <header class="report-header">
        <div><p class="section-kicker">${monthInfo(state.campaign.month).name} / ${isWeekendReport ? "WEEKEND" : "WEEKDAY"} CLOSE</p><h1 class="report-title">${isWeekendReport ? "주말 마감 리포트" : "평일 마감 리포트"}<br /><em>어디서 새었나.</em></h1></div>
        <div class="report-verdict"><strong>${report.topLoss.label} · ${report.topLoss.count}명</strong><p>${report.verdict}</p></div>
      </header>
      <div class="report-kpis">
        <div class="report-kpi"><span class="metric-label">매출</span><strong>${formatMoney(m.revenue)}</strong>${delta(m.revenue, previous?.metrics.revenue, { money: true })}</div>
        <div class="report-kpi"><span class="metric-label">영업비용</span><strong>${formatMoney(totalCosts)}</strong>${delta(totalCosts, previous ? previous.metrics.foodCost + previous.metrics.platformCost + previous.metrics.wasteCost + previous.metrics.laborCost + previous.metrics.rentCost : undefined, { money: true, inverse: true })}</div>
        <div class="report-kpi"><span class="metric-label">영업이익</span><strong class="${m.profit >= 0 ? "positive" : "negative"}">${formatMoney(m.profit)}</strong>${delta(m.profit, previous?.metrics.profit, { money: true })}</div>
        <div class="report-kpi"><span class="metric-label">평균 대기</span><strong>${m.averageWait.toFixed(1)}분</strong>${delta(m.averageWait, previous?.metrics.averageWait, { unit: "분", inverse: true })}</div>
        <div class="report-kpi"><span class="metric-label">평판</span><strong>${(report.reputation / 20).toFixed(1)} / 5</strong>${delta(report.reputation / 20, previous ? previous.reputation / 20 : undefined, { digits: 2 })}</div>
        <div class="report-kpi"><span class="metric-label">사장 노동</span><strong>${ownerHours.toFixed(1)}시간</strong><small class="kpi-delta">직접 개입 포함</small></div>
      </div>
      <div class="ledger-strip"><span class="meta-label">상담 엑셀 원장</span>
        <div class="ledger-row"><span>재료(원두·부재료)</span><b>${formatMoney(m.foodCost)}</b></div>
        <div class="ledger-row"><span>인건비 <small>(퇴직금 10% 적립 포함)</small></span><b>${formatMoney(m.laborCost)}</b></div>
        <div class="ledger-row"><span>월세 1/30</span><b>${formatMoney(m.rentCost)}</b></div>
        <div class="ledger-row"><span>세금 10%</span><b>${formatMoney(m.taxCost)}</b></div>
        <div class="ledger-row"><span>공과금·복리후생 5%</span><b>${formatMoney(m.utilityCost)}</b></div>
        <div class="ledger-row"><span>플랫폼·폐기·운영액션</span><b>${formatMoney(m.platformCost + m.wasteCost + m.actionCost)}</b></div>
      </div>
      <div class="report-grid">
        <section class="report-panel"><span class="meta-label">CUSTOMER FUNNEL</span><h2>지나간 사람보다, 떨어져 나간 이유</h2><div class="funnel-chart">
          ${funnel.map(([label, value]) => `<div class="funnel-step"><span>${label}</span><div class="funnel-track"><i style="width:${value / maxFunnel * 100}%"></i></div><strong>${value}명</strong></div>`).join("")}
        </div></section>
        <section class="report-panel"><span class="meta-label">TOP LEAKS</span><h2>오늘 놓친 수요</h2><div class="loss-list">
          ${report.topLosses.slice(0, 5).map((loss) => `<div class="loss-item"><span class="loss-icon">!</span><div><strong>${loss.label}</strong><p>${escapeHtml(loss.detail ?? LOSS_EXPLANATIONS[loss.id])}</p></div><b>${loss.count}<small>${Math.round(loss.rate * 100)}%</small></b></div>`).join("") || "<p>의미 있는 이탈이 없었습니다.</p>"}
        </div></section>
      </div>
      ${report.fitReveals?.length ? `<section class="report-panel discovery-panel"><span class="meta-label">TODAY'S DISCOVERY</span><h2>오늘 손님이 가르쳐 준 것</h2><div class="discovery-grid">
        ${report.fitReveals.map((reveal) => {
          const menu = getById(MENUS, reveal.menuId);
          const customer = getById(CUSTOMERS, reveal.customerId);
          const toneClass = reveal.symbol === "◎" ? "good" : reveal.symbol === "○" ? "" : "bad";
          return `<div class="discovery-item ${toneClass}"><b>${reveal.symbol}</b><div><strong>${menu?.name ?? reveal.menuId} × ${customer?.short ?? reveal.customerId}</strong><span>${reveal.symbol === "◎" ? "이 조합이 우리 가게의 무기입니다." : reveal.symbol === "○" ? "나쁘지 않지만 결정적이지 않습니다." : "이 손님에게는 다른 답이 필요합니다."}</span></div></div>`;
        }).join("")}
      </div><p class="discovery-hint">발견한 적합도는 영업 화면의 ‘장사 노트’에 계속 쌓입니다.</p></section>` : ""}
      ${(() => {
        const owner = report.metrics.ownerActions;
        if (!owner || (owner.flyers === 0 && owner.drinks === 0 && owner.cleaned === 0 && !report.metrics.actionCost)) return "";
        const parts = [];
        if (owner.flyers) parts.push(`전단지 ${owner.flyers}장 → 관심 ${owner.flyerEntered}명`);
        if (owner.drinks) parts.push(`음료 서비스 ${owner.drinks}잔 → 이탈 구제 ${owner.drinksSaved}명`);
        if (owner.cleaned) parts.push(`직접 치운 테이블 ${owner.cleaned}개`);
        if (!parts.length) return "";
        return `<div class="owner-report"><span class="meta-label">사장의 손</span><p>${parts.join(" · ")}</p></div>`;
      })()}
      <div class="report-bottom">
        <section class="report-panel notebook-panel">
          <span class="meta-label">사장의 장사 노트 — 오늘까지의 기록</span>
          <h2>손님이 가르쳐 준 것, 다음 판의 무기</h2>
          <p class="notebook-lede">◎ 찰떡 조합은 밀고, △ 불일치 메뉴는 다음 달 '메뉴 개편'에서 빼는 게 정석입니다. 이 표는 월 계획의 메뉴 카드에도 그대로 붙어 있습니다.</p>
          ${notebookTableMarkup(state.simulation)}
        </section>
        <div class="review-stack">
          ${report.influencerNote ? `<div class="influencer-note ${report.influencerNote.tone}"><span class="meta-label">AFTER HOURS</span><p>${report.influencerNote.text}</p></div>` : ""}
          ${reviews.map((review) => `<article class="review-card ${review.tone}"><span class="meta-label">${review.stars ? `${"★".repeat(Math.floor(review.stars))} ${review.stars.toFixed(1)}` : "NO REVIEW"} · ${review.customer}</span><p>“${escapeHtml(review.text)}”</p><span class="metric-label">${review.reason ? (review.tone === "good" ? PRAISE_EXPLANATIONS[review.reason] : LOSS_EXPLANATIONS[review.reason]) ?? "고객 경험" : "행동 데이터 우선"}</span></article>`).join("")}
        </div>
      </div>
      <div class="report-actions">${!isWeekendReport && state.campaign.month === 1
        ? `<button class="cta" id="go-next" type="button"><span>주말 영업 준비</span><span aria-hidden="true">→</span></button>`
        : `<button class="cta" id="go-next" type="button"><span>${monthInfo(state.campaign.month).name} 마감 정산</span><span aria-hidden="true">→</span></button>`}</div>
    </section>`;
  document.querySelector("#go-next")?.addEventListener("click", () => {
    const campaign = state.campaign;
    if (isWeekendReport) campaign.weekendReport = report; else campaign.weekdayReport = report;
    if (campaign.month === 1 && !isWeekendReport) {
      campaign.stage = "weekend";
      applySeasonDemand();
      state.simulation.startDay(6);
      setView("brief");
      return;
    }
    closeMonth();
  });

  platform.logEvent("day_closed", {
    day: report.day,
    profit: Math.round(report.metrics.profit * 10000),
    served: report.metrics.served,
    hours: `${report.metrics.openHour}-${report.metrics.closeHour}`,
  });
  evaluateAchievements({ report, day: report.day, maxDays: GAME_CONFIG.maxDays })
    .then((unlocked) => unlocked.forEach((item, index) => {
      setTimeout(() => { toast(`업적 달성 — ${item.name}`); sounds.bell(); }, 400 + index * 900);
    }))
    .catch(() => {});
}

function actionDisabled(action) {
  if (action.type === "upgrade" && state.simulation.upgrades.includes(action.id)) return true;
  return action.cost > state.simulation.cash;
}

// 대표일 하나만 플레이한 달은 나머지 하루를 헤드리스로 채운다.
// 사장이 없는 날은 개입이 없으므로 자연히 결과가 나빠진다 — 별도 페널티가 필요 없다.
// 그 달의 이벤트 + 플레이어 선택을 하나의 효과 묶음으로 합친다
function resolveMonthEffects() {
  const campaign = state.campaign;
  const merged = {};
  const multiply = (key, value) => { merged[key] = (merged[key] ?? 1) * value; };
  const add = (key, value) => { merged[key] = (merged[key] ?? 0) + value; };

  for (const event of campaign.events ?? []) {
    const picked = campaign.eventChoices?.[event.id];
    const layers = [event.effects ?? {}];
    if (picked) {
      const option = event.choice?.options.find((item) => item.id === picked);
      if (option) layers.push(option.effects ?? {});
    }
    for (const layer of layers) {
      for (const [key, value] of Object.entries(layer)) {
        if (key === "awareness" || key === "satisfaction") add(key, value);
        else if (typeof value === "number") multiply(key, value);
        else merged[key] = value;
      }
    }
  }
  return merged;
}

function applySeasonDemand() {
  const sim = state.simulation;
  const campaign = state.campaign;
  const effects = resolveMonthEffects();
  sim.monthEffects = effects;
  // 계절 기본 계수 × 이벤트 수요 배수
  sim.demandFactor = seasonFactor(campaign.month, sim.district.id) * (effects.demand ?? 1);
}

// 달이 바뀔 때 그 달의 이벤트를 뽑는다
function rollMonthEvents() {
  const campaign = state.campaign;
  campaign.events = eventsForMonth(campaign.month, state.simulation?.district.id.length ?? 5, state.simulation?.district.id ?? null);
  campaign.eventChoices = {};
  // 선택지가 있는 이벤트는 기본값을 미리 넣어 둔다(안 고르고 넘겨도 진행되도록)
  for (const event of campaign.events) {
    if (event.choice) campaign.eventChoices[event.id] = event.choice.options.at(-1).id;
  }
}

function ensureBothDays() {
  const campaign = state.campaign;
  const sim = state.simulation;
  applySeasonDemand();
  if (!campaign.weekdayReport) {
    sim.startDay(1);
    campaign.weekdayReport = sim.runToEnd();
  }
  if (!campaign.weekendReport) {
    sim.startDay(6);
    campaign.weekendReport = sim.runToEnd();
  }
}

function closeMonth() {
  const campaign = state.campaign;
  const sim = state.simulation;
  ensureBothDays();
  const summary = buildMonthSummary({
    monthNumber: campaign.month,
    districtId: sim.district.id,
    weekdayReport: campaign.weekdayReport,
    weekendReport: campaign.weekendReport,
    businessTypeId: campaign.businessTypeId,
    loanAmount: campaign.loanAmount ?? 0,
  });
  // 시뮬레이션은 이틀치만 현금에 반영했으므로, 나머지 한 달을 여기서 정산한다.
  const alreadyApplied = campaign.weekdayReport.metrics.profit + campaign.weekendReport.metrics.profit;
  sim.cash += summary.profit - alreadyApplied;
  summary.cashAfter = sim.cash;
  summary.ownerStress = Math.round(sim.ownerStress ?? 0);
  summary.events = (campaign.events ?? []).map((event) => ({
    title: event.title,
    icon: event.icon,
    situation: event.situation,
    picked: event.choice?.options.find((item) => item.id === campaign.eventChoices?.[event.id])?.name ?? null,
  }));
  // 사장 노동은 플레이한 이틀이 아니라 그 달 전체 영업일 기준으로 쌓인다.
  campaign.ownerMinutesTotal += summary.ownerMinutes;
  campaign.months.push(summary);
  campaign.stage = "monthClose";
  platform.logEvent("month_closed", { month: campaign.month, profit: Math.round(summary.profit * 10000) });
  evaluateAchievements({ monthSummary: summary, day: campaign.month, maxDays: 12 })
    .then((unlocked) => unlocked.forEach((item, index) => {
      setTimeout(() => { toast(`업적 달성 — ${item.name}`); sounds.bell(); }, 500 + index * 900);
    }))
    .catch(() => {});
  sounds.bell();
  setView("monthClose");
}

function renderMonthClose() {
  const campaign = state.campaign;
  const sim = state.simulation;
  const summary = campaign.months.at(-1);
  const previous = campaign.months.at(-2);
  const isFinalMonth = campaign.month >= 12;
  const naive = (summary.weekdayProfit * summary.days.weekdays) + (summary.weekendProfit * summary.days.weekends);
  const gap = naive - summary.profit;
  topbarStatus.innerHTML = statusMarkup(`${summary.name} / 월 마감 정산`);

  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  // 사장 노동: 월 누적 → 주간 환산. "주 40시간"이라는 익숙한 자로 재보게 한다.
  const ownerHours = Math.round(summary.ownerMinutes / 60);
  const totalDays = summary.days.weekdays + summary.days.weekends;
  const weeklyHours = Math.round((ownerHours * 7) / Math.max(1, totalDays));
  const stressNow = summary.ownerStress ?? 0;
  // 이번 달 이탈 원인 상위 3개 — 각각에 다음 달 처방을 붙인다
  const coachItems = Object.entries(summary.losses ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => ({ key, count, ...(LOSS_COACH[key] ?? { label: key, tip: "" }) }));
  const c = summary.costs;
  const sh = summary.shares;
  // 실매출에서 하나씩 빼고 마지막에 남는 돈을 보여준다
  const costRows = [
    ["재료비 (매출원가)", c.food, sh.food, null],
    ["인건비", c.labor, sh.labor, null],
    ["└ 퇴직금 적립", c.severance, sh.severance, "인건비의 8.3%"],
    ["└ 4대보험 사업자부담", c.insurance, sh.insurance, "인건비의 9.6%"],
    ["월세", c.rent, sh.rent, null],
    ["공과금", c.utility, sh.utility, null],
    ["카드 결제 수수료", c.cardFee, sh.cardFee, "실매출의 1.5%"],
    ["배달 중개·결제 수수료", c.delivery, sh.delivery, "배달 매출의 10.8%"],
    ["소모품·포장재·점검 적립", c.supplies, sh.supplies, "실매출의 5%"],
    ["기장·세무", c.keeping, summary.netRevenue > 0 ? c.keeping / summary.netRevenue : 0, null],
    ["대출 이자", c.interest ?? 0, summary.netRevenue > 0 ? (c.interest ?? 0) / summary.netRevenue : 0, summary.loanAmount ? `${formatMoney(summary.loanAmount, true)} 대출 · 연 6.5%` : null],
  ];

  screen.innerHTML = `
    <section class="report-screen enter-up">
      <header class="report-header">
        <div>
          <p class="section-kicker">${summary.name} / MONTHLY SETTLEMENT</p>
          <h1 class="report-title">${summary.name} 마감 리포트<br /><em>한 달은 하루의 30배가 아닙니다.</em></h1>
        </div>
        <div class="report-verdict">
          <strong>계절 계수 ×${summary.season.toFixed(2)}</strong>
          <p>${summary.note}</p>
        </div>
      </header>

      <div class="report-kpis">
        <div class="report-kpi"><span class="metric-label">월 매출</span><strong>${formatMoney(summary.revenue)}</strong>${previous ? deltaChip(summary.revenue, previous.revenue) : '<small class="kpi-delta">첫 달 기준선</small>'}</div>
        <div class="report-kpi"><span class="metric-label">월 비용</span><strong>${formatMoney(summary.totalCost)}</strong>${previous ? deltaChip(previous.totalCost, summary.totalCost) : '<small class="kpi-delta">첫 달 기준선</small>'}</div>
        <div class="report-kpi"><span class="metric-label">월 순이익</span><strong class="${summary.profit >= 0 ? "positive" : "negative"}">${formatMoney(summary.profit)}</strong>${previous ? deltaChip(summary.profit, previous.profit) : '<small class="kpi-delta">첫 달 기준선</small>'}</div>
        <div class="report-kpi"><span class="metric-label">영업일</span><strong>${summary.days.weekdays + summary.days.weekends}일</strong><small class="kpi-delta">평일 ${summary.days.weekdays} · 주말 ${summary.days.weekends}</small></div>
        <div class="report-kpi"><span class="metric-label">사장 노동</span><strong>${ownerHours}시간</strong><small class="kpi-delta ${weeklyHours >= 52 ? "bad" : ""}">주 ${weeklyHours}시간${weeklyHours >= 52 ? " · 과로 구간" : weeklyHours >= 40 ? " · 풀타임 이상" : ""}</small><small class="kpi-delta ${stressNow >= 50 ? "bad" : "good"}">스트레스 ${stressNow} / 100</small></div>
        <div class="report-kpi"><span class="metric-label">보유 현금</span><strong>${formatMoney(summary.cashAfter)}</strong><small class="kpi-delta">${summary.cashAfter < 500 ? "위험 — 운전자금 부족" : "운영 가능"}</small></div>
      </div>

      <div class="reality-check">
        <span class="meta-label">하루 감각 vs 한 달 현실</span>
        <div class="reality-grid">
          <div><span>플레이한 이틀로 계산하면</span><b>${formatMoney(naive)}</b></div>
          <div class="is-arrow" aria-hidden="true">→</div>
          <div><span>실제 월 순이익</span><b class="${summary.profit >= 0 ? "is-good" : "is-bad"}">${formatMoney(summary.profit)}</b></div>
          <div class="is-gap"><span>사라진 돈</span><b>${formatMoney(gap)}</b></div>
        </div>
        <p>4대보험·카드수수료·소모품·기장료는 하루 장사에서는 보이지 않습니다. 월 단위로만 청구되거든요.</p>
      </div>

      ${coachItems.length ? `<div class="month-coach">
        <span class="meta-label">다음 달을 위한 코치</span>
        <div class="coach-list">
          ${coachItems.map((item, index) => `
            <div class="coach-item">
              <span class="coach-rank">${index + 1}</span>
              <div>
                <strong>${item.label} <em>월 ${item.count}명 이탈</em></strong>
                <p>${item.tip}</p>
              </div>
            </div>`).join("")}
        </div>
      </div>` : ""}

      ${summary.events?.length ? `<div class="event-recap">
        <span class="meta-label">이 달에 있었던 일</span>
        <div class="event-recap-list">
          ${summary.events.map((event) => `
            <div class="event-recap-item">
              <span aria-hidden="true">${event.icon}</span>
              <div><strong>${event.title}</strong><p>${event.situation}</p>${event.picked ? `<em>선택 — ${event.picked}</em>` : ""}</div>
            </div>`).join("")}
        </div>
      </div>` : ""}

      <div class="report-grid">
        <section class="report-panel">
          <span class="meta-label">MONTHLY LEDGER</span>
          <h2>실매출에서 무엇이 빠졌나</h2>
          <div class="ledger-sheet">
            <div class="ledger-top">
              <div><span>실매출</span><small>부가세 10% 제외</small></div>
              <b>${formatMoney(summary.netRevenue)}</b>
            </div>
            ${costRows.filter(([, value]) => Math.abs(value) > 0.001).map(([label, value, shareValue, note]) => `
              <div class="ledger-line ${label.startsWith("└") ? "is-sub" : ""}">
                <span>${label}${note ? `<small>${note}</small>` : ""}</span>
                <em>${pct(shareValue)}</em>
                <b>−${formatMoney(value)}</b>
              </div>`).join("")}
            <div class="ledger-bottom ${summary.profit >= 0 ? "is-good" : "is-bad"}">
              <div><span>남은 돈</span><small>세전 영업이익</small></div>
              <b>${formatMoney(summary.profit)}<i>${pct(sh.profit)}</i></b>
            </div>
          </div>
        </section>
        <section class="report-panel">
          <span class="meta-label">YEAR TO DATE</span>
          <h2>1월부터 지금까지</h2>
          <div class="year-bars">
            ${campaign.months.map((m) => {
              const peak = Math.max(...campaign.months.map((x) => Math.abs(x.profit)), 1);
              const height = clamp(Math.abs(m.profit) / peak) * 100;
              return `<div class="year-bar ${m.profit >= 0 ? "is-good" : "is-bad"}" title="${m.name} ${formatMoney(m.profit)}">
                <i style="height:${Math.max(4, height)}%"></i><span>${m.n ?? m.monthNumber}</span>
              </div>`;
            }).join("")}
          </div>
          <div class="ytd-total">
            <span>누적 순이익</span>
            <b class="${campaign.months.reduce((a, m) => a + m.profit, 0) >= 0 ? "is-good" : "is-bad"}">${formatMoney(campaign.months.reduce((a, m) => a + m.profit, 0))}</b>
          </div>
        </section>
      </div>

      <div class="report-actions">
        <button class="cta" id="month-next" type="button"><span>${isFinalMonth ? "연말정산 하기" : `${monthInfo(campaign.month + 1).name} 경영 계획`}</span><span aria-hidden="true">→</span></button>
      </div>
    </section>`;

  document.querySelector("#month-next").addEventListener("click", () => {
    if (isFinalMonth) {
      setView("final");
      return;
    }
    campaign.month += 1;
    campaign.weekdayReport = null;
    campaign.weekendReport = null;
    campaign.stage = "monthPlan";
    rollMonthEvents();
    state.selectedActions = [];
    sounds.click();
    setView("monthPlan");
  });
}

function deltaChip(current, before) {
  const change = current - before;
  const neutral = Math.abs(change) < 0.005;
  return `<small class="kpi-delta ${neutral ? "" : change > 0 ? "good" : "bad"}">전월 ${change > 0 ? "+" : ""}${formatMoney(change)}</small>`;
}

function renderImprovements() {
  const campaign = state.campaign;
  const sim = state.simulation;
  const info = monthInfo(campaign.month);
  const season = seasonFactor(campaign.month, sim.district.id);
  const previous = campaign.months.at(-1);
  state.selectedActions = state.selectedActions.filter((id) => ALL_ACTIONS.some((action) => action.id === id));
  const selected = state.selectedActions.map((id) => getById(ALL_ACTIONS, id));
  const selectedCost = selected.reduce((sum, action) => sum + action.cost, 0);
  const canProceed = selected.length <= GAME_CONFIG.maxDailyActions && selectedCost <= sim.cash;
  const plan = getById(HOUR_PLANS, state.hourPlanId);
  // 인건비가 실매출의 30%를 넘었으면 편성을 다시 보라고 대놓고 말해준다.
  const laborAlarm = previous && previous.shares.labor > 0.3 ? previous.shares.labor : null;
  // 1인 카페에는 줄일 인건비 자체가 없다 — 레버를 보여주면 거짓말이 된다.
  const hasHires = hiredLaborCost(sim.format, sim.district, plan, sim.supplyMode, sim.staffing, sim.hires) > 0;
  // ── 메뉴 개편 규칙 ──
  // 작은 평수는 베이커리 메뉴 자체가 불가능하고, 중간 평수는 기구를 증설한 뒤
  // 납품으로만 1~2종을 팔 수 있다. 직접 굽는 건 베이커리 카페의 영역이다.
  const bakeryCount = sim.menus.filter((menu) => menu.bakeryOnly).length;
  const menuGate = (menu) => {
    const selected = sim.menus.some((item) => item.id === menu.id);
    if (selected) return null;
    if (sim.menus.length >= 5) return "메뉴는 5개까지";
    if (!menu.bakeryOnly) return null;
    if (sim.format.id === "solo_cafe") return "작은 평수 — 자리가 없습니다";
    if (!sim.format.bakes) {
      if (!state.bakeryGearBought) return "베이커리 기구 증설 필요";
      if (bakeryCount >= 2) return "납품은 2종까지";
    }
    return null;
  };
  const needsGear = !sim.format.bakes && sim.format.id !== "solo_cafe" && !state.bakeryGearBought;
  const menuNotice = sim.format.id === "solo_cafe"
    ? "작은 평수라 빵·페이스트리는 못 들입니다. 치즈케이크·에이드 같은 납품 디저트까지가 한계입니다."
    : !sim.format.bakes && state.bakeryGearBought
      ? "기구를 증설했습니다. 빵·페이스트리를 납품으로 2종까지 팔 수 있습니다."
      : null;
  topbarStatus.innerHTML = statusMarkup(`${info.name} / 경영 계획`);

  screen.innerHTML = `
    <section class="stage-shell enter-up">
      <header class="stage-head">
        <div>
          <p class="section-kicker">${info.name} / MONTHLY PLAN</p>
          <h1>${info.name}, 무엇을<br /><em>바꿀 것인가.</em></h1>
        </div>
        <div class="season-card">
          <span class="meta-label">이번 달 계절 계수</span>
          <b class="${season >= 1 ? "is-good" : "is-bad"}">×${season.toFixed(2)}</b>
          <p>${info.note}</p>
          ${season < 0.9 ? '<em>비수기입니다. 비용을 줄이는 것도 전략입니다.</em>' : season > 1.1 ? '<em>성수기입니다. 처리능력이 매출 상한을 정합니다.</em>' : ""}
        </div>
      </header>

      <div class="improvement-layout">
        <div>
          ${(campaign.events ?? []).map((event) => `
            <div class="plan-event">
              <span class="event-icon" aria-hidden="true">${event.icon}</span>
              <div>
                <strong>${event.title}</strong>
                <p>${event.situation}</p>
                ${event.choice ? '<em>아침 브리핑에서 어떻게 대응할지 고릅니다.</em>' : ""}
              </div>
            </div>`).join("")}

          <div class="setup-section-head"><h2>이번 달 영업시간</h2><span class="meta-label">인건비가 여기서 결정됩니다</span></div>
          <div class="hours-options">
            ${HOUR_PLANS.map((option) => `
              <button class="hours-option ${option.id === state.hourPlanId ? "is-selected" : ""}" data-hours="${option.id}" type="button">
                <b>${option.name}</b>
                <span>${option.open}:00–${option.close}:00 · ${option.close - option.open}h</span>
                <em>인건비 ${formatMoney(hiredLaborCost(sim.format, sim.district, option), true)}/일</em>
              </button>`).join("")}
          </div>

          <div class="setup-section-head" style="margin-top:22px"><h2>운영 개선과 마케팅</h2><span class="meta-label">SELECT UP TO ${GAME_CONFIG.maxDailyActions}</span></div>
          <div class="action-grid">
            ${ALL_ACTIONS.map((action) => {
              const isSelected = state.selectedActions.includes(action.id);
              const disabled = actionDisabled(action);
              const category = MARKETING.some((item) => item.id === action.id) ? "MARKETING" : "OPERATIONS";
              return `<button class="action-card ${isSelected ? "selected" : ""}" data-action="${action.id}" type="button" ${disabled ? "disabled" : ""}>
                <span class="action-icon">${action.icon}</span><span class="meta-label">${category}</span>
                <h3>${action.name}</h3><p>${action.description}</p>
                <div class="action-cost"><span>${action.type === "marketing" ? `${action.days}일 효과` : "영구 효과"}</span><strong>${disabled && sim.upgrades.includes(action.id) ? "적용됨" : formatMoney(action.cost)}</strong></div>
              </button>`;
            }).join("")}
          </div>

          <div class="setup-section-head" style="margin-top:22px"><h2>메뉴 개편</h2><span class="meta-label">${sim.menus.length} / 5 · 다음 달부터 적용 · ◎/△ = 장사 노트 기록</span></div>
          ${menuNotice ? `<p class="staffing-none">${menuNotice}</p>` : ""}
          <div class="menu-edit-grid">
            ${MENUS.map((menu) => {
              const selected = sim.menus.some((item) => item.id === menu.id);
              const gate = menuGate(menu);
              return `<button class="menu-chip ${selected ? "is-selected" : ""}" data-edit-menu="${menu.id}" type="button" ${!selected && gate ? "disabled" : ""} title="${gate ?? ""}">
                <span class="menu-chip-icon">${menu.icon}</span>
                <b>${menu.name}${menuFitBadge(sim, menu.id)}</b>
                <span class="menu-chip-meta">${gate && !selected ? gate : `${formatMoney(menu.price)}${menu.bakeryOnly && !sim.format.bakes ? " · 납품" : ""}`}</span>
              </button>`;
            }).join("")}
          </div>
          ${needsGear ? `<button class="gear-button" id="buy-bakery-gear" type="button" ${sim.cash < BAKERY_GEAR_COST ? "disabled" : ""}>
            <b>🔧 베이커리 기구 증설 — ${formatMoney(BAKERY_GEAR_COST)}</b>
            <span>쇼케이스·냉장 진열대를 들입니다. 증설해야 빵·페이스트리를 납품받아 팔 수 있습니다.</span>
          </button>` : ""}

          <div class="setup-section-head" style="margin-top:22px"><h2>직원</h2><span class="meta-label">채용·퇴사는 월 단위로</span></div>
          ${state.dismissalNotice ? `<p class="dismissal-alarm">${state.dismissalNotice}</p>` : ""}
          <div class="staff-board">
            <div class="staff-list">
              ${sim.hires.length ? sim.hires.map((hire, index) => `
                <div class="staff-row">
                  <span class="staff-role">${hire.role === "베이커" ? "🥐" : hire.role === "바리스타" ? "☕" : "🧹"} ${hire.role}</span>
                  <span class="staff-meta">${hire.hours}시간 · 일 ${formatMoney((sim.district.hourlyWage * hire.wageMultiplier * hire.hours) / 10000)}</span>
                  <button class="fire-button ${state.everFired ? "is-soft" : "is-hard"}" data-fire="${index}" type="button">${state.everFired ? "권고 사직" : "해고 처리"}</button>
                </div>`).join("") : `<p class="staffing-none">직원이 없습니다. 전부 사장의 몸으로 때우는 중입니다.</p>`}
            </div>
            <div class="hire-list">
              ${HIRE_OPTIONS.filter((option) => !option.bakeryOnly || sim.format.bakes).map((option) => `
                <button class="hire-button" data-hire="${option.id}" type="button">
                  <b>${option.icon} ${option.role} ${option.hours}시간 채용</b>
                  <span>${option.description} 일 ${formatMoney((sim.district.hourlyWage * option.wageMultiplier * option.hours) / 10000)}</span>
                </button>`).join("")}
            </div>
          </div>
        </div>

        <aside class="selected-actions">
          <span class="meta-label">${info.name} 실행 계획</span>
          <h2>대표 영업일을<br />직접 뛰겠습니까?</h2>
          ${hasHires ? "" : `<p class="staffing-none">직원이 없습니다. 줄일 인건비도, 대신 서 줄 사람도 없습니다 — 1인 카페의 값입니다.</p>`}
          ${laborAlarm ? `<p class="labor-alarm">지난달 인건비가 실매출의 <b>${Math.round(laborAlarm * 100)}%</b>였습니다. 30%를 넘기면 남는 게 없습니다 — 직원 시간을 줄이고 사장이 더 나오는 방법이 있습니다.</p>` : ""}
          <div class="staffing-choice" ${hasHires ? "" : "hidden"}>
            <span class="meta-label">인력 편성</span>
            ${STAFFING_PLANS.map((plan) => `
              <button class="repday ${state.staffingId === plan.id ? "is-selected" : ""}" data-staffing="${plan.id}" type="button">
                <b>${plan.icon} ${plan.name}</b><span>${plan.description}</span>
                <em>일 인건비 ${formatMoney(hiredLaborCost(sim.format, sim.district, getById(HOUR_PLANS, state.hourPlanId), sim.supplyMode, plan, sim.hires))}${plan.ownerExtraHours ? ` · 사장 +${plan.ownerExtraHours}시간` : ""}</em>
              </button>`).join("")}
          </div>

          <div class="repday-choice">
            <button class="repday ${campaign.repDay === "weekday" ? "is-selected" : ""}" data-repday="weekday" type="button">
              <b>평일을 직접</b><span>주말은 직원에게 맡기고 결과만 받습니다.</span>
            </button>
            <button class="repday ${campaign.repDay === "weekend" ? "is-selected" : ""}" data-repday="weekend" type="button">
              <b>주말을 직접</b><span>평일은 직원에게 맡기고 결과만 받습니다.</span>
            </button>
            <button class="repday ${campaign.repDay === "auto" ? "is-selected" : ""}" data-repday="auto" type="button">
              <b>둘 다 맡긴다</b><span>빠르게 넘깁니다. 사장의 개입이 없으니 결과는 그만큼 나빠집니다.</span>
            </button>
          </div>

          <div class="selected-action-list">
            ${selected.length ? selected.map((action, index) => `<div class="selected-action-item"><strong>0${index + 1} · ${action.name}</strong><span>${action.description}</span></div>`).join("")
              : `<div class="selected-action-item"><strong>개선 없음</strong><span>아무것도 바꾸지 않고 넘어갈 수도 있습니다.</span></div>`}
          </div>

          <div class="receipt">
            <div class="receipt-row"><span>현재 현금</span><strong>${formatMoney(sim.cash)}</strong></div>
            <div class="receipt-row"><span>선택 비용</span><strong>${formatMoney(selectedCost)}</strong></div>
            <div class="receipt-row"><span>${plan.name} 일 인건비</span><strong>${formatMoney(hiredLaborCost(sim.format, sim.district, plan, sim.supplyMode, sim.staffing))}</strong></div>
            <div class="receipt-row total"><span>예상 잔액</span><strong>${formatMoney(sim.cash - selectedCost)}</strong></div>
          </div>
          ${previous && previous.cashAfter < 800 ? '<p class="cash-warning">운전자금이 얇습니다. 이번 달에 비용을 늘리면 다음 달 인건비를 못 낼 수 있습니다.</p>' : ""}
          <button class="cta" id="start-month" type="button" ${canProceed ? "" : "disabled"}><span>${campaign.repDay === "auto" ? `${info.name} 자동 진행` : `${info.name} 영업 시작`}</span><span aria-hidden="true">→</span></button>
        </aside>
      </div>
    </section>`;

  screen.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.action;
    if (state.selectedActions.includes(id)) state.selectedActions = state.selectedActions.filter((item) => item !== id);
    else if (state.selectedActions.length < GAME_CONFIG.maxDailyActions) state.selectedActions = [...state.selectedActions, id];
    else toast(`한 달에 바꿀 수 있는 것은 ${GAME_CONFIG.maxDailyActions}가지뿐입니다.`);
    sounds.click();
    setView("monthPlan");
  }));
  screen.querySelectorAll("[data-edit-menu]").forEach((button) => button.addEventListener("click", () => {
    const menu = getById(MENUS, button.dataset.editMenu);
    const selected = sim.menus.some((item) => item.id === menu.id);
    if (selected) {
      if (sim.menus.length <= 2) { toast("메뉴가 두 개는 있어야 장사가 됩니다."); sounds.bad(); return; }
      sim.setMenus(sim.menus.filter((item) => item.id !== menu.id));
      toast(`${menu.name}을(를) 메뉴에서 뺐습니다. 다음 달부터 적용됩니다.`);
    } else {
      const gate = menuGate(menu);
      if (gate) { toast(gate); sounds.bad(); return; }
      sim.setMenus([...sim.menus, menu]);
      toast(`${menu.name}을(를) 메뉴에 넣었습니다. 손님 반응은 팔아봐야 압니다.`);
    }
    sounds.click();
    setView("monthPlan");
  }));
  document.querySelector("#buy-bakery-gear")?.addEventListener("click", () => {
    if (sim.cash < BAKERY_GEAR_COST) { toast("현금이 부족합니다."); sounds.bad(); return; }
    sim.cash -= BAKERY_GEAR_COST;
    state.bakeryGearBought = true;
    sounds.good();
    toast(`베이커리 기구를 증설했습니다. −${formatMoney(BAKERY_GEAR_COST)} — 이제 빵을 납품받아 팔 수 있습니다.`);
    setView("monthPlan");
  });
  screen.querySelectorAll("[data-fire]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.fire);
    const hire = sim.hires[index];
    if (!hire) return;
    const result = sim.removeHire(index);
    if (!result.ok) { toast(result.reason); sounds.bad(); return; }
    if (!state.everFired) {
      // 절차 없는 해고의 값 — 노동부 민원과 한 달치 위로금
      const settlement = Math.round((sim.district.hourlyWage * hire.wageMultiplier * hire.hours * 30) / 10000);
      sim.cash -= settlement;
      state.everFired = true;
      const code = hire.role.charCodeAt(hire.role.length - 1);
      const josa = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0 ? "이" : "가";
      state.dismissalNotice = `⚠ ${hire.role}${josa} 노동부에 부당해고 민원을 넣었습니다. 위로금 한 달치 ${formatMoney(settlement)}이 자동 지급됐습니다. 앞으로는 사직서와 퇴사자 서약서를 받는 권고 사직 절차를 밟습니다.`;
      sounds.bad();
      toast(`부당해고 민원 — 위로금 ${formatMoney(settlement)} 지급`);
    } else {
      sounds.click();
      toast(`${hire.role} 권고 사직 처리. 사직서와 서약서를 받았습니다.`);
    }
    setView("monthPlan");
  }));
  screen.querySelectorAll("[data-hire]").forEach((button) => button.addEventListener("click", () => {
    const option = getById(HIRE_OPTIONS, button.dataset.hire);
    sim.addHire(option);
    sounds.good();
    toast(`${option.role} ${option.hours}시간 채용. 다음 영업일부터 출근합니다.`);
    setView("monthPlan");
  }));
  screen.querySelectorAll("[data-staffing]").forEach((button) => button.addEventListener("click", () => {
    state.staffingId = button.dataset.staffing;
    sim.setStaffing(getById(STAFFING_PLANS, state.staffingId));
    sounds.click();
    setView("monthPlan");
  }));
  screen.querySelectorAll("[data-hours]").forEach((button) => button.addEventListener("click", () => {
    state.hourPlanId = button.dataset.hours;
    sim.setHourPlan(getById(HOUR_PLANS, state.hourPlanId));
    sounds.click();
    setView("monthPlan");
  }));
  screen.querySelectorAll("[data-repday]").forEach((button) => button.addEventListener("click", () => {
    campaign.repDay = button.dataset.repday;
    sounds.click();
    setView("monthPlan");
  }));

  document.querySelector("#start-month").addEventListener("click", () => {
    sim.applyActions(state.selectedActions.map((id) => getById(ALL_ACTIONS, id)));
    state.selectedActions = [];
    sim.setHourPlan(getById(HOUR_PLANS, state.hourPlanId));
    sounds.bell();
    if (campaign.repDay === "auto") {
      closeMonth();
      return;
    }
    campaign.stage = campaign.repDay;
    applySeasonDemand();
    sim.startDay(campaign.repDay === "weekend" ? 6 : 1);
    setView("brief");
  });
}

function renderYearEnd() {
  const campaign = state.campaign;
  const sim = state.simulation;
  const ownerHours = campaign.ownerMinutesTotal / 60;
  const settlement = yearEndSettlement({
    months: campaign.months,
    businessTypeId: campaign.businessTypeId,
    ownerHours,
  });
  const grade = yearGrade(settlement, GAME_CONFIG.minimumWage);
  const ending = endingFor({ netProfit: settlement.netProfit, ownerHours });
  const score = campaignScore({
    profit: settlement.netProfit,
    hourlyWon: settlement.hourlyWon,
    reputation: sim.reputation,
    served: campaign.months.reduce((sum, m) => sum + m.served, 0),
  });
  const best = campaign.months.reduce((a, m) => (m.profit > a.profit ? m : a), campaign.months[0]);
  const worst = campaign.months.reduce((a, m) => (m.profit < a.profit ? m : a), campaign.months[0]);
  const monthsInBlack = campaign.months.filter((m) => m.profit > 0).length;
  topbarStatus.innerHTML = statusMarkup("연말정산 / YEAR-END SETTLEMENT");

  screen.innerHTML = `
    <section class="report-screen enter-up">
      <header class="report-header">
        <div>
          <p class="section-kicker">FOOREND BUSINESS REVIEW / YEAR ONE</p>
          <h1 class="report-title">당신은<br /><em>${ending.name}</em></h1>
          <p class="ending-tagline">${ending.tagline}</p>
        </div>
        <div class="report-verdict is-stats">
          <div><span class="metric-label">사업자</span><b>${settlement.business.name}</b></div>
          <div><span class="metric-label">등급</span><b class="grade-inline">${grade}</b></div>
          <div><span class="metric-label">사장 시급</span><b class="${settlement.hourlyWon >= GAME_CONFIG.minimumWage ? "is-good" : "is-bad"}">${settlement.hourlyWon >= 0 ? `₩${settlement.hourlyWon.toLocaleString("ko-KR")}` : `−₩${Math.abs(settlement.hourlyWon).toLocaleString("ko-KR")}`}</b></div>
        </div>
      </header>

      <div class="ending-card ${ending.id}">
        <span class="ending-icon" aria-hidden="true">${ending.icon}</span>
        <div class="ending-body">
          <p>${ending.body}</p>
          <div class="ending-axes">
            <div class="axis ${settlement.netProfit >= MONEY_LINE ? "is-hit" : ""}">
              <span>얼마를 벌었나</span>
              <b>${formatMoney(settlement.netProfit)}</b>
              <small>대표님 라인 ${formatMoney(MONEY_LINE)}</small>
            </div>
            <div class="axis ${ownerHours <= TIME_LINE ? "is-hit" : ""}">
              <span>내 시간을 지켰나</span>
              <b>${Math.round(ownerHours).toLocaleString("ko-KR")}시간</b>
              <small>여유 라인 ${TIME_LINE.toLocaleString("ko-KR")}시간</small>
            </div>
          </div>
        </div>
      </div>

      <div class="report-kpis">
        <div class="report-kpi"><span class="metric-label">연 매출</span><strong>${formatMoney(settlement.revenue)}</strong></div>
        <div class="report-kpi"><span class="metric-label">연 비용</span><strong>${formatMoney(settlement.cost)}</strong></div>
        <div class="report-kpi"><span class="metric-label">영업이익</span><strong class="${settlement.operatingProfit >= 0 ? "positive" : "negative"}">${formatMoney(settlement.operatingProfit)}</strong></div>
        <div class="report-kpi"><span class="metric-label">${settlement.business.id === "corp" ? "법인세" : "종합소득세"}</span><strong class="negative">−${formatMoney(settlement.tax)}</strong><small class="kpi-delta">세율 ${Math.round(settlement.taxRate * 100)}%</small></div>
        <div class="report-kpi"><span class="metric-label">세후 순이익</span><strong class="${settlement.netProfit >= 0 ? "positive" : "negative"}">${formatMoney(settlement.netProfit)}</strong></div>
        <div class="report-kpi"><span class="metric-label">흑자 달</span><strong>${monthsInBlack} / 12</strong></div>
      </div>

      <div class="hourly-verdict is-year ${settlement.hourlyWon >= GAME_CONFIG.minimumWage ? "good" : "bad"}">
        <span class="meta-label">1년을 시급으로 환산하면</span>
        <p>당신은 1년간 <b>${Math.round(ownerHours).toLocaleString("ko-KR")}시간</b> 일했고, 세금까지 내고 <b>${formatMoney(settlement.netProfit)}</b>이 남았습니다.</p>
        <strong>시급 ${settlement.hourlyWon >= 0 ? `₩${settlement.hourlyWon.toLocaleString("ko-KR")}` : `−₩${Math.abs(settlement.hourlyWon).toLocaleString("ko-KR")}`}</strong>
        <small>${settlement.hourlyWon >= GAME_CONFIG.minimumWage
          ? `최저시급 ₩${GAME_CONFIG.minimumWage.toLocaleString("ko-KR")}을 넘겼습니다. 1년을 버텨 사업이 됐습니다.`
          : `최저시급은 ₩${GAME_CONFIG.minimumWage.toLocaleString("ko-KR")}입니다. 같은 시간을 알바로 썼다면 ${formatMoney((GAME_CONFIG.minimumWage * ownerHours) / 10000)}을 벌었습니다.`}</small>
      </div>

      <div class="report-grid">
        <section class="report-panel">
          <span class="meta-label">TAX BREAKDOWN</span>
          <h2>1년 동안 국가에 낸 돈</h2>
          <div class="month-ledger">
            <div class="ledger-row"><span>부가가치세 (매달 10%)</span><b>${formatMoney(settlement.vatPaid)}</b></div>
            <div class="ledger-row"><span>4대보험 사업자부담</span><b>${formatMoney(settlement.insurancePaid)}</b></div>
            <div class="ledger-row"><span>${settlement.business.id === "corp" ? "법인세" : "종합소득세"} ${settlement.taxableBase > 0 ? `(과세표준 ${formatMoney(settlement.taxableBase)})` : "(적자 — 과세표준 없음)"}</span><b>${formatMoney(settlement.tax)}</b></div>
            <div class="ledger-row is-monthly"><span>합계<em>세금·보험</em></span><b>${formatMoney(settlement.vatPaid + settlement.insurancePaid + settlement.tax)}</b></div>
          </div>
          <div class="tax-compare">
            <span class="meta-label">만약 ${settlement.alternativeName}였다면</span>
            <b class="${settlement.alternativeTax < settlement.tax ? "is-good" : settlement.alternativeTax > settlement.tax ? "is-bad" : ""}">${formatMoney(settlement.alternativeTax)}</b>
            <p>${settlement.taxableBase <= 0
              ? "적자라서 어느 쪽이든 소득세·법인세는 0원입니다. 세금이 문제가 아니라 이익이 문제입니다."
              : settlement.alternativeTax < settlement.tax
                ? `${formatMoney(settlement.tax - settlement.alternativeTax)} 덜 냈습니다. 이익이 커질수록 법인이 유리해집니다.`
                : settlement.alternativeTax > settlement.tax
                  ? `${formatMoney(settlement.alternativeTax - settlement.tax)} 더 냈을 겁니다. 이익이 작을 때는 개인이 유리합니다.`
                  : "이 구간에서는 두 유형의 세금이 같습니다."}</p>
          </div>
        </section>

        <section class="report-panel">
          <span class="meta-label">TWELVE MONTHS</span>
          <h2>계절이 만든 굴곡</h2>
          <div class="year-bars is-large">
            ${campaign.months.map((m) => {
              const peak = Math.max(...campaign.months.map((x) => Math.abs(x.profit)), 1);
              return `<div class="year-bar ${m.profit >= 0 ? "is-good" : "is-bad"}" title="${m.name} ${formatMoney(m.profit)}">
                <i style="height:${Math.max(4, clamp(Math.abs(m.profit) / peak) * 100)}%"></i><span>${m.monthNumber}</span>
              </div>`;
            }).join("")}
          </div>
          <div class="month-extremes">
            <div><span>가장 좋았던 달</span><b class="is-good">${best.name} ${formatMoney(best.profit)}</b></div>
            <div><span>가장 나빴던 달</span><b class="is-bad">${worst.name} ${formatMoney(worst.profit)}</b></div>
          </div>
        </section>
      </div>

      <div class="lesson-panel">
        <span class="meta-label">이 게임이 하려던 말</span>
        <p>커피 한 잔에 남는 돈은 생각보다 작고, 그 작은 돈에서 재료·인건비·월세·부가세·4대보험·카드수수료·소모품이 차례로 빠져나갑니다. 그리고 1년이 끝나면 ${settlement.business.id === "corp" ? "법인세" : "종합소득세"}가 한 번 더 옵니다. 카페를 여는 일은 커피를 잘 만드는 일이 아니라, 이 모든 것을 매달 감당하는 일입니다.</p>
      </div>

      <div class="platform-panel">
        <div class="platform-head"><span class="meta-label">${escapeHtml(platform.name)} 랭킹</span><b>${score.toLocaleString("ko-KR")} pt</b></div>
        <ol class="rank-list" id="rank-list"><li class="rank-empty">기록을 올리는 중…</li></ol>
      </div>
      <div class="platform-panel">
        <span class="meta-label">업적</span>
        <div class="badge-row" id="badge-row"></div>
      </div>

      <div class="report-actions">
        <button class="secondary-button" id="review-months" type="button"><span>12월 리포트 다시 보기</span><span aria-hidden="true">←</span></button>
        <button class="cta" id="restart-game" type="button"><span>다른 상권으로 다시 시작</span><span aria-hidden="true">↻</span></button>
      </div>
    </section>`;

  sounds.good();
  document.querySelector("#restart-game").addEventListener("click", () => {
    if (window.confirm("1년 기록을 지우고 새 카페를 시작할까요?")) resetGame();
  });
  document.querySelector("#review-months").addEventListener("click", () => setView("monthClose"));

  const boardId = `year-${sim.district.id}`;
  platform.logEvent("year_complete", { district: sim.district.id, grade, score, hourly: settlement.hourlyWon });
  platform.submitScore(boardId, {
    score,
    name: state.restaurantName,
    district: sim.district.shortName,
    grade,
    hourlyWon: settlement.hourlyWon,
    at: `${sim.seed}:YEAR`,
  })
    .then(() => platform.getLeaderboard(boardId))
    .then((rows) => {
      const list = document.querySelector("#rank-list");
      if (!list) return;
      list.innerHTML = rows.length
        ? rows.slice(0, 5).map((row) => `
            <li class="${row.name === state.restaurantName && row.score === score ? "is-me" : ""}">
              <b>${String(row.rank).padStart(2, "0")}</b><span>${escapeHtml(row.name ?? "사장")}</span>
              <em>${escapeHtml(row.district ?? "")}</em><strong>${Number(row.score).toLocaleString("ko-KR")}</strong>
            </li>`).join("")
        : '<li class="rank-empty">아직 기록이 없습니다.</li>';
    })
    .catch(() => {});

  evaluateAchievements({
    day: 12,
    maxDays: 12,
    final: { hourlyWon: settlement.hourlyWon, minimumWage: GAME_CONFIG.minimumWage },
  })
    .then(() => platform.getAchievements())
    .then((owned) => {
      const row = document.querySelector("#badge-row");
      if (!row) return;
      row.innerHTML = ACHIEVEMENTS.map((item) => `
        <span class="badge ${owned.includes(item.id) ? "is-owned" : ""}" title="${escapeHtml(item.description)}">${escapeHtml(item.name)}</span>`).join("");
    })
    .catch(() => {});
}

soundToggle.addEventListener("click", async () => {
  const enabled = await sounds.toggle();
  state.soundOn = enabled;
  soundToggle.textContent = enabled ? "SOUND ON" : "SOUND OFF";
  soundToggle.classList.toggle("active", enabled);
  if (enabled) sounds.good();
});

helpToggle.addEventListener("click", () => helpDialog.showModal());
helpClose.addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => { if (event.target === helpDialog) helpDialog.close(); });
brandHome.addEventListener("click", () => {
  if (state.view === "landing") return;
  const hasProgress = state.simulation || state.districtId;
  if (!hasProgress || window.confirm("현재 진행을 끝내고 첫 화면으로 돌아갈까요?")) resetGame();
});
window.addEventListener("keydown", (event) => {
  if (state.view !== "operations" || !state.simulation) return;
  const station = OWNER_STATIONS.find((item) => item.key === event.key);
  if (station && !state.simulation.activeDilemma && !state.arcadeOpen) {
    event.preventDefault();
    // 튜토리얼 연습 스텝 — 키로도 연습판이 열린다
    const tutStep = state.tutorial?.step;
    if (tutStep?.practice) {
      if (tutStep.practice === station.id) {
        state.tutorial.enterWaiting();
        launchArcade(station.id, { practice: true });
      }
      return;
    }
    const result = state.simulation.moveOwner(station.id);
    if (result.ok) { state.pendingArcade = station.id; sounds.good(); } else toast(result.reason);
    return;
  }
  // 스페이스는 출근/쉬기 전용(별도 핸들러). 일시정지는 Ⅱ 버튼 클릭으로만.
});

// 플랫폼(로컬 또는 Hive) 세션을 연다. 실패해도 게임 진행에는 영향이 없다.
platform.signIn()
  .then((player) => {
    state.player = player;
    platform.logEvent("game_boot", { provider: platform.name });
  })
  .catch(() => { /* 오프라인·시크릿 모드에서도 그대로 플레이 */ });

render();

// URL 파라미터로 특정 상태까지 자동 진행한다.
// 헤드리스 캡처와 데모 영상 촬영에 쓰고, 일반 플레이에는 영향이 없다.
(function autoplayFromUrl() {
  const preset = new URLSearchParams(location.search).get("autoplay");
  if (!preset) return;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pick = (selector, text) => {
    const el = [...document.querySelectorAll(selector)].find((item) => item.textContent.includes(text));
    el?.click();
    return !!el;
  };
  (async () => {
    try {
      localStorage.setItem("ois-cafe/tutorial-done-v5", "1");
    } catch { /* 저장 불가 환경에서도 진행 */ }
    document.querySelector("#start-game")?.click(); await wait(80);
    pick("[data-district]", "성수"); await wait(60);
    document.querySelector("#wizard-next")?.click(); await wait(60);
    pick("[data-format]", "스페셜티"); await wait(60);
    document.querySelector("#wizard-next")?.click(); await wait(60);
    pick("[data-bean]", "스페셜티"); await wait(60);
    document.querySelector("#wizard-next")?.click(); await wait(60);
    pick("[data-menu]", "시그니처"); pick("[data-menu]", "카페라떼"); pick("[data-menu]", "바스크"); await wait(60);
    document.querySelector("#wizard-next")?.click(); await wait(60);
    pick("[data-role]", "풀타임"); await wait(60);
    document.querySelector("#wizard-next")?.click(); await wait(60);
    document.querySelector('[data-business="sole"]')?.click(); await wait(60);
    document.querySelector("#wizard-next")?.click(); await wait(120);
    if (preset === "brief") return;
    // 발표용: 벚꽃 성수기 피크로 바로 점프해 코어 루프만 보여준다
    if (preset === "blossom") {
      state.campaign.month = 4;
      rollMonthEvents();
      state.simulation.reputation = 84;
      state.simulation.awareness = 78;
      setView("brief");
      return;
    }
    document.querySelector("#start-service")?.click(); await wait(160);
    const sim = state.simulation;
    for (let i = 0; i < 900 && sim.gameMinute < 12 * 60 + 40; i += 1) {
      if (sim.activeDilemma) break;
      window.__oisDebug.advance(0.5);
    }
    window.__oisDebug.redraw();
  })();
})();

// 개발·QA용 훅: rAF가 제한된 환경(헤드리스 캡처 등)에서 수동으로 시간을 진행한다.
window.__oisDebug = {
  state,
  advance(effectiveSeconds = 1) {
    const sim = state.simulation;
    if (!sim) return null;
    if (sim.speed <= 0 && !sim.activeDilemma && !sim.finished) sim.setSpeed(1);
    const snapshot = sim.update(effectiveSeconds / Math.max(1, sim.speed));
    if (state.view === "operations") {
      gameScene?.draw(snapshot, 0.016);
      consumeVisualEvents(sim);
      updateOperationsHud(snapshot);
    }
    return snapshot.clock;
  },
  redraw(deltaSeconds = 0.016) {
    const sim = state.simulation;
    if (!sim || state.view !== "operations") return;
    gameScene?.draw(sim.snapshot(), deltaSeconds);
    updateOperationsHud(sim.snapshot());
  },
};

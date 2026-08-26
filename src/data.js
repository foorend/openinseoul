// OPEN IN SEOUL — Cafe. 모든 수치는 실제 창업 상담 모델을 게임 밸런스로
// 정규화한 합성 데이터다. 특정 서비스의 실제 데이터가 아니다. 금액 단위는 만원.

// ── 사장 캐릭터 ──────────────────────────────────────────────
// 게임 시작 전에 "누가 이 가게를 하는가"부터 정한다.
// 스탯은 총 10포인트. 셋 다 1에서 시작해 7포인트를 직접 나눠 찍는다(최대 5).

export const OWNER_LOOKS = [
  { id: "classic", name: "클래식 앞치마", icon: "🖤", color: "#23241f", description: "말없이 커피만 내릴 것 같은 인상." },
  { id: "brown", name: "브라운 바리스타", icon: "🤎", color: "#6b4a32", description: "로스터리 물이 든 손. 원두 얘기가 길다." },
  { id: "navy", name: "네이비 셔츠", icon: "💙", color: "#2c3e5a", description: "회사 다니다 나온 티가 난다. 엑셀을 잘 쓴다." },
  { id: "burgundy", name: "버건디 니트", icon: "❤️", color: "#6e3040", description: "인스타 감성. 셀카 명당을 본능적으로 안다." },
];

export const OWNER_HAIRS = [
  { id: "black", name: "흑발", color: "#241f1c" },
  { id: "brown", name: "브라운", color: "#5a3d26" },
  { id: "ash", name: "애쉬 그레이", color: "#8a8578" },
  { id: "wine", name: "와인", color: "#5e2f38" },
];

export const OWNER_STAT_DEFS = [
  { id: "kind", name: "인성", icon: "🤝", description: "직원이 따르고 손님이 웃습니다. 홀 회전과 만족도가 좋아집니다." },
  { id: "smart", name: "지성", icon: "📐", description: "원가를 계산할 줄 압니다. 재료비가 조금씩 덜 샙니다." },
  { id: "charm", name: "외모", icon: "✨", description: "입구에 서면 지나가던 사람이 들어옵니다." },
];
export const OWNER_STAT_POOL = 10;  // 세 스탯 합계 (각 1에서 시작, 7점을 배분)
export const OWNER_STAT_MAX = 5;
export const OWNER_STAT_MIN = 1;

export const CAPITAL_OPTIONS = [
  { id: "tight", name: "월급 모은 전부", icon: "🪙", amount: 9000, description: "9,000만원. 보증금 내고 나면 숨이 짧습니다. 한 달만 삐끗해도 흔들려요." },
  { id: "standard", name: "퇴직금까지 합쳐서", icon: "💼", amount: 15000, description: "1억 5천. 표준적인 창업 자금. 반년은 버틸 수 있습니다." },
  { id: "backed", name: "부모님 찬스", icon: "🏦", amount: 24000, description: "2억 4천. 여유는 있지만, 갚아야 할 돈이라는 걸 잊으면 안 됩니다." },
];

// ── 월 단위 인력 시장 ─────────────────────────────────────────
export const HIRE_OPTIONS = [
  { id: "hall8", role: "홀 알바", hours: 8, wageMultiplier: 1.0, icon: "🧹", description: "풀타임 홀. 테이블 회전이 눈에 띄게 살아납니다." },
  { id: "hall4", role: "홀 알바", hours: 4, wageMultiplier: 1.0, icon: "🕓", description: "피크타임 홀. 가장 싼 보험입니다." },
  { id: "barista8", role: "바리스타", hours: 8, wageMultiplier: 1.15, icon: "☕", description: "제조 속도가 12% 올라갑니다. 사장이 자리를 비워도 커피가 나옵니다." },
  { id: "baker8", role: "베이커", hours: 8, wageMultiplier: 1.35, icon: "🥐", bakeryOnly: true, description: "매일 아침 직접 굽습니다. 베이커리 카페의 심장." },
];

// ── 개업 준비 비용 ───────────────────────────────────────────
// 준비 단계의 모든 선택이 자본금에서 실시간으로 빠져나간다.
export const EQUIPMENT_TIERS = [
  {
    id: "used", name: "중고 풀세트", icon: "🔩", cost: 350,
    cookSpeed: 0.94, quality: -0.02,
    description: "중고 머신·제빙기·냉장 세트. 초기비용은 아끼지만 손이 느리고, 맛이 미세하게 흔들립니다.",
  },
  {
    id: "standard", name: "신품 표준 세트", icon: "⚙️", cost: 700,
    cookSpeed: 1.0, quality: 0,
    description: "국산 신품 2그룹 머신과 표준 집기. 기준이 되는 선택입니다.",
  },
  {
    id: "premium", name: "하이엔드 세트", icon: "✨", cost: 1200,
    cookSpeed: 1.08, quality: 0.03,
    description: "수입 머신과 풀 옵션. 제조가 8% 빨라지고 맛이 좋아지지만, 초기 자본을 크게 먹습니다.",
  },
];

export const RESEARCH_COST = 25;  // 만원 — 상권 분석 리포트 1부
// 대출 — 자본이 모자라면 빌릴 수 있다. 공짜가 아니다: 매월 이자가 원장에 찍힌다.
export const LOAN_UNIT = 3000;        // 만원 — 1구좌 3천만
export const LOAN_MAX_UNITS = 3;      // 최대 9천만
export const LOAN_ANNUAL_RATE = 0.065;

export const LEASE_BASE_PYEONG = 12;  // 상권 시세표의 기준 평수 — 계약 평수에 비례해 환산한다

// 상권별 진상 출몰율 — 하루 한 번 판정. 강남이 압도적이다.
export const JINSANG_RATE = { gangnam: 0.75, sinchon: 0.35, seongsu: 0.3, euljiro: 0.3, gangdong: 0.22 };

export const BAKERY_GEAR_COST = 600;  // 만원 — 쇼케이스·발효기·컨벡션 오븐 증설

// ── 사장 스트레스 ────────────────────────────────────────────
// 정한 시간을 넘겨 일하는 건 언제나 가능하다. 몸이 갚을 뿐이다.
export const STRESS = {
  perOvertimeHour: 16,   // 초과 근무 1시간당 스트레스
  restDecayPerHour: 6,   // 쉬는 동안 시간당 회복
  overnightRecovery: 35, // 하루 자고 나면 회복
  slowdownFrom: 50,      // 이 위부터 사장 보너스가 깎이기 시작
  collapseAt: 100,       // 여기 닿으면 강제 퇴근
};

export const GAME_CONFIG = {
  startingCash: 15000,
  maxDays: 7,
  earliestOpenHour: 7,
  latestCloseHour: 23,
  baselineOpenHours: 13,
  researchTokens: 3,
  maxMenuChoices: 3,
  maxDailyActions: 2,
  openingChecklistCost: 18,
  hygieneBase: 86,
  reputationBase: 68,
  awarenessBase: 28,
  fitRevealCount: 3,
  ownerBoostMinutes: 25,
  ownerBoostCooldown: 150,
  taxRate: 0.1,        // 부가세 등 단순화 10%
  utilityRate: 0.05,   // 공과금·복리후생 5%
  severanceRate: 0.1,  // 시급의 10% 매월 퇴직금 적립
  minimumWage: 10030,  // 결산 화면의 비교 기준
  demandScale: 0.22,   // 상권 유동 → 잠재고객 변환 계수. 밸런스 테스트로 고정된 값이다.
};

// 영업시간 프리셋 — 여는 시간이 인건비와 잡을 수 있는 손님을 동시에 바꾼다.
export const HOUR_PLANS = [
  {
    id: "early", name: "얼리버드", open: 7, close: 20, icon: "☀",
    description: "출근길 커피를 잡는다. 오피스 상권의 아침이 하루 매출을 만듭니다.",
    note: "저녁 디저트·심야 배달은 포기합니다.",
  },
  {
    id: "office", name: "오피스 타임", open: 8, close: 19, icon: "◧",
    description: "짧고 굵게. 인건비를 가장 아끼면서 출근·점심 러시만 가져갑니다.",
    note: "11시간 · 저녁 매출 전부 포기.",
  },
  {
    id: "standard", name: "기본 영업", open: 10, close: 23, icon: "◑",
    description: "점심 러시부터 심야 배달까지. 가장 무난하고 가장 평범합니다.",
    note: "13시간 · 아침 출근 수요는 놓칩니다.",
  },
  {
    id: "long", name: "롱런", open: 8, close: 23, icon: "◉",
    description: "아침부터 밤까지 다 잡습니다. 대신 인건비가 15시간치로 붙습니다.",
    note: "15시간 · 사장도 그만큼 오래 서 있어야 합니다.",
  },
  {
    id: "short", name: "숏 오픈", open: 11, close: 19, icon: "◔",
    description: "체력과 인건비를 아끼는 최소 영업. 단골이 붙기 전엔 위험합니다.",
    note: "8시간 · 손님이 왔다가 닫힌 문을 봅니다.",
  },
];

// 하루의 리듬: 피크는 천천히 보여주고, 한산한 시간은 빠르게 넘긴다.
// rate = 실제 1초당 흐르는 게임 분. 1×에서 하루 약 3분 40초.
// 기본 페이즈 — 상권에 phases가 없을 때만 쓰는 안전망.
// busy:true인 구간이 그 상권의 진짜 피크다. 카페는 식사 시간에 한산하고
// 밥을 먹은 다음에 몰려온다. 저녁 장사는 상권이 허락해야 있다.
export const PHASES = [
  { id: "open", until: 720, label: "MORNING", korean: "오전 영업", rate: 6 },
  { id: "lunchbreak", until: 780, label: "LUNCH BREAK", korean: "다들 식사 중 — 한산", rate: 7 },
  { id: "postlunch", until: 900, label: "AFTER-LUNCH", korean: "식후 커피 러시", rate: 2.4, busy: true },
  { id: "afternoon", until: 1080, label: "AFTERNOON", korean: "오후의 카페", rate: 5 },
  { id: "evening", until: 1441, label: "EVENING", korean: "저녁 마감 무드", rate: 6 },
];

// 원두 등급 — 원가율과 품질을 함께 결정한다. 상담 모델의 핵심 변수.
export const BEAN_TIERS = [
  {
    id: "value", name: "저가 블렌드", icon: "▽",
    costRatio: 0.14, initialStock: 40, quality: -0.06,
    description: "납품용 대용량 원두. 원가는 확실히 낮지만 커피 맛 평가가 함께 내려갑니다.",
  },
  {
    id: "standard", name: "스탠다드 블렌드", icon: "◇",
    costRatio: 0.17, initialStock: 70, quality: 0,
    description: "무난한 로스터리 블렌드. 원가 30% 안팎, 특별한 감점도 가점도 없습니다.",
  },
  {
    id: "specialty", name: "스페셜티 싱글오리진", icon: "◆",
    costRatio: 0.22, initialStock: 120, quality: 0.07,
    description: "컵노트가 분명한 원두. 원가가 무겁지만 맛 평가와 커피 애호가의 재방문이 올라갑니다.",
  },
];

// 디저트 조달 — 직접 굽느냐, 납품받느냐. 베이커리 카페에서만 고른다.
export const SUPPLY_MODES = [
  {
    id: "bake", name: "직접 굽는다", icon: "🥐",
    description: "베이커가 매일 아침 굽습니다. 재료비가 더 들고 품절도 나지만, 갓 구운 것이 무기가 됩니다.",
    costMultiplier: 1.0, quality: 0.06, needsBaker: true,
  },
  {
    id: "buy", name: "납품받는다", icon: "📦",
    description: "쿠키·치즈케이크를 완제품으로 받습니다. 베이커 인건비가 통째로 사라지고 원가도 낮지만, 맛의 차별점이 없습니다.",
    costMultiplier: 0.72, quality: -0.05, needsBaker: false,
  },
];

// 본인 노동 — 사장이 몇 시간 일할지가 인건비이자 삶의 질이다.
export const OWNER_ROLES = [
  {
    id: "fulltime", name: "풀타임 사장 바리스타", icon: "◉",
    hoursPerDay: 12, capacityBonus: 1.25, schedule: "all",
    description: "오픈부터 마감까지 바 안에 선다. 인건비를 아끼는 대신 당신의 시간이 들어간다.",
  },
  {
    id: "peak", name: "피크타임만 선다", icon: "◐",
    hoursPerDay: 6, capacityBonus: 1.25, schedule: "peak",
    description: "점심 러시와 저녁 피크에만 바에 선다. 나머지는 직원에게 맡긴다.",
  },
  {
    id: "manager", name: "오너 매니저", icon: "○",
    hoursPerDay: 2, capacityBonus: 1, schedule: "none",
    description: "운영과 숫자만 챙긴다. 제조는 전부 직원 몫 — 인건비가 그대로 청구된다.",
  },
];

// 영업 중 돌발 결정. 정답 대신 트레이드오프만 있다.
export const DILEMMAS = [
  {
    id: "rush_hour",
    title: "점심 커피 러시가 터졌다",
    situation: "12시 반, 주문이 제조 속도를 넘었습니다. 줄 뒤쪽 직장인들이 시계를 보기 시작합니다.",
    options: [
      { id: "drinks", name: "쿠키를 돌리며 양해를 구한다", detail: "비용 ₩40,000 · 오늘 손님들의 대기 허용시간이 크게 늘어납니다.", cost: 4, default: true },
      { id: "honest", name: "정직하게 돌려보낸다", detail: "쿠폰과 함께 양해를 구합니다. 이탈은 그대로지만 대기 악평은 남지 않습니다.", cost: 0 },
    ],
  },
  {
    id: "bean_delay",
    title: "원두 납품이 늦는다",
    situation: "로스터리 배송이 밀렸습니다. 지금 재고로는 오후를 못 버팁니다.",
    options: [
      { id: "local_roaster", name: "동네 로스터리에서 긴급 공수", detail: "비용 ₩120,000 · 남은 시간 원가가 10% 오르지만 맛은 지킵니다.", cost: 12, default: true },
      { id: "cheap_backup", name: "창고의 저가 원두로 버틴다", detail: "비용 없음 · 오늘 커피 품질이 내려가고, 단골 입맛은 정확합니다.", cost: 0 },
    ],
  },
  {
    id: "cammer_takeover",
    title: "카공족이 자리를 잡았다",
    situation: "노트북과 전공서적이 테이블 세 개를 점령했습니다. 음료 한 잔으로 세 시간째입니다.",
    options: [
      { id: "limit", name: "2시간 이용 안내문을 붙인다", detail: "좌석 회전이 살아나지만, 학생들 사이에 야박하다는 말이 돕니다.", cost: 0, default: true },
      { id: "allow", name: "공부하게 둔다", detail: "회전은 죽지만 학생 단골이 쌓입니다. 조용한 카페라는 평판도 함께.", cost: 0 },
    ],
  },
  {
    id: "steamer_break",
    title: "스팀 완드가 고장났다",
    situation: "우유 스팀에서 쇳소리가 납니다. 라떼 주문이 계속 들어오고 있습니다.",
    options: [
      { id: "repair", name: "출장 수리를 부른다", detail: "비용 ₩180,000 · 한 시간 안에 정상화됩니다.", cost: 18, default: true },
      { id: "no_milk", name: "오늘 라떼류 판매 중단", detail: "비용 없음 · 우유 들어간 메뉴를 찾는 손님을 전부 돌려보냅니다.", cost: 0 },
    ],
  },
  {
    id: "influencer_visit",
    title: "카페 유튜버가 왔다",
    situation: "구독자 30만 카페 리뷰어가 조용히 시그니처를 주문했습니다. 바에 알릴까요?",
    options: [
      { id: "special", name: "정성껏 대접한다", detail: "비용 ₩120,000 · 오늘 만족도가 높으면 내일 인지도가 크게 뛰지만, 낮으면 혹평이 확산됩니다.", cost: 12 },
      { id: "same", name: "다른 손님과 똑같이", detail: "평소 그대로 냅니다. 결과가 어떻든 흔들리지 않는 가게라는 신뢰가 조금 쌓입니다.", cost: 0, default: true },
    ],
  },
  {
    id: "rain_delivery_surge",
    title: "비가 오자 배달이 몰린다",
    situation: "커피+디저트 세트 주문이 평소의 두 배입니다. 바는 이미 홀 주문을 처리 중입니다.",
    options: [
      { id: "take_all", name: "전부 받는다", detail: "배달 수요 +30% · 바가 과부하되어 모든 제조가 조금씩 느려집니다.", cost: 0 },
      { id: "narrow", name: "배달 반경을 줄인다", detail: "주문은 줄지만 가까운 곳만 받아 도착 품질이 눈에 띄게 좋아집니다.", cost: 0, default: true },
    ],
  },
  {
    id: "jinsang_refund", icon: "😤", jinsang: true,
    title: "진상 출몰 — \"어제 산 커피가 식었으니 환불해\"",
    situation: "어제 테이크아웃한 커피를 들고 와 환불을 요구합니다. 목소리가 점점 커지고, 홀의 손님들이 쳐다봅니다.",
    options: [
      { id: "service", name: "사과하고 새 음료를 낸다", detail: "비용 ₩40,000 · 소란은 가라앉고 평판은 지켜집니다. 사장 스트레스 +8.", cost: 4, default: true },
      { id: "refuse", name: "원칙대로 거절한다", detail: "비용 없음 · 그 손님은 별점 1점을 남기고, 홀 분위기가 식습니다. 스트레스 +14.", cost: 0 },
    ],
  },
  {
    id: "jinsang_seat", icon: "🪑", jinsang: true,
    title: "진상 출몰 — 4인석에 혼자, 3시간째",
    situation: "아메리카노 한 잔으로 4인석을 3시간째 차지한 손님. 대기 손님들이 발을 구릅니다. 말을 걸자 \"손님한테 지금 나가라는 거예요?\"",
    options: [
      { id: "polite", name: "정중히 합석을 부탁한다", detail: "비용 없음 · 자리가 돌기 시작하지만 그 손님의 시선이 따갑습니다. 스트레스 +8.", cost: 0, default: true },
      { id: "leave_it", name: "그냥 둔다", detail: "비용 없음 · 대기 손님 일부가 떠납니다. 오늘 회전이 무겁습니다.", cost: 0 },
    ],
  },
  {
    id: "jinsang_review", icon: "📱", jinsang: true,
    title: "진상 출몰 — \"리뷰 지워줄게, 서비스 내놔\"",
    situation: "별점 1점 리뷰를 보여주며 말합니다. \"서비스 잘 해주면 지워드릴게요.\" 명백한 협박이지만, 리뷰는 리뷰입니다.",
    options: [
      { id: "give", name: "디저트를 내준다", detail: "비용 ₩60,000 · 리뷰는 지워지지만, 이런 손님은 또 옵니다. 스트레스 +10.", cost: 6, default: true },
      { id: "report", name: "플랫폼에 신고한다", detail: "비용 없음 · 절차대로 갑니다. 리뷰는 한동안 남아 오늘 신규 유입이 줄어듭니다. 스트레스 +6.", cost: 0 },
    ],
  },
  {
    id: "corporate_order", icon: "🏢", districts: ["gangnam"],
    title: "법인카드 단체 주문",
    situation: "옆 빌딩 회사에서 회의용 커피 40잔을 지금 주문하겠답니다. 30분 안에요.",
    options: [
      { id: "accept", name: "받는다", detail: "매출이 크게 뛰지만 30분간 홀 손님 제조가 전부 밀립니다.", cost: 0, default: true },
      { id: "decline", name: "정중히 거절한다", detail: "홀 손님을 지킵니다. 그 회사는 다시 전화하지 않을 겁니다.", cost: 0 },
    ],
  },
  {
    id: "popup_shoot", icon: "📸", districts: ["seongsu"],
    title: "브랜드 팝업 촬영 요청",
    situation: "패션 브랜드가 매장에서 2시간 화보 촬영을 하고 싶답니다. 대관료를 주겠다는데, 그동안 좌석 절반이 막힙니다.",
    options: [
      { id: "allow", name: "촬영을 받는다", detail: "대관료 ₩300,000 수입 · 오늘 좌석 절반이 막히고, 내일 인지도가 뜁니다.", cost: 0, default: true },
      { id: "refuse", name: "영업이 우선이다", detail: "손님 자리를 지킵니다. 평소의 성수동다운 결정입니다.", cost: 0 },
    ],
  },
  {
    id: "exam_week", icon: "📚", districts: ["sinchon"],
    title: "시험기간 자리 전쟁",
    situation: "중간고사 기간입니다. 노트북 부대가 오픈런을 했고, 음료 한 잔으로 6시간을 버티려 합니다.",
    options: [
      { id: "study_set", name: "카공 세트를 판다", detail: "리필+디저트 세트로 객단가를 올립니다. 학생들 사이에 착한 카페로 소문납니다.", cost: 5, default: true },
      { id: "no_limit", name: "그냥 둔다", detail: "회전은 죽지만 시험기간 단골이 생깁니다.", cost: 0 },
    ],
  },
  {
    id: "print_alley", icon: "🖨", districts: ["euljiro"],
    title: "인쇄골목 사장님들의 외상 장부",
    situation: "옆 인쇄소 사장님이 골목 사장님들 것까지 커피 12잔을 주문하며 말합니다. \"장부에 달아놔, 월말에 줄게.\"",
    options: [
      { id: "tab", name: "장부를 만든다", detail: "골목 단골 12명이 생깁니다. 돈은 월말에 들어옵니다(아마도).", cost: 0, default: true },
      { id: "cash_only", name: "현금만 받는다", detail: "깔끔하지만, 골목에서 정 없는 집이 됩니다.", cost: 0 },
    ],
  },
  {
    id: "apt_group", icon: "🏠", districts: ["gangdong"],
    title: "아파트 부녀회 정기 모임",
    situation: "단지 부녀회가 매주 화요일 오전을 우리 가게에서 하고 싶답니다. 10명, 3시간, 음료 10잔.",
    options: [
      { id: "welcome", name: "모신다", detail: "매주 고정 매출이 생기고 동네 소문이 퍼집니다. 오전 좌석은 포기합니다.", cost: 0, default: true },
      { id: "polite_no", name: "부담스럽다", detail: "좌석을 지키지만, 동네 장사에서 부녀회를 적으로 두면 피곤해집니다.", cost: 0 },
    ],
  },
  {
    id: "group_reservation",
    title: "스터디 모임 8명 예약 문의",
    situation: "19시에 8명 스터디 모임 예약 전화가 왔습니다. 받으면 저녁 좌석 여유가 사라집니다.",
    options: [
      { id: "accept", name: "예약을 받는다", detail: "확정 매출 8잔+디저트 · 저녁 홀 좌석이 그만큼 오래 묶입니다.", cost: 0, default: true },
      { id: "decline", name: "정중히 거절한다", detail: "피크 회전을 지킵니다. 아무 일도 일어나지 않는 것도 선택입니다.", cost: 0 },
    ],
  },
];

// 서울 5개 상권 — 임대·매출·시급 시세를 게임 밸런스로 정규화한 합성 데이터.
export const DISTRICTS = [
  {
    id: "gangnam",
    // 오피스 상권의 하루 — 러시는 출근길과 "밥 먹고 나서"다. 12시는 다들 식당에 있다.
    phases: [
      { id: "commute", until: 600, label: "COMMUTE RUSH", korean: "출근길 테이크아웃 러시", rate: 2.6, busy: true },
      { id: "meeting", until: 720, label: "MID MORNING", korean: "회의 커피 시간", rate: 5 },
      { id: "lunchbreak", until: 780, label: "LUNCH BREAK", korean: "다들 식사 중 — 한산", rate: 7 },
      { id: "postlunch", until: 900, label: "AFTER-LUNCH RUSH", korean: "식후 아메리카노 러시", rate: 2.2, busy: true },
      { id: "afternoon", until: 1080, label: "AFTERNOON", korean: "오후 미팅 커피", rate: 5 },
      { id: "evening", until: 1441, label: "EMPTY EVENING", korean: "퇴근 후 공동화", rate: 8 },
    ],
    weekendPhases: [
      { id: "morning", until: 780, label: "QUIET OFFICE", korean: "텅 빈 오피스 거리", rate: 8 },
      { id: "afternoon", until: 1080, label: "SPARSE", korean: "드문드문 나들이 손님", rate: 6 },
      { id: "evening", until: 1441, label: "QUIET NIGHT", korean: "조용한 주말 저녁", rate: 8 },
    ],
    number: "01",
    name: "강남 테헤란로",
    shortName: "강남",
    tagline: "유동은 최강, 임대료도 최강",
    description: "오피스 밀집의 왕. 아침·점심 후 테이크아웃 커피가 폭발하지만 대형 프랜차이즈와 임대료가 목을 조른다. 주말이면 거리가 비워진다.",
    traffic: [40, 82, 74, 52, 46, 38, 100, 92, 62, 56, 44, 36, 26, 16, 10, 6, 4],
    mix: { office_worker: 62, cafe_studier: 6, mz_hotple: 12, local_resident: 8, delivery_customer: 12 },
    lease: { deposit: 4500, keyMoney: 3800, monthlyRent: 490, fitout: 800 },
    hourlyWage: 11000,
    weekday: 1.15,
    weekend: 0.42,
    competition: 90,
    deliveryDemand: 46,
    visibility: 74,
    color: "#3983b8",
    icon: "▥",
    tags: ["테이크아웃", "스피드", "평일", "회의커피"],
    warning: "제조가 3분만 밀려도 직장인은 옆 프랜차이즈로 갑니다. 주말 매출은 기대하지 마세요.",
    research: {
      rent: { title: "부동산 시세", text: "1층 12평 평균 보증금 4,500 · 월세 490. 권리금은 회수까지 최소 2년을 봐야 합니다." },
      sales: { title: "동종업계 매출", text: "반경 300m 1인 카페 월매출 중앙값 1,900. 상위 20%는 테이크아웃 회전으로 3,200을 넘깁니다." },
      wage: { title: "인근 시급 시세", text: "바리스타 시급 11,000원. 주휴·퇴직금 적립까지 계산하면 실질 인건비는 시급의 120%입니다." },
    },
  },
  {
    id: "euljiro",
    // 낮에는 인쇄골목 직장인, 밤에는 힙지로 — 저녁 장사가 진짜인 상권.
    phases: [
      { id: "morning", until: 660, label: "ALLEY MORNING", korean: "골목의 아침", rate: 7 },
      { id: "lunchbreak", until: 780, label: "LUNCH LINE", korean: "백반집에 줄 서는 시간", rate: 6.5 },
      { id: "postlunch", until: 900, label: "AFTER-LUNCH", korean: "식후 커피 러시", rate: 2.6, busy: true },
      { id: "afternoon", until: 1080, label: "ALLEY WALK", korean: "골목 탐방 시간", rate: 4.5 },
      { id: "night", until: 1290, label: "HIP-JIRO NIGHT", korean: "힙지로의 밤", rate: 2.6, busy: true },
      { id: "late", until: 1441, label: "LATE ALLEY", korean: "심야 골목", rate: 5 },
    ],
    weekendPhases: [
      { id: "morning", until: 840, label: "SLOW MORNING", korean: "조용한 오전", rate: 7 },
      { id: "afternoon", until: 1080, label: "ALLEY TOUR", korean: "골목 나들이", rate: 3.5, busy: true },
      { id: "night", until: 1290, label: "HIP-JIRO NIGHT", korean: "힙지로의 밤", rate: 2.4, busy: true },
      { id: "late", until: 1441, label: "LATE ALLEY", korean: "심야 골목", rate: 5 },
    ],
    number: "02",
    name: "을지로 힙지로",
    shortName: "을지로",
    tagline: "낮은 인쇄소, 밤은 골목 카페",
    description: "공구상가 골목에 숨은 카페들. 평일은 오피스, 저녁과 주말은 레트로 감성을 찾는 MZ가 온다. 간판이 안 보여도 찾아오는 동네 — 대신 못 찾으면 그냥 지나간다.",
    traffic: [16, 42, 38, 30, 44, 78, 70, 48, 52, 60, 72, 88, 100, 92, 78, 58, 36],
    mix: { office_worker: 38, cafe_studier: 8, mz_hotple: 34, local_resident: 8, delivery_customer: 12 },
    lease: { deposit: 2800, keyMoney: 2000, monthlyRent: 300, fitout: 700 },
    hourlyWage: 10500,
    weekday: 1.0,
    weekend: 0.95,
    competition: 72,
    deliveryDemand: 40,
    visibility: 52,
    color: "#8362b1",
    icon: "◫",
    tags: ["레트로", "골목", "저녁", "감성"],
    warning: "가시성이 낮아 초반 인지도 싸움이 깁니다. 대신 발견의 재미가 단골을 만듭니다.",
    research: {
      rent: { title: "부동산 시세", text: "골목 2층 15평 보증금 2,800 · 월세 300. 간판 규제로 노출 간판을 못 다는 자리가 많습니다." },
      sales: { title: "동종업계 매출", text: "골목 카페 월매출 중앙값 1,300. 인스타 태그가 붙은 집은 주말에만 400을 더 법니다." },
      wage: { title: "인근 시급 시세", text: "시급 10,500원. 야간 마감 가능한 알바 구하기가 유독 어려운 동네입니다." },
    },
  },
  {
    id: "seongsu",
    // 카페 투어 상권 — 평일 오후와 저녁, 주말은 하루 종일이 피크다.
    phases: [
      { id: "open", until: 720, label: "SLOW OPEN", korean: "느긋한 오픈", rate: 7 },
      { id: "lunchbreak", until: 810, label: "LUNCH BREAK", korean: "점심 식사 중", rate: 6 },
      { id: "tour", until: 1020, label: "CAFE TOUR", korean: "카페 투어의 오후", rate: 3, busy: true },
      { id: "dessert", until: 1230, label: "DESSERT TIME", korean: "저녁 디저트 시간", rate: 3, busy: true },
      { id: "close", until: 1441, label: "WIND DOWN", korean: "마감 무드", rate: 6 },
    ],
    weekendPhases: [
      { id: "openrun", until: 660, label: "OPEN RUN", korean: "오픈런 대기", rate: 6 },
      { id: "brunch", until: 780, label: "BRUNCH WAIT", korean: "브런치 웨이팅", rate: 2.6, busy: true },
      { id: "tour", until: 1080, label: "TOUR PEAK", korean: "카페 투어 피크", rate: 2.2, busy: true },
      { id: "dessert", until: 1260, label: "EVENING MOOD", korean: "저녁 감성", rate: 3 },
      { id: "close", until: 1441, label: "WIND DOWN", korean: "마감 무드", rate: 6 },
    ],
    number: "03",
    name: "성수동 카페거리",
    shortName: "성수동",
    tagline: "서울 카페 씬의 최전선",
    description: "공장 개조 카페의 성지. 주말 유동은 서울 최고지만 한 집 건너 카페고, 권리금은 화제성을 먹고 자란다. 재방문보다 첫 방문이 많은 동네.",
    traffic: [8, 15, 18, 22, 32, 50, 58, 66, 78, 86, 92, 100, 96, 88, 76, 60, 40],
    mix: { office_worker: 14, cafe_studier: 10, mz_hotple: 52, local_resident: 12, delivery_customer: 12 },
    lease: { deposit: 3300, keyMoney: 4200, monthlyRent: 380, fitout: 850 },
    hourlyWage: 10700,
    weekday: 0.85,
    weekend: 1.55,
    competition: 82,
    deliveryDemand: 38,
    visibility: 86,
    color: "#e05d2d",
    icon: "✦",
    tags: ["인스타", "주말", "시그니처", "첫방문"],
    warning: "비주얼 없는 메뉴는 존재하지 않는 것과 같습니다. 대신 유행이 지나면 권리금부터 빠집니다.",
    research: {
      rent: { title: "부동산 시세", text: "연무장길 1층 보증금 3,300 · 월세 380 · 권리금 4,200. 권리금이 유행을 따라 움직입니다." },
      sales: { title: "동종업계 매출", text: "주말 하루가 평일 이틀치. 시그니처 음료 보유 매장의 객단가가 평균보다 34% 높습니다." },
      wage: { title: "인근 시급 시세", text: "시급 10,700원. 라떼아트 가능 바리스타는 웃돈이 붙습니다." },
    },
  },
  {
    id: "sinchon",
    // 대학가 — 공강과 카공이 하루를 정한다. 학식 시간에는 아무도 안 온다.
    phases: [
      { id: "gap", until: 720, label: "CLASS GAP", korean: "공강 커피", rate: 4.5 },
      { id: "lunchbreak", until: 780, label: "CAFETERIA", korean: "학식 시간 — 한산", rate: 7 },
      { id: "study", until: 1050, label: "STUDY PEAK", korean: "카공 피크", rate: 2.8, busy: true },
      { id: "evening", until: 1260, label: "MEET-UP", korean: "저녁 모임", rate: 3.4 },
      { id: "late", until: 1441, label: "LATE STUDY", korean: "심야 카공", rate: 5 },
    ],
    weekendPhases: [
      { id: "morning", until: 840, label: "EMPTY CAMPUS", korean: "조용한 캠퍼스", rate: 8 },
      { id: "afternoon", until: 1140, label: "MEETING SPOT", korean: "약속 상권의 오후", rate: 4 },
      { id: "evening", until: 1441, label: "WEEKEND EVE", korean: "주말 저녁", rate: 5 },
    ],
    number: "04",
    name: "신촌 대학가",
    shortName: "신촌",
    tagline: "회전이냐 단골이냐, 카공의 딜레마",
    description: "대학생과 스터디족의 동네. 객단가는 낮지만 수요가 꾸준하고 시험기간엔 자리가 없다. 콘센트 개수가 회전율을 결정하는 유일한 상권.",
    traffic: [12, 24, 30, 35, 48, 62, 58, 66, 74, 82, 88, 95, 100, 90, 78, 64, 46],
    mix: { office_worker: 10, cafe_studier: 46, mz_hotple: 18, local_resident: 14, delivery_customer: 12 },
    lease: { deposit: 2200, keyMoney: 1400, monthlyRent: 240, fitout: 650 },
    hourlyWage: 10300,
    weekday: 1.05,
    weekend: 0.75,
    competition: 74,
    deliveryDemand: 58,
    visibility: 72,
    color: "#d94841",
    icon: "✎",
    tags: ["카공", "가성비", "시험기간", "콘센트"],
    warning: "카공족은 매출을 깔아주지만 좌석을 잠급니다. 회전과 단골 사이의 균형이 전부입니다.",
    research: {
      rent: { title: "부동산 시세", text: "대로변 이면 1층 보증금 2,200 · 월세 240. 방학이 끼면 유동이 25% 빠집니다." },
      sales: { title: "동종업계 매출", text: "카공 허용 카페의 객단가 5,100원, 체류 2.8시간. 회전형 카페는 객단가는 같고 체류만 짧습니다." },
      wage: { title: "인근 시급 시세", text: "시급 10,300원. 같은 학교 학생 알바 지원이 많아 채용은 쉽습니다." },
    },
  },
  {
    id: "gangdong",
    // 주거 상권 — 등원길과 브런치, 하교 간식. 저녁은 집밥의 시간이다.
    phases: [
      { id: "morning", until: 660, label: "SCHOOL RUN", korean: "등원길 커피", rate: 4 },
      { id: "lunchbreak", until: 780, label: "HOME LUNCH", korean: "점심 식사 중", rate: 7 },
      { id: "brunch", until: 960, label: "STROLLER HOUR", korean: "유모차 브런치", rate: 3, busy: true },
      { id: "snack", until: 1140, label: "AFTER SCHOOL", korean: "하교 간식 시간", rate: 4 },
      { id: "evening", until: 1441, label: "DINNER AT HOME", korean: "저녁 한산", rate: 7 },
    ],
    weekendPhases: [
      { id: "walk", until: 720, label: "MORNING WALK", korean: "주말 아침 산책", rate: 4 },
      { id: "brunch", until: 960, label: "FAMILY BRUNCH", korean: "가족 브런치", rate: 2.8, busy: true },
      { id: "afternoon", until: 1200, label: "SLOW TOWN", korean: "동네의 오후", rate: 4.5 },
      { id: "evening", until: 1441, label: "QUIET EVE", korean: "저녁", rate: 6 },
    ],
    number: "05",
    name: "강동 주거단지",
    shortName: "강동",
    tagline: "낮은 월세, 유모차와 배달의 동네",
    description: "대단지 아파트 상가. 오전 브런치 주민과 오후 유모차 부대, 저녁엔 디저트 배달이 돈다. 화려하지 않지만 재방문이 쌓이는 동네.",
    traffic: [22, 40, 46, 42, 55, 64, 58, 62, 70, 66, 60, 72, 85, 100, 80, 58, 40],
    mix: { office_worker: 10, cafe_studier: 10, mz_hotple: 6, local_resident: 52, delivery_customer: 22 },
    lease: { deposit: 1800, keyMoney: 800, monthlyRent: 190, fitout: 600 },
    hourlyWage: 10030,
    weekday: 0.95,
    weekend: 1.3,
    competition: 52,
    deliveryDemand: 88,
    visibility: 60,
    color: "#3a8d5a",
    icon: "⌂",
    tags: ["주민", "디저트", "배달", "재방문"],
    warning: "첫 달 화제성은 없습니다. 일관된 맛과 청결이 유일한 마케팅입니다.",
    research: {
      rent: { title: "부동산 시세", text: "단지 상가 1층 보증금 1,800 · 월세 190. 5개 상권 중 고정비가 가장 가볍습니다." },
      sales: { title: "동종업계 매출", text: "주거상권 카페 월매출 중앙값 1,100. 디저트·배달 병행 매장은 1,600까지 올라갑니다." },
      wage: { title: "인근 시급 시세", text: "시급 10,030원(최저시급). 오전 주부 알바 지원이 꾸준합니다." },
    },
  },
];

// 카페 유형 — 좌석·제조력·고용 구조를 통째로 바꾼다.
export const FORMATS = [
  {
    id: "solo_cafe", name: "1인 카페", icon: "◉",
    description: "사장 혼자 모든 것을 한다. 인건비 제로, 대신 당신의 손이 느려지면 가게 전체가 느려진다.",
    setupCost: 800, seats: 8, staff: 1, stay: 35, capacity: 3.5, spend: 1.0, pyeong: 8,
    channel: { dine: 0.85, takeout: 1.3, delivery: 0.6 }, wait: 0.85,
    hires: [],
    tags: ["테이크아웃", "소자본"], risk: "사장이 지치면 대체 인력이 없습니다. 돌발 상황에 가장 취약합니다.",
  },
  {
    id: "specialty_cafe", name: "스페셜티 카페", icon: "◆",
    description: "바리스타를 고용해 커피 퀄리티로 승부한다. 핸드드립과 시그니처가 무기.",
    setupCost: 1600, seats: 18, staff: 2, stay: 45, capacity: 5.5, spend: 1.15, pyeong: 12,
    channel: { dine: 1.1, takeout: 1.0, delivery: 0.7 }, wait: 1.0,
    hires: [
      { role: "바리스타", wageMultiplier: 1.15, hours: 10 },
      { role: "홀 알바", wageMultiplier: 1.0, hours: 8 },
      { role: "홀 알바", wageMultiplier: 1.0, hours: 5 },
    ],
    tags: ["커피", "공간"], risk: "직원 인건비가 매일 나갑니다. 조용한 날에도 시급은 흐릅니다.",
  },
  {
    id: "bakery_cafe", name: "베이커리 카페", icon: "❖",
    description: "베이커를 두고 매일 아침 직접 굽는다. 평수의 절반은 주방 몫이라 좌석은 스페셜티급 — 대신 객단가와 마진이 크다.",
    // 18평이어도 오븐·발효기·작업대가 절반을 먹는다 — 좌석은 스페셜티와 비슷하다
    setupCost: 2600, seats: 18, staff: 3, stay: 55, capacity: 7, spend: 1.3, pyeong: 18,
    // 좌석은 적어도 빵은 들고 나간다 — 베이커리 매출의 절반은 테이크아웃이다
    channel: { dine: 0.9, takeout: 1.55, delivery: 0.9 }, wait: 1.1,
    hires: [
      { role: "베이커", wageMultiplier: 1.35, hours: 8 },
      { role: "홀 알바", wageMultiplier: 1.0, hours: 7 },
    ],
    bakes: true,
    tags: ["베이커리", "객단가"], risk: "빵이 안 팔리면 폐기, 잘 팔리면 품절. 굽는 양의 예측이 수익을 좌우합니다.",
  },
];

// 메뉴 — bean:true는 원두 등급의 원가·품질을 따르고, caseItem:true는 쇼케이스 재고제.
export const MENUS = [
  { id: "americano", name: "아메리카노", icon: "●", price: 0.45, foodCost: 0.3, cook: 2, delivery: 0.6, complexity: 1, quality: 0.78, bean: true, tags: ["모닝", "점심후", "테이크아웃", "속도", "익숙함"] },
  { id: "latte", name: "카페라떼", icon: "◍", price: 0.55, foodCost: 0.32, cook: 3, delivery: 0.55, complexity: 2, quality: 0.8, bean: true, milk: true, tags: ["모닝", "점심후", "익숙함", "부드러움"] },
  { id: "signature", name: "시그니처 크림라떼", icon: "❋", price: 0.68, foodCost: 0.34, cook: 4.5, delivery: 0.5, complexity: 3, quality: 0.84, bean: true, milk: true, tags: ["인스타", "비주얼", "새로움", "달콤함", "저녁"] },
  { id: "drip", name: "핸드드립 싱글오리진", icon: "◭", price: 0.75, foodCost: 0.36, cook: 6, delivery: 0.4, complexity: 3, quality: 0.9, bean: true, tags: ["커피애호", "오후", "조용함", "새로움"] },
  { id: "ade", name: "수제청 에이드", icon: "◔", price: 0.6, foodCost: 0.2, cook: 3, delivery: 0.8, complexity: 1, quality: 0.74, tags: ["오후", "달콤함", "비주얼", "테이크아웃", "여름"] },
  { id: "cheesecake", name: "바스크 치즈케이크", icon: "▲", price: 0.68, foodCost: 0.26, cook: 1, delivery: 0.85, complexity: 1, quality: 0.82, caseItem: true, tags: ["디저트", "달콤함", "인스타", "저녁", "커플"] },
  { id: "croissant", name: "갓 구운 크루아상", icon: "☾", price: 0.48, foodCost: 0.2, cook: 1, delivery: 0.7, complexity: 2, quality: 0.86, caseItem: true, bakeryOnly: true, tags: ["모닝", "베이커리", "버터", "비주얼"] },
  { id: "saltbread", name: "소금빵", icon: "◗", price: 0.38, foodCost: 0.17, cook: 1, delivery: 0.75, complexity: 2, quality: 0.88, caseItem: true, bakeryOnly: true, tags: ["베이커리", "인스타", "웨이팅", "품절주의"] },
  { id: "cookie", name: "수제 쿠키", icon: "✦", price: 0.35, foodCost: 0.22, cook: 1, delivery: 0.9, complexity: 1, quality: 0.76, caseItem: true, tags: ["디저트", "달콤함", "테이크아웃", "익숙함"] },
  { id: "tea", name: "티 블렌드", icon: "♨", price: 0.55, foodCost: 0.18, cook: 2, delivery: 0.7, complexity: 1, quality: 0.8, tags: ["오후", "조용함", "새로움", "부드러움"] },
];

export const CUSTOMERS = [
  {
    id: "office_worker", name: "테이크아웃 직장인", short: "직장인", color: "#3a7ba8",
    budget: { min: 0.35, preferred: 0.55, max: 0.85 }, wait: 6, stayFactor: 0.5,
    channels: ["dine", "takeout"], tags: ["모닝", "점심후", "테이크아웃", "속도", "익숙함"],
    priorities: { speed: 1.5, value: 1.0, atmosphere: 0.4, delivery: 0 },
  },
  {
    id: "cafe_studier", name: "카공족·스터디", short: "카공족", color: "#d34b42",
    budget: { min: 0.35, preferred: 0.5, max: 0.75 }, wait: 12, stayFactor: 2.8,
    channels: ["dine"], tags: ["카공", "오후", "조용함", "가성비", "콘센트"],
    priorities: { speed: 0.7, value: 1.4, atmosphere: 1.1, delivery: 0 },
  },
  {
    id: "mz_hotple", name: "MZ 카페투어", short: "MZ", color: "#df7a30",
    budget: { min: 0.55, preferred: 0.9, max: 1.5 }, wait: 18, stayFactor: 1.1,
    channels: ["dine", "takeout"], tags: ["인스타", "비주얼", "새로움", "시그니처", "달콤함", "디저트"],
    priorities: { speed: 0.6, value: 0.7, atmosphere: 1.5, delivery: 0 },
  },
  {
    id: "local_resident", name: "동네 주민", short: "주민", color: "#438a5b",
    budget: { min: 0.4, preferred: 0.65, max: 1.1 }, wait: 14, stayFactor: 1.2,
    channels: ["dine", "delivery"], tags: ["익숙함", "디저트", "부드러움", "저녁", "베이커리"],
    priorities: { speed: 0.75, value: 1.2, atmosphere: 0.85, delivery: 1.0 },
  },
  {
    id: "delivery_customer", name: "홈카페 배달 고객", short: "배달", color: "#8362b1",
    budget: { min: 0.7, preferred: 1.1, max: 1.8 }, wait: 35, stayFactor: 1,
    channels: ["delivery"], tags: ["배달", "달콤함", "디저트", "세트"],
    priorities: { speed: 0.75, value: 1.1, atmosphere: 0, delivery: 1.6 },
  },
];

export const MARKETING = [
  { id: "short_video", type: "marketing", icon: "▶", name: "릴스·숏폼 광고", description: "MZ·카페투어 인지도를 빠르게 올리지만 실망도 더 크게 퍼집니다.", cost: 55, days: 2, targets: ["mz_hotple", "cafe_studier"], awareness: 0.28, demand: 1.32, reviewSpread: 1.5 },
  { id: "local_flyer", type: "marketing", icon: "▤", name: "오피스·아파트 전단지", description: "인근 직장인과 주민에게 오픈 소식과 쿠폰을 직접 알립니다.", cost: 18, days: 1, targets: ["office_worker", "local_resident"], awareness: 0.18, demand: 1.18 },
  { id: "sidewalk_sign", type: "upgrade", icon: "△", name: "입간판·메뉴 보드", description: "지나가는 사람에게 시그니처와 가격을 보여 입장 전환을 높입니다.", cost: 35, days: 99, targets: ["office_worker", "cafe_studier", "local_resident", "mz_hotple"], awareness: 0.08, conversion: 0.16 },
  { id: "map_review", type: "marketing", icon: "⌖", name: "지도·리뷰 정비", description: "검색 의도가 높은 고객을 천천히 쌓고 좋은 리뷰의 효과를 키웁니다.", cost: 30, days: 4, targets: ["office_worker", "local_resident", "mz_hotple"], awareness: 0.1, demand: 1.1, reviewGain: 1.25 },
  { id: "delivery_coupon", type: "marketing", icon: "▣", name: "배달앱 할인·상단 노출", description: "커피·디저트 세트 주문이 늘지만 할인과 플랫폼 비용이 추가됩니다.", cost: 60, days: 2, targets: ["delivery_customer", "cafe_studier"], awareness: 0.08, demand: 1.48, discount: 0.1 },
];

export const OPERATIONS_ACTIONS = [
  { id: "lunch_prep", type: "upgrade", icon: "↯", name: "오픈 프렙 루틴", description: "시럽·우유·원두를 미리 세팅해 모든 제조시간 -18%. 폐기 위험은 조금 증가합니다.", cost: 42, days: 99, effects: { cookSpeed: 1.18, waste: 0.04 } },
  { id: "part_timer", type: "upgrade", icon: "+1", name: "피크타임 알바 추가", description: "러시 시간대 제조·홀 처리능력 +22%. 매일 시급과 퇴직금 적립이 나갑니다.", cost: 12, days: 99, effects: { capacity: 1.22, dailyLabor: 7 } },
  { id: "kitchen_upgrade", type: "upgrade", icon: "⚙", name: "하이엔드 머신 리스", description: "2그룹 머신과 자동 탬핑. 제조능력 +28%, 샷 품질 편차가 줄어듭니다.", cost: 180, days: 99, effects: { capacity: 1.28, quality: 0.03 } },
  { id: "value_set", type: "upgrade", icon: "₩", name: "세트 구성 재설계", description: "커피+디저트 세트로 평균 가격 -8%, 가격가치 평가는 크게 좋아집니다.", cost: 8, days: 99, effects: { price: 0.92, value: 0.12 } },
  { id: "clean_routine", type: "upgrade", icon: "✦", name: "마감 청결 루틴", description: "머신·쇼케이스 위생 하락을 줄이고 주민·MZ 손님의 신뢰를 높입니다.", cost: 16, days: 99, effects: { hygiene: 0.1 } },
];

export const ALL_ACTIONS = [...OPERATIONS_ACTIONS, ...MARKETING];

export const FEEDBACK = {
  wait: {
    positive: ["주문하자마자 나와서 놀랐어요.", "러시 시간인데 회전이 빨라요.", "바리스타 동선이 군더더기 없네요."],
    negative: ["커피 한 잔에 15분은 너무해요.", "점심시간이 줄에서 다 갔어요.", "다음엔 줄 보고 그냥 지나갈래요."],
  },
  value: {
    positive: ["이 가격에 이 맛이면 매일 오죠.", "세트 구성이 합리적이에요.", "동네 시세 대비 착한 가격이에요."],
    negative: ["아메리카노가 이 가격이라고요?", "맛은 있는데 가격표가 더 커 보여요.", "옆 골목이 500원 더 싸요."],
  },
  taste: {
    positive: ["샷이 살아 있네요. 원두가 좋아요.", "라떼 밸런스가 정확해요.", "시그니처는 여기가 제일이에요."],
    negative: ["샷이 탔는지 쓴맛만 나요.", "우유 스팀이 미지근해요.", "원두 바꿨어요? 예전 맛이 아니에요."],
  },
  delivery: {
    positive: ["얼음이 안 녹고 도착했어요.", "포장이 꼼꼼해서 케이크가 멀쩡해요.", "홈카페 세트로 최고예요."],
    negative: ["도착하니 크림이 다 가라앉았어요.", "케이크가 기울어져 왔어요.", "할인받아도 이 상태면 고민되네요."],
  },
  atmosphere: {
    positive: ["조용해서 작업하기 좋아요.", "조명과 음악 선곡이 취향이에요.", "사진이 잘 나오는 자리가 많아요."],
    negative: ["자리가 좁아서 오래 못 있겠어요.", "테이블이 안 치워져 있어요.", "너무 시끄러워서 대화가 안 돼요."],
  },
  price_reject: ["이 가격이면 프랜차이즈 갈래요.", "오늘 예산엔 조금 비싸네요.", "가격 보고 발길을 돌렸어요."],
  no_interest: ["지금은 커피 생각이 없어요.", "찾던 스타일의 카페가 아니에요.", "간판만 봐선 뭐 하는 집인지 모르겠어요."],
  full: ["자리가 없네요. 다음에 올게요.", "웨이팅까지 하긴 좀…", "만석이라 옆 카페로 갈게요."],
};

export const REGULAR_NAMES = ["김대리", "박작가", "은지님", "3층 교수님", "유모차 단골", "새벽 러너"];

export const WEATHER = [
  { id: "clear", icon: "☀", name: "맑음", footfall: 1.0, delivery: 1.0 },
  { id: "cloudy", icon: "◌", name: "흐림", footfall: 0.93, delivery: 1.05 },
  { id: "rain", icon: "☂", name: "비", footfall: 0.72, delivery: 1.34 },
  { id: "hot", icon: "♨", name: "무더위", footfall: 0.84, delivery: 1.15 },
];

export const DAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"];

export function getById(collection, id) {
  return collection.find((item) => item.id === id);
}

// ── 12개월 캠페인 ────────────────────────────────────────────
// 카페 매출은 계절을 심하게 탄다. 여름 아이스 성수기와 겨울 비수기,
// 대학가의 방학 공동화가 월 단위 경영의 핵심 변수다.

export const MONTHS = [
  { n: 1, name: "1월", weekdays: 22, weekends: 9, season: 0.86, note: "한파와 신년 절약. 1년 중 가장 추운 매출." },
  { n: 2, name: "2월", weekdays: 20, weekends: 8, season: 0.88, note: "짧은 달과 설 연휴. 오피스 상권이 비어요." },
  { n: 3, name: "3월", weekdays: 22, weekends: 9, season: 1.0, note: "개강과 신학기. 대학가가 살아납니다." },
  { n: 4, name: "4월", weekdays: 22, weekends: 8, season: 1.06, note: "봄나들이. 주말 유동이 늘어납니다." },
  { n: 5, name: "5월", weekdays: 21, weekends: 10, season: 1.12, note: "가정의 달 성수기. 디저트가 잘 나갑니다." },
  { n: 6, name: "6월", weekdays: 22, weekends: 8, season: 1.04, note: "장마 시작. 배달 비중이 올라갑니다." },
  { n: 7, name: "7월", weekdays: 23, weekends: 8, season: 1.16, note: "아이스 음료 폭발. 원가율도 함께 오릅니다." },
  { n: 8, name: "8월", weekdays: 21, weekends: 10, season: 1.2, note: "폭염 최고 성수기. 다만 휴가철 공동화 주의." },
  { n: 9, name: "9월", weekdays: 22, weekends: 8, season: 1.0, note: "2학기 개강. 평년 수준으로 복귀." },
  { n: 10, name: "10월", weekdays: 22, weekends: 9, season: 1.08, note: "선선한 날씨. 체류 시간이 길어집니다." },
  { n: 11, name: "11월", weekdays: 21, weekends: 9, season: 0.96, note: "비수기 진입. 따뜻한 음료로 전환됩니다." },
  { n: 12, name: "12월", weekdays: 22, weekends: 9, season: 1.1, note: "연말 모임과 선물 수요. 마지막 승부처." },
];

// 상권별 계절 보정 — 대학가는 방학에, 오피스는 휴가철에 비워진다.
export const SEASON_OVERRIDES = {
  sinchon: { 1: 0.66, 2: 0.68, 7: 0.72, 8: 0.7, 12: 0.86 },
  gangnam: { 8: 0.86, 1: 0.94 },
  seongsu: { 1: 0.8, 7: 1.24, 8: 1.28 },
  euljiro: { 1: 0.84, 8: 1.1, 12: 1.2 },
  gangdong: { 8: 1.1, 1: 0.92 },
};

// 사업자 유형 — 연말정산에서 세금 구조가 완전히 갈린다.
export const BUSINESS_TYPES = [
  {
    id: "sole", name: "개인사업자", icon: "◑",
    description: "설립이 간단하고 초기 비용이 없습니다. 세율은 이익에 따라 6%에서 45%까지 올라갑니다.",
    advice: "연 이익 8,800만원 아래라면 대개 이쪽이 유리합니다. 첫 해에는 보통 여기서 시작합니다.",
    setupCost: 0, annualKeeping: 60,
  },
  {
    id: "corp", name: "법인사업자", icon: "◈",
    description: "세율이 2억까지 9%로 평평합니다. 대신 설립비와 매년 기장료가 나갑니다.",
    advice: "연 이익 8,800만원을 넘길 자신이 있을 때 유리합니다. 그 아래면 기장료 때문에 오히려 손해입니다.",
    setupCost: 120, annualKeeping: 240,
  },
];

// 종합소득세 누진세율 (과세표준, 세율, 누진공제) — 단위 만원
export const INCOME_TAX_BRACKETS = [
  { upTo: 1400, rate: 0.06, deduct: 0 },
  { upTo: 5000, rate: 0.15, deduct: 126 },
  { upTo: 8800, rate: 0.24, deduct: 576 },
  { upTo: 15000, rate: 0.35, deduct: 1544 },
  { upTo: 30000, rate: 0.38, deduct: 1994 },
  { upTo: 50000, rate: 0.4, deduct: 2594 },
  { upTo: 100000, rate: 0.42, deduct: 3594 },
  { upTo: Infinity, rate: 0.45, deduct: 6594 },
];

// 법인세 (과세표준, 세율, 누진공제) — 단위 만원
export const CORPORATE_TAX_BRACKETS = [
  { upTo: 20000, rate: 0.09, deduct: 0 },
  { upTo: 2000000, rate: 0.19, deduct: 2000 },
  { upTo: Infinity, rate: 0.21, deduct: 42000 },
];

// 월 단위로만 나가는 비용 — 일 단위 시뮬레이션에는 없던 현실의 청구서
export const MONTHLY_RATES = {
  insurance: 0.096,   // 4대보험 사업자 부담 (인건비 대비)
  severance: 0.083,   // 퇴직금 적립 (인건비 대비, 1개월/12개월)
  cardFee: 0.015,     // 카드 결제 수수료 (실매출 대비)
  supplies: 0.05,     // 소모품·포장재·머신 점검 적립을 하나로 (실매출 대비)
};

// 배달 중개·결제 수수료. 국내 배달앱의 중개이용료(최대 7.8%)와
// 결제정산이용료(약 3%)를 합친 값을 게임용으로 정규화했다.
export const DELIVERY_COMMISSION = 0.108;

// ── 사장의 자리 ──────────────────────────────────────────────
// 이 게임의 코어 루프는 한 문장이다: "지금 사장은 어디에 서 있어야 하는가."
// 세 자리는 서로를 대체할 수 없고, 옮기는 데에도 시간이 든다.

export const OWNER_STATIONS = [
  {
    id: "bar", name: "키친", smallName: "바", icon: "☕", key: "1",
    short: "직접 만든다",
    description: "제조 속도 +40%. 여기 있어야만 커피를 내리고 쇼케이스를 채울 수 있습니다.",
    effects: { cookSpeed: 1.4 },
  },
  {
    id: "hall", name: "홀", icon: "🧹", key: "2",
    short: "치우고 자리를 돌린다",
    description: "여기 있어야만 테이블을 치울 수 있습니다. 좌석 회전이 살아나고 청결이 유지됩니다.",
    effects: { busing: true, hygiene: 0.06 },
  },
  {
    id: "door", name: "입구", icon: "🚪", key: "3",
    short: "손님을 데려온다",
    description: "지나가는 사람에게 말을 걸고 전단지를 건넵니다. 인지도가 오르고 줄 선 손님도 덜 지칩니다.",
    effects: { awareness: 0.22, patience: 1.25, flyer: true },
  },
];

// 인력 편성 — 인건비가 감당이 안 될 때 쓰는 레버.
// 직원 시간을 깎으면 인건비는 바로 줄지만, 그 시간을 사장이 대신 메워야 한다.
// 공짜가 아니다. 줄인 만큼 사장의 하루가 길어지고, 연말에 시급으로 청구된다.
export const STAFFING_PLANS = [
  {
    id: "full", name: "지금 인원 그대로", icon: "◉",
    description: "직원 시간을 건드리지 않습니다. 사장은 정해진 시간만 나옵니다.",
    staffScale: 1, ownerExtraHours: 0, staffLoss: 0,
  },
  {
    id: "trim", name: "직원 시간 20% 감축", icon: "◐",
    description: "알바 시간을 줄이고 사장이 하루 2시간 더 나옵니다. 홀이 조금 헐거워집니다.",
    staffScale: 0.8, ownerExtraHours: 2, staffLoss: 0,
  },
  {
    id: "lean", name: "한 명 줄이고 사장이 메운다", icon: "○",
    description: "인건비를 크게 덜지만 홀 인원이 한 명 사라집니다. 사장이 하루 4시간 더 나옵니다.",
    staffScale: 0.62, ownerExtraHours: 4, staffLoss: 1,
  },
];

export const STATION_MOVE_MINUTES = 2;  // 자리를 옮기는 데 걸리는 시간

// 매니저는 사장을 대신할 수 있지만, 사장만큼 빠르지는 않다.
export const MANAGER_CLEAN_MINUTES = 8;    // 사장은 3분이면 끝낸다
export const MANAGER_WEAR_LIMIT = 0.45;    // 사장은 0.25에서 이미 손을 댄다
export const MANAGER_NOTICE_MINUTES = 25;  // 품절을 알아채기까지 걸리는 시간
export const MANAGER_LEAD_MINUTES = 20;    // 그만큼 발주 도착도 늦어진다

// ── 월별 시그니처 이벤트 ─────────────────────────────────────
// 리포트만 반복되지 않도록, 달마다 성격이 다른 사건이 온다.
// effects는 그 달 전체(수요·배달·인내심·객단가)에 적용된다.

export const MONTH_EVENTS = [
  {
    id: "new_year_diet", month: 1, title: "신년 다이어트", icon: "❄",
    situation: "1월입니다. 다들 케이크 대신 아메리카노만 시킵니다. 거리도 춥고 사람이 안 나옵니다.",
    effects: { demand: 0.9, dessert: 0.7 },
    choice: {
      prompt: "디저트가 안 나갑니다. 어떻게 할까요?",
      options: [
        { id: "low_cal", name: "저칼로리 메뉴로 전환", detail: "디저트 수요 회복. 대신 재료 원가가 8% 오릅니다.", effects: { dessert: 1.15, foodCost: 1.08 } },
        { id: "cut_case", name: "쇼케이스를 줄인다", detail: "폐기를 줄여 원가를 낮춥니다. 디저트 매출은 포기합니다.", effects: { dessert: 0.55, foodCost: 0.9 } },
      ],
    },
  },
  {
    id: "heavy_snow", month: 1, title: "폭설 경보", icon: "☃", chance: 0.5,
    situation: "밤사이 눈이 20cm 쌓였습니다. 거리는 텅 비었고, 배달 기사들도 콜을 안 받습니다.",
    effects: { demand: 0.62, delivery: 0.35 },
    choice: {
      prompt: "눈이 그치지 않습니다.",
      options: [
        { id: "shovel", name: "가게 앞을 직접 치운다", detail: "비용 없음 · 우리 가게 앞만은 걸을 수 있게 됩니다. 수요 일부 회복.", effects: { demand: 1.22 } },
        { id: "close_early", name: "일찍 닫는다", detail: "인건비를 아낍니다. 오늘 매출은 포기합니다.", effects: { demand: 0.75, labor: 0.7 } },
      ],
    },
  },
  {
    id: "seollal", month: 2, title: "설 연휴", icon: "🏮",
    situation: "설 연휴 5일. 오피스 상권은 유령도시가 되고, 주거 상권은 오히려 붐빕니다.",
    effects: { demand: 0.92, officeShift: true },
  },
  {
    id: "semester_start", month: 3, title: "개강", icon: "🎒",
    situation: "대학가에 사람이 돌아왔습니다. 노트북을 든 학생들이 자리를 찾아 돌아다닙니다.",
    effects: { demand: 1.08, studier: 1.35 },
    choice: {
      prompt: "카공족이 몰려옵니다.",
      options: [
        { id: "welcome", name: "콘센트를 늘린다", detail: "학생 수요 +. 대신 좌석 회전이 느려집니다.", effects: { studier: 1.3, stay: 1.25 } },
        { id: "turnover", name: "회전 중심으로 간다", detail: "테이크아웃 할인. 체류는 줄고 객단가도 줄어듭니다.", effects: { stay: 0.7, spend: 0.92 } },
      ],
    },
  },
  {
    id: "cherry_blossom", month: 4, title: "벚꽃 시즌", icon: "🌸",
    situation: "벚꽃이 피었습니다. 주말 거리가 사람으로 가득 차고, 다들 손에 음료를 들고 사진을 찍습니다.",
    effects: { demand: 1.32, weekend: 1.5, takeout: 1.4, spend: 1.08 },
    choice: {
      prompt: "1년에 2주뿐인 대목입니다.",
      options: [
        { id: "seasonal", name: "벚꽃 시즌 메뉴를 낸다", detail: "비용 ₩600,000 · 객단가와 SNS 확산이 크게 오릅니다.", cost: 60, effects: { spend: 1.18, awareness: 0.3 } },
        { id: "capacity", name: "알바를 더 쓴다", detail: "비용 ₩900,000 · 처리능력을 올려 줄을 흘려보냅니다.", cost: 90, effects: { capacity: 1.3 } },
        { id: "nothing", name: "평소대로 간다", detail: "추가 비용 없이 갑니다. 대신 대목의 절반은 줄에서 새어나갑니다.", effects: {} },
      ],
    },
  },
  {
    id: "family_month", month: 5, title: "가정의 달", icon: "🎁",
    situation: "어버이날과 스승의날. 케이크와 기프트 세트 문의가 계속 들어옵니다.",
    effects: { demand: 1.14, dessert: 1.4 },
    choice: {
      prompt: "선물 수요를 잡을까요?",
      options: [
        { id: "gift_set", name: "기프트 세트를 만든다", detail: "비용 ₩500,000 · 디저트 매출이 크게 오릅니다.", cost: 50, effects: { dessert: 1.5, spend: 1.12 } },
        { id: "skip", name: "평소 메뉴만 판다", detail: "준비 부담 없이 갑니다.", effects: {} },
      ],
    },
  },
  {
    id: "monsoon", month: 6, title: "장마", icon: "🌧",
    situation: "2주째 비가 옵니다. 우산 든 사람들은 카페 앞을 그냥 지나가고, 배달앱만 계속 울립니다.",
    effects: { demand: 0.74, delivery: 1.6, takeout: 0.8 },
    choice: {
      prompt: "홀은 비었고 배달은 밀립니다.",
      options: [
        { id: "delivery_push", name: "배달에 올인한다", detail: "비용 ₩700,000 · 배달 수요 +40%. 플랫폼 수수료도 그만큼 나갑니다.", cost: 70, effects: { delivery: 1.4, platform: 1.15 } },
        { id: "rainy_seat", name: "비 오는 날 할인으로 홀을 채운다", detail: "객단가는 내려가지만 빈 좌석이 줄어듭니다.", effects: { demand: 1.18, spend: 0.88 } },
      ],
    },
  },
  {
    id: "heatwave", month: 7, title: "폭염 경보", icon: "🔥",
    situation: "체감온도 37도. 아이스 음료만 나가고, 사람들은 에어컨 있는 곳에서 안 나갑니다.",
    effects: { demand: 1.18, iced: 1.6, stay: 1.3, utility: 1.35 },
    choice: {
      prompt: "전기요금이 무섭습니다.",
      options: [
        { id: "cool_hard", name: "에어컨을 세게 튼다", detail: "공과금 +35%. 손님이 오래 머물고 만족도가 오릅니다.", effects: { utility: 1.35, satisfaction: 0.05 } },
        { id: "save_power", name: "적당히 튼다", detail: "공과금을 아낍니다. 더워서 나가는 손님이 생깁니다.", effects: { utility: 1.0, satisfaction: -0.06 } },
      ],
    },
  },
  {
    id: "vacation", month: 8, title: "휴가철 공동화", icon: "🏖",
    situation: "오피스 상권은 텅 비고 대학가는 방학입니다. 반대로 나들이 상권은 사람이 넘칩니다.",
    effects: { demand: 1.05, vacationSplit: true },
  },
  {
    id: "chuseok", month: 9, title: "추석 연휴", icon: "🌕",
    situation: "추석입니다. 5일 동안 도시가 비고, 연휴가 끝나면 사람들이 한꺼번에 돌아옵니다.",
    effects: { demand: 0.88 },
    choice: {
      prompt: "연휴에 문을 열까요?",
      options: [
        { id: "open_holiday", name: "연휴에도 연다", detail: "인건비 +25%(휴일수당). 문 연 카페가 우리뿐이라 수요를 독점합니다.", effects: { demand: 1.35, labor: 1.25 } },
        { id: "rest", name: "쉰다", detail: "인건비 −30%. 매출도 그만큼 없습니다.", effects: { demand: 0.7, labor: 0.7 } },
      ],
    },
  },
  {
    id: "festival", month: 10, title: "동네 축제", icon: "🎪",
    situation: "주말 이틀간 거리 축제가 열립니다. 평소의 세 배가 지나가지만, 대부분 그냥 지나갑니다.",
    effects: { demand: 1.26, weekend: 1.4, awarenessHard: true },
    choice: {
      prompt: "사람은 많은데 우리 가게로는 안 들어옵니다.",
      options: [
        { id: "stall", name: "가게 앞에 부스를 낸다", detail: "비용 ₩800,000 · 지나가는 사람을 직접 잡습니다.", cost: 80, effects: { awareness: 0.4, capacity: 1.15 } },
        { id: "inside", name: "매장 안에 집중한다", detail: "추가 비용 없음. 축제 인파는 대부분 흘려보냅니다.", effects: {} },
      ],
    },
  },
  {
    id: "suneung", month: 11, title: "수능", icon: "✏",
    situation: "수능 시즌입니다. 대학가는 조용해지고, 대신 응원 선물 수요가 생깁니다.",
    effects: { demand: 0.94, studier: 0.7, dessert: 1.2 },
  },
  {
    id: "year_end", month: 12, title: "연말 모임", icon: "🎄",
    situation: "12월입니다. 송년 모임과 선물 수요가 몰리고, 거리에는 조명이 켜집니다.",
    effects: { demand: 1.16, weekend: 1.25, spend: 1.1, dessert: 1.3 },
    choice: {
      prompt: "1년의 마지막 대목입니다.",
      options: [
        { id: "decorate", name: "매장을 크리스마스로 꾸민다", detail: "비용 ₩700,000 · 인지도와 객단가가 함께 오릅니다.", cost: 70, effects: { awareness: 0.32, spend: 1.12 } },
        { id: "quiet", name: "조용히 마무리한다", detail: "비용을 아끼고 연말정산을 준비합니다.", effects: {} },
      ],
    },
  },
];

export function eventsForMonth(monthNumber, seed = 0, districtId = null) {
  return MONTH_EVENTS.filter((event) => {
    if (event.month !== monthNumber) return false;
    if (event.districts && districtId && !event.districts.includes(districtId)) return false;
    if (event.chance === undefined) return true;
    // 확률 이벤트는 시드로 고정해 같은 판에서 항상 같게 나온다
    return ((seed * 9301 + monthNumber * 49297) % 233280) / 233280 < event.chance;
  });
}

// ── 엔딩 ────────────────────────────────────────────────────
// 랜딩에서 "어떤 사장이 될 건가"를 물었으니, 12월에 그 답을 돌려준다.
// 두 축: 얼마를 벌었나(연 순이익) × 내 시간을 지켰나(연 노동시간).

export const MONEY_LINE = 4000;   // 만원 — 이 위면 "대표님" 소리를 듣는다
export const TIME_LINE = 2000;    // 시간 — 주 40시간 × 50주. 이 아래면 삶이 있다

export const ENDINGS = [
  {
    id: "tycoon", name: "떼돈 버는 대표님", icon: "👑",
    tagline: "돈도 벌고 시간도 지켰습니다.",
    body: "직원이 돌아가는 시스템을 만들었고, 사장은 필요한 순간에만 들어갔습니다. 2호점 이야기를 꺼내도 되는 자리입니다.",
    rare: true,
  },
  {
    id: "chill", name: "여유로운 동네 사장", icon: "🌿",
    tagline: "크게 벌진 않았지만, 하루가 내 것이었습니다.",
    body: "월세 내고 직원 월급 주고 조금 남았습니다. 대신 저녁이 있었고 단골 이름을 다 압니다. 많은 사람이 진짜로 원하는 결말입니다.",
  },
  {
    id: "burnout", name: "번아웃 사장님", icon: "🔥",
    tagline: "돈은 벌었는데, 1년을 통째로 갈아 넣었습니다.",
    body: "통장은 두둑합니다. 다만 그 시간에 다른 걸 했다면 어땠을까 하는 생각이 자꾸 듭니다. 이 상태로 2년은 못 갑니다.",
  },
  {
    id: "reality", name: "자영업의 현실", icon: "☕",
    tagline: "쉬지도 못했고, 남지도 않았습니다.",
    body: "가장 흔한 결말입니다. 나쁜 사장이어서가 아니라 상권·구조·인건비가 그렇게 짜여 있었기 때문입니다. 다시 하면 다르게 할 수 있습니다.",
  },
  {
    id: "closed", name: "폐업 정리", icon: "🔒",
    tagline: "1년을 일하고 돈을 냈습니다.",
    body: "보증금으로 밀린 것들을 정리했습니다. 흔한 일이고, 당신 탓만은 아닙니다. 상권을 바꾸거나 유형을 바꾸면 결과는 완전히 달라집니다.",
  },
];

export function endingFor({ netProfit, ownerHours }) {
  if (netProfit <= 0) return getById(ENDINGS, "closed");
  const rich = netProfit >= MONEY_LINE;
  const free = ownerHours <= TIME_LINE;
  if (rich && free) return getById(ENDINGS, "tycoon");
  if (!rich && free) return getById(ENDINGS, "chill");
  if (rich && !free) return getById(ENDINGS, "burnout");
  return getById(ENDINGS, "reality");
}

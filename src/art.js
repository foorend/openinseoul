// 아트 레이어 — 생성 일러스트 에셋 로더 + 스프라이트 드로잉.
// 이미지가 없거나 로드 전이면 모든 헬퍼가 null/false를 돌려주고,
// 씬은 기존 procedural 렌더러로 폴백한다. (배포 안전망)
//
// 좌표 규약: 백플레이트는 1536×1024 원본이며, 씬 논리 캔버스(1200×900)의
// 기존 시뮬레이션 상수(SIDEWALK_Y=700, ROAD_Y=800, DOOR_X≈1066)에
// 이미지의 실측 밴드(인테리어 바닥 830px, 보도 830~935, 도로 935~)를
// 3분할 세로 매핑으로 맞춘다. 코드가 아니라 이미지를 상수에 맞춘다.

const FILES = {
  bg: "assets/art/bg-seongsu.webp",
  master: "assets/art/master-concept.webp",
  "district-gangnam": "assets/art/district-gangnam.webp",
  "district-euljiro": "assets/art/district-euljiro.webp",
  "district-seongsu": "assets/art/district-seongsu.webp",
  "district-sinchon": "assets/art/district-sinchon.webp",
  "district-gangdong": "assets/art/district-gangdong.webp",
  "eq-used": "assets/art/eq-used.webp",
  "eq-standard": "assets/art/eq-standard.webp",
  "eq-premium": "assets/art/eq-premium.webp",
  "mg-kitchen": "assets/art/mg-kitchen.webp",
  "mg-hall": "assets/art/mg-hall.webp",
  "mg-street": "assets/art/mg-street.webp",
  "mg-street-top": "assets/art/mg-street-top.webp",
  table: "assets/art/prop-table.webp",
  barista: "assets/art/char-barista.webp",
  owner: "assets/art/char-owner.webp",
  office: "assets/art/char-office.webp",
  student: "assets/art/char-student.webp",
  hopper: "assets/art/char-hopper.webp",
  regular: "assets/art/char-regular.webp",
  takeout: "assets/art/char-takeout.webp",
  seatedA: "assets/art/char-seated-a.webp",
  seatedB: "assets/art/char-seated-b.webp",
};

const images = {};
const trims = {};
let loaded = false;

export function loadArt() {
  if (loaded) return;
  loaded = true;
  for (const [key, src] of Object.entries(FILES)) {
    const img = new Image();
    img.onload = () => { images[key] = img; };
    img.onerror = () => { /* 없으면 procedural 폴백 */ };
    img.src = src;
  }
}

export function artImage(key) {
  return images[key] ?? null;
}

export function artReady(key) {
  return !!images[key];
}

// 투명 여백 제거 박스 — 스프라이트 발을 정확히 바닥선에 딛게 한다.
// 1회 스캔 후 캐시. (1024² 스캔은 이미지당 한 번뿐)
function trimBoxFor(key) {
  if (trims[key]) return trims[key];
  const img = images[key];
  if (!img) return null;
  const off = document.createElement("canvas");
  off.width = img.width;
  off.height = img.height;
  const octx = off.getContext("2d", { willReadFrequently: true });
  octx.drawImage(img, 0, 0);
  const data = octx.getImageData(0, 0, off.width, off.height).data;
  let minX = off.width;
  let minY = off.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < off.height; y += 2) {
    for (let x = 0; x < off.width; x += 2) {
      if (data[(y * off.width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX) return null;
  trims[key] = { x: minX, y: minY, w: maxX - minX + 2, h: maxY - minY + 2 };
  return trims[key];
}

// ── 백플레이트 매핑 (이미지 px → 논리 px) ──
const MAP = {
  sx: 109,            // 좌측 크롭
  kx: 0.926,          // 수평 스케일
  bands: [
    { sy: 0, sh: 830, dy: 0, dh: 700 },     // 하늘+간판+인테리어 → 0..700
    { sy: 830, sh: 105, dy: 700, dh: 100 }, // 보도 → 700..800
    { sy: 935, sh: 89, dy: 800, dh: 100 },  // 도로 → 800..900
  ],
};

export const ix = (x) => (x - MAP.sx) * MAP.kx;
export const iy = (y) => {
  for (const b of MAP.bands) {
    if (y <= b.sy + b.sh) return b.dy + ((y - b.sy) / b.sh) * b.dh;
  }
  return 900;
};

// 백플레이트를 3분할로 그린다 (밴드별 세로 스케일이 달라 시뮬 상수와 정렬됨)
export function drawBackplate(ctx) {
  const img = images.bg;
  if (!img) return false;
  const srcW = 1200 / MAP.kx; // 논리 1200px에 해당하는 원본 폭
  for (const b of MAP.bands) {
    ctx.drawImage(img, MAP.sx, b.sy, srcW, b.sh, 0, b.dy, 1200, b.dh);
  }
  return true;
}

// ── 씬 앵커 (이미지 px 실측값 → 논리 좌표) ──
export const ANCHOR = {
  signX: ix(262), signRight: ix(1180), signY: iy(330),
  machineX: ix(535), machineTop: iy(565),
  counterY: iy(650),
  baristaX: ix(430), baristaY: iy(770),
  hallLeft: ix(715), hallRight: ix(1185), hallFloorY: iy(795),
  doorLeft: ix(1225), doorRight: ix(1330), doorTop: iy(400), doorBottom: iy(830),
  lamps: [
    { x: ix(365), y: iy(452) }, { x: ix(568), y: iy(452) },
    { x: ix(818), y: iy(468) }, { x: ix(930), y: iy(468) },
    { x: ix(1035), y: iy(468) }, { x: ix(1132), y: iy(468) },
  ],
  sconces: [{ x: ix(185), y: iy(478) }, { x: ix(1392), y: iy(478) }],
  interior: { x: ix(232), y: iy(392), w: ix(1322) - ix(232), h: iy(830) - iy(392) },
  streetLampGlowY: iy(478),
};

// ── 스프라이트 드로잉: (x, y)=발 위치, h=목표 높이 ──
export function drawFigure(ctx, key, x, y, { h = 100, facing = 1, walking = 0, time = 0, alpha = 1, tint = null } = {}) {
  const img = images[key];
  if (!img) return false;
  const box = trimBoxFor(key);
  if (!box) return false;
  const w = (box.w / box.h) * h;
  const lean = walking ? Math.sin(time * 9) * 0.035 : 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  // 발밑 그림자
  ctx.fillStyle = "rgba(12,10,8,.24)";
  ctx.beginPath();
  ctx.ellipse(x, y + 3, w * 0.34, h * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(facing >= 0 ? 1 : -1, 1);
  ctx.drawImage(img, box.x, box.y, box.w, box.h, -w / 2, -h, w, h);
  if (tint) {
    // 사장 식별용 저강도 틴트 — 스프라이트 실루엣 위에만
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha *= 0.0; // 실루엣 클리핑이 아닌 전체 캔버스라 미사용 (링으로 대체)
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
  return true;
}

// 손님 아키타입 → 스프라이트 키
const WALK_KEYS = ["office", "student", "hopper", "regular", "takeout"];
export function figureKeyFor(agent, { seated = false } = {}) {
  const id = agent.customer?.id ?? "";
  if (id === "owner") return images.owner ? "owner" : "barista";
  if (id === "staff" || id === "baker" || id === "chef") return "barista";
  if (seated) return (agent.randomKey ?? 0) % 2 === 0 ? "seatedA" : "seatedB";
  const direct = { office: "office", student: "student", tourist: "hopper", couple: "hopper", regular: "regular", delivery: "takeout" };
  if (direct[id]) return direct[id];
  return WALK_KEYS[(agent.randomKey ?? 0) % WALK_KEYS.length];
}

// 테이블 소품 스탬프 — (x, y)=테이블 다리 접지 중심
export function drawTableProp(ctx, x, y, h = 64) {
  const img = images.table;
  if (!img) return false;
  const box = trimBoxFor("table");
  if (!box) return false;
  const w = (box.w / box.h) * h;
  ctx.save();
  ctx.fillStyle = "rgba(12,10,8,.2)";
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.42, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(img, box.x, box.y, box.w, box.h, x - w / 2, y - h, w, h);
  ctx.restore();
  return true;
}

// 커버-핏 드로잉 (이미지가 (0,0,w,h)를 꽉 채우도록 중앙 크롭)
export function coverDraw(ctx, key, w, h, { panX = 0.5, panY = 0.5, zoom = 1 } = {}) {
  const img = images[key];
  if (!img) return false;
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) * panX;
  const sy = (img.height - sh) * panY;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return true;
}

import { clamp, phaseAt } from "./sim.js";
import { figure, glowDot, grain, lightCone, vignette } from "./visuals.js";
import { loadArt, artReady, drawBackplate, drawFigure, figureKeyFor, drawTableProp, coverDraw, ANCHOR } from "./art.js";

loadArt();

const W = 1200;
const H = 900;

// 건물 배치 (썸네일과 같은 단면 컷어웨이 구도)
const STORE = { x: 96, w: 1008, signY: 296, signH: 66, floorY: 700 };
const DOOR_X = STORE.x + STORE.w - 38;
const SIDEWALK_Y = 700;
const ROAD_Y = 800;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function colorToRgb(color) {
  if (color.startsWith("rgb")) {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (channels?.length === 3) return { r: channels[0], g: channels[1], b: channels[2] };
  }
  let value = color.replace("#", "");
  if (value.length === 3) value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function mixColor(a, b, t) {
  const ca = colorToRgb(a);
  const cb = colorToRgb(b);
  const amount = clamp(t);
  return `rgb(${Math.round(lerp(ca.r, cb.r, amount))}, ${Math.round(lerp(ca.g, cb.g, amount))}, ${Math.round(lerp(ca.b, cb.b, amount))})`;
}

function roundedRect(ctx, x, y, width, height, radius = 8) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// 도트 감성의 핵심 — 캔버스를 절반 해상도로 그리고 픽셀 확대한다.
const PIXEL_DENSITY = 0.7;

function fitCanvas(canvas, store) {
  const rect = canvas.getBoundingClientRect();
  const dpr = PIXEL_DENSITY;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  const scale = Math.min(rect.width / W, rect.height / H);
  const offsetX = (rect.width - W * scale) / 2;
  const offsetY = (rect.height - H * scale) / 2;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  if (store) Object.assign(store, { scale, offsetX, offsetY });
  return ctx;
}

// ─── 시간대별 조명 ───────────────────────────────────────────

function lightingFor(gameMinute) {
  const hour = gameMinute / 60;
  const dusk = clamp((hour - 16) / 3);
  const night = clamp((hour - 18.7) / 2.6);
  return {
    hour,
    dusk,
    night,
    skyTop: mixColor(mixColor("#8fc3d4", "#4c4670", dusk), "#0e1730", night),
    skyMid: mixColor(mixColor("#c8dfd6", "#e2703d", dusk), "#232b4a", night),
    skyLow: mixColor(mixColor("#f0e2c0", "#f2b264", dusk), "#33395a", night),
    silhouette: mixColor("#9fb0b4", "#161e33", Math.max(dusk * 0.55, night)),
    building: mixColor("#7e8d95", "#1b2438", Math.max(dusk * 0.5, night)),
    ground: mixColor("#cfc8b6", "#4a4a55", night * 0.85),
    road: mixColor("#3c4043", "#1c1e26", night * 0.8),
    windowLit: 0.06 + dusk * 0.3 + night * 0.62,
  };
}

// ─── 사람 그리기 ─────────────────────────────────────────────

const SKIN_TONES = ["#f0c39a", "#e8b088", "#d9a077", "#f4cfa8"];
const HAIR_TONES = ["#241f1c", "#3a2e24", "#4a3a2a", "#1c1c22"];

function drawCharacter(ctx, agent, x, y, options = {}) {
  const { scale = 1, walking = 0, seated = false, time = 0 } = options;
  // 아트 모드 — 일러스트 스프라이트가 로드돼 있으면 벡터 대신 스프라이트를 그린다
  const spriteKey = figureKeyFor(agent, { seated });
  if (artReady(spriteKey) && artReady("bg")) {
    const rk = agent.randomKey ?? 0;
    const spriteFacing = options.facing ?? agent.facing ?? 1;
    const bob = walking ? Math.sin(time * 9 + rk) * 2 : Math.sin(time * 2 + rk) * 0.7;
    if (agent.customer?.id === "owner") {
      const pulse = 0.5 + 0.5 * Math.sin(time * 3);
      ctx.save();
      ctx.strokeStyle = `rgba(217, 164, 65, ${0.4 + pulse * 0.32})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(x, y + 3, 18 + pulse * 2, 6 + pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawFigure(ctx, spriteKey, x, y + bob, {
      h: (seated ? 150 : 200) * scale,
      facing: spriteFacing,
      walking,
      time: time + rk,
    });
    return;
  }
  const key = agent.randomKey ?? 0;
  const skin = SKIN_TONES[key % SKIN_TONES.length];
  const hair = options.hair ?? HAIR_TONES[(key + 1) % HAIR_TONES.length];
  const color = agent.customer?.color ?? "#666";
  const facing = options.facing ?? agent.facing ?? 1;
  const bob = walking ? Math.sin(time * 9 + key) * 2 : Math.sin(time * 2 + key) * 0.7;
  const isOwner = agent.customer?.id === "owner";

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);

  // 사장은 한눈에 보여야 한다 — 발밑에 은은한 금색 링이 숨쉰다
  if (isOwner) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.save();
    ctx.strokeStyle = `rgba(217, 164, 65, ${0.35 + pulse * 0.3})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 16 + pulse * 2, 5.5 + pulse * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 다리
  ctx.strokeStyle = "#23241f";
  ctx.lineWidth = 4.6;
  ctx.lineCap = "round";
  if (seated) {
    ctx.beginPath();
    ctx.moveTo(-4, -14);
    ctx.lineTo(6 * facing, -8);
    ctx.lineTo(6 * facing, 0);
    ctx.moveTo(4, -14);
    ctx.lineTo(11 * facing, -9);
    ctx.lineTo(11 * facing, 0);
    ctx.stroke();
  } else {
    const step = walking ? Math.sin(time * 9 + key) * 6 : 0;
    ctx.beginPath();
    ctx.moveTo(-3, -16);
    ctx.lineTo(-3 + step, 0);
    ctx.moveTo(4, -16);
    ctx.lineTo(4 - step, 0);
    ctx.stroke();
  }

  // 몸통 (재킷)
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(20,20,16,.55)";
  ctx.lineWidth = 1.6;
  roundedRect(ctx, -10, -42, 20, 29, 7);
  ctx.fill();
  ctx.stroke();

  // 사장의 앞치마 — 옷 위에 크레마색 목줄과 앞판
  if (isOwner) {
    ctx.fillStyle = "rgba(240, 198, 116, .9)";
    roundedRect(ctx, -7, -34, 14, 19, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 198, 116, .85)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-6, -34);
    ctx.lineTo(0, -44);
    ctx.lineTo(6, -34);
    ctx.stroke();
  }

  // 팔
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  const armSwing = walking ? Math.sin(time * 9 + key + Math.PI) * 5 : 0;
  ctx.beginPath();
  ctx.moveTo(-8, -36);
  ctx.lineTo(-11 + armSwing * 0.4, -22);
  ctx.moveTo(8, -36);
  ctx.lineTo(11 - armSwing * 0.4, -22);
  ctx.stroke();

  // 머리
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -52, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, -54.5, 8.2, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();

  // 고객 유형 소품
  const type = agent.customer?.id;
  if (type === "office_worker") {
    ctx.fillStyle = "#2c2e33";
    roundedRect(ctx, facing > 0 ? 10 : -18, -26, 8, 11, 2);
    ctx.fill();
    ctx.fillStyle = "#e6e2d8";
    ctx.fillRect(-2, -40, 4, 9);
  } else if (type === "cafe_studier") {
    ctx.fillStyle = mixColor(color, "#222", 0.35);
    roundedRect(ctx, facing > 0 ? -14 : 6, -40, 8, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#e8e2d2";
    roundedRect(ctx, facing > 0 ? 8 : -15, -28, 8, 11, 1.5);
    ctx.fill();
  } else if (type === "mz_hotple") {
    ctx.fillStyle = "#1b1c20";
    ctx.fillRect(facing > 0 ? 11 : -14, -34, 3.4, 6.5);
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, -56, 8.6, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
  } else if (type === "local_resident") {
    ctx.fillStyle = "#d8c9a8";
    roundedRect(ctx, facing > 0 ? 9 : -16, -25, 7, 12, 1.5);
    ctx.fill();
  } else if (type === "delivery_customer") {
    ctx.fillStyle = "#20242c";
    ctx.beginPath();
    ctx.arc(0, -54, 9, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.fillStyle = "#f4511e";
    ctx.fillRect(-9, -56, 18, 3.4);
  }
  if (isOwner) {
    // 머리 위 사장 배지
    const badgeY = -70 + Math.sin(time * 3) * 1.4;
    ctx.fillStyle = "rgba(20, 16, 12, .82)";
    roundedRect(ctx, -13, badgeY - 7, 26, 12, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(217, 164, 65, .8)";
    ctx.lineWidth = 1;
    roundedRect(ctx, -13, badgeY - 7, 26, 12, 5);
    ctx.stroke();
    ctx.fillStyle = "#f0c674";
    ctx.font = "800 8px 'Noto Sans KR', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("사장", 0, badgeY + 2);
    ctx.textAlign = "left";
  }
  ctx.restore();
  return bob;
}

// 감정 칩: 결정의 순간을 아이콘으로 보여준다 (Two Point Hospital 방식)
function drawEmotionChip(ctx, x, y, kind, time = 0) {
  const palette = {
    thinking: { bg: "#fffdf4", fg: "#5a5c55", text: "?" },
    price: { bg: "#fbe9e5", fg: "#c83b2f", text: "₩" },
    wait: { bg: "#fbe9e5", fg: "#c83b2f", text: "⏱" },
    menu: { bg: "#f2efe4", fg: "#77796f", text: "…" },
    awareness: { bg: "#f2efe4", fg: "#9a9c92", text: "…" },
    full: { bg: "#fbe9e5", fg: "#c83b2f", text: "✕" },
    love: { bg: "#e4f2e7", fg: "#1f7a4f", text: "♥" },
    sad: { bg: "#fbe9e5", fg: "#c83b2f", text: "✕" },
    star: { bg: "#fdf3d9", fg: "#c98a12", text: "★" },
    order: { bg: "#fdf3d9", fg: "#b25b1c", text: "🍜" },
    dishes: { bg: "#fdf3d9", fg: "#b25b1c", text: "🍽" },
  };
  const style = palette[kind];
  if (!style) return;
  const pulse = 1 + Math.sin(time * 5) * 0.05;
  ctx.save();
  ctx.translate(x, y - 4 + Math.sin(time * 3) * 1.5);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = style.bg;
  ctx.strokeStyle = "rgba(21,22,18,.72)";
  ctx.lineWidth = 1.6;
  roundedRect(ctx, -11, -22, 22, 22, 7);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(0, 5);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = style.fg;
  ctx.font = "800 13px 'Noto Sans KR', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(style.text, 0, -10.5);
  ctx.restore();
}

function drawBubble(ctx, x, y, text, tone = "neutral") {
  if (!text) return;
  const clean = text.length > 26 ? `${text.slice(0, 25)}…` : text;
  ctx.save();
  ctx.font = "700 15px 'Noto Sans KR', Arial, sans-serif";
  const width = Math.min(250, Math.max(80, ctx.measureText(clean).width + 26));
  const height = 38;
  const bx = clamp(x - width / 2, 8, W - width - 8);
  const by = y - 108;
  ctx.fillStyle = tone === "good" ? "#e2f1e6" : tone === "bad" ? "#f9ded8" : "#fffdf4";
  ctx.strokeStyle = "#15160f";
  ctx.lineWidth = 1.8;
  roundedRect(ctx, bx, by, width, height, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, by + height);
  ctx.lineTo(x + 1, by + height + 9);
  ctx.lineTo(x + 8, by + height);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#15160f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(clean, bx + width / 2, by + height / 2 + 1);
  ctx.restore();
}

function drawScooter(ctx, x, y, color, facing = 1, moving = false, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  const wobble = moving ? Math.sin(time * 18) * 1 : 0;
  ctx.translate(0, wobble);
  ctx.strokeStyle = "#1b1c18";
  ctx.fillStyle = "#1b1c18";
  ctx.lineWidth = 3;
  // 바퀴
  for (const wx of [-16, 15]) {
    ctx.beginPath();
    ctx.arc(wx, 0, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 차체
  ctx.fillStyle = "#f4511e";
  roundedRect(ctx, -20, -12, 26, 9, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -10);
  ctx.lineTo(16, -26);
  ctx.stroke();
  ctx.fillStyle = "#20242c";
  roundedRect(ctx, -26, -30, 13, 13, 3);
  ctx.fill();
  ctx.restore();
}

function agentProgress(agent, minute) {
  return clamp((minute - agent.stateStart) / Math.max(0.01, agent.stateUntil - agent.stateStart));
}

function districtBackdrop(districtId) {
  if (districtId === "gangnam") return { label: "GANGNAM TEHERAN-RO", towers: 1.5, accent: "#3983b8" };
  if (districtId === "euljiro") return { label: "EULJIRO HIPJIRO", towers: 1.0, accent: "#8362b1" };
  if (districtId === "seongsu") return { label: "SEONGSU CAFE ST.", towers: 0.85, accent: "#e05d2d" };
  if (districtId === "sinchon") return { label: "SINCHON UNIV. TOWN", towers: 0.9, accent: "#d94841" };
  return { label: "GANGDONG RESIDENCE", towers: 0.75, accent: "#3a8d5a" };
}

// ─── 타이틀 씬 ───────────────────────────────────────────────

export class HeroScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.startTime = performance.now();
    this.raf = null;
  }

  start() {
    const frame = (time) => {
      this.draw((time - this.startTime) / 1000);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  draw(time) {
    const ctx = fitCanvas(this.canvas);
    ctx.clearRect(0, 0, W, H);

    // 아트 모드 — 마스터 컨셉 아트로 켄번즈 히어로
    if (artReady("master")) {
      const zoom = 1.06 + Math.sin(time * 0.07) * 0.02;
      coverDraw(ctx, "master", W, H, { zoom, panX: 0.5 + Math.sin(time * 0.045) * 0.05, panY: 0.42 });
      // 은은한 컬러 그레이드 + 비네팅
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      const grade = ctx.createLinearGradient(0, 0, 0, H);
      grade.addColorStop(0, "rgba(60, 80, 130, 0.16)");
      grade.addColorStop(1, "rgba(190, 120, 60, 0.14)");
      ctx.fillStyle = grade;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      vignette(ctx, W, H, 0.5);
      grain(ctx, W, H, 0.05);
      return;
    }

    // 밤으로 기운 서울 하늘 — 크레마 골드만 빛난다
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0C0F1A");
    sky.addColorStop(0.42, "#1E1B2E");
    sky.addColorStop(0.72, "#4A3348");
    sky.addColorStop(1, "#8A5A3E");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 60; i += 1) {
      const sx = (i * 173.3) % W;
      const sy = (i * 97.7) % 300;
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(time * 0.7 + i)) * 0.45;
      ctx.fillStyle = "#EFE6D8";
      ctx.fillRect(sx, sy, 1.8, 1.8);
    }
    ctx.globalAlpha = 1;

    // 남산 능선과 타워
    ctx.fillStyle = "#0F1420";
    ctx.beginPath();
    ctx.moveTo(560, 470);
    ctx.quadraticCurveTo(790, 300, 1030, 470);
    ctx.closePath();
    ctx.fill();
    drawSeoulTower(ctx, 792, 316, 1.1, 1);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    glowDot(ctx, 792, 316 - 150, 60, "#D9A441", 0.6);
    ctx.restore();

    const buildings = [
      [-20, 236, 190, 4, 8], [150, 152, 150, 4, 11], [285, 280, 130, 3, 7],
      [880, 196, 150, 4, 10], [1010, 126, 200, 5, 12],
    ];
    for (const [x, y, width, cols, rows] of buildings) {
      ctx.fillStyle = "#131A28";
      ctx.fillRect(x, y, width, 490 - y);
      drawWindowGrid(ctx, x, y, width, 490 - y, cols, rows, 0.55, x);
    }

    // 중앙 카페 — 유일하게 따뜻한 창
    const cx = 430;
    const cw = 340;
    ctx.fillStyle = "#100C0A";
    ctx.fillRect(cx - 12, 276, cw + 24, 214);
    ctx.fillStyle = "#1A1410";
    ctx.fillRect(cx - 12, 276, cw + 24, 50);
    ctx.fillStyle = "#EFE6D8";
    ctx.font = "800 23px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("OPEN IN SEOUL", cx + 8, 308);
    ctx.fillStyle = "#D9A441";
    ctx.fillRect(cx + cw - 92, 276, 104, 50);
    ctx.fillStyle = "#100C0A";
    ctx.font = "800 13px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("CAFE", cx + cw - 40, 306);

    const inner = ctx.createLinearGradient(cx, 326, cx, 490);
    inner.addColorStop(0, "#F4DCA8");
    inner.addColorStop(1, "#C08A4A");
    ctx.fillStyle = inner;
    ctx.fillRect(cx, 326, cw, 164);

    // 바 카운터와 머신, 앉은 손님
    ctx.fillStyle = "#4A3020";
    ctx.fillRect(cx, 432, cw, 12);
    ctx.fillStyle = "#241C18";
    ctx.fillRect(cx + 22, 384, 92, 48);
    for (let i = 0; i < 2; i += 1) {
      const flame = Math.abs(Math.sin(time * 5 + i));
      ctx.fillStyle = "#8A5326";
      ctx.fillRect(cx + 44 + i * 34, 432, 3, 12 + flame * 3);
    }
    for (let i = 0; i < 3; i += 1) {
      figure(ctx, cx + 168 + i * 62, 444, 0.66, ["#3A4A5E", "#5E4A5A", "#4A5A48"][i], { seated: true, facing: i % 2 ? -1 : 1, time });
    }
    figure(ctx, cx + 66, 432, 0.7, "#EFE6D8", { walk: time * 4, facing: -1, time });

    // 인도와 차도
    ctx.fillStyle = "#231B16";
    ctx.fillRect(0, 490, W, 92);
    ctx.fillStyle = "#131110";
    ctx.fillRect(0, 582, W, 98);
    ctx.strokeStyle = "rgba(239,230,216,.35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([28, 24]);
    ctx.beginPath();
    ctx.moveTo(0, 630);
    ctx.lineTo(W, 630);
    ctx.stroke();
    ctx.setLineDash([]);

    const colors = ["#3A6E92", "#4E7A58", "#B4674D", "#8A6BA8", "#C9954A"];
    for (let i = 0; i < 11; i += 1) {
      const loop = (time * (15 + (i % 4) * 4) + i * 128) % (W + 150) - 75;
      const facing = i % 2 === 0 ? 1 : -1;
      const x = facing === 1 ? loop : W - loop;
      figure(ctx, x, 552 + (i % 3) * 12, 0.8 + (i % 3) * 0.05, colors[i % colors.length], {
        walk: time * 3 + i, facing, prop: i % 3 === 0 ? "cup" : null, time,
      });
    }

    // 창에서 쏟아지는 빛
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    lightCone(ctx, cx + cw / 2, 470, 420, 150, "#F0C674", 0.3);
    glowDot(ctx, cx + cw / 2, 400, 300, "#D9A441", 0.3);
    ctx.restore();

    vignette(ctx, W, H, 0.5);
    grain(ctx, W, H, 0.05);
  }
}

function drawWindowGrid(ctx, x, y, width, height, cols, rows, lightRatio, seedOffset = 0) {
  const pad = 11;
  const gapX = (width - pad * 2) / cols;
  const gapY = (height - pad * 2) / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const hash = ((row * 17 + col * 31 + seedOffset * 13) % 97) / 97;
      ctx.fillStyle = hash < lightRatio ? "#ffd76c" : "rgba(16,20,30,.5)";
      ctx.fillRect(x + pad + col * gapX, y + pad + row * gapY, Math.max(3, gapX - 8), Math.max(4, gapY - 10));
    }
  }
}

function drawSeoulTower(ctx, x, baseY, scale = 1, opacity = 1) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = "#141b2c";
  ctx.fillRect(-4, -74, 8, 74);
  ctx.beginPath();
  ctx.ellipse(0, -80, 16, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-2.4, -118, 4.8, 38);
  ctx.beginPath();
  ctx.moveTo(-2.4, -118);
  ctx.lineTo(0, -136);
  ctx.lineTo(2.4, -118);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4511e";
  ctx.beginPath();
  ctx.arc(0, -136, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── 영업 씬 ────────────────────────────────────────────────

export class GameScene {
  constructor(canvas, { district, format, menus, restaurantName }) {
    this.canvas = canvas;
    this.district = district;
    this.format = format;
    this.menus = menus;
    this.restaurantName = restaurantName;
    this.time = 0;
    this.view = {};
    this.drawnAgents = [];
    this.drawnTables = [];
    this.steamParticles = [];
    this.floaters = [];
  }

  // 클릭 액션의 즉각 피드백 텍스트
  addFloater(x, y, text, tone = "good") {
    this.floaters.push({ x, y, text, tone, life: 1.6 });
  }

  // 캔버스 클릭 → 손님 또는 테이블
  pick(cssX, cssY) {
    const { scale = 1, offsetX = 0, offsetY = 0 } = this.view;
    const x = (cssX - offsetX) / scale;
    const y = (cssY - offsetY) / scale;
    let bestTable = null;
    let bestTableDist = 42;
    for (const drawn of this.drawnTables) {
      const dist = Math.hypot(drawn.x - x, drawn.y - y);
      if (dist < bestTableDist) {
        bestTableDist = dist;
        bestTable = drawn;
      }
    }
    if (bestTable) return { kind: "table", ...bestTable, sceneX: x, sceneY: y };
    let best = null;
    let bestDist = 44;
    for (const drawn of this.drawnAgents) {
      const dist = Math.hypot(drawn.x - x, drawn.y - (y + 30));
      if (dist < bestDist) {
        bestDist = dist;
        best = drawn;
      }
    }
    return best ? { kind: "agent", ...best, sceneX: x, sceneY: y } : null;
  }

  draw(snapshot, deltaSeconds = 0.016) {
    this.time += deltaSeconds;
    const ctx = fitCanvas(this.canvas, this.view);
    ctx.clearRect(0, 0, W, H);
    const light = lightingFor(snapshot.gameMinute);
    // 레터박스 영역까지 통째로 클리어 — 리사이즈 잔상 방지 + 디오라마 프레임 색
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#100d0a";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    this.drawnAgents = [];
    this.drawnTables = [];
    if (artReady("bg")) {
      // 아트 모드 — 일러스트 백플레이트 + 동적 레이어
      this.drawArtScene(ctx, snapshot, light);
      this.drawAgents(ctx, snapshot, light);
      this.drawArtLighting(ctx, light);
      this.drawArtSign(ctx, light);
      this.drawWeather(ctx, snapshot, light);
      this.drawPostFx(ctx, light);
      this.drawFloaters(ctx, deltaSeconds);
      return;
    }
    this.drawSky(ctx, snapshot, light);
    this.drawBackdrop(ctx, snapshot, light);
    this.drawGround(ctx, snapshot, light);
    this.drawStore(ctx, snapshot, light);
    this.drawAgents(ctx, snapshot, light);
    this.drawWeather(ctx, snapshot, light);
    this.drawPostFx(ctx, light);
    this.drawFloaters(ctx, deltaSeconds);
  }

  // ── 아트 모드: 백플레이트 위에 동적 요소만 얹는다 ──
  // 시뮬레이션 좌표(테이블·문·보도)는 art.js의 3분할 매핑으로 이미지와 정렬돼 있다.
  drawArtScene(ctx, snapshot, light) {
    drawBackplate(ctx);
    const A = ANCHOR;

    // 테이블 — 시뮬 테이블 수만큼 홀 바닥에 스탬프
    const simTables = snapshot.tables ?? [];
    const n = Math.min(6, Math.max(simTables.length, 3));
    this.tableSpots = [];
    const minute = snapshot.gameMinute;
    for (let i = 0; i < n; i += 1) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const tx = lerp(A.hallLeft + 30, A.hallRight - 40, t);
      const ty = A.hallFloorY;
      drawTableProp(ctx, tx, ty, 118);
      this.tableSpots.push({ x: tx, y: ty - 60 });
      const table = simTables[i];
      const isDirty = table?.state === "dirty";
      const isCleaning = isDirty && table.cleanAt > minute && table.cleaningBy
        && (table.cleaningBy === "owner" || table.cleanAt - minute <= 5.01);
      const topY = ty - 80;
      if (table?.state === "seated") {
        ctx.fillStyle = "#f3ede0";
        ctx.beginPath();
        ctx.ellipse(tx - 8, topY, 6, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(tx + 8, topY, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (isDirty) {
        for (let d = 0; d < 3; d += 1) {
          ctx.fillStyle = d % 2 ? "#ded5c2" : "#c8bda6";
          ctx.beginPath();
          ctx.ellipse(tx - 6 + d * 6, topY - d * 4, 7 - d, 3.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(60,50,36,.5)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (!isCleaning) {
          const pulse = 1 + Math.sin(this.time * 4) * 0.12;
          ctx.strokeStyle = "rgba(244,81,30,.85)";
          ctx.lineWidth = 2.4;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(tx, topY - 2, 28 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          drawEmotionChip(ctx, tx, topY - 32, "dishes", this.time + i);
        } else {
          const sparkle = Math.abs(Math.sin(this.time * 6 + i));
          ctx.fillStyle = `rgba(114,214,255,${0.4 + sparkle * 0.5})`;
          ctx.font = "800 15px Arial";
          ctx.textAlign = "center";
          ctx.fillText("✦", tx + 20, topY - 14 - sparkle * 4);
        }
        this.drawnTables.push({ id: table.id, x: tx, y: topY, dirty: true, cleaning: !!isCleaning });
      }
    }

    // 바리스타 — 주문이 밀리면 손이 빨라진다
    const busy = snapshot.queueLength > 0;
    drawCharacter(ctx, { randomKey: 2, customer: { id: "staff" }, facing: 1 },
      A.baristaX, A.baristaY, { scale: 0.95, walking: busy ? 1 : 0, time: this.time * (busy ? 1.7 : 0.6) });

    // 김 파티클 — 머신 위
    if (busy && Math.random() < 0.3) {
      this.steamParticles.push({ x: A.machineX + (Math.random() - 0.5) * 26, y: A.machineTop, life: 1, drift: (Math.random() - 0.5) * 8 });
    } else if (Math.random() < 0.05) {
      this.steamParticles.push({ x: A.machineX, y: A.machineTop, life: 1, drift: (Math.random() - 0.5) * 6 });
    }
    this.steamParticles = this.steamParticles.filter((p) => p.life > 0);
    for (const p of this.steamParticles) {
      p.life -= 0.012;
      p.y -= 0.7;
      p.x += p.drift * 0.012;
      ctx.globalAlpha = p.life * 0.22;
      ctx.fillStyle = "#fefaf0";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * (1.7 - p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 주문 티켓 스트립 — 밀린 주문이 카운터 위에 보인다
    const tickets = Math.min(7, snapshot.queueLength);
    if (tickets > 0) {
      for (let i = 0; i < tickets; i += 1) {
        ctx.fillStyle = i < 5 ? "#fff8e8" : "#f4b0a0";
        ctx.fillRect(A.machineX + 60 + i * 20, A.machineTop - 34, 15, 21);
        ctx.strokeStyle = "rgba(30,28,20,.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(A.machineX + 60 + i * 20, A.machineTop - 34, 15, 21);
      }
    }

    // 홀 직원 — 치울 테이블로 실제로 이동한다
    const staffCount = snapshot.hallStaff ?? 0;
    const cleaningTables = simTables.filter((table) => table.state === "dirty" && table.cleaningBy === "staff" && table.cleanAt > minute && table.cleanAt - minute <= 5.01);
    for (let s = 0; s < staffCount; s += 1) {
      const target = cleaningTables[s];
      let sx = A.hallRight - 150 + s * 44;
      let sy = A.hallFloorY - 2;
      let working = false;
      if (target && this.tableSpots[target.id]) {
        sx = this.tableSpots[target.id].x + 30;
        sy = this.tableSpots[target.id].y + 30;
        working = true;
      }
      drawCharacter(ctx, { randomKey: 40 + s, customer: { id: "staff" }, facing: -1 }, sx, sy,
        { scale: 0.85, walking: working ? 1 : 0, time: this.time * (working ? 1.6 : 0.7) + s });
    }

    // 사장 아바타 — 근무 중일 때만
    if (snapshot.onDuty) {
      const station = snapshot.stationActive;
      const moving = snapshot.stationMoving;
      const target = snapshot.ownerStation;
      const spots = {
        bar: { x: A.machineX + 96, y: A.baristaY },
        hall: { x: A.hallLeft + 66, y: A.hallFloorY + 2 },
        door: { x: A.doorRight + 26, y: SIDEWALK_Y + 44 },
      };
      const spot = spots[target] ?? spots.bar;
      const busyPose = station === "bar" || station === "hall" || moving;
      drawCharacter(ctx, { randomKey: 77, customer: { color: snapshot.ownerLook?.color ?? "#23241f", id: "owner" }, facing: target === "door" ? 1 : -1 },
        spot.x, spot.y, { scale: 1.05, walking: busyPose ? 1 : 0, time: this.time * (busyPose ? 1.7 : 0.6), hair: snapshot.ownerLook?.hair });
      ctx.fillStyle = moving ? "#b4674d" : "#d9a441";
      roundedRect(ctx, spot.x - 24, spot.y - 236, 48, 17, 8);
      ctx.fill();
      ctx.fillStyle = "#14100d";
      ctx.font = "800 10px 'Noto Sans KR', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(moving ? "이동 중" : "사장", spot.x, spot.y - 224);
      this.ownerSpot = spot;
    }
  }

  // 간판 — 라이팅 위에 그려 밤에도 빛난다
  drawArtSign(ctx, light) {
    const A = ANCHOR;
    ctx.save();
    const glow = light.night > 0.3;
    if (glow) {
      ctx.shadowColor = "#ffb25e";
      ctx.shadowBlur = 26;
    }
    ctx.fillStyle = glow ? "#ffd9a8" : "#e8d5b5";
    ctx.font = "900 34px 'Noto Sans KR', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(this.restaurantName, A.signX, A.signY);
    ctx.shadowBlur = glow ? 12 : 0;
    ctx.fillStyle = glow ? "rgba(255, 214, 150, .85)" : "rgba(240, 198, 116, .75)";
    ctx.font = "800 11px SFMono-Regular, monospace";
    ctx.fillText(`${this.format.name.toUpperCase()} · SEONGSU`, A.signX + 2, A.signY + 20);
    ctx.shadowBlur = glow ? 18 : 0;
    ctx.shadowColor = "#ff6b3d";
    ctx.fillStyle = glow ? "#ff5a26" : "#f4511e";
    ctx.fillRect(A.signRight - 86, A.signY - 26, 86, 34);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff8ec";
    ctx.font = "900 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("OPEN", A.signRight - 43, A.signY - 3);
    ctx.restore();
  }

  // 아트 모드 시간대 라이팅 — 백플레이트(오후 고정)를 아침/저녁/밤으로 옮긴다
  drawArtLighting(ctx, light) {
    const A = ANCHOR;
    const hour = light.hour;
    // 아침: 차가운 톤
    const morning = clamp((10.5 - hour) / 3);
    if (morning > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = morning * 0.14;
      ctx.fillStyle = "#b8c8dc";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // 저녁: 웜 톤
    if (light.dusk > 0 && light.night < 0.6) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = light.dusk * (1 - light.night) * 0.28;
      ctx.fillStyle = "#e8894c";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // 밤: 바깥은 깊게 누르고, 실내·조명·간판만 광원으로 남긴다
    if (light.night > 0.02) {
      // 어둠은 하늘이 제일 깊고 노면은 덜 — 세로 그라데이션 멀티플라이
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = light.night;
      const dark = ctx.createLinearGradient(0, 0, 0, H);
      dark.addColorStop(0, "#1c2246");
      dark.addColorStop(0.34, "#2c3054");
      dark.addColorStop(0.78, "#4a4258");
      dark.addColorStop(1, "#3a3448");
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      // 실내가 화면의 광원 — 창 안쪽을 확실하게 되살린다 (가장자리는 부드럽게)
      ctx.globalAlpha = light.night * 0.6;
      ctx.filter = "blur(26px)";
      const warm = ctx.createLinearGradient(0, A.interior.y, 0, A.interior.y + A.interior.h);
      warm.addColorStop(0, "rgba(255, 202, 122, .78)");
      warm.addColorStop(0.55, "rgba(255, 186, 100, .6)");
      warm.addColorStop(1, "rgba(230, 160, 84, .42)");
      ctx.fillStyle = warm;
      ctx.fillRect(A.interior.x + 20, A.interior.y + 16, A.interior.w - 40, A.interior.h - 24);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      // 펜던트 램프 + 벽 부착등
      for (const lamp of A.lamps) {
        glowDot(ctx, lamp.x, lamp.y + 14, 78, "#FFD97A", light.night * 0.72);
      }
      for (const sconce of A.sconces) {
        glowDot(ctx, sconce.x, sconce.y, 64, "#FFD97A", light.night * 0.6);
      }
      // 간판 글로우
      glowDot(ctx, (A.signX + A.signRight) / 2, A.signY - 6, 250, "#D9A441", light.night * 0.3);
      // 유리문
      glowDot(ctx, (A.doorLeft + A.doorRight) / 2, (A.doorTop + A.doorBottom) / 2, 120, "#FFC97E", light.night * 0.42);
      // 실내 불빛이 보도로 쏟아진다
      lightCone(ctx, (A.interior.x + A.interior.w * 0.5), SIDEWALK_Y - 6, A.interior.w * 0.9, 130, "#F0C674", light.night * 0.22);
      ctx.restore();
    }
  }

  // 후처리: 광원 블룸 → 색보정 → 비네팅 → 필름 그레인.
  // 평면 도형을 사진처럼 보이게 만드는 마지막 세 겹이다.
  drawPostFx(ctx, light) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    // 간판과 창의 빛이 공기 중으로 번진다
    glowDot(ctx, STORE.x + STORE.w * 0.5, STORE.signY + 30, 320, "#D9A441", 0.1 + light.night * 0.24);
    glowDot(ctx, STORE.x + STORE.w * 0.22, STORE.floorY - 130, 210, "#F0C674", 0.06 + light.night * 0.2);
    if (light.night > 0.2) {
      glowDot(ctx, 216, 554, 170, "#FFD97A", light.night * 0.24);
      glowDot(ctx, 1092, 554, 170, "#FFD97A", light.night * 0.24);
    }
    ctx.restore();

    // 창문에서 인도로 쏟아지는 빛기둥
    if (light.night > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      lightCone(ctx, STORE.x + STORE.w * 0.5, STORE.floorY - 40, 420, 150, "#F0C674", light.night * 0.16);
      ctx.restore();
    }

    // 색보정: 낮은 따뜻하게, 밤은 청록으로 눌러 대비를 만든다
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    const grade = ctx.createLinearGradient(0, 0, 0, H);
    grade.addColorStop(0, `rgba(90, 130, 170, ${0.1 + light.night * 0.14})`);
    grade.addColorStop(0.62, "rgba(0,0,0,0)");
    grade.addColorStop(1, `rgba(190, 120, 60, ${0.1 + light.dusk * 0.1})`);
    ctx.fillStyle = grade;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    vignette(ctx, W, H, 0.44 + light.night * 0.14);
    grain(ctx, W, H, 0.05);
  }

  drawFloaters(ctx, deltaSeconds) {
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
    for (const floater of this.floaters) {
      floater.life -= deltaSeconds;
      floater.y -= deltaSeconds * 26;
      const alpha = Math.min(1, floater.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "800 16px 'Noto Sans KR', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(16,16,14,.85)";
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillStyle = floater.tone === "bad" ? "#ff9d8a" : floater.tone === "neutral" ? "#f2ead8" : "#9df0bd";
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.restore();
    }
  }

  drawSky(ctx, snapshot, light) {
    const gradient = ctx.createLinearGradient(0, 0, 0, SIDEWALK_Y);
    gradient.addColorStop(0, light.skyTop);
    gradient.addColorStop(0.62, light.skyMid);
    gradient.addColorStop(1, light.skyLow);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, SIDEWALK_Y);

    // 해와 달
    const arc = clamp((snapshot.gameMinute / 60 - 10) / 13);
    const sunX = lerp(90, 1120, arc);
    const sunY = 210 - Math.sin(arc * Math.PI) * 120;
    if (light.night < 0.5) {
      ctx.save();
      ctx.globalAlpha = 1 - light.night * 2;
      ctx.fillStyle = light.dusk > 0.4 ? "#ffb25e" : "#ffe9a8";
      ctx.shadowColor = light.dusk > 0.4 ? "#ff8b3d" : "#fff3c4";
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (light.night > 0.25) {
      ctx.save();
      ctx.globalAlpha = light.night;
      ctx.fillStyle = "#f2ecd8";
      ctx.beginPath();
      ctx.arc(1010, 118, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = light.skyTop;
      ctx.beginPath();
      ctx.arc(1001, 109, 21, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 42; i += 1) {
        const sx = (i * 173.3) % W;
        const sy = (i * 97.7) % 300;
        const twinkle = 0.35 + Math.abs(Math.sin(this.time * 0.8 + i)) * 0.5;
        ctx.globalAlpha = light.night * twinkle;
        ctx.fillStyle = "#f5f0dc";
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();
    }
  }

  drawBackdrop(ctx, snapshot, light) {
    const backdrop = districtBackdrop(this.district.id);
    const roof = STORE.signY - 12;

    // 매장이 화면을 넓게 차지하므로 배경은 지붕 위 띠와 양 끝에만 남긴다.
    const towerSpecs = [
      [-30, 40, 120, 3, 8], [70, 104, 96, 2, 6],
      [1010, 76, 110, 3, 7], [1108, 24, 122, 3, 9],
    ];
    towerSpecs.forEach(([x, y, width, cols, rows], index) => {
      const height = roof - y;
      if (height <= 0) return;
      ctx.fillStyle = light.building;
      ctx.fillRect(x, y, width, height);
      drawWindowGrid(ctx, x, y, width, height, cols, rows, light.windowLit, index * 3 + 5);
    });

    // 남산 능선과 서울타워 — 지붕선 위로만 보인다
    ctx.fillStyle = light.silhouette;
    ctx.beginPath();
    ctx.moveTo(180, roof);
    ctx.quadraticCurveTo(430, 96, 720, roof);
    ctx.closePath();
    ctx.fill();
    drawSeoulTower(ctx, 430, 112, 0.9, 0.95);
    if (light.night > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glowDot(ctx, 430, 112 - 136 * 0.9, 40, "#F4511E", light.night * 0.8);
      ctx.restore();
    }

    // 상권 이름 슬레이트
    ctx.fillStyle = "rgba(12, 9, 8, .72)";
    ctx.fillRect(0, 18, 210, 26);
    ctx.fillStyle = "#D9A441";
    ctx.font = "700 11px SFMono-Regular, monospace";
    ctx.textAlign = "left";
    ctx.fillText(backdrop.label, 12, 36);
  }

  drawGround(ctx, snapshot, light) {
    // 인도
    ctx.fillStyle = light.ground;
    ctx.fillRect(0, SIDEWALK_Y, W, ROAD_Y - SIDEWALK_Y);
    ctx.strokeStyle = "rgba(20,20,18,.18)";
    ctx.lineWidth = 1.6;
    for (let x = -30; x < W; x += 66) {
      ctx.beginPath();
      ctx.moveTo(x + 24, SIDEWALK_Y);
      ctx.lineTo(x, ROAD_Y);
      ctx.stroke();
    }
    // 차도
    ctx.fillStyle = light.road;
    ctx.fillRect(0, ROAD_Y, W, H - ROAD_Y);
    ctx.strokeStyle = "rgba(238,232,216,.6)";
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    ctx.beginPath();
    ctx.moveTo(0, ROAD_Y + 36);
    ctx.lineTo(W, ROAD_Y + 36);
    ctx.stroke();
    ctx.setLineDash([]);
    // 횡단보도
    ctx.fillStyle = "rgba(238,232,216,.5)";
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(60 + i * 26, ROAD_Y + 6, 14, H - ROAD_Y - 12);
    }

    // 가로등
    for (const x of [186, 1062]) {
      ctx.strokeStyle = mixColor("#4d524e", "#20262e", light.night);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, ROAD_Y);
      ctx.lineTo(x, 560);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, 560);
      ctx.lineTo(x + 26, 552);
      ctx.stroke();
      if (light.night > 0.2) {
        ctx.save();
        ctx.globalAlpha = light.night;
        ctx.fillStyle = "#ffd97a";
        ctx.shadowColor = "#ffd97a";
        ctx.shadowBlur = 22;
        ctx.beginPath();
        ctx.arc(x + 30, 554, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = light.night * 0.16;
        ctx.beginPath();
        ctx.moveTo(x + 30, 554);
        ctx.lineTo(x - 24, SIDEWALK_Y + 70);
        ctx.lineTo(x + 88, SIDEWALK_Y + 70);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = "#8b918d";
        ctx.beginPath();
        ctx.arc(x + 30, 554, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawStore(ctx, snapshot, light) {
    const { x, w } = STORE;
    const interiorY = STORE.signY + STORE.signH;
    const interiorH = STORE.floorY - interiorY;
    const isDelivery = false;
    const kitchenW = Math.round(w * 0.4);

    // 그림자와 외곽
    ctx.fillStyle = "rgba(10,10,14,.28)";
    ctx.fillRect(x + 14, STORE.signY + 14, w, STORE.floorY - STORE.signY);
    ctx.fillStyle = "#191a17";
    ctx.fillRect(x - 12, STORE.signY - 10, w + 24, STORE.floorY - STORE.signY + 10);

    // 간판
    ctx.fillStyle = "#171816";
    ctx.fillRect(x - 12, STORE.signY - 10, w + 24, STORE.signH);
    const glow = light.night > 0.3;
    ctx.save();
    if (glow) {
      ctx.shadowColor = "#ffb25e";
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = glow ? "#ffd9a8" : "#f6f1e6";
    ctx.font = "900 30px 'Noto Sans KR', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(this.restaurantName, x + 14, STORE.signY + 30);
    ctx.restore();
    ctx.fillStyle = "#f4511e";
    ctx.font = "800 11px SFMono-Regular, monospace";
    ctx.fillText(`${this.format.name.toUpperCase()} · ${this.menus[0]?.name ?? ""}`, x + 15, STORE.signY + 47);
    // 오렌지 스트라이프 (썸네일 시그니처)
    ctx.fillStyle = "#f4511e";
    ctx.fillRect(x + w - 130, STORE.signY - 10, 142, STORE.signH);
    ctx.fillStyle = "#fff8ec";
    ctx.font = "900 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText("OPEN", x + w - 59, STORE.signY + 16);
    ctx.font = "700 10px SFMono-Regular, monospace";
    ctx.fillText("FIRST 7 DAYS", x + w - 59, STORE.signY + 33);

    // ── 주방 (왼쪽) ──
    const warmth = 1 + light.night * 0.15;
    ctx.fillStyle = "#efe3cb";
    ctx.fillRect(x, interiorY, kitchenW, interiorH);
    // 타일 벽
    ctx.strokeStyle = "rgba(120,110,90,.25)";
    ctx.lineWidth = 1;
    for (let ty = interiorY + 14; ty < interiorY + 90; ty += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 8, ty);
      ctx.lineTo(x + kitchenW - 8, ty);
      ctx.stroke();
    }
    // 후드
    ctx.fillStyle = "#3a3c38";
    ctx.fillRect(x + 26, interiorY + 8, kitchenW - 100, 26);
    ctx.fillRect(x + 60, interiorY - 8, 30, 18);
    // 조리대 + 화구
    const counterY = interiorY + interiorH * 0.46;
    ctx.fillStyle = "#2c2e2a";
    ctx.fillRect(x + 18, counterY, kitchenW - 60, 30);
    ctx.fillStyle = "#8f958e";
    ctx.fillRect(x + 18, counterY + 30, kitchenW - 60, 12);
    const burners = Math.max(2, Math.min(4, Math.round(this.format.capacity / 4)));
    const cooking = snapshot.queueLength > 0 && !snapshot.finished;
    for (let i = 0; i < burners; i += 1) {
      const bx = x + 40 + i * ((kitchenW - 110) / Math.max(1, burners - 1));
      ctx.fillStyle = "#1c1d1a";
      ctx.beginPath();
      ctx.ellipse(bx, counterY + 4, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (cooking && i < Math.min(burners, snapshot.queueLength)) {
        const flicker = Math.abs(Math.sin(this.time * 12 + i * 1.9));
        ctx.fillStyle = "#f4511e";
        ctx.beginPath();
        ctx.ellipse(bx, counterY - 5, 8, 9 + flicker * 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffcb58";
        ctx.beginPath();
        ctx.ellipse(bx, counterY - 7, 4, 5.5 + flicker * 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        // 김
        if (Math.random() < 0.12) {
          this.steamParticles.push({ x: bx + (Math.random() - 0.5) * 14, y: counterY - 16, life: 1, drift: (Math.random() - 0.5) * 8 });
        }
      }
    }
    // 주문 티켓 레일
    const tickets = Math.min(9, snapshot.queueLength);
    ctx.fillStyle = "#514f47";
    ctx.fillRect(x + 20, interiorY + 44, kitchenW - 66, 5);
    for (let i = 0; i < tickets; i += 1) {
      ctx.fillStyle = i < 6 ? "#fff8e8" : "#f4b0a0";
      ctx.fillRect(x + 26 + i * 24, interiorY + 46, 18, 24);
      ctx.strokeStyle = "rgba(30,28,20,.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 26 + i * 24, interiorY + 46, 18, 24);
    }
    if (tickets > 0) {
      ctx.fillStyle = "#8c2f1b";
      ctx.font = "800 11px SFMono-Regular, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`ORDERS ${snapshot.queueLength}`, x + 24, interiorY + 86);
    }
    // 셰프
    const chefCount = Math.min(3, Math.max(1, this.format.staff - 1));
    for (let i = 0; i < chefCount; i += 1) {
      const busy = snapshot.queueLength > i * 2;
      const cx = x + 62 + i * ((kitchenW - 120) / Math.max(1, chefCount - 1 || 1));
      const chefAgent = { randomKey: i * 7 + 2, customer: { color: busy ? "#e8e2d4" : "#d9d3c4", id: "chef" }, facing: 1 };
      drawCharacter(ctx, chefAgent, cx, counterY + 46, { scale: 0.92, walking: busy ? 1 : 0, time: this.time * (busy ? 1.6 : 0.6) + i });
      // 셰프 모자
      ctx.fillStyle = "#f6f1e6";
      const bob = busy ? Math.sin((this.time * 1.6 + i) * 9 + (i * 7 + 2)) * 2 : 0;
      roundedRect(ctx, cx - 7, counterY + 46 + bob - 100 * 0.92 + 32, 14, 10, 3);
      ctx.fill();
    }

    // 김 파티클
    this.steamParticles = this.steamParticles.filter((p) => p.life > 0);
    for (const p of this.steamParticles) {
      p.life -= 0.012;
      p.y -= 0.7;
      p.x += p.drift * 0.012;
      ctx.globalAlpha = p.life * 0.4;
      ctx.fillStyle = "#fefaf0";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 * (1.6 - p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 패스 카운터 (판매 이펙트의 기준점)
    const passX = x + kitchenW;
    ctx.fillStyle = "#6d4a36";
    ctx.fillRect(passX - 8, interiorY + interiorH * 0.35, 16, interiorH * 0.65);
    ctx.fillStyle = "#87593f";
    ctx.fillRect(passX - 22, interiorY + interiorH * 0.35 - 8, 44, 10);
    this.registerSpot = { x: passX, y: interiorY + interiorH * 0.32 };

    // ── 홀 or 배달 존 (오른쪽) ──
    const hallX = passX + 8;
    const hallW = x + w - hallX;
    if (!isDelivery) {
      const wallColor = mixColor("#f6e7c8", "#f0d9a8", light.night * 0.5);
      ctx.fillStyle = wallColor;
      ctx.fillRect(hallX, interiorY, hallW, interiorH);
      // 벽 장식: 액자 + 창
      ctx.fillStyle = "#8c5c42";
      ctx.fillRect(hallX + 30, interiorY + 22, 54, 40);
      ctx.fillStyle = "#e2703d";
      ctx.beginPath();
      ctx.arc(hallX + 57, interiorY + 42, 13, 0, Math.PI * 2);
      ctx.fill();
      // 매달린 조명
      const lampCount = 3;
      for (let i = 0; i < lampCount; i += 1) {
        const lx = hallX + hallW * (0.22 + i * 0.28);
        ctx.strokeStyle = "#3a3833";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx, interiorY);
        ctx.lineTo(lx, interiorY + 34);
        ctx.stroke();
        ctx.fillStyle = "#f4511e";
        ctx.beginPath();
        ctx.moveTo(lx - 10, interiorY + 34);
        ctx.lineTo(lx + 10, interiorY + 34);
        ctx.lineTo(lx + 6, interiorY + 46);
        ctx.lineTo(lx - 6, interiorY + 46);
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.globalAlpha = 0.35 + light.night * 0.4;
        ctx.fillStyle = "#ffd97a";
        ctx.beginPath();
        ctx.ellipse(lx, interiorY + 52, 7, 5, 0, 0, Math.PI * 2);
        ctx.shadowColor = "#ffd97a";
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
      }
      // 테이블 — 시뮬레이션의 상태(비어있음·식사 중·치울 것·정리 중)를 그대로 그린다
      this.tableSpots = [];
      this.drawnTables = [];
      const simTables = snapshot.tables ?? [];
      const tables = Math.max(simTables.length, 3);
      const perRow = 3;
      const minute = snapshot.gameMinute;
      for (let i = 0; i < tables; i += 1) {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const tx = hallX + 58 + col * ((hallW - 110) / (perRow - 1));
        const ty = interiorY + interiorH * (row === 0 ? 0.62 : 0.88);
        this.tableSpots.push({ x: tx, y: ty });
        const table = simTables[i];
        const isDirty = table?.state === "dirty";
        // 직원이 실제로 치우기 시작한 테이블만 '정리 중' — 밀려 있으면 사장이 개입할 수 있다
        const isCleaning = isDirty && table.cleanAt > minute && table.cleaningBy
          && (table.cleaningBy === "owner" || table.cleanAt - minute <= 5.01);
        ctx.fillStyle = "#5f4433";
        ctx.fillRect(tx - 30, ty, 60, 9);
        ctx.fillRect(tx - 4, ty + 9, 8, 26);
        ctx.fillStyle = "#4a3529";
        ctx.fillRect(tx - 42, ty + 12, 10, 24);
        ctx.fillRect(tx + 32, ty + 12, 10, 24);
        if (table?.state === "seated") {
          // 식사 중인 상: 접시와 김
          ctx.fillStyle = "#f3ede0";
          ctx.beginPath();
          ctx.ellipse(tx - 10, ty - 3, 8, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(tx + 10, ty - 3, 8, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#c96a34";
          ctx.beginPath();
          ctx.ellipse(tx - 10, ty - 4, 4.5, 2.4, 0, 0, Math.PI * 2);
          ctx.ellipse(tx + 10, ty - 4, 4.5, 2.4, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (isDirty) {
          // 그릇이 쌓인 테이블: 치우기 전까지 새 손님을 받지 못한다
          for (let d = 0; d < 3; d += 1) {
            ctx.fillStyle = d % 2 ? "#ded5c2" : "#c8bda6";
            ctx.beginPath();
            ctx.ellipse(tx - 8 + d * 8, ty - 3 - d * 4, 9 - d, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(60,50,36,.5)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          if (!isCleaning) {
            // 클릭 유도 링
            const pulse = 1 + Math.sin(this.time * 4) * 0.12;
            ctx.strokeStyle = "rgba(244,81,30,.85)";
            ctx.lineWidth = 2.4;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(tx, ty - 4, 30 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            drawEmotionChip(ctx, tx, ty - 34, "dishes", this.time + i);
          } else {
            // 정리 중 반짝임
            const sparkle = Math.abs(Math.sin(this.time * 6 + i));
            ctx.fillStyle = `rgba(114,214,255,${0.4 + sparkle * 0.5})`;
            ctx.font = "800 15px Arial";
            ctx.textAlign = "center";
            ctx.fillText("✦", tx + 22, ty - 18 - sparkle * 4);
          }
          this.drawnTables.push({ id: table.id, x: tx, y: ty, dirty: true, cleaning: !!isCleaning });
        }
      }
    } else {
      // 배달 전문: 포장 선반 + 픽업 창
      ctx.fillStyle = mixColor("#e8dcc4", "#d9c9a4", light.night * 0.4);
      ctx.fillRect(hallX, interiorY, hallW, interiorH);
      ctx.fillStyle = "#3c3e3a";
      ctx.font = "900 20px Arial";
      ctx.textAlign = "left";
      ctx.fillText("PICK-UP", hallX + 22, interiorY + 34);
      const slots = 8;
      for (let i = 0; i < slots; i += 1) {
        const sx = hallX + 24 + (i % 4) * 74;
        const sy = interiorY + 52 + Math.floor(i / 4) * 66;
        const hasBag = i < snapshot.queueLength;
        ctx.fillStyle = "#54564f";
        ctx.fillRect(sx, sy, 60, 54);
        ctx.fillStyle = hasBag ? "#f4511e" : "#3f413c";
        if (hasBag) {
          roundedRect(ctx, sx + 14, sy + 14, 32, 34, 4);
          ctx.fill();
          ctx.fillStyle = "#fff3dd";
          ctx.fillRect(sx + 24, sy + 10, 12, 6);
        }
      }
    }

    // 설거지 더미 — 치울 테이블이 밀리면 주방 개수대에 그릇이 쌓인다
    const dirtyTotal = (snapshot.tables ?? []).filter((table) => table.state === "dirty").length;
    if (dirtyTotal > 0) {
      const sinkX = x + kitchenW - 46;
      const sinkY = counterY + 2;
      ctx.fillStyle = "#43453f";
      ctx.fillRect(sinkX - 16, sinkY - 4, 40, 12);
      for (let d = 0; d < Math.min(6, dirtyTotal * 2); d += 1) {
        ctx.fillStyle = d % 2 ? "#ded5c2" : "#bfb49c";
        ctx.beginPath();
        ctx.ellipse(sinkX + (d % 2) * 10, sinkY - 8 - d * 5, 12 - d, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(50,44,32,.5)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 홀 직원 — 파트타이머·일일알바가 실제로 늘어나 테이블을 치우러 다닌다
    if (!isDelivery) {
      const minute = snapshot.gameMinute;
      const staffCount = snapshot.hallStaff ?? 0;
      const cleaningTables = (snapshot.tables ?? []).filter((table) => table.state === "dirty" && table.cleaningBy === "staff" && table.cleanAt > minute && table.cleanAt - minute <= 5.01);
      for (let s = 0; s < staffCount; s += 1) {
        const target = cleaningTables[s];
        const isDayLabor = snapshot.dayLabor?.active && s === staffCount - 1;
        const color = isDayLabor ? "#3a8d5a" : "#8a6f4d";
        let sx;
        let sy;
        let working = false;
        if (target && this.tableSpots[target.id]) {
          const spot = this.tableSpots[target.id];
          sx = spot.x + 32;
          sy = spot.y + 30;
          working = true;
        } else {
          sx = x + kitchenW + 36 + s * 28;
          sy = interiorY + interiorH * 0.6;
        }
        drawCharacter(ctx, { randomKey: 40 + s, customer: { color, id: "staff" }, facing: -1 }, sx, sy, { scale: 0.85, walking: working ? 1 : 0, time: this.time * (working ? 1.6 : 0.7) + s });
        ctx.fillStyle = "#f2ead8";
        roundedRect(ctx, sx - 6, sy - 26, 12, 11, 2);
        ctx.fill();
      }
    }

    // 사장 아바타 — 근무 중일 때만 매장에 있다. 쉬는 동안엔 아예 보이지 않는다.
    if (snapshot.onDuty) {
      const station = snapshot.stationActive;
      const moving = snapshot.stationMoving;
      const target = snapshot.ownerStation;
      const spots = {
        bar: { x: x + kitchenW - 58, y: counterY + 46 },
        hall: { x: x + kitchenW + 96, y: interiorY + interiorH * 0.92 },
        door: { x: DOOR_X + 46, y: SIDEWALK_Y + 44 },
      };
      const spot = spots[target] ?? spots.bar;
      const busyPose = station === "bar" || station === "hall" || moving;
      drawCharacter(ctx, { randomKey: 77, customer: { color: snapshot.ownerLook?.color ?? "#23241f", id: "owner" }, facing: target === "door" ? 1 : -1 },
        spot.x, spot.y, { scale: 1.06, walking: busyPose ? 1 : 0, time: this.time * (busyPose ? 1.7 : 0.6), hair: snapshot.ownerLook?.hair });

      // 발밑 링과 이름표로 사장을 절대 놓치지 않게 한다
      ctx.save();
      ctx.strokeStyle = moving ? "rgba(180,103,77,.9)" : "rgba(217,164,65,.95)";
      ctx.lineWidth = 2.4;
      if (moving) ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(spot.x, spot.y + 3, 26, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.fillStyle = moving ? "#b4674d" : "#d9a441";
      roundedRect(ctx, spot.x - 24, spot.y - 92, 48, 17, 8);
      ctx.fill();
      ctx.fillStyle = "#14100d";
      ctx.font = "800 10px 'Noto Sans KR', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(moving ? "이동 중" : "사장", spot.x, spot.y - 80);
      ctx.textAlign = "left";

      // 입구에 서 있으면 전단지를 건네는 동작이 보인다
      if (station === "door") {
        ctx.fillStyle = "#efe6d8";
        const wave = Math.sin(this.time * 5) * 4;
        roundedRect(ctx, spot.x + 16, spot.y - 42 + wave, 11, 14, 2);
        ctx.fill();
      }
      this.ownerSpot = spot;
    }

    // 바닥
    ctx.fillStyle = mixColor("#c9b791", "#a08d68", 0.3);
    ctx.fillRect(x, STORE.floorY - 12, w, 12);

    // 출입문 (오른쪽 끝)
    ctx.fillStyle = "#191a17";
    ctx.fillRect(DOOR_X - 8, interiorY + interiorH * 0.3, 46, interiorH * 0.7 + 12);
    ctx.fillStyle = light.night > 0.35 ? "#ffcf87" : "#f4511e";
    ctx.fillRect(DOOR_X - 1, interiorY + interiorH * 0.38, 32, interiorH * 0.62);
    ctx.fillStyle = "#191a17";
    ctx.fillRect(DOOR_X + 22, interiorY + interiorH * 0.62, 5, 10);

    // 입간판
    if (snapshot.upgrades.includes("sidewalk_sign")) {
      const signX = DOOR_X + 58;
      const signY = SIDEWALK_Y + 8;
      ctx.fillStyle = "#f4511e";
      ctx.beginPath();
      ctx.moveTo(signX, signY + 52);
      ctx.lineTo(signX + 16, signY);
      ctx.lineTo(signX + 32, signY + 52);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#191a17";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fff8ec";
      ctx.font = "900 9px SFMono-Regular, monospace";
      ctx.textAlign = "center";
      ctx.fillText("TODAY", signX + 16, signY + 30);
    }

    // 밤에는 매장 불빛이 인도로 번진다
    if (light.night > 0.25) {
      ctx.save();
      ctx.globalAlpha = light.night * 0.2;
      const glowGradient = ctx.createLinearGradient(0, STORE.floorY, 0, STORE.floorY + 80);
      glowGradient.addColorStop(0, "#ffd97a");
      glowGradient.addColorStop(1, "rgba(255,217,122,0)");
      ctx.fillStyle = glowGradient;
      ctx.fillRect(x - 20, STORE.floorY, w + 40, 80);
      ctx.restore();
    }
  }

  drawAgents(ctx, snapshot, light) {
    const minute = snapshot.gameMinute;
    const agents = snapshot.agents.filter((agent) => !agent.done).slice(-64);
    const queue = agents.filter((agent) => agent.state === "queueing" && agent.channel !== "delivery");
    const riders = agents.filter((agent) => agent.channel === "delivery" && ["phone", "queueing", "pickup"].includes(agent.state));
    const eating = agents.filter((agent) => agent.state === "eating");
    const queueIndex = new Map(queue.map((agent, index) => [agent.id, index]));
    const riderIndex = new Map(riders.map((agent, index) => [agent.id, index]));
    const eatIndex = new Map(eating.map((agent, index) => [agent.id, index]));
    const bubbles = [];

    for (const agent of agents) {
      const progress = agentProgress(agent, minute);
      let x = 0;
      let y = 0;
      let chip = null;
      let scale = 1;
      let walking = 0;
      let seated = false;
      let facing = agent.facing;
      let isRider = false;
      let riding = false;
      let background = false;
      let carryBag = false;

      if (agent.channel === "delivery") {
        // 배달 라이더의 생애주기: 도로로 진입 → 픽업 대기 → 가방 수령 → 퇴장
        isRider = true;
        const index = riderIndex.get(agent.id) ?? 0;
        const parkX = DOOR_X + 40 - (index % 5) * 52;
        if (agent.state === "phone") {
          x = lerp(W + 40, parkX, Math.min(1, progress * 1.6));
          y = ROAD_Y + 22;
          riding = progress < 0.62;
          facing = -1;
        } else if (agent.state === "queueing") {
          x = parkX;
          y = ROAD_Y + 22;
          facing = -1;
          if (agent.willAbandon && progress > 0.55) chip = "wait";
        } else if (agent.state === "pickup") {
          x = parkX;
          y = ROAD_Y + 22;
          facing = -1;
          chip = "order";
        } else if (agent.state === "leaving") {
          x = lerp(DOOR_X, -60, progress);
          y = ROAD_Y + 22;
          riding = true;
          facing = -1;
          if (agent.bubbleTone === "good") chip = "love";
          else if (agent.bubbleTone === "bad") chip = "sad";
        }
      } else if (agent.state === "walking") {
        // 행인은 뒷줄에서 작고 흐리게 — 아직 우리 손님이 아니다
        background = true;
        scale = 0.8;
        y = SIDEWALK_Y + 32 + agent.visualLane * 12;
        x = facing === 1 ? lerp(-40, DOOR_X - 90, progress) : lerp(W + 40, DOOR_X + 60, progress);
        walking = 1;
      } else if (agent.state === "considering") {
        x = DOOR_X - 40 + (agent.visualLane - 0.5) * 46;
        y = SIDEWALK_Y + 40;
        chip = "thinking";
      } else if (agent.state === "queueing") {
        const index = queueIndex.get(agent.id) ?? 0;
        if (index === 0) {
          x = DOOR_X + 12;
          y = SIDEWALK_Y + 34;
        } else {
          const row = Math.floor((index - 1) / 7);
          x = DOOR_X + 40 + ((index - 1) % 7) * 33;
          y = SIDEWALK_Y + 42 + row * 30;
          facing = -1;
        }
        scale = 0.95;
        const waitProgress = progress;
        if (agent.willAbandon && waitProgress > 0.5) chip = "wait";
      } else if (agent.state === "eating") {
        const spots = this.tableSpots ?? [];
        const index = eatIndex.get(agent.id) ?? 0;
        const spot = agent.tableId != null ? spots[agent.tableId] : spots[index % Math.max(1, spots.length)];
        if (spot) {
          const side = index % 2 === 0 ? -1 : 1;
          const seatX = spot.x + side * (artReady("bg") ? 58 : 38);
          const seatY = spot.y + 26;
          if (progress < 0.12) {
            // 입장 애니메이션: 문에서 자리까지 걸어 들어온다
            const walkIn = progress / 0.12;
            x = lerp(DOOR_X - 14, seatX, walkIn);
            y = lerp(SIDEWALK_Y - 24, seatY, walkIn);
            walking = 1;
            facing = -1;
            scale = 0.88;
          } else {
            x = seatX;
            y = seatY;
            facing = -side;
            seated = true;
            scale = 0.88;
            if (progress > 0.6 && agent.bubbleTone === "good") chip = "love";
          }
        } else {
          x = DOOR_X - 30;
          y = SIDEWALK_Y + 40;
        }
      } else if (agent.state === "pickup") {
        x = DOOR_X + 8;
        y = SIDEWALK_Y + 36;
        chip = "order";
      } else if (agent.state === "leaving") {
        const endX = agent.facing === 1 ? W + 50 : -50;
        if (agent.outcome === "lost_awareness" && !agent.flyered) {
          // 가게를 인지하지 못한 행인은 그냥 뒷줄로 지나간다 — 칩도 말풍선도 없다
          background = true;
          scale = 0.8;
          y = SIDEWALK_Y + 32 + agent.visualLane * 12;
          x = agent.facing === 1 ? lerp(DOOR_X - 90, endX, progress) : lerp(DOOR_X + 60, endX, progress);
          walking = 1;
        } else {
          // 가게와 얽힌 손님은 앞줄에서 또렷하게 — 결과가 아이콘으로 보인다
          y = SIDEWALK_Y + 60 + agent.visualLane * 16;
          x = lerp(DOOR_X - 16, endX, progress);
          walking = 1;
          carryBag = agent.channel !== "dine" && (agent.outcome === "satisfied" || agent.outcome === "dissatisfied");
          if (agent.outcome === "satisfied") chip = "love";
          else if (agent.outcome === "dissatisfied") chip = "sad";
          else if (agent.outcome?.startsWith("lost_")) {
            const reason = agent.outcome.slice(5);
            chip = reason === "price" ? "price" : reason === "wait" ? "wait" : reason === "full" ? "full" : progress < 0.4 ? "menu" : null;
          }
        }
      } else {
        continue;
      }

      ctx.save();
      if (background) ctx.globalAlpha = 0.8;
      if (isRider) {
        drawScooter(ctx, x, y, agent.customer.color, facing, riding, this.time + agent.randomKey);
        if (!riding) {
          drawCharacter(ctx, agent, x + 6, y - 8, { scale: 0.86, walking: 0, facing, time: this.time });
        } else {
          drawCharacter(ctx, agent, x - 2, y - 10, { scale: 0.84, walking: 0, facing, time: this.time });
        }
      } else {
        // 2인 일행은 동행자를 함께 그린다
        if (agent.partySize > 1 && !seated) {
          drawCharacter(ctx, { ...agent, randomKey: agent.randomKey + 3 }, x - 20 * facing, y, { scale: scale * 0.97, walking, facing, time: this.time + 1.3 });
        }
        drawCharacter(ctx, agent, x, y, { scale, walking, seated, facing, time: this.time });
        if (carryBag) {
          // 포장백 — 먹고 나가는 손님과 그냥 지나가는 행인이 한눈에 구분된다
          ctx.fillStyle = "#f4511e";
          roundedRect(ctx, x + 10 * facing, y - 20, 11, 14, 2);
          ctx.fill();
          ctx.strokeStyle = "#1b1c18";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
      ctx.restore();
      this.drawnAgents.push({ id: agent.id, x, y: y - 30, agent, background });

      if (chip && !background) drawEmotionChip(ctx, x, y - (artReady("bg") ? (seated ? 160 : 205) * scale : 72), chip, this.time + (agent.randomKey % 10));
      if (agent.bubble && !background && ["leaving", "eating", "pickup"].includes(agent.state)) {
        bubbles.push({ x, y: y - (artReady("bg") ? 120 : 0), text: agent.bubble, tone: agent.bubbleTone, priority: agent.bubbleTone === "bad" ? 0 : 1 });
      }
    }

    // 말풍선은 동시에 3개까지, 같은 문장은 한 번만 (겹침 방지, 나쁜 소식 우선)
    bubbles.sort((a, b) => a.priority - b.priority);
    const spoken = new Set();
    let shown = 0;
    for (const bubble of bubbles) {
      if (shown >= 3 || spoken.has(bubble.text)) continue;
      spoken.add(bubble.text);
      shown += 1;
      drawBubble(ctx, bubble.x, bubble.y, bubble.text, bubble.tone);
    }
  }

  drawWeather(ctx, snapshot, light) {
    if (snapshot.weather.id === "rain") {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.3;
      const wet = ctx.createLinearGradient(0, SIDEWALK_Y, 0, H);
      wet.addColorStop(0, "rgba(240, 198, 116, 0.32)");
      wet.addColorStop(1, "rgba(240, 198, 116, 0)");
      ctx.fillStyle = wet;
      ctx.fillRect(STORE.x - 60, SIDEWALK_Y, STORE.w + 120, H - SIDEWALK_Y);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = "rgba(190,214,228,.5)";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 110; i += 1) {
        const x = (i * 97 + this.time * 340) % (W + 60) - 30;
        const y = (i * 53 + this.time * 520) % H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 7, y + 20);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(30,40,60,.12)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (snapshot.weather.id === "hot") {
      ctx.fillStyle = "rgba(255,170,80,.05)";
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ─── 매장 내부 캠 (왼쪽 패널) ────────────────────────────────
// 바 안쪽을 크게 보여주고, 머신·쇼케이스·싱크를 직접 클릭해 개입한다.

const IW = 420;
const IH = 560;

export class InteriorScene {
  constructor(canvas, { format, menus, restaurantName }) {
    this.canvas = canvas;
    this.format = format;
    this.menus = menus;
    this.restaurantName = restaurantName;
    this.time = 0;
    this.view = {};
    this.floaters = [];
    this.hotspots = [];
    this.coinBursts = [];
  }

  addFloater(text, tone = "good", x = IW * 0.5, y = IH * 0.42) {
    this.floaters.push({ x, y, text, tone, life: 1.7 });
  }

  coinBurst() {
    for (let i = 0; i < 6; i += 1) {
      this.coinBursts.push({
        x: IW * 0.62 + (Math.random() - 0.5) * 20,
        y: IH * 0.46,
        vx: (Math.random() - 0.5) * 60,
        vy: -90 - Math.random() * 70,
        life: 0.9,
      });
    }
  }

  pick(cssX, cssY) {
    const { scale = 1, offsetX = 0, offsetY = 0 } = this.view;
    const x = (cssX - offsetX) / scale;
    const y = (cssY - offsetY) / scale;
    for (const spot of this.hotspots) {
      if (x >= spot.x && x <= spot.x + spot.w && y >= spot.y && y <= spot.y + spot.h) return spot.id;
    }
    return null;
  }

  draw(snapshot, deltaSeconds = 0.016) {
    this.time += deltaSeconds;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = 0.85; // 인테리어는 텍스트가 많아 도트를 촘촘하게
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const ctx = this.canvas.getContext("2d");
    const scale = Math.min(rect.width / IW, rect.height / IH);
    const offsetX = (rect.width - IW * scale) / 2;
    const offsetY = (rect.height - IH * scale) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    Object.assign(this.view, { scale, offsetX, offsetY });
    ctx.clearRect(0, 0, IW, IH);
    this.hotspots = [];

    const light = lightingFor(snapshot.gameMinute);
    const busyLanes = (snapshot.laneBusy ?? []).filter(Boolean).length;

    // 벽과 바닥 — 따뜻한 목재 톤
    ctx.fillStyle = mixColor("#f3e6ca", "#e8d3a8", light.night * 0.35);
    ctx.fillRect(0, 0, IW, IH);
    ctx.fillStyle = "#caa87a";
    ctx.fillRect(0, IH - 90, IW, 90);
    ctx.strokeStyle = "rgba(120,90,50,.3)";
    ctx.lineWidth = 1;
    for (let fx = 0; fx < IW; fx += 42) {
      ctx.beginPath();
      ctx.moveTo(fx, IH - 90);
      ctx.lineTo(fx - 14, IH);
      ctx.stroke();
    }

    // 선반 + 소품
    ctx.fillStyle = "#8c6a48";
    ctx.fillRect(24, 60, 170, 8);
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = ["#df7a30", "#f6f1e6", "#438a5b", "#f6f1e6", "#caa87a"][i];
      roundedRect(ctx, 34 + i * 32, 38, 18, 22, 3);
      ctx.fill();
    }
    // 메뉴 칠판
    ctx.fillStyle = "#26281f";
    roundedRect(ctx, 230, 26, 168, 66, 4);
    ctx.fill();
    ctx.fillStyle = "#f2ead8";
    ctx.font = "700 12px 'Noto Sans KR', Arial, sans-serif";
    ctx.textAlign = "left";
    this.menus.slice(0, 3).forEach((menu, index) => {
      ctx.fillText(`${menu.name}  ₩${Math.round(menu.price * 10000).toLocaleString("ko-KR")}`, 242, 48 + index * 17);
    });

    // 주문 티켓 레일 + 진행 바
    const queueing = snapshot.agents.filter((agent) => agent.state === "queueing" && !agent.willAbandon).slice(0, 5);
    ctx.fillStyle = "#514f47";
    ctx.fillRect(20, 112, IW - 40, 5);
    queueing.forEach((agent, index) => {
      const tx = 28 + index * 76;
      const progress = clamp((snapshot.gameMinute - agent.stateStart) / Math.max(0.01, agent.stateUntil - agent.stateStart));
      ctx.fillStyle = "#fff8e8";
      roundedRect(ctx, tx, 118, 66, 40, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(30,28,20,.4)";
      ctx.strokeRect(tx, 118, 66, 40);
      ctx.fillStyle = "#3c3a32";
      ctx.font = "700 10.5px 'Noto Sans KR', Arial, sans-serif";
      ctx.fillText(agent.menu?.name.slice(0, 6) ?? "주문", tx + 6, 132);
      ctx.fillStyle = "#e5ddc8";
      ctx.fillRect(tx + 6, 140, 54, 7);
      ctx.fillStyle = progress > 0.8 ? "#1f7a4f" : "#f4511e";
      ctx.fillRect(tx + 6, 140, 54 * progress, 7);
    });
    if (!queueing.length) {
      ctx.fillStyle = "rgba(60,58,50,.5)";
      ctx.font = "700 11px 'Noto Sans KR', Arial, sans-serif";
      ctx.fillText("대기 주문 없음", 28, 140);
    }

    // 에스프레소 머신 — 마모에 따라 클릭 유도
    const mx = 40;
    const my = 210;
    const wear = snapshot.machineWear ?? 0;
    ctx.fillStyle = "#2e3033";
    roundedRect(ctx, mx, my, 180, 86, 8);
    ctx.fill();
    ctx.fillStyle = "#43464a";
    roundedRect(ctx, mx + 8, my - 16, 164, 22, 5);
    ctx.fill();
    // 그룹헤드 2개와 샷 추출
    for (let g = 0; g < 2; g += 1) {
      const gx = mx + 48 + g * 74;
      ctx.fillStyle = "#1c1d1f";
      ctx.fillRect(gx - 12, my + 30, 24, 14);
      const pouring = g < busyLanes;
      if (pouring) {
        const flow = Math.abs(Math.sin(this.time * 7 + g));
        ctx.strokeStyle = `rgba(140,84,38,${0.6 + flow * 0.3})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(gx, my + 44);
        ctx.lineTo(gx, my + 62);
        ctx.stroke();
        ctx.fillStyle = "#f6f1e6";
        roundedRect(ctx, gx - 9, my + 62, 18, 13, 3);
        ctx.fill();
        // 김
        ctx.globalAlpha = 0.5 * flow;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(gx + 6, my + 52 - flow * 8, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // 스팀 완드
    ctx.strokeStyle = "#9aa0a6";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mx + 168, my + 22);
    ctx.lineTo(mx + 184, my + 52);
    ctx.stroke();
    if (busyLanes > 0) {
      const puff = Math.abs(Math.sin(this.time * 5));
      ctx.globalAlpha = 0.45 * puff;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(mx + 188, my + 44 - puff * 10, 6 + puff * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 마모 게이지
    const wearColor = wear > 0.65 ? "#c83b2f" : wear > 0.35 ? "#df7a30" : "#1f7a4f";
    ctx.fillStyle = "#1c1d1f";
    roundedRect(ctx, mx + 10, my + 8, 70, 12, 6);
    ctx.fill();
    ctx.fillStyle = wearColor;
    roundedRect(ctx, mx + 12, my + 10, 66 * wear, 8, 4);
    if (wear > 0.02) ctx.fill();
    ctx.fillStyle = "#f2ead8";
    ctx.font = "800 9px SFMono-Regular, monospace";
    ctx.fillText("WEAR", mx + 84, my + 18);
    if (wear > 0.65) {
      const pulse = 1 + Math.sin(this.time * 5) * 0.1;
      ctx.strokeStyle = "rgba(244,81,30,.9)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(mx - 6 * pulse, my - 22 * pulse, 192 + 12 * pulse, 114 + 24 * pulse);
      ctx.setLineDash([]);
      ctx.fillStyle = "#c83b2f";
      ctx.font = "800 11px 'Noto Sans KR', Arial, sans-serif";
      ctx.fillText("청소 필요! 클릭", mx + 44, my + 110);
    }
    this.hotspots.push({ id: "machine", x: mx - 8, y: my - 24, w: 200, h: 130 });

    // 지금 내리는 잔 — 진행 중인 음료가 하나씩 완성된다
    const brewing = snapshot.agents
      .filter((agent) => agent.state === "queueing" && !agent.willAbandon && agent.menu)
      .slice(0, 3);
    brewing.forEach((agent, index) => {
      const bx = 40 + index * 62;
      const by = 314;
      const progress = clamp((snapshot.gameMinute - agent.stateStart) / Math.max(0.01, agent.stateUntil - agent.stateStart));
      ctx.fillStyle = "rgba(20,16,13,.75)";
      roundedRect(ctx, bx, by, 54, 46, 5);
      ctx.fill();
      // 잔 안에 커피가 차오른다
      ctx.fillStyle = "#efe6d8";
      roundedRect(ctx, bx + 16, by + 8, 22, 20, 3);
      ctx.fill();
      const fill = 18 * progress;
      ctx.fillStyle = agent.menu.milk ? "#d8c39a" : "#5a3418";
      ctx.fillRect(bx + 17, by + 27 - fill, 20, fill);
      if (progress > 0.75) {
        ctx.fillStyle = "#f0c674";
        ctx.fillRect(bx + 17, by + 9 - 0, 20, 3);
      }
      ctx.fillStyle = "#9c8b7c";
      ctx.font = "700 8px 'Noto Sans KR', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(agent.menu.name.slice(0, 5), bx + 27, by + 40);
      ctx.textAlign = "left";
    });

    // 쇼케이스 — 재고가 그대로 보인다
    const cx = 258;
    const cy = 210;
    const caseMenus = this.menus.filter((menu) => menu.caseItem);
    ctx.fillStyle = "#8c6a48";
    roundedRect(ctx, cx, cy - 14, 140, 116, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(214,232,238,.55)";
    roundedRect(ctx, cx + 6, cy - 8, 128, 96, 4);
    ctx.fill();
    if (caseMenus.length) {
      caseMenus.forEach((menu, row) => {
        const stock = snapshot.caseStock?.[menu.id] ?? 0;
        const sy = cy + 8 + row * 30;
        ctx.fillStyle = "#5f4433";
        ctx.fillRect(cx + 10, sy + 16, 120, 3);
        const show = Math.min(6, stock);
        for (let i = 0; i < show; i += 1) {
          ctx.fillStyle = menu.id === "cheesecake" ? "#f3d98c" : menu.id === "saltbread" ? "#d9a35c" : "#c98a4b";
          ctx.beginPath();
          ctx.ellipse(cx + 20 + i * 18, sy + 10, 8, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (stock <= 0) {
          ctx.fillStyle = "#c83b2f";
          ctx.font = "800 10px 'Noto Sans KR', Arial, sans-serif";
          ctx.fillText("SOLD OUT — 클릭해 보충", cx + 12, sy + 12);
        } else {
          ctx.fillStyle = "#3c3a32";
          ctx.font = "800 9px SFMono-Regular, monospace";
          ctx.fillText(`×${stock}`, cx + 112, sy + 12);
        }
      });
      if (snapshot.pendingRestock) {
        const remain = Math.max(0, snapshot.pendingRestock.readyAt - snapshot.gameMinute);
        ctx.fillStyle = "#df7a30";
        ctx.font = "800 10px 'Noto Sans KR', Arial, sans-serif";
        ctx.fillText(`준비 중… ${Math.ceil(remain)}분`, cx + 14, cy + 96);
      }
      this.hotspots.push({ id: "case", x: cx, y: cy - 14, w: 140, h: 120 });
    } else {
      ctx.fillStyle = "rgba(60,58,50,.5)";
      ctx.font = "700 10.5px 'Noto Sans KR', Arial, sans-serif";
      ctx.fillText("디저트 메뉴 없음", cx + 24, cy + 40);
    }

    // 카운터 + 포스기 + 쿠폰 도장통
    ctx.fillStyle = "#6d4a36";
    ctx.fillRect(0, 330, IW, 26);
    ctx.fillStyle = "#5a3c2b";
    ctx.fillRect(0, 356, IW, 12);
    ctx.fillStyle = "#26281f";
    roundedRect(ctx, 178, 296, 52, 36, 4);
    ctx.fill();
    ctx.fillStyle = "#72f6b8";
    ctx.fillRect(184, 302, 40, 18);
    // 쿠폰 도장통 — 오늘 생긴 단골만큼 카드가 쌓인다
    const regulars = snapshot.metrics?.repeatIntent ?? 0;
    ctx.fillStyle = "rgba(214,232,238,.7)";
    roundedRect(ctx, 352, 296, 34, 36, 4);
    ctx.fill();
    const cardLevel = Math.min(26, regulars * 0.9);
    ctx.fillStyle = "#e8b34b";
    ctx.fillRect(354, 330 - cardLevel, 30, cardLevel);
    ctx.fillStyle = "#3c3a32";
    ctx.font = "800 8.5px SFMono-Regular, monospace";
    ctx.textAlign = "center";
    ctx.fillText("단골", 369, 292);
    ctx.textAlign = "left";

    // 주방 작업대 — 손이 멈추지 않는 자리
    const prepX = 40;
    const prepY = 384;
    ctx.fillStyle = "#43453f";
    roundedRect(ctx, prepX, prepY, 120, 46, 5);
    ctx.fill();
    ctx.fillStyle = "#2c2e2a";
    ctx.fillRect(prepX + 10, prepY + 8, 100, 30);
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = ["#d9a45c", "#efe6d8", "#c98a4b", "#8c6f4e"][i];
      ctx.beginPath();
      ctx.ellipse(prepX + 26 + i * 24, prepY + 4, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(156,139,124,.8)";
    ctx.font = "800 10px 'Noto Sans KR', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(this.format.bakes ? "베이커 작업대" : "프렙 작업대", prepX + 4, prepY + 62);

    // 바리스타 — 손님이 없어도 잔을 닦고 세팅한다. 멈춰 있지 않는다.
    const staffColor = busyLanes > 0 ? "#e8e2d4" : "#d9d3c4";
    drawCharacter(ctx, { randomKey: 3, customer: { color: staffColor, id: "staff" }, facing: 1 }, 118, 322, { scale: 1.12, walking: 1, time: this.time * (busyLanes ? 1.9 : 0.9) });
    ctx.fillStyle = "#f6f1e6";
    roundedRect(ctx, 110, 238, 16, 11, 3);
    ctx.fill();

    // 베이커 — 작업대에서 계속 반죽을 민다
    if (this.format.bakes) {
      const knead = Math.sin(this.time * 3.4) * 5;
      drawCharacter(ctx, { randomKey: 11, customer: { color: "#ede4d2", id: "baker" }, facing: 1 }, 74 + knead, 382, { scale: 1.0, walking: 1, time: this.time * 2.6 });
      ctx.fillStyle = "#f6f1e6";
      roundedRect(ctx, 66 + knead, 308, 15, 10, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.beginPath();
      ctx.ellipse(96 + knead, 374, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 너무 바쁘면 홀 알바가 바 안쪽으로 들어와 같이 뽑는다
    if (busyLanes >= 2 && (snapshot.hallStaff ?? 0) > 0) {
      drawCharacter(ctx, { randomKey: 21, customer: { color: "#8c6f4e", id: "staff" }, facing: -1 }, 178, 322, { scale: 1.05, walking: 1, time: this.time * 2.1 });
      ctx.fillStyle = "rgba(217,164,65,.9)";
      ctx.font = "800 9px 'Noto Sans KR', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("홀 지원", 178, 244);
      ctx.textAlign = "left";
    }

    // 사장이 키친에 서 있으면 직접 샷을 내린다
    if (snapshot.stationActive === "bar") {
      drawCharacter(ctx, { randomKey: 77, customer: { color: snapshot.ownerLook?.color ?? "#2c2620", id: "owner" }, facing: -1 }, 258, 322, { scale: 1.16, walking: 1, time: this.time * 2.2, hair: snapshot.ownerLook?.hair });
      ctx.fillStyle = "#d9a441";
      ctx.beginPath();
      ctx.arc(258, 232, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#14100d";
      ctx.font = "800 9px 'Noto Sans KR', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("사장", 258, 235);
      ctx.textAlign = "left";
      for (let i = 0; i < 3; i += 1) {
        const p = (this.time * 1.1 + i * 0.33) % 1;
        ctx.globalAlpha = (1 - p) * 0.42;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(274 + Math.sin(p * 7) * 5, 292 - p * 40, 4 + p * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 코인 버스트
    this.coinBursts = this.coinBursts.filter((coin) => coin.life > 0);
    for (const coin of this.coinBursts) {
      coin.life -= deltaSeconds;
      coin.x += coin.vx * deltaSeconds;
      coin.y += coin.vy * deltaSeconds;
      coin.vy += 320 * deltaSeconds;
      ctx.globalAlpha = Math.max(0, coin.life);
      ctx.fillStyle = "#e8b34b";
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a87b1e";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 후처리 — 바 조명의 번짐과 질감
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    glowDot(ctx, IW * 0.34, 236, 190, "#F0C674", 0.16);
    if (busyLanes > 0) glowDot(ctx, IW * 0.28, 262, 120, "#D9A441", 0.2);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    const warm = ctx.createLinearGradient(0, 0, 0, IH);
    warm.addColorStop(0, "rgba(255, 205, 130, 0.14)");
    warm.addColorStop(1, "rgba(40, 20, 10, 0.2)");
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, IW, IH);
    ctx.restore();
    vignette(ctx, IW, IH, 0.4);
    grain(ctx, IW, IH, 0.05);

    // 플로터
    this.floaters = this.floaters.filter((floater) => floater.life > 0);
    for (const floater of this.floaters) {
      floater.life -= deltaSeconds;
      floater.y -= deltaSeconds * 30;
      ctx.save();
      ctx.globalAlpha = Math.min(1, floater.life);
      ctx.font = "800 17px 'Noto Sans KR', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(16,16,14,.8)";
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillStyle = floater.tone === "bad" ? "#ff9d8a" : floater.tone === "neutral" ? "#f2ead8" : "#78e0a0";
      ctx.fillText(floater.text, floater.x, floater.y);
      ctx.restore();
    }
  }
}

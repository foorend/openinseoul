// 선택 화면용 일러스트레이션과 공용 렌더 유틸.
// 모든 선택지는 글이 아니라 그림으로 먼저 이해되어야 한다.

export const PALETTE = {
  ink: "#0F0B09",
  ground: "#17110E",
  panel: "#221A15",
  panelUp: "#2C221B",
  line: "#3B2E25",
  crema: "#D9A441",
  cremaSoft: "#F0C674",
  copper: "#B4674D",
  steam: "#E8DCCE",
  muted: "#8C7A6C",
  jade: "#5FA57C",
  clay: "#C25A4A",
  sky: "#4A6E86",
};

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function rgb(color) {
  if (color.startsWith("rgb")) {
    const parts = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (parts?.length === 3) return { r: parts[0], g: parts[1], b: parts[2] };
  }
  let hex = color.replace("#", "");
  // #fff 같은 3자리 축약형을 6자리로 펴준다 (안 하면 blue 채널이 NaN이 된다)
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function mix(a, b, t) {
  const ca = rgb(a);
  const cb = rgb(b);
  const amount = Math.min(1, Math.max(0, t));
  return `rgb(${Math.round(lerp(ca.r, cb.r, amount))}, ${Math.round(lerp(ca.g, cb.g, amount))}, ${Math.round(lerp(ca.b, cb.b, amount))})`;
}

export function alpha(color, a) {
  const c = rgb(color);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

export function roundRect(ctx, x, y, w, h, r = 8) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// ── 공용 후처리 ─────────────────────────────────────────────
// 평면적인 캔버스를 사진처럼 보이게 만드는 세 겹: 광원 번짐, 비네팅, 필름 그레인.

export function glowDot(ctx, x, y, radius, color, strength = 1) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, alpha(color, 0.85 * strength));
  gradient.addColorStop(0.4, alpha(color, 0.3 * strength));
  gradient.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function lightCone(ctx, x, y, width, height, color, strength = 0.18) {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, alpha(color, strength));
  gradient.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x - width * 0.18, y);
  ctx.lineTo(x + width * 0.18, y);
  ctx.lineTo(x + width * 0.62, y + height);
  ctx.lineTo(x - width * 0.62, y + height);
  ctx.closePath();
  ctx.fill();
}

export function vignette(ctx, w, h, strength = 0.55) {
  const gradient = ctx.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.22, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

let grainTile = null;

export function grain(ctx, w, h, opacity = 0.05) {
  if (!grainTile) {
    const size = 128;
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const tctx = tile.getContext("2d");
    const image = tctx.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const noise = 120 + Math.random() * 135;
      image.data[i] = noise;
      image.data[i + 1] = noise;
      image.data[i + 2] = noise;
      image.data[i + 3] = 255;
    }
    tctx.putImageData(image, 0, 0);
    grainTile = tile;
  }
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = "overlay";
  const pattern = ctx.createPattern(grainTile, "repeat");
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// 바닥 반사 — 아래로 뒤집어 그리고 페이드시킨다.
export function reflect(ctx, drawFn, baselineY, height, opacity = 0.2) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(0, baselineY * 2);
  ctx.scale(1, -1);
  ctx.beginPath();
  ctx.rect(-9999, baselineY - height, 19998, height);
  ctx.clip();
  drawFn(ctx);
  ctx.restore();
}

// ── 인물 실루엣 ──────────────────────────────────────────────

export function figure(ctx, x, y, scale, color, options = {}) {
  const { facing = 1, walk = 0, seated = false, hat = null, prop = null, rim = PALETTE.crema } = options;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 림 라이트: 실루엣 뒤에 얇은 빛 테두리를 깔아 입체로 만든다
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8 * facing, -40);
  ctx.lineTo(-8 * facing, -14);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = mix(color, "#000", 0.55);
  ctx.lineWidth = 4.6;
  ctx.lineCap = "round";
  if (seated) {
    ctx.beginPath();
    ctx.moveTo(-3, -14);
    ctx.lineTo(7 * facing, -8);
    ctx.lineTo(7 * facing, 0);
    ctx.moveTo(4, -14);
    ctx.lineTo(12 * facing, -9);
    ctx.lineTo(12 * facing, 0);
    ctx.stroke();
  } else {
    const step = walk ? Math.sin(walk) * 6 : 0;
    ctx.beginPath();
    ctx.moveTo(-3, -16);
    ctx.lineTo(-3 + step, 0);
    ctx.moveTo(4, -16);
    ctx.lineTo(4 - step, 0);
    ctx.stroke();
  }

  const body = ctx.createLinearGradient(-10, -42, 10, -13);
  body.addColorStop(0, mix(color, "#fff", 0.18));
  body.addColorStop(1, mix(color, "#000", 0.3));
  ctx.fillStyle = body;
  roundRect(ctx, -10, -42, 20, 29, 7);
  ctx.fill();

  ctx.strokeStyle = mix(color, "#000", 0.2);
  ctx.lineWidth = 5;
  const swing = walk ? Math.sin(walk + Math.PI) * 5 : 0;
  ctx.beginPath();
  ctx.moveTo(-8, -36);
  ctx.lineTo(-11 + swing * 0.4, -22);
  ctx.moveTo(8, -36);
  ctx.lineTo(11 - swing * 0.4, -22);
  ctx.stroke();

  const head = ctx.createRadialGradient(-2, -55, 1, 0, -52, 10);
  head.addColorStop(0, "#F2C9A2");
  head.addColorStop(1, "#C99A72");
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(0, -52, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#241C17";
  ctx.beginPath();
  ctx.arc(0, -54.5, 8.3, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();

  if (hat === "cap") {
    ctx.fillStyle = PALETTE.steam;
    roundRect(ctx, -8, -64, 16, 10, 3);
    ctx.fill();
  } else if (hat === "beanie") {
    ctx.fillStyle = mix(color, "#000", 0.4);
    ctx.beginPath();
    ctx.arc(0, -56, 9, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  if (prop === "cup") {
    ctx.fillStyle = PALETTE.steam;
    roundRect(ctx, 10 * facing, -30, 8, 10, 2);
    ctx.fill();
  } else if (prop === "laptop") {
    ctx.fillStyle = "#4A4139";
    roundRect(ctx, -14, -26, 28, 4, 1);
    ctx.fill();
    ctx.fillStyle = "#6E6154";
    ctx.beginPath();
    ctx.moveTo(-12, -26);
    ctx.lineTo(-8, -40);
    ctx.lineTo(12, -40);
    ctx.lineTo(12, -26);
    ctx.closePath();
    ctx.fill();
  } else if (prop === "bag") {
    ctx.fillStyle = PALETTE.copper;
    roundRect(ctx, 11 * facing, -28, 10, 13, 2);
    ctx.fill();
  } else if (prop === "phone") {
    ctx.fillStyle = "#1B1713";
    ctx.fillRect(11 * facing, -34, 4, 8);
  }
  ctx.restore();
}

// ── 카드 프레임 ─────────────────────────────────────────────

function frame(ctx, w, h, top, bottom) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
}

function floor(ctx, w, h, y, color) {
  const g = ctx.createLinearGradient(0, y, 0, h);
  g.addColorStop(0, color);
  g.addColorStop(1, mix(color, "#000", 0.6));
  ctx.fillStyle = g;
  ctx.fillRect(0, y, w, h - y);
}

function towers(ctx, w, baseY, specs, lit) {
  for (const [x, top, width, cols, rows, tint] of specs) {
    const g = ctx.createLinearGradient(x, top, x + width, baseY);
    g.addColorStop(0, mix(tint, "#fff", 0.06));
    g.addColorStop(1, mix(tint, "#000", 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(x, top, width, baseY - top);
    const padX = 8;
    const cw = (width - padX * 2) / cols;
    const ch = (baseY - top - 16) / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const on = ((r * 13 + c * 29 + x) % 100) / 100 < lit;
        ctx.fillStyle = on ? alpha(PALETTE.cremaSoft, 0.8) : alpha("#0B0F16", 0.55);
        ctx.fillRect(x + padX + c * cw, top + 10 + r * ch, Math.max(2, cw - 5), Math.max(3, ch - 7));
      }
    }
  }
}

// 카드 상단에 붙는 한 줄 캡션 — 하단은 UI 그라디언트에 가려지므로 위에 둔다.
function caption(ctx, w, text, color = PALETTE.steam) {
  ctx.save();
  ctx.font = "700 11px system-ui, sans-serif";
  const width = ctx.measureText(text).width + 18;
  ctx.fillStyle = alpha("#0C0908", 0.66);
  roundRect(ctx, w / 2 - width / 2, 10, width, 22, 11);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, 22);
  ctx.restore();
}

// ── 상권 일러스트 ────────────────────────────────────────────

const DISTRICT_ART = {
  gangnam(ctx, w, h, t) {
    frame(ctx, w, h, "#2A3E52", "#C98A55");
    // 아침 해
    glowDot(ctx, w * 0.76, h * 0.3, 120, PALETTE.cremaSoft, 0.75);
    ctx.fillStyle = alpha("#FFE1A8", 0.9);
    ctx.beginPath();
    ctx.arc(w * 0.76, h * 0.3, 26, 0, Math.PI * 2);
    ctx.fill();
    towers(ctx, w, h * 0.78, [
      [w * 0.02, h * 0.1, w * 0.16, 3, 11, "#26303C"],
      [w * 0.2, h * 0.22, w * 0.14, 3, 8, "#2E3B49"],
      [w * 0.36, h * 0.04, w * 0.17, 4, 13, "#222B36"],
      [w * 0.55, h * 0.18, w * 0.13, 3, 9, "#2B3743"],
      [w * 0.85, h * 0.12, w * 0.18, 4, 11, "#232C38"],
    ], 0.42);
    floor(ctx, w, h, h * 0.78, "#3A3730");
    // 출근 행렬 — 전부 컵을 들고 있다
    for (let i = 0; i < 6; i += 1) {
      const x = w * (0.08 + i * 0.16) + Math.sin(t * 0.6 + i) * 5;
      figure(ctx, x, h * 0.93, 0.62, ["#39536B", "#3E4A5A", "#4A5568"][i % 3], {
        walk: t * 3 + i, prop: "cup", facing: 1, rim: PALETTE.cremaSoft,
      });
    }
  },
  euljiro(ctx, w, h, t) {
    frame(ctx, w, h, "#141A26", "#2A2129");
    // 좁은 골목: 양옆 셔터 벽이 원근으로 좁아진다
    ctx.fillStyle = "#1E1B1C";
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w * 0.28, h * 0.2); ctx.lineTo(w * 0.28, h * 0.9); ctx.lineTo(0, h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#221D1E";
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w * 0.72, h * 0.2); ctx.lineTo(w * 0.72, h * 0.9); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();
    // 셔터 골
    ctx.strokeStyle = alpha("#000", 0.35);
    ctx.lineWidth = 2;
    for (let i = 1; i < 9; i += 1) {
      ctx.beginPath();
      ctx.moveTo(w * 0.28 * (i / 9), lerp(0, h * 0.2, i / 9));
      ctx.lineTo(w * 0.28 * (i / 9), lerp(h, h * 0.9, i / 9));
      ctx.stroke();
    }
    // 골목 끝의 카페 창 — 유일한 따뜻한 빛
    const glow = 0.8 + Math.sin(t * 1.4) * 0.08;
    lightCone(ctx, w * 0.5, h * 0.34, w * 0.5, h * 0.66, PALETTE.crema, 0.2 * glow);
    ctx.fillStyle = alpha(PALETTE.cremaSoft, 0.92);
    roundRect(ctx, w * 0.4, h * 0.36, w * 0.2, h * 0.3, 4);
    ctx.fill();
    glowDot(ctx, w * 0.5, h * 0.5, 90, PALETTE.crema, 0.7 * glow);
    // 네온 간판
    ctx.save();
    ctx.shadowColor = PALETTE.copper;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "#E8836A";
    ctx.lineWidth = 3;
    roundRect(ctx, w * 0.61, h * 0.26, w * 0.1, h * 0.14, 3);
    ctx.stroke();
    ctx.restore();
    floor(ctx, w, h, h * 0.9, "#26211F");
    figure(ctx, w * 0.44, h * 0.98, 0.6, "#5A4A57", { walk: t * 2, prop: "phone", facing: 1 });
  },
  seongsu(ctx, w, h, t) {
    frame(ctx, w, h, "#3A4351", "#8E6A4E");
    // 벽돌 공장 파사드 + 아치창
    ctx.fillStyle = "#7A4A38";
    ctx.fillRect(w * 0.08, h * 0.16, w * 0.84, h * 0.66);
    ctx.strokeStyle = alpha("#000", 0.18);
    ctx.lineWidth = 1;
    for (let r = 0; r < 14; r += 1) {
      const y = h * 0.16 + r * (h * 0.66 / 14);
      ctx.beginPath(); ctx.moveTo(w * 0.08, y); ctx.lineTo(w * 0.92, y); ctx.stroke();
      for (let c = 0; c < 10; c += 1) {
        const x = w * 0.08 + (c + (r % 2) * 0.5) * (w * 0.84 / 10);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h * 0.66 / 14); ctx.stroke();
      }
    }
    // 아치창 3개
    for (let i = 0; i < 3; i += 1) {
      const cx = w * (0.24 + i * 0.26);
      ctx.save();
      ctx.fillStyle = alpha(PALETTE.cremaSoft, 0.88);
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.07, h * 0.7);
      ctx.lineTo(cx - w * 0.07, h * 0.42);
      ctx.arc(cx, h * 0.42, w * 0.07, Math.PI, 0);
      ctx.lineTo(cx + w * 0.07, h * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      glowDot(ctx, cx, h * 0.52, 62, PALETTE.crema, 0.45);
    }
    floor(ctx, w, h, h * 0.82, "#4A403A");
    // 웨이팅 줄 — 전부 사진을 찍는다
    for (let i = 0; i < 5; i += 1) {
      const x = w * (0.16 + i * 0.15);
      figure(ctx, x, h * 0.96, 0.6, ["#C9705A", "#7C6BA8", "#4E7A8C", "#B98A4E", "#8C5A72"][i], {
        prop: i % 2 === 0 ? "phone" : "cup", walk: 0, facing: -1,
      });
    }
  },
  sinchon(ctx, w, h, t) {
    frame(ctx, w, h, "#2C3A46", "#7E7A63");
    towers(ctx, w, h * 0.62, [
      [w * 0.0, h * 0.2, w * 0.22, 3, 7, "#333E48"],
      [w * 0.8, h * 0.16, w * 0.24, 3, 8, "#2E3841"],
    ], 0.3);
    // 대학 정문 아치
    ctx.strokeStyle = "#6B6355";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.62);
    ctx.lineTo(w * 0.28, h * 0.34);
    ctx.arc(w * 0.5, h * 0.34, w * 0.22, Math.PI, 0);
    ctx.lineTo(w * 0.72, h * 0.62);
    ctx.stroke();
    // 통창 카페 — 안에 노트북 줄지어 앉은 실루엣
    ctx.fillStyle = alpha("#F2E4C8", 0.9);
    roundRect(ctx, w * 0.14, h * 0.5, w * 0.72, h * 0.3, 3);
    ctx.fill();
    ctx.fillStyle = alpha(PALETTE.ink, 0.72);
    for (let i = 0; i < 4; i += 1) {
      figure(ctx, w * (0.24 + i * 0.18), h * 0.78, 0.5, "#4A5560", { seated: true, prop: "laptop", facing: 1 });
    }
    glowDot(ctx, w * 0.5, h * 0.64, 130, PALETTE.crema, 0.3);
    floor(ctx, w, h, h * 0.8, "#4E4A3E");
    // 콘센트 아이콘 — 이 상권의 진짜 자원
    ctx.fillStyle = PALETTE.crema;
    for (let i = 0; i < 3; i += 1) {
      const x = w * (0.3 + i * 0.2);
      roundRect(ctx, x, h * 0.86, 16, 12, 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(x + 4, h * 0.885, 3, 5);
      ctx.fillRect(x + 10, h * 0.885, 3, 5);
      ctx.fillStyle = PALETTE.crema;
    }
  },
  gangdong(ctx, w, h, t) {
    frame(ctx, w, h, "#31404E", "#9A8C6E");
    towers(ctx, w, h * 0.7, [
      [w * 0.02, h * 0.18, w * 0.2, 3, 9, "#3B4753"],
      [w * 0.24, h * 0.12, w * 0.2, 3, 10, "#404C58"],
      [w * 0.56, h * 0.16, w * 0.2, 3, 9, "#3A4652"],
      [w * 0.78, h * 0.2, w * 0.2, 3, 8, "#44505C"],
    ], 0.5);
    // 상가 1층 + 나무
    ctx.fillStyle = "#5A4E3E";
    ctx.fillRect(0, h * 0.7, w, h * 0.12);
    ctx.fillStyle = alpha(PALETTE.cremaSoft, 0.85);
    roundRect(ctx, w * 0.3, h * 0.72, w * 0.4, h * 0.08, 2);
    ctx.fill();
    for (const tx of [w * 0.12, w * 0.86]) {
      ctx.fillStyle = "#3E6B4A";
      ctx.beginPath();
      ctx.arc(tx, h * 0.66, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4A3A2C";
      ctx.fillRect(tx - 4, h * 0.66, 8, h * 0.12);
    }
    floor(ctx, w, h, h * 0.82, "#57503F");
    // 유모차 + 배달 스쿠터
    figure(ctx, w * 0.34, h * 0.96, 0.62, "#4E7A8C", { walk: t * 2, facing: 1 });
    ctx.strokeStyle = "#2A2620";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w * 0.4, h * 0.955, 7, 0, Math.PI * 2);
    ctx.arc(w * 0.46, h * 0.955, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#B9855A";
    roundRect(ctx, w * 0.39, h * 0.9, w * 0.08, 18, 4);
    ctx.fill();
    // 배달 스쿠터
    const sx = w * 0.72 + Math.sin(t * 0.9) * w * 0.06;
    ctx.strokeStyle = "#1F1B17";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx - 16, h * 0.96, 8, 0, Math.PI * 2);
    ctx.arc(sx + 14, h * 0.96, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.copper;
    roundRect(ctx, sx - 22, h * 0.9, 30, 12, 4);
    ctx.fill();
    ctx.fillStyle = "#26221C";
    roundRect(ctx, sx - 28, h * 0.85, 16, 16, 3);
    ctx.fill();
  },
};

// ── 카페 유형 일러스트 (단면 인테리어) ────────────────────────

function barCounter(ctx, w, h, x, width, top) {
  const g = ctx.createLinearGradient(x, top, x, h * 0.9);
  g.addColorStop(0, "#6B4A34");
  g.addColorStop(1, "#3E2B1E");
  ctx.fillStyle = g;
  roundRect(ctx, x, top, width, h * 0.9 - top, 4);
  ctx.fill();
  ctx.fillStyle = alpha("#E8DCCE", 0.14);
  ctx.fillRect(x, top, width, 5);
}

function espressoMachine(ctx, x, y, scale, groups, t, busy = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const body = ctx.createLinearGradient(0, -46, 0, 6);
  body.addColorStop(0, "#4B4F54");
  body.addColorStop(0.4, "#2E3236");
  body.addColorStop(1, "#191C1F");
  ctx.fillStyle = body;
  roundRect(ctx, -60, -46, 120, 52, 7);
  ctx.fill();
  // 크롬 하이라이트
  ctx.fillStyle = alpha("#E8F0F5", 0.28);
  roundRect(ctx, -56, -43, 112, 6, 3);
  ctx.fill();
  ctx.fillStyle = "#12151A";
  roundRect(ctx, -52, -34, 104, 16, 3);
  ctx.fill();
  for (let g = 0; g < groups; g += 1) {
    const gx = groups === 1 ? 0 : -26 + g * (52 / Math.max(1, groups - 1));
    ctx.fillStyle = "#14171A";
    ctx.fillRect(gx - 11, 4, 22, 12);
    if (busy) {
      const flow = Math.abs(Math.sin(t * 6 + g * 1.3));
      ctx.strokeStyle = alpha("#8A5326", 0.75 + flow * 0.2);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(gx, 16);
      ctx.lineTo(gx, 30);
      ctx.stroke();
      ctx.fillStyle = "#EFE6D8";
      roundRect(ctx, gx - 8, 30, 16, 12, 3);
      ctx.fill();
      ctx.fillStyle = alpha(PALETTE.crema, 0.9);
      roundRect(ctx, gx - 7, 30, 14, 3.5, 2);
      ctx.fill();
    }
  }
  // 스팀 완드
  ctx.strokeStyle = "#9DA5AC";
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(56, -14);
  ctx.lineTo(66, 10);
  ctx.stroke();
  ctx.restore();
  if (busy) {
    for (let i = 0; i < 3; i += 1) {
      const p = (t * 0.9 + i * 0.33) % 1;
      ctx.globalAlpha = (1 - p) * 0.4;
      ctx.fillStyle = "#FFF";
      ctx.beginPath();
      ctx.arc(x + 66 * scale + Math.sin(p * 6) * 5, y + 6 * scale - p * 46, (3 + p * 7) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function showcase(ctx, x, y, w, h, rows, filled) {
  ctx.fillStyle = "#6B4A34";
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  const glass = ctx.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, alpha("#CFE3EA", 0.4));
  glass.addColorStop(0.5, alpha("#CFE3EA", 0.16));
  glass.addColorStop(1, alpha("#CFE3EA", 0.36));
  ctx.fillStyle = glass;
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 3);
  ctx.fill();
  for (let r = 0; r < rows; r += 1) {
    const sy = y + 12 + r * ((h - 18) / rows);
    ctx.fillStyle = "#5A3E2C";
    ctx.fillRect(x + 6, sy + 11, w - 12, 2.5);
    const count = filled ? 5 : 2;
    for (let i = 0; i < count; i += 1) {
      ctx.fillStyle = ["#D9A45C", "#C98A4B", "#E3C07E"][i % 3];
      ctx.beginPath();
      ctx.ellipse(x + 14 + i * ((w - 24) / 5), sy + 6, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const FORMAT_ART = {
  solo_cafe(ctx, w, h, t) {
    frame(ctx, w, h, "#241C17", "#100C0A");
    lightCone(ctx, w * 0.5, 0, w * 0.7, h * 0.8, PALETTE.crema, 0.12);
    floor(ctx, w, h, h * 0.86, "#3A2C22");
    barCounter(ctx, w, h, w * 0.16, w * 0.68, h * 0.62);
    espressoMachine(ctx, w * 0.4, h * 0.58, 0.62, 1, t, true);
    // 사장 혼자, 사이드에 잔 몇 개
    figure(ctx, w * 0.66, h * 0.7, 0.78, "#2C2620", { hat: "cap", walk: t * 4, facing: -1 });
    caption(ctx, w, "8 SEATS · 혼자 다 한다");
    // 작은 좌석 두 개
    for (let i = 0; i < 2; i += 1) {
      ctx.fillStyle = "#4A3628";
      roundRect(ctx, w * (0.1 + i * 0.72), h * 0.72, 26, 6, 2);
      ctx.fill();
      ctx.fillRect(w * (0.1 + i * 0.72) + 10, h * 0.72 + 6, 6, 22);
    }
    glowDot(ctx, w * 0.4, h * 0.52, 90, PALETTE.crema, 0.45);
  },
  specialty_cafe(ctx, w, h, t) {
    frame(ctx, w, h, "#26201B", "#120E0C");
    lightCone(ctx, w * 0.3, 0, w * 0.5, h * 0.8, PALETTE.crema, 0.14);
    lightCone(ctx, w * 0.72, 0, w * 0.4, h * 0.8, PALETTE.crema, 0.1);
    floor(ctx, w, h, h * 0.86, "#3E2F24");
    barCounter(ctx, w, h, w * 0.04, w * 0.56, h * 0.6);
    espressoMachine(ctx, w * 0.24, h * 0.56, 0.72, 2, t, true);
    // 드립 스테이션
    ctx.strokeStyle = "#B9895A";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.46, h * 0.5);
    ctx.lineTo(w * 0.46, h * 0.6);
    ctx.stroke();
    ctx.fillStyle = alpha("#E8DCCE", 0.9);
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.44); ctx.lineTo(w * 0.5, h * 0.44); ctx.lineTo(w * 0.46, h * 0.5);
    ctx.closePath(); ctx.fill();
    // 바리스타 + 홀 알바
    figure(ctx, w * 0.16, h * 0.72, 0.76, "#E4DCCC", { hat: "cap", walk: t * 5, facing: 1 });
    figure(ctx, w * 0.66, h * 0.82, 0.72, "#8C6F4E", { walk: t * 3, facing: -1, prop: "cup" });
    // 바 좌석
    for (let i = 0; i < 4; i += 1) {
      const x = w * (0.62 + i * 0.1);
      ctx.fillStyle = "#4A3628";
      ctx.fillRect(x, h * 0.7, 5, 22);
      ctx.beginPath();
      ctx.ellipse(x + 2.5, h * 0.7, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    glowDot(ctx, w * 0.24, h * 0.5, 100, PALETTE.crema, 0.5);
    caption(ctx, w, "18 SEATS · 바리스타 + 홀");
  },
  bakery_cafe(ctx, w, h, t) {
    frame(ctx, w, h, "#2A211A", "#130E0B");
    lightCone(ctx, w * 0.28, 0, w * 0.5, h * 0.8, PALETTE.crema, 0.16);
    floor(ctx, w, h, h * 0.86, "#42311F");
    // 오븐
    ctx.fillStyle = "#33383C";
    roundRect(ctx, w * 0.04, h * 0.4, w * 0.24, h * 0.42, 5);
    ctx.fill();
    for (let i = 0; i < 2; i += 1) {
      const oy = h * (0.46 + i * 0.18);
      ctx.fillStyle = alpha("#E8912F", 0.85 + Math.sin(t * 3 + i) * 0.1);
      roundRect(ctx, w * 0.07, oy, w * 0.18, h * 0.12, 3);
      ctx.fill();
      glowDot(ctx, w * 0.16, oy + h * 0.06, 46, "#E8912F", 0.5);
    }
    // 쇼케이스 (빵 가득)
    showcase(ctx, w * 0.32, h * 0.46, w * 0.34, h * 0.34, 2, true);
    barCounter(ctx, w, h, w * 0.68, w * 0.3, h * 0.62);
    espressoMachine(ctx, w * 0.83, h * 0.58, 0.5, 2, t, true);
    // 베이커 + 홀 2명
    figure(ctx, w * 0.3, h * 0.82, 0.74, "#EDE4D2", { hat: "cap", walk: t * 4.4, facing: 1 });
    figure(ctx, w * 0.54, h * 0.9, 0.66, "#8C6F4E", { walk: t * 3, facing: -1, prop: "bag" });
    figure(ctx, w * 0.72, h * 0.9, 0.66, "#7A5F44", { walk: t * 3.6, facing: 1 });
    caption(ctx, w, "26 SEATS · 베이커 + 홀 2");
  },
};

// ── 원두 등급 일러스트 ───────────────────────────────────────

function beanBag(ctx, x, y, w, h, tone, label) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, mix(tone, "#fff", 0.14));
  g.addColorStop(1, mix(tone, "#000", 0.3));
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();
  ctx.fillStyle = alpha("#000", 0.25);
  ctx.fillRect(x, y, w, 9);
  ctx.fillStyle = alpha(PALETTE.steam, 0.9);
  ctx.font = "800 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + h * 0.56);
}

function cremaCup(ctx, cx, cy, scale, cremaColor, thickness, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // 잔
  const cup = ctx.createLinearGradient(-38, -30, 38, 30);
  cup.addColorStop(0, "#FBF6EC");
  cup.addColorStop(1, "#CFC4B4");
  ctx.fillStyle = cup;
  ctx.beginPath();
  ctx.moveTo(-38, -30);
  ctx.quadraticCurveTo(-34, 34, 0, 34);
  ctx.quadraticCurveTo(34, 34, 38, -30);
  ctx.closePath();
  ctx.fill();
  // 커피 + 크레마
  ctx.fillStyle = "#2E1A0E";
  ctx.beginPath();
  ctx.ellipse(0, -28, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cremaColor;
  ctx.beginPath();
  ctx.ellipse(0, -29, 34 * (0.72 + thickness * 0.28), 9 * (0.6 + thickness * 0.4), 0, 0, Math.PI * 2);
  ctx.fill();
  // 크레마 광택
  ctx.fillStyle = alpha("#FFF", 0.24 * thickness);
  ctx.beginPath();
  ctx.ellipse(-10, -31, 12 * thickness, 3.4 * thickness, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // 핸들
  ctx.strokeStyle = "#E4D9C8";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(42, -2, 15, -1.1, 1.1);
  ctx.stroke();
  ctx.restore();
  // 김
  for (let i = 0; i < 3; i += 1) {
    const p = (t * 0.55 + i * 0.33) % 1;
    ctx.globalAlpha = (1 - p) * 0.32 * (0.5 + thickness * 0.5);
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(cx + Math.sin(p * 7 + i) * 10, cy - 32 * scale - p * 54, (4 + p * 9) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const BEAN_ART = {
  value(ctx, w, h, t) {
    frame(ctx, w, h, "#221A15", "#100C0A");
    floor(ctx, w, h, h * 0.78, "#332619");
    // 대용량 마대 자루 3개 — 납품 창고 느낌
    for (let i = 0; i < 3; i += 1) {
      beanBag(ctx, w * (0.06 + i * 0.13), h * (0.34 + i * 0.03), w * 0.12, h * 0.42, "#6E6350", "BULK");
    }
    cremaCup(ctx, w * 0.66, h * 0.62, 1.05, "#B78A55", 0.42, t);
    glowDot(ctx, w * 0.66, h * 0.5, 80, PALETTE.crema, 0.2);
    caption(ctx, w, "얇은 크레마 · 원가 24%");
  },
  standard(ctx, w, h, t) {
    frame(ctx, w, h, "#251C16", "#120D0A");
    floor(ctx, w, h, h * 0.78, "#3A2B1D");
    beanBag(ctx, w * 0.1, h * 0.32, w * 0.18, h * 0.44, "#8A6A4A", "BLEND");
    beanBag(ctx, w * 0.3, h * 0.4, w * 0.14, h * 0.36, "#7A5C40", "");
    cremaCup(ctx, w * 0.68, h * 0.6, 1.15, "#C99A57", 0.72, t);
    glowDot(ctx, w * 0.68, h * 0.48, 96, PALETTE.crema, 0.34);
    caption(ctx, w, "무난한 크레마 · 원가 30%");
  },
  specialty(ctx, w, h, t) {
    frame(ctx, w, h, "#2A1F17", "#130E0B");
    floor(ctx, w, h, h * 0.78, "#43301E");
    beanBag(ctx, w * 0.08, h * 0.3, w * 0.2, h * 0.46, "#A8763F", "SINGLE\nORIGIN");
    // 컵노트 카드
    ctx.fillStyle = alpha(PALETTE.steam, 0.94);
    roundRect(ctx, w * 0.3, h * 0.36, w * 0.16, h * 0.24, 3);
    ctx.fill();
    ctx.fillStyle = "#4A3A2A";
    ctx.font = "700 9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ["ETHIOPIA", "· 자몽", "· 자스민", "· 꿀"].forEach((line, i) => {
      ctx.fillText(line, w * 0.32, h * 0.42 + i * 12);
    });
    cremaCup(ctx, w * 0.7, h * 0.58, 1.25, "#E0AC5E", 1, t);
    glowDot(ctx, w * 0.7, h * 0.46, 120, PALETTE.crema, 0.5);
    caption(ctx, w, "두꺼운 크레마 · 원가 38%", PALETTE.crema);
  },
};

// ── 본인 노동 일러스트 (시계 다이얼) ──────────────────────────

function hoursDial(ctx, cx, cy, radius, segments, label, sub) {
  ctx.save();
  ctx.translate(cx, cy);
  // 다이얼 바탕
  ctx.strokeStyle = alpha(PALETTE.line, 1);
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  // 채워진 구간
  for (const [from, to] of segments) {
    const a0 = -Math.PI / 2 + from * Math.PI * 2;
    const a1 = -Math.PI / 2 + to * Math.PI * 2;
    const g = ctx.createLinearGradient(-radius, -radius, radius, radius);
    g.addColorStop(0, PALETTE.crema);
    g.addColorStop(1, PALETTE.copper);
    ctx.strokeStyle = g;
    ctx.lineWidth = 14;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(0, 0, radius, a0, a1);
    ctx.stroke();
  }
  // 눈금
  ctx.strokeStyle = alpha(PALETTE.steam, 0.28);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i += 1) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (radius - 22), Math.sin(a) * (radius - 22));
    ctx.lineTo(Math.cos(a) * (radius - 15), Math.sin(a) * (radius - 15));
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.steam;
  ctx.textAlign = "center";
  ctx.font = "800 30px system-ui, sans-serif";
  ctx.fillText(label, 0, 4);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillText(sub, 0, 24);
  ctx.restore();
}

const ROLE_ART = {
  fulltime(ctx, w, h, t) {
    frame(ctx, w, h, "#241C17", "#100C0A");
    hoursDial(ctx, w * 0.3, h * 0.5, h * 0.3, [[0.04, 0.54]], "12h", "매일 바 안에서");
    floor(ctx, w, h, h * 0.84, "#3A2C22");
    barCounter(ctx, w, h, w * 0.56, w * 0.4, h * 0.62);
    espressoMachine(ctx, w * 0.7, h * 0.58, 0.5, 2, t, true);
    figure(ctx, w * 0.86, h * 0.72, 0.8, "#2C2620", { hat: "cap", walk: t * 5, facing: -1 });
    glowDot(ctx, w * 0.7, h * 0.52, 80, PALETTE.crema, 0.42);
  },
  peak(ctx, w, h, t) {
    frame(ctx, w, h, "#241C17", "#100C0A");
    hoursDial(ctx, w * 0.3, h * 0.5, h * 0.3, [[0.08, 0.2], [0.34, 0.46]], "6h", "러시 때만 투입");
    floor(ctx, w, h, h * 0.84, "#3A2C22");
    barCounter(ctx, w, h, w * 0.56, w * 0.4, h * 0.62);
    espressoMachine(ctx, w * 0.7, h * 0.58, 0.5, 2, t, true);
    figure(ctx, w * 0.82, h * 0.72, 0.76, "#2C2620", { hat: "cap", walk: t * 5, facing: -1 });
    ctx.globalAlpha = 0.4;
    figure(ctx, w * 0.94, h * 0.72, 0.72, "#6B5A48", { facing: 1 });
    ctx.globalAlpha = 1;
    glowDot(ctx, w * 0.7, h * 0.52, 70, PALETTE.crema, 0.3);
  },
  manager(ctx, w, h, t) {
    frame(ctx, w, h, "#241C17", "#100C0A");
    hoursDial(ctx, w * 0.3, h * 0.5, h * 0.3, [[0.02, 0.1]], "2h", "숫자만 본다");
    floor(ctx, w, h, h * 0.84, "#3A2C22");
    // 사장은 노트북 앞, 바는 직원이
    ctx.fillStyle = "#4A3628";
    roundRect(ctx, w * 0.6, h * 0.66, w * 0.34, 8, 2);
    ctx.fill();
    figure(ctx, w * 0.72, h * 0.78, 0.72, "#2C2620", { seated: true, prop: "laptop", facing: 1 });
    ctx.globalAlpha = 0.55;
    espressoMachine(ctx, w * 0.9, h * 0.5, 0.4, 2, t, true);
    figure(ctx, w * 0.9, h * 0.62, 0.6, "#8C7A62", { hat: "cap", walk: t * 4, facing: -1 });
    ctx.globalAlpha = 1;
  },
};

// ── 영업시간 일러스트 (24시간 타임라인) ───────────────────────

export function drawHourPlan(ctx, w, h, plan, district, t) {
  frame(ctx, w, h, "#221A15", "#0F0B09");
  const padX = w * 0.08;
  const barY = h * 0.56;
  const barW = w - padX * 2;
  const barH = 26;
  const startHour = 6;
  const endHour = 24;
  const toX = (hour) => padX + ((hour - startHour) / (endHour - startHour)) * barW;

  // 하늘 띠: 새벽→낮→노을→밤
  const sky = ctx.createLinearGradient(padX, 0, padX + barW, 0);
  sky.addColorStop(0, "#1B2436");
  sky.addColorStop(0.18, "#4E6A80");
  sky.addColorStop(0.45, "#7FA0B4");
  sky.addColorStop(0.72, "#C67F4A");
  sky.addColorStop(0.88, "#3B3350");
  sky.addColorStop(1, "#161B2A");
  ctx.fillStyle = sky;
  roundRect(ctx, padX, h * 0.12, barW, h * 0.3, 6);
  ctx.fill();

  // 상권 수요 곡선
  if (district?.traffic) {
    ctx.beginPath();
    district.traffic.forEach((value, index) => {
      const hour = 7 + index;
      const x = toX(hour);
      const y = h * 0.42 - (value / 100) * h * 0.26;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = alpha(PALETTE.steam, 0.75);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.lineTo(toX(23), h * 0.42);
    ctx.lineTo(toX(7), h * 0.42);
    ctx.closePath();
    ctx.fillStyle = alpha(PALETTE.steam, 0.12);
    ctx.fill();
  }

  // 닫힌 시간
  ctx.fillStyle = alpha("#000", 0.55);
  roundRect(ctx, padX, barY, barW, barH, 5);
  ctx.fill();

  // 열린 시간
  const ox = toX(plan.open);
  const ow = toX(plan.close) - ox;
  const openGrad = ctx.createLinearGradient(ox, barY, ox + ow, barY);
  openGrad.addColorStop(0, PALETTE.crema);
  openGrad.addColorStop(1, PALETTE.copper);
  ctx.fillStyle = openGrad;
  roundRect(ctx, ox, barY, ow, barH, 5);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = PALETTE.crema;
  ctx.shadowBlur = 22;
  ctx.fillStyle = alpha(PALETTE.crema, 0.4);
  roundRect(ctx, ox, barY, ow, barH, 5);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = PALETTE.ink;
  ctx.font = "800 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  if (ow > 90) ctx.fillText(`${plan.open}:00 — ${plan.close}:00`, ox + ow / 2, barY + 18);

  // 시간 눈금
  ctx.fillStyle = PALETTE.muted;
  ctx.font = "700 10px ui-monospace, monospace";
  for (let hour = startHour; hour <= endHour; hour += 3) {
    ctx.fillText(String(hour).padStart(2, "0"), toX(hour), barY + barH + 18);
    ctx.fillStyle = alpha(PALETTE.line, 0.9);
    ctx.fillRect(toX(hour), barY + barH + 2, 1, 5);
    ctx.fillStyle = PALETTE.muted;
  }

  // 해와 달
  glowDot(ctx, toX(12.5), h * 0.2, 34, PALETTE.cremaSoft, 0.7);
  ctx.fillStyle = "#FFE7B4";
  ctx.beginPath();
  ctx.arc(toX(12.5), h * 0.2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#D8DCE8";
  ctx.beginPath();
  ctx.arc(toX(22), h * 0.2, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2A3348";
  ctx.beginPath();
  ctx.arc(toX(22) - 3.4, h * 0.2 - 2.6, 7, 0, Math.PI * 2);
  ctx.fill();

  // 눈금과 겹치지 않도록 상단 좌측에 배지로 얹는다
  ctx.font = "800 13px system-ui, sans-serif";
  const badge = `${plan.close - plan.open}시간 영업`;
  const badgeW = ctx.measureText(badge).width + 18;
  ctx.fillStyle = alpha("#0C0908", 0.72);
  roundRect(ctx, padX, h * 0.06, badgeW, 24, 12);
  ctx.fill();
  ctx.fillStyle = PALETTE.crema;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge, padX + badgeW / 2, h * 0.06 + 13);
}

// ── 메뉴 일러스트 ───────────────────────────────────────────

function adeGlass(ctx, cx, cy, scale, top, bottom) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = alpha("#D8E8EE", 0.3);
  ctx.beginPath();
  ctx.moveTo(-24, -38);
  ctx.lineTo(24, -38);
  ctx.lineTo(18, 34);
  ctx.lineTo(-18, 34);
  ctx.closePath();
  ctx.fill();
  const liquid = ctx.createLinearGradient(0, -30, 0, 32);
  liquid.addColorStop(0, top);
  liquid.addColorStop(1, bottom);
  ctx.fillStyle = liquid;
  ctx.beginPath();
  ctx.moveTo(-22, -28);
  ctx.lineTo(22, -28);
  ctx.lineTo(17, 32);
  ctx.lineTo(-17, 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha("#FFF", 0.55);
  for (let i = 0; i < 4; i += 1) {
    roundRect(ctx, -14 + i * 8, -26 + (i % 2) * 12, 11, 11, 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#E8DCCE";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(10, -34);
  ctx.lineTo(20, -54);
  ctx.stroke();
  ctx.restore();
}

function pastry(ctx, cx, cy, scale, kind) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  if (kind === "cheesecake") {
    const g = ctx.createLinearGradient(0, -30, 0, 26);
    g.addColorStop(0, "#E8C079");
    g.addColorStop(0.45, "#C98A3E");
    g.addColorStop(1, "#8A5426");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-34, 24);
    ctx.lineTo(-26, -26);
    ctx.lineTo(26, -26);
    ctx.lineTo(34, 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4A2C14";
    ctx.beginPath();
    ctx.ellipse(0, -26, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "croissant") {
    ctx.fillStyle = "#D9A45C";
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#B87B36";
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.ellipse(i * 11, 0, 6, 16 - Math.abs(i) * 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#C98A45";
    ctx.beginPath();
    ctx.ellipse(-32, 6, 9, 7, 0.4, 0, Math.PI * 2);
    ctx.ellipse(32, 6, 9, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#D9AE72";
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#EFE0C4";
    ctx.beginPath();
    ctx.ellipse(-4, -6, 20, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFF";
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(-14 + i * 7, -10 - (i % 2) * 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const MENU_ART = {
  americano: (ctx, w, h, t) => cremaCup(ctx, w / 2, h * 0.58, Math.min(w, h) / 120, "#C08A4A", 0.6, t),
  latte: (ctx, w, h, t) => cremaCup(ctx, w / 2, h * 0.58, Math.min(w, h) / 120, "#E4CFA6", 0.85, t),
  signature: (ctx, w, h, t) => {
    cremaCup(ctx, w / 2, h * 0.6, Math.min(w, h) / 118, "#F0E2C2", 1, t);
    ctx.fillStyle = "#F7EEDC";
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.6 - 32 * (Math.min(w, h) / 118), 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8A5426";
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(w / 2 - 18 + i * 14, h * 0.6 - 40 * (Math.min(w, h) / 118), 8, 2.5);
    }
  },
  drip: (ctx, w, h, t) => {
    const s = Math.min(w, h) / 130;
    ctx.save();
    ctx.translate(w / 2, h * 0.42);
    ctx.scale(s, s);
    ctx.fillStyle = alpha("#E8DCCE", 0.92);
    ctx.beginPath();
    ctx.moveTo(-30, -18); ctx.lineTo(30, -18); ctx.lineTo(10, 20); ctx.lineTo(-10, 20);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = alpha("#8A5326", 0.85);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(0, 40 + Math.sin(t * 5) * 4);
    ctx.stroke();
    ctx.restore();
    cremaCup(ctx, w / 2, h * 0.78, s * 0.9, "#B87F44", 0.7, t);
  },
  ade: (ctx, w, h, t) => adeGlass(ctx, w / 2, h * 0.56, Math.min(w, h) / 110, "#F0C24A", "#E07A3C"),
  cheesecake: (ctx, w, h) => pastry(ctx, w / 2, h * 0.58, Math.min(w, h) / 100, "cheesecake"),
  croissant: (ctx, w, h) => pastry(ctx, w / 2, h * 0.58, Math.min(w, h) / 100, "croissant"),
  saltbread: (ctx, w, h) => pastry(ctx, w / 2, h * 0.58, Math.min(w, h) / 100, "saltbread"),
  cookie: (ctx, w, h) => {
    const s2 = Math.min(w, h) / 100;
    ctx.save();
    ctx.translate(w / 2, h * 0.58);
    ctx.scale(s2, s2);
    ctx.fillStyle = "#C89050";
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#B27B3C";
    ctx.beginPath();
    ctx.ellipse(-3, -3, 24, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4A2C14";
    const chips = [[-12, -8], [8, -12], [14, 4], [-6, 10], [2, -2], [-16, 4]];
    for (const [cx2, cy2] of chips) {
      ctx.beginPath();
      ctx.arc(cx2, cy2, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
  tea: (ctx, w, h, t) => {
    const s2 = Math.min(w, h) / 110;
    ctx.save();
    ctx.translate(w / 2, h * 0.6);
    ctx.scale(s2, s2);
    // 찻잔
    ctx.fillStyle = "#EDE4D4";
    ctx.beginPath();
    ctx.moveTo(-30, -12); ctx.lineTo(30, -12); ctx.lineTo(22, 16); ctx.lineTo(-22, 16);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#EDE4D4";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(34, 0, 10, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // 홍차색 수면
    ctx.fillStyle = "#B4632B";
    ctx.beginPath();
    ctx.ellipse(0, -12, 27, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 김
    ctx.strokeStyle = "rgba(240, 230, 214, .5)";
    ctx.lineWidth = 2.4;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 12, -22);
      ctx.quadraticCurveTo(i * 12 + Math.sin(t * 2 + i) * 5, -38, i * 12, -52);
      ctx.stroke();
    }
    ctx.restore();
  },
};

// ── 진입점 ──────────────────────────────────────────────────

const BUSINESS_ART = {
  sole(ctx, w, h, t) {
    frame(ctx, w, h, "#241C17", "#100C0A");
    floor(ctx, w, h, h * 0.8, "#3A2C22");
    // 혼자 앉은 책상 + 계단식으로 올라가는 세율 막대
    figure(ctx, w * 0.22, h * 0.78, 0.95, "#2C2620", { seated: true, prop: "laptop", facing: 1 });
    const rates = [0.06, 0.15, 0.24, 0.35, 0.45];
    rates.forEach((rate, i) => {
      const bx = w * 0.46 + i * (w * 0.1);
      const bh = h * 0.1 + rate * h * 0.72;
      const g = ctx.createLinearGradient(bx, h * 0.78 - bh, bx, h * 0.78);
      g.addColorStop(0, i >= 3 ? PALETTE.clay : PALETTE.crema);
      g.addColorStop(1, alpha(PALETTE.copper, 0.5));
      ctx.fillStyle = g;
      roundRect(ctx, bx, h * 0.78 - bh, w * 0.07, bh, 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.muted;
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(rate * 100)}%`, bx + w * 0.035, h * 0.78 - bh - 6);
    });
    caption(ctx, w, "누진세 6% → 45%", PALETTE.clay);
  },
  corp(ctx, w, h, t) {
    frame(ctx, w, h, "#1C2029", "#0C0908");
    floor(ctx, w, h, h * 0.8, "#2C3038");
    // 법인 등기 서류 + 평평한 세율
    ctx.fillStyle = "#E8DCCE";
    roundRect(ctx, w * 0.1, h * 0.28, w * 0.24, h * 0.44, 3);
    ctx.fill();
    ctx.fillStyle = "#4A3A2A";
    for (let i = 0; i < 5; i += 1) ctx.fillRect(w * 0.13, h * 0.36 + i * 14, w * 0.18 - (i % 2) * 14, 3);
    ctx.fillStyle = PALETTE.clay;
    ctx.beginPath();
    ctx.arc(w * 0.28, h * 0.62, 13, 0, Math.PI * 2);
    ctx.fill();
    const flat = [0.09, 0.09, 0.09, 0.19, 0.19];
    flat.forEach((rate, i) => {
      const bx = w * 0.46 + i * (w * 0.1);
      const bh = h * 0.1 + rate * h * 0.72;
      ctx.fillStyle = rate > 0.1 ? alpha(PALETTE.copper, 0.85) : PALETTE.jade;
      roundRect(ctx, bx, h * 0.78 - bh, w * 0.07, bh, 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.muted;
      ctx.font = "700 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(rate * 100)}%`, bx + w * 0.035, h * 0.78 - bh - 6);
    });
    caption(ctx, w, "2억까지 9% 평평", PALETTE.jade);
  },
};

const REGISTRY = {
  district: DISTRICT_ART,
  business: BUSINESS_ART,
  format: FORMAT_ART,
  bean: BEAN_ART,
  role: ROLE_ART,
  menu: MENU_ART,
};

export function drawIllustration(ctx, w, h, kind, id, time, extra) {
  ctx.clearRect(0, 0, w, h);
  if (kind === "hours") {
    drawHourPlan(ctx, w, h, id, extra, time);
  } else {
    const painter = REGISTRY[kind]?.[id];
    if (kind === "menu") {
      frame(ctx, w, h, "#2A211A", "#151009");
      glowDot(ctx, w / 2, h * 0.5, Math.min(w, h) * 0.6, PALETTE.crema, 0.16);
    }
    if (!painter) {
      if (kind !== "menu") frame(ctx, w, h, PALETTE.panel, PALETTE.ground);
    } else {
      painter(ctx, w, h, time);
    }
  }
  vignette(ctx, w, h, kind === "menu" ? 0.3 : 0.42);
  grain(ctx, w, h, 0.045);
}

// 캔버스에 일러스트를 붙이고 애니메이션 루프를 돌린다. dispose 함수를 반환.
export function mountIllustration(canvas, kind, id, extra) {
  const start = performance.now();
  let raf = null;
  const render = (now) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const dpr = 0.8; // 도트 일러스트 — 형태는 도트, 텍스트는 읽히게
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawIllustration(ctx, w, h, kind, id, (now - start) / 1000, extra);
    }
    raf = requestAnimationFrame(render);
  };
  raf = requestAnimationFrame(render);
  return () => {
    if (raf) cancelAnimationFrame(raf);
  };
}

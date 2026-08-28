// 아케이드 — 사장이 자리에 들어서는 순간 화면 전체가 그 자리의 게임이 된다.
//
//   · 키친 러시  — 내가 고른 메뉴가 주문으로 들어온다. ←→ 레인 이동, QWER로 조리.
//   · 홀 서빙    — 내 매장의 실제 테이블 수만큼. ←→ 이동, 스페이스 연타로 처리.
//   · 전단지     — 단골·행인·진상·리뷰어. ←→ 이동만으로 잡고 피한다.
//
// 시뮬레이션은 게임 중에도 흐른다. 여기서 한 일이 그대로 매장의 결과가 된다.
// 미니게임만큼은 고해상도로 그린다 — 도트 씬과 달리 DPR 풀 해상도.

import { artReady, drawFigure, drawTableProp, coverDraw } from "./art.js";

const SKIN_TONES = ["#f0c39a", "#e8b088", "#d9a077", "#f4cfa8"];
const HAIR_TONES = ["#241f1c", "#3a2e24", "#4a3a2a", "#1c1c22", "#5e2f38"];

// 몸통 색 → 스프라이트 아키타입 (미니게임 등장인물 매핑)
const BODY_SPRITE = {
  "#5fa57c": "regular", "#d9a441": "student", "#c25a4a": "office", "#8a6fb8": "hopper",
  "#3a7ba8": "regular", "#7ba23f": "student", "#a86f3a": "office", "#7d5ba6": "hopper",
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ── 감정 배지 — 성공/실패 순간 캐릭터 머리 위에 뜨는 리액션 아이콘 ──
// life: 1→0. 초반 팝(스케일 오버슛) 후 떠오르며 사라진다.
function drawBadge(ctx, x, y, type, life, max = 0.9) {
  const t = 1 - life / max;
  const pop = t < 0.18 ? (t / 0.18) * 1.15 : 1 + Math.max(0, 0.15 - (t - 0.18) * 1.2);
  const rise = t * 16;
  const alpha = life < 0.25 ? life / 0.25 : 1;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y - rise);
  ctx.scale(pop, pop);
  // 말풍선
  ctx.fillStyle = "#f6f0e2";
  ctx.strokeStyle = "rgba(30, 22, 14, .75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-17, -30, 34, 30, 9);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(0, 8);
  ctx.lineTo(5, 0);
  ctx.closePath();
  ctx.fill();
  // 아이콘
  const cx = 0;
  const cy = -15;
  if (type === "love") {
    ctx.fillStyle = "#d94f4f";
    ctx.beginPath();
    ctx.arc(cx - 4.2, cy - 2.5, 4.6, Math.PI, 0);
    ctx.arc(cx + 4.2, cy - 2.5, 4.6, Math.PI, 0);
    ctx.lineTo(cx, cy + 8.5);
    ctx.closePath();
    ctx.fill();
  } else if (type === "star") {
    ctx.fillStyle = "#d9a441";
    ctx.beginPath();
    for (let k = 0; k < 8; k += 1) {
      const r = k % 2 === 0 ? 9 : 3.8;
      const a = -Math.PI / 2 + (k * Math.PI) / 4;
      ctx[k === 0 ? "moveTo" : "lineTo"](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else if (type === "angry") {
    ctx.strokeStyle = "#d94f30";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    for (let k = 0; k < 4; k += 1) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 3.4, cy + Math.sin(a) * 3.4);
      ctx.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
      ctx.stroke();
    }
  } else if (type === "sweat") {
    ctx.fillStyle = "#5b9fd4";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.quadraticCurveTo(cx + 7.5, cy + 2, cx, cy + 8);
    ctx.quadraticCurveTo(cx - 7.5, cy + 2, cx, cy - 9);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy, 1.7, 2.6, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "shock") {
    ctx.fillStyle = "#2b2118";
    ctx.font = "900 19px Arial";
    ctx.textAlign = "center";
    ctx.fillText("!", cx, cy + 7);
  }
  ctx.restore();
}

// 풍부한 캐릭터 — 그림자·다리·팔·머리·헤어·소품까지 그린다.
function paintPerson(ctx, { x, y, scale = 1, body = "#666", hair, skin, face = null, prop = null, time = 0, walk = 0, facing = 1, glow = null }) {
  // 아트 모드 — 운영 씬과 같은 일러스트 스프라이트로 그린다
  const spriteKey = glow ? "owner" : BODY_SPRITE[body];
  if (spriteKey && artReady(spriteKey)) {
    const sbob = walk ? Math.sin(time * 9 + x * 0.05) * 2.2 : Math.sin(time * 2 + x * 0.05) * 0.8;
    if (glow) {
      ctx.save();
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(x, y + 3, 20, 6.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawFigure(ctx, spriteKey, x, y + sbob, { h: 104 * scale, facing, walking: walk, time: time + x * 0.03 });
    return;
  }
  const key = Math.abs(Math.round(x * 7 + y * 3));
  const skinTone = skin ?? SKIN_TONES[key % SKIN_TONES.length];
  const hairTone = hair ?? HAIR_TONES[(key + 1) % HAIR_TONES.length];
  const bob = walk ? Math.sin(time * 9 + key) * 2.4 : Math.sin(time * 2 + key) * 0.8;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);

  // 바닥 그림자
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath();
  ctx.ellipse(0, 2 - bob, 17, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (glow) {
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 2 - bob, 21, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 다리
  const step = walk ? Math.sin(time * 9 + key) * 6 : 0;
  ctx.strokeStyle = "#23241f";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, -16);
  ctx.lineTo(-4 + step, 0);
  ctx.moveTo(5, -16);
  ctx.lineTo(5 - step, 0);
  ctx.stroke();

  // 몸통
  ctx.fillStyle = body;
  ctx.strokeStyle = "rgba(18,14,10,.6)";
  ctx.lineWidth = 1.8;
  roundRect(ctx, -11, -44, 22, 31, 8);
  ctx.fill();
  ctx.stroke();
  // 하이라이트
  ctx.fillStyle = "rgba(255,255,255,.12)";
  roundRect(ctx, -9, -42, 8, 26, 5);
  ctx.fill();

  // 팔
  const armSwing = walk ? Math.sin(time * 9 + key + Math.PI) * 5 : 0;
  ctx.strokeStyle = body;
  ctx.lineWidth = 5.4;
  ctx.beginPath();
  ctx.moveTo(-9, -38);
  ctx.lineTo(-12 + armSwing * 0.5, -23);
  ctx.moveTo(9, -38);
  ctx.lineTo(12 - armSwing * 0.5, -23);
  ctx.stroke();

  // 머리
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.arc(0, -55, 9.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hairTone;
  ctx.beginPath();
  ctx.arc(0, -57.5, 9.1, Math.PI * 1.0, Math.PI * 2.0);
  ctx.fill();

  // 얼굴 이모지(감정 표현)
  if (face) {
    ctx.font = "13px serif";
    ctx.textAlign = "center";
    ctx.fillText(face, 0, -51);
  }
  // 소품
  if (prop) {
    ctx.font = "17px serif";
    ctx.textAlign = "center";
    ctx.fillText(prop, 15 * facing, -22);
  }
  ctx.restore();
}

// 튜토리얼 연습용 — 진짜 시뮬레이션에 손대지 않는 무해한 대역.
// 미니게임이 부르는 훅을 전부 빈손으로 받아낸다.
function practiceSimFor(sim) {
  return {
    menus: sim.menus,
    format: sim.format,
    tables: [],
    activeAgents: [],
    ownerLook: sim.ownerLook,
    kitchenLanes: sim.kitchenLanes ?? [],
    injectWalkin: () => ({ reviewLucky: Math.random() < 0.5 }),
    jinsangWalkin: () => {},
    expressServe: () => {},
    expressClean: () => {},
    attendCustomer: () => {},
    hallDelight: () => {},
  };
}

class ArcadeShell {
  constructor({ sim, sounds, onEnd, title, kicker, legend, w, h, duration, mount, practice, crowd }) {
    this.practice = !!practice;
    this.sim = this.practice ? practiceSimFor(sim) : sim;
    this.sounds = sounds;
    this.onEnd = onEnd ?? (() => {});
    this.mount = mount ?? null;
    // 붐비는 정도 — 페이즈(피크)와 달(성수기)이 곱해진다. 라벨은 HUD에 뜬다.
    this.crowd = crowd ?? { factor: 1, label: null };
    this.title = title;
    this.kicker = kicker;
    this.legendHtml = legend;
    this.W = w;
    this.H = h;
    this.duration = this.practice ? 10 : duration;
    this.timeLeft = this.duration;
    this.keys = { left: false, right: false, up: false, down: false, space: false };
    this.held = { Q: false, W: false, E: false, R: false };
    this.badges = [];
    this.floaters = [];
    this.particles = [];
    this.flash = null;
    this.combo = 0;
    this.comboTimer = 0;
    this.time = 0;
    this.finished = false;
    this.raf = null;
    this.keydown = this.keydown.bind(this);
    this.keyup = this.keyup.bind(this);
  }

  start() {
    this.root = document.createElement("div");
    this.root.className = `arcade-layer${this.mount ? " is-embedded" : ""}${this.practice ? " is-practice" : ""}`;
    this.root.innerHTML = `
      <header class="arcade-hud">
        <div class="arcade-title"><span class="meta-label">${this.practice ? "TUTORIAL / PRACTICE" : this.kicker}</span><h3>${this.title}${this.practice ? " 연습" : ""}</h3></div>
        ${this.crowd.label ? `<span class="arcade-crowd">${this.crowd.label}</span>` : ""}
        <div class="arcade-meters">
          <span class="arcade-time" id="arcade-time">${this.duration}s</span>
          <span class="arcade-score" id="arcade-score"></span>
          <button class="arcade-quit" id="arcade-quit" type="button">그만두기</button>
        </div>
      </header>
      <div class="arcade-stage"><canvas id="arcade-canvas"></canvas></div>
      <footer class="arcade-legend">${this.legendHtml}</footer>`;
    (this.mount ?? document.body).append(this.root);
    this.canvas = this.root.querySelector("#arcade-canvas");
    // 미니게임은 고해상도 — DPR 풀 해상도에 안티앨리어싱 그대로
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.aspectRatio = `${this.W} / ${this.H}`;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.root.querySelector("#arcade-quit").addEventListener("click", () => this.end());
    window.addEventListener("keydown", this.keydown, true);
    window.addEventListener("keyup", this.keyup, true);
    this.last = performance.now();
    this.raf = requestAnimationFrame((now) => this.frame(now));
  }

  keydown(event) {
    const code = event.code;
    if (code === "ArrowLeft") { this.keys.left = true; this.leftTap = true; }
    else if (code === "ArrowRight") { this.keys.right = true; this.rightTap = true; }
    else if (code === "ArrowUp") { this.keys.up = true; }
    else if (code === "ArrowDown") { this.keys.down = true; }
    else if (code === "Space") { this.keys.space = true; this.spaceTap = true; }
    else if (["KeyQ", "KeyW", "KeyE", "KeyR"].includes(code)) { this.actionTap = code[3]; this.held[code[3]] = true; }
    else if (!["Digit1", "Digit2", "Digit3"].includes(code)) return;
    // 게임에서 쓰는 키는 매장으로 새지 않는다
    event.preventDefault();
    event.stopPropagation();
  }

  keyup(event) {
    if (event.code === "ArrowLeft") this.keys.left = false;
    if (event.code === "ArrowRight") this.keys.right = false;
    if (event.code === "ArrowUp") this.keys.up = false;
    if (event.code === "ArrowDown") this.keys.down = false;
    if (event.code === "Space") this.keys.space = false;
    if (["KeyQ", "KeyW", "KeyE", "KeyR"].includes(event.code)) this.held[event.code[3]] = false;
  }

  addBadge(x, y, type, dur = 0.9) {
    this.badges.push({ x, y, type, life: dur, max: dur });
  }

  addFloat(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1 });
  }

  burst(x, y, color, count = 12, power = 130) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = power * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  screenFlash(color) {
    this.flash = { color, life: 0.35 };
  }

  bumpCombo() {
    this.combo += 1;
    this.comboTimer = 3;
  }

  breakCombo() {
    this.combo = 0;
  }

  frame(now) {
    if (this.finished) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) return this.end();
    this.update(dt);
    // 공통 파티클·플로터·콤보
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 320 * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const item of this.floaters) item.life -= dt * 0.7;
    this.floaters = this.floaters.filter((item) => item.life > 0);
    for (const badge of this.badges) badge.life -= dt;
    this.badges = this.badges.filter((badge) => badge.life > 0);
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    if (this.flash) { this.flash.life -= dt; if (this.flash.life <= 0) this.flash = null; }

    const ctx = this.ctx;
    ctx.save();
    this.render(ctx);
    for (const particle of this.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    for (const badge of this.badges) drawBadge(ctx, badge.x, badge.y, badge.type, badge.life, badge.max);
    for (const item of this.floaters) {
      ctx.globalAlpha = Math.max(0, item.life);
      ctx.fillStyle = item.color;
      ctx.font = "800 17px 'NeoDunggeunmo', 'Galmuri11', sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(10,7,5,.8)";
      ctx.lineWidth = 3.5;
      const fy = item.y - (1 - item.life) * 46;
      ctx.strokeText(item.text, item.x, fy);
      ctx.fillText(item.text, item.x, fy);
      ctx.globalAlpha = 1;
    }
    if (this.combo >= 3) {
      ctx.font = "800 26px 'NeoDunggeunmo', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#f0c674";
      ctx.strokeStyle = "rgba(10,7,5,.85)";
      ctx.lineWidth = 5;
      const pulse = 1 + Math.sin(this.time * 8) * 0.05;
      ctx.save();
      ctx.translate(this.W / 2, 52);
      ctx.scale(pulse, pulse);
      ctx.strokeText(`${this.combo} COMBO!`, 0, 0);
      ctx.fillText(`${this.combo} COMBO!`, 0, 0);
      ctx.restore();
    }
    if (this.flash) {
      ctx.globalAlpha = this.flash.life * 1.6;
      ctx.fillStyle = this.flash.color;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    this.leftTap = false;
    this.rightTap = false;
    this.spaceTap = false;
    this.actionTap = null;

    this.root.querySelector("#arcade-time").textContent = `${Math.ceil(this.timeLeft)}s`;
    this.root.querySelector("#arcade-score").textContent = this.hudText();
    this.raf = requestAnimationFrame((next) => this.frame(next));
  }

  end() {
    if (this.finished) return;
    this.finished = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.keydown, true);
    window.removeEventListener("keyup", this.keyup, true);
    const rows = this.resultRows();
    this.root.insertAdjacentHTML("beforeend", `
      <div class="arcade-result">
        <div class="arcade-result-card">
          <h3>${this.title} ${this.practice ? "연습 끝!" : "종료"}</h3>
          <div class="arcade-result-rows">
            ${rows.map((row) => `<div class="${row.bad ? "is-bad" : ""}"><span>${row.label}</span><b>${row.value}</b></div>`).join("")}
            ${this.practice ? `<div><span>연습 결과</span><b>매출에 반영되지 않았습니다</b></div>` : ""}
          </div>
          <button class="cta" id="arcade-close" type="button"><span>${this.practice ? "튜토리얼 계속" : "매장으로 돌아가기"}</span></button>
        </div>
      </div>`);
    this.root.querySelector("#arcade-close").addEventListener("click", () => this.dispose());
    // 연습판은 잠깐 보여주고 스스로 닫힌다 — 튜토리얼 흐름이 끊기지 않게
    if (this.practice) setTimeout(() => this.dispose(), 2200);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.keydown, true);
    window.removeEventListener("keyup", this.keyup, true);
    this.root?.remove();
    this.root = null;
    this.onEnd(this.stats);
  }

  update() {}
  render() {}
  hudText() { return ""; }
  resultRows() { return []; }
}

// ─── 전단지 디펜스 ──────────────────────────────────────────
// 단골은 알아서 오고, 행인은 잡으면 매출, 진상은 잡으면 손해,
// 리뷰어는 복불복 — 좋은 리뷰가 터질 수도, 별점 테러일 수도.
const FLYER_KINDS = [
  { id: "sure", label: "단골", face: "😊", body: "#5fa57c", weight: 0.24, fall: 130, prop: "☕" },
  { id: "maybe", label: "행인", face: "🤔", body: "#d9a441", weight: 0.38, fall: 150, prop: null },
  { id: "jinsang", label: "진상", face: "😤", body: "#c25a4a", weight: 0.18, fall: 175, prop: "💢" },
  { id: "reviewer", label: "리뷰어", face: "🧐", body: "#8a6fb8", weight: 0.2, fall: 160, prop: "📱" },
];

export class FlyerRun extends ArcadeShell {
  constructor(options) {
    super({
      ...options,
      title: "전단지 돌리기",
      kicker: "STREET / FLYER RUN",
      w: 560, h: 660, duration: 30,
      legend: `
        <span><i style="background:#5fa57c"></i>단골 — 안 잡아도 들어옵니다</span>
        <span><i style="background:#d9a441"></i>행인 — 잡으면 매출</span>
        <span><i style="background:#c25a4a"></i>진상 — 잡으면 돈 안 내고 짜증만</span>
        <span><i style="background:#8a6fb8"></i>리뷰어 — 복불복 (호평/혹평)</span>
        <b>←→↑↓ 이동</b>`,
    });
    this.stats = { score: 0, converted: 0, goodReviews: 0, badReviews: 0, jinsang: 0 };
    this.people = [];
    // 탑뷰 — 사장이 거리 위를 사방으로 뛰어다닌다
    this.playerX = this.W / 2;
    this.playerY = this.H * 0.62;
    this.playerFacing = 1;
    this.playerReact = null;
    this.nextSpawn = 0;
    this.shake = 0;
  }

  // 화면 가장자리에서 등장해 제각각의 방향으로 거리를 가로지른다
  spawnPerson() {
    let cursor = Math.random();
    let kind = FLYER_KINDS[0];
    for (const item of FLYER_KINDS) {
      if (cursor < item.weight) { kind = item; break; }
      cursor -= item.weight;
    }
    const speed = kind.fall * 0.75 * (0.85 + Math.random() * 0.4);
    const edge = Math.random();
    let x;
    let y;
    let heading;
    if (edge < 0.3) {          // 왼쪽 → 오른쪽으로
      x = -34; y = 60 + Math.random() * (this.H - 160);
      heading = (Math.random() - 0.5) * 0.9;
    } else if (edge < 0.6) {   // 오른쪽 → 왼쪽으로
      x = this.W + 34; y = 60 + Math.random() * (this.H - 160);
      heading = Math.PI + (Math.random() - 0.5) * 0.9;
    } else if (edge < 0.85) {  // 위 → 아래로
      x = 40 + Math.random() * (this.W - 80); y = -34;
      heading = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    } else {                   // 아래 → 위로
      x = 40 + Math.random() * (this.W - 80); y = this.H + 34;
      heading = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    }
    this.people.push({
      kind,
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      wobble: Math.random() * Math.PI * 2,
      skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
      hair: HAIR_TONES[Math.floor(Math.random() * HAIR_TONES.length)],
      hit: false,
      entered: false,
    });
  }

  touch(person) {
    person.hit = true;
    const { kind } = person;
    if (kind.id === "sure") {
      this.stats.score += 1;
      this.bumpCombo();
      this.burst(person.x, person.y - 40, "#8fd6ab", 10);
      this.addBadge(person.x, person.y - 104, "love", 0.9);
      this.addFloat(person.x, person.y - 30, "+1점 (어차피 단골)", "#8fd6ab");
      this.sounds?.click();
    } else if (kind.id === "maybe") {
      this.stats.score += 1;
      this.stats.converted += 1;
      this.bumpCombo();
      this.sim.injectWalkin("maybe");
      this.burst(person.x, person.y - 40, "#f0c674", 16);
      this.addBadge(person.x, person.y - 104, "love", 1.0);
      this.playerReact = { type: "star", t: 0.9, max: 0.9 };
      this.addFloat(person.x, person.y - 30, "손님 확보! +매출", "#f0c674");
      this.sounds?.good();
    } else if (kind.id === "reviewer") {
      const agent = this.sim.injectWalkin("reviewer");
      if (agent?.reviewLucky) {
        this.stats.goodReviews += 1;
        this.bumpCombo();
        this.burst(person.x, person.y - 40, "#b79ae0", 16);
        this.addBadge(person.x, person.y - 104, "star", 1.0);
        this.playerReact = { type: "love", t: 0.9, max: 0.9 };
        this.addFloat(person.x, person.y - 30, "호평 각! 내일 +1%", "#cdb2f0");
        this.sounds?.good();
      } else {
        this.stats.badReviews += 1;
        this.breakCombo();
        this.screenFlash("rgba(138,111,184,.25)");
        this.addBadge(person.x, person.y - 104, "angry", 1.0);
        this.playerReact = { type: "sweat", t: 1.0, max: 1.0 };
        this.addFloat(person.x, person.y - 30, "혹평… 내일 −1%", "#b79ae0");
        this.sounds?.bad();
      }
    } else {
      this.stats.jinsang += 1;
      this.breakCombo();
      this.sim.jinsangWalkin();
      this.screenFlash("rgba(194,90,74,.3)");
      this.shake = 0.5;
      this.addBadge(person.x, person.y - 104, "angry", 1.2);
      this.playerReact = { type: "shock", t: 1.1, max: 1.1 };
      this.addFloat(person.x, person.y - 30, "진상 입장… 돈은 안 냄", "#e07a6a");
      this.sounds?.bad();
    }
  }

  update(dt) {
    const speed = 330;
    if (this.keys.left) { this.playerX -= speed * dt; this.playerFacing = -1; }
    if (this.keys.right) { this.playerX += speed * dt; this.playerFacing = 1; }
    if (this.keys.up) this.playerY -= speed * dt;
    if (this.keys.down) this.playerY += speed * dt;
    this.playerX = Math.max(36, Math.min(this.W - 36, this.playerX));
    this.playerY = Math.max(70, Math.min(this.H - 40, this.playerY));
    if (this.playerReact) { this.playerReact.t -= dt; if (this.playerReact.t <= 0) this.playerReact = null; }

    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) {
      this.spawnPerson();
      // 피크 시간대·성수기 달에는 거리에 사람이 그만큼 더 쏟아진다
      this.nextSpawn = (0.55 + Math.random() * 0.45) / Math.max(0.5, this.crowd.factor);
    }
    for (const person of this.people) {
      person.x += person.vx * dt;
      person.y += person.vy * dt;
      person.wobble += dt * 3;
      const inside = person.x > -40 && person.x < this.W + 40 && person.y > -40 && person.y < this.H + 40;
      if (inside) person.entered = true;
      if (!person.hit && Math.hypot(person.y - this.playerY, person.x - this.playerX) < 44) this.touch(person);
      // 단골은 만나지 못해도 어차피 온다 — 화면을 빠져나가는 순간 자동 집계
      if (!person.hit && person.entered && !inside && person.kind.id === "sure") {
        person.hit = true;
        this.stats.score += 1;
        this.sim.injectWalkin("sure");
        this.addFloat(Math.max(30, Math.min(this.W - 30, person.x)), Math.max(40, Math.min(this.H - 20, person.y)), "+1점", "#8fd6ab");
      }
    }
    this.people = this.people.filter((person) => !person.hit && (!person.entered
      || (person.x > -60 && person.x < this.W + 60 && person.y > -60 && person.y < this.H + 60)));
    if (this.shake) this.shake = Math.max(0, this.shake - dt);
  }

  render(ctx) {
    if (this.shake) ctx.translate((Math.random() - 0.5) * 9 * this.shake, (Math.random() - 0.5) * 9 * this.shake);
    if (artReady("mg-street-top")) {
      // 아트 모드 — 탑뷰 일러스트 거리
      coverDraw(ctx, "mg-street-top", this.W, this.H);
    } else if (artReady("mg-street")) {
      coverDraw(ctx, "mg-street", this.W, this.H);
    } else {
      // 밤거리 — 가로등 광원과 창문 불빛
      const bg = ctx.createLinearGradient(0, 0, 0, this.H);
      bg.addColorStop(0, "#131019");
      bg.addColorStop(0.7, "#1e1712");
      bg.addColorStop(1, "#2a1e14");
      ctx.fillStyle = bg;
      ctx.fillRect(-12, -12, this.W + 24, this.H + 24);
      ctx.fillStyle = "#191420";
      ctx.fillRect(0, 40, this.W, 130);
      for (let i = 0; i < 22; i += 1) {
        const wx = (i * 97) % this.W;
        const wy = 56 + ((i * 53) % 100);
        ctx.fillStyle = (i % 3 === 0) ? "rgba(240,198,116,.5)" : "rgba(240,198,116,.14)";
        ctx.fillRect(wx, wy, 7, 9);
      }
      const lampX = this.W * 0.82;
      const glow = ctx.createRadialGradient(lampX, 30, 6, lampX, 30, 240);
      glow.addColorStop(0, "rgba(240,198,116,.28)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.strokeStyle = "rgba(240,230,214,.08)";
      ctx.lineWidth = 1.4;
      for (let y = 190; y < this.H; y += 64) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
      }
    }
    // 거리의 사람들 + 사장 — y(깊이)순으로 정렬해 그린다
    const moving = this.keys.left || this.keys.right || this.keys.up || this.keys.down;
    const drawables = this.people.map((person) => ({ y: person.y, person }));
    drawables.push({ y: this.playerY, player: true });
    drawables.sort((a, b) => a.y - b.y);
    for (const item of drawables) {
      if (item.player) {
        paintPerson(ctx, {
          x: this.playerX, y: this.playerY, scale: 1.12,
          body: this.sim.ownerLook?.color ?? "#23241f",
          hair: this.sim.ownerLook?.hair, face: "🙂", prop: "📄",
          time: this.time, walk: moving ? 1 : 0,
          facing: this.playerFacing,
          glow: "rgba(217,164,65,.6)",
        });
        if (this.playerReact) drawBadge(ctx, this.playerX + 24, this.playerY - 134, this.playerReact.type, this.playerReact.t, this.playerReact.max);
        continue;
      }
      const person = item.person;
      const sway = Math.sin(person.wobble) * 5;
      paintPerson(ctx, {
        x: person.x + sway, y: person.y, scale: 0.96, body: person.kind.body,
        skin: person.skin, hair: person.hair, face: person.kind.face, prop: person.kind.prop,
        time: this.time, walk: 1,
        facing: person.vx >= 0 ? 1 : -1,
      });
      ctx.font = "700 12px 'NeoDunggeunmo', sans-serif";
      ctx.fillStyle = "rgba(240,230,214,.85)";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(10,7,5,.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(person.kind.label, person.x + sway, person.y + 18);
      ctx.fillText(person.kind.label, person.x + sway, person.y + 18);
    }
  }

  hudText() { return `${this.stats.score}점 · 손님 ${this.stats.converted}`; }

  resultRows() {
    const { score, converted, goodReviews, badReviews, jinsang } = this.stats;
    return [
      { label: "점수", value: `${score}점` },
      { label: "확보한 손님", value: `${converted}명` },
      ...(goodReviews ? [{ label: "호평 리뷰", value: `${goodReviews}건 · 내일 수요 +${goodReviews}%` }] : []),
      ...(badReviews ? [{ label: "혹평 리뷰", value: `${badReviews}건 · 내일 수요 −${badReviews}%`, bad: true }] : []),
      ...(jinsang ? [{ label: "진상", value: `${jinsang}명 · 평판이 긁혔습니다`, bad: true }] : []),
    ];
  }
}

// ─── 키친 러시 ──────────────────────────────────────────────
// 주문서에는 내가 실제로 파는 메뉴가 찍힌다. ←→로 레인을 오가고,
// 주문마다 요구하는 QWER 콤보를 순서대로 눌러 완성한다.
const KEY_POOL = ["Q", "W", "E", "R"];

function comboFor(menu) {
  // 메뉴 id에서 결정적으로 조리 콤보를 뽑는다 — 복잡한 메뉴일수록 길다
  let hash = 0;
  for (const ch of menu.id) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  const length = Math.max(2, Math.min(4, (menu.complexity ?? 1) + 1));
  return Array.from({ length }, (_, index) => KEY_POOL[(hash + index * 2 + index * index) % 4]);
}

function laneFor(menu, bakes) {
  if (menu.caseItem) return 2;          // 오븐/쇼케이스
  if (menu.milk) return 1;              // 스티머
  return 0;                             // 머신 (에스프레소·드립·에이드·티)
}

export class KitchenRush extends ArcadeShell {
  constructor(options) {
    const bakes = options.sim.format.bakes;
    super({
      ...options,
      title: "키친 러시",
      kicker: "KITCHEN / BREW & BAKE",
      w: 720, h: 460, duration: 28,
      legend: `
        <span>☕ 머신</span><span>🥛 스티머</span><span>🔥 오븐</span>
        <span>주문의 키를 <b>꾹 누르고</b>, 게이지가 <b>노란 구간</b>일 때 떼세요</span>
        <span>일찍 떼면 설익고 · 끝까지 누르면 탑니다</span>
        <b>←→ 스테이션 · QWER 꾹</b>`,
    });
    this.bakes = bakes;
    // 스테이션 앵커 — 일러스트(mg-kitchen)의 실제 장비 위치에 커버 매핑 기준으로 부착
    // (아트 미로드시 procedural 배경의 기존 비율 사용)
    this.artStations = [
      { icon: "☕", name: "머신", x: 122, topY: 208, mouthY: 292 },
      { icon: "🥛", name: "스티머", x: 322, topY: 218, mouthY: 296 },
      { icon: "🔥", name: "오븐", x: 505, topY: 222, mouthY: 292 },
    ];
    this.procStations = [
      { icon: "☕", name: "머신", x: this.W * 0.18, topY: this.H * 0.3, mouthY: this.H * 0.5 },
      { icon: "🥛", name: "스티머", x: this.W * 0.5, topY: this.H * 0.3, mouthY: this.H * 0.5 },
      { icon: "🔥", name: "오븐", x: this.W * 0.82, topY: this.H * 0.3, mouthY: this.H * 0.5 },
    ];
    this.lanes = this.procStations.map((station) => ({ ...station, order: null }));
    this.slot = 0;
    this.stats = { made: 0, missed: 0, wrong: 0 };
    this.nextOrder = 0.3;
    this.playerFacing = 1;
    this.playerReact = null;
    this.workPulse = 0;
    this.cookFx = [];   // 완성/설익음/탄 결과물 연출
    this.doughFx = [];  // 반죽이 오븐으로 미끄러져 들어가는 연출
  }

  // 아트 로드가 프레임 도중 끝나도 앵커가 따라가게 매 프레임 동기화
  syncStations() {
    const src = artReady("mg-kitchen") ? this.artStations : this.procStations;
    for (let i = 0; i < this.lanes.length; i += 1) {
      this.lanes[i].x = src[i].x;
      this.lanes[i].topY = src[i].topY;
      this.lanes[i].mouthY = src[i].mouthY;
      this.lanes[i].name = src[i].name;
      this.lanes[i].icon = src[i].icon;
    }
  }

  spawnOrder() {
    const empty = this.lanes.map((lane, index) => ({ lane, index })).filter((item) => !item.lane.order);
    if (!empty.length) return;
    const menus = this.sim.menus;
    const menu = menus[Math.floor(Math.random() * menus.length)];
    const laneIndex = laneFor(menu, this.bakes);
    const target = empty.find((item) => item.index === laneIndex) ?? empty[Math.floor(Math.random() * empty.length)];
    // 메뉴마다 홀드 키 1개 + 적정 게이지 구간 (복잡한 메뉴일수록 좁다)
    let hash = 0;
    for (const ch of menu.id) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
    const width = Math.max(0.14, 0.3 - (menu.complexity ?? 1) * 0.05);
    const z0 = 0.52 + (hash % 5) * 0.03;
    target.lane.order = {
      menu,
      key: KEY_POOL[hash % 4],
      zone: [z0, Math.min(0.95, z0 + width)],
      gauge: 0,
      holding: false,
      patience: 10,
      pop: 0,
    };
  }

  finishCook(lane, index) {
    const order = lane.order;
    this.stats.made += 1;
    this.bumpCombo();
    this.sim.expressServe();
    this.workPulse = 0.5;
    this.playerReact = { type: index === 2 ? "love" : "star", t: 0.9, max: 0.9 };
    this.cookFx.push({ type: "done", lane: index, t: 0, menu: order.menu });
    this.burst(lane.x, lane.mouthY - 20, "#8fd6ab", 16, 140);
    this.addFloat(lane.x, lane.topY - 78, `${order.menu.name} 완성!`, "#8fd6ab");
    this.sounds?.good();
    lane.order = null;
  }

  failCook(lane, index, kind) {
    const order = lane.order;
    this.stats.wrong += 1;
    this.breakCombo();
    this.playerReact = { type: kind === "burnt" ? "shock" : "sweat", t: 1.0, max: 1.0 };
    this.cookFx.push({ type: kind, lane: index, t: 0, menu: order.menu });
    if (kind === "burnt") {
      this.screenFlash("rgba(120, 60, 30, .3)");
      this.addFloat(lane.x, lane.topY - 78, `타버렸다… 다시!`, "#e07a6a");
    } else {
      this.addFloat(lane.x, lane.topY - 78, `설익었다… 다시!`, "#e0b06a");
    }
    this.sounds?.bad();
    order.patience -= 1.6;
    order.gauge = 0;
    order.holding = false;
  }

  update(dt) {
    this.syncStations();
    if (this.leftTap) { this.slot = Math.max(0, this.slot - 1); this.playerFacing = -1; }
    if (this.rightTap) { this.slot = Math.min(this.lanes.length - 1, this.slot + 1); this.playerFacing = 1; }
    if (this.workPulse > 0) this.workPulse -= dt;
    if (this.playerReact) { this.playerReact.t -= dt; if (this.playerReact.t <= 0) this.playerReact = null; }
    for (const fx of this.cookFx) fx.t += dt;
    this.cookFx = this.cookFx.filter((fx) => fx.t < 1.1);
    for (const fx of this.doughFx) fx.t += dt;
    this.doughFx = this.doughFx.filter((fx) => fx.t < 0.55);

    this.nextOrder -= dt;
    if (this.nextOrder <= 0) {
      this.spawnOrder();
      const queue = this.sim.activeAgents.filter((agent) => agent.state === "queueing").length;
      this.nextOrder = Math.max(0.7, (2.0 - queue * 0.12) / Math.max(0.6, this.crowd.factor));
    }

    // 현재 스테이션 — 주문 키를 꾹 누르는 동안 게이지가 찬다
    const lane = this.lanes[this.slot];
    const order = lane.order;
    if (order) {
      const heldNow = this.held[order.key];
      if (heldNow) {
        if (!order.holding) {
          order.holding = true;
          order.pop = 0.25;
          this.workPulse = 0.4;
          // 오븐이면 반죽이 미끄러져 들어간다
          if (this.slot === 2) this.doughFx.push({ t: 0, x0: lane.x - 66, y0: lane.mouthY + 26, x1: lane.x + 4, y1: lane.mouthY - 4 });
          this.sounds?.click();
        }
        this.workPulse = Math.max(this.workPulse, 0.15);
        order.gauge = Math.min(1, order.gauge + dt / 1.7);
        if (order.gauge >= 1) this.failCook(lane, this.slot, "burnt");
      } else if (order.holding) {
        // 뗐다 — 게이지 판정
        if (order.gauge >= order.zone[0] && order.gauge <= order.zone[1]) this.finishCook(lane, this.slot);
        else if (order.gauge > 0.1) this.failCook(lane, this.slot, "raw");
        else { order.holding = false; order.gauge = 0; }
      } else if (this.actionTap && this.actionTap !== order.key) {
        this.addFloat(lane.x, lane.topY - 78, `이 주문은 [${order.key}]`, "#9c8b7c");
      }
    } else if (this.actionTap) {
      this.addFloat(lane.x, lane.topY - 78, "이 스테이션엔 주문이 없어요", "#9c8b7c");
    }
    // 다른 스테이션으로 옮기면 홀드는 취소 (조리 중이던 건 리셋)
    for (let i = 0; i < this.lanes.length; i += 1) {
      const other = this.lanes[i].order;
      if (i !== this.slot && other?.holding) { other.holding = false; other.gauge = 0; }
    }

    for (let i = 0; i < this.lanes.length; i += 1) {
      const item = this.lanes[i];
      if (!item.order) continue;
      item.order.patience -= dt;
      if (item.order.pop > 0) item.order.pop -= dt;
      if (item.order.patience <= 0) {
        this.stats.missed += 1;
        this.breakCombo();
        this.playerReact = { type: "sweat", t: 0.9, max: 0.9 };
        this.addFloat(item.x, item.topY - 78, `${item.order.menu.name} 식었다…`, "#e07a6a");
        this.sounds?.bad();
        item.order = null;
      }
    }
  }

  render(ctx) {
    this.syncStations();
    const artMode = artReady("mg-kitchen");
    if (artMode) {
      coverDraw(ctx, "mg-kitchen", this.W, this.H);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, this.H);
      bg.addColorStop(0, "#2a2019");
      bg.addColorStop(1, "#1c150f");
      ctx.fillStyle = bg;
      ctx.fillRect(-12, -12, this.W + 24, this.H + 24);
      ctx.strokeStyle = "rgba(240,230,214,.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < this.W; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H * 0.34); ctx.stroke(); }
      for (let y = 0; y < this.H * 0.34; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke(); }
      ctx.fillStyle = "#5a3c2b";
      ctx.fillRect(0, this.H * 0.52, this.W, 30);
      ctx.fillStyle = "#41291d";
      ctx.fillRect(0, this.H * 0.52 + 30, this.W, this.H);
    }

    // 반죽 슬라이드 인 (오븐)
    for (const fx of this.doughFx) {
      const progress = Math.min(1, fx.t / 0.5);
      const dx = fx.x0 + (fx.x1 - fx.x0) * progress;
      const dy = fx.y0 + (fx.y1 - fx.y0) * progress - Math.sin(progress * Math.PI) * 18;
      ctx.save();
      ctx.fillStyle = "#e8c98a";
      ctx.strokeStyle = "#a97b3f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(dx, dy, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < this.lanes.length; i += 1) {
      const lane = this.lanes[i];
      const active = i === this.slot;
      const order = lane.order;

      if (!artMode) {
        ctx.fillStyle = active ? "#463527" : "#332619";
        roundRect(ctx, lane.x - 64, lane.topY, 128, lane.mouthY - lane.topY + 40, 8);
        ctx.fill();
        ctx.font = "44px serif";
        ctx.textAlign = "center";
        ctx.fillText(lane.icon, lane.x, (lane.topY + lane.mouthY) / 2 + 20);
      }

      // 활성 스테이션 — 장비에 정확히 붙는 프레임 + 스포트라이트
      if (active) {
        ctx.save();
        ctx.strokeStyle = "rgba(240,198,116,.9)";
        ctx.lineWidth = 2.6;
        roundRect(ctx, lane.x - 70, lane.topY - 4, 140, lane.mouthY - lane.topY + 52, 10);
        ctx.stroke();
        if (artMode) {
          const spot = ctx.createRadialGradient(lane.x, (lane.topY + lane.mouthY) / 2, 10, lane.x, (lane.topY + lane.mouthY) / 2, 130);
          spot.addColorStop(0, "rgba(240,198,116,.18)");
          spot.addColorStop(1, "transparent");
          ctx.globalCompositeOperation = "screen";
          ctx.fillStyle = spot;
          ctx.fillRect(lane.x - 130, lane.topY - 40, 260, lane.mouthY - lane.topY + 170);
        }
        ctx.restore();
      }
      ctx.font = "700 13px 'NeoDunggeunmo', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = active ? "#ffd98a" : "rgba(240,230,214,.8)";
      ctx.fillText(lane.name, lane.x, lane.mouthY + 62);

      // 주문 카드 — 장비 바로 위에 부착
      if (order) {
        const cardY = lane.topY - 66;
        const scalePop = 1 + Math.max(0, order.pop) * 0.4;
        ctx.save();
        ctx.translate(lane.x, cardY + 22);
        ctx.scale(scalePop, scalePop);
        ctx.translate(-lane.x, -(cardY + 22));
        ctx.fillStyle = "#f4ecdc";
        ctx.strokeStyle = "rgba(20,14,8,.55)";
        ctx.lineWidth = 2;
        roundRect(ctx, lane.x - 66, cardY, 132, 46, 6);
        ctx.fill();
        ctx.stroke();
        // 카드 → 장비 연결선
        ctx.strokeStyle = "rgba(20,14,8,.35)";
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(lane.x, cardY + 46);
        ctx.lineTo(lane.x, lane.topY - 16);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#3c3226";
        ctx.font = "700 12.5px 'NeoDunggeunmo', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${order.menu.icon} ${order.menu.name}`, lane.x - 58, cardY + 19);
        // 홀드 키 캡
        const keyHeld = order.holding;
        ctx.fillStyle = keyHeld ? "#5fa57c" : "#d9a441";
        roundRect(ctx, lane.x - 58, cardY + 25, 24, 17, 4);
        ctx.fill();
        ctx.fillStyle = keyHeld ? "#eafff2" : "#2c2418";
        ctx.font = "800 12px 'NeoDunggeunmo', monospace";
        ctx.textAlign = "center";
        ctx.fillText(order.key, lane.x - 46, cardY + 38);
        ctx.fillStyle = "#8a7860";
        ctx.font = "700 10px 'NeoDunggeunmo', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(keyHeld ? "굽는 중…" : "꾹 누르기", lane.x - 28, cardY + 38);
        // 인내 게이지 (카드 하단 얇게)
        ctx.fillStyle = "#d8cbb2";
        ctx.fillRect(lane.x - 66, cardY + 44, 132, 3);
        ctx.fillStyle = order.patience < 3.5 ? "#c25a4a" : "#8a6d4a";
        ctx.fillRect(lane.x - 66, cardY + 44, 132 * Math.max(0, order.patience / 10), 3);
        ctx.restore();

        // ── 홀드 게이지 — 장비 아래, 노란 적정 구간 표시 ──
        const gx = lane.x - 58;
        const gy = lane.mouthY + 34;
        const gw = 116;
        ctx.fillStyle = "rgba(18, 13, 9, .8)";
        roundRect(ctx, gx - 3, gy - 3, gw + 6, 16, 5);
        ctx.fill();
        // 적정 구간 (노란 밴드)
        ctx.fillStyle = "rgba(217, 164, 65, .45)";
        ctx.fillRect(gx + gw * order.zone[0], gy, gw * (order.zone[1] - order.zone[0]), 10);
        ctx.strokeStyle = "rgba(240, 198, 116, .95)";
        ctx.lineWidth = 1.6;
        ctx.strokeRect(gx + gw * order.zone[0], gy - 1, gw * (order.zone[1] - order.zone[0]), 12);
        // 채워지는 게이지
        if (order.gauge > 0) {
          const inZone = order.gauge >= order.zone[0] && order.gauge <= order.zone[1];
          const over = order.gauge > order.zone[1];
          ctx.fillStyle = over ? "#c8502e" : inZone ? "#e9b64d" : "#c9b18a";
          ctx.fillRect(gx, gy, gw * order.gauge, 10);
          // 바늘
          ctx.fillStyle = "#fff4dc";
          ctx.fillRect(gx + gw * order.gauge - 1.5, gy - 4, 3, 18);
          if (inZone) {
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            const pulse = ctx.createRadialGradient(gx + gw * order.gauge, gy + 5, 2, gx + gw * order.gauge, gy + 5, 26);
            pulse.addColorStop(0, "rgba(255, 220, 140, .8)");
            pulse.addColorStop(1, "transparent");
            ctx.fillStyle = pulse;
            ctx.fillRect(gx + gw * order.gauge - 26, gy - 21, 52, 52);
            ctx.restore();
          }
        }

        // ── 조리 중 라이브 연출 ──
        if (order.holding) {
          if (i === 0) {
            // 에스프레소 추출 줄기 + 잔
            const streamX = lane.x + Math.sin(this.time * 14) * 0.8;
            ctx.strokeStyle = "#6d4324";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(streamX, lane.mouthY - 24);
            ctx.lineTo(streamX, lane.mouthY + 2);
            ctx.stroke();
            ctx.fillStyle = "#f2ead8";
            roundRect(ctx, lane.x - 10, lane.mouthY + 2, 20, 14, 3);
            ctx.fill();
            ctx.fillStyle = "#8a5326";
            ctx.fillRect(lane.x - 8, lane.mouthY + 4, 16, 4 + order.gauge * 7);
          } else if (i === 1) {
            // 스팀 소용돌이
            for (let k = 0; k < 3; k += 1) {
              const sp = (this.time * 1.4 + k * 0.33) % 1;
              ctx.globalAlpha = (1 - sp) * 0.5;
              ctx.fillStyle = "#fff";
              ctx.beginPath();
              ctx.arc(lane.x - 8 + Math.sin(sp * 7 + k) * 8, lane.mouthY - 10 - sp * 44, 3.5 + sp * 6, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          } else {
            // 오븐 내부 글로우 — 게이지만큼 달아오른다
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            const heat = ctx.createRadialGradient(lane.x, (lane.topY + lane.mouthY) / 2 + 8, 4, lane.x, (lane.topY + lane.mouthY) / 2 + 8, 60);
            heat.addColorStop(0, `rgba(255, ${170 - order.gauge * 80}, 60, ${0.25 + order.gauge * 0.5})`);
            heat.addColorStop(1, "transparent");
            ctx.fillStyle = heat;
            ctx.fillRect(lane.x - 60, lane.topY - 20, 120, lane.mouthY - lane.topY + 80);
            ctx.restore();
          }
        }
      }
    }

    // ── 결과물 연출 — 완성은 꺼내 올리고, 실패작은 처량하게 ──
    for (const fx of this.cookFx) {
      const lane = this.lanes[fx.lane];
      const progress = Math.min(1, fx.t / 1.0);
      const rise = Math.sin(Math.min(1, progress * 1.4) * Math.PI * 0.5) * 42;
      const ix2 = lane.x + 18;
      const iy2 = lane.mouthY - 6 - rise;
      ctx.save();
      if (fx.type === "done") {
        if (fx.lane === 2 || fx.menu.caseItem) {
          // 갓 구운 빵
          ctx.fillStyle = "#d9973f";
          ctx.strokeStyle = "#9c6224";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ix2, iy2, 14, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = "rgba(120, 70, 24, .8)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(ix2 - 7, iy2 - 2);
          ctx.quadraticCurveTo(ix2, iy2 - 7, ix2 + 7, iy2 - 2);
          ctx.stroke();
        } else {
          // 완성된 잔
          ctx.fillStyle = "#f2ead8";
          roundRect(ctx, ix2 - 10, iy2 - 8, 20, 16, 3);
          ctx.fill();
          ctx.fillStyle = "#e9b64d";
          ctx.fillRect(ix2 - 8, iy2 - 6, 16, 4);
        }
        // 김
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = "rgba(255,255,255,.7)";
        ctx.lineWidth = 2;
        for (let k = -1; k <= 1; k += 1) {
          ctx.beginPath();
          ctx.moveTo(ix2 + k * 7, iy2 - 12);
          ctx.quadraticCurveTo(ix2 + k * 7 + Math.sin(this.time * 4 + k) * 4, iy2 - 22, ix2 + k * 7, iy2 - 30);
          ctx.stroke();
        }
      } else if (fx.type === "burnt") {
        // 탄 결과물 + 연기
        ctx.fillStyle = "#3a2c22";
        ctx.strokeStyle = "#1e1610";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(ix2, lane.mouthY - 4, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let k = 0; k < 3; k += 1) {
          const sp = Math.min(1, (fx.t * 1.4 + k * 0.2) % 1);
          ctx.globalAlpha = (1 - sp) * 0.55;
          ctx.fillStyle = "#5a544c";
          ctx.beginPath();
          ctx.arc(ix2 + Math.sin(sp * 5 + k * 2) * 7, lane.mouthY - 14 - sp * 40, 4 + sp * 7, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // 설익은 결과물 (창백)
        ctx.globalAlpha = 1 - progress * 0.6;
        ctx.fillStyle = "#e9ddc4";
        ctx.strokeStyle = "#b8a888";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(ix2, lane.mouthY - 4 - rise * 0.3, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 사장 — 이동 방향을 보고, 홀드 중엔 장비에 몸을 기울인다
    const holdingNow = !!this.lanes[this.slot].order?.holding;
    const px = this.lanes[this.slot].x;
    const py = this.H * 0.76;
    paintPerson(ctx, {
      x: px, y: py, scale: 1.25,
      body: this.sim.ownerLook?.color ?? "#23241f",
      hair: this.sim.ownerLook?.hair, face: "🧑‍🍳", prop: "🥄",
      time: this.time * (holdingNow || this.workPulse > 0 ? 2.2 : 1),
      walk: holdingNow || this.workPulse > 0 ? 1 : 0,
      facing: this.playerFacing,
      glow: "rgba(217,164,65,.5)",
    });
    if (this.playerReact) drawBadge(ctx, px + 26, py - 150, this.playerReact.type, this.playerReact.t, this.playerReact.max);
  }

  hudText() { return `${this.stats.made}개 완성 · ${this.stats.missed} 놓침`; }

  resultRows() {
    return [
      { label: "직접 만든 메뉴", value: `${this.stats.made}개 — 대기 손님이 바로 받았습니다` },
      ...(this.stats.missed ? [{ label: "식어버린 주문", value: `${this.stats.missed}개`, bad: true }] : []),
      ...(this.stats.wrong ? [{ label: "설익거나 탄 조리", value: `${this.stats.wrong}번`, bad: true }] : []),
    ];
  }
}

// ─── 홀 서빙 ────────────────────────────────────────────────
// 내 매장의 실제 테이블 수만큼 나온다. ←→로 이동,
// 말풍선에 찍힌 키(주문서 Q · 서빙 W · 응대 E · 정리 R)를 먼저 누른 뒤 스페이스 2연타.
const HALL_TASKS = [
  { id: "order", icon: "📝", label: "주문서", key: "Q", taps: 2 },
  { id: "serve", icon: "🍽", label: "서빙", key: "W", taps: 2 },
  { id: "call", icon: "🖐", label: "응대", key: "E", taps: 2 },
  { id: "bus", icon: "🧹", label: "정리", key: "R", taps: 2 },
];

export class HallService extends ArcadeShell {
  constructor(options) {
    const realTables = Math.max(2, Math.min(6, options.sim.tables?.length || 3));
    super({
      ...options,
      title: "홀 서빙",
      kicker: "HALL / SERVICE RUN",
      w: 720, h: 460, duration: 28,
      legend: `
        <span>📝 주문서 <b>Q</b></span><span>🍽 서빙 <b>W</b></span><span>🖐 응대 <b>E</b></span><span>🧹 정리 <b>R</b></span>
        <span>말풍선의 키를 먼저, 그다음 <b>스페이스 ×2</b> · 우리 매장 테이블 ${realTables}개 그대로</span>
        <b>←→ 이동 · 키 + SPACE×2</b>`,
    });
    this.tables = Array.from({ length: realTables }, (_, index) => ({
      x: this.W * ((index + 1) / (realTables + 1)),
      task: null,
      guest: Math.random() < 0.7,
      guestSkin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
      guestHair: HAIR_TONES[Math.floor(Math.random() * HAIR_TONES.length)],
      guestColor: ["#3a7ba8", "#7ba23f", "#a86f3a", "#7d5ba6"][index % 4],
    }));
    this.slot = 0;
    this.stats = { handled: 0, missed: 0 };
    this.nextTask = 0.4;
    this.playerFacing = -1;
    this.playerReact = null;
  }

  spawnTask() {
    const empty = this.tables.filter((table) => !table.task);
    if (!empty.length) return;
    const table = empty[Math.floor(Math.random() * empty.length)];
    const caller = this.sim.activeAgents.find((agent) => agent.serviceRequested && !agent.serviceResolved && !agent.arcadeTaken);
    const dirty = this.sim.tables.find((item) => item.state === "dirty" && !item.arcadeTaken);
    let kind;
    if (caller) { kind = HALL_TASKS[2]; caller.arcadeTaken = true; table.agentId = caller.id; }
    else if (dirty) { kind = HALL_TASKS[3]; dirty.arcadeTaken = true; table.tableId = dirty.id; }
    else kind = HALL_TASKS[Math.floor(Math.random() * 2)];
    // 정리(빈 자리) 빼고는 부르는 손님이 반드시 앉아 있다
    if (kind.id !== "bus") table.guest = true;
    else table.guest = false;
    table.task = { kind, keyDone: false, taps: 0, patience: 8.5, pop: 0 };
  }

  finishTask(table) {
    this.stats.handled += 1;
    this.bumpCombo();
    if (table.task.kind.id === "call" && table.agentId) this.sim.attendCustomer(table.agentId);
    else if (table.task.kind.id === "bus" && table.tableId != null) this.sim.expressClean(table.tableId);
    else this.sim.hallDelight();
    this.burst(table.x, this.H * 0.44, "#8fd6ab", 16, 140);
    // 손님이 폴짝 뛰며 인사한다
    if (table.guest) {
      table.react = { type: "happy", t: 1.1, max: 1.1 };
      this.addBadge(table.x - 50, this.H * 0.665 - 100, "love", 1.0);
      this.addFloat(table.x - 46, this.H * 0.44, "감사합니다~", "#ffd98a");
    } else {
      this.addFloat(table.x, this.H * 0.4, `${table.task.kind.label} 완료!`, "#8fd6ab");
    }
    this.playerReact = { type: "star", t: 0.9, max: 0.9 };
    this.sounds?.good();
    table.task = null;
    table.agentId = null;
    table.tableId = null;
  }

  update(dt) {
    if (this.leftTap) { this.slot = Math.max(0, this.slot - 1); this.playerFacing = -1; }
    if (this.rightTap) { this.slot = Math.min(this.tables.length - 1, this.slot + 1); this.playerFacing = 1; }

    this.nextTask -= dt;
    if (this.nextTask <= 0) {
      this.spawnTask();
      // 붐비는 시간대엔 말풍선이 쏟아진다 — 홀이 정신없어지는 이유
      this.nextTask = (1.0 + Math.random() * 0.9) / Math.max(0.6, this.crowd.factor);
    }

    const table = this.tables[this.slot];
    // 1단계: 과제 고유 키(Q/W/E/R) — 맞는 키를 먼저 눌러야 스페이스가 먹힌다
    if (this.actionTap && table.task) {
      const task = table.task;
      this.playerFacing = -1; // 주문 받을 땐 손님(테이블 왼편) 쪽을 본다
      if (!task.keyDone && this.actionTap === task.kind.key) {
        task.keyDone = true;
        task.pop = 0.25;
        this.burst(table.x, this.H * 0.5, "#f0c674", 6, 80);
        this.addFloat(table.x, this.H * 0.46, `[${task.kind.key}] ${task.kind.label} 접수!`, "#f0c674");
        this.sounds?.click();
      } else if (!task.keyDone) {
        this.breakCombo();
        task.patience -= 0.6;
        if (table.guest) {
          table.react = { type: "angry", t: 0.7, max: 0.7 };
          this.addBadge(table.x - 50, this.H * 0.665 - 100, "angry", 0.8);
        }
        this.playerReact = { type: "sweat", t: 0.8, max: 0.8 };
        this.addFloat(table.x, this.H * 0.5, `삑! [${task.kind.key}]를 눌러야죠`, "#e07a6a");
        this.sounds?.bad();
      }
    } else if (this.actionTap && !table.task) {
      this.addFloat(table.x, this.H * 0.5, "이 테이블은 괜찮아요", "#9c8b7c");
    }
    // 2단계: 스페이스 2연타로 마무리
    if (this.spaceTap && table.task) {
      const task = table.task;
      this.playerFacing = -1;
      if (!task.keyDone) {
        this.addFloat(table.x, this.H * 0.5, `먼저 [${task.kind.key}] ${task.kind.label}!`, "#9c8b7c");
      } else {
        task.taps += 1;
        task.pop = 0.22;
        this.burst(table.x, this.H * 0.5, "#efe6d8", 5, 70);
        this.sounds?.click();
        if (task.taps >= task.kind.taps) this.finishTask(table);
      }
    } else if (this.spaceTap && !table.task) {
      this.addFloat(table.x, this.H * 0.5, "이 테이블은 괜찮아요", "#9c8b7c");
    }

    if (this.playerReact) { this.playerReact.t -= dt; if (this.playerReact.t <= 0) this.playerReact = null; }
    for (const item of this.tables) {
      if (item.react) {
        item.react.t -= dt;
        if (item.react.t <= 0) item.react = null;
      }
      if (!item.task) continue;
      if (item.task.pop > 0) item.task.pop -= dt;
      item.task.patience -= dt;
      if (item.task.patience <= 0) {
        this.stats.missed += 1;
        this.breakCombo();
        if (item.guest) {
          item.react = { type: "angry", t: 1.6, max: 1.6 };
          this.addBadge(item.x - 50, this.H * 0.665 - 100, "angry", 1.1);
        }
        this.playerReact = { type: "sweat", t: 1.0, max: 1.0 };
        this.addFloat(item.x, this.H * 0.44, "늦었다…", "#e07a6a");
        this.sounds?.bad();
        item.task = null;
      }
    }
  }

  render(ctx) {
    const artMode = artReady("mg-hall");
    if (artMode) {
      // 아트 모드 — 일러스트 홀
      coverDraw(ctx, "mg-hall", this.W, this.H);
    } else {
      // 홀 배경 — 창밖 야경과 나무 바닥
      const bg = ctx.createLinearGradient(0, 0, 0, this.H);
      bg.addColorStop(0, "#241b14");
      bg.addColorStop(1, "#1a130d");
      ctx.fillStyle = bg;
      ctx.fillRect(-12, -12, this.W + 24, this.H + 24);
      for (let i = 0; i < 3; i += 1) {
        const wx = this.W * (0.2 + i * 0.3);
        ctx.fillStyle = "#131019";
        roundRect(ctx, wx - 52, 24, 104, 88, 6);
        ctx.fill();
        ctx.fillStyle = "rgba(240,198,116,.28)";
        ctx.fillRect(wx - 40, 40, 12, 10);
        ctx.fillRect(wx + 12, 66, 14, 9);
        ctx.strokeStyle = "#3a2c20";
        ctx.lineWidth = 3;
        roundRect(ctx, wx - 52, 24, 104, 88, 6);
        ctx.stroke();
      }
      for (let i = 0; i < this.tables.length; i += 1) {
        const lx = this.tables[i].x;
        ctx.strokeStyle = "#171310";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 130); ctx.stroke();
        ctx.fillStyle = "#b4674d";
        ctx.beginPath(); ctx.arc(lx, 136, 10, Math.PI, 0); ctx.fill();
        const lampGlow = ctx.createRadialGradient(lx, 150, 4, lx, 190, 110);
        lampGlow.addColorStop(0, "rgba(240,198,116,.2)");
        lampGlow.addColorStop(1, "transparent");
        ctx.fillStyle = lampGlow;
        ctx.fillRect(lx - 110, 130, 220, 180);
      }
      ctx.strokeStyle = "rgba(240,230,214,.05)";
      ctx.lineWidth = 1.2;
      for (let y = this.H * 0.62; y < this.H; y += 26) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
      }
    }

    for (let i = 0; i < this.tables.length; i += 1) {
      const table = this.tables[i];
      const active = i === this.slot;
      // 손님 — 앉아서 부르고, 고마워하고, 짜증낸다
      if (table.guest) {
        const react = table.react;
        const calling = table.task && !table.task.keyDone && table.task.kind.id !== "bus";
        let jumpY = 0;
        let shakeX = 0;
        if (calling) jumpY = -Math.abs(Math.sin(this.time * 6)) * 7;
        if (react?.type === "happy") {
          const progress = 1 - react.t / react.max;
          jumpY = -20 * Math.sin(Math.min(1, progress * 1.5) * Math.PI);
        }
        if (react?.type === "angry") shakeX = Math.sin(this.time * 34) * 3.2;
        const gx = table.x - 50 + shakeX;
        const gy = this.H * 0.665 + jumpY;
        const seatedKey = i % 2 === 0 ? "seatedA" : "seatedB";
        const waveKey = i % 2 === 0 ? "seatedWaveA" : "seatedWaveB";
        if (artMode && artReady(seatedKey)) {
          // 부를 땐 같은 그림체의 '손 든' 스프라이트로 교체 + 리듬감 있는 바운스
          const useWave = calling && artReady(waveKey);
          const waveBob = useWave ? Math.sin(this.time * 8) * 2.5 : 0;
          drawFigure(ctx, useWave ? waveKey : seatedKey, gx, gy + waveBob, { h: 92, facing: 1, time: this.time });
        } else {
          paintPerson(ctx, {
            x: table.x - 46, y: this.H * 0.62 + jumpY, scale: 0.9,
            body: table.guestColor, skin: table.guestSkin, hair: table.guestHair,
            time: this.time, walk: 0,
          });
        }
      }
      // 테이블
      if (artMode) {
        drawTableProp(ctx, table.x, this.H * 0.66, 92);
        if (active) {
          ctx.save();
          ctx.strokeStyle = "rgba(240,198,116,.85)";
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.ellipse(table.x, this.H * 0.665, 66, 15, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        ctx.fillStyle = active ? "#6d4a36" : "#54382a";
        roundRect(ctx, table.x - 52, this.H * 0.55, 104, 18, 4);
        ctx.fill();
        if (active) {
          ctx.strokeStyle = "rgba(240,198,116,.7)";
          ctx.lineWidth = 2.4;
          roundRect(ctx, table.x - 52, this.H * 0.55, 104, 18, 4);
          ctx.stroke();
        }
        ctx.fillStyle = "#3a2a1f";
        ctx.fillRect(table.x - 42, this.H * 0.55 + 18, 9, 30);
        ctx.fillRect(table.x + 33, this.H * 0.55 + 18, 9, 30);
        ctx.fillStyle = "#efe6d8";
        ctx.beginPath();
        ctx.ellipse(table.x + 18, this.H * 0.55 + 4, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 과제 말풍선
      if (table.task) {
        const { kind, keyDone, taps, patience, pop } = table.task;
        const by = this.H * 0.26;
        const scalePop = 1 + Math.max(0, pop) * 0.5;
        ctx.save();
        ctx.translate(table.x, by + 28);
        ctx.scale(scalePop, scalePop);
        ctx.translate(-table.x, -(by + 28));
        ctx.fillStyle = "#f4ecdc";
        ctx.strokeStyle = "rgba(20,14,8,.5)";
        ctx.lineWidth = 2;
        roundRect(ctx, table.x - 50, by, 100, 58, 8);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(table.x - 8, by + 58);
        ctx.lineTo(table.x, by + 70);
        ctx.lineTo(table.x + 8, by + 58);
        ctx.closePath();
        ctx.fill();
        ctx.font = "17px serif";
        ctx.textAlign = "center";
        ctx.fillText(kind.icon, table.x - 30, by + 21);
        ctx.fillStyle = "#3c3226";
        ctx.font = "700 12px 'NeoDunggeunmo', sans-serif";
        ctx.fillText(kind.label, table.x + 8, by + 19);
        // 1단계 — 과제 키 캡, 2단계 — 스페이스 두 칸
        ctx.fillStyle = keyDone ? "#5fa57c" : "#d9a441";
        roundRect(ctx, table.x - 42, by + 28, 24, 22, 4);
        ctx.fill();
        if (!keyDone) {
          ctx.strokeStyle = "#8a5f1e";
          ctx.lineWidth = 2;
          roundRect(ctx, table.x - 42, by + 28, 24, 22, 4);
          ctx.stroke();
        }
        ctx.fillStyle = keyDone ? "#eafff2" : "#2c2418";
        ctx.font = "800 13px 'NeoDunggeunmo', monospace";
        ctx.fillText(kind.key, table.x - 30, by + 44);
        for (let k = 0; k < kind.taps; k += 1) {
          const done = keyDone && k < taps;
          const current = keyDone && k === taps;
          ctx.fillStyle = done ? "#5fa57c" : current ? "#d9a441" : "#c9beac";
          roundRect(ctx, table.x - 8 + k * 26, by + 28, 22, 22, 4);
          ctx.fill();
          ctx.fillStyle = done ? "#eafff2" : "#2c2418";
          ctx.font = "800 10px 'NeoDunggeunmo', monospace";
          ctx.fillText("␣", table.x + 3 + k * 26, by + 43);
        }
        ctx.restore();
        // 인내 게이지
        ctx.fillStyle = "#171310";
        ctx.fillRect(table.x - 46, by + 76, 92, 6);
        ctx.fillStyle = patience < 3 ? "#c25a4a" : "#5fa57c";
        ctx.fillRect(table.x - 46, by + 76, 92 * Math.max(0, patience / 8.5), 6);
      }
    }
    // 사장 — 이동한 방향, 주문 받을 땐 손님 쪽을 본다
    const working = !!this.tables[this.slot].task;
    const hpx = this.tables[this.slot].x;
    const hpy = this.H * 0.85;
    paintPerson(ctx, {
      x: hpx, y: hpy, scale: 1.22,
      body: this.sim.ownerLook?.color ?? "#23241f",
      hair: this.sim.ownerLook?.hair, face: "🙂", prop: "🫙",
      time: this.time, walk: working ? 1 : 0,
      facing: this.playerFacing,
      glow: "rgba(217,164,65,.5)",
    });
    if (this.playerReact) drawBadge(ctx, hpx + 26, hpy - 146, this.playerReact.type, this.playerReact.t, this.playerReact.max);
  }

  hudText() { return `${this.stats.handled}건 처리 · ${this.stats.missed} 놓침`; }

  resultRows() {
    return [
      { label: "처리한 홀 업무", value: `${this.stats.handled}건 — 만족도에 반영됐습니다` },
      ...(this.stats.missed ? [{ label: "놓친 부름", value: `${this.stats.missed}건`, bad: true }] : []),
    ];
  }
}

export const ARCADE_BY_STATION = {
  door: FlyerRun,
  bar: KitchenRush,
  hall: HallService,
};

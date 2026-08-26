// 아케이드 — 사장이 자리에 들어서는 순간 화면 전체가 그 자리의 게임이 된다.
//
//   · 키친 러시  — 내가 고른 메뉴가 주문으로 들어온다. ←→ 레인 이동, QWER로 조리.
//   · 홀 서빙    — 내 매장의 실제 테이블 수만큼. ←→ 이동, 스페이스 연타로 처리.
//   · 전단지     — 단골·행인·진상·리뷰어. ←→ 이동만으로 잡고 피한다.
//
// 시뮬레이션은 게임 중에도 흐른다. 여기서 한 일이 그대로 매장의 결과가 된다.
// 미니게임만큼은 고해상도로 그린다 — 도트 씬과 달리 DPR 풀 해상도.

const SKIN_TONES = ["#f0c39a", "#e8b088", "#d9a077", "#f4cfa8"];
const HAIR_TONES = ["#241f1c", "#3a2e24", "#4a3a2a", "#1c1c22", "#5e2f38"];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// 풍부한 캐릭터 — 그림자·다리·팔·머리·헤어·소품까지 그린다.
function paintPerson(ctx, { x, y, scale = 1, body = "#666", hair, skin, face = null, prop = null, time = 0, walk = 0, facing = 1, glow = null }) {
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

class ArcadeShell {
  constructor({ sim, sounds, onEnd, title, kicker, legend, w, h, duration }) {
    this.sim = sim;
    this.sounds = sounds;
    this.onEnd = onEnd ?? (() => {});
    this.title = title;
    this.kicker = kicker;
    this.legendHtml = legend;
    this.W = w;
    this.H = h;
    this.duration = duration;
    this.timeLeft = duration;
    this.keys = { left: false, right: false, space: false };
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
    this.root.className = "arcade-layer";
    this.root.innerHTML = `
      <header class="arcade-hud">
        <div class="arcade-title"><span class="meta-label">${this.kicker}</span><h3>${this.title}</h3></div>
        <div class="arcade-meters">
          <span class="arcade-time" id="arcade-time">${this.duration}s</span>
          <span class="arcade-score" id="arcade-score"></span>
          <button class="arcade-quit" id="arcade-quit" type="button">그만두기</button>
        </div>
      </header>
      <div class="arcade-stage"><canvas id="arcade-canvas"></canvas></div>
      <footer class="arcade-legend">${this.legendHtml}</footer>`;
    document.body.append(this.root);
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
    else if (code === "Space") { this.keys.space = true; this.spaceTap = true; }
    else if (["KeyQ", "KeyW", "KeyE", "KeyR"].includes(code)) { this.actionTap = code[3]; }
    else if (!["Digit1", "Digit2", "Digit3", "ArrowUp", "ArrowDown"].includes(code)) return;
    // 게임에서 쓰는 키는 매장으로 새지 않는다
    event.preventDefault();
    event.stopPropagation();
  }

  keyup(event) {
    if (event.code === "ArrowLeft") this.keys.left = false;
    if (event.code === "ArrowRight") this.keys.right = false;
    if (event.code === "Space") this.keys.space = false;
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
          <h3>${this.title} 종료</h3>
          <div class="arcade-result-rows">
            ${rows.map((row) => `<div class="${row.bad ? "is-bad" : ""}"><span>${row.label}</span><b>${row.value}</b></div>`).join("")}
          </div>
          <button class="cta" id="arcade-close" type="button"><span>매장으로 돌아가기</span></button>
        </div>
      </div>`);
    this.root.querySelector("#arcade-close").addEventListener("click", () => this.dispose());
  }

  dispose() {
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
        <b>←→ 이동</b>`,
    });
    this.stats = { score: 0, converted: 0, goodReviews: 0, badReviews: 0, jinsang: 0 };
    this.people = [];
    this.playerX = this.W / 2;
    this.nextSpawn = 0;
    this.shake = 0;
  }

  spawnPerson() {
    let cursor = Math.random();
    let kind = FLYER_KINDS[0];
    for (const item of FLYER_KINDS) {
      if (cursor < item.weight) { kind = item; break; }
      cursor -= item.weight;
    }
    this.people.push({
      kind,
      x: 46 + Math.random() * (this.W - 92),
      y: -30,
      speed: kind.fall * (0.85 + Math.random() * 0.4),
      wobble: Math.random() * Math.PI * 2,
      skin: SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)],
      hair: HAIR_TONES[Math.floor(Math.random() * HAIR_TONES.length)],
      hit: false,
    });
  }

  touch(person) {
    person.hit = true;
    const { kind } = person;
    if (kind.id === "sure") {
      this.stats.score += 1;
      this.bumpCombo();
      this.burst(person.x, person.y, "#8fd6ab", 10);
      this.addFloat(person.x, person.y, "+1점 (어차피 단골)", "#8fd6ab");
      this.sounds?.click();
    } else if (kind.id === "maybe") {
      this.stats.score += 1;
      this.stats.converted += 1;
      this.bumpCombo();
      this.sim.injectWalkin("maybe");
      this.burst(person.x, person.y, "#f0c674", 16);
      this.addFloat(person.x, person.y, "손님 확보! +매출", "#f0c674");
      this.sounds?.good();
    } else if (kind.id === "reviewer") {
      const agent = this.sim.injectWalkin("reviewer");
      if (agent?.reviewLucky) {
        this.stats.goodReviews += 1;
        this.bumpCombo();
        this.burst(person.x, person.y, "#b79ae0", 16);
        this.addFloat(person.x, person.y, "호평 각! 내일 +1%", "#cdb2f0");
        this.sounds?.good();
      } else {
        this.stats.badReviews += 1;
        this.breakCombo();
        this.screenFlash("rgba(138,111,184,.25)");
        this.addFloat(person.x, person.y, "혹평… 내일 −1%", "#b79ae0");
        this.sounds?.bad();
      }
    } else {
      this.stats.jinsang += 1;
      this.breakCombo();
      this.sim.jinsangWalkin();
      this.screenFlash("rgba(194,90,74,.3)");
      this.shake = 0.5;
      this.addFloat(person.x, person.y, "진상 입장… 돈은 안 냄", "#e07a6a");
      this.sounds?.bad();
    }
  }

  update(dt) {
    const speed = 380;
    if (this.keys.left) this.playerX -= speed * dt;
    if (this.keys.right) this.playerX += speed * dt;
    this.playerX = Math.max(36, Math.min(this.W - 36, this.playerX));

    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) {
      this.spawnPerson();
      this.nextSpawn = 0.55 + Math.random() * 0.45;
    }
    const playerY = this.H - 80;
    for (const person of this.people) {
      person.y += person.speed * dt;
      person.wobble += dt * 3;
      if (!person.hit && Math.abs(person.y - playerY) < 30 && Math.abs(person.x - this.playerX) < 38) this.touch(person);
      if (!person.hit && person.kind.id === "sure" && person.y > this.H - 36) {
        person.hit = true;
        this.stats.score += 1;
        this.sim.injectWalkin("sure");
        this.addFloat(person.x, this.H - 50, "+1점", "#8fd6ab");
      }
    }
    this.people = this.people.filter((person) => !person.hit && person.y < this.H + 40);
    if (this.shake) this.shake = Math.max(0, this.shake - dt);
  }

  render(ctx) {
    if (this.shake) ctx.translate((Math.random() - 0.5) * 9 * this.shake, (Math.random() - 0.5) * 9 * this.shake);
    // 밤거리 — 가로등 광원과 창문 불빛
    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, "#131019");
    bg.addColorStop(0.7, "#1e1712");
    bg.addColorStop(1, "#2a1e14");
    ctx.fillStyle = bg;
    ctx.fillRect(-12, -12, this.W + 24, this.H + 24);
    // 멀리 건물 실루엣 + 창문
    ctx.fillStyle = "#191420";
    ctx.fillRect(0, 40, this.W, 130);
    for (let i = 0; i < 22; i += 1) {
      const wx = (i * 97) % this.W;
      const wy = 56 + ((i * 53) % 100);
      ctx.fillStyle = (i % 3 === 0) ? "rgba(240,198,116,.5)" : "rgba(240,198,116,.14)";
      ctx.fillRect(wx, wy, 7, 9);
    }
    // 가로등 빛 기둥
    const lampX = this.W * 0.82;
    const glow = ctx.createRadialGradient(lampX, 30, 6, lampX, 30, 240);
    glow.addColorStop(0, "rgba(240,198,116,.28)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.W, this.H);
    // 보도
    ctx.strokeStyle = "rgba(240,230,214,.08)";
    ctx.lineWidth = 1.4;
    for (let y = 190; y < this.H; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }
    // 떨어지는 사람들
    for (const person of this.people) {
      const sway = Math.sin(person.wobble) * 7;
      paintPerson(ctx, {
        x: person.x + sway, y: person.y, body: person.kind.body,
        skin: person.skin, hair: person.hair, face: person.kind.face, prop: person.kind.prop,
        time: this.time, walk: 1,
      });
      ctx.font = "700 12px 'NeoDunggeunmo', sans-serif";
      ctx.fillStyle = "rgba(240,230,214,.85)";
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(10,7,5,.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(person.kind.label, person.x + sway, person.y + 18);
      ctx.fillText(person.kind.label, person.x + sway, person.y + 18);
    }
    // 사장 — 전단지 뭉치를 든
    paintPerson(ctx, {
      x: this.playerX, y: this.H - 46, scale: 1.18,
      body: this.sim.ownerLook?.color ?? "#23241f",
      hair: this.sim.ownerLook?.hair, face: "🙂", prop: "📄",
      time: this.time, walk: this.keys.left || this.keys.right ? 1 : 0,
      facing: this.keys.right ? 1 : -1,
      glow: "rgba(217,164,65,.6)",
    });
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
        <span>☕ 머신</span><span>🥛 스티머</span><span>${bakes ? "🔥 오븐" : "🍰 쇼케이스"}</span>
        <span>주문서의 <b>Q W E R</b>을 순서대로 — 완성한 잔은 진짜 손님에게</span>
        <b>←→ 레인 · QWER 조리</b>`,
    });
    this.bakes = bakes;
    this.lanes = [
      { icon: "☕", name: "머신", x: this.W * 0.18 },
      { icon: "🥛", name: "스티머", x: this.W * 0.5 },
      { icon: bakes ? "🔥" : "🍰", name: bakes ? "오븐" : "쇼케이스", x: this.W * 0.82 },
    ].map((lane) => ({ ...lane, order: null }));
    this.slot = 0;
    this.stats = { made: 0, missed: 0, wrong: 0 };
    this.nextOrder = 0.3;
  }

  spawnOrder() {
    const empty = this.lanes.map((lane, index) => ({ lane, index })).filter((item) => !item.lane.order);
    if (!empty.length) return;
    // 내 메뉴판에서 실제로 파는 메뉴가 주문으로 들어온다
    const menus = this.sim.menus;
    const menu = menus[Math.floor(Math.random() * menus.length)];
    const laneIndex = laneFor(menu, this.bakes);
    const target = empty.find((item) => item.index === laneIndex) ?? empty[Math.floor(Math.random() * empty.length)];
    target.lane.order = { menu, combo: comboFor(menu), step: 0, patience: 9.5, pop: 0 };
  }

  update(dt) {
    if (this.leftTap) this.slot = Math.max(0, this.slot - 1);
    if (this.rightTap) this.slot = Math.min(this.lanes.length - 1, this.slot + 1);

    this.nextOrder -= dt;
    if (this.nextOrder <= 0) {
      this.spawnOrder();
      const queue = this.sim.activeAgents.filter((agent) => agent.state === "queueing").length;
      this.nextOrder = Math.max(0.8, 2.0 - queue * 0.12);
    }

    // QWER 입력 — 서 있는 레인의 주문 콤보를 순서대로
    const lane = this.lanes[this.slot];
    if (this.actionTap && lane.order) {
      const expected = lane.order.combo[lane.order.step];
      if (this.actionTap === expected) {
        lane.order.step += 1;
        lane.order.pop = 0.25;
        this.burst(lane.x, this.H * 0.4, "#f0c674", 6, 90);
        this.sounds?.click();
        if (lane.order.step >= lane.order.combo.length) {
          this.stats.made += 1;
          this.bumpCombo();
          this.sim.expressServe();
          this.burst(lane.x, this.H * 0.42, "#8fd6ab", 18, 150);
          this.addFloat(lane.x, this.H * 0.36, `${lane.order.menu.name} 완성!`, "#8fd6ab");
          this.sounds?.good();
          lane.order = null;
        }
      } else {
        this.stats.wrong += 1;
        this.breakCombo();
        lane.order.patience -= 0.8;
        this.addFloat(lane.x, this.H * 0.48, "삑! 순서가 달라요", "#e07a6a");
        this.sounds?.bad();
      }
    } else if (this.actionTap && !lane.order) {
      this.addFloat(lane.x, this.H * 0.48, "이 레인엔 주문이 없어요", "#9c8b7c");
    }

    for (const item of this.lanes) {
      if (!item.order) continue;
      item.order.patience -= dt;
      if (item.order.pop > 0) item.order.pop -= dt;
      if (item.order.patience <= 0) {
        this.stats.missed += 1;
        this.breakCombo();
        this.addFloat(item.x, this.H * 0.4, `${item.order.menu.name} 식었다…`, "#e07a6a");
        this.sounds?.bad();
        item.order = null;
      }
    }
  }

  render(ctx) {
    // 주방 배경 — 타일 벽과 조리대
    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, "#2a2019");
    bg.addColorStop(1, "#1c150f");
    ctx.fillStyle = bg;
    ctx.fillRect(-12, -12, this.W + 24, this.H + 24);
    // 타일
    ctx.strokeStyle = "rgba(240,230,214,.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < this.W; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H * 0.34); ctx.stroke(); }
    for (let y = 0; y < this.H * 0.34; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke(); }
    // 선반 + 잔들
    ctx.fillStyle = "#4a3524";
    ctx.fillRect(30, 46, this.W - 60, 10);
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = ["#efe6d8", "#d9a441", "#8fae9b", "#c9a284"][i % 4];
      roundRect(ctx, 60 + i * (this.W - 140) / 7, 28, 16, 18, 3);
      ctx.fill();
    }
    // 조리대
    ctx.fillStyle = "#5a3c2b";
    ctx.fillRect(0, this.H * 0.52, this.W, 30);
    ctx.fillStyle = "#41291d";
    ctx.fillRect(0, this.H * 0.52 + 30, this.W, this.H);

    for (let i = 0; i < this.lanes.length; i += 1) {
      const lane = this.lanes[i];
      const active = i === this.slot;
      // 장비 유닛
      ctx.fillStyle = active ? "#463527" : "#332619";
      roundRect(ctx, lane.x - 64, this.H * 0.3, 128, this.H * 0.22, 8);
      ctx.fill();
      if (active) {
        ctx.strokeStyle = "rgba(240,198,116,.75)";
        ctx.lineWidth = 2.4;
        roundRect(ctx, lane.x - 64, this.H * 0.3, 128, this.H * 0.22, 8);
        ctx.stroke();
      }
      ctx.font = "44px serif";
      ctx.textAlign = "center";
      ctx.fillText(lane.icon, lane.x, this.H * 0.47);
      ctx.font = "700 13px 'NeoDunggeunmo', sans-serif";
      ctx.fillStyle = "rgba(240,230,214,.8)";
      ctx.fillText(lane.name, lane.x, this.H * 0.585);

      // 주문 티켓 — 실제 메뉴 이름 + QWER 콤보
      if (lane.order) {
        const { menu, combo, step, patience, pop } = lane.order;
        const ticketY = this.H * 0.08;
        const scalePop = 1 + Math.max(0, pop) * 0.5;
        ctx.save();
        ctx.translate(lane.x, ticketY + 30);
        ctx.scale(scalePop, scalePop);
        ctx.translate(-lane.x, -(ticketY + 30));
        ctx.fillStyle = "#f4ecdc";
        ctx.strokeStyle = "rgba(20,14,8,.5)";
        ctx.lineWidth = 2;
        roundRect(ctx, lane.x - 74, ticketY, 148, 62, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#3c3226";
        ctx.font = "700 13px 'NeoDunggeunmo', sans-serif";
        ctx.fillText(`${menu.icon} ${menu.name}`, lane.x, ticketY + 20);
        // 콤보 키
        const keyWidth = 26;
        const startX = lane.x - ((combo.length - 1) * (keyWidth + 6)) / 2;
        for (let k = 0; k < combo.length; k += 1) {
          const done = k < step;
          const current = k === step;
          ctx.fillStyle = done ? "#5fa57c" : current ? "#d9a441" : "#c9beac";
          roundRect(ctx, startX + k * (keyWidth + 6) - keyWidth / 2, ticketY + 28, keyWidth, 24, 4);
          ctx.fill();
          if (current) {
            ctx.strokeStyle = "#8a5f1e";
            ctx.lineWidth = 2;
            roundRect(ctx, startX + k * (keyWidth + 6) - keyWidth / 2, ticketY + 28, keyWidth, 24, 4);
            ctx.stroke();
          }
          ctx.fillStyle = done ? "#eafff2" : "#2c2418";
          ctx.font = "800 14px 'NeoDunggeunmo', monospace";
          ctx.fillText(combo[k], startX + k * (keyWidth + 6), ticketY + 45);
        }
        // 인내 게이지
        ctx.fillStyle = "#171310";
        ctx.fillRect(lane.x - 64, ticketY + 68, 128, 7);
        ctx.fillStyle = patience < 3.2 ? "#c25a4a" : "#5fa57c";
        ctx.fillRect(lane.x - 64, ticketY + 68, 128 * Math.max(0, patience / 9.5), 7);
        ctx.restore();
        // 김 (스팀)
        if (step > 0) {
          ctx.strokeStyle = "rgba(240,230,214,.35)";
          ctx.lineWidth = 2;
          for (let sIdx = -1; sIdx <= 1; sIdx += 1) {
            ctx.beginPath();
            ctx.moveTo(lane.x + sIdx * 10, this.H * 0.33);
            ctx.quadraticCurveTo(lane.x + sIdx * 10 + Math.sin(this.time * 3 + sIdx) * 6, this.H * 0.27, lane.x + sIdx * 10, this.H * 0.22);
            ctx.stroke();
          }
        }
      }
    }
    // 사장 — 셰프 모드
    paintPerson(ctx, {
      x: this.lanes[this.slot].x, y: this.H * 0.76, scale: 1.25,
      body: this.sim.ownerLook?.color ?? "#23241f",
      hair: this.sim.ownerLook?.hair, face: "🧑‍🍳", prop: "🥄",
      time: this.time, walk: 0, glow: "rgba(217,164,65,.5)",
    });
  }

  hudText() { return `${this.stats.made}개 완성 · ${this.stats.missed} 놓침`; }

  resultRows() {
    return [
      { label: "직접 만든 메뉴", value: `${this.stats.made}개 — 대기 손님이 바로 받았습니다` },
      ...(this.stats.missed ? [{ label: "식어버린 주문", value: `${this.stats.missed}개`, bad: true }] : []),
      ...(this.stats.wrong ? [{ label: "조리 실수", value: `${this.stats.wrong}번`, bad: true }] : []),
    ];
  }
}

// ─── 홀 서빙 ────────────────────────────────────────────────
// 내 매장의 실제 테이블 수만큼 나온다. ←→로 이동, 스페이스 연타로 처리.
const HALL_TASKS = [
  { id: "call", icon: "🖐", label: "응대", taps: 2 },
  { id: "order", icon: "📝", label: "주문서", taps: 3 },
  { id: "serve", icon: "🍽", label: "서빙", taps: 3 },
  { id: "bus", icon: "🧹", label: "정리", taps: 4 },
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
        <span>🖐 응대</span><span>📝 주문서</span><span>🍽 서빙</span><span>🧹 정리</span>
        <span>테이블 앞에서 <b>스페이스 연타</b> · 우리 매장 테이블 ${realTables}개 그대로</span>
        <b>←→ 이동 · SPACE 처리</b>`,
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
  }

  spawnTask() {
    const empty = this.tables.filter((table) => !table.task);
    if (!empty.length) return;
    const table = empty[Math.floor(Math.random() * empty.length)];
    const caller = this.sim.activeAgents.find((agent) => agent.serviceRequested && !agent.serviceResolved && !agent.arcadeTaken);
    const dirty = this.sim.tables.find((item) => item.state === "dirty" && !item.arcadeTaken);
    let kind;
    if (caller) { kind = HALL_TASKS[0]; caller.arcadeTaken = true; table.agentId = caller.id; }
    else if (dirty) { kind = HALL_TASKS[3]; dirty.arcadeTaken = true; table.tableId = dirty.id; }
    else kind = HALL_TASKS[1 + Math.floor(Math.random() * 2)];
    table.task = { kind, taps: 0, patience: 8.5, pop: 0 };
  }

  update(dt) {
    if (this.leftTap) this.slot = Math.max(0, this.slot - 1);
    if (this.rightTap) this.slot = Math.min(this.tables.length - 1, this.slot + 1);

    this.nextTask -= dt;
    if (this.nextTask <= 0) {
      this.spawnTask();
      this.nextTask = 1.0 + Math.random() * 0.9;
    }

    const table = this.tables[this.slot];
    if (this.spaceTap && table.task) {
      table.task.taps += 1;
      table.task.pop = 0.22;
      this.burst(table.x, this.H * 0.5, "#efe6d8", 5, 70);
      this.sounds?.click();
      if (table.task.taps >= table.task.kind.taps) {
        this.stats.handled += 1;
        this.bumpCombo();
        if (table.task.kind.id === "call" && table.agentId) this.sim.attendCustomer(table.agentId);
        else if (table.task.kind.id === "bus" && table.tableId != null) this.sim.expressClean(table.tableId);
        else this.sim.hallDelight();
        this.burst(table.x, this.H * 0.44, "#8fd6ab", 16, 140);
        this.addFloat(table.x, this.H * 0.4, `${table.task.kind.label} 완료!`, "#8fd6ab");
        this.sounds?.good();
        table.task = null;
        table.agentId = null;
        table.tableId = null;
      }
    } else if (this.spaceTap && !table.task) {
      this.addFloat(table.x, this.H * 0.5, "이 테이블은 괜찮아요", "#9c8b7c");
    }

    for (const item of this.tables) {
      if (!item.task) continue;
      if (item.task.pop > 0) item.task.pop -= dt;
      item.task.patience -= dt;
      if (item.task.patience <= 0) {
        this.stats.missed += 1;
        this.breakCombo();
        this.addFloat(item.x, this.H * 0.44, "늦었다…", "#e07a6a");
        this.sounds?.bad();
        item.task = null;
      }
    }
  }

  render(ctx) {
    // 홀 배경 — 창밖 야경과 나무 바닥
    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, "#241b14");
    bg.addColorStop(1, "#1a130d");
    ctx.fillStyle = bg;
    ctx.fillRect(-12, -12, this.W + 24, this.H + 24);
    // 창문
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
    // 펜던트 조명
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
    // 바닥 플랭크
    ctx.strokeStyle = "rgba(240,230,214,.05)";
    ctx.lineWidth = 1.2;
    for (let y = this.H * 0.62; y < this.H; y += 26) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }

    for (let i = 0; i < this.tables.length; i += 1) {
      const table = this.tables[i];
      const active = i === this.slot;
      // 손님
      if (table.guest) {
        paintPerson(ctx, {
          x: table.x - 40, y: this.H * 0.56, scale: 0.9,
          body: table.guestColor, skin: table.guestSkin, hair: table.guestHair,
          time: this.time, walk: 0,
        });
      }
      // 테이블
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
      // 잔·접시
      ctx.fillStyle = "#efe6d8";
      ctx.beginPath();
      ctx.ellipse(table.x + 18, this.H * 0.55 + 4, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 과제 말풍선
      if (table.task) {
        const { kind, taps, patience, pop } = table.task;
        const by = this.H * 0.3;
        const scalePop = 1 + Math.max(0, pop) * 0.5;
        ctx.save();
        ctx.translate(table.x, by + 24);
        ctx.scale(scalePop, scalePop);
        ctx.translate(-table.x, -(by + 24));
        ctx.fillStyle = "#f4ecdc";
        ctx.strokeStyle = "rgba(20,14,8,.5)";
        ctx.lineWidth = 2;
        roundRect(ctx, table.x - 46, by, 92, 48, 8);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(table.x - 8, by + 48);
        ctx.lineTo(table.x, by + 60);
        ctx.lineTo(table.x + 8, by + 48);
        ctx.closePath();
        ctx.fill();
        ctx.font = "22px serif";
        ctx.textAlign = "center";
        ctx.fillText(kind.icon, table.x - 16, by + 32);
        ctx.fillStyle = "#3c3226";
        ctx.font = "700 12px 'NeoDunggeunmo', sans-serif";
        ctx.fillText(kind.label, table.x + 16, by + 24);
        // 스페이스 연타 도트
        for (let k = 0; k < kind.taps; k += 1) {
          ctx.fillStyle = k < taps ? "#5fa57c" : "#c9beac";
          ctx.beginPath();
          ctx.arc(table.x - 12 + k * 12, by + 38, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        // 인내 게이지
        ctx.fillStyle = "#171310";
        ctx.fillRect(table.x - 46, by + 64, 92, 6);
        ctx.fillStyle = patience < 3 ? "#c25a4a" : "#5fa57c";
        ctx.fillRect(table.x - 46, by + 64, 92 * Math.max(0, patience / 8.5), 6);
      }
    }
    // 사장 — 쟁반을 든
    paintPerson(ctx, {
      x: this.tables[this.slot].x, y: this.H * 0.85, scale: 1.22,
      body: this.sim.ownerLook?.color ?? "#23241f",
      hair: this.sim.ownerLook?.hair, face: "🙂", prop: "🫙",
      time: this.time, walk: 0, glow: "rgba(217,164,65,.5)",
    });
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

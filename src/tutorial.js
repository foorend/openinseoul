// 첫 영업일 온보딩 — 설명서 대신 직접 한 번씩 눌러보게 한다.
// 각 단계는 실제 UI 요소를 비추고, 그 요소를 클릭해야 다음으로 넘어간다.
//
// 자리 이름은 매장 규모에 따라 달라진다(베이커리는 "키친", 작은 카페는 "바").
// 그래서 문구에는 {bar}·{hall}·{door} 토큰만 쓰고, 화면에 띄울 때
// 실제 버튼에 적힌 이름으로 치환한다. 안내와 버튼이 다른 말을 하면 안 된다.

const STEPS = [
  {
    id: "mode",
    target: "#station-dock",
    title: "먼저 정하세요 — 직접 뛸까, 결과만 볼까",
    body: "이 게임은 두 가지로 즐길 수 있습니다. ① 직접 뛰기: {bar}·{hall}·{door} 미니게임으로 오늘의 수익률을 직접 끌어올립니다 — 물론 못하면 나빠질 수도 있어요. ② 자동(🤖): 내가 고른 상권·평수·집기·메뉴의 결과가 궁금할 때 — 누르는 순간 4배속으로 하루가 자동 진행되고, 마감 리포트로 바로 갑니다. 지금은 직접 뛰는 법부터 배워봅시다.",
    action: "직접 뛰어보겠습니다",
    passive: true,
  },
  {
    id: "work",
    target: "#work-toggle",
    title: "먼저 출근부터",
    body: "스페이스 바 하나로 출근과 쉬기를 오갑니다. 출근하면 근무 게이지가 줄고, 쉬면 멈춥니다.",
    action: "출근을 눌러보세요",
    await: { selector: "#work-toggle", event: "click" },
  },
  {
    id: "overtime",
    target: "#work-toggle",
    title: "초과 근무 — 시간이 끝나도 남을 수 있습니다",
    body: "근무 게이지가 0이 되어도 스페이스를 다시 누르면 초과 근무로 계속 일할 수 있어요. 대신 빨간 스트레스 게이지가 차오르고, 스트레스가 쌓이면 손이 느려집니다. 그리고 초과로 일한 시간까지 전부 연말정산에서 사장 시급으로 청구됩니다 — 공짜 노동은 없습니다.",
    action: "알겠습니다",
    passive: true,
  },
  {
    id: "bar",
    target: '[data-station="bar"]',
    title: "{bar} — 만드는 자리 (직접 해봅시다)",
    body: "미니게임은 자동으로 열리지 않습니다 — {bar} 버튼을 클릭하거나 키보드 1을 눌러야만 시작됩니다. 지금 눌러서 짧은 연습을 해보세요: ←→로 머신·스티머·오븐 레인을 오가고, 주문서에 찍힌 Q W E R을 순서대로 누르면 완성입니다.",
    action: "{bar}을(를) 눌러 연습 시작",
    await: { selector: '[data-station="bar"]', event: "click" },
    practice: "bar",
  },
  {
    id: "hall",
    target: '[data-station="hall"]',
    title: "{hall} — 치우는 자리 (직접 해봅시다)",
    body: "이번엔 {hall}입니다 — 클릭하거나 키보드 2. ←→로 테이블을 오가고, 말풍선에 찍힌 키를 먼저 누른 뒤(주문서 Q · 서빙 W · 응대 E · 정리 R) 스페이스를 두 번 연타하면 처리됩니다. 손님 많은 시간대엔 말풍선이 쏟아집니다.",
    action: "{hall}을(를) 눌러 연습 시작",
    await: { selector: '[data-station="hall"]', event: "click" },
    practice: "hall",
  },
  {
    id: "door",
    target: '[data-station="door"]',
    title: "{door} — 불러오는 자리 (직접 해봅시다)",
    body: "마지막으로 {door} — 클릭하거나 키보드 3. ←→만으로 조작하는 전단지 돌리기입니다. 행인은 잡으면 매출, 진상은 잡으면 돈 안 내고 짜증만, 리뷰어는 복불복. 피크 시간대나 성수기 달엔 사람이 훨씬 많이 쏟아집니다 — 화면 위 표시를 보세요.",
    action: "{door}을(를) 눌러 연습 시작",
    await: { selector: '[data-station="door"]', event: "click" },
    practice: "door",
  },
  {
    id: "auto",
    target: "#station-auto",
    title: "결과만 빨리 보고 싶다면 — 자동",
    body: "자동은 '귀찮아서'가 아니라 '내 선택의 성적표가 궁금할 때' 쓰는 버튼입니다. 켜는 순간 사장이 알아서 움직이고 4배속으로 하루가 흘러, 미니게임 없이 마감 리포트로 직행합니다. 그것도 길면 옆의 스킵(⏭) — 남은 하루를 즉시 계산해 리포트를 바로 보여줍니다. 자리를 직접 찍으면 다시 수동이 됩니다.",
    action: "확인했습니다",
    passive: true,
  },
  {
    id: "speed",
    target: ".control-dock",
    title: "속도는 직접 잡으세요",
    body: "지켜보고 싶으면 1×, 넘기고 싶으면 4×. 돌발 상황이 오면 어떤 속도든 자동으로 멈춥니다. 하루가 끝나면 마감 리포트와 함께 '장사 노트'가 열립니다 — 손님이 가르쳐 준 것들이 다음 판의 무기가 됩니다.",
    action: "속도 버튼을 눌러보세요",
    await: { selector: "[data-speed]", event: "click" },
  },
];

const STORAGE_KEY = "ois-cafe/tutorial-done-v5";

export function tutorialCompleted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* 저장 못 해도 이번 판은 정상 진행된다 */
  }
}

export class Tutorial {
  constructor({ onFinish, onStep, stationNames } = {}) {
    this.onFinish = onFinish ?? (() => {});
    this.onStep = onStep ?? (() => {});
    this.names = { bar: "바", hall: "홀", door: "입구", ...(stationNames ?? {}) };
    this.index = 0;
    this.root = null;
    this.cleanupAwait = null;
    this.reposition = this.reposition.bind(this);
  }

  start() {
    this.root = document.createElement("div");
    this.root.className = "tutorial-layer";
    this.root.innerHTML = `
      <div class="tutorial-mask" id="tut-mask"></div>
      <div class="tutorial-ring" id="tut-ring" hidden></div>
      <div class="tutorial-card" id="tut-card" role="dialog" aria-live="polite">
        <div class="tutorial-head">
          <span class="tutorial-step" id="tut-step"></span>
          <button class="tutorial-skip" id="tut-skip" type="button">튜토리얼 건너뛰기</button>
        </div>
        <h3 id="tut-title"></h3>
        <p id="tut-body"></p>
        <div class="tutorial-foot">
          <div class="tutorial-dots" id="tut-dots"></div>
          <button class="tutorial-next" id="tut-next" type="button"></button>
        </div>
      </div>`;
    document.body.append(this.root);
    this.root.querySelector("#tut-skip").addEventListener("click", () => this.finish(true));
    this.root.querySelector("#tut-next").addEventListener("click", () => this.advance());
    window.addEventListener("resize", this.reposition);
    window.addEventListener("scroll", this.reposition, true);
    this.render();
  }

  get step() {
    return STEPS[this.index];
  }

  // {bar} 같은 토큰을 실제 버튼 이름으로 바꾸고, 조사도 받침에 맞춰 고른다.
  fill(text) {
    return text
      .replace(/\{(bar|hall|door)\}/g, (_, key) => this.names[key])
      .replace(/(.)(을\(를\)|이\(가\)|은\(는\))/g, (match, char, particle) => {
        const code = char.charCodeAt(0);
        const hasBatchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
        const pair = { "을(를)": ["를", "을"], "이(가)": ["가", "이"], "은(는)": ["는", "은"] }[particle];
        return char + pair[hasBatchim ? 1 : 0];
      });
  }

  render() {
    const step = this.step;
    if (!step) return this.finish(false);
    this.onStep(step);

    this.root.querySelector("#tut-step").textContent = `${this.index + 1} / ${STEPS.length}`;
    this.root.querySelector("#tut-title").textContent = this.fill(step.title);
    this.root.querySelector("#tut-body").textContent = this.fill(step.body);
    this.root.querySelector("#tut-dots").innerHTML = STEPS
      .map((_, i) => `<i class="${i === this.index ? "is-current" : i < this.index ? "is-done" : ""}"></i>`).join("");

    const next = this.root.querySelector("#tut-next");
    next.textContent = this.fill(step.action);
    // 클릭을 기다리는 단계에서는 버튼이 안내문 역할만 한다.
    next.classList.toggle("is-hint", !step.passive);
    next.disabled = !step.passive;

    this.bindAwait(step);
    this.reposition();
  }

  bindAwait(step) {
    this.cleanupAwait?.();
    this.cleanupAwait = null;
    if (step.passive || !step.await) return;

    const target = document.querySelector(step.await.selector);
    // 대상이 없거나 눌리지 않는 상태면 튜토리얼이 막힌다.
    // 그런 단계는 안내만 하고 넘어갈 수 있게 버튼을 살려 둔다.
    const blocked = !target || target.disabled;
    const next = this.root.querySelector("#tut-next");
    if (blocked) {
      next.disabled = false;
      next.classList.remove("is-hint");
      next.textContent = "다음";
    }

    const handler = (event) => {
      if (!event.target.closest(step.await.selector)) return;
      // 연습 스텝 — 클릭하면 미니게임 연습이 열린다. 카드는 비켜 주고,
      // 연습이 끝나는 순간 main이 advance()를 불러 다음 스텝으로 넘어간다.
      if (step.practice) {
        this.enterWaiting();
        return;
      }
      setTimeout(() => this.advance(), 260);
    };
    document.addEventListener(step.await.event, handler, true);

    // 8초가 지나도 못 눌렀다면 스스로 길을 열어준다.
    const rescue = setTimeout(() => {
      const button = this.root?.querySelector("#tut-next");
      if (!button) return;
      button.disabled = false;
      button.classList.remove("is-hint");
      button.textContent = "다음으로 넘어가기";
    }, 8000);

    this.cleanupAwait = () => {
      document.removeEventListener(step.await.event, handler, true);
      clearTimeout(rescue);
    };
  }

  reposition() {
    if (!this.root) return;
    const step = this.step;
    const ring = this.root.querySelector("#tut-ring");
    const card = this.root.querySelector("#tut-card");
    const target = step?.target ? document.querySelector(step.target) : null;
    if (!target) {
      ring.hidden = true;
      card.style.left = "50%";
      card.style.top = "auto";
      card.style.bottom = "40px";
      card.style.transform = "translateX(-50%)";
      return;
    }
    const rect = target.getBoundingClientRect();
    const pad = 8;
    ring.hidden = false;
    ring.style.left = `${rect.left - pad}px`;
    ring.style.top = `${rect.top - pad}px`;
    ring.style.width = `${rect.width + pad * 2}px`;
    ring.style.height = `${rect.height + pad * 2}px`;

    // 카드는 대상 아래에 두되, 화면을 벗어나면 위로 붙인다.
    const cardRect = card.getBoundingClientRect();
    const below = rect.bottom + 16;
    const fitsBelow = below + cardRect.height < window.innerHeight - 12;
    card.style.bottom = "auto";
    card.style.transform = "none";
    card.style.top = `${fitsBelow ? below : Math.max(12, rect.top - cardRect.height - 16)}px`;
    card.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - cardRect.width - 12)}px`;
  }

  // 연습 미니게임이 도는 동안 카드·마스크를 치워 화면을 비워준다
  enterWaiting() {
    this.root?.classList.add("is-waiting");
  }

  advance() {
    this.root?.classList.remove("is-waiting");
    this.index += 1;
    if (this.index >= STEPS.length) {
      this.finish(false);
      return;
    }
    this.render();
  }

  finish(skipped) {
    this.cleanupAwait?.();
    window.removeEventListener("resize", this.reposition);
    window.removeEventListener("scroll", this.reposition, true);
    this.root?.remove();
    this.root = null;
    markCompleted();
    this.onFinish({ skipped });
  }
}

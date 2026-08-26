// 첫 영업일 온보딩 — 설명서 대신 직접 한 번씩 눌러보게 한다.
// 각 단계는 실제 UI 요소를 비추고, 그 요소를 클릭해야 다음으로 넘어간다.
//
// 자리 이름은 매장 규모에 따라 달라진다(베이커리는 "키친", 작은 카페는 "바").
// 그래서 문구에는 {bar}·{hall}·{door} 토큰만 쓰고, 화면에 띄울 때
// 실제 버튼에 적힌 이름으로 치환한다. 안내와 버튼이 다른 말을 하면 안 된다.

const STEPS = [
  {
    id: "station",
    target: "#station-dock",
    title: "이 게임은 딱 하나만 물어봅니다",
    body: "\"지금 사장은 어디에 서 있어야 하는가.\" {bar}·{hall}·{door} 세 자리가 있고, 자리마다 할 수 있는 일이 다릅니다. 동시에 셋은 못 합니다.",
    action: "알겠습니다",
    passive: true,
  },
  {
    id: "work",
    target: "#work-toggle",
    title: "먼저 출근부터",
    body: "스페이스 바 하나로 출근과 쉬기를 오갑니다. 출근하면 게이지가 줄고, 쉬면 멈춥니다. 시간이 다 떨어져도 원하면 끝까지 남을 수 있어요 — 대신 빨간 스트레스 게이지가 차오르고, 그 시간까지 전부 연말에 사장 시급으로 청구됩니다.",
    action: "출근을 눌러보세요",
    await: { selector: "#work-toggle", event: "click" },
  },
  {
    id: "bar",
    target: '[data-station="bar"]',
    title: "{bar} — 만드는 자리",
    body: "도착하는 순간 전체화면 '키친 러시'가 시작됩니다. ←→로 머신·스티머·오븐 레인을 오가고, 주문서에 찍힌 Q W E R 키를 순서대로 누르면 조리 완성 — 주문서에는 당신이 실제로 파는 메뉴가 나옵니다. 완성한 잔은 지금 줄 서 있는 진짜 손님에게 바로 나갑니다.",
    action: "{bar}을(를) 눌러보세요",
    await: { selector: '[data-station="bar"]', event: "click" },
  },
  {
    id: "inside",
    target: ".interior-panel",
    title: "왼쪽이 지금 주방입니다",
    body: "잔이 차오르는 게 지금 만들어지는 음료예요. 머신이 더러워지면 클릭해서 청소하고, 쇼케이스가 줄면 클릭해서 채웁니다 — 단, 사장이 {bar}에 있을 때만요.",
    action: "확인했습니다",
    passive: true,
  },
  {
    id: "hall",
    target: '[data-station="hall"]',
    title: "{hall} — 치우는 자리",
    body: "도착하면 전체화면 '홀 서빙'이 시작됩니다. 우리 매장의 실제 테이블 수만큼 나오고, ←→로 오가며 말풍선이 뜬 테이블 앞에서 스페이스를 연타하면 응대·주문서·서빙·정리가 처리됩니다. 실제로 손 든 손님과 안 치운 테이블이 과제로 들어와요.",
    action: "{hall}을(를) 눌러보세요",
    await: { selector: '[data-station="hall"]', event: "click" },
  },
  {
    id: "door",
    target: '[data-station="door"]',
    title: "{door} — 불러오는 자리",
    body: "도착하면 '전단지 돌리기'가 시작됩니다. ←→만으로 조작하는 낙하 디펜스 — 단골(안 잡아도 옵니다), 행인(잡으면 매출), 진상(잡으면 돈 안 내고 짜증만), 리뷰어(복불복 — 호평이 터질 수도, 별점 테러일 수도). 잡은 행인은 진짜 손님으로 걸어 들어옵니다.",
    action: "{door}을(를) 눌러보세요",
    await: { selector: '[data-station="door"]', event: "click" },
  },
  {
    id: "supply",
    target: "#station-dock",
    title: "품절이 나면 — 발주",
    body: "쇼케이스가 비면 여기에 '발주 승인' 버튼이 나타납니다. 사장이 쉬는 중이어도 집에서 전화 한 통으로 승인할 수 있고, 매니저가 받아서 처리합니다.",
    action: "알겠습니다",
    passive: true,
  },
  {
    id: "auto",
    target: "#station-auto",
    title: "다 챙기기 어렵다면 — 자동",
    body: "자동을 켜면 사장이 병목을 보고 알아서 움직입니다. 줄이 길면 만들러, 테이블이 밀리면 치우러. 자리를 직접 찍으면 다시 수동이 됩니다.",
    action: "확인했습니다",
    passive: true,
  },
  {
    id: "speed",
    target: ".control-dock",
    title: "속도는 직접 잡으세요",
    body: "지켜보고 싶으면 1×, 넘기고 싶으면 4×. 돌발 상황이 오면 어떤 속도든 자동으로 멈춥니다.",
    action: "속도 버튼을 눌러보세요",
    await: { selector: "[data-speed]", event: "click" },
  },
  {
    id: "notebook",
    target: "#open-notebook",
    title: "손님이 가르쳐 준 것은 쌓입니다",
    body: "메뉴×손님 적합도는 실제로 팔아봐야 밝혀집니다. 장사 노트에서 확인하세요.",
    action: "장사 노트를 열어보세요",
    await: { selector: "#open-notebook", event: "click" },
  },
];

const STORAGE_KEY = "ois-cafe/tutorial-done-v4";

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

  advance() {
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

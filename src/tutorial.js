import { DISTRICTS, FORMATS, MENUS } from "./data.js?release=20261006d";
import { RestaurantSimulation, formatMoney } from "./sim.js?release=20261006d";

// 설명용 고정 상황도 실제 엔진으로 계산한다. 캠페인·교육 점수에는 합산하지 않는다.
export function createOpeningPractice() {
  const sim = new RestaurantSimulation({ seed: "OPENING-PRACTICE-1", district: DISTRICTS[2], format: FORMATS[0], menus: MENUS.slice(0, 2), cash: 5000, reputation: 68, awareness: 60, hygiene: 86 });
  sim.startDay(1);
  sim.arrivals = [];
  sim.activeAgents = [];
  sim.tables.forEach(table => { table.state = "dirty"; table.cleanAt = 0; table.dirtyAt = sim.gameMinute; });
  sim.toggleOwnerWork(true);
  sim.setOwnerAuto(false);
  sim.setSpeed(0);
  return sim;
}

export class Tutorial {
  constructor({ onFinish, Scene } = {}) { this.Scene = Scene; this.onFinish = onFinish ?? (() => {}); this.sim = createOpeningPractice(); this.phase = "choose"; }

  start() {
    this.root = document.createElement("dialog");
    this.root.className = "opening-practice";
    this.root.innerHTML = `<header><span>첫 90초 · 한 번 해보기</span><button class="text-button" data-skip>건너뛰기</button></header>
      <h2>손님이 오는데, 앉을 자리가 없어요.</h2>
      <p class="practice-scope">1인 카페 연습 상황 · 실제 계산 규칙 사용 · 내 가게 장부에는 반영되지 않습니다.</p>
      <div class="practice-scene"><canvas aria-label="홀 정리 전후와 손님을 보여주는 연습 매장"></canvas></div>
      <div class="practice-metrics" aria-live="polite"></div>
      <p class="practice-feedback" role="status">테이블이 모두 정리를 기다립니다. 사장을 어디로 보낼까요?</p>
      <div class="practice-actions"><button class="primary-button" data-clean>홀로 가서 자리 만들기</button><button class="secondary-button" data-wrong>바에서 제조하기</button></div><button class="text-button" data-pause hidden>연습 일시정지</button><button class="text-button" data-observe hidden>손님 제공까지 빠르게 보기</button>`;
    document.body.append(this.root);
    this.root.showModal();
    this.scene = new this.Scene(this.root.querySelector("canvas"), { district: this.sim.district, format: this.sim.format, menus: this.sim.menus, restaurantName: "첫손님 연습카페" });
    this.root.querySelector("[data-skip]").onclick = () => this.finish(true);
    this.root.addEventListener("cancel", event => { event.preventDefault(); this.finish(true); });
    this.root.querySelector("[data-wrong]").onclick = () => { this.root.querySelector(".practice-feedback").textContent = "커피를 만들어도 놓을 자리가 없습니다. 먼저 홀에서 자리를 확보해 보세요."; };
    this.root.querySelector("[data-clean]").onclick = () => {
      this.phase = "cleaning";
      this.sim.moveOwner("hall");
      this.sim.setSpeed(1);
      this.root.querySelector("[data-pause]").hidden = false;
      this.root.querySelector("[data-observe]").hidden = false;
      this.root.querySelectorAll(".practice-actions button").forEach(button => { button.disabled = true; });
      this.root.querySelector(".practice-feedback").textContent = "사장이 이동해 테이블을 정리합니다. 이동·정리 시간도 노동으로 셉니다.";
    };
    this.root.querySelector("[data-pause]").onclick = event => {
      this.sim.setSpeed(this.sim.speed ? 0 : 1);
      event.currentTarget.textContent = this.sim.speed ? "연습 일시정지" : "연습 계속";
    };
    const tick = delta => {
      const snap = this.sim.update(delta);
      if (this.phase === "cleaning" && snap.tables.some(table => table.state === "free")) {
        this.phase = "serving";
        this.sim.spawnAgent({ id: "practice-guest", day: 1, hour: this.sim.openHour, spawnMinute: this.sim.gameMinute, customerId: "local_resident", guaranteed: true, randomKey: 1 });
        this.sim.activeAgents.at(-1).channel = "dine";
        this.root.querySelector(".practice-feedback").textContent = "자리가 생겼습니다. 연습 손님 한 명이 입장하고 주문하는 모습을 보세요.";
      }
      this.scene.draw(snap, delta);
      this.root.querySelector(".practice-metrics").textContent = `빈 테이블 ${snap.tables.filter(table => table.state === "free").length}개 · 제공 ${snap.metrics.served}명 · 매출 ${formatMoney(snap.metrics.revenue, true)} · 내 노동 ${snap.ownerMinutesToday.toFixed(1)}분`;
      if (this.phase === "serving" && snap.metrics.served > 0) {
        this.phase = "reflect"; this.sim.setSpeed(0);
        this.root.querySelector("[data-pause]").hidden = true;
        this.root.querySelector("[data-observe]").hidden = true;
        this.root.querySelector("h2").textContent = "첫 손님에게 커피가 나갔어요.";
        this.root.querySelector(".practice-feedback").textContent = "직접 정리해 좌석을 확보했고, 손님에게 메뉴를 제공했습니다. 매출과 함께 내 노동시간도 늘었습니다. 무엇을 배웠나요?";
        this.root.querySelector(".practice-actions").innerHTML = '<button class="primary-button" data-understood>자리도 내 시간도 함께 관리해야 한다</button><button class="secondary-button" data-misread>방금 매출은 전부 내 순이익이다</button>';
        this.root.querySelector("[data-understood]").onclick = () => this.finish(false);
        this.root.querySelector("[data-misread]").onclick = () => { this.root.querySelector(".practice-feedback").textContent = "매출에서 재료·급여·월세 등 비용이 나갑니다. 방금 쓴 내 시간까지 마감에서 함께 확인해 보세요."; };
      }
    };
    this.root.querySelector("[data-observe]").onclick = () => {
      this.sim.setSpeed(1);
      for (let i = 0; i < 900 && this.phase !== "reflect"; i++) tick(.1);
    };
    let last = 0;
    const frame = time => {
      if (!this.root) return;
      tick(last ? Math.min(.15, (time - last) / 1000) : .016);
      last = time;
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  finish(skipped) {
    cancelAnimationFrame(this.raf);
    this.root?.close(); this.root?.remove(); this.root = null;
    this.onFinish({ skipped, served: this.sim.metrics.served, ownerMinutes: this.sim.ownerInterventionMinutes });
  }
}

import { DATA_VERSION, HOUR_PLANS, STAFFING_PLANS, OWNER_ROLES, MENUS, CUSTOMERS, getById } from "./data.js?release=20261006d";
import { compareCondition, experimentChoices } from "./experiment.js?release=20261006d";
import { RestaurantSimulation } from "./sim.js?release=20261006d";

export function buildCoach(saved, context) {
  const options = [
    ["hourPlan", "영업시간", HOUR_PLANS, saved.data.hourPlan.id === "office" ? "standard" : "office", "영업시간을 바꾸면 인건비와 판매 기회가 함께 변합니다."],
    ["staffing", "직원 편성", STAFFING_PLANS, saved.data.staffing.id === "full" ? "trim" : "full", "급여 절감만 보지 말고 대기 이탈과 사장의 추가 노동을 함께 확인하세요."],
    ["ownerRole", "사장 근무", OWNER_ROLES, saved.data.ownerRole.id === "manager" ? "peak" : "manager", "사장이 빠진 시간에 직원과 설비가 처리할 수 있는 수요인지 비교하세요."],
  ];
  const legal = experimentChoices(saved, context);
  const cards = options.filter(([key, , , id]) => legal.some(item => item.key === key && item.id === id)).map(([key, title, collection, id, explanation]) => {
    const result = compareCondition(saved, context, { key, id });
    return { id: key, title, change: { key, id }, version: DATA_VERSION, seed: result.seed,
      from: getById(collection, result.from).name, to: getById(collection, id).name,
      facts: { beforeProfit: result.before.profit, afterProfit: result.after.profit, profitDelta: result.delta.profit,
        beforeHours: result.before.ownerMinutes / 60, afterHours: result.after.ownerMinutes / 60,
        hoursDelta: result.delta.ownerMinutes / 60, servedDelta: result.delta.served },
      sources: ["scenario", "vat", "wage"], explanation,
    };
  });
  const losses = context.losses ?? {};
  const issue = Object.entries(losses).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (["menu", "price", "value", "taste", "delivery"].includes(issue)) {
    const sim = RestaurantSimulation.fromState(saved);
    const visitors = context.byType ?? {};
    const score = menu => CUSTOMERS.reduce((sum, customer) => sum + sim.scoreMenu(menu, customer, 14).score * (visitors[customer.id]?.footfall ?? sim.district.mix[customer.id] ?? 0), 0);
    // 한 메뉴만 교체한다. 고객 구성 적합도는 후보 선택 가설이며 결과는 같은 엔진으로 별도 계산한다.
    const choices = experimentChoices(saved, context).filter(change => change.key === "menu").sort((a, b) => {
      const gain = change => { const [old, next] = change.id.split(">"); return score(getById(MENUS, next)) - score(getById(MENUS, old)); };
      return gain(b) - gain(a) || a.id.localeCompare(b.id);
    });
    if (choices.length) {
      const change = choices[0];
      const result = compareCondition(saved, context, change);
      cards.unshift({ id: "menu", title: "메뉴 한 개 교체", change, version: DATA_VERSION, seed: result.seed,
        from: getById(MENUS, result.from).name, to: getById(MENUS, result.to).name,
        observation: `관측한 ${issue === "menu" ? "메뉴 불일치" : "메뉴·가격·경험 관련 이탈"} ${losses[issue]}명에서 시작하는 가설`,
        facts: { beforeProfit: result.before.profit, afterProfit: result.after.profit, profitDelta: result.delta.profit, beforeHours: result.before.ownerMinutes / 60, afterHours: result.after.ownerMinutes / 60, hoursDelta: result.delta.ownerMinutes / 60, servedDelta: result.delta.served },
        sources: ["scenario", "vat", "wage"], explanation: "고객 구성에 맞는 메뉴 한 개를 바꿔 봅니다. 메뉴 불일치에는 품절도 포함되므로 교체가 정답이라고 단정하지 않습니다.",
      });
      return [cards[0], ...cards.slice(1).sort((a, b) => Math.abs(b.facts.profitDelta) - Math.abs(a.facts.profitDelta)).slice(0, 2)];
    }
  }
  cards.sort((a, b) => Math.abs(b.facts.profitDelta) - Math.abs(a.facts.profitDelta));
  if (["wait", "full"].includes(issue)) cards.sort((a, b) => Number(b.id === "staffing") - Number(a.id === "staffing"));
  if (issue === "awareness") {
    cards.sort((a, b) => Number(b.id === "hourPlan") - Number(a.id === "hourPlan"));
    cards[0].observation = `가게를 발견하지 못한 이탈 ${losses[issue]}명. 홍보 개선의 효과를 검증한 것은 아닙니다.`;
    cards[0].explanation = "인지율은 그대로 두고 영업시간만 바꿔, 다른 시간대의 유입 기회를 비교합니다. 홍보 방식은 다음 경영 계획에서 따로 결정하세요.";
  } else if (["wait", "full"].includes(issue)) {
    cards[0].observation = `${issue === "wait" ? "대기" : "좌석 부족"} 이탈 ${losses[issue]}명. 인력 비용과 처리량의 교환 관계를 확인합니다.`;
    cards[0].explanation = cards[0].id === "staffing" ? "혼잡한데 인력을 줄이면 어떤 손해가 생길까요? 감축을 권하는 처방이 아니라 이익·제공 인원·내 노동의 비교 가설입니다." : "감축할 직원이 없어 영업시간 또는 사장 근무를 비교합니다. 제공 인원과 내 노동도 함께 확인하세요.";
  } else cards[0].observation = issue ? "관측한 이탈을 참고해 운영 조건을 비교합니다. 직접 원인으로 확정한 처방은 아닙니다." : "관측된 이탈이 없어 원인을 단정하지 않습니다. 운영 조건 한 가지를 비교합니다.";
  return cards;
}

// 생성기는 숫자·추천 조건을 쓰지 않는다. 계산 엔진의 사실을 고정하고 정성 설명만 받는다.
export async function narrateCoach(cards, endpoint = null, fetcher = globalThis.fetch) {
  const fallback = { mode: "계산 근거 코치 · 생성 AI 미연결", texts: cards.map((card) => card.explanation) };
  if (!endpoint) return fallback;
  if (!/^\/api\/[a-z0-9/_-]+$/i.test(endpoint)) return { ...fallback, mode: "연결 설정 오류 · 계산 근거 코치" };
  try {
    const response = await fetcher(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: DATA_VERSION, cards }), signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error("coach unavailable");
    const payload = await response.json();
    if (payload?.version !== DATA_VERSION || !Array.isArray(payload.cards) || payload.cards.length !== cards.length) throw new Error("invalid coach");
    const texts = cards.map((card) => {
      const matches = payload.cards.filter((item) => item.id === card.id);
      const item = matches[0];
      if (matches.length !== 1 || !Array.isArray(item.sources) || JSON.stringify([...item.sources].sort()) !== JSON.stringify([...card.sources].sort()) || typeof item.text !== "string" || !item.text.trim() || item.text.length > 300 || /\p{N}|보장|무조건|확정수익|대출받|법인전환|반드시 성공/u.test(item.text)) throw new Error("ungrounded coach");
      return item.text;
    });
    return { mode: "AI 정성 설명 · 수치는 계산 엔진 고정 · 설명의 의미는 전문가 검토 필요", texts };
  } catch { return { ...fallback, mode: "AI 연결/검증 실패 · 계산 근거 코치" }; }
}

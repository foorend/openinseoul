import { DATA_VERSION, HOUR_PLANS, STAFFING_PLANS, OWNER_ROLES, getById } from "./data.js?release=20261006";
import { compareCondition } from "./experiment.js?release=20261006";

export function buildCoach(saved, context) {
  const options = [
    ["hourPlan", "영업시간", HOUR_PLANS, saved.data.hourPlan.id === "office" ? "standard" : "office", "영업시간을 바꾸면 인건비와 판매 기회가 함께 변합니다."],
    ["staffing", "직원 편성", STAFFING_PLANS, saved.data.staffing.id === "full" ? "trim" : "full", "급여 절감만 보지 말고 대기 이탈과 사장의 추가 노동을 함께 확인하세요."],
    ["ownerRole", "사장 근무", OWNER_ROLES, saved.data.ownerRole.id === "manager" ? "peak" : "manager", "사장이 빠진 시간에 직원과 설비가 처리할 수 있는 수요인지 비교하세요."],
  ];
  return options.map(([key, title, collection, id, explanation]) => {
    const result = compareCondition(saved, context, { key, id });
    return { id: key, title, change: { key, id }, version: DATA_VERSION, seed: result.seed,
      from: getById(collection, result.from).name, to: getById(collection, id).name,
      facts: { beforeProfit: result.before.profit, afterProfit: result.after.profit, profitDelta: result.delta.profit,
        beforeHours: result.before.ownerMinutes / 60, afterHours: result.after.ownerMinutes / 60,
        hoursDelta: result.delta.ownerMinutes / 60, servedDelta: result.delta.served },
      sources: ["scenario", "vat", "wage"], explanation,
    };
  }).sort((a, b) => Math.abs(b.facts.profitDelta) - Math.abs(a.facts.profitDelta));
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

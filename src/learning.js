import { DATA_VERSION, DISTRICTS, FORMATS } from "./data.js?release=20261006c";
import { SOURCES } from "./sources.js?release=20261006c";

export const QUESTIONS = [
  { text: "게임의 보증금·집기 취득은 월 비용과 어떻게 다를까요?", options: ["현금은 줄지만 전액을 월 영업비용으로 다시 빼지 않는다", "현금과 영업이익을 매달 같은 금액만큼 뺀다", "둘 다 아무 영향이 없다"], answer: 0 },
  { text: "직원 시간을 줄였을 때 함께 확인할 것은?", options: ["급여만 줄었으면 성공", "사장 노동·대기·이탈이 늘었는지도 본다", "매출은 반드시 증가한다"], answer: 1 },
  { text: "게임에서 추가 장비를 사면 월 흑자라도 현금이 줄 수 있나요?", options: ["흑자면 현금 감소는 불가능", "월세가 있어야만 가능", "가능하다. 영업이익과 자산 취득 현금 흐름은 다르다"], answer: 2 },
];

export function classCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new Error("수업 코드는 영문·숫자·_- 3–20자입니다. 개인 이름·연락처를 쓰지 마세요.");
  return code;
}

export function scoreQuiz(answers, confidence) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length || answers.some((answer, i) => !Number.isInteger(answer) || answer < 0 || answer >= QUESTIONS[i].options.length) || !Number.isInteger(confidence) || confidence < 1 || confidence > 5) throw new Error("이해도 답변·자신감을 모두 선택하세요");
  return { answers: [...answers], confidence, score: answers.reduce((sum, answer, i) => sum + Number(answer === QUESTIONS[i].answer), 0) };
}

export function validateLearning(row) {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const finite = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
  if (row?.schema !== 1 || row.version !== DATA_VERSION || !uuid.test(row.runId) || !uuid.test(row.participantId) || typeof row.classCode !== "string" || !["profit", "hours"].includes(row.goal) || !DISTRICTS.some((item) => item.id === row.district) || !FORMATS.some((item) => item.id === row.format) || row.startingCapital !== 15000 || !finite(row.months, 0, 12) || !Number.isInteger(row.months) || typeof row.completed !== "boolean" || (row.completed && row.months !== 12) || !finite(row.updatedAt, 0, 1e15) || !finite(row.ownerHours, 0, 20000) || !finite(row.comparisons, 0, 10000) || !Number.isInteger(row.comparisons) || !Array.isArray(row.sources) || row.sources.length > SOURCES.length + 1 || row.sources.some((id) => !["dictionary", ...SOURCES.map((source) => source.id)].includes(id)) || (row.completed && (!finite(row.netProfit, -1e9, 1e9) || !finite(row.hourlyWon, -1e9, 1e9) || !finite(row.cash, -1e9, 1e9)))) throw new Error("지원하지 않거나 손상된 교육 결과입니다");
  const quiz = (value) => value == null ? null : scoreQuiz(value.answers, value.confidence);
  return { schema: 1, version: row.version, runId: row.runId, participantId: row.participantId, classCode: classCode(row.classCode), goal: row.goal,
    district: row.district, format: row.format, startingCapital: 15000, months: row.months, completed: row.completed, updatedAt: row.updatedAt,
    ownerHours: row.ownerHours, comparisons: row.comparisons, sources: [...new Set(row.sources)], pre: quiz(row.pre), post: quiz(row.post),
    netProfit: row.completed ? row.netProfit : null, hourlyWon: row.completed ? row.hourlyWon : null, cash: row.completed ? row.cash : null,
    units: { startingCapital: "만원", netProfit: "만원", cash: "만원", hourlyWon: "원/시간", ownerHours: "시간" } };
}

export function mergeLearning(existing, incoming) {
  if (!Array.isArray(existing) || !Array.isArray(incoming) || existing.length > 1000 || incoming.length > 1000) throw new Error("한 번에 최대 1,000개 결과만 읽을 수 있습니다");
  const rows = new Map();
  for (const value of [...existing, ...incoming]) {
    const row = validateLearning(value);
    if (!rows.has(row.runId) || row.updatedAt >= rows.get(row.runId).updatedAt) rows.set(row.runId, row);
  }
  if (rows.size > 1000) throw new Error("최대 1,000개 시도까지 비교할 수 있습니다");
  return [...rows.values()];
}

export function learningStats(rows) {
  const participants = new Map();
  for (const row of rows) { const key = `${row.classCode}:${row.participantId}`; const list = participants.get(key) ?? []; list.push(row); participants.set(key, list); }
  const groups = [...participants.values()].map((group) => group.sort((a, b) => a.updatedAt - b.updatedAt));
  const completed = groups.filter((group) => group.some((row) => row.completed));
  const paired = completed.map((group) => group.filter((row) => row.completed && row.pre && row.post).at(-1)).filter(Boolean);
  const average = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const latest = completed.map((group) => group.filter((row) => row.completed).at(-1));
  const improvements = completed.filter((group) => group.filter((row) => row.completed).length >= 2).map((group) => { const done = group.filter((row) => row.completed); return done.at(-1).hourlyWon - done[0].hourlyWon; });
  return { participants: groups.length, runs: rows.length, completions: completed.length, replays: groups.filter((group) => group.length >= 2).length,
    sourceReaders: groups.filter((group) => group.some((row) => row.sources.length)).length, comparisons: rows.reduce((sum, row) => sum + row.comparisons, 0),
    paired: paired.length, quizGain: average(paired.map((row) => row.post.score - row.pre.score)), confidenceGain: average(paired.map((row) => row.post.confidence - row.pre.confidence)),
    hourlyWon: average(latest.map((row) => row.hourlyWon)), replayGain: average(improvements), replayPairs: improvements.length };
}

export function learningCsv(rows) {
  const fields = ["classCode", "participantId", "runId", "version", "goal", "district", "format", "startingCapitalManwon", "months", "completed", "netProfitManwon", "hourlyWon", "cashManwon", "ownerHours", "comparisons", "sourceCount", "preScore", "postScore", "preConfidence", "postConfidence"];
  const escape = (value) => `"${(typeof value === "string" ? value.replace(/^([\s]*[=+@-])/, "'$1") : String(value ?? "")).replaceAll('"', '""')}"`;
  const lines = rows.map(validateLearning).map((row) => ({ ...row, startingCapitalManwon: row.startingCapital, netProfitManwon: row.netProfit, cashManwon: row.cash, sourceCount: row.sources.length, preScore: row.pre?.score, postScore: row.post?.score, preConfidence: row.pre?.confidence, postConfidence: row.post?.confidence }));
  return "\uFEFF" + [fields.map(escape).join(","), ...lines.map((row) => fields.map((field) => escape(row[field])).join(","))].join("\r\n");
}

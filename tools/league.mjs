// 시즌 0 리그 순위 계산 — 게임이 내보낸 결과 JSON을 라운드 조건으로 걸러 '최저임금 초과 이익' 순으로 줄 세운다.
// 사용: node tools/league.mjs docs/league/season0.json results/R1 [results/R2 ...]
//   결과 폴더 이름이 라운드 id(R1, R2…)와 같아야 하고, 파일 이름(확장자 제외)을 참가자 닉네임으로 쓴다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { GAME_CONFIG } from "../src/data.js";
import { classCode, validateLearning } from "../src/learning.js";

// 연 순이익(만원)에서 사장이 일한 시간을 최저임금으로 쳐서 뺀 값(만원). 사장 노동을 공짜로 치지 않는다.
export function excessProfit(row) {
  return row.netProfit - (row.ownerHours * GAME_CONFIG.minimumWage) / 10000;
}

// 라운드 조건: 같은 수업 코드, 12개월 완주, 지정 상권·업태, 사장 노동시간 범위
export function eligible(row, round) {
  if (row.classCode !== classCode(round.code) || !row.completed) return false;
  if (round.district && row.district !== round.district) return false;
  if (round.formats && !round.formats.includes(row.format)) return false;
  if (round.excludeFormats?.includes(row.format)) return false;
  if (round.minOwnerHours != null && row.ownerHours < round.minOwnerHours) return false;
  if (round.maxOwnerHours != null && row.ownerHours > round.maxOwnerHours) return false;
  return true;
}

// 참가자마다 조건을 지킨 완주 기록 중 가장 좋은 1건. 같은 값이면 같은 순위(1, 2, 2, 4…).
export function rankRound(entries, round) {
  const best = new Map();
  const attempts = new Map();
  for (const { name, row } of entries) {
    attempts.set(name, (attempts.get(name) ?? 0) + 1);
    if (!eligible(row, round)) continue;
    const score = excessProfit(row);
    if (!best.has(name) || score > best.get(name).score) best.set(name, { name, row, score });
  }
  const sorted = [...best.values()].sort((a, b) => b.score - a.score);
  let rank = 0;
  return sorted.map((item, index) => {
    if (index === 0 || item.score !== sorted[index - 1].score) rank = index + 1;
    return { ...item, rank, attempts: attempts.get(item.name) };
  });
}

// 누적 포인트: 완주 기록이 순위에 들면 10점 + 순위 점수(1위 10점 … 10위 1점)
export function roundPoints(rank) {
  return 10 + Math.max(0, 11 - rank);
}

function readEntries(dir) {
  const files = statSync(dir).isDirectory() ? readdirSync(dir).filter((file) => file.endsWith(".json")).map((file) => join(dir, file)) : [dir];
  const entries = [];
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    for (const raw of Array.isArray(data) ? data : [data]) {
      try { entries.push({ name: basename(file, ".json"), row: validateLearning(raw) }); }
      catch { console.error(`건너뜀(손상되었거나 다른 버전): ${file}`); }
    }
  }
  return entries;
}

const won = (manwon) => `${Math.round(manwon).toLocaleString("ko-KR")}만`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [configPath, ...dirs] = process.argv.slice(2);
  if (!configPath || !dirs.length) { console.error("사용: node tools/league.mjs <시즌 설정.json> <라운드 결과 폴더...>"); process.exit(1); }
  const season = JSON.parse(readFileSync(configPath, "utf8"));
  const total = new Map();
  for (const dir of dirs) {
    const round = season.rounds.find((item) => item.id === basename(dir));
    if (!round) { console.error(`설정에 없는 라운드 폴더: ${dir}`); process.exit(1); }
    const entries = readEntries(dir);
    const ranked = rankRound(entries, round);
    console.log(`\n## ${round.id} · ${round.title} (참가 ${ranked.length}명)\n`);
    console.log("| 순위 | 닉네임 | 최저임금 초과 이익 | 사장 시급(최저임금 배수) | 사장 노동 | 재도전 |\n|---:|---|---:|---:|---:|---:|");
    for (const item of ranked) {
      console.log(`| ${item.rank} | ${item.name} | ${won(item.score)} | ${Math.round(item.row.hourlyWon).toLocaleString("ko-KR")}원 (${(item.row.hourlyWon / GAME_CONFIG.minimumWage).toFixed(2)}배) | ${Math.round(item.row.ownerHours).toLocaleString("ko-KR")}시간 | ${item.attempts - 1}회 |`);
      total.set(item.name, (total.get(item.name) ?? 0) + roundPoints(item.rank));
    }
    // 조건을 못 지킨 참가자도 조용히 빼지 않고 참고 기록으로 알린다
    const outside = [...new Set(entries.map((entry) => entry.name))].filter((name) => !ranked.some((item) => item.name === name));
    if (outside.length) console.log(`\n조건 밖이라 순위에서 뺀 참가자(참고 기록): ${outside.join(", ")}`);
  }
  console.log("\n## 누적 포인트\n\n| 닉네임 | 포인트 |\n|---|---:|");
  for (const [name, points] of [...total].sort((a, b) => b[1] - a[1])) console.log(`| ${name} | ${points} |`);
  console.log(`\n${season.notice}`);
}

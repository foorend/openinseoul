// 플랫폼 어댑터 — 게임 로직과 배포 플랫폼 사이의 유일한 경계.
//
// 지금은 브라우저 로컬 저장소 위에서 동작하지만, Hive SDK를 붙일 때
// 이 파일의 provider 하나만 교체하면 되도록 인터페이스를 고정해 두었다.
// 게임 코드 어디에서도 localStorage나 Hive를 직접 호출하지 않는다.
//
//   signIn()                    → { playerId, displayName, guest }
//   submitScore(boardId, entry) → { rank, best, board }
//   getLeaderboard(boardId)     → [{ rank, name, score, ... }]
//   unlockAchievement(id)       → { id, newlyUnlocked }
//   logEvent(name, params)      → void
//
// Hive 연동 시 매핑:
//   signIn            → Hive Auth v4 (PlayerID/로그인)
//   submitScore       → Hive Leaderboard
//   unlockAchievement → Hive Achievement
//   logEvent          → Hive Analytics

const STORAGE_KEY = "ois-cafe/v1";

export const ACHIEVEMENTS = [
  { id: "first_open", name: "첫 오픈", description: "첫 영업일을 마감했습니다." },
  { id: "first_black", name: "흑자 전환", description: "하루 영업이익을 0 위로 올렸습니다." },
  { id: "winter_survivor", name: "겨울을 넘기다", description: "1·2월 비수기를 지나 3월에 흑자로 돌아섰습니다." },
  { id: "commute_king", name: "출근길의 왕", description: "얼리버드 영업으로 오전에만 40잔을 팔았습니다." },
  { id: "regular_maker", name: "단골이 생겼다", description: "재방문 의향 손님을 하루 20명 이상 만들었습니다." },
  { id: "clean_freak", name: "머신은 정직하다", description: "하루에 에스프레소 머신을 3번 이상 청소했습니다." },
  { id: "hands_on", name: "사장의 손", description: "하루에 직접 개입을 15회 이상 했습니다." },
  { id: "above_minimum", name: "최저시급을 넘다", description: "연말정산에서 사장 시급이 최저시급을 넘었습니다." },
  { id: "survivor", name: "첫 1년 생존", description: "1월부터 12월까지 완주하고 연말정산까지 마쳤습니다." },
];

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

function writeStore(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* 시크릿 모드 등 저장 불가 환경에서도 게임은 그대로 돌아가야 한다 */
  }
}

function randomId() {
  const bytes = new Uint8Array(8);
  (globalThis.crypto ?? {}).getRandomValues?.(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 로컬 프로바이더 — 네트워크 없이 동작하는 기본 구현.
const localProvider = {
  id: "local",
  label: "로컬 (Hive 미연동)",

  async signIn() {
    const store = readStore();
    if (!store.player) {
      store.player = { playerId: `guest-${randomId()}`, displayName: "게스트 사장", guest: true };
      writeStore(store);
    }
    return store.player;
  },

  async submitScore(boardId, entry) {
    const store = readStore();
    store.boards = store.boards ?? {};
    const board = store.boards[boardId] ?? [];
    board.push({ ...entry, at: entry.at ?? 0 });
    board.sort((a, b) => b.score - a.score);
    store.boards[boardId] = board.slice(0, 50);
    writeStore(store);
    const rank = store.boards[boardId].findIndex((row) => row.at === entry.at && row.score === entry.score) + 1;
    return { rank: rank || null, best: store.boards[boardId][0]?.score ?? entry.score, board: store.boards[boardId] };
  },

  async getLeaderboard(boardId) {
    const store = readStore();
    return (store.boards?.[boardId] ?? []).map((row, index) => ({ rank: index + 1, ...row }));
  },

  async unlockAchievement(id) {
    const store = readStore();
    store.achievements = store.achievements ?? [];
    if (store.achievements.includes(id)) return { id, newlyUnlocked: false };
    store.achievements.push(id);
    writeStore(store);
    return { id, newlyUnlocked: true };
  },

  async getAchievements() {
    return readStore().achievements ?? [];
  },

  logEvent(name, params) {
    const store = readStore();
    store.events = [...(store.events ?? []), { name, params, seq: (store.events?.length ?? 0) + 1 }].slice(-200);
    writeStore(store);
  },
};

// Hive SDK가 페이지에 주입되어 있으면 그쪽을 쓴다. 없으면 로컬로 동작한다.
function detectProvider() {
  const hive = globalThis.hive ?? globalThis.Hive;
  if (!hive?.Auth?.signIn) return localProvider;
  return {
    id: "hive",
    label: "Hive",
    async signIn() {
      const result = await hive.Auth.signIn();
      return { playerId: result.playerId, displayName: result.displayName ?? "사장", guest: !!result.guest };
    },
    async submitScore(boardId, entry) {
      return hive.Leaderboard.submit(boardId, entry.score, entry);
    },
    async getLeaderboard(boardId) {
      return hive.Leaderboard.top(boardId, 10);
    },
    async unlockAchievement(id) {
      await hive.Achievement.unlock(id);
      return { id, newlyUnlocked: true };
    },
    async getAchievements() {
      return hive.Achievement.list?.() ?? [];
    },
    logEvent(name, params) {
      hive.Analytics?.track?.(name, params);
    },
  };
}

const provider = detectProvider();

export const platform = {
  get name() {
    return provider.label;
  },
  get isHive() {
    return provider.id === "hive";
  },
  signIn: (...args) => provider.signIn(...args),
  submitScore: (...args) => provider.submitScore(...args),
  getLeaderboard: (...args) => provider.getLeaderboard(...args),
  unlockAchievement: (...args) => provider.unlockAchievement(...args),
  getAchievements: (...args) => provider.getAchievements(...args),
  logEvent: (...args) => provider.logEvent(...args),
};

// 7일 결산 점수 — 순이익과 사장 시급을 함께 반영한다.
export function campaignScore({ profit, hourlyWon, reputation, served }) {
  const profitPart = Math.round(profit * 10000) / 1000;
  const wagePart = Math.max(0, hourlyWon) / 100;
  return Math.max(0, Math.round(profitPart + wagePart + reputation * 4 + served * 0.4));
}

// 마감마다 달성 조건을 확인한다. 새로 열린 것만 돌려준다.
export async function evaluateAchievements({ report, day, maxDays, final, monthSummary }) {
  const unlocked = [];
  const tryUnlock = async (id, condition) => {
    if (!condition) return;
    const result = await platform.unlockAchievement(id);
    if (result.newlyUnlocked) unlocked.push(ACHIEVEMENTS.find((item) => item.id === id));
  };

  if (report) {
    const m = report.metrics;
    const owner = m.ownerActions ?? {};
    const interventions = (owner.flyers ?? 0) + (owner.drinks ?? 0) + (owner.cleaned ?? 0) + (owner.machineCleans ?? 0) + (owner.restocks ?? 0);
    const morning = (m.hourly ?? []).filter((slot) => slot.hour < 11).reduce((sum, slot) => sum + slot.served, 0);
    await tryUnlock("first_open", day >= 1);
    await tryUnlock("first_black", m.profit > 0);
    await tryUnlock("commute_king", morning >= 40);
    await tryUnlock("regular_maker", m.repeatIntent >= 20);
    await tryUnlock("clean_freak", (owner.machineCleans ?? 0) >= 3);
    await tryUnlock("hands_on", interventions >= 15);
  }
  if (monthSummary) {
    await tryUnlock("winter_survivor", monthSummary.monthNumber === 3 && monthSummary.profit > 0);
  }
  if (final) {
    await tryUnlock("survivor", day >= maxDays);
    await tryUnlock("above_minimum", final.hourlyWon >= final.minimumWage);
  }
  return unlocked.filter(Boolean);
}

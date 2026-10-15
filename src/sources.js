import { DATA_VERSION, DISTRICTS, GAME_CONFIG, LEASE_RULE, PUBLIC_META, SEOUL_AVERAGE, STORE_SCALE } from "./data.js?release=20261015";

const GOLMOK = PUBLIC_META.url;
const Q = PUBLIC_META.quarter;

export const SOURCES = [
  { id: "rent", title: "서울시 상권분석서비스 · 임대시세", period: `${Q} · 기준일 ${PUBLIC_META.referenceDate}`, kind: "계산 적용", unit: PUBLIC_META.units.rent, url: GOLMOK,
    rule: `행정동 1층 값(을지로는 골목 2층이라 1층 외 값) × ${LEASE_RULE.basePyeong}평 = 기준 월세. 보증금 환산분이 포함된 값이라 실제 현금 월세보다 약간 높게 잡힙니다. 보증금은 월세 ${LEASE_RULE.depositMonths}개월치(관행 가정), 권리금·인테리어는 게임 가정입니다.` },
  { id: "sales", title: "서울시 상권분석서비스 · 점포당 매출(커피-음료)", period: Q, kind: "수요 보정 기준", unit: PUBLIC_META.units.sales, url: GOLMOK,
    rule: `기준 매장(스페셜티·12평·18석, 직원 2명)의 연평균 월매출이 행정동 커피-음료 점포당 평균 월매출${STORE_SCALE === 1 ? "과 같아지도록" : `의 ${STORE_SCALE}배가 되도록`} 상권별 수요 계수를 맞췄습니다(tools/calibrate.mjs). 평균에는 대형 프랜차이즈 매장이 섞여 있어 개인 카페의 중앙값보다 높을 수 있습니다.` },
  { id: "store", title: "서울시 상권분석서비스 · 점포 수·개폐업", period: Q, kind: "계산 적용(경쟁도)", unit: "개, %", url: GOLMOK,
    rule: "행정동 커피-음료 점포 수를 5개 상권 안에서 경쟁도 50~90으로 환산합니다. 개업률·폐업률은 화면에 그대로 보여 줍니다." },
  { id: "survival", title: "서울시 상권분석서비스 · 신생기업 생존율·평균 영업기간", period: Q, kind: "현실 비교", unit: "%, 년", url: GOLMOK,
    rule: "게임 결과와 나란히 놓는 비교값이며 계산에는 쓰지 않습니다. 행정동 3년 생존율 표본(개업 점포)이 30곳 미만이면 자치구 값을 대신 보여 줍니다." },
  { id: "population", title: "서울시 상권분석서비스 · 유동·주거·직장 인구", period: Q, kind: "현실 비교", unit: PUBLIC_META.units.population, url: GOLMOK,
    rule: "상권 성격(오피스·주거·대학가)을 읽는 참고값입니다. 시간대별 손님 분포와 손님 구성은 아직 게임 가정입니다." },
  { id: "wage", title: "최저임금위원회 · 연도별 최저임금", period: "2026년", kind: "계산 적용", unit: "원/시간", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do",
    rule: `${GAME_CONFIG.minimumWage.toLocaleString("ko-KR")}원. 직원 기본시급의 하한과 사장 시간당 수익의 비교 기준. 상권별 웃돈(을지로·성수·강남)은 게임 가정입니다.` },
  { id: "income", title: "국세청 · 종합소득세 기본세율", period: "공개표 2023–2025년 귀속", kind: "계산 참고", unit: "과세표준 원 → 게임 만원", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7667&mi=2223",
    rule: "이익×기본세율−누진공제. 이익을 과세표준으로 간주하는 교육용 단순화입니다. 공제·지방소득세·결손금 이월은 미반영." },
  { id: "corp", title: "국세청 · 일반 영리법인 기본세율", period: "2026년 이후", kind: "계산 참고", unit: "과세표준 원 → 게임 만원", url: "https://s.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7746&mi=2372",
    rule: "10/20/22/25%와 누진공제 적용. 소규모법인 별도 세율·공제·대표 급여/배당·지방소득세는 미반영. 실제 사업자 유형 추천이 아닙니다." },
  { id: "vat", title: "국세청 · 부가가치세 개요", period: "2026-10-06 확인", kind: "계산 참고", unit: "부가세 포함 수입 만원", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7695&mi=2272",
    rule: "게임은 일반과세 매출세액만 수입÷11로 매달 적립합니다. 실제 납부액은 매출세액−매입세액 등으로 달라지며, 매입세액·간이과세·신고시기는 미반영." },
  { id: "scenario", title: "FOOREND · 게임 가정", period: DATA_VERSION, kind: "게임 가정", unit: "돈: 만원 · 시간: 게임 분", url: null,
    rule: "시간대별 유동 분포·손님 구성·평일/주말 비중·권리금·인테리어·메뉴 가격과 원가·구매확률·맛/메뉴 적합도·수수료10.8%·보험9.6%·퇴직적립8.3%·소모품5%·대출6.5%는 게임 가정입니다. 하루 평일/주말 표본×달의 일수로 월을 추정합니다. 주휴수당·가산수당·감가상각·보증금 회수·대출 원금 상환·폐업 청산은 미반영." },
];

const won = (value) => `${Math.round(value).toLocaleString("ko-KR")}원`;
const man = (value) => `${Math.round(value / 10000).toLocaleString("ko-KR")}만`;

// 3년 생존율: 행정동 표본(개업 점포)이 30곳 미만이면 자치구 값을 쓴다.
export function survivalFor(district) {
  const { area, guAvg, gu, dongs } = district.public;
  const useDong = area.survival3yBase >= 30;
  const pick = useDong ? area : guAvg;
  return { rate: pick.survival3y, base: pick.survival3yBase, years: pick.operatingYears, where: useDong ? dongs.join("·") : `${gu} 전체(동 표본 ${area.survival3yBase}곳)` };
}

export function publicRows(district) {
  const { area, dongs, rentFloor } = district.public;
  const survival = survivalFor(district);
  return [
    ["임대료", `${rentFloor} 3.3㎡당 ${won(rentFloor === "1층" ? area.rentFirstFloor : area.rentUpperFloor)} → 12평 월세 ${district.lease.monthlyRent}만`],
    ["점포당 월매출", `${man(area.salesPerStoreMonthly)}원 (서울 평균 ${man(SEOUL_AVERAGE.salesPerStoreMonthly)}원)`],
    ["커피-음료 점포", `${area.stores.toLocaleString("ko-KR")}곳 · 프랜차이즈 ${area.franchiseStores}곳 · 개업률 ${area.openRate}% · 폐업률 ${area.closeRate}%`],
    ["3년 생존율", `${survival.rate}% (${survival.where}, 서울 ${SEOUL_AVERAGE.survival3y}%) · 평균 영업 ${survival.years}년`],
    ["인구(1ha당)", `유동 ${area.floatingPerHa.toLocaleString("ko-KR")} · 주거 ${area.residentPerHa} · 직장 ${area.workerPerHa} · ${dongs.join("·")}`],
  ];
}

const tag = `<button class="text-button source-toggle" type="button">출처 보기</button>`;
const base = `서울시 상권분석서비스(커피-음료) ${Q}`;

// 화면 아래 출처 바 한 줄. 지금 화면에 나온 숫자가 어디서 왔는지 짧게 말한다.
export function sourceLine({ view, stepId, district }) {
  if (!district || view === "landing") return `📊 ${base} 행정동 데이터 · 최저임금 2026 · 국세청 세율로 계산합니다 ${tag}`;
  const { area, dongs } = district.public;
  const place = `${district.shortName}=${dongs.join("·")}`;
  if (view === "wizard" && stepId === "district") {
    const survival = survivalFor(district);
    return `📊 ${place} · 1층 3.3㎡당 ${won(area.rentFirstFloor)} · 점포당 월매출 ${man(area.salesPerStoreMonthly)} · 커피 점포 ${area.stores}곳 · 3년 생존 ${survival.rate}% — ${base} ${tag}`;
  }
  if (view === "wizard") return `📊 시급: 2026 최저임금 ${GAME_CONFIG.minimumWage.toLocaleString("ko-KR")}원(최저임금위원회) + 상권 가정 · 월세: ${place} 실측 기반 ${district.lease.monthlyRent}만(12평) — ${base} ${tag}`;
  if (view === "final") {
    const survival = survivalFor(district);
    return `📊 현실 비교: ${survival.where} 커피-음료 3년 생존율 ${survival.rate}% · 평균 영업 ${survival.years}년 · 폐업률 ${area.closeRate}% — ${base} ${tag}`;
  }
  if (["brief", "operations"].includes(view)) return `📊 ${place} 수요는 점포당 실제 월매출 ${man(area.salesPerStoreMonthly)}에 맞춰 보정 · 월세 ${district.lease.monthlyRent}만(12평, 실측 기반) · 손님 행동은 게임 가정 ${tag}`;
  return `📊 월세 ${district.lease.monthlyRent}만(12평, ${base}) · 인건비 2026 최저임금 기준 · 부가세 수입÷11 적립(국세청) · 권리금·원가는 게임 가정 ${tag}`;
}

export function sourceMarkup() {
  return `<h2>공공데이터와 게임 가정</h2><p>버전 ${DATA_VERSION} · ${PUBLIC_META.provider} ${Q}, ${PUBLIC_META.fetchedAt} 수집. 창업·세무·투자 조언이 아닌 의사결정 연습입니다.</p>
    <div class="notebook-table-wrap"><table><thead><tr><th>게임 상권</th><th>행정동</th><th>12평 월세</th><th>점포당 월매출</th><th>점포</th><th>3년 생존</th></tr></thead><tbody>${DISTRICTS.map((district) => {
      const { area, dongs } = district.public;
      return `<tr><td>${district.shortName}</td><td>${dongs.join("·")}</td><td>${district.lease.monthlyRent}만</td><td>${man(area.salesPerStoreMonthly)}</td><td>${area.stores}</td><td>${survivalFor(district).rate}%</td></tr>`;
    }).join("")}</tbody></table></div>
    ${SOURCES.map((source) => `<article class="source-entry"><h3>${source.title}</h3><small>${source.kind} · ${source.period} · ${source.unit}</small><p>${source.rule}</p>${source.url ? `<a href="${source.url}" data-source-id="${source.id}" target="_blank" rel="noopener noreferrer">기관 원문 확인 ↗</a>` : ""}</article>`).join("")}`;
}

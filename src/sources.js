import { DATA_VERSION } from "./data.js?release=20261006d";

export const SOURCES = [
  { id: "wage", title: "최저임금위원회 · 연도별 최저임금", period: "2026년", kind: "계산 적용", unit: "원/시간", url: "https://www.minimumwage.go.kr/minWage/policy/decisionMain.do", rule: "10,320원. 직원 기본시급의 하한과 사장 시간당 수익의 비교 기준. 사장에게 적용되는 법정 급여 판정은 아닙니다." },
  { id: "income", title: "국세청 · 종합소득세 기본세율", period: "공개표 2023–2025년 귀속", kind: "계산 참고", unit: "과세표준 원 → 게임 만원", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7667&mi=2223", rule: "이익×기본세율−누진공제. 이익을 과세표준으로 간주하는 교육용 단순화입니다. 공제·지방소득세·결손금 이월은 미반영." },
  { id: "corp", title: "국세청 · 일반 영리법인 기본세율", period: "2026년 이후", kind: "계산 참고", unit: "과세표준 원 → 게임 만원", url: "https://s.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7746&mi=2372", rule: "10/20/22/25%와 누진공제 적용. 소규모법인 별도 세율·공제·대표 급여/배당·지방소득세는 미반영. 실제 사업자 유형 추천이 아닙니다." },
  { id: "vat", title: "국세청 · 부가가치세 개요", period: "2026-10-06 확인", kind: "계산 참고", unit: "부가세 포함 수입 만원", url: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7695&mi=2272", rule: "게임은 일반과세 매출세액만 수입÷11로 매달 적립합니다. 실제 납부액은 매출세액−매입세액 등으로 달라지며, 매입세액·간이과세·신고시기는 미반영." },
  { id: "seoul", title: "서울시·서울신용보증재단 · 길단위인구(상권)", period: "열람 표본: 2025년 1분기 · 확인 2026-10-06", kind: "공공자료 읽기 예제 · 엔진 미적용", unit: "추정 유동인구 명 · 상권코드/분기", url: "https://data.seoul.go.kr/dataList/OA-15568/S/1/datasetView.do?tab=A", rule: "공공누리 제1유형. 공개 sample API의 삼성중앙역 3120213 행을 보존합니다. 이 상권을 게임의 강남·성수 등 5개 광역 명칭과 동일시하지 않습니다. 2026 공간 단위 변경 안내로 시계열·경계 검증이 먼저 필요합니다." },
  { id: "scenario", title: "FOOREND · 합성 카페 시나리오", period: DATA_VERSION, kind: "게임 가정", unit: "돈: 만원 · 시간: 게임 분", url: null, rule: "임대료·권리금·객단가·추정매출·시간별 수요·계절성·구매확률·맛/메뉴 적합도·수수료10.8%·보험9.6%·퇴직적립8.3%·소모품5%·대출6.5%는 게임 가정입니다. 실제 시세·계약·법정 보험료 산식이 아닙니다. 하루 평일/주말 표본×달의 일수로 월을 추정합니다. 주휴수당·가산수당·감가상각·보증금 회수·대출 원금 상환·폐업 청산은 미반영." },
];

// 공식 sample API 원본의 필요한 열만 보존. 다른 분기/상권을 섞어 평균내지 않는다.
export const SEOUL_SAMPLE = {
  STDR_YYQU_CD: "20251", TRDAR_CD: "3120213", TRDAR_CD_NM: "삼성중앙역",
  TMZON_00_06_FLPOP_CO: 389302, TMZON_06_11_FLPOP_CO: 433029,
  TMZON_11_14_FLPOP_CO: 354603, TMZON_14_17_FLPOP_CO: 351120,
  TMZON_17_21_FLPOP_CO: 369445, TMZON_21_24_FLPOP_CO: 210546,
};

export function readPopulation(row) {
  if (!/^\d{4}[1-4]$/.test(row?.STDR_YYQU_CD) || !/^\d{7}$/.test(row?.TRDAR_CD)) throw new Error("상권코드·분기가 올바르지 않습니다");
  const bands = [[0, 6], [6, 11], [11, 14], [14, 17], [17, 21], [21, 24]].map(([from, to]) => {
    const raw = row[`TMZON_${String(from).padStart(2, "0")}_${String(to).padStart(2, "0")}_FLPOP_CO`];
    const count = Number(raw);
    if (!(typeof raw === "number" || (typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw.trim()))) || !Number.isFinite(count) || count < 0) throw new Error("유동인구 열이 누락되거나 음수입니다");
    return { from, to, count, perHour: count / (to - from) };
  });
  const peak = Math.max(...bands.map((band) => band.perHour));
  return { area: row.TRDAR_CD, quarter: row.STDR_YYQU_CD, bands: bands.map((band) => ({ ...band, index: peak ? band.perHour / peak : 0 })) };
}

export function sourceMarkup() {
  const sample = readPopulation(SEOUL_SAMPLE);
  return `<h2>공식 기준과 게임 가정</h2><p>버전 ${DATA_VERSION} · 확인일 2026-10-06. 창업·세무·투자 조언이 아닌 의사결정 연습입니다.</p>
    ${SOURCES.map((source) => `<article class="source-entry"><h3>${source.title}</h3><small>${source.kind} · ${source.period} · ${source.unit}</small><p>${source.rule}</p>${source.url ? `<a href="${source.url}" data-source-id="${source.id}" target="_blank" rel="noopener noreferrer">기관 원문 확인 ↗</a>` : ""}</article>`).join("")}
    <details><summary>실제 공공자료 한 행 읽어 보기 · 삼성중앙역 / 2025년 1분기</summary><p>각 구간 인구÷구간 길이 → 시간당 평균을 최고값으로 나눈 상대지수. 분기 표본의 시간 분포이며 한 매장의 손님 수나 매출이 아닙니다. 게임 5개 상권의 수요에는 적용하지 않았습니다.</p>
    <div class="notebook-table-wrap"><table><thead><tr><th>시간 구간</th><th>원자료(명)</th><th>상대지수</th></tr></thead><tbody>${sample.bands.map((band) => `<tr><td>${band.from}–${band.to}시</td><td>${band.count.toLocaleString("ko-KR")}</td><td>${band.index.toFixed(3)}</td></tr>`).join("")}</tbody></table></div><p>API 서비스 VwsmTrdarFlpopQq · STDR_YYQU_CD=20251 · TRDAR_CD=3120213. 표본 key는 5행만 제공하며 최신 분기 조회가 아닙니다.</p></details>`;
}

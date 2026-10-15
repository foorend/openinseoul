#!/usr/bin/env python3
"""서울시 상권분석서비스(golmok.seoul.go.kr) 지역분석 공개 데이터 → src/public-data.js

게임 5개 상권을 실제 행정동에 대응시키고, 커피-음료(CS100010) 업종의
점포수·개폐업·생존율·평균영업기간·점포당 매출·인구·임대시세를 받아 JS 모듈로 저장한다.
분기마다 다시 실행하면 갱신된다:  python3 tools/fetch_public_data.py 2026 2
"""
import datetime, http.cookiejar, json, sys, urllib.parse, urllib.request

YEAR, QUARTER = (sys.argv[1], sys.argv[2]) if len(sys.argv) > 2 else ("2026", "2")
BASE = "https://golmok.seoul.go.kr"
INDUSTRY = ("CS100000", "CS100010", "커피-음료")
# 게임 상권 → (자치구, [행정동]). 성수는 법정동 성수동2가를 이루는 두 행정동을 합산한다.
TARGETS = {
    "gangnam": ("강남구", ["역삼1동"]),
    "euljiro": ("중구", ["을지로동"]),
    "seongsu": ("성동구", ["성수2가1동", "성수2가3동"]),
    "sinchon": ("서대문구", ["신촌동"]),
    "gangdong": ("강동구", ["명일1동"]),
}
ENDPOINTS = {  # infoCategory: 경로
    "store": "selectStoreCount", "opening": "selectOpening", "survival": "selectSurvivalRate",
    "operatingPeriod": "selectSurvivalAvg", "sales": "selectSalesStatus",
    "population": "selectPopulation", "rent": "selectRentalPrice",
}

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
opener.open(f"{BASE}/stateArea.do", timeout=30).read()


def fetch(category, signgu):
    params = {"stdrYyCd": YEAR, "stdrSlctQu": "sameQu", "stdrQuCd": QUARTER, "stdrMnCd": f"{YEAR}{int(QUARTER) * 3:02d}",
              "svcIndutyCdL": INDUSTRY[0], "svcIndutyCdM": INDUSTRY[1], "stdrSigngu": signgu,
              "selectInduty": "1", "infoCategory": category, "selectTerm": "quarter"}
    req = urllib.request.Request(f"{BASE}/region/{ENDPOINTS[category]}.json", data=urllib.parse.urlencode(params).encode(),
                                 headers={"X-Requested-With": "XMLHttpRequest", "Referer": f"{BASE}/stateArea.do"})
    for attempt in range(6):  # 서울 전체 응답은 커서 중간에 끊길 때가 있어 재시도한다
        try:
            return json.loads(opener.open(req, timeout=60).read())
        except Exception:
            if attempt == 5:
                raise


num = lambda v: float(v) if v not in (None, "", "-") else None
gu_codes = {row["NM"]: row["CD"] for row in fetch("store", "11") if row["GUBUN"] == "gu"}
raw = {category: {} for category in ENDPOINTS}
for category in ENDPOINTS:
    # 서울 전체 1행 + 대상 자치구(구·동 행)만 받는다. 자치구 단위 요청은 응답이 작다.
    for signgu in ["11"] + sorted({gu_codes[gu] for gu, _ in TARGETS.values()}):
        try:
            rows = fetch(category, signgu)
        except Exception:
            if signgu != "11":
                raise
            print(f"경고: 서울 전체 {category} 응답이 계속 끊겨 서울 평균을 비웁니다", file=sys.stderr)
            continue
        for row in rows:
            if signgu == "11" and row["GUBUN"] != "si":
                continue
            raw[category].setdefault((row["GUBUN"], row["NM"]), row)


def pick(level, name):
    return {category: raw[category].get((level, name), {}) for category in ENDPOINTS}


def summarize(areas):
    """여러 행정동은 개수(분자·분모)를 더해 비율을 다시 계산하고, 금액·인구는 점포수 가중 평균한다."""
    stores = [num(a["store"].get("THIRD_TOT")) or 0 for a in areas]
    total = sum(stores) or 1
    wavg = lambda cat, key: round(sum((num(a[cat].get(key)) or 0) * w for a, w in zip(areas, stores)) / total, 2)
    ratio = lambda cat, top, bottom: round(100 * sum(num(a[cat].get(top)) or 0 for a in areas) / (sum(num(a[cat].get(bottom)) or 0 for a in areas) or 1), 1)
    return {
        "stores": int(sum(stores)),
        "franchiseStores": int(sum(num(a["store"].get("THIRD_FRC")) or 0 for a in areas)),
        "openRate": round(100 * sum(num(a["opening"].get("OPBIZ_STOR_CO_3")) or 0 for a in areas) / total, 1),
        "closeRate": round(100 * sum(num(a["opening"].get("CLSBIZ_STOR_CO_3")) or 0 for a in areas) / total, 1),
        "survival1y": ratio("survival", "THIRD_1Y_MOL", "THIRD_1Y_DEN"),
        "survival3y": ratio("survival", "THIRD_3Y_MOL", "THIRD_3Y_DEN"),
        "survival5y": ratio("survival", "THIRD_5Y_MOL", "THIRD_5Y_DEN"),
        "survival3yBase": int(sum(num(a["survival"].get("THIRD_3Y_DEN")) or 0 for a in areas)),  # 3년 생존율 표본(개업 점포 수)
        "operatingYears": wavg("operatingPeriod", "THIRDAVG"),
        "salesPerStoreMonthly": round(wavg("sales", "AVG_THSMON_SELNG_AMT_3") / 3),  # 원/월 (분기 3개월 합 ÷ 3)
        "floatingPerHa": round(wavg("population", "TOT_FLPOP_CO_3")),
        "residentPerHa": round(wavg("population", "TOT_REPOP_CO_3")),
        "workerPerHa": round(wavg("population", "TOT_WRC_POPLTN_CO_3")),
        "rentFirstFloor": round(sum(num(a["rent"].get("BF3_FST_FLOOR")) or 0 for a in areas) / len(areas)),  # 원/3.3㎡·월(환산)
        "rentUpperFloor": round(sum(num(a["rent"].get("BF3_EX_FLOOR")) or 0 for a in areas) / len(areas)),
    }


districts = {}
for game_id, (gu, dongs) in TARGETS.items():
    districts[game_id] = {"gu": gu, "dongs": dongs, "area": summarize([pick("dong", d) for d in dongs]),
                          "guAvg": summarize([pick("gu", gu)])}
seoul = summarize([pick("si", "서울시 전체")])
missing = [d for _, (gu, dongs) in TARGETS.items() for d in dongs if not raw["store"].get(("dong", d))]
if missing:
    sys.exit(f"행정동을 찾지 못했습니다: {missing}")

meta = {
    "provider": "서울특별시·서울신용보증재단 「서울시 상권분석서비스」 지역분석",
    "url": f"{BASE}/stateArea.do", "industry": INDUSTRY[2], "industryCode": INDUSTRY[1],
    "quarter": f"{YEAR}년 {QUARTER}분기", "referenceDate": f"{YEAR}-{int(QUARTER) * 3:02d}-{[31, 30, 30, 31][int(QUARTER) - 1]}",
    "fetchedAt": datetime.date.today().isoformat(),
    "units": {"rent": "3.3㎡당 월환산임대료(원, 보증금 환산 포함)", "sales": "점포당 월평균 매출(원, 분기 3개월 ÷ 3)",
              "population": "1ha당 명", "rates": "%"},
}
out = "// 자동 생성: tools/fetch_public_data.py — 직접 고치지 말고 스크립트를 다시 실행하세요.\n"
out += f"export const PUBLIC_META = {json.dumps(meta, ensure_ascii=False, indent=2)};\n"
out += f"export const SEOUL_AVERAGE = {json.dumps(seoul, ensure_ascii=False)};\n"
out += f"export const PUBLIC_DISTRICTS = {json.dumps(districts, ensure_ascii=False, indent=2)};\n"
open("src/public-data.js", "w", encoding="utf-8").write(out)
for game_id, d in districts.items():
    a = d["area"]
    print(f"{game_id:9} {'+'.join(d['dongs']):18} 점포 {a['stores']:4} 월매출 {a['salesPerStoreMonthly'] / 1e4:7.0f}만 1층 {a['rentFirstFloor']:7,}원 3년생존 {a['survival3y']}%")

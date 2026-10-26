// 3D 매장 미리보기 소품을 Meshy API(text-to-3D 미리보기 → 색 입히기)로 만들어 assets/models/*.glb 로 저장한다.
// 바닥·벽·카운터 같은 큰 면은 store3d.js가 색상표로 직접 그리고, 여기서는 손이 많이 가는 소품만 만든다.
// 사용: node --env-file=.env tools/meshy.mjs [이름...]   (이름을 빼면 전부, 이미 있는 파일은 건너뛴다. 소품당 약 30크레딧)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const STYLE = "warm matte hand-painted gouache look, soft muted colors, cozy Seoul cafe miniature diorama prop";
export const PROPS = {
  espresso_machine: { prompt: "two-group stainless steel commercial espresso machine with cup warmer tray and two portafilters, simple clean shapes", texture: "brushed stainless steel with black knobs" },
  grinder: { prompt: "commercial coffee grinder with clear bean hopper on top, compact", texture: "matte black and steel body, brown coffee beans in hopper" },
  pos: { prompt: "small cafe POS tablet on a stand with a card reader", texture: "white tablet, light wood stand" },
  pastry_case: { prompt: "glass refrigerated pastry display case with three shelves of cakes and croissants", texture: "clear glass, warm wood base, colorful cakes" },
  deck_oven: { prompt: "two-deck bakery oven with glass doors and a proofing cabinet underneath", texture: "dark steel with warm orange light inside" },
  table_two: { prompt: "small round cafe table with two wooden chairs", texture: "light oak wood, cream tabletop" },
  bar_stool: { prompt: "simple wooden bar stool with round seat and footrest", texture: "walnut wood, black steel footrest" },
  plant: { prompt: "potted fiddle leaf fig plant in a terracotta pot, medium size", texture: "green leaves, terracotta pot" },
  sign: { prompt: "A-frame sidewalk chalkboard sign for a cafe", texture: "black chalkboard with white chalk menu, wood frame" },
  pendant_lamp: { prompt: "industrial pendant lamp with a short cord and a dome shade", texture: "brass dome shade, warm glowing bulb" },
};

const key = process.env.MESHY_API_KEY;
if (!key) { console.error("MESHY_API_KEY가 없습니다. node --env-file=.env tools/meshy.mjs 로 실행하세요."); process.exit(1); }
const api = (path, body) => fetch(`https://api.meshy.ai/openapi/v2/text-to-3d${path}`, {
  method: body ? "POST" : "GET",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: body ? JSON.stringify(body) : undefined,
}).then(async (res) => { if (!res.ok) throw new Error(`${res.status} ${await res.text()}`); return res.json(); });

async function waitFor(id) {
  for (;;) {
    const task = await api(`/${id}`);
    if (task.status === "SUCCEEDED") return task;
    if (["FAILED", "CANCELED", "EXPIRED"].includes(task.status)) throw new Error(`${id} ${task.status} ${task.task_error?.message ?? ""}`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

async function make(name) {
  const out = `assets/models/${name}.glb`;
  if (existsSync(out)) return console.log(`건너뜀(이미 있음): ${out}`);
  const prop = PROPS[name];
  const preview = await api("", { mode: "preview", prompt: `${prop.prompt}, ${STYLE}`, art_style: "realistic", should_remesh: true, topology: "triangle", target_polycount: 6000 });
  await waitFor(preview.result);
  const refine = await api("", { mode: "refine", preview_task_id: preview.result, enable_pbr: false, texture_prompt: `${prop.texture}, ${STYLE}` });
  const task = await waitFor(refine.result);
  const glb = Buffer.from(await (await fetch(task.model_urls.glb)).arrayBuffer());
  writeFileSync(out, glb);
  console.log(`저장: ${out} (${Math.round(glb.length / 1024)}KB)`);
}

mkdirSync("assets/models", { recursive: true });
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PROPS);
const results = await Promise.allSettled(names.map(make));
results.forEach((result, i) => { if (result.status === "rejected") { console.error(`${names[i]} 실패: ${result.reason.message}`); process.exitCode = 1; } });

// 게임 효과음을 ElevenLabs Sound Effects API로 만들어 assets/sfx/*.mp3 로 저장한다.
// 사용: node --env-file=.env tools/sfx.mjs [이름...]   (이름을 빼면 전부, 이미 있는 파일은 건너뛴다)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

// 이름은 main.js SoundManager의 메서드 이름과 같다. 문구는 아트 바이블의 '따뜻한 서울 골목 카페' 톤에 맞춘다.
export const SFX = {
  click: { text: "soft wooden UI button tap, very short, warm and subtle", duration_seconds: 0.5 },
  good: { text: "small cafe cash register bell ding with a light coin clink, bright, short", duration_seconds: 1 },
  bad: { text: "short low muted wooden thunk, gentle negative cue, quiet", duration_seconds: 0.6 },
  bell: { text: "small brass shop door bell jingle as a cafe door opens, short", duration_seconds: 1.5 },
  ambience: { text: "cozy small cafe ambience, soft murmuring customers, espresso machine hiss, cups clinking, no music", duration_seconds: 20, loop: true },
};

const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("ELEVENLABS_API_KEY가 없습니다. node --env-file=.env tools/sfx.mjs 로 실행하세요."); process.exit(1); }
mkdirSync("assets/sfx", { recursive: true });
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SFX);
for (const name of names) {
  const out = `assets/sfx/${name}.mp3`;
  if (existsSync(out)) { console.log(`건너뜀(이미 있음): ${out}`); continue; }
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ ...SFX[name], prompt_influence: 0.5 }),
  });
  if (!res.ok) { console.error(`${name} 실패: ${res.status} ${await res.text()}`); process.exitCode = 1; continue; }
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`저장: ${out}`);
}

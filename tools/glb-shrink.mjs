// GLB 안의 텍스처 이미지를 macOS sips로 줄여 웹용으로 가볍게 만든다(모양 데이터는 그대로).
// 사용: node tools/glb-shrink.mjs 입력.glb [출력.glb] [최대 픽셀=512]
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pad4 = (n) => (n + 3) & ~3;

export function shrinkGlb(input, maxPx = 512) {
  const json = JSON.parse(input.subarray(20, 20 + input.readUInt32LE(12)).toString());
  const binStart = 20 + input.readUInt32LE(12) + 8;
  const bin = input.subarray(binStart, binStart + input.readUInt32LE(binStart - 8));
  const dir = mkdtempSync(join(tmpdir(), "glb-"));
  const replaced = new Map();
  for (const [index, image] of (json.images ?? []).entries()) {
    if (image.bufferView == null) continue;
    const view = json.bufferViews[image.bufferView];
    const src = join(dir, `src${index}.${image.mimeType === "image/png" ? "png" : "jpg"}`), out = join(dir, `${index}.jpg`);
    writeFileSync(src, bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
    execFileSync("sips", ["-Z", String(maxPx), "-s", "format", "jpeg", "-s", "formatOptions", "78", src, "--out", out], { stdio: "ignore" });
    replaced.set(image.bufferView, readFileSync(out));
    image.mimeType = "image/jpeg";
  }
  // 버퍼 뷰를 순서대로 다시 이어 붙이고 오프셋을 새로 매긴다
  const parts = [];
  let offset = 0;
  json.bufferViews.forEach((view, index) => {
    const bytes = replaced.get(index) ?? bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    view.byteOffset = offset;
    view.byteLength = bytes.length;
    parts.push(bytes, Buffer.alloc(pad4(bytes.length) - bytes.length));
    offset += pad4(bytes.length);
  });
  json.buffers[0].byteLength = offset;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(pad4(jsonBytes.length) - jsonBytes.length, 0x20)]);
  const binChunk = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunkHead = (length, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(length, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([header, chunkHead(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHead(binChunk.length, 0x004e4942), binChunk]);
}

if (process.argv[1]?.endsWith("glb-shrink.mjs")) {
  const [input, output = input, maxPx = "512"] = process.argv.slice(2);
  const before = readFileSync(input);
  const after = shrinkGlb(before, Number(maxPx));
  writeFileSync(output, after);
  console.log(`${input}: ${Math.round(before.length / 1024)}KB → ${Math.round(after.length / 1024)}KB`);
}

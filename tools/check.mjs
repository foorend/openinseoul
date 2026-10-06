import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const file of readdirSync("src").filter((name) => name.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", `src/${file}`], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const file of ["index.html", "education.html", "tools/viewport.html"]) {
  for (const match of readFileSync(file, "utf8").matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    const result = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: match[1], encoding: "utf8" });
    if (result.status !== 0) { console.error(`${file}: ${result.stderr}`); process.exit(result.status ?? 1); }
  }
}
console.log("All game modules and inline scripts: syntax PASS");

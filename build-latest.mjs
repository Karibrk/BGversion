import { readdir, mkdir, copyFile, cp } from "node:fs/promises";

const entries = await readdir(".");
const rx = /^DENÍK_CORE_V(\d+(?:\.\d+)*)\.gpt\.html$/u;
const candidates = entries
  .map(name => ({ name, m: name.match(rx) }))
  .filter(x => x.m)
  .map(x => ({ name: x.name, version: x.m[1].split(".").map(Number) }));

if (!candidates.length) throw new Error("Nenalezen žádný DENÍK_CORE_V*.gpt.html");

const cmp = (a, b) => {
  const n = Math.max(a.version.length, b.version.length);
  for (let i = 0; i < n; i++) {
    const d = (a.version[i] ?? 0) - (b.version[i] ?? 0);
    if (d) return d;
  }
  return a.name.localeCompare(b.name);
};

candidates.sort(cmp);
const latest = candidates.at(-1);

await mkdir("dist", { recursive: true });
await copyFile(latest.name, "dist/index.html");

for (const dir of ["denik-media"]) {
  try { await cp(dir, `dist/${dir}`, { recursive: true }); } catch {}
}

console.log(`Bernov & Dragons: publikuji ${latest.name} jako /`);

import { mkdir, rm, copyFile } from "node:fs/promises";
import { cp } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const f of ["index.html","app.js","styles.css"]) await copyFile(f, `dist/${f}`);
await cp("assets", "dist/assets", { recursive: true });
console.log("Build selesai: dist siap dipublish.");

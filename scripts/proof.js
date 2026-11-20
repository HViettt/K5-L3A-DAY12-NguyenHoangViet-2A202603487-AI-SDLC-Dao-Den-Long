// Chạy test và lưu output THẬT vào docs/proof/<phase>/ (không sửa tay).
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";

const phase = process.argv[2] ?? "phase-1";
const dir = `docs/proof/${phase}`;
mkdirSync(dir, { recursive: true });
const run = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", stdio: "pipe" }); }
  catch (e) { return (e.stdout ?? "") + (e.stderr ?? "") + `\nEXIT ${e.status}`; }
};
const commit = run("git rev-parse --short HEAD").trim();
const header = `# commit ${commit} | ${new Date().toISOString()} | node ${process.version} | ${os.platform()} | ${os.cpus()[0]?.model}\n`;
writeFileSync(`${dir}/test-report.txt`, header + run("npm test --silent"));
console.log(`Saved proof to ${dir}`);

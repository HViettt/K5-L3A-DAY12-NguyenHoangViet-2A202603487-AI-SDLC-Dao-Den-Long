// Quản lý bảng xếp hạng cục bộ trên đĩa (Ticket-04 mục 3).
// Lưu top 10 tại data/leaderboard.json; hỗ trợ xuất --export-leaderboard.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
export const DEFAULT_LB_PATH = path.join(root, "data", "leaderboard.json");

// Cho phép 3-12 ký tự [A-Za-z0-9_] hoặc chữ cái tiếng Việt có dấu (không khoảng trắng)
export const NAME_RE = /^[\p{L}0-9_]{3,12}$/u;

export function isoLocalNow() {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  const hh = pad(Math.floor(Math.abs(off) / 60));
  const mm = pad(Math.abs(off) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hh}:${mm}`;
}

export function loadLeaderboard(filePath = DEFAULT_LB_PATH) {
  if (!existsSync(filePath)) return { entries: [] };
  try {
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    return { entries: Array.isArray(data.entries) ? data.entries : [] };
  } catch {
    return { entries: [] };
  }
}

export function sortTop10(entries) {
  return entries
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.achieved_at).localeCompare(String(b.achieved_at));
    })
    .slice(0, 10);
}

export function addLeaderboardEntry(entry, filePath = DEFAULT_LB_PATH) {
  const name = String(entry?.name ?? "").trim();
  if (!NAME_RE.test(name)) {
    throw new Error("Tên phải dài 3–12 ký tự (chữ cái, số hoặc _, không khoảng trắng)");
  }
  const score = Number(entry?.score);
  const nights_won = Number(entry?.nights_won ?? 0);
  const seed = Number(entry?.seed ?? 1);
  if (!Number.isFinite(score) || score < 0) throw new Error("score không hợp lệ");
  if (!Number.isInteger(nights_won) || nights_won < 0 || nights_won > 3) {
    throw new Error("nights_won phải là số nguyên 0..3");
  }
  const record = {
    name,
    score: Math.floor(score),
    nights_won,
    achieved_at: entry.achieved_at || isoLocalNow(),
    seed: Number.isInteger(seed) ? seed : 1,
  };
  const data = loadLeaderboard(filePath);
  data.entries = sortTop10([...data.entries, record]);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return data;
}

export function exportLeaderboard(outPath, filePath = DEFAULT_LB_PATH) {
  const data = loadLeaderboard(filePath);
  data.entries = sortTop10(data.entries);
  mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  return data;
}

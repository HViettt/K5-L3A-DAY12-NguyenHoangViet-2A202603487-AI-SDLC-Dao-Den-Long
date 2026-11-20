// Claude Code Stop hook: không cho agent kết thúc khi `npm test` đỏ (exit 2 = chặn, gửi lỗi lại cho agent).
import { execSync } from "node:child_process";

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let payload = {};
  try { payload = JSON.parse(input || "{}"); } catch {}
  try {
    execSync("npm test --silent", { stdio: "pipe", encoding: "utf8" });
    process.exit(0);
  } catch (e) {
    const out = ((e.stdout ?? "") + (e.stderr ?? "")).split("\n").filter((l) => /✖|fail|Error|expected|actual/i.test(l)).slice(0, 30).join("\n");
    if (payload.stop_hook_active) {
      // Đã bị chặn 1 lần mà vẫn đỏ: cho dừng để người xem, tránh vòng lặp đốt token.
      console.error("Stop hook: test vẫn đỏ sau lần sửa – dừng để người dùng xem.\n" + out);
      process.exit(0);
    }
    console.error("npm test đang ĐỎ – chưa được kết thúc. Sửa code (không sửa test cho đạt) rồi chạy lại:\n" + out);
    process.exit(2);
  }
});

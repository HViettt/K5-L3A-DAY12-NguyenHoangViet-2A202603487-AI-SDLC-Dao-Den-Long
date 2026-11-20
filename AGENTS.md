# AGENTS.md — Đảo Đèn Lồng (Phase 4 · Contract v1.3 · v1.0.0)

Game 3D góc nhìn thứ ba (Three.js 0.170.0 offline, 3 Đêm: Đảo Bến · Đảo Cau · Đảo Chuông) + chế độ headless, benchmark và soak test theo Test Contract v1.3.

## Lệnh
- Test toàn bộ (unit + scenario + regression Phase 1–3 + Phase 4 v1.3): `npm test`
- Headless: `node src/headless/cli.js --seed <int> --night <1|2|3> [--scenario <f>] [--inputs <f>] --ticks <int> --out <f.jsonl>`
- Benchmark 1280×720: `node scripts/bench.js --seed 42 --duration 30 --out bench.json`
- Soak test 10 Đêm: `node src/headless/soak.js --seed 7 --nights 10 --out soak.json`
- Chạy game: `npm start` (hoặc `node scripts/serve.js`) → http://localhost:8080
- Xuất bảng xếp hạng: `node scripts/serve.js --export-leaderboard out.json`
- Lưu bằng chứng thật: `npm run proof -- phase-4`

## Kiến trúc (bắt buộc)
- `src/core/`: logic game THUẦN (không import `three`, không DOM, không `node:fs` để chạy được cả trên trình duyệt lẫn Node; đọc `game.contract.json` bằng `import ... with { type: "json" }`). Mọi ngẫu nhiên đi qua `src/core/rng.js`.
- `src/core/maps.js`: định nghĩa 3 bản đồ chuẩn (`240/270/300 s`), `getGroundY`, `resolveObstacles`.
- `src/core/world.js`: tuân thủ thứ tự 12 bước/tick (bổ sung trừ dầu `fuel60` nguyên `1/60` ở bước 2 + tắt đèn `lantern_out`), 6 trạng thái Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`), luật thắng `dawn_survived` (bỏ `all_lit`).
- `src/web/`: chỉ hiển thị (đúng bảng màu hex chuẩn + chế độ mù màu), input (`mx=A-D, mz=W-S` do camera nhìn `+Z`), HUD, Web Audio (`audio.js`). Không chứa luật chơi.
- `src/headless/cli.js`: validate input/scenario (sai định dạng → exit 2 + stderr; thiếu tham số → exit 1), chạy 21.600 tick ≤ 30 s.
- Không thêm dependency npm khi chưa hỏi.

## Quy ước
- Nguồn yêu cầu duy nhất: `docs/spec/` (`prd-0.md`, `ticket-02.md`, ...). Không bịa yêu cầu; chỗ mơ hồ ghi vào `docs/notes/phase-N.md`.
- Không hard-code số tuning ngoài `game.contract.json`.
- Khi ticket mới thay đổi luật cũ: sửa/bỏ test cũ kèm lý do rõ ràng trong `docs/notes/phase-N.md`, không tắt âm thầm.
- Không viết test luôn đạt, không sửa tay output trong `docs/proof/`.
- Commit nhỏ, thông điệp dạng `feat|fix|test|docs|chore: ...`. Chưa xong khi `npm test` còn đỏ.

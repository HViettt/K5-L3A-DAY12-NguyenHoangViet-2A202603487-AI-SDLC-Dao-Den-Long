# AGENTS.md — Đảo Đèn Lồng (Phase 2 · Contract v1.1)

Game 3D góc nhìn thứ ba (Three.js, 3 Đêm: Đảo Bến · Đảo Cau · Đảo Chuông) + chế độ headless (Node) theo Test Contract v1.1.

## Lệnh
- Test toàn bộ (unit + scenario + regression Phase 1 + benchmark 21.600 tick): `npm test`
- Headless: `node src/headless/cli.js --seed <int> --night <1|2|3> [--scenario <f>] [--inputs <f>] --ticks <int> --out <f.jsonl>`
- Chạy game: `npm start` rồi mở http://localhost:8080
- Lưu bằng chứng thật: `npm run proof -- phase-2`

## Kiến trúc (bắt buộc)
- `src/core/`: logic game THUẦN (không import `three`, không DOM, không `node:fs` để chạy được cả trên trình duyệt lẫn Node; đọc `game.contract.json` bằng `import ... with { type: "json" }`). Mọi ngẫu nhiên đi qua `src/core/rng.js`.
- `src/core/maps.js`: định nghĩa 3 bản đồ chuẩn, `getGroundY`, `resolveObstacles`.
- `src/core/world.js`: tuân thủ chính xác **thứ tự 12 bước/tick** của Ticket-02 và 5 trạng thái Bóng Mực (`spawning`, `wander`, `chase`, `recoil`, `stunned`).
- `src/web/`: chỉ hiển thị (đúng bảng màu hex chuẩn), input, HUD, Web Audio (`audio.js`). Không chứa luật chơi.
- `src/headless/cli.js`: validate input/scenario (sai định dạng → exit 2 + stderr; thiếu tham số → exit 1), chạy 21.600 tick ≤ 30 s.
- Không thêm dependency npm khi chưa hỏi.

## Quy ước
- Nguồn yêu cầu duy nhất: `docs/spec/` (`prd-0.md`, `ticket-02.md`, ...). Không bịa yêu cầu; chỗ mơ hồ ghi vào `docs/notes/phase-N.md`.
- Không hard-code số tuning ngoài `game.contract.json`.
- Khi ticket mới thay đổi luật cũ: sửa/bỏ test cũ kèm lý do rõ ràng trong `docs/notes/phase-N.md`, không tắt âm thầm.
- Không viết test luôn đạt, không sửa tay output trong `docs/proof/`.
- Commit nhỏ, thông điệp dạng `feat|fix|test|docs|chore: ...`. Chưa xong khi `npm test` còn đỏ.

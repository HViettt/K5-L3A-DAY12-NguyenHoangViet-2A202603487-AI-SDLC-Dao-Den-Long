# Nhật ký dùng AI

| Thời điểm | Phase | Công cụ / model | Việc giao | Kết quả | Token ước tính | Ghi chú (AI sai? sửa harness?) |
|---|---|---|---|---|---|---|
| CP0 | 0 | Antigravity (Claude) | Phân tích đề, dựng skeleton repo, harness, CI | OK | ~40k | |
| Phase 1 | 1 | Claude Code + GLM (z.ai) | Core + Headless v1.0 + 30 tests | OK (sau hạn tag phase-1) | ~80k | Đoán nhầm mốc giờ lab → tag phase-1 chỉ có khung; không gắn lại tag theo quy định |
| Phase 2 | 2 | Claude Code + GLM (z.ai) | Core + 3 Maps + Headless v1.1 + 12 scenarios | Một phần (chậm đọc ~20p, còn 23 test đỏ) | ~120k | GLM viết `canStand` chặn bước ra khỏi đảo, bật gió Đêm 3 từ tick 1, quên truyền `--inputs` trong test scenario |
| Phase 2 | 2 | Antigravity (Reviewer/Fixer) | Song song Web 3D + HUD + Audio + cập nhật Harness; fix toàn bộ bug core/test → 64/64 pass | OK | ~60k | Đổi `config.js` bỏ `node:fs` sang `import ... with { type: "json" }` để chạy được cả trình duyệt; cập nhật `AGENTS.md` |
| Phase 3 | 3 | Antigravity | Core v1.2 (`fuel60`, `drain`, `dawn_survived`, `capacity`), ADR-001, Changelog, cập nhật test cũ + `phase3.test.js` (69/69 pass) | OK | ~35k | Hoàn thành trong 7 phút, 0 test skip |
| Phase 3 | 3 | Claude Code + GLM (z.ai) | Song song `src/web/`: sửa phím ngược W/S/A/D, thanh dầu 3D + nhấp nháy 1 Hz, HUD capacity 20 ô, chế độ mù màu | OK | ~20k | Chia prompt nhỏ + không `/clear` → xong trong 6 phút, sạch diff |

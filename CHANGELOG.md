# Changelog

## [v1.0.0 / Phase 4 — Contract v1.3] (2026-11-20)
- **Chế độ Benchmark (`bench_cmd`):** `node scripts/bench.js --seed 42 --duration 30 --out bench.json` (1280×720, tắt vsync, 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 fuel 100, camera quỹ đạo `r=30, Y=15`, 3 s khởi động + 30 s đo).
- **Soak test (`soak_cmd`):** `node src/headless/soak.js --seed 7 --nights 10 --out soak.json` (10 Đêm liên tiếp xoay vòng 1→2→3, `crashes: 0`, RSS ổn định `≤ 1.2×`).
- **Bảng xếp hạng cục bộ:** lưu Top 10 tại `data/leaderboard.json` qua `GET/POST /api/leaderboard`, hỗ trợ tên `3–12` ký tự (gồm tiếng Việt có dấu), xuất bằng `node scripts/serve.js --export-leaderboard out.json`.
- **Dễ tiếp cận (Accessibility):** đổi 9 phím (báo trùng phím + khôi phục mặc định), phụ đề & mũi tên chỉ Bóng Mực mới, giảm chuyển động, cỡ chữ UI `≥ 18 px` + tùy chọn chữ lớn `×1.25`.
- **Đóng gói offline & sửa lỗi:** đóng gói cục bộ `src/web/vendor/three.module.js` (Three.js 0.170.0), sửa spawn Đêm 3 Đảo Chuông sang `(0, 0, -20)` thoát khỏi trụ tầng 2.
- **Sáng tạo của tôi:** "Lời Thì Thầm Ngọn Đèn" (câu thoại cổ tích ngắn hiện 3 s khi thắp đèn trên Web, tự tắt khi headless/bench).
- **Tài liệu & Retro:** hoàn thiện `README.md`, `CREDITS.md`, `docs/notes/retro.md`, `docs/notes/phase-4.md`, commit `bench.json` và `soak.json`.

## [Phase 3 — Contract v1.2] (2026-11-20) — BREAKING CHANGES
### Thay đổi phá vỡ tương thích (Breaking Changes)
- **Luật thắng [THAY THẾ]:** Bỏ thắng sớm `all_lit` và bỏ thưởng thời gian. Chỉ thắng khi sống sót tới bình minh (`reason: "dawn_survived"`) với số đèn đang sáng `≥ ceil(0.6 × tổng đèn)` (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7).
- **Thời lượng Đêm [THAY THẾ]:** Đổi từ `300 / 330 / 360 s` sang `240 / 270 / 300 s`.
- **Nhiên liệu đèn [THAY THẾ]:** Đèn đang sáng hao `1.0 fuel/s` (tính theo đơn vị nguyên `1/60`), cạn dầu sẽ tắt (`lantern_out`, `ever_lit: true`), thắp lại chỉ cần `5` đom đóm (`relight: true`); đèn sáng chưa đầy nhận châm dầu (`refuel`, `10 fuel/mote`).
- **Vùng an toàn & Bóng Mực [THAY THẾ]:** Đèn có `fuel < 30` mất vùng an toàn; Bóng Mực `wander` tìm đèn yếu và chuyển trạng thái mới `drain` hút `5 fuel/s` (phát `fuel_drain` mỗi 60 tick). Hết choáng luôn về `wander`.
- **Công thức điểm [THAY THẾ]:** `+5`/đom đóm nạp, `+100` thắp lần đầu, `+40` thắp lại, `+5` pulse thường / `+15` pulse Bóng Mực đang `drain`, thưởng bình minh `+50 + floor(fuel)` mỗi đèn sáng + `+50` mỗi Ngọn Lửa.
- **Test Contract v1.2:** Nâng `contract_version: "1.2"`, thêm 8 khóa `tuning`, thêm `fuel/ever_lit/relit_count` (đèn) và `capacity` (player) trong snapshot, thêm event `refuel`, `lantern_out`, `fuel_drain`, thêm `relight` vào `lantern_lit`.

### Tính năng mới & Sửa lỗi
- Sức chứa đom đóm tăng dần `10 + 2 × successful_lights` (tối đa `20`).
- Chế độ "Bảng màu dễ phân biệt" (mù màu) lưu trong `localStorage`.
- Sửa lỗi phím di chuyển `W/S/A/D` bị ngược hướng trên bản Web 3D.

## [Phase 2 — Contract v1.1] (2026-11-20)
- Chuẩn hóa số liệu Phần 1, mở rộng 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông), Lướt, Gió Lạc, Bùa Gió, Tạm dừng, Web 3D + HUD + Web Audio, 64/64 tests pass.

## [Phase 1 — Contract v1.0] (2026-11-20)
- Khung dự án, harness AI, `game.contract.json` v1.0, core + headless v1.0.

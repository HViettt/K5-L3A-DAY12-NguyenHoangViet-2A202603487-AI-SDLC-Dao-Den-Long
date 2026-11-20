# TICKET-04 — "Bình minh: phát hành v1.0.0" (Phase 4) — bản tóm tắt chuẩn từ đề

Loại: Non-functional + Release · Ưu tiên: Cao · Tag nộp: `phase-4` + GitHub Release `v1.0.0` · Contract: `v1.3`

## 1. Chế độ benchmark (bắt buộc)
- Lệnh: `<bench_cmd> --seed 42 --duration 30 --out bench.json`
- Cảnh benchmark chuẩn: cửa sổ `1280×720` (không fullscreen, tắt vsync nếu được); Đêm 1 đủ hiệu ứng/ánh sáng; đúng `200` Bóng Mực `wander` (seed 42) + `100` đom đóm; `L1–L3` sáng `fuel 100`; tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm; Mây đứng `(0,0,0)`; camera bay tròn `r=30, Y=15` nhìn `(0,0,0)` xuất phát `(30,15,0)` ngược chiều kim đồng hồ `15 s/vòng`.
- `3 s` khởi động (không đo), sau đó đo đúng `--duration` giây rồi thoát mã `0`.
- Output `bench.json`: `contract_version: "1.3"`, `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb` (`null` nếu web không đo được + giải thích), `vsync_off`, `renderer`, `os`.
- Ngưỡng máy chấm: `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000`.

## 2. Soak test (bắt buộc)
- Lệnh: `<soak_cmd> --seed 7 --nights 10 --out soak.json`
- Chạy headless `10` Đêm liên tiếp trong cùng tiến trình (`1→2→3` xoay vòng), Đêm `i` dùng `seed + i`. Input ngẫu nhiên theo seed: mỗi 30 tick chọn hướng; mỗi tick 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
- `mem_start_mb`: RSS sau Đêm 1; `mem_end_mb`: RSS sau reset Đêm cuối.
- Ngưỡng: `crashes = 0`, `mem_end_mb ≤ 1.2 × mem_start_mb`.

## 3. Bảng xếp hạng cục bộ
- Nhập tên sau Bình Minh hoặc sau khi thua bất kỳ Đêm nào (`3–12` ký tự `[A-Za-z0-9_]` / hỗ trợ tiếng Việt có dấu).
- Mỗi mục: `name`, `score`, `nights_won` (`0–3`), `achieved_at` (ISO 8601 có múi giờ), `seed`.
- Giữ Top 10 (score giảm dần, bằng điểm ai đạt trước đứng trên), lưu trên đĩa cục bộ.
- Màn hình Bảng xếp hạng từ menu chính.
- Lệnh xuất: `<run_cmd> --export-leaderboard out.json` → `{"entries": [...]}`.

## 4. Dễ tiếp cận (Accessibility)
- Đổi phím mọi hành động (4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng), báo trùng phím, "Khôi phục mặc định", lưu cục bộ.
- Phụ đề / chỉ báo hình ảnh: Bóng Mực xuất hiện (kèm mũi tên mép màn hình), gió sắp thổi, 10 s cuối, đèn `fuel < 30`.
- Giảm chuyển động: tắt rung camera và hiệu ứng chớp màn hình.
- Cỡ chữ UI tối thiểu `18 px` ở `1280×720`; tùy chọn chữ lớn (`×1.25`).

## 5. Đóng gói, Contract v1.3, Retro & Video demo
- Clone sạch → tối đa 3 lệnh → chơi được. `README.md`, `CHANGELOG.md` (4 phase), `CREDITS.md`, `LICENSE`.
- `game.contract.json` v1.3 thêm `bench_cmd`, `soak_cmd`.
- Commit `bench.json` và `soak.json` tự chạy vào repo.
- Retro 1–2 trang, Video demo `.mp4` `< 5` phút, Tag `phase-4` + Release `v1.0.0`.

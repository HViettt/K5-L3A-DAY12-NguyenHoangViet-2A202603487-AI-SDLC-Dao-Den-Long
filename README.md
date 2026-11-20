# Đảo Đèn Lồng — v1.0.0 (K5-L3A-DAY12 · Nguyễn Hoàng Việt · 2A202603487)

> 🎬 **Video demo (< 5 phút):** [Tải / xem `demo.mp4` tại Release v1.0.0](https://github.com/HViettt/K5-L3A-DAY12-NguyenHoangViet-2A202603487-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0)

Game 3D góc nhìn thứ ba qua **3 Đêm** (Đảo Bến · Đảo Cau · Đảo Chuông): điều khiển **Mây** gom đom đóm, thắp sáng và giữ lửa cho các Đèn Lồng Lớn tới bình minh, né tránh Bóng Mực và Gió Lạc.

## Yêu cầu hệ thống
- **Node.js ≥ 20** (không cần `npm install` dependency ngoài; Three.js `0.170.0` đã đóng gói offline tại `src/web/vendor/three.module.js`).
- Trình duyệt hiện đại có WebGL2 (Chrome / Edge / Safari / Firefox). Chạy tốt trên **macOS, Linux và Windows**.

## Cài đặt & chạy (tối đa 3 lệnh)
```bash
git clone https://github.com/HViettt/K5-L3A-DAY12-NguyenHoangViet-2A202603487-AI-SDLC-Dao-Den-Long.git
cd K5-L3A-DAY12-NguyenHoangViet-2A202603487-AI-SDLC-Dao-Den-Long
npm start            # mở http://localhost:8080
```

## Điều khiển (có thể đổi mọi phím trong ⚙ Cài đặt)
- `W A S D`: di chuyển theo hướng camera · **Kéo chuột trái** / `Q`: xoay camera
- `Space`: nhảy · `Shift` / **Chuột phải**: Lướt (Dash)
- `E`: nạp đom đóm / thắp lại / châm dầu cho đèn gần nhất
- `F`: Tỏa Sáng (tốn 3 đom đóm, đẩy lùi và làm choáng Bóng Mực)
- `Esc` / `P`: tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu)
- **Dễ tiếp cận:** đổi 9 phím (báo trùng phím + khôi phục mặc định), chế độ mù màu, giảm chuyển động, phụ đề + mũi tên chỉ hướng, cỡ chữ `≥ 18 px` + chế độ chữ lớn `×1.25`.

## Cách tính điểm (Contract v1.2 / v1.3)
- `+5` mỗi đom đóm nạp vào đèn (thắp mới, thắp lại hoặc châm dầu).
- `+100` thắp đèn lần đầu (cần 10 đom đóm) · `+40` thắp lại đèn đã từng sáng (chỉ cần 5 đom đóm).
- `+5` mỗi Bóng Mực trúng Tỏa Sáng · `+15` nếu ngay trước đó nó đang hút dầu (`drain`).
- **Thưởng bình minh** (chỉ khi sống sót với `≥ ceil(60%)` đèn sáng: Đêm 1 `3/5`, Đêm 2 `4/6`, Đêm 3 `5/7`): `+50 + floor(fuel)` mỗi đèn đang sáng + `+50` mỗi Ngọn Lửa còn lại.
- Lưu Top 10 bảng xếp hạng cục bộ tại `data/leaderboard.json`.

## Test, Headless, Benchmark, Soak & Bảng xếp hạng (Contract v1.3)
```bash
# 1. Toàn bộ unit test, scenario v1.0–v1.3 và regression
npm test

# 2. Chế độ headless (60 tick/s, tất định)
node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl

# 3. Benchmark 1280×720 (tắt vsync qua cờ Chrome/Chromium --disable-frame-rate-limit --disable-gpu-vsync)
node scripts/bench.js --seed 42 --duration 30 --out bench.json

# 4. Soak test 10 Đêm liên tiếp (kiểm tra ổn định & rò rỉ bộ nhớ)
node src/headless/soak.js --seed 7 --nights 10 --out soak.json

# 5. Xuất bảng xếp hạng cục bộ
node scripts/serve.js --export-leaderboard out.json
```
> **Ghi chú `bench.json`:** Do game chạy trên nền Web (Three.js / WebGL2), trình duyệt không cung cấp API đo chính xác tổng RSS của tiến trình GPU/renderer nên `peak_mem_mb` được ghi là `null` đúng quy định Test Contract v1.3.

## Sáng tạo của tôi
- **"Lời Thì Thầm Ngọn Đèn":** Khi thắp sáng từng Đèn Lồng Lớn trên bản Web, một câu chuyện ngắn mang không khí cổ tích (5 câu luân phiên) hiện nhẹ ở góc trên trong 3 giây để tăng cảm giác ấm áp và gắn kết với thế giới Đảo Đèn Lồng.
- **Tách biệt hoàn toàn khỏi lõi:** chỉ nằm trong lớp hiển thị `src/web/main.js`, tự động tắt khi chạy `?bench=1` và không tồn tại trong `src/core/` hay `src/headless/` — đảm bảo không làm thay đổi bất kỳ byte nào của đầu ra headless hay số đo benchmark (xác nhận bởi `73/73` test pass trong `docs/proof/phase-4/test-report.txt`).

## Tài liệu, Bằng chứng & Harness AI
- Spec: `docs/spec/` · ADR: `docs/notes/adr-001-phase3-fuel-and-win.md` · Retro: `docs/notes/retro.md` · Nhật ký AI: `docs/notes/ai-log.md`
- Bằng chứng: `docs/proof/`, `bench.json`, `soak.json`
- Harness AI: `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/verify/SKILL.md`, `.githooks/pre-commit`, `.github/workflows/ci.yml`
- Bản quyền & nguồn: `CREDITS.md`, `LICENSE`, `CHANGELOG.md`

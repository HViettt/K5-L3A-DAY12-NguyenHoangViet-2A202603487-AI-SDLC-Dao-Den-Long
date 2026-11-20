# Đảo Đèn Lồng – K5-L3A-DAY12 – Nguyễn Hoàng Việt (2A202603487)

> 🎬 Video demo: _(cập nhật ở Phase 4)_

Game 3D góc nhìn thứ ba qua **3 Đêm** (Đảo Bến · Đảo Cau · Đảo Chuông): Mây – người giữ đèn nhỏ tuổi – gom đom đóm thắp các Đèn Lồng Lớn, né Bóng Mực và Gió Lạc, dùng Lướt, Tỏa Sáng và Bùa Gió trước bình minh.

## Cài đặt & chạy (Node ≥ 20, tối đa 3 lệnh, không cần build)
```bash
git clone https://github.com/HViettt/K5-L3A-DAY12-NguyenHoangViet-2A202603487-AI-SDLC-Dao-Den-Long.git
cd K5-L3A-DAY12-NguyenHoangViet-2A202603487-AI-SDLC-Dao-Den-Long
npm start            # mở http://localhost:8080
```

## Điều khiển
- `W A S D`: di chuyển theo hướng camera
- `Kéo chuột` / `Q`: xoay camera (độ nhạy chỉnh trong Cài đặt)
- `Space`: nhảy · `Shift` / `Chuột phải`: Lướt (Dash)
- `E`: nạp đom đóm vào Đèn Lồng gần nhất · `F`: Tỏa Sáng (tốn 3 đom đóm)
- `Esc` / `P`: tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu)

## Cách tính điểm (chuẩn Contract v1.2 — Phase 3)
- `+5` mỗi đom đóm nạp vào đèn (thắp mới, thắp lại hoặc châm dầu)
- `+100` thắp đèn lần đầu · `+40` thắp lại đèn đã từng sáng (chỉ cần 5 đom đóm)
- `+5` mỗi Bóng Mực trúng Tỏa Sáng · `+15` nếu ngay trước đó nó đang hút dầu (`drain`)
- Thưởng bình minh (chỉ khi sống sót với `≥ ceil(60%)` đèn sáng): `+50 + floor(fuel)` mỗi đèn đang sáng + `+50` mỗi Ngọn Lửa còn lại (bỏ thưởng thời gian).
- Tổng điểm game là tổng điểm các Đêm đã thắng.

## Test & chế độ Headless (Contract v1.2)
```bash
npm test
node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl
npm run proof -- phase-3
```
Hỗ trợ `--night 1`, `2`, `3`, `--scenario <file>`, `--inputs <file>`, `--snapshot-every <n>`.

## Tài liệu & Harness AI
- Spec: `docs/spec/` · Giả định, AC & đánh giá: `docs/notes/` · Bằng chứng: `docs/proof/`
- Harness: `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json` (Stop hook), `.claude/skills/verify/SKILL.md`, `.githooks/pre-commit`, `.github/workflows/ci.yml`

## Sáng tạo của tôi
_(Ưu tiên hoàn thiện lõi chuẩn 3 Đêm ở Phase 2; phần sáng tạo bổ sung sẽ cập nhật sau khi ổn định.)_

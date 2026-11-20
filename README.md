# Đảo Đèn Lồng – K5-L3A-DAY12 – Nguyễn Hoàng Việt (2A202603487)

> 🎬 Video demo: _(cập nhật ở Phase 4)_

Game 3D góc nhìn thứ ba: Mây – người giữ đèn nhỏ tuổi – gom đom đóm để thắp lại các Đèn Lồng Lớn, né Bóng Mực trong sương đen.

## Cài đặt & chạy (Node ≥ 20, không cần npm install)
```bash
git clone https://github.com/HViettt/K5-L3A-DAY12-NguyenHoangViet-2A202603487-AI-SDLC-Dao-Den-Long.git
cd K5-L3A-DAY12-NguyenHoangViet-2A202603487-AI-SDLC-Dao-Den-Long
npm start            # mở http://localhost:8080
```

## Điều khiển
- WASD: di chuyển

## Test & headless
```bash
npm test                                       # unit + scenario headless
node src/headless/cli.js --seed=1 --ticks=60   # (sẽ cập nhật theo Test Contract)
npm run proof -- phase-1                       # lưu bằng chứng vào docs/proof/phase-1
```

## Tài liệu
- Spec: `docs/spec/` · Giả định & đánh giá: `docs/notes/` · Bằng chứng: `docs/proof/`
- Harness AI: `AGENTS.md`, `.githooks/pre-commit` (chặn commit khi test đỏ), `.github/workflows/ci.yml`

## Sáng tạo của tôi
_(cập nhật sau)_

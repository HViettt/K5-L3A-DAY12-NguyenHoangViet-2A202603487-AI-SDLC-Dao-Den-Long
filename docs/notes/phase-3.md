# Phase 3 – TICKET-03 ("Đèn cạn dầu") + Contract v1.2

Spec: [docs/spec/ticket-03.md](../spec/ticket-03.md) · ADR: [adr-001-phase3-fuel-and-win.md](./adr-001-phase3-fuel-and-win.md)

## 1. Test cũ bị luật mới thay thế (cập nhật kèm lý do, không skip)
| Test cũ | Lý do cập nhật theo TICKET-03 |
|---|---|
| `cli.test.js` (`--night 1/2/3` time_left 300/330/360) | Thời lượng chuẩn đổi thành **240 / 270 / 300 s**. |
| `cli.test.js` & `core.test.js` (`won all_lit` + thưởng thời gian) | Bỏ thắng sớm `all_lit` và thưởng thời gian → đổi sang kiểm tra **không thắng sớm khi cả 5 đèn sáng**, chỉ thắng **`dawn_survived`** tại bình minh khi `≥ 3/5` đèn sáng. |
| `core.test.js` (`R5 deposit +200`) | Điểm nạp đổi thành `+5/mote` (10×5 + 100 = **+150**). |
| `phase2-core.test.js` (`AC-05` stunned→chase) | TICKET-03 mục 2 quy định: **hết choáng luôn về `wander`** (ở bước 8 mới xét phát hiện sang `chase`). |
| `phase2-scenarios.test.js` (`AC-06` pulse 2 lần) | Sau stun lần 2 hết, bóng về `wander` rồi mới chuyển `chase` ở bước 8 cùng/sau tick. |

## 2. Acceptance Criteria Phase 3
| ID | Yêu cầu | Tiêu chí | Kiểm chứng | Kết quả |
|---|---|---|---|---|
| P3-01 | Contract v1.2 | `contract_version: "1.2"`, đủ 8 khóa tuning mới, duration `240/270/300` | `tests/phase2-core.test.js` | `docs/proof/phase-3/test-report.txt` | Đạt |
| P3-02 | Nhiên liệu & hao hụt | Đèn vừa thắp `fuel=100`, hao đúng `1/s` (nguyên 1/60), hết dầu → `lantern_out`, `ever_lit=true`, `deposited=0` | `tests/phase3.test.js` | `docs/proof/phase-3/test-report.txt` | Đạt |
| P3-03 | Châm dầu & thắp lại | Châm dầu `used=min(carried, ceil((100-fuel)/10))`, phát `refuel`, `+5/mote`; đèn đầy không chọn; thắp lại đèn `ever_lit` chỉ cần 5 đom đóm (`+40`, `relight:true`) | `tests/phase3.test.js` | `docs/proof/phase-3/test-report.txt` | Đạt |
| P3-04 | Bóng Mực `drain` | `fuel < 30` mất safe_radius (đúng 30 vẫn còn); `wander` đi tới đèn yếu gần nhất, `≤ 2 m` → `drain` hút `5/s`, phát `fuel_drain` mỗi 60 tick; pulse lúc `drain` được **+15**; châm lên `≥ 30` đẩy ra mép 6 m | `tests/phase3.test.js` | `docs/proof/phase-3/test-report.txt` | Đạt |
| P3-05 | Luật thắng `dawn_survived` | Thắp 5/5 không thắng sớm; hết giờ + ≥3/5 đèn sáng → `won dawn_survived` + thưởng `50+floor(fuel)`/đèn + `50`/flame; <3/5 → `lost dawn`; hết lửa kể cả tick cuối → `lost no_flames` | `tests/phase3.test.js` | `docs/proof/phase-3/test-report.txt` | Đạt |
| P3-06 | Sức chứa tăng dần | `capacity = min(20, 10 + 2*successful_lights)` (scenario lit không tính) | `tests/phase3.test.js` | `docs/proof/phase-3/test-report.txt` | Đạt |
| P3-07 | Web: sửa phím ngược + thanh dầu + mù màu | `W/S/A/D` đúng hướng camera; thanh dầu + nhấp nháy 1 Hz khi `<30`; chế độ mù màu (`#00B3FF`, `#FFFFFF` + `⚠`, đèn tắt xẹp 20%) | `node --check` + `src/web/` | review diff + smoke server | Đạt |

## 3. Đánh giá phase (chốt trước tag `phase-3`)
- **Đạt:** Toàn bộ P3-01..P3-07 (**69/69 test pass**, 0 fail, không skip test cũ; đã có `ADR-001` và `CHANGELOG.md` ghi rõ breaking changes).
- **Chưa đạt:** Không có mục cốt lõi nào thiếu; vẫn cần đo FPS thủ công 1280×720 và quay video ở Phase 4.
- **AI sai / phối hợp song song:** Ở Phase 2, GLM bị chậm khi nhận prompt lớn; sang Phase 3 chia việc song song rất gọn (Antigravity làm Core + Tests + ADR + Changelog trong 7 phút; Claude Code + GLM chỉ sửa 2 file `src/web/{index.html,main.js}` trong ~6 phút, không đụng file nhau, hoàn thành sớm hơn hạn 14 phút). Sửa lỗi phím `W/S/A/D` ngược do camera ở `-Z` nhìn `+Z`.
- **Token ước tính:** ~55k (Antigravity ~35k + Claude/GLM ~20k — giảm gần 70% so với Phase 2 nhờ chia nhỏ prompt và không `/clear`).

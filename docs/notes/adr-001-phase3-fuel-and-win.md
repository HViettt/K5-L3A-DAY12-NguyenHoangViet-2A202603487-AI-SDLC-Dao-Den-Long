# ADR-001: Chuyển mô hình Đèn sang Nhiên liệu Nguyên (`fuel60`) & Luật thắng `dawn_survived` (Phase 3)

- **Ngày:** 2026-11-20 · **Trạng thái:** Accepted · **Ticket:** [TICKET-03](../spec/ticket-03.md)

## Bối cảnh
Ở Phase 1–2, đèn là nhị phân (`lit: false → true` vĩnh viễn) và Đêm kết thúc ngay khi cả $N$ đèn sáng (`all_lit`). TICKET-03 đảo ngược vòng lặp cốt lõi: đèn sáng bị hao dầu `1/s` (và bị Bóng Mực ở trạng thái `drain` hút thêm `5/s`), có thể tắt (`lantern_out`) và thắp lại với giá rẻ hơn (`5` đom đóm), đồng thời người chơi chỉ thắng khi **sống sót đến bình minh** với số đèn đang sáng `≥ ceil(0.6 × tổng đèn)`.

## Quyết định thiết kế
1. **Biểu diễn dầu bằng số nguyên `fuel60 ∈ [0, 6000]` (đơn vị `1/60` fuel):**
   - Tránh hoàn toàn sai số cộng dồn IEEE-754 khi trừ `1/60` hoặc `5/60` hàng nghìn tick.
   - Đèn vừa thắp đặt `fuel60 = 6000`; mỗi tick sáng trừ `1`; mỗi Bóng Mực `drain` trừ thêm `5`.
   - Ngưỡng mất vùng an toàn `fuel < 30` kiểm tra chính xác bằng `fuel60 < 1800` (đúng `1800` vẫn giữ vùng an toàn).
   - Khi xuất snapshot/event: `r1(fuel60 / 60)` (làm tròn 1 chữ số thập phân; đèn tắt = `0`).
2. **Mô hình trạng thái Đèn (`lit`, `everLit`, `relitCount`, `deposited`, `fuel60`):**
   - `unlit (everLit=false)` cần `10` đom đóm → thắp lần đầu (`+100`, `relight: false`).
   - `lit (fuel60 > 0)` nhận châm dầu nếu `fuel60 < 6000` (`used = min(carried, ceil((100 - fuel)/10))`, phát `refuel`).
   - `fuel60 ≤ 0` ngay sau Bước 2 → `lit = false`, `deposited = 0`, `everLit = true`, phát `lantern_out`.
   - `unlit (everLit=true)` cần `5` đom đóm → thắp lại (`+40`, `relight: true`, `relitCount++`).
3. **Thứ tự tick & Luật thắng `dawn_survived`:**
   - Trong Bước 2: trừ dầu (hao + bị hút), phát `fuel_drain` mỗi 60 tick hút; ngay sau Bước 2 tắt đèn `fuel60 ≤ 0` (`lantern_out`).
   - Trong Bước 11: xóa nhánh thắng sớm `all_lit`. Kiểm tra `flames ≤ 0` (`no_flames`) trước tiên; nếu `timeLeftS ≤ 0` và `litCount ≥ ceil(0.6 × total)` → `won / dawn_survived` cộng thưởng đèn sáng & Ngọn Lửa; ngược lại → `lost / dawn`.
4. **Sức chứa động (`capacity`):**
   - Lưu `player.successfulLights` (reset 0 mỗi Đêm, không tính đèn `lit: true` từ scenario) và tính `capacity = min(20, 10 + 2 * successfulLights)`.

## Hệ quả & Test bị ảnh hưởng
- Các test Phase 1–2 kiểm tra thắng sớm `all_lit`, điểm cũ (`+10/mote`, thưởng thời gian), hoặc thời lượng cũ (`300/330/360 s`) trở nên không còn hợp lệ → **cập nhật trực tiếp kèm ghi chú lý do** trong `tests/core.test.js`, `tests/cli.test.js`, `tests/phase2-*.test.js` (không skip âm thầm).
- Hết choáng của Bóng Mực luôn về `wander` (thay vì `chase` nếu gần) để tuân thủ TICKET-03 mục 2.

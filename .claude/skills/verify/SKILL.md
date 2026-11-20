---
name: verify
description: Chạy kiểm chứng toàn bộ (unit, regression, scenario v1.1, tất định, benchmark 21.600 tick) và lưu bằng chứng cho phase hiện tại. Dùng trước khi gắn tag phase-N.
---

1. `npm test` – phải xanh toàn bộ (gồm regression Phase 1 + các scenario Phase 2). Nếu đỏ: sửa code, KHÔNG sửa/xóa test cho đạt (trừ khi spec mới thay luật — ghi rõ lý do vào `docs/notes/phase-N.md`).
2. Kiểm tra tính tất định: chạy 2 lần cùng `--seed` cho `--night 1`, `2`, `3` và so byte-identical.
3. Kiểm tra hiệu năng headless: chạy Đêm 3 đầy đủ `21600` tick, xác nhận thời gian `≤ 30 s`.
4. Chạy `npm run proof -- phase-N` để lưu output thật vào `docs/proof/phase-N/`. Không sửa tay file trong đó.
5. Cập nhật bảng truy vết Acceptance Criteria và mục Đánh giá trong `docs/notes/phase-N.md`, cùng `docs/notes/ai-log.md`.
6. Báo lại: yêu cầu nào đạt, chưa đạt, và lệnh để người khác chạy lại.

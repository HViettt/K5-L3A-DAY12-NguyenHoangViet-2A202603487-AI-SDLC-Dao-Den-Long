---
name: verify
description: Chạy kiểm chứng và lưu bằng chứng cho phase hiện tại. Dùng sau khi hoàn thành một yêu cầu hoặc trước khi gắn tag phase-N.
---

1. `npm test` – phải xanh. Nếu đỏ: sửa code, KHÔNG sửa/xóa test cho đạt (trừ khi spec mới thay luật – ghi lý do vào docs/notes/phase-N.md).
2. Chạy các scenario trong `tests/scenarios/` qua headless CLI; chạy mỗi scenario 2 lần, so output (tất định).
3. `npm run proof -- phase-N` để lưu output thật vào `docs/proof/phase-N/`. Không sửa tay file trong đó.
4. Cập nhật bảng truy vết trong `docs/notes/phase-N.md`: yêu cầu → cách kiểm chứng → file bằng chứng → Đạt/Chưa đạt (lý do).
5. Báo lại: yêu cầu nào đạt, chưa đạt, và lệnh để người khác chạy lại.

# AGENTS.md — Đảo Đèn Lồng

Game 3D góc nhìn thứ ba (Three.js) + chế độ headless (Node) theo Test Contract.

## Lệnh
- Test toàn bộ (unit + scenario): `npm test`
- Headless: `node src/headless/cli.js <args theo Test Contract>`
- Chạy game: `npm start` rồi mở http://localhost:8080

## Kiến trúc (bắt buộc)
- `src/core/`: logic game THUẦN (không import three, không DOM, không Date.now/Math.random). Mọi ngẫu nhiên đi qua RNG có seed trong `src/core/rng.js`.
- `src/web/`: chỉ hiển thị + input, đọc state từ core. Không chứa luật chơi.
- `src/headless/`: CLI đọc input, chạy core với bước thời gian cố định, in output đúng định dạng contract.
- Không thêm dependency npm khi chưa hỏi. Three.js nạp qua import map (không bước build).

## Quy ước
- Yêu cầu nguồn duy nhất: `docs/spec/` (bản chép PRD/ticket). Không bịa yêu cầu; chỗ mơ hồ ghi vào `docs/notes/phase-N.md` mục Giả định.
- Mỗi thay đổi luật phải có test trong `tests/`. Không viết test luôn đạt, không sửa tay output trong `docs/proof/`.
- Bằng chứng tạo bằng `npm run proof` (ghi vào `docs/proof/phase-N/`).
- Commit nhỏ, thông điệp dạng `feat|fix|test|docs|chore: ...`.
- Chưa xong khi `npm test` còn đỏ.

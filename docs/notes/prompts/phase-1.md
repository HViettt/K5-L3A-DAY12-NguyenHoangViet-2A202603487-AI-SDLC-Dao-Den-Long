# Prompt Phase 1 cho Claude Code (builder)

Dán từng bước một vào Claude Code. Mỗi bước xong: đọc diff, `npm test`, commit.

## Bước 1 – Core + headless (việc quan trọng nhất)
```
Đọc AGENTS.md, docs/spec/prd-0.md (mục Test Contract), docs/notes/phase-1.md (bảng luật G1–G16), game.contract.json.
Thay placeholder trong src/core và src/headless bằng bản thật:
- src/core/config.js: đọc tuning từ game.contract.json (không hard-code số tuning ở chỗ khác).
- src/core/world.js: createWorld({seed, scenario}), step(world, input) → trả về danh sách event của bước đó, snapshot(world). Làm đúng luật G1–G16, đúng thứ tự G14. time_left_s tính bằng duration − steps/60 (không cộng dồn float). Chỉ dùng RNG trong src/core/rng.js.
- src/headless/cli.js: tham số đúng mục B của contract; validate inputs/scenario (sai → stderr + exit 2; thiếu tham số → exit 1); ghi JSONL đúng mục E (tọa độ làm tròn 3 số, dòng cuối "end").
- Xóa tests cũ của placeholder, viết tests/core.test.js + tests/cli.test.js phủ R1–R10 trong docs/notes/phase-1.md, mỗi test 1 scenario nhỏ trong tests/scenarios/*.json.
Không làm phần web ở bước này. Không thêm dependency. Xong khi npm test xanh.
```

## Bước 2 – Game có giao diện
```
Viết lại src/web/main.js dùng src/core/world.js (không chép luật sang web): đảo tròn, 5 đèn (tắt: xám tối, thắp: vàng cam phát sáng + đảo sáng dần), đom đóm vàng, Bóng Mực tím đen (stunned thì nhạt màu), Mây = thân + nón lá + đèn lồng nhỏ.
Điều khiển: WASD di chuyển theo hướng camera, chuột/Q-E xoay camera (truyền cam_yaw_deg), Space nhảy, E nạp đèn, F tỏa sáng, R chơi lại.
HUD: flames, carried/capacity, đèn x/5, thời gian còn lại, điểm, màn hình thắng/thua + "R để chơi lại".
Fixed step 60 Hz như hiện tại. Không thêm dependency.
```

## Bước 3 – README + bằng chứng
```
Cập nhật README: 3 lệnh chạy, điều khiển, cách tính điểm (G16), giải thích tuning (fall_enabled=false vì có clamp ở mép đảo). Chạy /verify cho phase-1.
```

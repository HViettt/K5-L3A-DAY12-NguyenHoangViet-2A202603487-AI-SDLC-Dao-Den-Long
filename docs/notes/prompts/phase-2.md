# Prompt Phase 2 cho Claude Code (builder)

> **Chiến lược tiết kiệm thời gian & token:** Phase 1 đã gắn tag xong (không gắn lại). Nếu Claude chưa xong Bước 1 của Phase 1 thì **dừng/bỏ qua v1.0**, chuyển thẳng sang làm **Contract v1.1** theo các bước dưới đây. Vừa đạt toàn bộ Ticket-02 vừa pass regression Phase 1 với số chuẩn.
>
> **Hạn tag `phase-2`:** dự kiến **16:00** (chốt và gắn tag lúc ~15:50).

---

## Bước 1 — Nâng Core + 3 Bản đồ + Headless lên Contract v1.1 (ưu tiên số 1)
```
Đọc AGENTS.md, docs/spec/ticket-02.md và docs/notes/phase-2.md (đặc biệt mục 1 Delta và mục 2 Giả định A2-1..A2-12).
Cập nhật game.contract.json sang contract_version "1.1" với đúng các số chuẩn trong docs/notes/phase-2.md.

Xây/cập nhật src/core/ và src/headless/ đạt 100% Test Contract v1.1:
1. src/core/maps.js: định nghĩa 3 bản đồ chuẩn (Đêm 1 Đảo Bến, Đêm 2 Đảo Cau + cầu tre + 2 bục nhảy, Đêm 3 Đảo Chuông 3 tầng + 2 dốc 30°/150° + bục nhảy + tháp chuông + gió mạnh), hàm getGroundY(map, x, z, currentY) và resolveObstacles(map, pos).
2. src/core/world.js:
   - Đúng thứ tự 12 bước bắt buộc trong 1 tick (pause trước → giảm timer → di chuyển Mây + dash + nhảy + bục nhảy + gió + kiểm tra rơi Y<-10 → nhặt mote/charm → nạp đèn → safe_radius → Tỏa Sáng 3D → di chuyển Shade & Drifter → va chạm Drifter rồi Shade → spawn theo lịch → xét thắng/thua).
   - Đủ 5 trạng thái Shade: spawning, wander, chase, recoil, stunned.
   - Đủ Gió Lạc (drifters: idle, chase, flee, removed) và Bùa Gió (charms: C1, C2).
   - Điểm chuẩn: +10/mote nạp, +100/đèn, +5/shade bị pulse, thắng +floor(time_left)*2 + 50*flames.
   - Snapshot đủ mọi trường bắt buộc của v1.1 (night, wind, player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}, motes[], drifters[], charms[]).
   - Scenario hỗ trợ đầy đủ khóa mới v1.1.
3. src/headless/cli.js: hỗ trợ --night 1|2|3, đúng các event mới v1.1, mã thoát 0/1/2, chạy 21.600 tick trong ≤ 30 giây.
4. Viết bộ test trong tests/ và tests/scenarios/:
   - Regression Phase 1 (di chuyển, yaw, nhặt, nạp, thắp, thắng/thua, tất định).
   - Ít nhất 1 scenario headless riêng cho mỗi tính năng mới: dash, fall, pause, shade_states, pulse_v11, night2_jump_pad, night3_terrain_wind, drifter, charm.
   - 1 test benchmark chạy 21.600 tick Đêm 3 xác nhận thời gian ≤ 30 s.
Không thêm dependency npm. Xong khi `npm test` xanh toàn bộ.
```

---

## Bước 2 — Giao diện Web 3D + 3 Đêm + HUD + Âm thanh + Bảng màu chuẩn
```
Đọc docs/spec/ticket-02.md Phần 2 & Phần 3.
Cập nhật src/web/ (giữ nguyên nguyên tắc: chỉ hiển thị & input, không chứa luật chơi, đọc state từ src/core/):
1. Dựng hình 3 bản đồ (Đảo Bến, Đảo Cau + cầu tre + bục nhảy, Đảo Chuông 3 tầng + dốc + tháp chuông + lá bay báo gió) theo đúng Bảng màu chuẩn hex trong spec.
2. Nhân vật Mây (áo #E8E2D0, khăn #C8102E, nón lá + đèn nhỏ), Đèn Lồng (tắt #5B5F6E, sáng #FFB347/#FFE9B0), Đom đóm (#FFF6C2/#FFE58A), Bóng Mực (#120A1A/#7A3CFF, choáng #3A3450), Gió Lạc (#8FA3B8), Bùa Gió (#C8102E viền #F2C14E). Ánh sáng môi trường: 0.15 + 0.55 * (lit / total).
3. Điều khiển: WASD + chuột (độ nhạy chỉnh được), Space nhảy, Shift/Right-click lướt (dash), E nạp đèn, F tỏa sáng, Esc/P tạm dừng.
4. Luồng 3 Đêm: Menu chính → Intro Đêm (tên đảo + lời Ông Đăng) → Chơi → Kết quả → Đêm kế tiếp → Màn hình Bình Minh tổng điểm sau Đêm 3. Menu Pause (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu). Lưu âm lượng & độ nhạy chuột vào localStorage.
5. HUD đầy đủ: Ngọn Lửa (trên trái), đồng hồ mm:ss (trên giữa, đỏ nhấp nháy ≤ 30s), đèn k/n + điểm (trên phải), thanh đom đóm 10 ô (dưới giữa), hồi chiêu Lướt & Tỏa Sáng (dưới phải), nhắc "E — Nạp ánh sáng (x/10)", mũi tên chỉ đèn chưa sáng gần nhất khi ngoài màn hình.
6. src/web/audio.js: tổng hợp nhạc nền đêm nhẹ + đủ 10 SFX bằng Web Audio API (không cần file mp3).
7. Hiển thị bộ đếm FPS gọn ở góc (bật/tắt được) để đo ≥ 30 FPS ở 1280×720.
```

---

## Bước 3 — Cập nhật Harness, README, Bằng chứng & Tag `phase-2`
```
1. Cập nhật AGENTS.md (ghi rõ Contract v1.1, 3 Đêm, thứ tự 12 bước, quy tắc không hard-code tuning) và .claude/skills/verify/SKILL.md (thêm kiểm tra benchmark 21.600 tick ≤ 30s và đủ scenario v1.1).
2. Cập nhật README.md: điều khiển mới (Shift lướt, Esc/P pause), cách tính điểm chuẩn v1.1, cách chạy --night 1|2|3.
3. Chạy `npm test` và `npm run proof -- phase-2`.
4. Điền bảng kết quả AC-01..AC-16 và mục Đánh giá trong docs/notes/phase-2.md, cập nhật docs/notes/ai-log.md và CHANGELOG.md.
```
Sau khi kiểm tra xong (khoảng 15:50):
```bash
git add -A
git commit -m "release: phase-2 (3 nights, Contract v1.1, full HUD & audio)"
git tag phase-2
git push origin main
git push origin phase-2
```

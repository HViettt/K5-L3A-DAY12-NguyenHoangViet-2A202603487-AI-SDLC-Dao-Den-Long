# Phase 2 – TICKET-02 ("Ba hòn đảo") + Test Contract v1.1

Spec gốc: [docs/spec/ticket-02.md](../spec/ticket-02.md).

> **Lưu ý từ Phase 1:** Tag `phase-1` đã chốt đúng hạn 15:00 khi mới có khung dự án + `game.contract.json` v1.0 + giả định (chưa kịp xong core/web do đoán nhầm mốc giờ). Ở Phase 2, chúng ta nâng thẳng lên **Contract v1.1** với số liệu chuẩn — vừa đáp ứng toàn bộ Ticket-02 vừa đạt regression cho các kịch bản Phase 1.

---

## 1. Thay đổi so với Phase 1 (Delta & Test cần sửa)

| Hạng mục | Phase 1 (v1.0 giả định) | Phase 2 (v1.1 chuẩn) | Ảnh hưởng test cũ |
|---|---|---|---|
| `contract_version` | `"1.0"` | `"1.1"` | Cập nhật `game.contract.json` |
| `lantern_cost` | 5 | **10** | Cập nhật scenario nạp/thắp đèn |
| `pickup_radius` | 1.5 m | **1.0 m** (+ chênh cao ≤ 1.5 m) | Cập nhật test nhặt |
| `interact_radius` | 3.0 m | **2.0 m** | Cập nhật test tương tác đèn |
| `pulse_cost / radius / cd / stun` | 1 / 6 m / 1 s / 3 s | **3 / 5 m / 3 s / 2 s (120t)**, tâm Mây+0.8m, 3D, đẩy 4m trong 15t | Cập nhật test pulse |
| `shade_speed` | 3.5 m/s | **4.0 m/s** (Đêm 3: **4.5 m/s**), detect 12 m / lose 18 m | Cập nhật test đuổi |
| `invuln_s` | 2.0 s | **1.5 s (90 tick)** | Cập nhật test bất tử |
| `safe_radius` | 5 m | **6 m** (+ đẩy bóng bên trong ra trong ≤ 30t, không gây hit lúc đẩy) | Cập nhật test vùng an toàn |
| `fall_enabled` | `false` (clamp mép) | **`true`** (`Y < -10`: -1 lửa, mất hết đom đóm, chờ 60t rồi hồi sinh + 90t invuln) | Bỏ clamp mép đảo; sửa test biên đảo kèm lý do |
| Điểm `score` | per_mote=10 (lúc nhặt), per_stun=20, per_sec=1 | **+10 mỗi đom đóm NẠP** (không cộng lúc nhặt), per_lantern=100, **per_stun=5**, **per_sec=2**, per_flame=50 | Sửa test tính điểm |
| Đom đóm rơi khi bị đánh | mất luôn | **Rơi ra vành 1.5–2.5 m**, TTL 480 tick, nhặt lại được từ tick sau | Thêm kiểm tra `dropped` motes |
| Thứ tự trong 1 tick | G14 (9 bước) | **12 bước bắt buộc** trong Ticket-02 Phần 1 | Sắp xếp lại `step()` đúng 12 bước |
| Trạng thái Bóng Mực | `chase`, `stunned` | Bắt buộc đúng tên: **`spawning`, `wander`, `chase`, `recoil`, `stunned`** | Cập nhật assertion |

### `game.contract.json` chuẩn v1.1 (mục tiêu)
```json
{
  "contract_version": "1.1",
  "team": "2A202603487-nguyen-hoang-viet",
  "build_cmd": "npm install --no-audit --no-fund",
  "run_cmd": "npm start",
  "headless_cmd": "node src/headless/cli.js",
  "tuning": {
    "player_speed": 6.0,
    "dash_speed": 14.0,
    "dash_duration_s": 0.2,
    "dash_cooldown_s": 1.5,
    "carry_capacity": 10,
    "lantern_cost": 10,
    "lantern_count_night1": 5,
    "pickup_radius": 1.0,
    "interact_radius": 2.0,
    "pulse_cost": 3,
    "pulse_radius": 5.0,
    "night1_duration_s": 300,
    "night2_duration_s": 330,
    "night3_duration_s": 360,
    "flames": 3,
    "invuln_s": 1.5,
    "hit_drop_ratio": 0.5,
    "pulse_stun_s": 2.0,
    "pulse_push_m": 4.0,
    "pulse_cooldown_s": 3.0,
    "safe_radius": 6.0,
    "shade_speed": 4.0,
    "shade_hit_radius": 1.0,
    "fall_enabled": true,
    "score": {
      "per_mote": 10,
      "per_lantern": 100,
      "per_stun": 5,
      "per_second_left": 2,
      "per_flame_left": 50
    }
  }
}
```

---

## 2. Giả định bổ sung cho chỗ chưa quy định rõ trong Ticket-02

| # | Chủ đề | Giả định |
|---|---|---|
| A2-1 | Góc tọa độ | Góc $\alpha$ đo từ `+X` ngược chiều kim đồng hồ nhìn từ trên xuống: $x = r\cos\alpha,\; z = -r\sin\alpha$ (kiểm chứng với Đêm 1: L1 tại 90° hay chuẩn hóa đúng tọa độ liệt kê sẵn — ưu tiên tọa độ tường minh trong spec cho đèn, bục nhảy, bùa; dùng $x=r\cos\alpha, z=r\sin\alpha$ cho điểm sinh đối xứng vì tầng 1 Đêm 3 yêu cầu $z > 0$ ứng với $20°\dots 160° \Rightarrow \sin\alpha > 0 \Rightarrow z = +r\sin\alpha$). **Chốt:** $x = r\cos\alpha, z = +r\sin\alpha$ để 30°/150° nằm ở nửa $z > 0$ khớp hoàn toàn với tầng 1! |
| A2-2 | Tăng tốc/dừng ≤ 0.1 s | Dùng tốc độ mục tiêu đạt ngay trong 1–3 tick (hoặc tức thời 1 tick = 0.0167 s ≤ 0.1 s) để di chuyển chính xác, dễ tái lập. |
| A2-3 | `night_start` event | Phát `{"type":"event","tick":0,"name":"night_start","data":{"night":N}}` ngay sau snapshot tick 0 (hoặc đầu tick 1 — kiểm tra hợp lý: vì tick 0 là trạng thái dựng scenario không phát sự kiện, phát `night_start` ở tick 0 trước input hoặc đầu tick 1; **chốt:** phát ở `tick: 0` chỉ khi chạy bình thường, không cộng điểm). |
| A2-4 | Trạng thái `spawning` và `wander` của Bóng Mực | Sinh tự nhiên bắt đầu ở `spawning` trong 30 tick (0.5 s) rồi sang `wander`; sinh từ scenario vào thẳng `wander` (hoặc `chase` nếu trong 12 m) trừ khi scenario ghi rõ `state`. Khi `wander`, Bóng Mực đi chậm `1.5 m/s` theo hướng ngẫu nhiên đổi mỗi 120 tick (giữ trong đảo và ngoài vùng an toàn). Khi khoảng cách ≤ 12 m → `chase`; > 18 m → `wander`. |
| A2-5 | Tâm Bóng Mực (Y) | Bóng Mực lơ lửng ở `groundY + 1.0 m` (khớp ví dụ snapshot `pos: [30.1, 1.0, 2.0]`). Khoảng cách 3D của Tỏa Sáng đo từ `(player.x, player.y + 0.8, player.z)` đến `shade.pos`. |
| A2-6 | Bóng Mực `recoil` | Khi gây hit, chuyển `recoil` trong 60 tick, lùi đều `2.0 / 60` m/tick ra xa Mây, không gây hit trong lúc recoil; hết 60 tick về `chase`/`wander`. |
| A2-7 | Đom đóm rơi | Rơi tại bán kính ngẫu nhiên đều trong `[1.5, 2.5]` m quanh chân Mây, góc ngẫu nhiên (qua RNG seed), đặt trên mặt đất hợp lệ (nếu ngoài đảo thì kẹp vào trong đảo hoặc đặt tại chân Mây). `kind: "dropped"`, `ttl_s` đếm ngược từ `8.0` (480 tick). `random` motes có `ttl_s: null`. |
| A2-8 | Điểm `per_mote` | Theo Ticket-02: "+10 mỗi đom đóm nạp". Cộng `10 * amount` khi phát sự kiện `deposit`, KHÔNG cộng khi `mote_picked`. |
| A2-9 | Gió Đêm 3 | Cứ mỗi 1800 tick (30 s): từ tick `1680..1799` cảnh báo (lá bay + âm thanh, `wind.active = false`), từ tick `1800..2099` (300 tick = 5 s) gió hoạt động (`wind.active = true`, `dir_deg` ngẫu nhiên `[0, 360)`), cộng vận tốc `(2*cos(dir), 0, 2*sin(dir))` vào di chuyển Mây. Tắt khi `wind_enabled: false`. |
| A2-10 | Tầng & Dốc Đêm 3 | Mặt đất tại `(x,z)` trả về `groundY` hợp lệ cao nhất `≤ player.y + 0.5`: nếu ở trên dốc 30° hoặc 150° (r ∈ [24,30], |vuông góc| ≤ 1.5 m) thì `Y = 3 * (30 - r) / 6`; tầng 2 (`r ≤ 8`, trừ trụ tháp chuông `r ≤ 2` đẩy ra) có `Y = 6`; tầng 1 (`12 ≤ r ≤ 24, z > 0`) có `Y = 3`; tầng 0 (`r ≤ 45`) có `Y = 0`. Không đi xuyên vách cao hơn `player.y + 0.5`. |
| A2-11 | Gió Lạc `idle` | Lượn tròn/tuần tra chậm `2 m/s` quanh khu vực đảo; tâm lơ lửng `groundY + 1.2 m`. |
| A2-12 | Snapshot `invuln` | Boolean (`invuln_ticks > 0`), và `vel: [vx, vy, vz]` làm tròn 3 chữ số thập phân. `dash_cd_s`, `pulse_cd_s`, `charm_s`, `respawn_s`, `ttl_s` tính theo `ticks / 60` làm tròn 3 chữ số. |

---

## 3. Acceptance Criteria (đủ cho Phần 1, 2, 3, 4 và DoD)

| ID | Hạng mục | Tiêu chí nghiệm thu (làm A → thấy B) | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|---|
| AC-01 | Số liệu chuẩn & Contract v1.1 | `game.contract.json` có `contract_version: "1.1"`, đủ 5 khóa mới, mọi số khớp Phần 1; core đọc trực tiếp từ file này. | unit test | | |
| AC-02 | Lướt (Dash) | Nhấn `dash` → phát `dash {}`, đi `14 m/s` trong 12 tick (2.8 m), giữ nguyên `y` trên không, `dash_cd_s = 1.5`, nhấn lại trong cd bị bỏ qua; vẫn chịu hit khi lướt. | scenario `dash.json` | | |
| AC-03 | Rơi khỏi đảo | Đi ra ngoài bán kính 40 m (Đêm 1) → rơi `Y < -10` → `player_hit {by:"fall", lost:n}`, mất hết đom đóm, chờ 60 tick không nhặt/không hit, tick +60 hồi sinh `(0,0,0)` với `invuln_ticks=90`. Nếu flames=1 → thua `no_flames` ngay. | scenario `fall.json` | | |
| AC-04 | Tạm dừng (Pause) | Gửi `pause: true` → phát `paused`, `state:"paused"`, `tick` tăng nhưng `sim_tick`, `time_left_s`, cooldown, TTL đứng yên; gửi `pause: true` lần nữa → `resumed`, tiếp tục bình thường. | scenario `pause.json` | | |
| AC-05 | Bóng Mực mới (5 state + recoil + safe_radius) | Đủ 5 tên `spawning, wander, chase, recoil, stunned`; phát hiện ≤ 12 m, bỏ đuổi > 18 m; gây hit → `recoil` 60t lùi 2 m + rơi `floor(c/2)` đom đóm (`kind:"dropped"`, TTL 480t); đèn sáng chặn ở 6 m và đẩy bóng trong vùng ra ≤ 30t. | scenario `shade_states.json` | | |
| AC-06 | Tỏa Sáng chuẩn (3D + 15t đẩy + 120t stun) | Đủ 3 đom đóm → stun 120t, đẩy 4 m trong 15t, +5 điểm/con, cd 180t; < 3 đom đóm không kích hoạt; kiểm tra khoảng cách 3D từ `y+0.8`. | scenario `pulse_v11.json` | | |
| AC-07 | Đêm 2 — Đảo Cau + Cầu tre + Bục nhảy | `--night 2` có 2 đảo + cầu `[26,44]×[-2,2]`, 6 đèn `L1..L6`; chạm bục `(20,0,18)` → phóng `vy=14, vh=24` về tâm B `(70,0,0)`, đáp trên đảo B. | scenario `night2_jump_pad.json` | | |
| AC-08 | Đêm 3 — Đảo Chuông (3 tầng, dốc, tháp, gió) | `--night 3` có 7 đèn `L1..L7`; leo dốc 30° lên `Y=3`, chạm bục `(0,3,13)` lên tầng 2 `Y=6`, bị chặn bởi tháp chuông `r=2`; gió mạnh đẩy `2 m/s` trong 5 s mỗi 30 s (`wind.active=true`). | scenario `night3_terrain_wind.json` | | |
| AC-09 | Gió Lạc (Drifter) | Sinh tại tick 1200 Đêm 2/3 (`D1`), `idle→chase` khi `carried ≥ 5 & dist ≤ 15`, chạm ≤ 1.2 m → `drifter_steal` cướp `min(3, carried)` → `flee` 240t → `removed`. Tỏa Sáng lúc `flee` → `drifter_drop` thả lại đom đóm rơi. Không bị chặn bởi safe_radius/invuln. | scenario `drifter.json` | | |
| AC-10 | Bùa Gió (Charm) | Nhặt `C1` → `charm_picked` (600t), tốc độ `7.2 m/s`, Lướt không hồi chiêu; bùa hiện lại sau 2700t (`charms[].available`). | scenario `charm.json` | | |
| AC-11 | Regression Phase 1 & Hiệu năng headless | Chạy lại bộ test Phase 1 với số chuẩn (nhặt, nạp, thắp, thắng `all_lit`, thua `dawn`/`no_flames`, tất định). Chạy 21.600 tick (Đêm 3 đầy đủ) hết `≤ 30 s`. | `npm test` + benchmark headless | | |
| AC-12 | Chuỗi 3 Đêm + Menu + Tạm dừng + Cài đặt (Web) | Menu chính → Intro Đêm (lời Ông Đăng) → Đêm 1 → 2 → 3 → Màn hình Bình Minh tổng điểm; Esc/P mở menu Pause; âm lượng & độ nhạy chuột lưu `localStorage`. | kiểm tra thủ công + ảnh chụp | | |
| AC-13 | Âm thanh (Web Audio) | Nhạc nền đêm + đủ 10 SFX (nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối) tạo bằng Web Audio API (không cần file ngoài). | kiểm tra thủ công | | |
| AC-14 | HUD đầy đủ & Bảng màu chuẩn | Đủ vị trí HUD theo Phần 3 (đồng hồ đỏ nhấp nháy ≤ 30 s, 10 ô đom đóm, cd Lướt/Tỏa Sáng, nhắc E, mũi tên chỉ đèn ngoài màn hình). Màu khớp hex bảng màu chuẩn; ánh sáng `0.15 + 0.55*(lit/total)`. | ảnh chụp + review code màu | | |
| AC-15 | FPS ≥ 30 ở 1280×720 | Mở game 1280×720 đo FPS trung bình ≥ 30. | đo thực tế + ghi log | | |
| AC-16 | Cập nhật Harness | `AGENTS.md` và skill `/verify` cập nhật cho Contract v1.1 + 3 Đêm + benchmark 21.600 tick, thể hiện trong git log. | git diff | | |

---

## 4. Đánh giá phase (điền trước khi gắn tag `phase-2`)
- Đạt:
- Chưa đạt (lý do):
- Test cũ đã sửa/bỏ (kèm lý do):
- AI sai ở đâu / chỉnh harness:
- Token ước tính:

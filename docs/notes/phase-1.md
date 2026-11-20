# Phase 1 – PRD-0 + Test Contract v1.0

Spec gốc: [docs/spec/prd-0.md](../spec/prd-0.md). Số tuning: [game.contract.json](../../game.contract.json). Hai nơi này là nguồn sự thật duy nhất; code đọc tuning từ `game.contract.json`.

## 1. Luật chơi đã chốt (giả định cho chỗ PRD mơ hồ)

| # | Chủ đề | Quyết định |
|---|---|---|
| G1 | Đảo | Đảo tròn bán kính 40 m, tâm (0,0,0). `fall_enabled=false`: người chơi bị giữ lại ở mép đảo (clamp theo XZ), không có sự kiện `fall`. |
| G2 | Đèn mặc định | 5 đèn L1…L5 trên vòng tròn bán kính 25 m: Lk ở góc (k−1)·72°, pos = (25·sin α, 0, 25·cos α). L1 = (0,0,25). |
| G3 | Di chuyển | `player_speed` 6 m/s trên XZ theo công thức xoay camera của contract, vector > 1 chuẩn hóa. Không có quán tính. |
| G4 | Nhảy | Cạnh lên của `jump` khi đang chạm đất: vy = 6 m/s, trọng lực 20 m/s², chạm đất y = 0. Nhảy **không** né được va chạm (mọi khoảng cách đo theo XZ). |
| G5 | Nhặt đom đóm | Tự động khi khoảng cách XZ ≤ `pickup_radius` và `carried < carry_capacity`. Nhiều con cùng tick: xét theo thứ tự trong danh sách (id tăng dần), mỗi con 1 sự kiện `mote_picked`, +`per_mote`. |
| G6 | Nạp đèn | Cạnh lên của `interact`, `carried > 0`, có đèn **chưa thắp** trong `interact_radius` (chọn đèn gần nhất; bằng nhau chọn id nhỏ). Nạp `amount = min(carried, lantern_cost − deposited)`. Phát `deposit`; nếu `deposited == lantern_cost` thì đèn `lit`, phát `lantern_lit`, +`per_lantern`. Không đủ điều kiện → không làm gì, không sự kiện. |
| G7 | Tỏa sáng (pulse) | Cạnh lên của `pulse`, `carried ≥ pulse_cost`, hết cooldown. Trừ `pulse_cost` đom đóm đang mang ("tốn ánh sáng"), cooldown `pulse_cooldown_s`. Mọi Bóng Mực (kể cả đang stunned) trong `pulse_radius` bị stun `pulse_stun_s` (đặt lại thời gian) và đẩy ra xa người chơi `pulse_push_m` theo XZ (nếu trùng vị trí: đẩy theo +X). Phát `pulse` với `stunned_ids` theo thứ tự id (có thể rỗng). +`per_stun` cho mỗi con. Không đủ điều kiện → không pulse, không sự kiện. |
| G8 | Bóng Mực | Trạng thái `chase` | `stunned`. `chase`: đi thẳng về phía người chơi trên XZ với `shade_speed`. `stunned`: đứng yên, không gây sát thương. Giữ nguyên y. |
| G9 | Vùng an toàn | Bóng Mực không vào được trong `safe_radius` quanh **đèn đã thắp** (đèn chưa thắp không có ánh sáng). Sau khi di chuyển/bị đẩy, nếu nằm trong vùng thì bị đẩy ra đúng mép vòng tròn (dist = safe_radius). |
| G10 | Bị chạm | Bóng Mực không stunned có khoảng cách XZ ≤ `shade_hit_radius` và người chơi không bất tử → flames −1, `dropped = floor(carried · hit_drop_ratio)`, carried −= dropped, bất tử `invuln_s`. Đom đóm rơi **mất luôn**. Tối đa 1 lần chạm mỗi tick. |
| G11 | Sinh ngẫu nhiên | `random_motes` (mặc định true): 30 đom đóm rải ngẫu nhiên (seed) trong đảo, ngoài bán kính 3 m quanh tâm; cứ 3 s sinh thêm 1 nếu đang < 30. `random_shades` (mặc định true): bắt đầu 2 con S1,S2 ở mép đảo; cứ 30 s sinh thêm 1 (tối đa 6), phát `shade_spawned`. |
| G12 | Id | Đom đóm M1, M2…; Bóng Mực S1, S2… theo thứ tự tạo (scenario không có id thì đánh S1… theo thứ tự). Id tự sinh tiếp nối số lớn nhất. |
| G13 | Kết thúc | Thắng: cả 5 đèn lit → `game_over won all_lit`, cộng thưởng `per_second_left · floor(time_left_s)` + `per_flame_left · flames`. Thua: flames = 0 → `lost no_flames`; time_left_s ≤ 0 → `lost dawn`. Không thưởng khi thua. |
| G14 | Thứ tự trong 1 bước | 1 input → 2 di chuyển/nhảy người chơi → 3 pulse → 4 interact/nạp đèn → 5 nhặt đom đóm → 6 Bóng Mực di chuyển + vùng an toàn → 7 va chạm → 8 giảm timer (stun, invuln, cooldown), time_left −1/60, sinh ngẫu nhiên → 9 kiểm tra thắng rồi thua. |
| G15 | Output | Ghi snapshot mỗi `--snapshot-every` tick và thêm 1 snapshot cuối nếu tick cuối không chia hết. Snapshot có thêm mảng `motes` (khuyến nghị). Mã thoát: 0 OK, 2 file inputs/scenario sai, 1 lỗi khác (thiếu tham số…). |
| G16 | Điểm | per_mote 10, per_lantern 100, per_stun 20, khi thắng + 1 điểm/giây còn lại + 50 điểm/flame còn lại. |

## 2. Tiêu chí nghiệm thu & kiểm chứng

| ID | Yêu cầu | Tiêu chí nghiệm thu (làm A → thấy B) | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|---|
| R1 | CLI theo contract | Chạy đủ tham số → file jsonl, dòng cuối `end`, mã 0; file hỏng → mã 2; thiếu `--out` → mã ≠0 | test CLI | | |
| R2 | Mô hình tick | `--ticks 10` → snapshot tick 0 và 10, end.ticks=10, time_left = 300−10/60 | test | | |
| R3 | Di chuyển + yaw | move [0,1] 60 tick → z=6; yaw 90 → x=6; move [1,1] độ dài chuẩn hóa | test | | |
| R4 | Nhặt | mote ở (0,0,5), đi +Z → `mote_picked` đúng tick đầu tiên dist ≤ 1.5; đầy capacity thì không nhặt | test | | |
| R5 | Nạp/thắp | carried 5 cạnh L1 + interact → deposit 5, lantern_lit, score +100 | test | | |
| R6 | Pulse | shade trong 6 m + pulse → stunned, đẩy 4 m, carried −1, cooldown chặn pulse lần 2 | test | | |
| R7 | Đuổi + chạm | shade ở (10,0,0) đuổi; chạm → player_hit, dropped = floor(c·0.5), invuln 2 s | test | | |
| R8 | Vùng an toàn | shade không bao giờ có dist ≤ 5 tới đèn lit (trừ đúng mép) | test | | |
| R9 | Thắng/thua | 4 đèn lit + nạp đèn 5 → won all_lit + thưởng; flames 1 + chạm → lost no_flames; time_left 1 s → lost dawn tick 60 | test | | |
| R10 | Tất định | Cùng seed chạy 2 lần (random bật) → file giống hệt từng byte | test | | |
| R11 | Game có giao diện chơi được | Chơi từ đầu đến thắng/thua, HUD (flames, carried, đèn, thời gian, điểm), chơi lại bằng R | ảnh chụp/clip + chạy thủ công | | |
| R12 | README + contract | ≤ 3 lệnh, điều khiển, cách tính điểm, giải thích tuning | review | | |

## 3. Đánh giá phase (điền khi xong)
- Đạt:
- Chưa đạt (lý do):
- AI sai ở đâu / chỉnh harness:
- Token ước tính:

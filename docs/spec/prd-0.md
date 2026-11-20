# PRD-0 · Đảo Đèn Lồng (Phase 1) — bản chép nguyên văn từ lab board

Tag nộp: phase-1 · Contract v1.0 · ~60 phút · Đúng yêu cầu > phức tạp

## 1. Chúng tôi muốn gì
Chúng tôi muốn một game 3D tên là Đảo Đèn Lồng.

Người chơi điều khiển Mây, người giữ đèn nhỏ tuổi của một hòn đảo giữa biển mây. Đêm nay sương đen đã nuốt hết ánh sáng của đảo. Mây phải chạy khắp đảo thu thập những đốm sáng (đom đóm) rồi mang về thắp lại các Đèn Lồng Lớn.

Trong bóng tối có Bóng Mực, những sinh vật bằng mực đen sống trong sương. Chúng đuổi theo Mây; bị chúng chạm vào thì mất máu. Mây có thể tỏa sáng để xua chúng đi, nhưng việc đó tốn ánh sáng. Bóng Mực sợ những chiếc đèn.

Thắp hết đèn thì thắng. Mất hết máu thì thua. Có điểm số.

## 2. Phạm vi Phase 1
- Một màn chơi: Đêm 1 – Đảo Bến, một hòn đảo tròn có 5 Đèn Lồng Lớn.
- Nhân vật đi lại, nhảy, camera 3D.
- Đom đóm xuất hiện rải rác trên đảo, nhặt được.
- Nạp ánh sáng vào đèn để thắp đèn.
- Bóng Mực xuất hiện và đuổi người chơi.
- Tỏa sáng để xua Bóng Mực.
- Thắng, thua, điểm số, giao diện hiển thị thông tin cần thiết (HUD).
- Có thể chơi lại sau khi thắng hoặc thua.

## 3. Cảm giác & phong cách
- Không khí đêm, ấm áp, cổ tích. Đảo sáng dần lên khi thắp đèn.
- Ánh sáng vàng cam ấm là thứ tốt. Màu tím đen là nguy hiểm.
- Đồ họa đơn giản nhưng đẹp, không cần chân thực.
- Mây đội nón lá có treo một chiếc đèn lồng nhỏ.
- Không bạo lực, không máu me.

Tự do sáng tạo (khuyến khích): nhân vật phụ, loại Bóng Mực/đom đóm khác, cơ chế nhỏ, sự kiện, câu chuyện, hiệu ứng, âm thanh... Không phá PRD-0 và Test Contract; phần thêm không được làm đổi đầu ra headless (thực thể thêm nên tắt khi headless). Ghi mục "Sáng tạo của tôi" trong README kèm bằng chứng ngắn rằng phần cũ vẫn đúng.

## 4. Công nghệ
Tự chọn. Phải chạy được trên macOS/Linux (Windows thì cần Docker hoặc bản web).

## 5. Bàn giao Phase 1 (tag `phase-1`)
- Game chơi được Đêm 1 từ đầu tới thắng/thua.
- README.md: cài đặt và chạy (tối đa 3 lệnh), điều khiển, cách tính điểm.
- `game.contract.json` + chế độ headless theo Test Contract v1.0.
- Bằng chứng + ghi chép ngắn (giả định, nhật ký dùng AI).
- Harness AI (AGENTS.md, skills, hooks...).

## 6. Lưu ý
Đúng yêu cầu > đẹp/phức tạp. Cân nhắc token. Không có bằng chứng thì chưa xong. Chỗ mơ hồ: tự giả định và ghi lại.

---

# Test Contract v1.0 (BẮT BUỘC, CHÍNH XÁC)

## A. `game.contract.json` ở gốc repo
```json
{
  "contract_version": "1.0",
  "team": "mssv-ho-ten",
  "build_cmd": "lệnh cài đặt/biên dịch",
  "run_cmd": "lệnh mở game có giao diện",
  "headless_cmd": "lệnh chạy headless (sẽ được nối thêm tham số)",
  "tuning": {
    "player_speed": 0, "carry_capacity": 0, "lantern_cost": 0, "lantern_count_night1": 5,
    "pickup_radius": 0, "interact_radius": 0, "pulse_cost": 0, "pulse_radius": 0,
    "night1_duration_s": 0, "flames": 0, "invuln_s": 0, "hit_drop_ratio": 0,
    "pulse_stun_s": 0, "pulse_push_m": 0, "pulse_cooldown_s": 0, "safe_radius": 0,
    "shade_speed": 0, "shade_hit_radius": 0, "fall_enabled": false,
    "score": { "per_mote": 0, "per_lantern": 0, "per_stun": 0, "per_second_left": 0, "per_flame_left": 0 }
  }
}
```
- tuning: điền đúng số game đang dùng. Không có khái niệm → `null` (hoặc `false`) và giải thích trong README. Test Phase 1 sinh tình huống dựa trên các số này.
- `hit_drop_ratio`: tỉ lệ đom đóm đánh rơi khi bị chạm (0 nếu không rơi). `safe_radius`: bán kính quanh đèn mà Bóng Mực không vào được. `fall_enabled`: rơi khỏi đảo có bị phạt không. `score.*`: điểm mỗi sự kiện.
- Lệnh phải chạy trên macOS/Linux sau `build_cmd`. Docker được phép.

## B. Tham số headless
```
<headless_cmd> --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>]
               --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]
```
- 60 tick/giây cố định (1 tick = 1/60 s), không cửa sổ, không GPU, nhanh nhất có thể.
- Dừng khi đủ `--ticks` hoặc khi game kết thúc (thắng/thua). Thoát mã 0.
- Lỗi → mã khác 0, thông báo ra stderr. File inputs/scenario sai định dạng → mã 2.
- Đơn vị mét; trục Y hướng lên; mặt đất Y = 0; người chơi xuất phát (0,0,0).

Mô hình tick:
- Snapshot tick 0 = trạng thái sau khi dựng scenario, trước khi áp input.
- Bước k (k = 0…N−1) đọc input tick k, tạo trạng thái k+1. Sự kiện trong bước đó ghi `tick = k+1`. `--ticks N` thực hiện đúng N bước.
- `time_left_s = thời lượng Đêm − (số bước đã chạy)/60`.

Quy ước vị trí:
- `player.pos` là chân nhân vật; `shade.pos` là tâm Bóng Mực; `lantern.pos` là chân cột đèn; vị trí đom đóm là điểm trên mặt đất.
- Mọi khoảng cách trong tuning đo trên mặt phẳng ngang XZ, không cộng kích thước. "Trong bán kính r" nghĩa là khoảng cách ≤ r.

## C. File inputs
```json
{ "frames": [
  { "tick": 0,   "move": [0, 1], "cam_yaw_deg": 0 },
  { "tick": 120, "move": [0, 0], "interact": true },
  { "tick": 121, "interact": false },
  { "tick": 200, "pulse": true },
  { "tick": 201, "pulse": false }
] }
```
- Mặc định trước frame đầu: move [0,0], cam_yaw_deg 0, mọi nút false.
- Frame chỉ đổi trường có mặt; trường vắng giữ giá trị cũ.
- `tick` các frame tăng nghiêm ngặt.
- `move: [x, z]`, mỗi thành phần trong [−1, 1]. θ = cam_yaw_deg (radian): x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ (θ=0: x là +X, z là +Z). Vector dài hơn 1 chuẩn hóa về 1.
- `jump`, `interact`, `pulse` (và `dash` nếu có): boolean, kích hoạt khi chuyển false → true.
- Không có file inputs = đứng yên.

## D. File scenario
```json
{
  "player": { "pos": [0, 0, 0], "carried": 0, "flames": 3 },
  "random_motes": false,
  "random_shades": false,
  "motes": [[0, 0, 5]],
  "shades": [{ "pos": [10, 0, 0] }],
  "lanterns": [{ "id": "L1", "pos": [0, 0, 25], "deposited": 0 }],
  "time_left_s": 300
}
```
- `random_motes: false`: không tự sinh đom đóm, chỉ có con được liệt kê.
- `random_shades: false`: không tự sinh Bóng Mực, chỉ có con được liệt kê (hoạt động bình thường ngay).
- `lanterns`: cập nhật theo id (L1…L5). Đèn không nhắc giữ nguyên; có pos thì đổi vị trí; có thể đặt `lit: true`.
- `motes`, `shades`: thay thế danh sách ban đầu; mảng rỗng = không có. `shades[]` có thể kèm `id`.
- Trường vắng → mặc định của game.
- Dựng scenario không phát sự kiện, không cộng điểm.

## E. Output JSONL
Snapshot mỗi `--snapshot-every` tick, từ tick 0:
```json
{"type":"snapshot","tick":120,"sim_tick":120,"state":"playing","time_left_s":298.0,"score":20,
 "player":{"pos":[0.0,0.0,12.0],"flames":3,"carried":2},
 "lanterns":[{"id":"L1","pos":[0,0,25],"lit":false,"deposited":0}],
 "shades":[{"id":"S1","pos":[30.1,1.0,2.0],"state":"chase"}],
 "motes_active":19}
```
Event ghi ngay khi xảy ra, ví dụ `{"type":"event","tick":131,"name":"mote_picked","data":{"carried":3}}`

| name | data |
|---|---|
| mote_picked | `{"carried": n}` |
| deposit | `{"lantern_id": "L1", "amount": n, "deposited": n}` |
| lantern_lit | `{"lantern_id": "L1"}` |
| pulse | `{"stunned_ids": ["S1"]}` |
| player_hit | `{"by": "shade" \| "fall", "flames": n, "dropped": n}` |
| shade_spawned | `{"id": "S3"}` |
| game_over | `{"result": "won" \| "lost", "reason": "all_lit" \| "dawn" \| "no_flames"}` |

End, dòng cuối, bắt buộc: `{"type":"end","ticks":4800,"state":"won","score":1730}`

- state ∈ playing, won, lost. Trạng thái Bóng Mực tối thiểu phải có `stunned`.
- Tọa độ làm tròn 3 chữ số thập phân.
- Tất định: cùng seed + scenario + inputs → output giống hệt, kể cả id tự sinh.
- `sim_tick` = số bước gameplay đã chạy (Phase 1 bằng tick).
- Mảng `motes` (id, pos) trong snapshot là khuyến nghị.
- Sự kiện không có trong game thì không ghi.

# Retro — Day 12 AI SDLC: Đảo Đèn Lồng

- **Học viên:** Nguyễn Hoàng Việt (`2A202603487` · `L3A`)
- **Repo:** `K5-L3A-DAY12-NguyenHoangViet-2A202603487-AI-SDLC-Dao-Den-Long`

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Mục tiêu | Kết quả & Số liệu | Bài học rút ra |
|---|---|---|---|
| **Phase 1** (`phase-1`) | PRD-0 + Contract v1.0 | Chốt tag đúng hạn `14:58` khi mới có khung dự án, harness, `game.contract.json` và giả định (core/headless v1.0 hoàn tất ngay sau hạn với `30/30` test pass). | Đoán nhầm mốc giờ bắt đầu lab; ghi nhận trung thực thay vì sửa tag sau hạn. |
| **Phase 2** (`phase-2`) | Ticket-02 (3 Đêm, chuẩn hóa v1.1) | **64/64 test pass**, benchmark Đêm 3 `21.600` tick hết `~139 ms`, đủ 3 Đêm + Web 3D + HUD + Web Audio. | Prompt quá lớn cho GLM tốn ~20p đọc và sót lỗi `canStand` / gió tick 1; chia song song Antigravity + Claude cứu kịp hạn `15:58`. |
| **Phase 3** (`phase-3`) | Ticket-03 Change Request (`fuel60`, `drain`, `dawn_survived`, v1.2) | **69/69 test pass**, có `ADR-001` và `CHANGELOG.md` breaking changes, sửa lỗi phím ngược + thanh dầu 3D + chế độ mù màu. Xong sớm 13 phút (`16:17`). | Không `/clear` + chia việc không đụng file (Antigravity làm Core/Tests, Claude/GLM làm `src/web/`) giảm ~70% token và tăng tốc gấp 3 lần. |
| **Phase 4** (`phase-4` + `v1.0.0`) | Ticket-04 (Bench, Soak, Leaderboard, Accessibility, Release, Video) | **73/73 test pass**, `soak.json` 10 Đêm `0` crash, `bench.json` 1280×720, đóng gói Three.js local chạy offline, Release `v1.0.0`. | Đóng gói offline (`three.module.js` local) và tách rõ cảnh benchmark giúp đo ổn định, không phụ thuộc mạng. |

## 2. Những lần AI sai & cách phát hiện / chỉnh Harness
1. **Chặn bước ra khỏi đảo (`src/core/world.js` Phase 2):** GLM viết `canStand` yêu cầu `g > -Infinity`, làm hỏng toàn bộ cơ chế rơi khỏi đảo và bục nhảy Đêm 2/3. *Phát hiện:* 23 test scenario đỏ. *Khắc phục:* đổi sang kiểm tra vách đứng `topG <= p.y + 0.5`.
2. **Gió Đêm 3 thổi ngay tick 1:** Công thức `simTick % 1800 < 300` kích hoạt gió ngay từ giây 0 thay vì sau 30 s, làm lệch vận tốc leo dốc Đêm 3. *Phát hiện:* test leo dốc Đêm 3 chỉ lên tới `Y=2.456` thay vì `3.0`.
3. **Dùng `node:fs` trong `src/core/config.js`:** Chạy tốt ở Node headless nhưng sẽ lỗi trên trình duyệt. *Khắc phục:* chuyển sang `import ... with { type: "json" }` và ghi thêm quy tắc cấm `node:fs` trong `src/core/` vào `AGENTS.md`.
4. **Phím `W/S/A/D` ngược & Spawn Đêm 3 dưới tầng 2:** Do camera đứng ở `-Z` nhìn `+Z` và tâm `(0,0,0)` Đêm 3 nằm dưới khối trụ tầng 2 `Y=6`. *Phát hiện:* chơi thử trực tiếp trên trình duyệt. *Khắc phục:* sửa ánh xạ phím trong `src/web/main.js` (giữ nguyên công thức yaw của core) và dời `MAPS[3].spawn` ra `[0, 0, -20]`.
5. **Quên truyền `--inputs` trong 7 test scenario Phase 2:** Khi viết hàng loạt test, GLM quên cờ `--inputs` khiến CLI chạy đứng yên. *Phát hiện:* đọc diff và log fail của `npm test`.

## 3. Harness nào giúp nhiều nhất?
- **`AGENTS.md` + `CLAUDE.md` (`@AGENTS.md`):** giữ kiến trúc tách 3 lớp (`core`/`web`/`headless`) xuyên suốt 4 phase mà không cần nhắc lại dài dòng.
- **`.githooks/pre-commit` + `.claude/settings.json` (Stop hook):** ép chạy `npm test` trước mỗi commit và chặn agent dừng khi test đỏ — ngăn hoàn toàn commit hỏng lên `main`.
- **Skill `/verify` & `scripts/proof.js`:** chuẩn hóa việc xuất bằng chứng thật khớp commit tag vào `docs/proof/phase-N/`.
- **GitHub Actions CI (`.github/workflows/ci.yml`):** xác nhận độc lập mọi push đều xanh trên Linux sạch.

## 4. Ước tính Token / Chi phí & Chiến lược tiết kiệm
| Phase | Antigravity | Claude Code + GLM (z.ai) | Tổng ước tính | Cách tiết kiệm |
|---|---:|---:|---:|---|
| CP0 + Phase 1 | ~40k | ~80k | ~120k | Dựng skeleton gọn không dependency ngoài |
| Phase 2 | ~60k | ~120k | ~180k | Chuyển thẳng lên v1.1 thay vì làm web v1.0 rồi viết lại |
| Phase 3 | ~35k | ~20k | ~55k | Không `/clear`, chia 2 tác vụ nhỏ song song không trùng file |
| Phase 4 | ~50k | ~30k | ~80k | Tận dụng core v1.2 có sẵn, chỉ bổ sung script bench/soak/leaderboard & UI |
| **Tổng** | **~185k** | **~250k** | **~435k** | Ước tính chi phí ~\$1.5–\$2.5 |

## 5. Nếu làm lại thì đổi gì?
1. **Xác nhận mốc giờ lab ngay phút đầu tiên** với Coach thay vì tự suy luận từ timestamp clone.
2. **Mở chơi thử trên trình duyệt sớm hơn** (ngay cuối Phase 2) để bắt lỗi UX (phím ngược, spawn Đêm 3) trước khi sang phase sau.
3. **Chia prompt nhỏ ngay từ Phase 2** (tách riêng bản đồ, thực thể, scenario) để GLM không bị chậm lúc đọc ngữ cảnh.

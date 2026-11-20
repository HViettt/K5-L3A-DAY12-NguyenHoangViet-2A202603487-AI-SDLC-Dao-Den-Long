# Phase 4 – TICKET-04 ("Bình minh: phát hành v1.0.0") + Contract v1.3

Spec: [docs/spec/ticket-04.md](../spec/ticket-04.md) · Retro tổng kết: [retro.md](./retro.md)

## Truy vết yêu cầu & kiểm chứng
| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P4-01 | Contract v1.3 (`bench_cmd`, `soak_cmd`) | `tests/phase4.test.js` | `game.contract.json`, `docs/proof/phase-4/test-report.txt` | Đạt |
| P4-02 | Benchmark 1280×720 (`--seed 42 --duration 30`) | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` | `bench.json` | Đạt |
| P4-03 | Soak test 10 Đêm (`crashes=0`, `RSS ≤ 1.2×`) | `node src/headless/soak.js --seed 7 --nights 10 --out soak.json` | `soak.json` (`crashes:0`, `44.8→51.7 MB`, `0.19 s`) | Đạt |
| P4-04 | Bảng xếp hạng cục bộ + `--export-leaderboard` | `tests/phase4.test.js` + UI menu/result | `docs/proof/phase-4/test-report.txt` | Đạt |
| P4-05 | Dễ tiếp cận (đổi 9 phím, phụ đề, giảm chuyển động, ≥18px + ×1.25) | `src/web/{index.html,main.js}` + test trình duyệt | `src/web/` | Đạt |
| P4-06 | Đóng gói offline + Sửa spawn Map 3 + Tài liệu + Retro | `src/web/vendor/three.module.js`, `README.md`, `CHANGELOG.md`, `CREDITS.md`, `retro.md` | Release `v1.0.0` | Đạt |
| P4-07 | Regression Phase 1–3 | `npm test` | `73/73 pass` | Đạt |

## Đánh giá phase
- **Đạt:** Toàn bộ yêu cầu chức năng & phi chức năng của TICKET-04 (73/73 test pass, `soak.json`, `bench.json`, bảng xếp hạng lưu đĩa, accessibility đầy đủ, đóng gói Three.js offline, Retro).
- **Phối hợp AI:** Chia 2 luồng song song không trùng file (Antigravity làm backend/scripts/soak/leaderboard/tests/docs; Claude Code + GLM làm `src/web/{index.html,main.js}`), hoàn thành nhanh và sạch.
- **Token ước tính:** ~80k (Antigravity ~50k + Claude/GLM ~30k).

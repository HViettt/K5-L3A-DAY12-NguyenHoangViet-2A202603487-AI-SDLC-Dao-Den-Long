// Cấu hình trung tâm của core: MỌI số luật chơi phải lấy từ đây.
// Tuning đọc từ game.contract.json (nguồn sự thật duy nhất — không hard-code số tuning ở chỗ khác).
// Các hằng dưới đây là "luật Phase 1" đã chốt trong docs/notes/phase-1.md (G1–G16), không thuộc tuning.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const contractPath = fileURLToPath(new URL("../../game.contract.json", import.meta.url));
export const CONTRACT = JSON.parse(readFileSync(contractPath, "utf8"));
export const TUNING = CONTRACT.tuning;

export const TICKS_PER_SECOND = 60;
export const DT = 1 / TICKS_PER_SECOND; // độ dài 1 bước mô phỏng (giây)

export const LAWS = {
  islandRadius: 40, // G1: đảo tròn bán kính 40 m
  lanternRingRadius: 25, // G2: 5 đèn trên vòng bán kính 25 m, L1 = (0,0,25)
  gravity: 20, // G4: trọng lực m/s²
  jumpVy: 6, // G4: vận tốc nhảy m/s
  randomMoteTarget: 30, // G11: mục tiêu số đom đóm
  randomMoteMinRadius: 3, // G11: đom đóm ngẫu nhiên ngoài bán kính 3 m quanh tâm
  randomMoteIntervalTicks: 3 * TICKS_PER_SECOND, // G11: cứ 3 s sinh thêm 1
  randomShadeStart: 2, // G11: bắt đầu 2 Bóng Mực ở mép đảo
  randomShadeMax: 6, // G11: tối đa 6 con
  randomShadeIntervalTicks: 30 * TICKS_PER_SECOND, // G11: cứ 30 s sinh thêm 1
};

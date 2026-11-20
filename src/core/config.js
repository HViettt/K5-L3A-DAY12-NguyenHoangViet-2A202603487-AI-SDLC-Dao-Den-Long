// Cấu hình trung tâm của core: tuning đọc từ game.contract.json (nguồn sự thật duy nhất),
// còn LAWS là "luật game" đã chốt trong Ticket-02 + docs/notes/phase-2.md (A2-1..A2-16),
// không thuộc tuning nên không nằm trong contract.
import CONTRACT_JSON from "../../game.contract.json" with { type: "json" };

export const CONTRACT = CONTRACT_JSON;
export const TUNING = CONTRACT.tuning;

export const TICKS_PER_SECOND = 60;
export const DT = 1 / TICKS_PER_SECOND; // độ dài 1 bước mô phỏng (giây)

export const LAWS = {
  // Vật lý
  gravity: 20, // Ticket-02 Phần 1: trọng lực −20 m/s²
  jumpVy: 7, // Ticket-02 Phần 1: nhảy vận tốc 7 m/s
  groundStep: 0.5, // A2-10: chỉ bước lên mặt đất cao hơn ≤ 0.5 m so với chân
  fallY: -10, // Ticket-02: rơi khỏi đảo khi Y < −10
  respawnWaitTicks: 60, // chờ 60 tick rồi hồi sinh
  // Lướt (dash)
  dashTicks: 12, // 0.2 s
  // Bùa Gió
  charmSpeed: 7.2,
  charmDurationTicks: 600,
  charmRespawnTicks: 2700,
  // Bóng Mực
  shadeWanderSpeed: 1.5, // A2-4
  shadeWanderReroll: 120, // A2-4: đổi hướng đi dạo mỗi 120 tick
  shadeSpawningTicks: 30, // A2-4: sinh xong ở trạng thái spawning 30 tick
  shadeDetect: 12, // phát hiện ≤ 12 m
  shadeLose: 18, // bỏ đuổi > 18 m
  shadeRecoilTicks: 60, // A2-6: gây hit xong lùi 2 m trong 60 tick
  shadeRecoilStep: 2 / 60,
  shadeSpawnStartTick: 300, // 2 con ở giây thứ 5
  shadeSpawnFirst: 2,
  shadeSpeedNight3: 4.5, // Ticket-02: Đêm 3 Bóng Mực 4.5 m/s
  shadeYOffset: 1.0, // A2-5: bóng lơ lửng groundY + 1.0
  // Bị đánh / rơi đom đóm
  hitDropTtlTicks: 480, // đom đóm rơi tồn tại 480 tick
  // Đom đóm
  moteInitial: 20, // 20 đom đóm lúc bắt đầu
  moteCap: 30, // trần 30
  moteSpawnEveryTicks: 240, // tick 240, 480, … sinh thêm 1
  // Gió Lạc
  driftSpeed: 7,
  driftIdleSpeed: 2,
  driftPatrolRadius: 3, // A2-11: lượn tròn bán kính 3 m quanh điểm xuất phát
  driftStealRadius: 1.2,
  driftChaseCarry: 5, // chase khi Mây mang ≥ 5
  driftChaseDist: 15,
  driftFleeTicks: 240,
  driftRemovedTicks: 120, // bị pulse lúc flee → biến mất sau 120 tick
  driftMax: 2,
  driftSpawnEveryTicks: 1200, // tick 1200, 2400, …
  driftYOffset: 1.2, // A2-11
  // Gió mạnh Đêm 3 (A2-9)
  windCycleTicks: 1800, // mỗi 30 s
  windActiveTicks: 300, // cơn gió kéo dài 5 s
  windWarnTicks: 120, // báo trước 2 s
  windSpeed: 2,
  // Tỏa Sáng
  pulsePushTicks: 15, // đẩy 4 m trong 15 tick đầu
  pulseCenterY: 0.8, // tâm = chân Mây + 0.8 m
};

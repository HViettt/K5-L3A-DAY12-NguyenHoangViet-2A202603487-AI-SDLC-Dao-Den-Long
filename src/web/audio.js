// Web Audio API synthesizer — không cần file âm thanh ngoài (nhạc nền đêm + 10 SFX theo Ticket-02).
export class SoundEngine {
  constructor(initialVolume = 0.6) {
    this.ctx = null;
    this.master = null;
    this.volume = initialVolume;
    this.bgmTimer = null;
    this.bgmIdx = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.startBgm();
    } else if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  tone(freq, dur, type = "sine", gain = 0.25, slideTo = null, delay = 0) {
    if (!this.ctx || !this.master || this.volume <= 0) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  startBgm() {
    if (this.bgmTimer) return;
    // Âm giai ngũ cung đêm dịu (D4, F4, G4, A4, C5, D5)
    const notes = [293.66, 349.23, 392.0, 440.0, 523.25, 440.0, 392.0, 349.23];
    this.bgmTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== "running" || this.volume <= 0) return;
      const f = notes[this.bgmIdx++ % notes.length];
      this.tone(f, 1.4, "sine", 0.045);
      if (this.bgmIdx % 4 === 0) this.tone(f / 2, 2.2, "triangle", 0.035);
    }, 1500);
  }

  // 10 SFX theo Ticket-02 Phần 3 + bổ sung nhẹ
  pickup() { this.tone(740, 0.12, "sine", 0.22, 1180); }
  deposit() { this.tone(523, 0.14, "triangle", 0.22, 659); }
  lanternLit() {
    this.tone(440, 0.28, "triangle", 0.25, null, 0);
    this.tone(554.37, 0.3, "triangle", 0.25, null, 0.1);
    this.tone(659.25, 0.45, "sine", 0.28, null, 0.2);
  }
  pulse() { this.tone(620, 0.32, "sine", 0.3, 180); this.tone(930, 0.22, "triangle", 0.15, 310); }
  hit() { this.tone(180, 0.28, "sawtooth", 0.28, 65); }
  jump() { this.tone(260, 0.14, "sine", 0.18, 520); }
  dash() { this.tone(480, 0.15, "triangle", 0.22, 920); }
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.25, null, i * 0.12));
  }
  lose() {
    [349.23, 311.13, 261.63, 196.0].forEach((f, i) => this.tone(f, 0.35, "sawtooth", 0.18, null, i * 0.14));
  }
  shadeSpawn() { this.tone(130, 0.4, "sawtooth", 0.14, 85); }
  countdown() { this.tone(880, 0.09, "square", 0.12); }
  charm() { this.tone(660, 0.16, "sine", 0.22, 990); this.tone(990, 0.22, "sine", 0.2, 1320, 0.08); }
  windWarn() { this.tone(240, 0.5, "sine", 0.1, 360); }
}

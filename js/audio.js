export const audioEngine = {
  ctx: null,
  fireGain: null,
  isFirePlaying: false,

  init() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e) { return; }
    if (!this.ctx) return;

    // 火焰噼啪噪声
    const fireBufSize = this.ctx.sampleRate * 4;
    const fireBuf = this.ctx.createBuffer(1, fireBufSize, this.ctx.sampleRate);
    const fireData = fireBuf.getChannelData(0);
    for (let i = 0; i < fireBufSize; i++) {
      const r = Math.random();
      const pulse = r > 0.85 ? (Math.random()*2-1)*1.5 : (r > 0.6 ? (Math.random()*2-1)*0.4 : (Math.random()*2-1)*0.08);
      fireData[i] = pulse;
    }
    const fireSrc = this.ctx.createBufferSource();
    fireSrc.buffer = fireBuf; fireSrc.loop = true;
    const fireFilter = this.ctx.createBiquadFilter();
    fireFilter.type = 'bandpass'; fireFilter.frequency.value = 2200; fireFilter.Q.value = 1.5;
    this.fireGain = this.ctx.createGain(); this.fireGain.gain.value = 0;
    fireSrc.connect(fireFilter); fireFilter.connect(this.fireGain);
    this.fireGain.connect(this.ctx.destination);
    fireSrc.start();
    this.fireSrc = fireSrc;
  },

  playMatchStrike() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const dur = 0.4;
    const src = this.ctx.createBufferSource();
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate*dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / this.ctx.sampleRate;
      const env = t < 0.05 ? t/0.05 : Math.exp(-8*(t-0.05));
      d[i] = (Math.random()*2-1) * env * 0.6;
    }
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 2.5;
    const g = this.ctx.createGain(); g.gain.value = 0.8;
    src.buffer = buf; src.connect(bp); bp.connect(g); g.connect(this.ctx.destination);
    src.start(now); src.stop(now+dur);
  },

  playTick() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const dur = 0.025;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / this.ctx.sampleRate / dur;
      const env = t < 0.15 ? t / 0.15 : Math.exp(-14 * (t - 0.15));
      d[i] = (Math.random() * 2 - 1) * env * 0.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2800 + Math.random() * 800; bp.Q.value = 1.8;
    const lpFilter = this.ctx.createBiquadFilter();
    lpFilter.type = 'lowpass'; lpFilter.frequency.value = 400 + Math.random() * 200;
    const lpGain = this.ctx.createGain(); lpGain.gain.value = 0.15;
    const dryGain = this.ctx.createGain(); dryGain.gain.value = 0.7;
    const outGain = this.ctx.createGain(); outGain.gain.value = 0.4;
    src.connect(bp); bp.connect(dryGain); dryGain.connect(outGain);
    src.connect(lpFilter); lpFilter.connect(lpGain); lpGain.connect(outGain);
    outGain.connect(this.ctx.destination);
    src.start(now); src.stop(now + dur);
  },

  playBell() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const dur = 4.5, sr = this.ctx.sampleRate, len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    // 高音 C5/E5/G5, 低音 C3 — 完全匹配原版 OscillatorNode 参数
    const voices = [
      { freq: 523.25, gain: 0.18, delay: 0,    decayTo: 0.001, decayEnd: 3.5 },
      { freq: 659.25, gain: 0.18, delay: 0.1,  decayTo: 0.001, decayEnd: 3.5 },
      { freq: 783.99, gain: 0.18, delay: 0.2,  decayTo: 0.001, decayEnd: 3.5 },
      { freq: 130.81, gain: 0.08, delay: 0.15, decayTo: 0.001, decayEnd: 4 },
    ];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let sample = 0;
      for (const v of voices) {
        const td = t - v.delay;
        if (td < 0) continue;
        const attackDur = 0.05;
        let env;
        if (td < attackDur) {
          env = td / attackDur;
        } else {
          const decayRate = -Math.log(v.decayTo / v.gain) / (v.decayEnd - attackDur);
          env = Math.exp(-decayRate * (td - attackDur));
        }
        sample += Math.sin(2 * Math.PI * v.freq * td) * v.gain * env;
      }
      d[i] = sample;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(this.ctx.currentTime);
  },

  playStamp() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const dur = 0.35, sr = this.ctx.sampleRate, len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // 主体：原版噪声盖章，清脆攻击
      const noiseEnv = t < 0.015 ? t / 0.015 : Math.exp(-20 * (t - 0.015));
      const noise = (Math.random() * 2 - 1) * noiseEnv * 0.55;
      // 厚重底座：100Hz 短促低频，增加分量感
      const lowEnv = t < 0.02 ? t / 0.02 : Math.exp(-25 * (t - 0.02));
      const low = Math.sin(2 * Math.PI * 100 * t) * lowEnv * 0.12;
      d[i] = noise + low;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.6;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.2;
    const lpGain = this.ctx.createGain(); lpGain.gain.value = 0.5;
    const bpGain = this.ctx.createGain(); bpGain.gain.value = 0.25;
    const outGain = this.ctx.createGain(); outGain.gain.value = 1.1;
    src.connect(lp); lp.connect(lpGain); lpGain.connect(outGain);
    src.connect(bp); bp.connect(bpGain); bpGain.connect(outGain);
    outGain.connect(this.ctx.destination);
    src.start(now); src.stop(now + dur);
  },

  playReveal() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const dur = 2.0;
    const sr = this.ctx.sampleRate;
    const bufLow = this.ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const dLow = bufLow.getChannelData(0);
    let last = 0;
    for (let i = 0; i < dLow.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      const t = i / sr;
      const env = t < 0.2 ? t / 0.2 : t > 1.4 ? Math.exp(-3 * (t - 1.4)) : 1;
      dLow[i] = last * 2.5 * env;
    }
    const srcLow = this.ctx.createBufferSource();
    srcLow.buffer = bufLow;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 180;
    const lpGain = this.ctx.createGain(); lpGain.gain.value = 0.25;
    srcLow.connect(lp); lp.connect(lpGain); lpGain.connect(this.ctx.destination);
    srcLow.start(now); srcLow.stop(now + dur);

    const bufHi = this.ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const dHi = bufHi.getChannelData(0);
    for (let i = 0; i < dHi.length; i++) {
      const t = i / sr;
      const env = t < 0.15 ? t / 0.15 : t > 1.5 ? Math.exp(-2.5 * (t - 1.5)) : 1;
      dHi[i] = (Math.random() * 2 - 1) * env * 0.35;
    }
    const srcHi = this.ctx.createBufferSource();
    srcHi.buffer = bufHi;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 3.5;
    const bpGain = this.ctx.createGain(); bpGain.gain.value = 0.08;
    srcHi.connect(bp); bp.connect(bpGain); bpGain.connect(this.ctx.destination);
    srcHi.start(now); srcHi.stop(now + dur);
  },

  playFire() {
    if (!this.ctx || this.isFirePlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.fireGain.gain.setTargetAtTime(0.18, this.ctx.currentTime, 0.2);
    this.isFirePlaying = true;
  },
  stopFire() {
    if (!this.ctx || !this.isFirePlaying) return;
    this.fireGain.gain.setTargetAtTime(0, this.ctx.currentTime, 1.5);
    this.isFirePlaying = false;
  }
};

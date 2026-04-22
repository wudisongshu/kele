/**
 * Web Audio API Synthesizer — generates game sounds without external files.
 *
 * Usage:
 *   const synth = new AudioSynth();
 *   synth.playJump();      // 跳跃音效
 *   synth.playCoin();      // 收集金币
 *   synth.playExplosion(); // 爆炸
 *   synth.playClick();     // UI 点击
 *   synth.playBGM();       // 简单背景循环
 */

class AudioSynth {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  _playTone(freq, type = 'square', duration = 0.1, volume = 0.1) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playJump() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playCoin() {
    this._playTone(987, 'sine', 0.08, 0.15);
    setTimeout(() => this._playTone(1318, 'sine', 0.15, 0.15), 60);
  }

  playExplosion() {
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }

  playClick() {
    this._playTone(800, 'sine', 0.05, 0.1);
  }

  playBGM() {
    // Simple ambient drone using two oscillators
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc2.frequency.setValueAtTime(222, this.ctx.currentTime);
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    osc1.start();
    osc2.start();
    // Return control object so caller can stop
    return {
      stop: () => {
        const now = this.ctx.currentTime;
        gain.gain.linearRampToValueAtTime(0, now + 1);
        osc1.stop(now + 1);
        osc2.stop(now + 1);
      },
    };
  }
}

// Auto-export for module or global use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioSynth };
} else {
  window.AudioSynth = AudioSynth;
}

let ac = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem('pa-muted') === '1'; } catch { /* storage unavailable */ }

export function unlockAudio() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    ac = new Ctx();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
  try { localStorage.setItem('pa-muted', m ? '1' : '0'); } catch { /* ignore */ }
}

function tone({ f = 440, f2 = 0, dur = 0.1, type = 'sine', vol = 0.2, delay = 0 }) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.2, freq = 1000, f2 = 0, q = 1, delay = 0 }) {
  if (!ac || muted) return;
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource(), filt = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf;
  filt.type = 'lowpass';
  filt.Q.value = q;
  filt.frequency.setValueAtTime(freq, t);
  if (f2) filt.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const lastPlayed = {};
function throttle(key, gap) {
  if (!ac) return false;
  const now = ac.currentTime;
  if (now - (lastPlayed[key] || 0) < gap) return false;
  lastPlayed[key] = now;
  return true;
}

const SHOOT = [
  () => { noise({ dur: 0.08, vol: 0.18, freq: 2500, f2: 600 }); tone({ f: 300, f2: 140, dur: 0.07, type: 'square', vol: 0.05 }); },
  () => { tone({ f: 200, f2: 90, dur: 0.14, type: 'triangle', vol: 0.18 }); noise({ dur: 0.1, vol: 0.12, freq: 900 }); },
  () => noise({ dur: 0.06, vol: 0.06, freq: 3000, f2: 1500, q: 4 }),
  () => { tone({ f: 1400, f2: 300, dur: 0.12, type: 'sawtooth', vol: 0.09 }); noise({ dur: 0.05, vol: 0.2, freq: 5000 }); },
  () => { tone({ f: 160, f2: 320, dur: 0.18, type: 'sine', vol: 0.22 }); },
  () => tone({ f: 1800, f2: 1600, dur: 0.05, type: 'sine', vol: 0.03 }),
  () => { tone({ f: 500, f2: 900, dur: 0.16, type: 'triangle', vol: 0.1 }); noise({ dur: 0.12, vol: 0.06, freq: 1800 }); },
];

export const sfx = {
  shoot(w) { if (throttle('shoot' + w, 0.05)) SHOOT[w](); },
  splat(size) { if (throttle('splat', 0.04)) noise({ dur: 0.1, vol: Math.min(0.2, 0.012 * size), freq: 900, f2: 250 }); },
  hit(dmg) {
    if (!throttle('hit', 0.05)) return;
    noise({ dur: 0.16, vol: 0.18 + Math.min(0.2, dmg / 150), freq: 1600, f2: 200 });
    tone({ f: 240, f2: 110, dur: 0.14, type: 'square', vol: 0.06 });
  },
  jump(air) { tone({ f: air ? 520 : 360, f2: air ? 980 : 640, dur: 0.12, type: 'triangle', vol: 0.1 }); },
  land() { noise({ dur: 0.07, vol: 0.12, freq: 400 }); },
  count() { tone({ f: 660, dur: 0.14, type: 'square', vol: 0.08 }); },
  go() { tone({ f: 880, dur: 0.1, type: 'square', vol: 0.09 }); tone({ f: 1320, dur: 0.28, type: 'square', vol: 0.09, delay: 0.1 }); },
  ko() { noise({ dur: 0.55, vol: 0.4, freq: 2400, f2: 120 }); tone({ f: 320, f2: 55, dur: 0.5, type: 'sawtooth', vol: 0.08 }); },
  round() { [523, 659, 784].forEach((f, i) => tone({ f, dur: 0.18, type: 'triangle', vol: 0.14, delay: 0.25 + i * 0.1 })); },
  match() { [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: i === 3 ? 0.5 : 0.16, type: 'square', vol: 0.08, delay: i * 0.13 })); },
  click() { tone({ f: 700, f2: 950, dur: 0.05, type: 'triangle', vol: 0.07 }); },
};

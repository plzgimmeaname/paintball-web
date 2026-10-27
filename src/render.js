import { W, H, ARENAS, WEAPONS, COLORS } from './data.js';
import { platformsOf } from './sim.js';

const RES = 2; // offscreen layers are drawn at 2x for crispness
const TAU = Math.PI * 2;
const INK = '#17162b';
const FONT = '"Fredoka", system-ui, sans-serif';

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function ellipse(c, x, y, rx, ry, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  c.fill();
}

function circle(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

const THEMES = {
  stadium: {
    top: '#76d35b', body: '#9b6a3f', bodyDark: '#6b4426', edge: '#3d2614',
    thin: '#e8eef9', thinTop: '#ffffff', thinDark: '#9aa7c2', thinEdge: '#3d4866',
    cloud: 'rgba(255,255,255,0.85)',
  },
  sunset: {
    top: '#f7b267', body: '#7a3f5a', bodyDark: '#4a2238', edge: '#2a0f22',
    thin: '#c9744f', thinTop: '#f0a274', thinDark: '#8a4630', thinEdge: '#3a1a14',
    cloud: 'rgba(255,190,200,0.55)',
  },
  night: {
    top: '#9aa3b5', body: '#5b627a', bodyDark: '#363b52', edge: '#151829',
    thin: '#4b5168', thinTop: '#7a8299', thinDark: '#2c3045', thinEdge: '#0e1020',
    hazard: true, stars: true,
  },
  forest: {
    top: '#5ccf7a', body: '#7b5b3a', bodyDark: '#4a3522', edge: '#2a1d10',
    thin: '#a77447', thinTop: '#c99566', thinDark: '#6d4826', thinEdge: '#2e1d0e',
    cloud: 'rgba(255,255,255,0.75)',
  },
};

function puffCloud(c, x, y, s) {
  ellipse(c, x, y, 34 * s, 16 * s);
  ellipse(c, x - 26 * s, y + 4 * s, 22 * s, 12 * s);
  ellipse(c, x + 28 * s, y + 5 * s, 24 * s, 11 * s);
  ellipse(c, x + 4 * s, y - 10 * s, 20 * s, 14 * s);
}

function hills(c, base, amp, color, f, ph) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    c.lineTo(x, base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.4);
  }
  c.lineTo(W, H);
  c.fill();
}

function pine(c, x, base, h) {
  for (let k = 0; k < 3; k++) {
    const w = h * (0.42 - k * 0.09), y = base - k * h * 0.26;
    c.beginPath();
    c.moveTo(x - w, y);
    c.lineTo(x, y - h * 0.48);
    c.lineTo(x + w, y);
    c.fill();
  }
  c.fillRect(x - 2, base, 4, 8);
}

const BACKGROUNDS = {
  stadium(c, r) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#36a9f7'); g.addColorStop(0.6, '#9fe0ff'); g.addColorStop(1, '#d9f6ff');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const sun = c.createRadialGradient(810, 80, 10, 810, 80, 140);
    sun.addColorStop(0, 'rgba(255,250,210,1)'); sun.addColorStop(0.25, 'rgba(255,240,170,0.8)'); sun.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = sun; c.fillRect(600, 0, 360, 260);
    c.fillStyle = '#26345f';
    c.beginPath(); c.moveTo(0, 270); c.lineTo(W, 270); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = '#1a2547'; c.fillRect(0, 256, W, 16);
    c.fillStyle = '#ffd166';
    for (let x = 10; x < W; x += 60) {
      c.beginPath(); c.moveTo(x, 256); c.lineTo(x + 24, 256); c.lineTo(x + 12, 236); c.fill();
      c.fillStyle = c.fillStyle === '#ffd166' ? '#ef476f' : '#ffd166';
    }
    const crowd = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#ffffff', '#c77dff'];
    for (let y = 284; y < 470; y += 13) {
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, y + 6, W, 3);
      for (let x = 4; x < W; x += 11) {
        if (r() < 0.12) continue;
        c.fillStyle = crowd[(r() * crowd.length) | 0];
        circle(c, x + r() * 3, y + r() * 2, 3.6);
      }
    }
    for (const lx of [70, 890]) {
      c.fillStyle = '#1a2547'; c.fillRect(lx - 3, 120, 6, 140);
      c.fillStyle = '#2b3a6b'; c.fillRect(lx - 26, 106, 52, 20);
      c.fillStyle = '#fff9d6';
      for (let k = 0; k < 4; k++) circle(c, lx - 18 + k * 12, 116, 4);
    }
    const ads = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0'];
    for (let x = 0, k = 0; x < W; x += 120, k++) {
      c.fillStyle = ads[k % ads.length]; c.fillRect(x, 470, 120, 30);
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `700 14px ${FONT}`; c.textAlign = 'center';
      c.fillText(k % 2 ? 'SPLAT!' : 'PAINT', x + 60, 490);
    }
    c.fillStyle = '#e9ecf5'; c.fillRect(0, 466, W, 5);
  },
  sunset(c, r) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b1055'); g.addColorStop(0.38, '#7b2869'); g.addColorStop(0.68, '#ff6b6b'); g.addColorStop(1, '#ffc371');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    for (let k = 0; k < 50; k++) circle(c, r() * W, r() * 160, r() * 1.2 + 0.3);
    const glow = c.createRadialGradient(480, 330, 40, 480, 330, 300);
    glow.addColorStop(0, 'rgba(255,220,150,0.7)'); glow.addColorStop(1, 'rgba(255,150,120,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    const sg = c.createLinearGradient(0, 210, 0, 450);
    sg.addColorStop(0, '#fff3b0'); sg.addColorStop(1, '#ff7e5f');
    c.fillStyle = sg; circle(c, 480, 330, 115);
    c.fillStyle = 'rgba(123,40,105,0.55)';
    for (let k = 0; k < 6; k++) c.fillRect(360, 330 + k * 16, 240, 3 + k * 1.4);
    hills(c, 360, 32, '#a83f6d', 0.006, 1);
    hills(c, 410, 26, '#6b2a5e', 0.009, 4);
    hills(c, 455, 16, '#3f1d4a', 0.013, 2);
    c.strokeStyle = 'rgba(40,10,40,0.7)'; c.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const bx = 150 + r() * 650, by = 90 + r() * 120, s = 4 + r() * 4;
      c.beginPath(); c.moveTo(bx - s, by - s * 0.6); c.quadraticCurveTo(bx - s * 0.4, by - s * 0.2, bx, by);
      c.quadraticCurveTo(bx + s * 0.4, by - s * 0.2, bx + s, by - s * 0.6); c.stroke();
    }
  },
  night(c, r) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060a24'); g.addColorStop(0.55, '#1f2462'); g.addColorStop(1, '#4a2f72');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff';
    for (let k = 0; k < 140; k++) { c.globalAlpha = 0.3 + r() * 0.7; circle(c, r() * W, r() * 320, r() * 1.3 + 0.2); }
    c.globalAlpha = 1;
    const mg = c.createRadialGradient(150, 100, 30, 150, 100, 120);
    mg.addColorStop(0, 'rgba(255,250,220,0.35)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
    c.fillStyle = mg; c.fillRect(0, 0, 320, 260);
    c.fillStyle = '#f4f1d0'; circle(c, 150, 100, 38);
    c.fillStyle = 'rgba(180,170,140,0.45)';
    circle(c, 138, 90, 8); circle(c, 162, 112, 6); circle(c, 160, 84, 4);
    const layer = (color, minH, maxH, winAlpha, winChance, jag) => {
      let x = -10;
      while (x < W) {
        const bw = 40 + r() * 60, bh = minH + r() * (maxH - minH), top = 500 - bh;
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(x, 500); c.lineTo(x, top);
        if (jag && r() < 0.6) {
          c.lineTo(x + bw * 0.3, top + 12 + r() * 20); c.lineTo(x + bw * 0.55, top - 6); c.lineTo(x + bw * 0.8, top + 18);
        }
        c.lineTo(x + bw, top); c.lineTo(x + bw, 500); c.fill();
        c.fillStyle = `rgba(255,216,107,${winAlpha})`;
        for (let wy = top + 24; wy < 490; wy += 16) {
          for (let wx = x + 6; wx < x + bw - 8; wx += 12) if (r() < winChance) c.fillRect(wx, wy, 6, 8);
        }
        x += bw + 2;
      }
    };
    layer('#1b2152', 140, 300, 0.35, 0.3, false);
    layer('#10133a', 80, 210, 0.75, 0.12, true);
    const fog = c.createLinearGradient(0, 360, 0, H);
    fog.addColorStop(0, 'rgba(140,110,220,0)'); fog.addColorStop(1, 'rgba(140,110,220,0.35)');
    c.fillStyle = fog; c.fillRect(0, 360, W, H - 360);
  },
  forest(c, r) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6cc6e8'); g.addColorStop(0.6, '#bfe9e0'); g.addColorStop(1, '#eaf8da');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const sun = c.createRadialGradient(180, 90, 10, 180, 90, 120);
    sun.addColorStop(0, 'rgba(255,255,230,1)'); sun.addColorStop(0.3, 'rgba(255,255,220,0.6)'); sun.addColorStop(1, 'rgba(255,255,220,0)');
    c.fillStyle = sun; c.fillRect(0, 0, 400, 260);
    const mountains = (base, color, snow, count, hMin, hMax) => {
      for (let k = 0; k < count; k++) {
        const mx = (k + r() * 0.6) * (W / (count - 1)) - 40, mh = hMin + r() * (hMax - hMin), mw = mh * (1.1 + r() * 0.5);
        c.fillStyle = color;
        c.beginPath(); c.moveTo(mx - mw, base); c.lineTo(mx, base - mh); c.lineTo(mx + mw, base); c.fill();
        if (snow) {
          c.fillStyle = 'rgba(255,255,255,0.9)';
          c.beginPath(); c.moveTo(mx, base - mh); c.lineTo(mx - mw * 0.22, base - mh * 0.78);
          c.lineTo(mx - mw * 0.07, base - mh * 0.82); c.lineTo(mx + mw * 0.06, base - mh * 0.74);
          c.lineTo(mx + mw * 0.22, base - mh * 0.78); c.fill();
        }
      }
    };
    mountains(380, '#9bb7d4', true, 6, 180, 260);
    mountains(420, '#6f93b8', false, 8, 90, 170);
    c.fillStyle = '#4c8f7a';
    for (let x = -10; x < W + 20; x += 22 + r() * 10) pine(c, x, 450 + r() * 10, 70 + r() * 40);
    c.fillStyle = '#2c6352';
    for (let x = 0; x < W + 20; x += 30 + r() * 14) pine(c, x, 500, 80 + r() * 50);
  },
};

const bgCache = {};
function backgroundFor(theme) {
  if (!bgCache[theme]) {
    const cv = mkCanvas(W * RES, H * RES), c = cv.getContext('2d');
    c.scale(RES, RES);
    BACKGROUNDS[theme](c, rng(theme.length * 7919 + 13));
    bgCache[theme] = cv;
  }
  return bgCache[theme];
}

function drawPlatforms(c, plats, th) {
  const r = rng(77);
  c.fillStyle = 'rgba(10,8,30,0.25)';
  for (const o of plats) { c.beginPath(); c.roundRect(o.x + 4, o.y + 8, o.w, o.h, 6); c.fill(); }
  for (const o of plats) {
    if (!o.oneWay) {
      const g = c.createLinearGradient(0, o.y, 0, o.y + Math.min(o.h, 120));
      g.addColorStop(0, th.body); g.addColorStop(1, th.bodyDark);
      c.fillStyle = g;
      c.beginPath(); c.roundRect(o.x, o.y, o.w, o.h, 6); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.13)';
      const n = (o.w * o.h) / 220;
      for (let k = 0; k < n; k++) c.fillRect(o.x + 4 + r() * (o.w - 8), o.y + 12 + r() * (o.h - 14), 3, 2);
      c.fillStyle = th.top;
      c.beginPath(); c.roundRect(o.x, o.y, o.w, 9, [6, 6, 2, 2]); c.fill();
      for (let x = o.x + 6; x < o.x + o.w - 4; x += 9 + r() * 6) circle(c, x, o.y + 9, 2 + r() * 2);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(o.x + 5, o.y + 2, o.w - 10, 2);
      c.strokeStyle = th.edge; c.lineWidth = 2;
      c.beginPath(); c.roundRect(o.x, o.y, o.w, o.h, 6); c.stroke();
    } else {
      c.fillStyle = th.thin;
      c.beginPath(); c.roundRect(o.x, o.y, o.w, o.h, 5); c.fill();
      c.save();
      c.beginPath(); c.roundRect(o.x, o.y, o.w, o.h, 5); c.clip();
      if (th.hazard) {
        c.fillStyle = '#ffcf33';
        for (let x = o.x - 20; x < o.x + o.w + 20; x += 18) {
          c.beginPath(); c.moveTo(x, o.y + o.h); c.lineTo(x + 9, o.y + o.h); c.lineTo(x + 19, o.y + 5); c.lineTo(x + 10, o.y + 5); c.fill();
        }
      } else {
        c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 1.5;
        for (let x = o.x + 40; x < o.x + o.w - 10; x += 40) { c.beginPath(); c.moveTo(x, o.y + 4); c.lineTo(x, o.y + o.h); c.stroke(); }
      }
      c.fillStyle = th.thinTop; c.fillRect(o.x, o.y, o.w, 5);
      c.fillStyle = th.thinDark; c.fillRect(o.x, o.y + o.h - 4, o.w, 4);
      c.restore();
      c.fillStyle = th.thinEdge;
      circle(c, o.x + 7, o.y + o.h / 2 + 1, 2); circle(c, o.x + o.w - 7, o.y + o.h / 2 + 1, 2);
      c.strokeStyle = th.thinEdge; c.lineWidth = 2;
      c.beginPath(); c.roundRect(o.x, o.y, o.w, o.h, 5); c.stroke();
    }
  }
}

function platformPath(plats) {
  const p = new Path2D();
  for (const o of plats) p.roundRect(o.x, o.y, o.w, o.h, 6);
  return p;
}

export function drawArenaThumb(cv, arenaId) {
  const a = ARENAS[arenaId], c = cv.getContext('2d');
  c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  c.drawImage(backgroundFor(a.theme), 0, 0, W, H);
  drawPlatforms(c, platformsOf(arenaId), THEMES[a.theme]);
}

function drawShot(c, look, x, y, vx, vy, age, col) {
  switch (look) {
    case 'ball':
      for (let t = 3; t >= 1; t--) {
        c.globalAlpha = 0.18 / t; c.fillStyle = col.main;
        circle(c, x - vx * t * 0.6, y - vy * t * 0.6, 6 * (1 - t * 0.12));
      }
      c.globalAlpha = 1; c.fillStyle = col.main; circle(c, x, y, 6);
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)'; circle(c, x - 2, y - 2, 2);
      break;
    case 'dodge':
      c.fillStyle = col.light; circle(c, x, y, 8);
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      c.strokeStyle = col.dark; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, 8, age * 0.3, age * 0.3 + Math.PI * 0.9); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.6)'; circle(c, x - 3, y - 3, 2.2);
      break;
    case 'drop':
      c.fillStyle = col.light; c.globalAlpha = 0.9;
      ellipse(c, x, y, 5.5, 3.5, Math.atan2(vy, vx));
      c.globalAlpha = 1;
      break;
    case 'bb': {
      const g = c.createLinearGradient(x - vx * 0.9, y - vy * 0.9, x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, col.light);
      c.strokeStyle = g; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - vx * 0.9, y - vy * 0.9); c.lineTo(x, y); c.stroke();
      c.fillStyle = '#e9ecef'; circle(c, x, y, 3.5);
      c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
      break;
    }
    case 'pancake':
      c.save(); c.translate(x, y); c.rotate(age * 0.25);
      c.fillStyle = '#b8743a'; ellipse(c, 0, 1.5, 12, 5.5);
      c.fillStyle = '#f2c27a'; ellipse(c, 0, -0.5, 12, 5);
      c.fillStyle = col.main; ellipse(c, 0, -1.5, 7, 2.6);
      c.fillStyle = '#fff3c4'; c.fillRect(-2.5, -4.5, 5, 3);
      c.restore();
      break;
    case 'laser': {
      const len = Math.hypot(vx, vy) || 1, ux = vx / len, uy = vy / len;
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = col.main; c.globalAlpha = 0.45; c.lineWidth = 7; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - ux * 30, y - uy * 30); c.lineTo(x, y); c.stroke();
      c.globalAlpha = 1; c.strokeStyle = '#fff'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(x - ux * 28, y - uy * 28); c.lineTo(x, y); c.stroke();
      c.globalCompositeOperation = 'source-over';
      break;
    }
    case 'frisbee':
      c.save(); c.translate(x, y); c.rotate(clamp(vy * 0.06, -0.5, 0.5));
      c.fillStyle = col.main; ellipse(c, 0, 0, 12, 4.5);
      c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      c.fillStyle = col.light; ellipse(c, Math.sin(age * 0.8) * 3, -0.5, 5, 2);
      c.restore();
      break;
  }
}

export function drawWeaponIcon(cv, wIdx, colorIdx) {
  const c = cv.getContext('2d'), s = cv.width / 40;
  c.setTransform(s, 0, 0, s, 0, 0);
  c.clearRect(0, 0, 40, 40);
  const look = WEAPONS[wIdx].look;
  const vx = look === 'laser' ? 30 : look === 'bb' ? 22 : 6;
  drawShot(c, look, look === 'laser' || look === 'bb' ? 32 : 22, 20, vx, 0, 3, COLORS[colorIdx]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.texts = [];
    this.shake = 0;
    this.time = 0;
    this.arenaId = null;
    this.anim = [this.freshAnim(), this.freshAnim()];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  freshAnim() { return { sx: 1, sy: 1, walk: 0, recoil: 0, rx: 0, ry: 0, init: false }; }

  resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    const cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    this.cv.style.width = cw + 'px';
    this.cv.style.height = ch + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(cw * dpr);
    this.cv.height = Math.round(ch * dpr);
    this.k = this.cv.width / W;
  }

  setArena(id) {
    if (this.arenaId !== id) {
      this.arenaId = id;
      const a = ARENAS[id];
      this.theme = THEMES[a.theme];
      this.bg = backgroundFor(a.theme);
      this.plats = platformsOf(id);
      this.platPath = platformPath(this.plats);
      this.base = mkCanvas(W * RES, H * RES);
      const bc = this.base.getContext('2d');
      bc.scale(RES, RES);
      drawPlatforms(bc, this.plats, this.theme);
      this.paintCv = mkCanvas(W * RES, H * RES);
      this.paintCtx = this.paintCv.getContext('2d');
      this.paintCtx.scale(RES, RES);
      const r = rng(id * 31);
      this.clouds = Array.from({ length: 6 }, () => ({ x: r() * W, y: 30 + r() * 160, s: 0.6 + r() * 0.8, v: 0.08 + r() * 0.15 }));
      this.twinkles = Array.from({ length: 24 }, () => ({ x: r() * W, y: r() * 300, p: r() * TAU }));
    }
    this.resetPaint();
    this.anim = [this.freshAnim(), this.freshAnim()];
  }

  resetPaint() {
    const c = this.paintCtx;
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.paintCv.width, this.paintCv.height);
    c.drawImage(this.base, 0, 0);
    c.restore();
    this.parts = [];
    this.texts = [];
  }

  splat(x, y, size, color, nx, ny) {
    const c = this.paintCtx;
    c.save();
    c.clip(this.platPath);
    c.fillStyle = color;
    c.globalAlpha = 0.95;
    if (ny) ellipse(c, x, y, size * 1.5, size * 0.75);
    else ellipse(c, x, y, size * 0.75, size * 1.4);
    const n = 5 + size / 2;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, d = size * (0.7 + Math.random() * 1.2);
      circle(c, x + Math.cos(a) * d * (ny ? 1.3 : 0.7), y + Math.sin(a) * d * (ny ? 0.6 : 1.2), size * (0.12 + Math.random() * 0.3));
    }
    c.globalAlpha = 0.35; c.fillStyle = '#fff';
    circle(c, x - size * 0.35, y - size * 0.25, size * 0.28);
    c.restore();
  }

  burst(x, y, color, n, speed, dirx = 0, diry = 0, life = 34) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, sp = speed * (0.3 + Math.random() * 0.8);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp + dirx, vy: Math.sin(a) * sp + diry - 1.5,
        life: life * (0.6 + Math.random() * 0.6), max: life, r: 2 + Math.random() * 3, color, kind: 'drop',
      });
    }
  }

  puff(x, y, n) {
    for (let k = 0; k < n; k++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 0.8,
        life: 22, max: 22, r: 4 + Math.random() * 4, color: '#ffffff', kind: 'puff',
      });
    }
  }

  handle(e) {
    switch (e.e) {
      case 'shoot': {
        this.anim[e.i].recoil = 1;
        const col = COLORS[e.i];
        for (let k = 0; k < 3; k++) {
          this.parts.push({ x: e.x, y: e.y, vx: e.d * (2 + Math.random() * 3), vy: (Math.random() - 0.5) * 2, life: 8, max: 8, r: 2.5, color: col.light, kind: 'spark' });
        }
        break;
      }
      case 'splat': {
        const col = COLORS[e.o];
        this.splat(e.x, e.y, e.s, col.main, e.nx, e.ny);
        const n = Math.min(8, 2 + (e.s / 3) | 0);
        this.burst(e.x, e.y, col.main, n, 2.5, e.nx * 2, e.ny * 2.5, 26);
        break;
      }
      case 'hit': {
        const col = COLORS[e.o];
        this.burst(e.x, e.y, col.main, Math.min(14, 4 + e.d / 3), 3.5, 0, 0, 30);
        this.shake = Math.min(12, this.shake + 1 + e.d * 0.18);
        const a = this.anim[e.t];
        a.sx = 1.18; a.sy = 0.86;
        if (e.d >= 10) this.texts.push({ x: e.x, y: e.y - 10, text: '+' + Math.round(e.d), color: col.main, life: 45 });
        break;
      }
      case 'ko': {
        const col = COLORS[1 - e.i];
        this.burst(e.x, e.y, col.main, 40, 7, 0, -2, 50);
        this.burst(e.x, e.y, '#ffffff', 10, 5, 0, -2, 30);
        this.shake = 16;
        break;
      }
      case 'jump': {
        const a = this.anim[e.i];
        a.sx = 0.8; a.sy = 1.22;
        this.puff(e.x, e.y, e.air ? 5 : 3);
        break;
      }
      case 'land': {
        const a = this.anim[e.i];
        a.sx = 1.25; a.sy = 0.78;
        this.puff(e.x, e.y, 4);
        break;
      }
      case 'reset':
        this.resetPaint();
        break;
    }
  }

  update() {
    this.time++;
    this.shake *= 0.85;
    for (const a of this.anim) {
      a.sx += (1 - a.sx) * 0.2;
      a.sy += (1 - a.sy) * 0.2;
      a.recoil *= 0.75;
    }
    for (const cl of this.clouds || []) { cl.x += cl.v; if (cl.x > W + 80) cl.x = -80; }
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const p = this.parts[k];
      p.x += p.vx; p.y += p.vy;
      if (p.kind === 'drop') { p.vy += 0.3; p.vx *= 0.98; }
      else if (p.kind === 'puff') { p.vx *= 0.9; p.r += 0.25; }
      if (--p.life <= 0) this.parts.splice(k, 1);
    }
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
    for (let k = this.texts.length - 1; k >= 0; k--) {
      const t = this.texts[k];
      t.y -= 0.7;
      if (--t.life <= 0) this.texts.splice(k, 1);
    }
  }

  draw(s, opt) {
    const c = this.ctx;
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    c.drawImage(this.bg, 0, 0, W, H);
    this.drawSky(c);

    c.save();
    if (this.shake > 0.3) c.translate((Math.random() * 2 - 1) * this.shake, (Math.random() * 2 - 1) * this.shake);
    c.drawImage(this.paintCv, 0, 0, W, H);

    s.players.forEach((p, i) => {
      const a = this.anim[i];
      const far = Math.abs(p.x - a.rx) + Math.abs(p.y - a.ry) > 70;
      if (!opt.smooth || !a.init || far) { a.rx = p.x; a.ry = p.y; a.init = true; }
      else { a.rx += (p.x - a.rx) * 0.45; a.ry += (p.y - a.ry) * 0.45; }
      if (p.onGround) a.walk += Math.abs(p.vx) * 0.13;
      this.drawShadow(c, p, a);
    });
    for (const q of s.projectiles) drawShot(c, WEAPONS[q.w].look, q.x, q.y, q.vx, q.vy, q.a, COLORS[q.o]);
    s.players.forEach((p, i) => this.drawPlayer(c, p, i, this.anim[i], opt.tags && opt.tags[i]));
    this.drawParticles(c);
    c.restore();

    if (opt.hud) {
      this.drawHud(c, s, opt);
      this.drawCenter(c, s, opt);
    }
  }

  drawSky(c) {
    if (this.theme.stars) {
      c.fillStyle = '#fff';
      for (const t of this.twinkles) {
        c.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(this.time * 0.03 + t.p));
        circle(c, t.x, t.y, 1.4);
      }
      c.globalAlpha = 1;
    } else if (this.theme.cloud) {
      c.fillStyle = this.theme.cloud;
      for (const cl of this.clouds) puffCloud(c, cl.x, cl.y, cl.s);
    }
  }

  drawShadow(c, p, a) {
    const feet = a.ry + p.h, cx = a.rx + p.w / 2;
    let gy = null;
    for (const o of this.plats) {
      if (cx < o.x || cx > o.x + o.w || o.y < feet - 2) continue;
      if (gy === null || o.y < gy) gy = o.y;
    }
    if (gy === null) return;
    const d = clamp((gy - feet) / 200, 0, 1);
    c.fillStyle = `rgba(10,8,30,${0.3 * (1 - d)})`;
    ellipse(c, cx, gy + 1, 16 * (1 - d * 0.5), 4 * (1 - d * 0.5));
  }

  drawPlayer(c, p, i, a, tag) {
    const col = COLORS[i], foe = COLORS[1 - i];
    const ko = p.paint >= 100;
    const cx = a.rx + p.w / 2, by = a.ry + p.h;
    const w = p.w + 4, h = p.h + 2, d = p.dir;
    c.save();
    c.translate(cx, by);
    c.rotate(clamp(p.vx * 0.025, -0.14, 0.14) + (ko ? d * -0.35 : 0));
    c.scale(a.sx, a.sy);
    const step = p.onGround && Math.abs(p.vx) > 0.5 ? Math.sin(a.walk) * 4 : 0;
    c.fillStyle = INK;
    ellipse(c, -7 + step, -3, 7, 4.5);
    ellipse(c, 7 - step, -3, 7, 4.5);
    const body = new Path2D();
    body.roundRect(-w / 2, -h, w, h - 3, [15, 15, 10, 10]);
    const g = c.createLinearGradient(0, -h, 0, 0);
    g.addColorStop(0, col.light); g.addColorStop(0.45, col.main); g.addColorStop(1, col.dark);
    c.fillStyle = g;
    c.fill(body);

    // opponent's paint sticks to you
    c.save();
    c.clip(body);
    const r = rng(i * 977 + 5);
    const blobs = Math.floor(p.paint / 6);
    c.fillStyle = foe.main;
    for (let k = 0; k < blobs; k++) {
      const bx = (r() - 0.5) * w, byy = -r() * h, rad = 3 + r() * 6;
      circle(c, bx, byy, rad);
      c.fillRect(bx - 1.5, byy, 3, rad + r() * 8);
    }
    if (p.hitFlash > 0) { c.fillStyle = `rgba(255,255,255,${p.hitFlash / 10})`; c.fill(body); }
    c.restore();
    c.lineWidth = 3; c.strokeStyle = INK; c.stroke(body);
    c.fillStyle = 'rgba(255,255,255,0.3)';
    ellipse(c, -w / 2 + 9, -h + 8, 5, 3, -0.4);
    const bandY = -h + 10;
    c.strokeStyle = INK; c.lineWidth = 3.5; c.lineCap = 'round';
    const flap = Math.sin(this.time * 0.3 + i) * 3;
    c.beginPath();
    c.moveTo(-d * (w / 2 - 1), bandY + 4);
    c.quadraticCurveTo(-d * (w / 2 + 8), bandY + flap, -d * (w / 2 + 14), bandY + 6 + flap);
    c.stroke();
    c.fillStyle = INK;
    c.beginPath(); c.roundRect(-w / 2 + 1, bandY - 1, w - 2, 11, 3); c.fill();
    const ex = d * 5, ey = bandY + 4.5;
    if (ko) {
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      for (const ox of [-6, 6]) {
        c.beginPath();
        c.moveTo(ex + ox - 3, ey - 3); c.lineTo(ex + ox + 3, ey + 3);
        c.moveTo(ex + ox + 3, ey - 3); c.lineTo(ex + ox - 3, ey + 3);
        c.stroke();
      }
    } else if (p.hitFlash > 3) {
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      for (const ox of [-6, 6]) { c.beginPath(); c.moveTo(ex + ox - 3.5, ey); c.lineTo(ex + ox + 3.5, ey); c.stroke(); }
    } else {
      c.fillStyle = '#fff';
      circle(c, ex - 6, ey, 4.2); circle(c, ex + 6, ey, 4.2);
      c.fillStyle = INK;
      circle(c, ex - 6 + d * 1.6, ey + 0.5, 2.1); circle(c, ex + 6 + d * 1.6, ey + 0.5, 2.1);
    }
    if (!ko) {
      const wpn = WEAPONS[p.weapon];
      const gx = d * (w / 2 - 6) - d * a.recoil * 5, gy = -h * 0.42;
      c.save();
      c.translate(gx, gy);
      c.scale(d, 1);
      c.rotate(-a.recoil * 0.25);
      c.fillStyle = wpn.gun; c.strokeStyle = INK; c.lineWidth = 2;
      c.beginPath(); c.roundRect(0, -4, 18, 8, 3); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(2, 2, 5, 7, 2); c.fill(); c.stroke();
      c.fillStyle = INK; c.fillRect(16, -2.5, 4, 5);
      c.restore();
    }
    c.restore();

    if (tag) {
      const ty = a.ry - 20 - (ko ? 0 : Math.abs(Math.sin(this.time * 0.08)) * 2);
      c.font = `700 11px ${FONT}`;
      const tw = c.measureText(tag).width + 12;
      c.fillStyle = col.dark;
      c.beginPath(); c.roundRect(cx - tw / 2, ty - 9, tw, 15, 7); c.fill();
      c.beginPath(); c.moveTo(cx - 4, ty + 6); c.lineTo(cx + 4, ty + 6); c.lineTo(cx, ty + 10); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(tag, cx, ty - 1);
    }
  }

  drawParticles(c) {
    for (const p of this.parts) {
      const t = p.life / p.max;
      if (p.kind === 'puff') {
        c.fillStyle = `rgba(255,255,255,${0.5 * t})`;
        circle(c, p.x, p.y, p.r);
      } else {
        c.fillStyle = p.color;
        circle(c, p.x, p.y, Math.max(0.5, p.r * Math.sqrt(t)));
      }
    }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 18px ${FONT}`;
    for (const t of this.texts) {
      c.globalAlpha = Math.min(1, t.life / 15);
      c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(t.text, t.x, t.y);
      c.fillStyle = t.color; c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
  }

  drawHud(c, s, opt) {
    const PWID = 300, PH = 64;
    for (let i = 0; i < 2; i++) {
      const col = COLORS[i], foe = COLORS[1 - i], p = s.players[i];
      const x = i === 0 ? 14 : W - 14 - PWID, y = 12, left = i === 0;
      c.fillStyle = 'rgba(14,14,34,0.78)';
      c.beginPath(); c.roundRect(x, y, PWID, PH, 14); c.fill();
      c.strokeStyle = col.main; c.lineWidth = 2; c.stroke();

      c.textBaseline = 'alphabetic';
      c.textAlign = left ? 'left' : 'right';
      const tx = left ? x + 14 : x + PWID - 14;
      c.fillStyle = '#fff'; c.font = `700 17px ${FONT}`;
      c.fillText(opt.names[i], tx, y + 24);
      const nameW = c.measureText(opt.names[i]).width;
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.font = `500 13px ${FONT}`;
      c.fillText(WEAPONS[p.weapon].name, left ? tx + nameW + 8 : tx - nameW - 8, y + 24);
      const n = s.cfg.firstTo;
      for (let k = 0; k < n; k++) {
        const px = left ? x + PWID - 16 - k * 15 : x + 16 + k * 15;
        c.beginPath(); c.arc(px, y + 19, 5, 0, TAU);
        if (s.scores[i] > k) { c.fillStyle = col.main; c.fill(); }
        c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.5; c.stroke();
      }

      // meter fills with the opponent's color
      const mx = x + 14, my = y + 36, mw = PWID - 28, mh = 16;
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.beginPath(); c.roundRect(mx, my, mw, mh, 8); c.fill();
      const frac = clamp(p.paint / 100, 0, 1);
      if (frac > 0) {
        const fw = Math.max(mh, mw * frac), fx = left ? mx : mx + mw - fw;
        const danger = frac > 0.7 ? 0.25 * (1 + Math.sin(this.time * 0.3)) : 0;
        const g = c.createLinearGradient(0, my, 0, my + mh);
        g.addColorStop(0, foe.light); g.addColorStop(1, foe.main);
        c.fillStyle = g;
        c.beginPath(); c.roundRect(fx, my, fw, mh, 8); c.fill();
        if (danger) { c.fillStyle = `rgba(255,255,255,${danger})`; c.fill(); }
        c.save(); c.clip();
        c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 4;
        for (let sx = fx - 20 + ((this.time * 0.5) % 14); sx < fx + fw + 20; sx += 14) {
          c.beginPath(); c.moveTo(sx, my + mh); c.lineTo(sx + 10, my); c.stroke();
        }
        c.restore();
      }
      c.fillStyle = '#fff'; c.font = `700 11px ${FONT}`; c.textBaseline = 'middle';
      c.textAlign = left ? 'right' : 'left';
      c.fillText(`PAINT ${Math.round(p.paint)}%`, left ? mx + mw - 8 : mx + 8, my + mh / 2 + 1);
    }
    const secs = Math.max(0, Math.ceil(s.timeLeft / 60));
    const low = secs <= 10 && s.phase === 'play';
    const pulse = low ? 1 + 0.08 * Math.abs(Math.sin(this.time * 0.15)) : 1;
    c.save();
    c.translate(W / 2, 34);
    c.scale(pulse, pulse);
    c.fillStyle = low ? '#e63946' : 'rgba(14,14,34,0.78)';
    c.beginPath(); c.roundRect(-42, -22, 84, 44, 14); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 24px ${FONT}`;
    c.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 0, 1);
    c.restore();
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `700 11px ${FONT}`; c.textAlign = 'center';
    c.fillText(`ROUND ${s.round}`, W / 2, 68);
  }

  bigText(c, text, x, y, size, fill, scale = 1, alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    c.scale(scale, scale);
    c.font = `700 ${size}px ${FONT}`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.16; c.strokeStyle = INK;
    c.strokeText(text, 0, 0);
    c.fillStyle = fill; c.fillText(text, 0, 0);
    c.restore();
  }

  drawCenter(c, s, opt) {
    if (s.phase === 'countdown') {
      const n = Math.ceil(s.timer / 60), f = (s.timer % 60) / 60;
      c.fillStyle = 'rgba(10,8,30,0.25)'; c.fillRect(0, 0, W, H);
      this.bigText(c, String(n), W / 2, H / 2 - 10, 110, '#ffd166', 1 + f * 0.5, Math.min(1, 0.3 + f * 1.4));
      if (s.round === 1 || n === 3) this.bigText(c, `ROUND ${s.round}`, W / 2, H / 2 - 100, 30, '#fff');
    } else if (s.phase === 'play') {
      const since = s.cfg.roundTime * 60 - s.timeLeft;
      if (since < 45) {
        const f = since / 45;
        this.bigText(c, 'PAINT!', W / 2, H / 2 - 10, 100, '#06d6a0', 1 + f * 0.4, 1 - f);
      }
    } else if (s.phase === 'roundEnd') {
      const elapsed = 150 - s.timer, f = clamp(elapsed / 12, 0, 1);
      const w = s.roundWinner;
      const col = w >= 0 ? COLORS[w] : { main: '#cfd2e6', dark: '#4b4f72' };
      const [r, g, b] = hexToRgb(col.dark);
      c.fillStyle = `rgba(${r},${g},${b},${0.85 * f})`;
      c.fillRect(0, H / 2 - 64 * f, W, 128 * f);
      c.fillStyle = `rgba(255,255,255,${0.6 * f})`;
      c.fillRect(0, H / 2 - 64 * f, W, 3); c.fillRect(0, H / 2 + 64 * f - 3, W, 3);
      if (f >= 1) {
        const title = w < 0 ? 'DRAW!' : `${opt.roundNames[w]} TAKE${opt.roundNames[w] === 'YOU' ? '' : 'S'} THE ROUND`;
        this.bigText(c, title, W / 2, H / 2 - 12, 48, '#fff');
        const sub = s.reason === 'ko' ? 'Totally splattered!' : "Time's up! Least painted wins.";
        c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `600 18px ${FONT}`;
        c.textAlign = 'center'; c.fillText(sub, W / 2, H / 2 + 34);
      }
    }
  }
}

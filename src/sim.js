import { W, H, GRAVITY, ARENAS, WEAPONS, ROUND_SECONDS } from './data.js';

const PW = 30, PH = 34;
const RUN = 5.6, JUMP_V = -14.5, AIR_JUMP_V = -12, MAX_FALL = 13;
export const COUNTDOWN_TICKS = 180;
export const ROUND_END_TICKS = 150;
export const NO_INPUT = { l: 0, r: 0, j: 0, f: 0, jp: 0 };

const platCache = {};
export function platformsOf(arenaId) {
  if (!platCache[arenaId]) {
    platCache[arenaId] = ARENAS[arenaId].platforms.map(([x, y, w, h]) => ({ x, y, w, h, oneWay: h <= 20 }));
  }
  return platCache[arenaId];
}

function makePlayer(i, cfg, lastJp) {
  const [sx, sy] = ARENAS[cfg.arenaId].spawns[i];
  return {
    x: sx, y: sy, w: PW, h: PH, vx: 0, vy: 0, dir: i === 0 ? 1 : -1,
    onGround: true, airJumps: 1, coyote: 0, jumpBuf: 0, lastJp,
    paint: 0, cooldown: 0, weapon: cfg.weapons[i], hitFlash: 0, shotTick: -99,
  };
}

export function createMatch(cfg) {
  const s = {
    cfg: { roundTime: ROUND_SECONDS, ...cfg },
    tick: 0, phase: 'countdown', timer: COUNTDOWN_TICKS, timeLeft: 0,
    scores: [0, 0], round: 1, roundWinner: -1, matchWinner: -1, reason: '',
    players: [], projectiles: [], events: [],
  };
  resetRound(s);
  return s;
}

function resetRound(s) {
  s.players = [0, 1].map(i => makePlayer(i, s.cfg, s.players[i] ? s.players[i].lastJp : 0));
  s.projectiles = [];
  s.phase = 'countdown';
  s.timer = COUNTDOWN_TICKS;
  s.timeLeft = s.cfg.roundTime * 60;
  s.roundWinner = -1;
  s.reason = '';
  s.events.push({ e: 'reset' });
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function circleRect(cx, cy, r, o) {
  const nx = Math.max(o.x, Math.min(cx, o.x + o.w));
  const ny = Math.max(o.y, Math.min(cy, o.y + o.h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}

export function step(s, inputs, auth) {
  s.tick++;
  const emit = auth ? e => s.events.push(e) : () => {};
  const plats = platformsOf(s.cfg.arenaId);
  for (let i = 0; i < 2; i++) {
    updatePlayer(s, s.players[i], i, inputs[i] || NO_INPUT, plats, auth, emit);
  }
  updateProjectiles(s, plats, auth, emit);
  if (auth) updatePhase(s, emit);
}

function updatePlayer(s, p, i, inp, plats, auth, emit) {
  const alive = p.paint < 100;
  const canMove = s.phase !== 'countdown' && alive;
  if (p.hitFlash > 0) p.hitFlash--;
  if (p.cooldown > 0) p.cooldown--;

  // jump presses arrive as a counter so quick taps are never lost
  if (auth) {
    if (inp.jp !== p.lastJp) {
      p.lastJp = inp.jp;
      if (canMove) p.jumpBuf = 8;
    } else if (p.jumpBuf > 0) {
      p.jumpBuf--;
    }
  }

  const want = canMove ? (inp.r ? 1 : 0) - (inp.l ? 1 : 0) : 0;
  if (want !== 0) p.dir = want;
  const accel = p.onGround ? 1.1 : 0.7;
  p.vx += Math.max(-accel, Math.min(accel, want * RUN - p.vx));
  p.x += p.vx;
  for (const o of plats) {
    if (o.oneWay || !overlaps(p, o)) continue;
    if (p.vx > 0) p.x = o.x - p.w;
    else if (p.vx < 0) p.x = o.x + o.w;
    p.vx = 0;
  }
  if (p.x < 0) { p.x = 0; p.vx = Math.max(0, p.vx); }
  if (p.x > W - p.w) { p.x = W - p.w; p.vx = Math.min(0, p.vx); }
  if (p.coyote > 0) p.coyote--;
  if (p.jumpBuf > 0) {
    if (p.onGround || p.coyote > 0) {
      p.vy = JUMP_V;
      p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
      emit({ e: 'jump', i, x: p.x + p.w / 2, y: p.y + p.h, air: 0 });
    } else if (p.jumpBuf === 8 && p.airJumps > 0) {
      p.airJumps--;
      p.vy = AIR_JUMP_V;
      p.jumpBuf = 0;
      emit({ e: 'jump', i, x: p.x + p.w / 2, y: p.y + p.h, air: 1 });
    }
  }
  if (!inp.j && p.vy < -3) p.vy += 0.8; // let go early for a short hop
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
  const prevBottom = p.y + p.h, prevTop = p.y, fallSpeed = p.vy;
  p.y += p.vy;
  const wasGround = p.onGround;
  p.onGround = false;
  for (const o of plats) {
    if (p.x + p.w <= o.x || p.x >= o.x + o.w) continue;
    if (p.vy >= 0 && prevBottom <= o.y + 0.01 && p.y + p.h >= o.y) {
      p.y = o.y - p.h; p.vy = 0; p.onGround = true;
    } else if (!o.oneWay && p.vy < 0 && prevTop >= o.y + o.h - 0.01 && p.y < o.y + o.h) {
      p.y = o.y + o.h; p.vy = 0;
    }
  }
  if (p.onGround) {
    p.airJumps = 1;
    p.coyote = 6;
    if (!wasGround && fallSpeed > 4) emit({ e: 'land', i, x: p.x + p.w / 2, y: p.y + p.h, v: fallSpeed });
  }

  // falling off the map paints you out
  if (auth && p.y > H + 80 && alive && s.phase === 'play') p.paint = 100;

  if (auth && canMove && s.phase === 'play' && inp.f && p.cooldown === 0) fire(s, p, i, emit);
}

function fire(s, p, i, emit) {
  const w = WEAPONS[p.weapon];
  p.cooldown = w.rate;
  p.shotTick = s.tick;
  const mx = p.x + p.w / 2 + p.dir * 20, my = p.y + p.h / 2 + 2;
  for (let k = 0; k < w.pellets; k++) {
    let ang = w.pellets > 1 ? -w.fan + (2 * w.fan * k) / (w.pellets - 1) : 0;
    ang += (Math.random() * 2 - 1) * w.spread - w.lift;
    s.projectiles.push({
      x: mx, y: my,
      vx: Math.cos(ang) * w.speed * p.dir + p.vx * 0.3,
      vy: Math.sin(ang) * w.speed,
      o: i, w: p.weapon, b: w.bounces, a: 0,
    });
  }
  emit({ e: 'shoot', i, w: p.weapon, x: mx, y: my, d: p.dir });
}

function updateProjectiles(s, plats, auth, emit) {
  const list = s.projectiles;
  for (let n = list.length - 1; n >= 0; n--) {
    const q = list[n], w = WEAPONS[q.w];
    q.a++;
    q.vy += w.grav;
    if (w.wobble) q.vy += Math.sin(q.a * 0.25) * w.wobble;
    let dead = q.a > w.life;
    const tr = w.r * 0.6; // smaller radius vs terrain feels fairer
    // sub-step so fast shots can't tunnel through thin platforms
    const steps = Math.max(1, Math.ceil(Math.hypot(q.vx, q.vy) / 5));
    for (let k = 0; k < steps && !dead; k++) {
      const px = q.x, py = q.y;
      q.x += q.vx / steps;
      q.y += q.vy / steps;

      for (let i = 0; i < 2; i++) {
        const p = s.players[i];
        if (i === q.o || p.paint >= 100 || !circleRect(q.x, q.y, w.r, p)) continue;
        if (auth && s.phase === 'play') {
          p.paint = Math.min(100, p.paint + w.dmg);
          p.hitFlash = 8;
          p.vx += Math.sign(q.vx) * w.knock;
          if (w.knock > 3) p.vy = Math.min(p.vy, -3);
          emit({ e: 'hit', x: q.x, y: q.y, o: q.o, t: i, d: w.dmg, w: q.w });
        }
        dead = true;
        break;
      }
      if (dead) break;

      for (const o of plats) {
        if (!circleRect(q.x, q.y, tr, o)) continue;
        let nx = 0, ny = 0;
        if (py <= o.y) ny = -1;
        else if (py >= o.y + o.h) ny = 1;
        else if (px <= o.x) nx = -1;
        else nx = 1;
        const sx = nx ? (nx < 0 ? o.x : o.x + o.w) : q.x;
        const sy = ny ? (ny < 0 ? o.y : o.y + o.h) : q.y;
        if (q.b > 0) {
          q.b--;
          if (ny) { q.vy = -q.vy * 0.7; q.vx *= 0.9; q.y = ny < 0 ? o.y - tr - 0.1 : o.y + o.h + tr + 0.1; }
          else { q.vx = -q.vx * 0.7; q.x = nx < 0 ? o.x - tr - 0.1 : o.x + o.w + tr + 0.1; }
          emit({ e: 'splat', x: sx, y: sy, o: q.o, s: w.splat * 0.6, nx, ny, b: 1 });
        } else {
          dead = true;
          emit({ e: 'splat', x: sx, y: sy, o: q.o, s: w.splat, nx, ny, b: 0 });
        }
        break;
      }
    }
    if (!dead && q.b > 0 && (q.x < 0 || q.x > W)) {
      q.b--;
      q.vx = -q.vx * 0.7;
      q.x = q.x < 0 ? 0 : W;
    }
    if (q.x < -30 || q.x > W + 30 || q.y > H + 30 || q.y < -400) dead = true;
    if (dead) list.splice(n, 1);
  }
}

function updatePhase(s, emit) {
  if (s.phase === 'countdown') {
    if (s.timer % 60 === 0) emit({ e: 'count', n: s.timer / 60 });
    if (--s.timer <= 0) { s.phase = 'play'; emit({ e: 'go' }); }
  } else if (s.phase === 'play') {
    s.timeLeft--;
    const [a, b] = s.players;
    const aOut = a.paint >= 100, bOut = b.paint >= 100;
    if (aOut || bOut || s.timeLeft <= 0) {
      let winner;
      if (aOut && bOut) winner = -1;
      else if (aOut) winner = 1;
      else if (bOut) winner = 0;
      else winner = a.paint < b.paint ? 0 : b.paint < a.paint ? 1 : -1;
      s.roundWinner = winner;
      s.reason = aOut || bOut ? 'ko' : 'time';
      if (winner >= 0) s.scores[winner]++;
      s.phase = 'roundEnd';
      s.timer = ROUND_END_TICKS;
      s.players.forEach((p, i) => {
        if (p.paint >= 100) emit({ e: 'ko', i, x: p.x + p.w / 2, y: Math.min(H - 10, p.y + p.h / 2) });
      });
      emit({ e: 'round', w: winner });
    }
  } else if (s.phase === 'roundEnd') {
    if (--s.timer <= 0) {
      const champ = s.scores.findIndex(v => v >= s.cfg.firstTo);
      if (champ >= 0) {
        s.phase = 'matchOver';
        s.matchWinner = champ;
        emit({ e: 'match', w: champ });
      } else {
        s.round++;
        resetRound(s);
      }
    }
  }
}

const r1 = v => Math.round(v * 10) / 10;

export function snapshot(s) {
  return {
    t: s.tick, ph: s.phase, tm: s.timer, tl: s.timeLeft, sc: s.scores, rd: s.round,
    rw: s.roundWinner, mw: s.matchWinner, rs: s.reason,
    p: s.players.map(p => [r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.dir, p.onGround ? 1 : 0,
      p.airJumps, r1(p.paint), p.cooldown, p.hitFlash, p.weapon, p.shotTick]),
    q: s.projectiles.map(q => [r1(q.x), r1(q.y), r1(q.vx), r1(q.vy), q.o, q.w, q.b, q.a]),
  };
}

export function applySnapshot(s, d) {
  s.tick = d.t; s.phase = d.ph; s.timer = d.tm; s.timeLeft = d.tl; s.scores = d.sc;
  s.round = d.rd; s.roundWinner = d.rw; s.matchWinner = d.mw; s.reason = d.rs;
  d.p.forEach((a, i) => {
    const p = s.players[i];
    [p.x, p.y, p.vx, p.vy, p.dir] = a;
    p.onGround = !!a[5];
    [, , , , , , p.airJumps, p.paint, p.cooldown, p.hitFlash, p.weapon, p.shotTick] = a;
  });
  s.projectiles = d.q.map(a => ({ x: a[0], y: a[1], vx: a[2], vy: a[3], o: a[4], w: a[5], b: a[6], a: a[7] }));
}

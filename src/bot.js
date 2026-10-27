import { W, H, WEAPONS, DIFFICULTIES } from './data.js';
import { platformsOf } from './sim.js';

function groundBelow(plats, x, fromY, maxDist) {
  let best = null;
  for (const o of plats) {
    if (x < o.x || x > o.x + o.w || o.y < fromY - 2 || o.y - fromY > maxDist) continue;
    if (best === null || o.y < best) best = o.y;
  }
  return best;
}

export function botThink(s, i, m, lvl = DIFFICULTIES[1]) {
  m.t = (m.t || 0) + 1;
  m.jp = m.jp || 0;
  m.hold = m.hold || 0;
  const me = s.players[i], foe = s.players[1 - i], w = WEAPONS[me.weapon];
  const out = { l: 0, r: 0, j: 0, f: 0, jp: m.jp };
  if (me.paint >= 100 || s.phase === 'countdown') return out;

  const plats = platformsOf(s.cfg.arenaId);
  const mx = me.x + me.w / 2, my = me.y + me.h / 2, feet = me.y + me.h;
  const dx = foe.x + foe.w / 2 - mx, dy = foe.y + foe.h / 2 - my;
  const adx = Math.abs(dx), toward = Math.sign(dx) || 1;

  if (m.t % 45 === 1) m.jit = (Math.random() - 0.5) * lvl.jitter;
  const ideal = w.range + (m.jit || 0);
  let move = 0;
  if (adx > ideal + 40) move = toward;
  else if (adx < ideal - 90) move = -toward;
  else if (m.t % 90 < 18) move = m.t % 180 < 90 ? 1 : -1;

  const aligned = w.look === 'pancake' || Math.abs(dy) < (w.pellets > 1 ? 70 : 38) * lvl.aim;
  if (move === 0 && me.dir !== toward && aligned) move = toward;
  // slower bots stick with their last decision for a while
  if (m.t - (m.decided ?? -999) < lvl.react) move = m.move;
  else { m.move = move; m.decided = m.t; }
  let wantJump = false;
  if ((mx < 40 && move < 0) || (mx > W - 40 && move > 0)) { move = toward; wantJump = Math.random() < 0.05; }

  // don't walk off ledges unless there's somewhere to land
  if (move !== 0 && me.onGround && groundBelow(plats, mx + move * 28, feet, 400) === null) {
    const reachable = [70, 120, 170].some(d => groundBelow(plats, mx + move * d, feet - 140, 300) !== null);
    if (reachable && move === toward) wantJump = true;
    else move = -move;
  }

  if (move !== 0 && me.onGround && Math.abs(me.vx) < 0.5) {
    m.stuck = (m.stuck || 0) + 1;
    if (m.stuck > 8) { wantJump = true; m.stuck = 0; }
  } else m.stuck = 0;

  if (dy < -70 && me.onGround && Math.random() < lvl.chase) wantJump = true;

  for (const q of s.projectiles) {
    if (q.o === i) continue;
    const qdx = mx - q.x;
    if (Math.sign(qdx) === Math.sign(q.vx) && Math.abs(qdx) < 150 && Math.abs(q.y - my) < 30 && Math.random() < lvl.dodge) {
      wantJump = true;
    }
  }

  // falling with nothing below: steer to the nearest platform and air-jump
  if (!me.onGround && me.vy > 2 && groundBelow(plats, mx, feet, H) === null) {
    let best = null, bestD = Infinity;
    for (const o of plats) {
      if (o.y < me.y - 100) continue;
      const d = Math.abs(o.x + o.w / 2 - mx);
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) move = Math.sign(best.x + best.w / 2 - mx) || 1;
    if (me.airJumps > 0) wantJump = true;
  }

  if (wantJump && m.hold <= 0) { m.jp++; m.hold = 14 + ((Math.random() * 10) | 0); }
  if (m.hold > 0) { m.hold--; out.j = 1; }
  out.jp = m.jp;
  if (move < 0) out.l = 1;
  else if (move > 0) out.r = 1;

  if (s.phase === 'play' && me.dir === toward && aligned && adx < w.range * 1.7 && Math.random() < lvl.fire) out.f = 1;
  return out;
}

import { ARENAS, WEAPONS, COLORS, DIFFICULTIES, TICK_MS } from './data.js';
import { createMatch, step, snapshot, applySnapshot, NO_INPUT } from './sim.js';
import { botThink } from './bot.js';
import { Renderer, drawArenaThumb, drawWeaponIcon } from './render.js';
import { sfx, unlockAudio, isMuted, setMuted } from './audio.js';
import { Net, cleanCode, netAvailable } from './net.js';

const $ = id => document.getElementById(id);
const renderer = new Renderer($('game'));
const net = new Net();
const ARENA_IDS = Object.keys(ARENAS).map(Number);
const clampWeapon = v => (Number.isInteger(v) && v >= 0 && v < WEAPONS.length ? v : 0);

const prefs = { arenaId: 1, weapons: [0, 0], firstTo: 3, difficulty: 1 };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('pa-prefs') || '{}')); } catch { /* ignore */ }
if (!ARENAS[prefs.arenaId]) prefs.arenaId = 1;
prefs.weapons = [clampWeapon(prefs.weapons?.[0]), clampWeapon(prefs.weapons?.[1])];
if (![1, 2, 3, 5].includes(prefs.firstTo)) prefs.firstTo = 3;
if (!DIFFICULTIES[prefs.difficulty]) prefs.difficulty = 1;
function savePrefs() {
  try { localStorage.setItem('pa-prefs', JSON.stringify(prefs)); } catch { /* ignore */ }
}

const lobby = { mode: 'local', arenaId: prefs.arenaId, weapons: [...prefs.weapons], firstTo: prefs.firstTo, difficulty: prefs.difficulty, connected: false };

const KEYS = [
  { l: ['KeyA'], r: ['KeyD'], j: ['KeyW'], f: ['KeyS', 'Space'] },
  { l: ['ArrowLeft'], r: ['ArrowRight'], j: ['ArrowUp'], f: ['ArrowDown', 'Enter', 'NumpadEnter'] },
];
const GAME_CODES = new Set(KEYS.flatMap(k => Object.values(k).flat()));
const down = new Set();
const jumpPresses = [0, 0];

let currentScreen = null;
let session = null;

addEventListener('keydown', e => {
  unlockAudio();
  if (e.code === 'Escape') { onEscape(); return; }
  if (!session || session.mode === 'demo' || currentScreen !== null) return;
  if (GAME_CODES.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  down.add(e.code);
  KEYS.forEach((k, i) => { if (k.j.includes(e.code)) jumpPresses[i]++; });
});
addEventListener('keyup', e => down.delete(e.code));
addEventListener('blur', () => down.clear());

function readKeys(sets) {
  const any = codes => codes.some(c => down.has(c));
  const inp = { l: 0, r: 0, j: 0, f: 0, jp: 0 };
  for (const i of sets) {
    const k = KEYS[i];
    if (any(k.l)) inp.l = 1;
    if (any(k.r)) inp.r = 1;
    if (any(k.j)) inp.j = 1;
    if (any(k.f)) inp.f = 1;
    inp.jp += jumpPresses[i];
  }
  return inp;
}

const packInput = i => [i.l, i.r, i.j, i.f, i.jp];
const unpackInput = a => (Array.isArray(a) ? { l: a[0], r: a[1], j: a[2], f: a[3], jp: a[4] } : { ...NO_INPUT });

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  currentScreen = id;
  down.clear();
  if (!id && document.activeElement) document.activeElement.blur();
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function labelsFor(mode) {
  switch (mode) {
    case 'local': return { names: ['Player 1', 'Player 2'], tags: ['P1', 'P2'], roundNames: ['RED', 'BLUE'] };
    case 'cpu': return { names: ['You', 'CPU'], tags: ['YOU', 'CPU'], roundNames: ['YOU', 'CPU'] };
    case 'host': return { names: ['You', 'Opponent'], tags: ['YOU', 'RIVAL'], roundNames: ['YOU', 'RIVAL'] };
    case 'guest': return { names: ['Opponent', 'You'], tags: ['RIVAL', 'YOU'], roundNames: ['RIVAL', 'YOU'] };
    default: return { names: ['Red', 'Blue'], tags: null, roundNames: ['RED', 'BLUE'] };
  }
}

function startSession(mode, cfg) {
  const state = createMatch(cfg);
  state.events = [];
  session = {
    mode, cfg, state, labels: labelsFor(mode), bots: [{}, {}], remoteInput: { ...NO_INPUT },
    out: [], sentKey: '', sentAt: 0, ticks: 0, paused: false, overTicks: 0, resultShown: false,
  };
  if (mode === 'cpu') session.labels.names[1] = `${DIFFICULTIES[cfg.difficulty].name} CPU`;
  renderer.setArena(cfg.arenaId);
  if (mode !== 'demo') showScreen(null);
}

function startDemo() {
  const rw = () => (Math.random() * WEAPONS.length) | 0;
  startSession('demo', { arenaId: ARENA_IDS[(Math.random() * ARENA_IDS.length) | 0], weapons: [rw(), rw()], firstTo: 2 });
}

function handleEvents(events, silent) {
  for (const e of events) {
    renderer.handle(e);
    if (silent) continue;
    switch (e.e) {
      case 'shoot': sfx.shoot(e.w); break;
      case 'splat': sfx.splat(e.s); break;
      case 'hit': sfx.hit(e.d); break;
      case 'jump': sfx.jump(e.air); break;
      case 'land': sfx.land(); break;
      case 'count': sfx.count(); break;
      case 'go': sfx.go(); break;
      case 'ko': sfx.ko(); break;
      case 'round': sfx.round(); break;
      case 'match': sfx.match(); break;
    }
  }
}

function sendGuestInput(S, inp) {
  const packed = packInput(inp), key = packed.join();
  if (key !== S.sentKey || S.ticks - S.sentAt > 15) {
    net.send({ t: 'in', k: packed });
    S.sentKey = key;
    S.sentAt = S.ticks;
  }
}

function tick() {
  const S = session;
  if (!S || S.paused) return;
  S.ticks++;
  const st = S.state;
  let inputs;
  switch (S.mode) {
    case 'demo': inputs = [botThink(st, 0, S.bots[0]), botThink(st, 1, S.bots[1])]; break;
    case 'local': inputs = [readKeys([0]), readKeys([1])]; break;
    case 'cpu': inputs = [readKeys([0, 1]), botThink(st, 1, S.bots[1], DIFFICULTIES[S.cfg.difficulty])]; break;
    case 'host': inputs = [readKeys([0, 1]), S.remoteInput]; break;
    case 'guest': {
      const mine = readKeys([0, 1]);
      sendGuestInput(S, mine);
      inputs = [S.remoteInput, mine];
      break;
    }
  }
  step(st, inputs, S.mode !== 'guest');
  if (S.mode !== 'guest') {
    const ev = st.events;
    st.events = [];
    handleEvents(ev, S.mode === 'demo');
    if (S.mode === 'host') {
      S.out.push(...ev);
      if (S.ticks % 2 === 0) {
        net.send({ t: 'snap', s: snapshot(st), in: inputs.map(packInput), ev: S.out });
        S.out = [];
      }
    }
  }
  renderer.update();

  if (st.phase === 'matchOver') {
    S.overTicks++;
    if (S.mode === 'demo') { if (S.overTicks > 90) startDemo(); }
    else if (!S.resultShown && S.overTicks > 50) { S.resultShown = true; showResult(); }
  }
}

let last = performance.now(), acc = 0;
function pump(now) {
  acc += Math.min(200, Math.max(0, now - last));
  last = now;
  while (acc >= TICK_MS) { tick(); acc -= TICK_MS; }
}

// raf stops in background tabs, so a worker timer keeps the sim (and online host) running
const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 16)'], { type: 'text/javascript' })));
ticker.onmessage = () => { if (document.hidden) pump(performance.now()); };

function frame(now) {
  pump(now);
  if (session) {
    const L = session.labels;
    renderer.draw(session.state, {
      hud: session.mode !== 'demo', smooth: session.mode === 'guest',
      names: L.names, tags: L.tags, roundNames: L.roundNames,
    });
  }
  requestAnimationFrame(frame);
}

const mapCards = ARENA_IDS.map(id => {
  const a = ARENAS[id];
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'map-card';
  const cv = document.createElement('canvas');
  cv.width = 320; cv.height = 180;
  const name = document.createElement('strong');
  name.textContent = a.name;
  const blurb = document.createElement('span');
  blurb.textContent = a.blurb;
  el.append(cv, name, blurb);
  el.addEventListener('click', () => {
    if (lobby.mode === 'guest') return;
    lobby.arenaId = id;
    sfx.click();
    lobbyChanged();
  });
  $('map-list').append(el);
  return { id, el, cv, drawn: false };
});

function ensureThumbs() {
  for (const m of mapCards) if (!m.drawn) { drawArenaThumb(m.cv, m.id); m.drawn = true; }
}

const ROUND_OPTIONS = [1, 2, 3, 5];
const roundButtons = ROUND_OPTIONS.map(n => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = n;
  b.addEventListener('click', () => {
    if (lobby.mode === 'guest') return;
    lobby.firstTo = n;
    sfx.click();
    lobbyChanged();
  });
  $('rounds-seg').append(b);
  return b;
});

const diffButtons = DIFFICULTIES.map((d, n) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = d.name;
  b.addEventListener('click', () => {
    lobby.difficulty = n;
    sfx.click();
    lobbyChanged();
  });
  $('difficulty-seg').append(b);
  return b;
});

function buildPicker(i) {
  const root = $('picker-' + i);
  root.classList.add('p' + (i + 1));
  root.innerHTML = `
    <div class="picker-head"><span class="badge">P${i + 1}</span><strong class="who"></strong><span class="keys"></span></div>
    <div class="weapons"></div>
    <div class="wdetail">
      <div class="wtext"><div class="wname"></div><p class="wdesc"></p></div>
      <div class="stat"><span>Power</span><i><b data-s="pow"></b></i></div>
      <div class="stat"><span>Fire rate</span><i><b data-s="rate"></b></i></div>
      <div class="stat"><span>Range</span><i><b data-s="range"></b></i></div>
      <div class="tags"></div>
    </div>`;
  const grid = root.querySelector('.weapons');
  const chips = WEAPONS.map((w, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'weapon';
    b.title = w.name;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 68;
    drawWeaponIcon(cv, k, i);
    const label = document.createElement('span');
    label.textContent = w.name;
    b.append(cv, label);
    b.addEventListener('click', () => pickWeapon(i, k));
    grid.append(b);
    return b;
  });
  const q = sel => root.querySelector(sel);
  return {
    root, chips, who: q('.who'), keys: q('.keys'), name: q('.wname'), desc: q('.wdesc'), tags: q('.tags'),
    bars: { pow: q('[data-s=pow]'), rate: q('[data-s=rate]'), range: q('[data-s=range]') },
  };
}
const pickers = [buildPicker(0), buildPicker(1)];

function canEditSide(i) {
  if (lobby.mode === 'host') return i === 0;
  if (lobby.mode === 'guest') return i === 1;
  return true;
}

function pickWeapon(i, k) {
  if (!canEditSide(i)) return;
  lobby.weapons[i] = k;
  sfx.click();
  if (lobby.mode === 'guest') net.send({ t: 'weapon', id: k });
  lobbyChanged();
}

function lobbyChanged() {
  if (lobby.mode === 'local' || lobby.mode === 'cpu') {
    Object.assign(prefs, { arenaId: lobby.arenaId, weapons: [...lobby.weapons], firstTo: lobby.firstTo, difficulty: lobby.difficulty });
  } else if (lobby.mode === 'host') {
    Object.assign(prefs, { arenaId: lobby.arenaId, firstTo: lobby.firstTo });
    prefs.weapons[0] = lobby.weapons[0];
  } else {
    prefs.weapons[1] = lobby.weapons[1];
  }
  savePrefs();
  if (lobby.mode === 'host') sendLobby(false);
  renderSetup();
}

function sendLobby(show) {
  net.send({ t: 'lobby', arenaId: lobby.arenaId, weapons: lobby.weapons, firstTo: lobby.firstTo, show });
}

const PICKER_TEXT = {
  local: [['Player 1', 'W A D · shoot S / Space'], ['Player 2', '← ↑ → · shoot ↓ / Enter']],
  cpu: [['You', 'WASD or arrow keys'], ['CPU', 'Pick its weapon']],
  host: [['You', 'WASD or arrow keys'], ['Opponent', 'They pick their own']],
  guest: [['Opponent', 'They pick their own'], ['You', 'WASD or arrow keys']],
};

function renderSetup() {
  const mode = lobby.mode, online = mode === 'host' || mode === 'guest';
  $('setup-title').textContent = { local: 'Local Match', cpu: 'Vs CPU', host: 'Online Lobby', guest: 'Online Lobby' }[mode];
  for (const m of mapCards) m.el.classList.toggle('selected', m.id === lobby.arenaId);
  $('map-list').classList.toggle('locked', mode === 'guest');
  $('rounds').classList.toggle('locked', mode === 'guest');
  roundButtons.forEach((b, k) => b.classList.toggle('selected', ROUND_OPTIONS[k] === lobby.firstTo));
  $('difficulty').classList.toggle('hidden', mode !== 'cpu');
  diffButtons.forEach((b, k) => b.classList.toggle('selected', k === lobby.difficulty));

  pickers.forEach((p, i) => {
    const wi = lobby.weapons[i], w = WEAPONS[wi];
    p.chips.forEach((c, k) => c.classList.toggle('selected', k === wi));
    p.root.classList.toggle('locked', !canEditSide(i));
    const [who, keys] = PICKER_TEXT[mode][i];
    p.who.textContent = who;
    p.keys.textContent = mode === 'host' && i === 1 && !lobby.connected ? 'Not joined yet' : keys;
    p.name.textContent = w.name;
    p.desc.textContent = w.desc;
    p.bars.pow.style.width = Math.min(100, (w.dmg * w.pellets / 45) * 100) + '%';
    p.bars.rate.style.width = Math.max(6, (1 - (w.rate - 2) / 60) * 100) + '%';
    p.bars.range.style.width = Math.min(100, (w.range / 520) * 100) + '%';
    const tags = [];
    if (w.pellets > 1) tags.push(`${w.pellets} shots`);
    if (w.bounces) tags.push(`Bounces ×${w.bounces}`);
    if (w.lift > 0.3) tags.push('Lobbed');
    if (w.life < 45) tags.push('Short range');
    if (w.speed > 25) tags.push('Super fast');
    p.tags.replaceChildren(...tags.map(t => Object.assign(document.createElement('span'), { textContent: t })));
  });

  $('online-bar').classList.toggle('hidden', !online);
  $('code-block').classList.toggle('hidden', mode !== 'host');
  $('fight-btn').classList.toggle('hidden', mode === 'guest');
  $('fight-btn').disabled = mode === 'host' && !lobby.connected;
  $('wait-note').classList.toggle('hidden', mode !== 'guest');
}

function setStatus(text, kind = '') {
  const el = $('net-status');
  el.className = 'status' + (kind ? ' ' + kind : '');
  el.querySelector('.txt').textContent = text;
}

function joinStatus(text, isErr = false) {
  const el = $('join-status');
  el.textContent = text;
  el.classList.toggle('err', isErr);
}

function openSetup(mode) {
  lobby.mode = mode;
  lobby.arenaId = prefs.arenaId;
  lobby.weapons = [...prefs.weapons];
  lobby.firstTo = prefs.firstTo;
  lobby.difficulty = prefs.difficulty;
  ensureThumbs();
  renderSetup();
  showScreen('setup');
}

function startHosting() {
  if (!netAvailable()) { toast("Online play isn't set up yet. Add a Firebase config to src/firebase-config.js."); return; }
  lobby.mode = 'host';
  lobby.connected = false;
  lobby.arenaId = prefs.arenaId;
  lobby.weapons = [prefs.weapons[0], 0];
  lobby.firstTo = prefs.firstTo;
  $('host-code').textContent = '·····';
  setStatus('Creating room…');
  net.host();
  ensureThumbs();
  renderSetup();
  showScreen('setup');
}

function joinGame(raw) {
  if (!netAvailable()) { joinStatus("Online play isn't set up yet. Add a Firebase config to src/firebase-config.js.", true); return; }
  const code = cleanCode(raw);
  if (code.length !== 5) { joinStatus('Codes are 5 characters long.', true); return; }
  lobby.mode = 'guest';
  lobby.connected = false;
  lobby.weapons = [0, prefs.weapons[1]];
  joinStatus(`Looking for game ${code}…`);
  net.join(code);
}

net.onReady = code => {
  $('host-code').textContent = code;
  setStatus('Waiting for a friend to join…');
};

net.onConnect = () => {
  lobby.connected = true;
  if (net.role === 'host') {
    setStatus('Opponent connected!', 'ok');
    toast('A player joined your game!');
    sendLobby(false);
    renderSetup();
  } else {
    net.send({ t: 'hello', weapon: lobby.weapons[1] });
    setStatus(`Connected to game ${net.code}. The host picks the arena.`, 'ok');
    joinStatus('');
    ensureThumbs();
    renderSetup();
    showScreen('setup');
  }
  sfx.click();
};

net.onData = m => {
  if (!m || typeof m !== 'object') return;
  if (net.role === 'host') {
    switch (m.t) {
      case 'hello':
      case 'weapon':
        lobby.weapons[1] = clampWeapon(m.t === 'hello' ? m.weapon : m.id);
        renderSetup();
        sendLobby(false);
        break;
      case 'in':
        if (session && session.mode === 'host') session.remoteInput = unpackInput(m.k);
        break;
    }
    return;
  }
  switch (m.t) {
    case 'lobby':
      if (ARENAS[m.arenaId]) lobby.arenaId = m.arenaId;
      lobby.weapons[0] = clampWeapon(m.weapons && m.weapons[0]);
      if (ROUND_OPTIONS.includes(m.firstTo)) lobby.firstTo = m.firstTo;
      renderSetup();
      if (m.show) { startDemo(); showScreen('setup'); }
      break;
    case 'start': {
      const c = m.cfg || {};
      if (!ARENAS[c.arenaId] || !Array.isArray(c.weapons)) return;
      startSession('guest', { arenaId: c.arenaId, weapons: c.weapons.map(clampWeapon), firstTo: c.firstTo || 3 });
      break;
    }
    case 'snap':
      if (session && session.mode === 'guest') {
        applySnapshot(session.state, m.s);
        session.remoteInput = unpackInput(m.in && m.in[0]);
        handleEvents(m.ev || [], false);
      }
      break;
  }
};

net.onClose = () => {
  lobby.connected = false;
  if (net.role === 'host') {
    lobby.weapons[1] = 0;
    toast('Your opponent left.');
    setStatus('Waiting for a friend to join…');
    if (session && session.mode === 'host') startDemo();
    renderSetup();
    showScreen('setup');
  } else {
    toast('Disconnected from the host.');
    goMenu();
  }
};

net.onError = msg => {
  if (net.role === 'guest' && !lobby.connected) {
    net.close();
    showScreen('join');
    joinStatus(msg, true);
  } else if (net.role === 'host' && !lobby.connected) {
    setStatus(msg, 'err');
  } else {
    toast(msg);
  }
};

function leaveOnline() {
  net.close();
  net.role = null;
  lobby.connected = false;
}

function goMenu() {
  leaveOnline();
  startDemo();
  showScreen('menu');
}

function fight() {
  const cfg = { arenaId: lobby.arenaId, weapons: [...lobby.weapons], firstTo: lobby.firstTo, difficulty: lobby.difficulty };
  if (lobby.mode === 'host') {
    if (!net.connected) return;
    net.send({ t: 'start', cfg });
  }
  startSession(lobby.mode, cfg);
}

function onEscape() {
  if (!session || session.mode === 'demo') {
    if (currentScreen === 'howto' || currentScreen === 'join') goMenu();
    return;
  }
  if (currentScreen === 'pause') { resume(); return; }
  if (currentScreen !== null || session.state.phase === 'matchOver') return;
  const online = session.mode === 'host' || session.mode === 'guest';
  session.paused = !online;
  $('pause-title').textContent = online ? 'Match in progress' : 'Paused';
  document.querySelector('[data-action=resume]').textContent = online ? 'Back to match' : 'Resume';
  document.querySelector('[data-action=quit]').textContent = online ? 'Leave match' : 'Quit to menu';
  showScreen('pause');
}

function resume() {
  if (session) session.paused = false;
  showScreen(null);
}

function showResult() {
  const S = session, st = S.state, w = st.matchWinner;
  let title;
  if (S.mode === 'local') title = `${COLORS[w].name} wins!`;
  else {
    const you = S.mode === 'guest' ? 1 : 0;
    title = w === you ? 'You win!' : S.mode === 'cpu' ? 'CPU wins' : 'You lose';
  }
  $('result-title').textContent = title;
  $('result-title').style.color = COLORS[w].main;
  $('result-score').textContent = `${st.scores[0]} – ${st.scores[1]}`;

  const btn = (label, cls, fn) => {
    const b = document.createElement('button');
    b.className = 'btn big ' + cls;
    b.textContent = label;
    b.addEventListener('click', () => { sfx.click(); fn(); });
    return b;
  };
  const actions = [];
  if (S.mode === 'local' || S.mode === 'cpu') {
    actions.push(btn('Rematch', 'primary', () => startSession(S.mode, S.cfg)));
    actions.push(btn('Change setup', '', () => { startDemo(); openSetup(S.mode); }));
    actions.push(btn('Main menu', 'ghost', goMenu));
  } else if (S.mode === 'host') {
    actions.push(btn('Rematch', 'primary', () => {
      if (!net.connected) return;
      net.send({ t: 'start', cfg: S.cfg });
      startSession('host', S.cfg);
    }));
    actions.push(btn('Back to lobby', '', () => { sendLobby(true); startDemo(); renderSetup(); showScreen('setup'); }));
    actions.push(btn('Leave', 'ghost', goMenu));
  } else {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = 'Waiting for the host to start a rematch…';
    actions.push(note, btn('Leave', 'ghost', goMenu));
  }
  $('result-actions').replaceChildren(...actions);
  showScreen('result');
}

const ACTIONS = {
  local: () => openSetup('local'),
  cpu: () => openSetup('cpu'),
  host: startHosting,
  join: () => { joinStatus(''); showScreen('join'); setTimeout(() => $('join-input').focus(), 50); },
  howto: () => showScreen('howto'),
  menu: goMenu,
  back: goMenu,
  fight,
  resume,
  quit: goMenu,
  'copy-code': () => copy(net.code, 'Code copied!'),
  'copy-link': () => copy(`${location.origin}${location.pathname}#join=${net.code}`, 'Invite link copied!'),
};

function copy(text, msg) {
  if (!text) return;
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(msg), () => toast(text));
  else toast(text);
}

document.addEventListener('click', e => {
  unlockAudio();
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const fn = ACTIONS[b.dataset.action];
  if (fn) { if (b.dataset.action !== 'fight') sfx.click(); fn(); }
});

$('join-form').addEventListener('submit', e => {
  e.preventDefault();
  joinGame($('join-input').value);
});
$('join-input').addEventListener('input', e => { e.target.value = cleanCode(e.target.value); });

const SPEAKER_ON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const SPEAKER_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
const muteBtn = $('mute-btn');
const paintMute = () => { muteBtn.innerHTML = isMuted() ? SPEAKER_OFF : SPEAKER_ON; };
paintMute();
muteBtn.addEventListener('click', () => { setMuted(!isMuted()); paintMute(); });
$('fs-btn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) {
  $('touch-note').classList.add('show');
}

const fontsReady = document.fonts
  ? Promise.race([document.fonts.load('700 20px Fredoka'), new Promise(r => setTimeout(r, 1500))])
  : Promise.resolve();

fontsReady.then(() => {
  startDemo();
  const m = location.hash.match(/join=([A-Za-z0-9]+)/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    $('join-input').value = cleanCode(m[1]);
    showScreen('join');
    joinGame(m[1]);
  } else {
    showScreen('menu');
  }
  requestAnimationFrame(frame);
});

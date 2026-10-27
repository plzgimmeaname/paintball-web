export const W = 960;
export const H = 540;
export const GRAVITY = 0.7;
export const TICK_MS = 1000 / 60;
export const ROUND_SECONDS = 60;

export const COLORS = [
  { main: '#ff4d6d', light: '#ff8fa3', dark: '#b3173b', name: 'Red' },
  { main: '#3a86ff', light: '#8fbcff', dark: '#1a4fb5', name: 'Blue' },
];

// platforms are [x, y, w, h]; thin ones (h <= 20) can be jumped through from below
export const ARENAS = {
  1: {
    name: 'Flat Arena',
    theme: 'stadium',
    blurb: 'Open ground. Nowhere to hide.',
    platforms: [[0, 500, 960, 40], [280, 370, 400, 18]],
    spawns: [[80, 466], [850, 466]],
  },
  2: {
    name: 'The Steppes',
    theme: 'sunset',
    blurb: 'Climb high, rain paint.',
    platforms: [[0, 500, 960, 40], [110, 365, 190, 18], [660, 365, 190, 18], [380, 235, 200, 18]],
    spawns: [[80, 466], [850, 466]],
  },
  3: {
    name: 'City Ruins',
    theme: 'night',
    blurb: 'Mind the gap in the middle.',
    platforms: [
      [0, 500, 320, 40], [640, 500, 320, 40], [420, 420, 120, 18],
      [160, 330, 180, 18], [620, 330, 180, 18], [420, 205, 120, 18],
    ],
    spawns: [[80, 466], [850, 466]],
  },
  4: {
    name: 'Fort Split',
    theme: 'forest',
    blurb: 'A wall down the middle. Lob it over.',
    platforms: [
      [0, 500, 960, 40], [466, 330, 28, 170], [380, 312, 200, 18],
      [170, 405, 150, 18], [640, 405, 150, 18], [60, 255, 140, 18], [760, 255, 140, 18],
    ],
    spawns: [[80, 466], [850, 466]],
  },
};

// cpu levels: react = ticks it sticks with a move, aim = how far off-level it still shoots
export const DIFFICULTIES = [
  { name: 'Easy', react: 24, fire: 0.18, dodge: 0, chase: 0.01, aim: 0.6, jitter: 260 },
  { name: 'Normal', react: 1, fire: 0.55, dodge: 0.08, chase: 0.04, aim: 1, jitter: 140 },
  { name: 'Hard', react: 1, fire: 0.85, dodge: 0.3, chase: 0.09, aim: 1.3, jitter: 70 },
];

export const WEAPONS = [
  {
    name: 'Paintball', desc: 'Reliable marker. Quick shots with a slight drop.', look: 'ball',
    rate: 14, dmg: 12, speed: 14, spread: 0.03, pellets: 1, fan: 0, lift: 0.02, grav: 0.08,
    bounces: 0, r: 6, knock: 2.5, life: 120, range: 320, splat: 11, gun: '#ffd166',
  },
  {
    name: 'Dodgeball', desc: 'Throws three bouncy balls in a fan.', look: 'dodge',
    rate: 48, dmg: 14, speed: 12, spread: 0.02, pellets: 3, fan: 0.16, lift: 0.08, grav: 0.22,
    bounces: 1, r: 8, knock: 3.5, life: 150, range: 200, splat: 13, gun: '#ff9f1c',
  },
  {
    name: 'Hose', desc: 'Short, wide spray. A close-range menace.', look: 'drop',
    rate: 4, dmg: 3, speed: 12.5, spread: 0.13, pellets: 1, fan: 0, lift: 0.06, grav: 0.32,
    bounces: 0, r: 4, knock: 0.7, life: 40, range: 170, splat: 6, gun: '#2ec4b6',
  },
  {
    name: 'BB Sniper', desc: 'Slow reload, blazing fast, hits hard.', look: 'bb',
    rate: 55, dmg: 34, speed: 32, spread: 0, pellets: 1, fan: 0, lift: 0, grav: 0,
    bounces: 0, r: 3, knock: 6, life: 60, range: 520, splat: 9, gun: '#adb5bd',
  },
  {
    name: 'Pancake', desc: 'Lobbed flapjack that bounces three times.', look: 'pancake',
    rate: 60, dmg: 45, speed: 11, spread: 0.04, pellets: 1, fan: 0, lift: 0.5, grav: 0.38,
    bounces: 3, r: 10, knock: 7, life: 220, range: 260, splat: 18, gun: '#e0a458',
  },
  {
    name: 'Laser', desc: 'A steady beam of tiny hits. Dead straight.', look: 'laser',
    rate: 2, dmg: 1.3, speed: 30, spread: 0, pellets: 1, fan: 0, lift: 0, grav: 0,
    bounces: 0, r: 3, knock: 0.25, life: 30, range: 420, splat: 4, gun: '#c77dff',
  },
  {
    name: 'Frisbee', desc: 'Wobbly disc that ricochets twice.', look: 'frisbee',
    rate: 34, dmg: 20, speed: 11, spread: 0.05, pellets: 1, fan: 0, lift: 0.02, grav: 0.015,
    wobble: 0.18, bounces: 2, r: 9, knock: 4, life: 200, range: 300, splat: 12, gun: '#06d6a0',
  },
];

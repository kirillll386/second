/* =====================================================================
   BACKROOMS // GLOBAL OFFENSIVE
   Single-player CS2-flavoured round shooter. Everything (level, textures,
   sounds) is generated at runtime. Requires libs/three.min.js (r149).
   ===================================================================== */
(function () {
  'use strict';

  /* ----------------------------- helpers ----------------------------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const TAU = Math.PI * 2;
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const byId = (id) => document.getElementById(id);
  function angleLerp(a, b, t) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return a + d * t;
  }

  /* ------------------------------ UI -------------------------------- */
  const ui = {
    canvas: byId('game'),
    startEl: byId('start'),
    startBtn: byId('startBtn'),
    skinsBtn: byId('skinsBtn'),
    modeBtns: Array.from(document.querySelectorAll('.mode-card')),
    diffBtns: Array.from(document.querySelectorAll('.diff-card')),
    chaseEl: byId('chase'),
    pauseEl: byId('pause'),
    resumeBtn: byId('resumeBtn'),
    pauseSkinsBtn: byId('pauseSkinsBtn'),
    skinsEl: byId('skins'),
    skinsClose: byId('skinsClose'),
    skinTabs: byId('skinTabs'),
    skinGrid: byId('skinGrid'),
    skinInfo: byId('skinInfo'),
    skinCount: byId('skinCount'),
    skinName: byId('skinName'),
    buyEl: byId('buymenu'),
    buyGrid: byId('buyGrid'),
    buyMoney: byId('buyMoney'),
    buyInfo: byId('buyInfo'),
    scoreCT: byId('scoreCT'),
    scoreT: byId('scoreT'),
    timer: byId('timer'),
    roundLabel: byId('roundlabel'),
    moneyVal: byId('moneyVal'),
    killfeed: byId('killfeed'),
    crosshair: byId('crosshair'),
    hitmarker: byId('hitmarker'),
    hpVal: byId('hpVal'),
    armorVal: byId('armorVal'),
    hpStat: byId('hpStat'),
    weaponName: byId('weaponName'),
    magVal: byId('magVal'),
    reserveVal: byId('reserveVal'),
    ammoEl: byId('ammo'),
    ammoSep: document.querySelector('#ammo .sep'),
    banner: byId('banner'),
    bannerTitle: document.querySelector('#banner .title'),
    bannerSub: document.querySelector('#banner .sub'),
    toastEl: byId('toast'),
    scopeEl: byId('scope'),
    scoreboard: byId('scoreboard'),
    damageEl: byId('damage')
  };

  /* ----------------------------- audio ------------------------------ */
  class Sfx {
    constructor() {
      this.ready = false;
      this.ctx = null;
      this.master = null;
      this.noise = null;
    }
    init() {
      if (this.ready) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);

      const rate = this.ctx.sampleRate;
      const len = Math.floor(rate * 1.4);
      const buf = this.ctx.createBuffer(1, len, rate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;

      const hum = this.ctx.createGain();
      hum.gain.value = 0.032;
      hum.connect(this.master);
      [58, 116, 174].forEach((f, i) => {
        const o = this.ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.value = i === 0 ? 1 : 0.3;
        o.connect(g);
        g.connect(hum);
        o.start();
      });

      const air = this.ctx.createBufferSource();
      air.buffer = this.noise;
      air.loop = true;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const ag = this.ctx.createGain();
      ag.gain.value = 0.045;
      air.connect(lp);
      lp.connect(ag);
      ag.connect(this.master);
      air.start();

      this.ready = true;
    }
    setVolume(v) {
      if (this.ready) this.master.gain.value = v;
    }
    tone(o) {
      if (!this.ready) return;
      const freq = o.freq || 440, dur = o.dur || 0.15, gain = o.gain || 0.15;
      const type = o.type || 'sine', slide = o.slide || null, delay = o.delay || 0;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    burst(o) {
      if (!this.ready) return;
      const dur = o.dur || 0.2, gain = o.gain || 0.4;
      const freq = o.freq || 2400, freqEnd = o.freqEnd || 300;
      const type = o.type || 'lowpass', delay = o.delay || 0, q = o.q || 1;
      const t = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 0.6);
      src.stop(t + dur + 0.03);
    }
    gun(kind, scale) {
      scale = scale === undefined ? 1 : scale;
      if (kind === 'awp') {
        this.burst({ dur: 0.55, gain: 0.95 * scale, freq: 3400, freqEnd: 120, q: 0.7 });
        this.tone({ freq: 62, dur: 0.45, gain: 0.55 * scale, slide: 26, type: 'sine' });
      } else if (kind === 'pistol') {
        this.burst({ dur: 0.15, gain: 0.42 * scale, freq: 3200, freqEnd: 420 });
        this.tone({ freq: 155, dur: 0.11, gain: 0.22 * scale, slide: 60 });
      } else {
        this.burst({ dur: 0.22, gain: 0.62 * scale, freq: 2800, freqEnd: 260 });
        this.tone({ freq: 105, dur: 0.16, gain: 0.34 * scale, slide: 42 });
      }
    }
    enemyGun(dist) {
      this.gun('rifle', clamp(1 - dist / 46, 0.12, 0.6));
    }
    hit(head) {
      this.tone({ freq: head ? 1650 : 1150, dur: 0.055, gain: 0.12, type: 'square' });
    }
    kill() {
      this.tone({ freq: 520, dur: 0.08, gain: 0.12, type: 'triangle', slide: 780 });
      this.burst({ dur: 0.16, gain: 0.16, freq: 900, freqEnd: 120 });
    }
    empty() {
      this.burst({ dur: 0.045, gain: 0.12, freq: 3000, freqEnd: 1400, type: 'highpass' });
    }
    reload() {
      this.burst({ dur: 0.06, gain: 0.16, freq: 1900, freqEnd: 700, type: 'highpass' });
      this.burst({ dur: 0.07, gain: 0.16, freq: 1600, freqEnd: 500, type: 'highpass', delay: 0.45 });
    }
    reloadEnd() {
      this.burst({ dur: 0.05, gain: 0.16, freq: 2400, freqEnd: 900, type: 'highpass' });
    }
    step() {
      this.burst({ dur: 0.075, gain: 0.075, freq: 420, freqEnd: 130 });
      this.tone({ freq: 68, dur: 0.05, gain: 0.045, slide: 45 });
    }
    hurt() {
      this.tone({ freq: 130, dur: 0.22, gain: 0.2, type: 'sawtooth', slide: 48 });
      this.burst({ dur: 0.25, gain: 0.22, freq: 700, freqEnd: 90 });
    }
    death() {
      this.tone({ freq: 90, dur: 1.1, gain: 0.28, type: 'sawtooth', slide: 28 });
      this.burst({ dur: 1.2, gain: 0.22, freq: 600, freqEnd: 60 });
    }
    buy() {
      this.tone({ freq: 880, dur: 0.07, gain: 0.1 });
      this.tone({ freq: 1320, dur: 0.09, gain: 0.1, delay: 0.08 });
      this.tone({ freq: 1760, dur: 0.1, gain: 0.07, delay: 0.16 });
    }
    deny() {
      this.tone({ freq: 150, dur: 0.18, gain: 0.12, type: 'square', slide: 90 });
    }
    roundStart() {
      this.tone({ freq: 440, dur: 0.12, gain: 0.1, type: 'triangle' });
      this.tone({ freq: 554, dur: 0.12, gain: 0.1, type: 'triangle', delay: 0.16 });
      this.tone({ freq: 660, dur: 0.16, gain: 0.1, type: 'triangle', delay: 0.32 });
    }
    roundWin() {
      this.tone({ freq: 523, dur: 0.18, gain: 0.12, type: 'triangle' });
      this.tone({ freq: 659, dur: 0.18, gain: 0.12, type: 'triangle', delay: 0.16 });
      this.tone({ freq: 784, dur: 0.3, gain: 0.13, type: 'triangle', delay: 0.32 });
    }
    roundLose() {
      this.tone({ freq: 392, dur: 0.22, gain: 0.12, type: 'triangle' });
      this.tone({ freq: 311, dur: 0.24, gain: 0.12, type: 'triangle', delay: 0.2 });
      this.tone({ freq: 233, dur: 0.4, gain: 0.13, type: 'triangle', delay: 0.4 });
    }
    melee() {
      this.burst({ dur: 0.16, gain: 0.2, freq: 2600, freqEnd: 400, type: 'highpass' });
    }
    equip() {
      this.burst({ dur: 0.06, gain: 0.12, freq: 2200, freqEnd: 800, type: 'highpass' });
    }
    clink() {
      this.tone({ freq: 1450, dur: 0.06, gain: 0.09, type: 'square', slide: 900 });
    }
    stinger() {
      this.tone({ freq: 82, dur: 1.8, gain: 0.34, type: 'sawtooth', slide: 27 });
      this.tone({ freq: 1240, dur: 0.7, gain: 0.13, type: 'square', slide: 180 });
      this.burst({ dur: 1.5, gain: 0.25, freq: 1800, freqEnd: 110, type: 'bandpass', q: 0.8 });
    }
    heartbeat() {
      this.tone({ freq: 58, dur: 0.16, gain: 0.16, type: 'sine', slide: 34 });
      this.tone({ freq: 52, dur: 0.18, gain: 0.13, type: 'sine', slide: 30, delay: 0.19 });
    }
  }
  const sfx = new Sfx();

  /* --------------------------- three setup -------------------------- */
  const renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8e7d47);
  scene.fog = new THREE.FogExp2(0x8e7d47, 0.03);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.06, 260);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  /* ---------------------------- constants --------------------------- */
  const CELL = 4;
  const COLS = 27;
  const ROWS = 27;
  const WALL_H = 3.2;
  const WORLD_W = COLS * CELL;
  const WORLD_D = ROWS * CELL;
  const EYE_STAND = 1.66;
  const EYE_CROUCH = 1.14;
  const MAX_MONEY = 16000;
  const ROUND_TIME = 120;
  const BUY_TIME = 20;
  const DUEL_TIME = 90;
  const DUEL_BUY_TIME = 15;
  const DUEL_TARGET = 5;
  const SKIN_KEY = 'brgo_skins_v1';
  const MODE_KEY = 'brgo_mode_v1';
  const DIFF_KEY = 'brgo_diff_v1';

  const DIFFICULTY = {
    easy: {
      id: 'easy', name: 'ЛЕГКО', short: 'Смайлеры медленнее и стреляют реже',
      speed: 0.82, aim: 0.68, dmg: 0.72, hear: 0.62, rate: 1.35, income: 0.72, buy: 0.75
    },
    normal: {
      id: 'normal', name: 'НОРМА', short: 'Стандартный баланс',
      speed: 1.0, aim: 1.0, dmg: 1.0, hear: 1.0, rate: 1.0, income: 1.0, buy: 1.0
    },
    hard: {
      id: 'hard', name: 'СЛОЖНО', short: 'Быстрые, точные и хорошо вооружённые',
      speed: 1.16, aim: 1.3, dmg: 1.28, hear: 1.4, rate: 0.78, income: 1.32, buy: 1.25
    }
  };

  const BOT_GUNS = {
    usp: { dmgMin: 7, dmgMax: 13, rateMin: 0.72, rateMax: 1.5, acc: 0.67, falloff: 0.021, sound: 'pistol', tracer: 0xff8a55 },
    ak: { dmgMin: 9, dmgMax: 15, rateMin: 0.34, rateMax: 0.72, acc: 0.76, falloff: 0.017, sound: 'rifle', tracer: 0xffa05a },
    awp: { dmgMin: 38, dmgMax: 58, rateMin: 2.1, rateMax: 3.2, acc: 0.86, falloff: 0.012, sound: 'awp', tracer: 0xffc27a }
  };

  /* --------------------------- textures ----------------------------- */
  function makeTexture(size, painter) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    painter(ctx, size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = maxAniso;
    return tex;
  }

  function paintWallpaper(ctx, s) {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#d8ca82');
    g.addColorStop(0.55, '#cbba6c');
    g.addColorStop(1, '#a5964f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 30) {
      ctx.fillStyle = ((x / 30) | 0) % 2 === 0
        ? 'rgba(255,248,200,0.09)'
        : 'rgba(96,80,32,0.07)';
      ctx.fillRect(x, 0, 15, s);
    }
    for (let i = 0; i < 13000; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(84,68,24,0.055)' : 'rgba(255,250,212,0.05)';
      ctx.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 13; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = rand(22, 100);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(70,55,18,0.17)');
      rg.addColorStop(1, 'rgba(70,55,18,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    const bg = ctx.createLinearGradient(0, s * 0.72, 0, s);
    bg.addColorStop(0, 'rgba(48,38,12,0)');
    bg.addColorStop(1, 'rgba(40,31,9,0.55)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, s * 0.72, s, s * 0.28);
  }

  function paintCarpet(ctx, s) {
    ctx.fillStyle = '#977f41';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 28000; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      const v = Math.random();
      ctx.fillStyle = v < 0.45
        ? 'rgba(60,48,18,0.18)'
        : (v < 0.8 ? 'rgba(210,192,130,0.14)' : 'rgba(40,32,10,0.2)');
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = rand(30, 120);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(48,38,12,0.22)');
      rg.addColorStop(1, 'rgba(48,38,12,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60,48,18,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < s; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s);
      ctx.stroke();
    }
  }

  function paintCeiling(ctx, s) {
    ctx.fillStyle = '#ddd6b3';
    ctx.fillRect(0, 0, s, s);
    const tile = s / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const shade = rand(-8, 8) | 0;
        ctx.fillStyle = 'rgb(' + (215 + shade) + ',' + (208 + shade) + ',' + (176 + shade) + ')';
        ctx.fillRect(x * tile, y * tile, tile, tile);
      }
    }
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * s, y = Math.random() * s;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(120,105,60,0.06)' : 'rgba(255,255,235,0.06)';
      ctx.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = rand(20, 90);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(110,88,36,0.18)');
      rg.addColorStop(1, 'rgba(110,88,36,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(110,96,52,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tile, 0);
      ctx.lineTo(i * tile, s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * tile);
      ctx.lineTo(s, i * tile);
      ctx.stroke();
    }
  }

  const glowTex = makeTexture(128, (ctx, s) => {
    const rg = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0, 'rgba(255,246,205,1)');
    rg.addColorStop(0.25, 'rgba(255,232,164,0.7)');
    rg.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, s, s);
  });

  /* ----------------------------- maze ------------------------------- */
  const MAZE_SEED = 0x5eed1234;
  function mazeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mazeRandom = mazeRng(MAZE_SEED);
  const mazeRandInt = (a, b) => Math.floor(a + mazeRandom() * (b - a + 1));
  const mazePick = (arr) => arr[(mazeRandom() * arr.length) | 0];

  function generateMaze() {
    const walls = [];
    for (let x = 0; x < COLS; x++) {
      walls[x] = [];
      for (let z = 0; z < ROWS; z++) walls[x][z] = 1;
    }
    const stack = [[1, 1]];
    walls[1][1] = 0;
    const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const cx = cur[0], cz = cur[1];
      const options = [];
      for (let i = 0; i < dirs.length; i++) {
        const nx = cx + dirs[i][0], nz = cz + dirs[i][1];
        if (nx > 0 && nz > 0 && nx < COLS - 1 && nz < ROWS - 1 && walls[nx][nz] === 1) {
          options.push([nx, nz, dirs[i][0], dirs[i][1]]);
        }
      }
      if (!options.length) {
        stack.pop();
        continue;
      }
      const o = mazePick(options);
      walls[cx + o[2] / 2][cz + o[3] / 2] = 0;
      walls[o[0]][o[1]] = 0;
      stack.push([o[0], o[1]]);
    }
    for (let i = 0; i < 110; i++) {
      const cx = mazeRandInt(1, COLS - 2), cz = mazeRandInt(1, ROWS - 2);
      if (walls[cx][cz] !== 1) continue;
      const horiz = walls[cx - 1][cz] === 0 && walls[cx + 1][cz] === 0;
      const vert = walls[cx][cz - 1] === 0 && walls[cx][cz + 1] === 0;
      if (horiz || vert) walls[cx][cz] = 0;
    }
    for (let i = 0; i < 3; i++) {
      const cx = mazeRandInt(3, COLS - 5), cz = mazeRandInt(3, ROWS - 5);
      for (let x = cx; x < cx + 3; x++) {
        for (let z = cz; z < cz + 3; z++) walls[x][z] = 0;
      }
    }
    const open = [];
    for (let x = 1; x < COLS - 1; x++) {
      for (let z = 1; z < ROWS - 1; z++) {
        if (walls[x][z] === 0) open.push([x, z]);
      }
    }
    return { walls: walls, open: open };
  }

  const maze = generateMaze();
  const walls = maze.walls;
  const openCells = maze.open;

  function cellCenter(cx, cz) {
    return new THREE.Vector3((cx - COLS / 2 + 0.5) * CELL, 0, (cz - ROWS / 2 + 0.5) * CELL);
  }
  function worldToCell(x, z) {
    return [
      clamp(Math.floor(x / CELL + COLS / 2), 0, COLS - 1),
      clamp(Math.floor(z / CELL + ROWS / 2), 0, ROWS - 1)
    ];
  }
  function cellWall(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= COLS || cz >= ROWS) return true;
    return walls[cx][cz] === 1;
  }
  function blockedAt(x, z, radius) {
    const gx = x / CELL + COLS / 2;
    const gz = z / CELL + ROWS / 2;
    const r = radius / CELL;
    const x0 = Math.floor(gx - r), x1 = Math.floor(gx + r);
    const z0 = Math.floor(gz - r), z1 = Math.floor(gz + r);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        if (cellWall(cx, cz)) return true;
      }
    }
    return false;
  }

  /* --------------------------- world build -------------------------- */
  const wallMeshes = [];
  const ambientLights = [];
  const panelMat = new THREE.MeshBasicMaterial({ color: 0xfff0b4 });

  const wallTex = makeTexture(512, paintWallpaper);
  const carpetTex = makeTexture(512, paintCarpet);
  carpetTex.repeat.set(WORLD_W / 6, WORLD_D / 6);
  const ceilTex = makeTexture(512, paintCeiling);
  ceilTex.repeat.set(COLS, ROWS);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.96, metalness: 0.0 });
  const floorMat = new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1.0, metalness: 0.0 });
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.92, metalness: 0.0 });

  const levelGroup = new THREE.Group();
  scene.add(levelGroup);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  levelGroup.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_D), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_H;
  levelGroup.add(ceiling);

  const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
  const panelGeo = new THREE.PlaneGeometry(2.1, 0.62);
  const panelGlowGeo = new THREE.PlaneGeometry(4.4, 1.6);

  for (let x = 0; x < COLS; x++) {
    for (let z = 0; z < ROWS; z++) {
      if (walls[x][z] !== 1) continue;
      const p = cellCenter(x, z);
      const mesh = new THREE.Mesh(wallGeo, wallMat);
      mesh.position.set(p.x, WALL_H / 2, p.z);
      levelGroup.add(mesh);
      wallMeshes.push(mesh);
    }
  }

  for (let i = 0; i < openCells.length; i += 5) {
    const c = openCells[i];
    if (Math.random() > 0.62) continue;
    const p = cellCenter(c[0], c[1]);
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.rotation.x = Math.PI / 2;
    panel.position.set(p.x, WALL_H - 0.055, p.z);
    levelGroup.add(panel);

    const glowPlane = new THREE.Mesh(
      panelGlowGeo,
      new THREE.MeshBasicMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glowPlane.rotation.x = Math.PI / 2;
    glowPlane.position.set(p.x, WALL_H - 0.2, p.z);
    levelGroup.add(glowPlane);
  }

  const hemi = new THREE.HemisphereLight(0xfff0bb, 0x3a3016, 0.85);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffe9a8, 0.18));

  for (let i = 0; i < 6; i++) {
    const c = pick(openCells);
    const p = cellCenter(c[0], c[1]);
    const light = new THREE.PointLight(0xffe2a0, 0.85, 16, 1.4);
    light.position.set(p.x, WALL_H - 0.45, p.z);
    light.userData.base = 0.85;
    scene.add(light);
    ambientLights.push(light);
  }

  let flicker = 1;
  let flickerTimer = 2;
  let flickerBurst = 0;
  function updateFlicker(dt) {
    flickerTimer -= dt;
    if (flickerTimer <= 0) {
      flickerTimer = rand(2.2, 7.5);
      flickerBurst = rand(0.07, 0.26);
    }
    if (flickerBurst > 0) {
      flickerBurst -= dt;
      flicker = Math.random() < 0.5 ? rand(0.55, 0.85) : rand(0.95, 1.05);
    } else {
      flicker = damp(flicker, 1 + Math.sin(performance.now() * 0.0013) * 0.02, 9, dt);
    }
    panelMat.color.setRGB(1 * flicker, 0.941 * flicker, 0.706 * flicker);
    hemi.intensity = 0.85 * (0.9 + 0.1 * flicker);
    for (let i = 0; i < ambientLights.length; i++) {
      ambientLights[i].intensity = ambientLights[i].userData.base * flicker;
    }
  }

  /* ---------------------------- state ------------------------------- */
  const state = {
    started: false,
    paused: true,
    phase: 'menu',
    mode: 'classic',
    difficulty: 'normal',
    duelDone: false,
    round: 0,
    scoreCT: 0,
    scoreT: 0,
    money: 800,
    timer: 0,
    buyLeft: 0,
    kills: 0,
    deaths: 0,
    roundKills: 0
  };

  let buyOpen = false;
  let pauseOpen = false;
  let skinOpen = false;
  let skinReturn = 'start';
  let skinWeapon = 'usp';
  let startVisible = true;

  const spawn0 = cellCenter(openCells[0][0], openCells[0][1]);
  const player = {
    x: spawn0.x,
    z: spawn0.z,
    y: 0,
    vx: 0,
    vz: 0,
    velY: 0,
    onGround: true,
    yaw: 0,
    pitch: 0,
    eye: EYE_STAND,
    crouching: false,
    moving: false,
    hp: 100,
    armor: 0,
    alive: true,
    deathT: 0,
    lostGear: false,
    recoil: 0,
    recoilHold: 0,
    bobT: 0,
    stepT: 0,
    adrenaline: 0,
    lastStepRadius: 0
  };

  let shake = 0;
  let gameTime = 0;
  let bannerT = 0;
  let toastT = 0;
  let keys = {};
  let mouseDown = false;
  let pendingShot = false;

  camera.position.set(player.x, EYE_STAND, player.z);
  camera.rotation.set(0, 0, 0);

  /* --------------------------- weapons ------------------------------ */
  const WEAPONS = {
    knife: {
      id: 'knife', name: 'НОЖ', type: 'melee',
      dmg: 58, head: 1.9, rate: 0.5
    },
    usp: {
      id: 'usp', name: 'USP-S', type: 'gun',
      dmg: 26, head: 4.0, rate: 0.14, mag: 12, reserve: 48,
      reload: 1.9, spread: 0.006, recoil: 0.017, auto: false, sound: 'pistol', price: 200
    },
    ak: {
      id: 'ak', name: 'AK-47', type: 'gun',
      dmg: 34, head: 4.0, rate: 0.1, mag: 30, reserve: 90,
      reload: 2.4, spread: 0.009, recoil: 0.019, auto: true, sound: 'rifle', price: 2700
    },
    awp: {
      id: 'awp', name: 'AWP', type: 'gun',
      dmg: 125, head: 2.5, rate: 1.45, mag: 5, reserve: 25,
      reload: 3.0, spread: 0.03, scopedSpread: 0.0006, recoil: 0.078,
      auto: false, sound: 'awp', price: 4750
    }
  };

  const inv = {
    current: 'usp',
    primary: null,
    reloading: null,
    nextShot: 0,
    scoped: false,
    kick: 0,
    swing: 0,
    flash: 0,
    swayX: 0,
    swayY: 0,
    ammo: {
      usp: { mag: 12, reserve: 48 },
      ak: { mag: 30, reserve: 90 },
      awp: { mag: 5, reserve: 25 }
    }
  };

  /* -------------------------- view models --------------------------- */
  const viewRoot = new THREE.Group();
  camera.add(viewRoot);
  const viewLight = new THREE.PointLight(0xffedc0, 0.55, 4.5, 1);
  viewLight.position.set(0.3, 0.15, 0.15);
  camera.add(viewLight);

  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.42, metalness: 0.78 });
  const gunDark = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.62, metalness: 0.32 });
  const gunWood = new THREE.MeshStandardMaterial({ color: 0x6d4727, roughness: 0.72, metalness: 0.05 });
  const gunOlive = new THREE.MeshStandardMaterial({ color: 0x424732, roughness: 0.62, metalness: 0.24 });
  const gunSteel = new THREE.MeshStandardMaterial({ color: 0xb3bcc0, roughness: 0.34, metalness: 0.9 });
  const handMat = new THREE.MeshStandardMaterial({ color: 0x8f6c4a, roughness: 0.88, metalness: 0.0 });

  function addBox(parent, mat, w, h, d, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(m);
    return m;
  }
  function addCyl(parent, mat, r, len, x, y, z, rx) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    m.position.set(x, y, z);
    m.rotation.x = rx === undefined ? Math.PI / 2 : rx;
    parent.add(m);
    return m;
  }

  function buildUsp() {
    const g = new THREE.Group();
    addBox(g, gunMetal, 0.075, 0.088, 0.30, 0, 0, -0.09);
    addBox(g, gunDark, 0.07, 0.075, 0.11, 0, -0.09, 0.055, -0.28);
    addCyl(g, gunDark, 0.035, 0.21, 0, -0.002, -0.33);
    addBox(g, handMat, 0.085, 0.105, 0.14, 0, -0.105, 0.075, -0.22);
    addBox(g, handMat, 0.075, 0.09, 0.12, -0.005, -0.115, 0.01, -0.3);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, -0.002, -0.45);
    g.add(muzzle);
    return { group: g, muzzle: muzzle };
  }

  function buildAk() {
    const g = new THREE.Group();
    addBox(g, gunMetal, 0.082, 0.10, 0.46, 0, 0, -0.06);
    addBox(g, gunWood, 0.088, 0.088, 0.20, 0, 0.016, -0.28);
    addCyl(g, gunMetal, 0.016, 0.38, 0, 0.012, -0.5);
    addBox(g, gunDark, 0.066, 0.22, 0.13, 0, -0.145, 0.02, 0.3);
    addBox(g, gunWood, 0.072, 0.10, 0.30, 0, -0.004, 0.32);
    addBox(g, gunDark, 0.06, 0.14, 0.08, 0, -0.10, 0.135, -0.35);
    addBox(g, handMat, 0.088, 0.095, 0.12, 0, -0.115, 0.105, -0.26);
    addBox(g, handMat, 0.09, 0.09, 0.15, 0, -0.06, -0.27);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.012, -0.7);
    g.add(muzzle);
    return { group: g, muzzle: muzzle };
  }

  function buildAwp() {
    const g = new THREE.Group();
    addBox(g, gunOlive, 0.086, 0.11, 0.64, 0, 0, -0.05);
    addCyl(g, gunMetal, 0.021, 0.46, 0, 0.012, -0.6);
    addCyl(g, gunDark, 0.05, 0.30, 0, 0.115, -0.09);
    addCyl(g, gunSteel, 0.043, 0.018, 0, 0.115, -0.245);
    addBox(g, gunDark, 0.072, 0.11, 0.09, 0, 0.045, -0.02);
    addBox(g, gunOlive, 0.08, 0.12, 0.30, 0, -0.004, 0.35);
    addBox(g, gunDark, 0.06, 0.13, 0.08, 0, -0.095, 0.145, -0.3);
    addBox(g, handMat, 0.086, 0.095, 0.13, 0, -0.09, 0.12, -0.26);
    addBox(g, handMat, 0.085, 0.085, 0.15, 0, -0.045, -0.22);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.012, -0.84);
    g.add(muzzle);
    return { group: g, muzzle: muzzle };
  }

  function buildKnife() {
    const g = new THREE.Group();
    addBox(g, gunDark, 0.042, 0.06, 0.15, 0, -0.02, 0.06);
    addBox(g, gunSteel, 0.013, 0.08, 0.29, 0, 0.02, -0.17);
    addBox(g, gunSteel, 0.013, 0.05, 0.09, 0, 0.052, -0.29, 0, 0, 0.35);
    addBox(g, handMat, 0.072, 0.09, 0.12, 0, -0.05, 0.075);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.02, -0.34);
    g.add(muzzle);
    return { group: g, muzzle: muzzle };
  }

  const VIEW_BASE = {
    usp: { x: 0.19, y: -0.185, z: -0.36, rx: 0.0, ry: 0.05 },
    ak: { x: 0.2, y: -0.2, z: -0.34, rx: 0.0, ry: 0.04 },
    awp: { x: 0.195, y: -0.2, z: -0.33, rx: 0.0, ry: 0.035 },
    knife: { x: 0.24, y: -0.235, z: -0.3, rx: 0.0, ry: 0.12 }
  };

  const viewModels = {};
  const builders = { usp: buildUsp, ak: buildAk, awp: buildAwp, knife: buildKnife };
  Object.keys(builders).forEach((id) => {
    const vm = builders[id]();
    const flashMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffd89a,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(vm.muzzle.position);
    flash.scale.set(0.45, 0.45, 1);
    flash.visible = false;
    vm.group.add(flash);
    vm.group.visible = false;
    vm.flash = flash;
    viewRoot.add(vm.group);
    viewModels[id] = vm;
    vm.group.traverse((o) => {
      if (o.isMesh) {
        o.userData.baseMat = o.material;
        o.userData.isHand = (o.material === handMat);
      }
    });
  });

  /* ----------------------------- skins ------------------------------ */
  const SKINS = [
    { id: 'factory', name: 'Заводской', tier: 'base', a: '#4a4f55', b: '#191b1f', accent: '#8f979e', pattern: 'metal' },
    { id: 'sand', name: 'Пустынный', tier: 'blue', a: '#c2a76b', b: '#7b6234', accent: '#e5d19a', pattern: 'camo' },
    { id: 'night', name: 'Ночной', tier: 'blue', a: '#2f3942', b: '#11151a', accent: '#5b6c77', pattern: 'camo' },
    { id: 'redline', name: 'Красная линия', tier: 'purple', a: '#191b1f', b: '#2b0b0c', accent: '#e13c33', pattern: 'stripes' },
    { id: 'dragon', name: 'Красный дракон', tier: 'gold', a: '#1d2328', b: '#3d0f0c', accent: '#e8a03a', pattern: 'scales' },
    { id: 'fade', name: 'Синий фейд', tier: 'pink', a: '#1c2f6b', b: '#7a2fb0', accent: '#5fd7ff', pattern: 'fade' },
    { id: 'neon', name: 'Неоновый рейд', tier: 'purple', a: '#140f1f', b: '#1f0838', accent: '#ff2fd0', pattern: 'circuit' },
    { id: 'gold', name: 'Золотой слиток', tier: 'gold', a: '#b8862e', b: '#6b4410', accent: '#ffe08a', pattern: 'metal' },
    { id: 'bloodmoon', name: 'Кровавая луна', tier: 'pink', a: '#24090c', b: '#4a0f14', accent: '#ff3b4f', pattern: 'splatter' },
    { id: 'emerald', name: 'Изумрудный змей', tier: 'purple', a: '#0a2a1c', b: '#102f16', accent: '#32e08a', pattern: 'scales' },
    { id: 'cyber', name: 'Киберпанк', tier: 'pink', a: '#0c1c28', b: '#1a0c28', accent: '#00f0ff', pattern: 'glitch' },
    { id: 'rust', name: 'Ржавчина', tier: 'blue', a: '#6e3d1f', b: '#2f1a0f', accent: '#d3863f', pattern: 'splatter' },
    { id: 'carbon', name: 'Карбон', tier: 'purple', a: '#1a1c1f', b: '#0c0d0f', accent: '#4a4f57', pattern: 'carbon' },
    { id: 'marble', name: 'Мрамор', tier: 'pink', a: '#d8d2c8', b: '#8a847c', accent: '#c8324b', pattern: 'marble' },
    { id: 'volcano', name: 'Вулкан', tier: 'gold', a: '#1a1010', b: '#3b0f06', accent: '#ff7a1c', pattern: 'flame' },
    { id: 'arctic', name: 'Арктика', tier: 'blue', a: '#d7e6ee', b: '#7e9aab', accent: '#ffffff', pattern: 'camo' },
    { id: 'toxic', name: 'Токсик', tier: 'purple', a: '#1b2a0c', b: '#0e1a06', accent: '#9cff2e', pattern: 'splatter' },
    { id: 'quartz', name: 'Розовый кварц', tier: 'pink', a: '#f0d6e2', b: '#b07c96', accent: '#ffe9f2', pattern: 'marble' },
    { id: 'void', name: 'Чёрная дыра', tier: 'gold', a: '#08060c', b: '#1b1030', accent: '#9b5cff', pattern: 'void' },
    { id: 'rainbow', name: 'Радужный', tier: 'gold', a: '#ff3b3b', b: '#2fd7ff', accent: '#ffe14d', pattern: 'rainbow' },
    { id: 'backrooms', name: 'Бэкрумс', tier: 'purple', a: '#c9b76a', b: '#8a7638', accent: '#5b4a1d', pattern: 'stains' },
    { id: 'inferno', name: 'Пламя', tier: 'gold', a: '#2a0d05', b: '#0d0504', accent: '#ffb03a', pattern: 'flame' },
    { id: 'mirage', name: 'Мираж', tier: 'pink', a: '#c98fa6', b: '#5d3a68', accent: '#ffd9c2', pattern: 'waves' },
    { id: 'chrome', name: 'Хром', tier: 'gold', a: '#e7edf1', b: '#707a83', accent: '#ffffff', pattern: 'metal' },
    { id: 'matrix', name: 'Матрица', tier: 'purple', a: '#03130a', b: '#071f10', accent: '#39ff6a', pattern: 'pixel' },
    { id: 'glitch', name: 'Глитч', tier: 'pink', a: '#170b2a', b: '#2b0820', accent: '#00ffc8', pattern: 'glitch' }
  ];
  const SKIN_BY_ID = {};
  SKINS.forEach((s) => { SKIN_BY_ID[s.id] = s; });
  const SKIN_TIERS = {
    base: 'ФАБРИЧНЫЙ', blue: 'ПРОМЫШЛЕННЫЙ', purple: 'ЗАПРЕЩЁННЫЙ',
    pink: 'ЗАСЕКРЕЧЕННЫЙ', gold: 'ТАЙНЫЙ'
  };
  const SKIN_WEAPONS = [
    { id: 'usp', name: 'USP-S' },
    { id: 'ak', name: 'AK-47' },
    { id: 'awp', name: 'AWP' },
    { id: 'knife', name: 'НОЖ' }
  ];
  const skinChoice = { usp: 'factory', ak: 'factory', awp: 'factory', knife: 'factory' };
  const skinTexCache = {};
  const skinPreviewCache = {};
  const skinMatCache = new Map();

  function skinSeed(id) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function skinRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexA(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  function paintSkinPattern(ctx, s, skin) {
    const rnd = skinRng(skinSeed(skin.id));
    const R = (a, b) => a + rnd() * (b - a);
    const A = skin.a, B = skin.b, C = skin.accent;
    const bg = ctx.createLinearGradient(0, 0, s, s);
    bg.addColorStop(0, A);
    bg.addColorStop(0.55, B);
    bg.addColorStop(1, A);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (skin.pattern === 'metal') {
      for (let i = 0; i < 70; i++) {
        ctx.strokeStyle = i % 3 === 0 ? hexA(C, 0.12) : 'rgba(0,0,0,0.12)';
        ctx.lineWidth = R(0.5, 1.6);
        const y = R(0, s);
        ctx.beginPath();
        ctx.moveTo(R(-s * 0.1, s * 0.2), y);
        ctx.lineTo(R(s * 0.8, s * 1.1), y + R(-2, 2));
        ctx.stroke();
      }
    } else if (skin.pattern === 'camo') {
      const cols = [hexA(C, 0.55), hexA(A, 0.7), 'rgba(18,17,12,0.5)', hexA(B, 0.8)];
      for (let i = 0; i < 22; i++) {
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath();
        ctx.ellipse(R(0, s), R(0, s), R(s * 0.04, s * 0.19), R(s * 0.03, s * 0.13), R(0, TAU), 0, TAU);
        ctx.fill();
      }
    } else if (skin.pattern === 'stripes') {
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(-0.62);
      ctx.translate(-s / 2, -s / 2);
      for (let i = -4; i < 22; i++) {
        ctx.fillStyle = i % 2 === 0 ? hexA(C, 0.62) : 'rgba(0,0,0,0.28)';
        ctx.fillRect(i * s / 9, -s * 0.4, s / 18, s * 1.8);
      }
      ctx.restore();
    } else if (skin.pattern === 'scales') {
      ctx.strokeStyle = hexA(C, 0.45);
      ctx.lineWidth = Math.max(1, s / 150);
      const step = s / 11;
      for (let row = 0; row < 12; row++) {
        for (let col = -1; col < 12; col++) {
          const x = col * step + (row % 2) * step * 0.5;
          const y = row * step * 0.62;
          ctx.beginPath();
          ctx.arc(x, y, step * 0.62, 0.08, Math.PI - 0.08);
          ctx.stroke();
        }
      }
    } else if (skin.pattern === 'fade') {
      const fg = ctx.createLinearGradient(0, -s * 0.2, 0, s * 1.1);
      fg.addColorStop(0, 'rgba(0,0,0,0)');
      fg.addColorStop(0.55, hexA(C, 0.34));
      fg.addColorStop(1, hexA(C, 0.75));
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = hexA(C, R(0.05, 0.3));
        ctx.fillRect(R(0, s), R(0, s), R(1, 3), R(1, 3));
      }
    } else if (skin.pattern === 'circuit') {
      ctx.strokeStyle = hexA(C, 0.6);
      ctx.fillStyle = hexA(C, 0.8);
      ctx.lineWidth = Math.max(1, s / 170);
      for (let i = 0; i < 17; i++) {
        let x = R(0, s), y = R(0, s);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          if (rnd() < 0.5) x += R(-s * 0.18, s * 0.18); else y += R(-s * 0.18, s * 0.18);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.4, s / 80), 0, TAU);
        ctx.fill();
      }
    } else if (skin.pattern === 'splatter') {
      for (let i = 0; i < 28; i++) {
        const x = R(0, s), y = R(0, s), r = R(s * 0.008, s * 0.065);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.38)' : hexA(C, R(0.3, 0.7));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        if (i % 4 === 0) {
          ctx.fillRect(x - r * 0.16, y, r * 0.32, r * R(1.6, 3.6));
        }
      }
    } else if (skin.pattern === 'glitch') {
      for (let y = 0; y < s; y += R(3, 11)) {
        if (rnd() < 0.62) {
          ctx.fillStyle = rnd() < 0.5 ? hexA(C, R(0.15, 0.55)) : 'rgba(0,0,0,0.4)';
          ctx.fillRect(R(-s * 0.1, s * 0.35), y, R(s * 0.2, s * 0.8), R(1, 4));
        }
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = hexA(C, 0.12);
        ctx.fillRect(R(0, s), R(0, s), R(s * 0.05, s * 0.3), R(s * 0.08, s * 0.3));
      }
    } else if (skin.pattern === 'carbon') {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = Math.max(1, s / 120);
      const step = s / 16;
      for (let x = -s; x < s * 2; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + s, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, s); ctx.lineTo(x + s, 0); ctx.stroke();
      }
      ctx.strokeStyle = hexA(C, 0.16);
      for (let x = -s; x < s * 2; x += step * 2) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + s, s); ctx.stroke();
      }
    } else if (skin.pattern === 'marble') {
      for (let i = 0; i < 15; i++) {
        ctx.strokeStyle = i % 3 === 0 ? hexA(C, 0.5) : 'rgba(25,22,20,0.28)';
        ctx.lineWidth = R(1, s / 55);
        const x = R(-s * 0.2, s * 1.2), y = R(-s * 0.2, s * 1.2);
        ctx.beginPath();
        ctx.moveTo(x - s * 0.6, y);
        ctx.bezierCurveTo(x - s * 0.1, y - s * 0.3, x + s * 0.1, y + s * 0.35, x + s * 0.7, y - s * 0.05);
        ctx.stroke();
      }
    } else if (skin.pattern === 'flame') {
      for (let i = 0; i < 13; i++) {
        const x = R(0, s), w = R(s * 0.035, s * 0.12);
        const h = R(s * 0.3, s * 0.95);
        const fg = ctx.createLinearGradient(0, s, 0, s - h);
        fg.addColorStop(0, hexA(C, 0.05));
        fg.addColorStop(0.45, hexA(C, 0.55));
        fg.addColorStop(1, 'rgba(255,245,190,0.4)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(x - w, s);
        ctx.quadraticCurveTo(x - w * 0.7, s - h * 0.55, x, s - h);
        ctx.quadraticCurveTo(x + w * 0.8, s - h * 0.5, x + w, s);
        ctx.closePath();
        ctx.fill();
      }
    } else if (skin.pattern === 'waves') {
      for (let i = 0; i < 14; i++) {
        ctx.strokeStyle = i % 2 ? hexA(C, 0.32) : 'rgba(25,15,25,0.3)';
        ctx.lineWidth = R(1, 3);
        ctx.beginPath();
        for (let x = 0; x <= s; x += s / 32) {
          const y = s * 0.07 + i * s * 0.07 + Math.sin((x / s) * TAU * 2 + i * 0.7) * s * 0.018;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if (skin.pattern === 'pixel') {
      const step = s / 26;
      for (let y = 0; y < s; y += step) {
        for (let x = 0; x < s; x += step) {
          if (rnd() < 0.34) {
            ctx.fillStyle = rnd() < 0.5 ? hexA(C, R(0.18, 0.75)) : 'rgba(0,0,0,0.35)';
            ctx.fillRect(x, y, step * 0.86, step * 0.86);
          }
        }
      }
    } else if (skin.pattern === 'void') {
      const vg = ctx.createRadialGradient(s * 0.5, s * 0.5, 0, s * 0.5, s * 0.5, s * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0.95)');
      vg.addColorStop(0.55, hexA(C, 0.28));
      vg.addColorStop(0.78, 'rgba(0,0,0,0.82)');
      vg.addColorStop(1, hexA(C, 0.2));
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = hexA(C, 0.35);
      ctx.lineWidth = 1;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU + R(-0.05, 0.05);
        ctx.beginPath();
        ctx.moveTo(s * 0.5 + Math.cos(a) * s * 0.22, s * 0.5 + Math.sin(a) * s * 0.22);
        ctx.lineTo(s * 0.5 + Math.cos(a) * s, s * 0.5 + Math.sin(a) * s);
        ctx.stroke();
      }
    } else if (skin.pattern === 'rainbow') {
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = 'hsla(' + (i * 27) + ',75%,55%,0.55)';
        ctx.fillRect(i * s / 14, 0, s / 14 + 1, s);
      }
      const dg = ctx.createLinearGradient(0, 0, s, s);
      dg.addColorStop(0, 'rgba(0,0,0,0.6)');
      dg.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      dg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, s, s);
    } else if (skin.pattern === 'stains') {
      for (let i = 0; i < 18; i++) {
        const x = R(0, s), y = R(0, s), r = R(s * 0.03, s * 0.18);
        const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
        sg.addColorStop(0, hexA(C, R(0.15, 0.35)));
        sg.addColorStop(1, hexA(C, 0));
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        if (i % 3 === 0) {
          ctx.fillStyle = hexA(C, 0.2);
          ctx.fillRect(x - 1, y, 2, r * R(0.8, 2.2));
        }
      }
      ctx.strokeStyle = 'rgba(60,48,18,0.18)';
      ctx.lineWidth = 1;
      for (let x = 0; x < s; x += s / 14) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
      }
    } else if (skin.pattern === 'web') {
      ctx.strokeStyle = hexA(C, 0.35);
      ctx.lineWidth = Math.max(1, s / 200);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU;
        ctx.beginPath();
        ctx.moveTo(s * 0.15, s * 0.15);
        ctx.lineTo(s * 0.15 + Math.cos(a) * s, s * 0.15 + Math.sin(a) * s);
        ctx.stroke();
      }
      for (let r = s * 0.08; r < s * 1.1; r += s * 0.09) {
        ctx.beginPath();
        ctx.arc(s * 0.15, s * 0.15, r, 0, TAU);
        ctx.stroke();
      }
    }

    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(R(0, s), R(0, s), 1, 1);
    }
    const vignette = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.2, s * 0.5, s * 0.5, s * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, s, s);
  }

  function skinPreview(skin) {
    if (skinPreviewCache[skin.id]) return skinPreviewCache[skin.id];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    paintSkinPattern(c.getContext('2d'), 128, skin);
    skinPreviewCache[skin.id] = c.toDataURL('image/png');
    return skinPreviewCache[skin.id];
  }

  function skinTexture(skin) {
    if (skinTexCache[skin.id]) return skinTexCache[skin.id];
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    paintSkinPattern(c.getContext('2d'), 256, skin);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = maxAniso;
    skinTexCache[skin.id] = tex;
    return tex;
  }

  function skinMaterial(skin, base) {
    const key = skin.id + '|' + base.uuid;
    if (skinMatCache.has(key)) return skinMatCache.get(key);
    const metal = base === gunSteel ? 0.9 : (base === gunMetal ? 0.7 : (base === gunDark ? 0.35 : 0.1));
    const rough = base === gunSteel ? 0.3 : (base === gunMetal ? 0.42 : (base === gunDark ? 0.6 : 0.72));
    const mat = new THREE.MeshStandardMaterial({
      map: skinTexture(skin),
      color: 0xffffff,
      metalness: metal,
      roughness: rough
    });
    skinMatCache.set(key, mat);
    return mat;
  }

  function applySkinTo(weaponId) {
    const vm = viewModels[weaponId];
    if (!vm) return;
    const skin = SKIN_BY_ID[skinChoice[weaponId]] || SKIN_BY_ID.factory;
    vm.group.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.isHand) { o.material = handMat; return; }
      o.material = skin.id === 'factory' ? o.userData.baseMat : skinMaterial(skin, o.userData.baseMat);
    });
  }

  function applyAllSkins() {
    Object.keys(viewModels).forEach(applySkinTo);
  }

  function loadSkinPrefs() {
    try {
      const raw = localStorage.getItem(SKIN_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      SKIN_WEAPONS.forEach((w) => {
        if (saved && SKIN_BY_ID[saved[w.id]]) skinChoice[w.id] = saved[w.id];
      });
    } catch (err) {}
  }

  function saveSkinPrefs() {
    try {
      localStorage.setItem(SKIN_KEY, JSON.stringify(skinChoice));
    } catch (err) { /* ignore */ }
  }

  function renderSkinGrid() {
    const skin = SKIN_BY_ID[skinChoice[skinWeapon]] || SKIN_BY_ID.factory;
    const weapon = SKIN_WEAPONS.find((w) => w.id === skinWeapon) || SKIN_WEAPONS[0];
    ui.skinGrid.innerHTML = '';
    SKINS.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'skin-card tier-' + s.tier + (skinChoice[skinWeapon] === s.id ? ' equipped' : '');
      card.innerHTML =
        '<div class="skin-preview" style="background-image:url(' + skinPreview(s) + ')"></div>' +
        '<div class="skin-info">' +
          '<div class="skin-name">' + s.name + '</div>' +
          '<div class="skin-tier">' + SKIN_TIERS[s.tier] + '</div>' +
        '</div>' +
        (skinChoice[skinWeapon] === s.id ? '<div class="skin-equipped">ВЫБРАНО</div>' : '');
      card.addEventListener('click', () => {
        skinChoice[skinWeapon] = s.id;
        applySkinTo(skinWeapon);
        saveSkinPrefs();
        sfx.buy();
        updateHUD();
        renderSkinGrid();
      });
      ui.skinGrid.appendChild(card);
    });
    ui.skinInfo.textContent = weapon.name + ' · ' + skin.name;
    ui.skinCount.textContent = SKINS.length + ' скинов';
  }

  function renderSkinTabs(weaponId) {
    if (weaponId) skinWeapon = weaponId;
    ui.skinTabs.innerHTML = '';
    SKIN_WEAPONS.forEach((w) => {
      const b = document.createElement('button');
      b.className = 'skin-tab' + (w.id === skinWeapon ? ' active' : '');
      b.textContent = w.name;
      b.addEventListener('click', () => renderSkinTabs(w.id));
      ui.skinTabs.appendChild(b);
    });
    renderSkinGrid();
  }

  function openSkins(from) {
    if (skinOpen) return;
    skinOpen = true;
    skinReturn = from === 'pause' ? 'pause' : 'start';
    if (skinReturn === 'pause') ui.pauseEl.classList.add('hidden');
    ui.skinsEl.classList.remove('hidden');
    const weapon = SKIN_WEAPONS.some((w) => w.id === inv.current) ? inv.current : 'usp';
    renderSkinTabs(weapon);
    refreshPause();
  }

  function closeSkins() {
    if (!skinOpen) return;
    skinOpen = false;
    ui.skinsEl.classList.add('hidden');
    if (skinReturn === 'pause') ui.pauseEl.classList.remove('hidden');
    skinReturn = 'start';
    refreshPause();
  }

  const flashLight = new THREE.PointLight(0xffd9a0, 0, 9, 1.6);
  flashLight.position.set(0.15, -0.05, -0.7);
  camera.add(flashLight);

  const raycaster = new THREE.Raycaster();
  const decalGeo = new THREE.CircleGeometry(0.07, 7);
  const decalMat = new THREE.MeshBasicMaterial({
    color: 0x0b0905,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide
  });
  const decals = [];
  const tracers = [];

  /* ----------------------------- bots ------------------------------- */
  const bots = [];
  const botHitMeshes = [];

  const botAssets = {
    torsoGeo: new THREE.BoxGeometry(0.5, 0.72, 0.26),
    headGeo: new THREE.SphereGeometry(0.155, 14, 12),
    limbGeo: new THREE.BoxGeometry(0.13, 0.62, 0.13),
    legGeo: new THREE.BoxGeometry(0.16, 0.8, 0.16),
    eyeGeo: new THREE.SphereGeometry(0.028, 8, 8),
    grinGeo: new THREE.TorusGeometry(0.072, 0.013, 6, 14, Math.PI),
    gunGeo: new THREE.BoxGeometry(0.09, 0.14, 0.44),
    bodyMat: new THREE.MeshStandardMaterial({ color: 0x101013, roughness: 0.92, metalness: 0.04 }),
    eyeMat: new THREE.MeshBasicMaterial({ color: 0xfff8d8 }),
    grinMat: new THREE.MeshBasicMaterial({ color: 0xe9dfb8 }),
    gunMat: new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.55, metalness: 0.5 }),
    creatureMat: new THREE.MeshStandardMaterial({
      color: 0xd8d2bd, roughness: 0.92, metalness: 0.02,
      emissive: 0x191710, emissiveIntensity: 0.35
    }),
    creatureEyeMat: new THREE.MeshBasicMaterial({ color: 0xff2a12 }),
    flashMat: new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffb066,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  };

  const botProfiles = [];

  function botDiff() {
    return DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
  }

  function resetBotProfiles() {
    botProfiles.length = 0;
  }

  function clearBotProfiles() {
    botProfiles.length = 0;
  }

  function ensureBotProfile(i) {
    while (botProfiles.length <= i) {
      botProfiles.push({
        money: state.mode === 'duel' ? 1100 : 800,
        primary: 'usp',
        armor: false,
        kills: 0,
        lastShopRound: 0
      });
    }
    return botProfiles[i];
  }

  function botShop(profile) {
    if (profile.lastShopRound === state.round) return;
    profile.lastShopRound = state.round;
    const diff = botDiff();
    const luck = diff.buy;
    if (profile.armor) profile.money -= 200;
    if (state.round >= 3 && profile.money >= 4750 && Math.random() < 0.4 * luck) {
      profile.money -= 4750;
      profile.primary = 'awp';
    } else if (profile.money >= 2700) {
      profile.money -= 2700;
      profile.primary = 'ak';
    }
    if (state.round >= 2 && profile.money >= 650) {
      profile.money -= 650;
      profile.armor = true;
    } else if (profile.money < 200) {
      profile.armor = false;
    }
  }

  function prepareBotProfiles(count) {
    const diff = botDiff();
    if (state.round > 1) {
      const income = Math.round((1150 + state.round * 320) * diff.income * (state.mode === 'duel' ? 1.2 : 1));
      for (let i = 0; i < botProfiles.length; i++) {
        botProfiles[i].money = Math.min(MAX_MONEY, botProfiles[i].money + income);
      }
    }
    for (let i = 0; i < count; i++) {
      const p = ensureBotProfile(i);
      botShop(p);
    }
  }

  function createBot(x, z, profile) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(botAssets.torsoGeo, botAssets.bodyMat);
    torso.position.y = 1.13;
    const head = new THREE.Mesh(botAssets.headGeo, botAssets.bodyMat);
    head.position.y = 1.63;
    head.scale.set(1, 1.08, 1);
    const eyeL = new THREE.Mesh(botAssets.eyeGeo, botAssets.eyeMat);
    eyeL.position.set(-0.055, 1.655, 0.128);
    const eyeR = new THREE.Mesh(botAssets.eyeGeo, botAssets.eyeMat);
    eyeR.position.set(0.055, 1.655, 0.128);
    const grin = new THREE.Mesh(botAssets.grinGeo, botAssets.grinMat);
    grin.position.set(0, 1.557, 0.134);
    grin.rotation.z = Math.PI;
    grin.scale.set(1.15, 0.85, 1);

    const armL = new THREE.Group();
    armL.position.set(-0.31, 1.44, 0);
    const armLMesh = new THREE.Mesh(botAssets.limbGeo, botAssets.bodyMat);
    armLMesh.position.y = -0.31;
    armL.add(armLMesh);

    const armR = new THREE.Group();
    armR.position.set(0.31, 1.44, 0);
    const armRMesh = new THREE.Mesh(botAssets.limbGeo, botAssets.bodyMat);
    armRMesh.position.y = -0.31;
    armR.add(armRMesh);
    armR.rotation.x = -0.95;

    const legL = new THREE.Group();
    legL.position.set(-0.14, 0.78, 0);
    const legLMesh = new THREE.Mesh(botAssets.legGeo, botAssets.bodyMat);
    legLMesh.position.y = -0.39;
    legL.add(legLMesh);

    const legR = new THREE.Group();
    legR.position.set(0.14, 0.78, 0);
    const legRMesh = new THREE.Mesh(botAssets.legGeo, botAssets.bodyMat);
    legRMesh.position.y = -0.39;
    legR.add(legRMesh);

    const gun = new THREE.Mesh(botAssets.gunGeo, botAssets.gunMat);
    gun.position.set(0.32, 1.3, 0.3);
    const primary = profile ? profile.primary : 'usp';
    gun.scale.set(1, 1, primary === 'awp' ? 1.6 : (primary === 'ak' ? 1.14 : 0.72));

    if (profile && profile.armor) {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.32), botAssets.gunMat);
      vest.position.y = 1.16;
      g.add(vest);
    }

    const flash = new THREE.Sprite(botAssets.flashMat.clone());
    flash.position.set(0.34, 1.32, 0.55);
    flash.scale.set(0.55, 0.55, 1);
    flash.visible = false;

    g.add(torso, head, eyeL, eyeR, grin, armL, armR, legL, legR, gun, flash);
    g.position.set(x, 0, z);
    scene.add(g);

    const diff = botDiff();
    const bot = {
      x: x, z: z,
      group: g,
      head: head, torso: torso,
      armL: armL, armR: armR,
      legL: legL, legR: legR,
      gun: gun,
      flash: flash,
      hp: 100,
      dead: false,
      removed: false,
      deathT: 0,
      walk: rand(0, TAU),
      idle: rand(0, TAU),
      flashT: 0,
      shootTimer: rand(0.7, 1.5) * diff.rate,
      pathTimer: rand(0, 0.5),
      path: [],
      los: false,
      alertT: 0,
      noiseX: x,
      noiseZ: z,
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafeT: rand(0.7, 1.6),
      weapon: primary,
      armor: !!(profile && profile.armor),
      profile: profile || null,
      speed: ((state.mode === 'duel' ? 2.45 : 2.25) + Math.min(1.25, state.round * (state.mode === 'duel' ? 0.07 : 0.055))) * diff.speed,
      aim: ((state.mode === 'duel' ? 1.0 : 0.9) + Math.min(0.5, state.round * 0.02)) * diff.aim,
      dmgMul: ((state.mode === 'duel' ? 1.05 : 1) + Math.min(0.6, state.round * 0.03)) * diff.dmg
    };

    g.traverse((o) => {
      if (o.isMesh) {
        o.userData.bot = bot;
        o.userData.part = (o === head || o === eyeL || o === eyeR || o === grin) ? 'head' : 'body';
        botHitMeshes.push(o);
      }
    });
    return bot;
  }

  function clearBots() {
    for (let i = 0; i < bots.length; i++) scene.remove(bots[i].group);
    bots.length = 0;
    botHitMeshes.length = 0;
  }

  /* --------------------------- the creature ------------------------- */
  function buildCreature() {
    const g = new THREE.Group();
    const mat = botAssets.creatureMat;
    const eyeMat = botAssets.creatureEyeMat;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.5, 0.3), mat);
    torso.position.y = 1.35;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), mat);
    head.position.y = 2.28;
    head.scale.set(1, 1.2, 1);

    const eyes = [];
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eyeL.position.set(-0.085, 2.32, 0.19);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eyeR.position.set(0.085, 2.32, 0.19);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.021, 6, 16, Math.PI), eyeMat);
    mouth.position.set(0, 2.16, 0.2);
    mouth.rotation.z = Math.PI;
    eyes.push(eyeL, eyeR, mouth);

    const limbs = [];
    function limb(px, py, len, rz) {
      const grp = new THREE.Group();
      grp.position.set(px, py, 0);
      grp.rotation.z = rz;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, len, 0.15), mat);
      m.position.y = -len / 2;
      grp.add(m);
      limbs.push(grp);
      return grp;
    }
    const armL = limb(-0.42, 1.95, 1.32, 0.24);
    const armR = limb(0.42, 1.95, 1.32, -0.24);
    const legL = limb(-0.19, 0.66, 1.1, 0.05);
    const legR = limb(0.19, 0.66, 1.1, -0.05);

    g.add(torso, head, eyeL, eyeR, mouth, armL, armR, legL, legR);
    g.scale.set(0.82, 1.22, 0.82);
    scene.add(g);

    const creature = {
      x: 0, z: 0,
      group: g,
      head: head, torso: torso,
      armL: armL, armR: armR, legL: legL, legR: legR,
      eyes: eyes,
      invulnerable: true,
      creature: true,
      dead: false,
      removed: false,
      hp: Infinity,
      walk: 0,
      idle: 0,
      speedBase: 3.1,
      lastHeart: 0
    };
    g.traverse((o) => {
      if (o.isMesh) {
        o.userData.bot = creature;
        o.userData.part = 'body';
        botHitMeshes.push(o);
      }
    });
    return creature;
  }

  const creature = buildCreature();
  creature.group.visible = false;

  function placeCreature() {
    const far = [];
    for (let i = 0; i < openCells.length; i++) {
      const c = openCells[i];
      const p = cellCenter(c[0], c[1]);
      const d = Math.hypot(p.x - player.x, p.z - player.z);
      if (d > 34 && d < 70) far.push(c);
    }
    let cx, cz;
    if (far.length) {
      const c = pick(far);
      cx = c[0]; cz = c[1];
    } else {
      cx = clamp(worldToCell(player.x, player.z)[0] + 6, 1, COLS - 2);
      cz = clamp(worldToCell(player.x, player.z)[1] + 6, 1, ROWS - 2);
    }
    const center = cellCenter(cx, cz);
    creature.x = center.x;
    creature.z = center.z;
    creature.group.position.set(center.x, 0, center.z);
    creature.group.rotation.y = 0;
    creature.group.visible = true;
    creature.active = true;
    creature.encounterStarted = false;
    creature.agro = 0;
    creature.retreat = 0;
    player.adrenaline = 0;
  }

  function updateCreature(dt) {
    if (!state.started || state.phase !== 'live' || !player.alive || !creature.active) {
      if (creature.active) creature.group.visible = seekVisible();
      return;
    }
    const dx = player.x - creature.x;
    const dz = player.z - creature.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const los = dist < 40 && hasLOS(creature.x, creature.z, player.x, player.z);
    const diff = botDiff();
    const senseRange = 25 * diff.hear * diff.speed;

    if (dist < senseRange || los) {
      if (!creature.encounterStarted) {
        creature.encounterStarted = true;
        creature.agro = 1;
        player.adrenaline = 2.05;
        sfx.stinger();
        showBanner('ОНО ТЕБЯ ВИДИТ', 'Беги! Его нельзя убить — сзади есть выход', 3.4);
      }
    }

    const pursuing = creature.encounterStarted && dist > 17;
    if (pursuing) player.adrenaline = Math.max(player.adrenaline, 0.7);

    if ((creature.encounterStarted && dist > 34)) {
      creature.retreat -= dt;
      if (creature.retreat <= 0) creature.active = false;
    }

    if (creature.active) {
      const speed = creature.speedBase * diff.speed * (los ? 1.05 : 0.86);
      const nx = creature.x + (dx / dist) * speed * dt;
      if (!blockedAt(nx, creature.z, 0.4)) creature.x = nx;
      else {
        const side = (creature.x + -dz / dist * speed * dt);
        if (!blockedAt(side, creature.z, 0.4)) creature.x = side;
      }
      const nz = creature.z + (dz / dist) * speed * dt;
      if (!blockedAt(creature.x, nz, 0.4)) creature.z = nz;

      creature.group.rotation.y = angleLerp(
        creature.group.rotation.y,
        Math.atan2(dx, dz),
        1 - Math.exp(-5 * dt)
      );
      creature.walk += dt * 7.4;
      const swing = Math.sin(creature.walk) * 0.7;
      creature.legL.rotation.x = swing;
      creature.legR.rotation.x = -swing;
      creature.armL.rotation.x = -1.1 + swing * 0.4;
      creature.armR.rotation.x = -1.1 - swing * 0.4;
      creature.group.position.set(creature.x, Math.sin(creature.walk * 0.5) * 0.04, creature.z);

      if (dist < 2.5) {
        sfx.heartbeat();
        creature.lastHeart = gameTime;
        damagePlayer(rand(20, 30) * diff.dmg);
      } else if (pursuing && gameTime - creature.lastHeart > 0.55) {
        creature.lastHeart = gameTime;
        sfx.heartbeat();
      }
    }
  }

  function seekVisible() {
    return true;
  }

  function spawnBots(count) {
    prepareBotProfiles(count);
    const candidates = [];
    for (let i = 0; i < openCells.length; i++) {
      const p = cellCenter(openCells[i][0], openCells[i][1]);
      if (Math.hypot(p.x - player.x, p.z - player.z) > 16) candidates.push(openCells[i]);
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = t;
    }
    let placed = 0;
    for (let i = 0; i < candidates.length && placed < count; i++) {
      const p = cellCenter(candidates[i][0], candidates[i][1]);
      let ok = true;
      for (let b = 0; b < bots.length; b++) {
        if (Math.hypot(bots[b].x - p.x, bots[b].z - p.z) < 3.5) { ok = false; break; }
      }
      if (!ok) continue;
      bots.push(createBot(p.x, p.z, botProfiles[placed]));
      placed++;
    }
    let guard = 0;
    while (placed < count && guard < 200) {
      guard++;
      const c = pick(openCells);
      const p = cellCenter(c[0], c[1]);
      if (Math.hypot(p.x - player.x, p.z - player.z) < 8) continue;
      bots.push(createBot(p.x, p.z, botProfiles[placed]));
      placed++;
    }
  }

  function aliveBots() {
    let n = 0;
    for (let i = 0; i < bots.length; i++) {
      if (!bots[i].dead && !bots[i].removed && !bots[i].invulnerable) n++;
    }
    return n;
  }

  function removeBotHitMeshes(bot) {
    for (let i = botHitMeshes.length - 1; i >= 0; i--) {
      if (botHitMeshes[i].userData.bot === bot) botHitMeshes.splice(i, 1);
    }
  }

  /* --------------------------- pathfinding -------------------------- */
  function bfsPath(sx, sz, tx, tz) {
    if (sx === tx && sz === tz) return [];
    const prev = new Int32Array(COLS * ROWS);
    prev.fill(-1);
    const start = sx + sz * COLS;
    const target = tx + tz * COLS;
    prev[start] = start;
    const q = [start];
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === target) break;
      const cx = cur % COLS;
      const cz = (cur / COLS) | 0;
      const neighbors = [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]];
      for (let i = 0; i < 4; i++) {
        const nx = neighbors[i][0], nz = neighbors[i][1];
        if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
        if (walls[nx][nz] === 1) continue;
        const idx = nx + nz * COLS;
        if (prev[idx] !== -1) continue;
        prev[idx] = cur;
        q.push(idx);
      }
    }
    if (prev[target] === -1) return null;
    const path = [];
    let cur = target;
    while (cur !== start) {
      path.push([cur % COLS, (cur / COLS) | 0]);
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }

  function hasLOS(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (CELL * 0.4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const c = worldToCell(ax + dx * t, az + dz * t);
      if (walls[c[0]][c[1]] === 1) return false;
    }
    return true;
  }

  /* --------------------------- gameplay ----------------------------- */
  function refillMags() {
    const ids = ['usp', 'ak', 'awp'];
    for (let i = 0; i < ids.length; i++) {
      const w = WEAPONS[ids[i]];
      const a = inv.ammo[ids[i]];
      const take = Math.min(w.mag - a.mag, a.reserve);
      a.mag += take;
      a.reserve -= take;
    }
    if (inv.ammo.usp.mag === 0 && inv.ammo.usp.reserve === 0) {
      inv.ammo.usp.mag = 12;
      inv.ammo.usp.reserve = 48;
    }
  }

  function equip(id, silent) {
    if (!WEAPONS[id]) return;
    if ((id === 'ak' || id === 'awp') && inv.primary !== id) return;
    inv.current = id;
    inv.reloading = null;
    inv.scoped = false;
    inv.nextShot = 0;
    inv.swing = 0;
    for (const k in viewModels) viewModels[k].group.visible = (k === id);
    updateScopeUI();
    if (!silent) sfx.equip();
    updateHUD();
  }

  function updateScopeUI() {
    const scoped = inv.scoped && inv.current === 'awp';
    ui.scopeEl.classList.toggle('show', scoped);
    ui.crosshair.classList.toggle('hidden', scoped || !player.alive);
  }

  function toggleScope() {
    if (inv.current !== 'awp' || !player.alive) return;
    inv.scoped = !inv.scoped;
    updateScopeUI();
  }

  function startReload() {
    const w = WEAPONS[inv.current];
    if (!w || w.type !== 'gun' || inv.reloading) return;
    const a = inv.ammo[w.id];
    if (a.mag >= w.mag || a.reserve <= 0) return;
    inv.reloading = { id: w.id, t: 0, dur: w.reload };
    sfx.reload();
  }

  function updateReload(dt) {
    if (!inv.reloading) return;
    inv.reloading.t += dt;
    if (inv.reloading.t >= inv.reloading.dur) {
      const w = WEAPONS[inv.reloading.id];
      const a = inv.ammo[w.id];
      const take = Math.min(w.mag - a.mag, a.reserve);
      a.mag += take;
      a.reserve -= take;
      inv.reloading = null;
      sfx.reloadEnd();
      updateHUD();
    }
  }

  function fireGun() {
    const w = WEAPONS[inv.current];
    if (!w || w.type !== 'gun') return;
    const a = inv.ammo[w.id];
    if (gameTime < inv.nextShot || inv.reloading) return;
    if (a.mag <= 0) {
      inv.nextShot = gameTime + 0.25;
      sfx.empty();
      if (a.reserve > 0) startReload();
      return;
    }
    inv.nextShot = gameTime + w.rate;
    a.mag--;
    inv.flash = 0.055;
    inv.kick = Math.min(1.3, inv.kick + (w.id === 'awp' ? 0.95 : 0.42));
    const kick = (inv.scoped ? w.recoil * 1.25 : w.recoil) * 0.55;
    player.recoil = Math.min(0.6, player.recoil + kick);
    player.recoilHold = 0.2;
    player.pitch = clamp(player.pitch + kick * 0.75, -1.45, 1.45);
    sfx.gun(w.sound);
    makeNoise(player.x, player.z, w.id === 'awp' ? 56 : 38);
    castBullet(w);
    updateHUD();
  }

  function castBullet(w) {
    const spread = (inv.scoped && w.scopedSpread !== undefined) ? w.scopedSpread : w.spread;
    scene.updateMatrixWorld(true);
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);
    if (spread > 0) {
      const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      const s = spread + (player.moving ? 0.012 : 0) + (player.onGround ? 0 : 0.05);
      dir.addScaledVector(right, rand(-s, s)).addScaledVector(up, rand(-s, s)).normalize();
    }
    raycaster.set(origin, dir);
    raycaster.far = 150;
    const targets = wallMeshes.concat(botHitMeshes);
    const hits = raycaster.intersectObjects(targets, false);
    const end = origin.clone().addScaledVector(dir, 90);
    if (hits.length) {
      const hit = hits[0];
      end.copy(hit.point);
      const obj = hit.object;
      if (obj.userData.bot) {
        damageBot(obj.userData.bot, w, obj.userData.part === 'head');
      } else {
        const normal = (hit.face && hit.face.normal)
          ? hit.face.normal.clone().transformDirection(obj.matrixWorld).normalize()
          : dir.clone().negate();
        addDecal(hit.point, normal);
      }
    }
    const vm = viewModels[inv.current];
    let from;
    if (inv.scoped || !vm) {
      from = origin.clone().addScaledVector(dir, 0.25);
      from.y -= 0.04;
    } else {
      from = new THREE.Vector3();
      vm.muzzle.getWorldPosition(from);
    }
    addTracer(from, end, 0xffe6a0, 0.75);
    if (vm) {
      vm.flash.visible = true;
      vm.flash.material.rotation = Math.random() * TAU;
      vm.flash.scale.setScalar(rand(0.4, 0.6));
    }
    flashLight.intensity = 1.6;
  }

  function knifeAttack() {
    if (gameTime < inv.nextShot) return;
    inv.nextShot = gameTime + 0.55;
    inv.swing = 1;
    sfx.melee();
    makeNoise(player.x, player.z, 9);
    scene.updateMatrixWorld(true);
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(dir);
    raycaster.set(origin, dir);
    raycaster.far = 2.7;
    const hits = raycaster.intersectObjects(botHitMeshes, false);
    if (hits.length) {
      const obj = hits[0].object;
      damageBot(obj.userData.bot, WEAPONS.knife, obj.userData.part === 'head');
    }
  }

  function damageBot(bot, w, head) {
    if (!bot || bot.dead) return;
    if (bot.invulnerable) {
      sfx.clink();
      showHitmarker(false);
      if (!bot.hitToastT || gameTime > bot.hitToastT) {
        bot.hitToastT = gameTime + 1.6;
        showToast('ЕГО НЕЛЬЗЯ УБИТЬ', 1.1);
      }
      return;
    }
    const amount = w.dmg * (head ? w.head : 1) * (bot.armor ? 0.72 : 1);
    bot.hp -= amount;
    sfx.hit(head);
    showHitmarker(head);
    if (bot.hp <= 0) killBot(bot, head);
  }

  function killBot(bot, head) {
    if (bot.dead) return;
    bot.dead = true;
    bot.deathT = 0;
    bot.flash.visible = false;
    removeBotHitMeshes(bot);
    state.kills++;
    state.roundKills++;
    state.money = Math.min(MAX_MONEY, state.money + (head ? 400 : 300) * botDiff().income);
    if (bot.profile) {
      bot.profile.kills++;
      bot.profile.money = Math.min(MAX_MONEY, bot.profile.money + 320 + state.round * 95);
    }
    addKillFeed(head);
    sfx.kill();
    updateHUD();
    if (ui.scoreboard.classList.contains('show')) renderScoreboard();
  }

  /* ---------------------------- noise ------------------------------- */
  function alertBots(x, z, radius) {
    if (!(radius > 0)) return;
    const busy = noiseBots;
    busy.length = 0;
    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (bot.dead || bot.removed || bot.invulnerable) continue;
      const d = Math.hypot(bot.x - x, bot.z - z);
      if (d < radius) busy.push({ bot: bot, d: d });
    }
    busy.sort((a, b) => a.d - b.d);
    for (let i = 0; i < busy.length; i++) {
      const bot = busy[i].bot;
      bot.alertT = 6;
      bot.noiseX = x;
      bot.noiseZ = z;
      bot.pathTimer = 0;
      bot.hasNoise = true;
    }
  }
  const noiseBots = [];

  function makeNoise(x, z, radius) {
    alertBots(x, z, radius * botDiff().hear);
  }

  function damagePlayer(dmg) {
    if (!player.alive) return;
    let d = dmg;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, d * 0.5);
      player.armor -= absorbed;
      d -= absorbed;
    }
    player.hp -= d;
    shake = Math.min(1.2, shake + 0.45);
    flashDamage();
    sfx.hurt();
    if (player.hp <= 0) {
      player.hp = 0;
      playerDie();
    }
    updateHUD();
  }

  function playerDie() {
    if (!player.alive) return;
    player.alive = false;
    player.deathT = 0;
    player.lostGear = true;
    state.deaths++;
    mouseDown = false;
    pendingShot = false;
    inv.scoped = false;
    inv.reloading = null;
    updateScopeUI();
    sfx.death();
    if (buyOpen) closeBuy(true);
    endRound(false, 'ВЫ ПОГИБЛИ', 'Смайлеры победили');
  }

  /* ---------------------------- effects ----------------------------- */
  function addTracer(from, to, color, opacity) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    tracers.push({ line: line, life: 0.075, max: 0.075, opacity: opacity });
  }

  function addDecal(point, normal) {
    const m = new THREE.Mesh(decalGeo, decalMat);
    m.position.copy(point).addScaledVector(normal, 0.012);
    m.lookAt(point.clone().add(normal));
    m.rotateZ(rand(0, TAU));
    scene.add(m);
    decals.push(m);
    if (decals.length > 70) scene.remove(decals.shift());
  }

  function updateEffects(dt) {
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
      } else {
        t.line.material.opacity = t.opacity * (t.life / t.max);
      }
    }
    inv.kick = damp(inv.kick, 0, 11, dt);
    inv.flash = Math.max(0, inv.flash - dt);
    inv.swing = Math.max(0, inv.swing - dt * 3.4);
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 26);
    for (const id in viewModels) {
      const vm = viewModels[id];
      vm.flash.visible = vm.group.visible && viewRoot.visible && inv.flash > 0.001;
    }
  }

  function showHitmarker(head) {
    ui.hitmarker.classList.remove('show');
    ui.hitmarker.classList.toggle('head', head);
    void ui.hitmarker.offsetWidth;
    ui.hitmarker.classList.add('show');
  }

  function flashDamage() {
    ui.damageEl.classList.remove('flash');
    void ui.damageEl.offsetWidth;
    ui.damageEl.classList.add('flash');
  }

  /* ------------------------- player update -------------------------- */
  function updatePlayer(dt) {
    player.crouching = !!(keys['ControlLeft'] || keys['ControlRight'] || keys['KeyC']);
    const walking = !!(keys['ShiftLeft'] || keys['ShiftRight']);
    const rush = player.adrenaline > 0;
    let speed = player.crouching ? 2.7 : (walking ? 2.6 : 5.4);
    if (inv.scoped) speed *= 0.4;
    if (rush) speed = Math.max(speed, 9.6);

    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    let wx = 0, wz = 0;
    if (keys['KeyW']) { wx -= sy; wz -= cy; }
    if (keys['KeyS']) { wx += sy; wz += cy; }
    if (keys['KeyA']) { wx -= cy; wz += sy; }
    if (keys['KeyD']) { wx += cy; wz -= sy; }
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    player.vx = damp(player.vx, wx * speed, 16, dt);
    player.vz = damp(player.vz, wz * speed, 16, dt);
    player.moving = Math.hypot(player.vx, player.vz) > 0.35;

    if (keys['Space'] && player.onGround) {
      player.velY = 5.9;
      player.onGround = false;
    }
    player.velY -= 19 * dt;
    player.y += player.velY * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.velY = 0;
      player.onGround = true;
    }

    const r = 0.42;
    const nx = player.x + player.vx * dt;
    if (!blockedAt(nx, player.z, r)) player.x = nx;
    const nz = player.z + player.vz * dt;
    if (!blockedAt(player.x, nz, r)) player.z = nz;

    if (player.moving && player.onGround) {
      player.bobT += dt * (player.crouching ? 7 : (walking ? 7.5 : 11.5)) * (rush ? 1.35 : 1);
      if (!walking) {
        player.stepT -= dt;
        if (player.stepT <= 0) {
          sfx.step();
          const falloff = clamp(1 - player.lastStepRadius / 14, 0.22, 1);
          const radius = (player.crouching ? 6.5 : 19) * falloff;
          makeNoise(player.x, player.z, radius);
          player.lastStepRadius = radius;
          player.stepT = (player.crouching ? 0.62 : 0.4) / (rush ? 1.3 : 1);
        }
      }
    } else {
      player.stepT = 0;
      player.lastStepRadius = 0;
    }
  }

  function updateDeath(dt) {
    player.deathT += dt;
    player.vx = damp(player.vx, 0, 6, dt);
    player.vz = damp(player.vz, 0, 6, dt);
    player.moving = false;
    player.velY -= 19 * dt;
    player.y += player.velY * dt;
    if (player.y <= 0) { player.y = 0; player.velY = 0; }
  }

  function updateCamera(dt) {
    const eyeTarget = player.crouching ? EYE_CROUCH : EYE_STAND;
    player.eye = damp(player.eye, eyeTarget, 12, dt);
    let eye = player.eye;
    if (!player.alive) eye = lerp(eye, 0.26, clamp(player.deathT * 1.7, 0, 1));

    if (player.recoilHold > 0) {
      player.recoilHold -= dt;
    } else if (player.recoil > 0) {
      const rec = Math.min(player.recoil, dt * 2.3);
      player.recoil -= rec;
      player.pitch = clamp(player.pitch - rec, -1.45, 1.45);
    }

    shake = Math.max(0, shake - dt * 2.4);
    const sh = shake * 0.55;
    const bobAmt = (player.moving && player.onGround && player.alive) ? 1 : 0;
    const bobY = Math.sin(player.bobT) * 0.028 * bobAmt;
    const bobX = Math.cos(player.bobT * 0.5) * 0.022 * bobAmt;

    camera.position.set(
      player.x + bobX * 0.45 + rand(-sh, sh) * 0.07,
      player.y + eye + bobY + rand(-sh, sh) * 0.06,
      player.z + rand(-sh, sh) * 0.07
    );

    let roll = bobX * 0.025;
    if (!player.alive) roll += clamp(player.deathT * 1.15, 0, 0.9);
    camera.rotation.set(player.pitch, player.yaw, roll);

    const targetFov = (inv.scoped && inv.current === 'awp') ? 32 : 75;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = damp(camera.fov, targetFov, 14, dt);
      camera.updateProjectionMatrix();
    }
  }

  function updateViewModel(dt) {
    const w = WEAPONS[inv.current];
    if (!w) return;
    viewRoot.visible = player.alive && !(inv.scoped && inv.current === 'awp');
    if (!viewRoot.visible) return;

    const base = VIEW_BASE[inv.current] || VIEW_BASE.usp;
    const bobAmt = (player.moving && player.onGround && player.alive) ? 1 : 0;
    const bobX = Math.cos(player.bobT * 0.5) * 0.014 * bobAmt;
    const bobY = Math.abs(Math.sin(player.bobT)) * 0.011 * bobAmt;
    inv.swayX = damp(inv.swayX, 0, 8, dt);
    inv.swayY = damp(inv.swayY, 0, 8, dt);

    const reload = inv.reloading
      ? Math.sin(Math.PI * clamp(inv.reloading.t / inv.reloading.dur, 0, 1))
      : 0;

    viewRoot.position.set(
      base.x + bobX + inv.swayX * 0.8,
      base.y + bobY + inv.swayY * 0.8 - reload * 0.19 + Math.sin(gameTime * 1.8) * 0.0035,
      base.z + inv.kick * 0.11
    );
    viewRoot.rotation.set(
      base.rx + inv.kick * 0.24 - reload * 0.6 + inv.swing * 1.1,
      base.ry + inv.swayX * 1.6,
      -inv.swing * 0.55 - inv.swayX * 0.9
    );
  }

  /* --------------------------- bot logic ---------------------------- */
  function botShoot(bot, dist) {
    bot.flashT = 0.06;
    const gun = BOT_GUNS[bot.weapon] || BOT_GUNS.usp;
    sfx.gun(gun.sound, clamp(1 - dist / 46, 0.12, 0.7));
    const yaw = bot.group.rotation.y;
    const from = new THREE.Vector3(
      bot.x + Math.sin(yaw) * 0.5 + Math.cos(yaw) * 0.34,
      1.32,
      bot.z + Math.cos(yaw) * 0.5 - Math.sin(yaw) * 0.34
    );
    const target = new THREE.Vector3(
      player.x,
      player.y + (player.crouching ? 0.95 : 1.35),
      player.z
    );
    const acc = clamp(gun.acc - dist * gun.falloff, 0.14, 0.78) * bot.aim;
    const hit = Math.random() < acc;
    if (!hit) {
      target.x += rand(-1.8, 1.8);
      target.y += rand(-1.0, 1.4);
      target.z += rand(-1.8, 1.8);
    }
    addTracer(from, target, gun.tracer, 0.5);
    if (hit) damagePlayer(rand(gun.dmgMin, gun.dmgMax) * bot.dmgMul);
  }

  function updateBots(dt) {
    const combat = state.phase === 'live' && player.alive;

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (bot.removed) continue;

      if (bot.dead) {
        bot.deathT += dt;
        bot.group.rotation.x = damp(bot.group.rotation.x, -Math.PI / 2, 5.5, dt);
        bot.group.position.y = damp(bot.group.position.y, 0.12, 3, dt);
        if (bot.deathT > 2.7) {
          scene.remove(bot.group);
          bot.removed = true;
        }
        continue;
      }

      bot.flashT = Math.max(0, bot.flashT - dt);
      bot.flash.visible = bot.flashT > 0;
      bot.idle += dt;
      bot.group.position.y = Math.sin(bot.idle * 2.1) * 0.014;

      if (!combat) {
        const decay = 1 - Math.exp(-8 * dt);
        bot.legL.rotation.x = lerp(bot.legL.rotation.x, 0, decay);
        bot.legR.rotation.x = lerp(bot.legR.rotation.x, 0, decay);
        bot.armL.rotation.x = lerp(bot.armL.rotation.x, 0, decay);
        continue;
      }

      const dx = player.x - bot.x;
      const dz = player.z - bot.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const los = dist < 32 && hasLOS(bot.x, bot.z, player.x, player.z);
      bot.los = los;
      if (los) { bot.alertT = 6; bot.noiseX = player.x; bot.noiseZ = player.z; }
      if (bot.alertT > 0) bot.alertT -= dt;

      const hunting = !los && bot.alertT > 0;
      const seekX = hunting ? bot.noiseX : player.x;
      const seekZ = hunting ? bot.noiseZ : player.z;
      const seekDist = Math.hypot(seekX - bot.x, seekZ - bot.z) || 0.001;

      if (los) {
        bot.group.rotation.y = angleLerp(
          bot.group.rotation.y,
          Math.atan2(dx, dz),
          1 - Math.exp(-9 * dt)
        );
      }

      bot.pathTimer -= dt;
      if (bot.pathTimer <= 0) {
        bot.pathTimer = rand(0.45, 0.8);
        const bc = worldToCell(bot.x, bot.z);
        if (hunting) {
          const nc = worldToCell(seekX, seekZ);
          bot.path = bfsPath(bc[0], bc[1], nc[0], nc[1]) || [];
        } else {
          const pc = worldToCell(player.x, player.z);
          bot.path = bfsPath(bc[0], bc[1], pc[0], pc[1]) || [];
        }
      }

      let vx = 0, vz = 0;
      if (hunting && seekDist < 1.4) {
        bot.alertT = 0;
      } else if (los && dist < 17) {
        if (dist > 8.5) {
          vx = (dx / dist) * bot.speed * 0.72;
          vz = (dz / dist) * bot.speed * 0.72;
        }
        bot.strafeT -= dt;
        if (bot.strafeT <= 0) {
          bot.strafeT = rand(0.8, 1.8);
          bot.strafeDir *= -1;
        }
        vx += (-dz / dist) * bot.speed * 0.42 * bot.strafeDir;
        vz += (dx / dist) * bot.speed * 0.42 * bot.strafeDir;
      } else {
        while (bot.path.length) {
          const c = bot.path[0];
          const bc = worldToCell(bot.x, bot.z);
          if (bc[0] === c[0] && bc[1] === c[1]) bot.path.shift();
          else break;
        }
        if (bot.path.length) {
          const target = cellCenter(bot.path[0][0], bot.path[0][1]);
          const ax = target.x - bot.x;
          const az = target.z - bot.z;
          const d = Math.hypot(ax, az) || 0.001;
          vx = (ax / d) * bot.speed;
          vz = (az / d) * bot.speed;
          if (!los) {
            bot.group.rotation.y = angleLerp(
              bot.group.rotation.y,
              Math.atan2(ax, az),
              1 - Math.exp(-11 * dt)
            );
          }
        } else if ((hunting ? seekDist : dist) > 0.4) {
          const ux = (hunting ? seekX - bot.x : dx) / (hunting ? seekDist : dist);
          const uz = (hunting ? seekZ - bot.z : dz) / (hunting ? seekDist : dist);
          vx = ux * bot.speed;
          vz = uz * bot.speed;
        }
      }

      const r = 0.42;
      const nx = bot.x + vx * dt;
      if (!blockedAt(nx, bot.z, r)) bot.x = nx;
      const nz = bot.z + vz * dt;
      if (!blockedAt(bot.x, nz, r)) bot.z = nz;

      if (los && dist < 28) {
        const gun = BOT_GUNS[bot.weapon] || BOT_GUNS.usp;
        bot.shootTimer -= dt;
        if (bot.shootTimer <= 0) {
          botShoot(bot, dist);
          bot.shootTimer = rand(gun.rateMin, gun.rateMax) * botDiff().rate;
        }
      } else {
        bot.shootTimer = Math.max(bot.shootTimer, 0.3);
      }

      const vmag = Math.hypot(vx, vz);
      bot.walk += dt * (vmag + 0.4) * 2.3;
      const swing = Math.sin(bot.walk) * 0.52;
      bot.legL.rotation.x = swing;
      bot.legR.rotation.x = -swing;
      bot.armL.rotation.x = -swing * 0.7;
      bot.armR.rotation.x = -0.95 + swing * 0.15;

      bot.group.position.x = bot.x;
      bot.group.position.z = bot.z;
    }

    for (let i = 0; i < bots.length; i++) {
      const a = bots[i];
      if (a.dead || a.removed) continue;
      for (let j = i + 1; j < bots.length; j++) {
        const b = bots[j];
        if (b.dead || b.removed) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < 1.0) {
          const push = (1.0 - d) * 0.5;
          const ux = dx / d, uz = dz / d;
          if (!blockedAt(a.x - ux * push, a.z - uz * push, 0.4)) { a.x -= ux * push; a.z -= uz * push; }
          if (!blockedAt(b.x + ux * push, b.z + uz * push, 0.4)) { b.x += ux * push; b.z += uz * push; }
        }
      }
    }
  }

  function updateFiring() {
    if (!player.alive || state.phase !== 'live') { pendingShot = false; return; }
    if (document.pointerLockElement !== ui.canvas) return;
    const w = WEAPONS[inv.current];
    if (!w) return;
    if (w.type === 'melee') {
      if (pendingShot && gameTime >= inv.nextShot) {
        pendingShot = false;
        knifeAttack();
      }
      return;
    }
    if (inv.reloading) return;
    if (!mouseDown && !pendingShot) return;
    if (!w.auto && !pendingShot) return;
    if (gameTime < inv.nextShot) return;
    pendingShot = false;
    fireGun();
  }

  /* ---------------------------- rounds ------------------------------ */
  function startRound() {
    const duel = state.mode === 'duel';
    state.round++;
    state.phase = 'freeze';
    state.timer = duel ? 5 : 7;
    state.buyLeft = duel ? DUEL_BUY_TIME : BUY_TIME;
    state.roundKills = 0;

    player.hp = 100;
    player.alive = true;
    player.deathT = 0;
    player.pitch = 0;
    player.recoil = 0;
    player.recoilHold = 0;
    player.vx = 0;
    player.vz = 0;
    player.velY = 0;
    player.y = 0;
    player.onGround = true;
    player.eye = EYE_STAND;
    player.crouching = false;
    player.moving = false;
    player.bobT = 0;
    player.stepT = 0;
    player.adrenaline = 0;
    player.lastStepRadius = 0;
    shake = 0;

    if (player.lostGear) {
      inv.primary = null;
      player.armor = 0;
      inv.ammo.usp = { mag: 12, reserve: 48 };
      inv.ammo.ak = { mag: 30, reserve: 90 };
      inv.ammo.awp = { mag: 5, reserve: 25 };
      player.lostGear = false;
    }
    refillMags();

    const sp = pick(openCells);
    const cp = cellCenter(sp[0], sp[1]);
    player.x = cp.x;
    player.z = cp.z;
    player.yaw = rand(-Math.PI, Math.PI);

    inv.reloading = null;
    inv.scoped = false;
    inv.nextShot = 0;
    equip(inv.primary || 'usp', true);

    clearBots();
    spawnBots(duel ? 1 : Math.min(8, state.round + 1));

    player.adrenaline = 0;
    player.lastStepRadius = 0;
    if (!duel && state.round >= 2) placeCreature();
    else if (creature) creature.active = false;

    camera.fov = 75;
    camera.updateProjectionMatrix();
    updateScopeUI();
    showBanner(
      duel ? 'ДУЭЛЬ · РАУНД ' + state.round : 'РАУНД ' + state.round,
      duel ? 'До 5 побед · один смайлер · B — магазин' : (state.round === 1 ? 'B — магазин · устраните всех смайлеров' : 'Закупка открыта · B'),
      2.6
    );
    sfx.roundStart();
    updateHUD();
    renderScoreboard();
  }

  function endRound(win, title, sub) {
    if (state.phase === 'ended' || state.phase === 'menu') return;
    state.phase = 'ended';
    state.timer = 5;
    if (win) {
      state.scoreCT++;
      state.money = Math.min(MAX_MONEY, state.money + 3000);
      showBanner(title, sub + ' · +$3000', 3.4);
      sfx.roundWin();
    } else {
      state.scoreT++;
      state.money = Math.min(MAX_MONEY, state.money + 1400);
      showBanner(title, sub + ' · +$1400', 3.4);
      sfx.roundLose();
    }
    if (state.mode === 'duel' && !state.duelDone && (state.scoreCT >= DUEL_TARGET || state.scoreT >= DUEL_TARGET)) {
      state.duelDone = true;
      state.timer = 7;
      showBanner(
        win ? 'ДУЭЛЬ ВЫИГРАНА' : 'ДУЭЛЬ ПРОИГРАНА',
        'Счёт ' + state.scoreCT + ' : ' + state.scoreT + ' · новый матч через 7 секунд',
        5.5
      );
    }
    if (buyOpen) closeBuy(true);
    updateHUD();
    renderScoreboard();
  }

  function updateRound(dt) {
    if (!state.started) return;
    if (state.phase === 'freeze') {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.phase = 'live';
        state.timer = state.mode === 'duel' ? DUEL_TIME : ROUND_TIME;
        showBanner('В БОЙ!', state.mode === 'duel' ? 'Противник уже ищет вас' : 'Устраните всех смайлеров', 1.5);
        sfx.roundStart();
      }
    } else if (state.phase === 'live') {
      state.timer -= dt;
      state.buyLeft = Math.max(0, state.buyLeft - dt);
      if (player.alive && aliveBots() === 0) {
        endRound(true, 'РАУНД ВЫИГРАН', 'Все смайлеры устранены');
      } else if (state.timer <= 0) {
        endRound(false, 'ВРЕМЯ ВЫШЛО', 'Смайлеры выжили');
      }
    } else if (state.phase === 'ended') {
      state.timer -= dt;
      if (state.timer <= 0) {
        if (state.mode === 'duel' && state.duelDone) {
          state.duelDone = false;
          state.scoreCT = 0;
          state.scoreT = 0;
          state.round = 0;
          state.kills = 0;
          state.deaths = 0;
          state.money = 800;
          player.lostGear = true;
        }
        startRound();
      }
    }
  }

  /* ----------------------------- buy -------------------------------- */
  const BUY_ITEMS = [
    { id: 'armor', name: 'БРОНЯ + ШЛЕМ', desc: '100 брони · вдвое снижает урон', price: 650 },
    { id: 'ak', name: 'AK-47', desc: '30 патронов · автоматический огонь', price: 2700 },
    { id: 'awp', name: 'AWP', desc: 'Снайперка · убивает с одного попадания', price: 4750 },
    { id: 'ammo', name: 'БОЕПРИПАСЫ', desc: 'Полный запас для всего оружия', price: 200 }
  ];

  function canBuyNow() {
    return state.phase === 'freeze' || (state.phase === 'live' && state.buyLeft > 0);
  }

  function isOwned(id) {
    if (id === 'armor') return player.armor >= 100;
    if (id === 'ak') return inv.primary === 'ak';
    if (id === 'awp') return inv.primary === 'awp';
    if (id === 'ammo') {
      return inv.ammo.usp.reserve >= WEAPONS.usp.reserve &&
        inv.ammo.ak.reserve >= WEAPONS.ak.reserve &&
        inv.ammo.awp.reserve >= WEAPONS.awp.reserve;
    }
    return false;
  }

  function renderBuyMenu() {
    ui.buyMoney.textContent = state.money;
    ui.buyGrid.innerHTML = '';
    const canBuy = canBuyNow();
    BUY_ITEMS.forEach((item, i) => {
      const owned = isOwned(item.id);
      const el = document.createElement('div');
      el.className = 'buy-card' + ((state.money < item.price || owned || !canBuy) ? ' disabled' : '');
      el.innerHTML =
        '<div class="buy-key">' + (i + 1) + '</div>' +
        '<div class="buy-name">' + item.name + '</div>' +
        '<div class="buy-desc">' + item.desc + '</div>' +
        '<div class="buy-price">$' + item.price + '</div>' +
        (owned ? '<div class="buy-owned">КУПЛЕНО</div>' : '');
      el.addEventListener('click', () => buyItem(item.id));
      ui.buyGrid.appendChild(el);
    });
    ui.buyInfo.textContent = canBuy ? 'Закупка открыта · клик или 1–4' : 'Закупка закрыта — ждите следующего раунда';
    ui.buyInfo.classList.toggle('warn', !canBuy);
  }

  function buyItem(id) {
    if (!state.started || !player.alive) return;
    if (!canBuyNow()) { showToast('ЗАКУПКА ЗАКРЫТА'); sfx.deny(); return; }
    const item = BUY_ITEMS.find((x) => x.id === id);
    if (!item) return;
    if (isOwned(id)) { showToast('УЖЕ КУПЛЕНО'); sfx.deny(); return; }
    if (state.money < item.price) { showToast('НЕДОСТАТОЧНО ДЕНЕГ'); sfx.deny(); return; }
    state.money -= item.price;
    if (id === 'armor') {
      player.armor = 100;
    } else if (id === 'ak' || id === 'awp') {
      inv.primary = id;
      inv.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
      equip(id, true);
    } else if (id === 'ammo') {
      inv.ammo.usp.reserve = WEAPONS.usp.reserve;
      inv.ammo.ak.reserve = WEAPONS.ak.reserve;
      inv.ammo.awp.reserve = WEAPONS.awp.reserve;
    }
    sfx.buy();
    renderBuyMenu();
    updateHUD();
  }

  function openBuy() {
    if (!state.started || !player.alive || buyOpen) return;
    if (!canBuyNow()) {
      showToast('ЗАКУПКА ЗАКРЫТА');
      sfx.deny();
      return;
    }
    buyOpen = true;
    ui.buyEl.classList.remove('hidden');
    renderBuyMenu();
    document.exitPointerLock();
    refreshPause();
  }

  function closeBuy(force) {
    if (!buyOpen) return;
    buyOpen = false;
    ui.buyEl.classList.add('hidden');
    refreshPause();
    if (!force) requestLock();
  }

  function toggleBuy() {
    if (buyOpen) closeBuy();
    else openBuy();
  }

  /* ------------------------------ HUD ------------------------------- */
  function showBanner(title, sub, dur) {
    ui.bannerTitle.textContent = title;
    ui.bannerSub.textContent = sub || '';
    ui.banner.classList.add('show');
    bannerT = dur || 2.4;
  }

  function showToast(msg, dur) {
    ui.toastEl.textContent = msg;
    ui.toastEl.classList.add('show');
    toastT = dur || 1.6;
  }

  function updateBanner(dt) {
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) ui.banner.classList.remove('show');
    }
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) ui.toastEl.classList.remove('show');
    }
  }

  function addKillFeed(head) {
    const el = document.createElement('div');
    el.className = 'kf';
    el.innerHTML = '<span class="kf-you">ВЫ</span><span class="kf-ico">✕</span>' +
      '<span class="kf-enemy">СМАЙЛЕР</span>' +
      (head ? '<span class="kf-hs">HS</span>' : '');
    ui.killfeed.prepend(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 5000);
  }

  function updateHUD() {
    ui.scoreCT.textContent = state.scoreCT;
    ui.scoreT.textContent = state.scoreT;
    ui.moneyVal.textContent = state.money;
    ui.hpVal.textContent = Math.max(0, Math.ceil(player.hp));
    ui.armorVal.textContent = Math.max(0, Math.ceil(player.armor));
    ui.hpStat.classList.toggle('low', player.hp <= 30);

    const chased = creature.active && creature.encounterStarted;
    ui.chaseEl.classList.toggle('show', chased && player.alive && state.phase === 'live');
    if (chased && player.alive && state.phase === 'live') {
      const cd = Math.hypot(player.x - creature.x, player.z - creature.z);
      ui.chaseEl.textContent = cd < 8 ? 'БЕГИ! ОНО РЯДОМ' : 'ОНО ОХОТИТСЯ ЗА ТОБОЙ';
    }

    const w = WEAPONS[inv.current];
    if (w) {
      ui.weaponName.textContent = w.name;
      ui.skinName.textContent = (SKIN_BY_ID[skinChoice[w.id]] || SKIN_BY_ID.factory).name.toUpperCase();
      if (w.type === 'melee') {
        ui.magVal.textContent = '—';
        ui.reserveVal.textContent = '';
        ui.ammoSep.style.display = 'none';
        ui.ammoEl.classList.remove('low');
      } else {
        const a = inv.ammo[w.id];
        ui.magVal.textContent = a.mag;
        ui.reserveVal.textContent = a.reserve;
        ui.ammoSep.style.display = '';
        ui.ammoEl.classList.toggle('low', a.mag <= Math.max(1, Math.ceil(w.mag * 0.25)));
      }
    }

    const t = Math.max(0, Math.ceil(state.timer));
    ui.timer.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    ui.timer.classList.toggle('low', state.phase === 'live' && t <= 10);
    if (state.phase === 'freeze') ui.roundLabel.textContent = state.mode === 'duel' ? 'ЗАКУПКА · 1×1' : 'ЗАКУПКА';
    else if (state.phase === 'ended') ui.roundLabel.textContent = 'КОНЕЦ РАУНДА';
    else if (state.phase === 'menu') ui.roundLabel.textContent = 'РАУНД —';
    else if (state.mode === 'duel') ui.roundLabel.textContent = 'ДУЭЛЬ · РАУНД ' + state.round;
    else ui.roundLabel.textContent = 'РАУНД ' + state.round + ' · ' + botDiff().name;

    const scoped = inv.scoped && inv.current === 'awp';
    ui.crosshair.classList.toggle('hidden', scoped || !player.alive);
    let gap = 5;
    if (w && w.type === 'gun' && !scoped) {
      gap = 5 + w.spread * 650 + player.recoil * 110 +
        (player.moving ? 2.5 : 0) + (player.onGround ? 0 : 7);
    }
    ui.crosshair.style.setProperty('--gap', gap.toFixed(1) + 'px');
  }

  function renderScoreboard() {
    const duel = state.mode === 'duel';
    ui.scoreboard.innerHTML =
      '<div class="sb-panel">' +
        '<div class="sb-title">' + (duel ? 'BACKROOMS // 1×1 ДУЭЛЬ · ДО ' + DUEL_TARGET + ' ПОБЕД' : 'BACKROOMS // GLOBAL OFFENSIVE · ' + botDiff().name) + '</div>' +
        '<div class="sb-score"><b class="ct">CT ' + state.scoreCT + '</b> &nbsp;:&nbsp; <b class="t">' + state.scoreT + ' T</b></div>' +
        '<table>' +
          '<tr><th>ИГРОК</th><th>ФРАГИ</th><th>СМЕРТИ</th><th>ДЕНЬГИ</th></tr>' +
          '<tr><td class="you">ВЫ</td><td>' + state.kills + '</td><td>' + state.deaths + '</td><td>$' + state.money + '</td></tr>' +
          '<tr><td class="enemy">СМАЙЛЕРЫ</td><td colspan="2">' + (duel ? (aliveBots() ? '1 противник' : 'нет') : aliveBots() + ' живых') + '</td><td>—</td></tr>' +
        '</table>' +
      '</div>';
  }

  function showScoreboard(v) {
    ui.scoreboard.classList.toggle('show', v);
    if (v) renderScoreboard();
  }

  /* --------------------------- pause / lock ------------------------- */
  function refreshPause() {
    state.paused = !state.started || buyOpen || pauseOpen || skinOpen;
    sfx.setVolume(state.paused ? 0.22 : 0.55);
  }

  function requestLock() {
    try {
      const p = ui.canvas.requestPointerLock();
      if (p && p.catch) {
        p.catch(() => {
          if (state.started) {
            pauseOpen = true;
            ui.pauseEl.classList.remove('hidden');
            refreshPause();
          }
        });
      }
    } catch (err) {
      if (state.started) {
        pauseOpen = true;
        ui.pauseEl.classList.remove('hidden');
        refreshPause();
      }
    }
  }

  function setMode(mode, persist) {
    state.mode = mode === 'duel' ? 'duel' : 'classic';
    ui.modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
    if (persist !== false) {
      try { localStorage.setItem(MODE_KEY, state.mode); } catch (err) { /* ignore */ }
    }
  }

  function loadModePref() {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'duel' || saved === 'classic') setMode(saved, false);
    } catch (err) { /* ignore */ }
  }

  function setDifficulty(id, persist) {
    state.difficulty = DIFFICULTY[id] ? id : 'normal';
    ui.diffBtns.forEach((b) => b.classList.toggle('active', b.dataset.diff === state.difficulty));
    if (persist !== false) {
      try { localStorage.setItem(DIFF_KEY, state.difficulty); } catch (err) { /* ignore */ }
    }
  }

  function loadDifficultyPref() {
    try {
      const saved = localStorage.getItem(DIFF_KEY);
      if (DIFFICULTY[saved]) setDifficulty(saved, false);
    } catch (err) { /* ignore */ }
  }

  function beginMatch() {
    if (state.started) return;
    sfx.init();
    state.started = true;
    startVisible = false;
    ui.startEl.classList.add('hidden');

    state.money = 800;
    state.scoreCT = 0;
    state.scoreT = 0;
    state.round = 0;
    state.kills = 0;
    state.deaths = 0;
    state.roundKills = 0;
    state.duelDone = false;
    clearBotProfiles();
    applyAllSkins();

    inv.primary = null;
    inv.current = 'usp';
    inv.ammo.usp = { mag: 12, reserve: 48 };
    inv.ammo.ak = { mag: 30, reserve: 90 };
    inv.ammo.awp = { mag: 5, reserve: 25 };
    inv.reloading = null;
    inv.scoped = false;
    inv.nextShot = 0;
    player.armor = 0;
    player.lostGear = false;

    pauseOpen = false;
    refreshPause();
    requestLock();
    startRound();
    updateHUD();
  }

  /* ----------------------------- input ------------------------------ */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      if (state.started) showScoreboard(true);
      return;
    }
    if (skinOpen) {
      if (e.code === 'Escape' || e.code === 'KeyB') {
        e.preventDefault();
        closeSkins();
      }
      return;
    }
    if (buyOpen) {
      if (e.code === 'Escape' || e.code === 'KeyB') {
        e.preventDefault();
        closeBuy();
      } else if (/^Digit[1-4]$/.test(e.code)) {
        e.preventDefault();
        buyItem(BUY_ITEMS[Number(e.code.slice(5)) - 1].id);
      }
      return;
    }
    if (!state.started) {
      if (e.code === 'Enter') beginMatch();
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (pauseOpen) {
        requestLock();
      } else if (document.pointerLockElement === ui.canvas) {
        document.exitPointerLock();
      } else {
        pauseOpen = true;
        ui.pauseEl.classList.remove('hidden');
        refreshPause();
      }
      return;
    }
    keys[e.code] = true;
    if (state.paused || e.repeat) return;
    if (e.code === 'KeyB') {
      e.preventDefault();
      openBuy();
    } else if (e.code === 'KeyR') {
      startReload();
    } else if (e.code === 'Digit1') {
      equip('usp');
    } else if (e.code === 'Digit2') {
      if (inv.primary) equip(inv.primary);
    } else if (e.code === 'Digit3') {
      equip('knife');
    } else if (e.code === 'Space' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'Tab') showScoreboard(false);
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== ui.canvas) return;
    const sens = 0.0021 * ((inv.scoped && inv.current === 'awp') ? 0.55 : 1);
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    player.yaw -= dx * sens;
    player.pitch = clamp(player.pitch - dy * sens, -1.45, 1.45);
    inv.swayX = clamp(inv.swayX - dx * 0.0009, -0.05, 0.05);
    inv.swayY = clamp(inv.swayY - dy * 0.0009, -0.05, 0.05);
  });

  ui.canvas.addEventListener('mousedown', (e) => {
    if (!state.started || state.paused) return;
    if (document.pointerLockElement !== ui.canvas) {
      requestLock();
      return;
    }
    if (e.button === 0) {
      mouseDown = true;
      pendingShot = true;
    } else if (e.button === 2) {
      e.preventDefault();
      toggleScope();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouseDown = false;
      pendingShot = false;
    }
  });

  ui.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === ui.canvas;
    if (locked) {
      pauseOpen = false;
      ui.pauseEl.classList.add('hidden');
      mouseDown = false;
      pendingShot = false;
    } else if (state.started && !buyOpen && !skinOpen) {
      pauseOpen = true;
      ui.pauseEl.classList.remove('hidden');
      mouseDown = false;
      pendingShot = false;
      keys = {};
    }
    refreshPause();
  });

  window.addEventListener('blur', () => {
    keys = {};
    mouseDown = false;
    pendingShot = false;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  ui.startBtn.addEventListener('click', beginMatch);
  ui.resumeBtn.addEventListener('click', () => {
    if (state.started) requestLock();
  });
  ui.skinsBtn.addEventListener('click', () => openSkins('start'));
  ui.pauseSkinsBtn.addEventListener('click', () => openSkins('pause'));
  ui.skinsClose.addEventListener('click', closeSkins);
  ui.modeBtns.forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  });
  ui.diffBtns.forEach((b) => {
    b.addEventListener('click', () => setDifficulty(b.dataset.diff));
  });

  /* ----------------------------- loop ------------------------------- */
  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    updateFlicker(dt);

    if (!state.paused) {
      gameTime += dt;
      updateRound(dt);
      if (state.started) {
        if (player.alive) updatePlayer(dt);
        else updateDeath(dt);
        updateBots(dt);
        updateCreature(dt);
        updateReload(dt);
        updateFiring();
        updateEffects(dt);
        updateCamera(dt);
        updateViewModel(dt);
        updateHUD();
        updateBanner(dt);
      }
    }
    renderer.render(scene, camera);
  }

  window.BR = {
    state: state,
    player: player,
    inv: inv,
    bots: bots,
    WEAPONS: WEAPONS,
    beginMatch: beginMatch,
    startRound: startRound,
    endRound: endRound,
    fireGun: fireGun,
    knifeAttack: knifeAttack,
    damageBot: damageBot,
    damagePlayer: damagePlayer,
    equip: equip,
    spawnBots: spawnBots,
    openBuy: openBuy,
    closeBuy: closeBuy,
    showBanner: showBanner,
    SKINS: SKINS,
    skinChoice: skinChoice,
    viewModels: viewModels,
    setMode: setMode,
    setDifficulty: setDifficulty,
    creature: creature,
    DIFFICULTY: DIFFICULTY,
    botProfiles: botProfiles,
    makeNoise: makeNoise,
    openSkins: openSkins,
    closeSkins: closeSkins,
    applySkinTo: applySkinTo
  };

  loadSkinPrefs();
  applyAllSkins();
  loadModePref();
  loadDifficultyPref();
  renderSkinTabs('usp');
  updateHUD();
  renderScoreboard();
  tick();
})();

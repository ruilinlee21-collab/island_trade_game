/* Original canvas pixel art. The Python API remains the source of game rules. */
(() => {
  const canvas = document.getElementById('game-scene');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const palettes = [
    {sky: '#8cd8db', sea: '#247c9e', land: '#e6c87e', leaf: '#2e9a74', roof: '#e18553'},
    {sky: '#a8d9c0', sea: '#2f8c9d', land: '#f0d48b', leaf: '#48a867', roof: '#c96f57'},
    {sky: '#9fc8da', sea: '#347b9c', land: '#cbb782', leaf: '#4c8a68', roof: '#a56843'},
    {sky: '#e0b4a7', sea: '#487a9b', land: '#e2bd82', leaf: '#69976a', roof: '#b65e55'},
    {sky: '#a8cddd', sea: '#277d9c', land: '#d4bf87', leaf: '#5d9a72', roof: '#ba7657'}
  ];
  const crateColors = ['#62b9d4', '#7dbd65', '#bd8753', '#d07774'];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let game = null;
  let animation = null;
  let now = 0;
  let manualPause = false;
  let frozenTime = 0;

  function block(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function label(text, x, y, color = '#fff7d2', size = 8) {
    ctx.fillStyle = '#143043';
    ctx.font = `bold ${size}px monospace`;
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function cloud(x, y) {
    block(x + 8, y, 32, 5, '#e9f4ea');
    block(x, y + 5, 54, 9, '#f7f5df');
    block(x + 9, y + 14, 37, 4, '#d5e9e4');
  }

  function palm(x, y, sway, leaf) {
    block(x, y, 6, 53, '#624632');
    block(x + 2, y + 1, 3, 48, '#a87643');
    block(x - 4 + sway, y - 5, 24, 5, leaf);
    block(x - 23 + sway, y, 31, 5, '#277a5e');
    block(x + 5 + sway, y - 12, 27, 5, '#2d8b66');
    block(x + 8 + sway, y + 1, 25, 5, leaf);
    block(x - 20 + sway, y + 5, 6, 11, '#277a5e');
    block(x + 27 + sway, y + 3, 6, 11, '#2d8b66');
    block(x + 1, y - 5, 6, 7, '#a26a3b');
  }

  function person(x, y, coat, phase = 0, hat = false) {
    const step = Math.sin(phase) > 0 ? 3 : -3;
    block(x + 4, y + 24, 5, 11 + step, '#263f56');
    block(x + 12, y + 24, 5, 11 - step, '#263f56');
    block(x + 3, y + 35 + step, 7, 3, '#382e30');
    block(x + 12, y + 35 - step, 7, 3, '#382e30');
    block(x + 2, y + 12, 18, 15, '#263f56');
    block(x + 4, y + 13, 14, 13, coat);
    block(x - 1, y + 14, 4, 12, '#d39c65');
    block(x + 20, y + 14, 4, 12, '#d39c65');
    block(x + 5, y + 2, 12, 11, '#dfa96e');
    block(x + 4, y, 14, 4, '#513a31');
    block(x + 13, y + 7, 2, 2, '#293848');
    if (hat) {
      block(x + 1, y - 3, 20, 4, '#6b433a');
      block(x + 5, y - 8, 13, 6, '#9c593d');
    }
  }

  function crate(x, y, good = 2, sealed = false) {
    const color = sealed ? '#d8c7a3' : crateColors[good] || crateColors[2];
    block(x, y, 17, 14, '#5d4538');
    block(x + 2, y + 2, 13, 10, color);
    block(x + 2, y + 4, 13, 2, '#f0d9a0');
    block(x + 7, y + 2, 3, 10, '#aa7a4e');
    if (sealed) block(x + 6, y + 4, 5, 4, '#e7af4e');
  }

  function displayedGood(x, y, good) {
    block(x - 2, y + 12, 19, 3, '#7b583d');
    if (good === 0) {
      block(x + 1, y + 6, 12, 5, '#90cbd4');
      block(x - 3, y + 4, 5, 4, '#63a6bb');
      block(x - 3, y + 9, 5, 4, '#63a6bb');
      block(x + 10, y + 7, 2, 2, '#2e4951');
    } else if (good === 1) {
      block(x + 1, y + 5, 12, 8, '#7b563a');
      block(x + 3, y + 3, 8, 3, '#a8784a');
      block(x + 2, y + 7, 2, 3, '#d4a96d');
    } else if (good === 2) {
      block(x - 1, y + 5, 17, 7, '#8d5f3d');
      block(x + 2, y + 6, 12, 2, '#b4814e');
      block(x + 2, y + 10, 12, 2, '#503d36');
    } else {
      block(x + 2, y + 3, 4, 9, '#c34d45');
      block(x + 7, y + 5, 4, 8, '#e17a4b');
      block(x + 12, y + 3, 4, 8, '#a83d40');
      block(x + 1, y + 1, 15, 3, '#5a9a61');
    }
  }

  function boat(x, y, time, cargoCount = 0) {
    const bob = Math.round(Math.sin(time / 340) * 2);
    const top = y + bob;
    const ship = ShipStyle.colors(game?.ship_style);
    block(x + 10, top + 49, 132, 10, ship.hull);
    block(x + 18, top + 59, 112, 8, '#392d3a');
    block(x + 31, top + 67, 86, 5, '#28354a');
    block(x, top + 46, 17, 7, ship.hull);
    block(x + 142, top + 45, 17, 7, ship.hull);
    block(x + 13, top + 46, 131, 4, '#c07a4d');
    block(x + 71, top - 14, 5, 64, '#503a37');
    block(x + 76, top - 8, 5, 51, ship.sail);
    for (let row = 0; row < 11; row++) {
      block(x + 81, top - 6 + row * 4, Math.max(0, 52 - row * 4), 4,
        ship.pattern === 'stripe' && row % 3 === 0 ? '#a55a4b' : ship.sail);
    }
    if (ship.pattern === 'sunburst') block(x + 101, top + 12, 11, 11, '#e9a943');
    block(x + 67, top - 18, 31, 6, ship.flag);
    block(x + 13, top + 31, 24, 15, '#795642');
    block(x + 17, top + 27, 16, 5, '#c79857');
    block(x + 23, top + 35, 7, 5, '#5ec7d1');
    const shown = Math.min(4, Math.ceil(cargoCount / 3));
    for (let i = 0; i < shown; i++) crate(x + 100 + (i % 2) * 17, top + 31 - Math.floor(i / 2) * 12, i);
    person(x + 43, top + 9, '#3e7893', time / 420, true);
    block(x + 14, top + 70, 122, 2, '#94d9d0');
  }

  function sea(time, palette, top = 113) {
    block(0, top, W, H - top, palette.sea);
    block(0, top, W, 4, '#81ced0');
    for (let row = 0; row < 11; row++) {
      const y = top + 12 + row * 14;
      const shift = Math.floor(time / (240 + row * 26)) % 48;
      for (let col = -1; col < 12; col++) {
        block(col * 49 + shift, y, 16 + row % 3 * 4, 2,
          row % 2 ? '#59a9b5' : '#a2d6c7');
      }
    }
  }

  function sky(time, palette, evening = false) {
    block(0, 0, W, 42, evening ? '#667797' : palette.sky);
    block(0, 42, W, 43, evening ? '#ac8a93' : '#a9ded3');
    block(0, 85, W, 30, evening ? '#e5ab93' : '#d9e7ce');
    block(390, 24, 29, 29, evening ? '#f3ba72' : '#f9df8e');
    block(395, 19, 19, 5, evening ? '#f3ba72' : '#f9df8e');
    cloud((40 + Math.floor(time / 55)) % 550 - 65, 26);
    cloud((260 + Math.floor(time / 85)) % 560 - 65, 58);
  }

  function harbor(time, palette, state, effect) {
    const evening = state && state.day % 7 >= 5;
    sky(time, palette, evening);
    block(0, 104, 96, 12, '#75aaa0');
    block(9, 97, 59, 9, '#6caa91');
    block(349, 105, 96, 15, '#6eaa95');
    sea(time, palette);
    block(278, 149, 202, 121, '#c99c69');
    block(295, 143, 185, 22, palette.land);
    block(324, 132, 156, 20, palette.land);
    for (let i = 0; i < 18; i++) block(286 + i * 12, 157 + i % 3 * 10, 7, 3, '#f1da9b');
    // Dock planks connect the moored ship to the island market.
    block(192, 190, 163, 16, '#6c4a3a');
    block(197, 187, 158, 8, '#b88755');
    for (let i = 0; i < 10; i++) block(201 + i * 16, 188, 2, 17, '#634938');
    for (let i = 0; i < 4; i++) block(211 + i * 42, 205, 8, 31, '#59443a');
    block(313, 107, 114, 54, '#9d654d');
    block(323, 113, 94, 42, '#e5c48b');
    block(307, 101, 126, 10, '#744f4d');
    block(317, 90, 105, 12, palette.roof);
    block(325, 81, 89, 10, palette.roof);
    for (let i = 0; i < 5; i++) block(321 + i * 22, 105, 11, 7, '#f5d892');
    block(330, 125, 28, 27, '#7f513b');
    block(336, 132, 16, 18, '#4d4544');
    block(382, 120, 26, 23, '#715245');
    block(389, 125, 12, 11, '#dbb978');
    block(319, 155, 99, 7, '#6e4b39');
    for (let i = 0; i < 4; i++) displayedGood(326 + i * 21, 141, i);
    if (state?.location === 4) {
      // Harbor City has a lighthouse instead of the small island palms.
      block(441, 67, 25, 74, '#f2dbac');
      block(444, 75, 19, 7, '#ce8058');
      block(441, 92, 25, 7, '#ce8058');
      block(437, 63, 33, 5, '#614a47');
      block(445, 55, 17, 8, '#6d4d4b');
      block(451, 58, 6, 5, '#ffe29b');
      block(450, 118, 9, 22, '#4a5151');
    } else {
      palm(454, 91, Math.round(Math.sin(time / 620) * 2), palette.leaf);
      if (state?.location === 1) palm(426, 78, Math.round(Math.sin(time / 750) * 2), '#3a9870');
      if (state?.location === 2) {
        for (let i = 0; i < 3; i++) block(433 + i * 13, 168 - i * 5, 27, 6, '#805639');
      }
      if (state?.location === 3) {
        for (let i = 0; i < 4; i++) block(432 + i * 11, 158 + i % 2 * 3, 7, 10, '#bd5550');
      }
      if (state?.location === 0) {
        block(437, 183, 5, 9, '#d66d68');
        block(432, 186, 5, 6, '#e88b76');
        block(442, 180, 4, 8, '#cf7772');
      }
    }
    person(371, 149, '#b54d49', time / 700, true);
    person(245, 157, '#6b9c62', time / 400);
    boat(37, 132, time, state ? state.cargo_used : 0);
    if (effect && (effect.type === 'buy' || effect.type === 'sell' || effect.type === 'contract')) {
      const progress = Math.min(1, effect.progress);
      const buying = effect.type !== 'sell';
      const x = buying ? 350 - 155 * progress : 195 + 155 * progress;
      crate(x, 167 - Math.sin(progress * Math.PI) * 20,
        effect.data.good ?? 2, effect.type === 'contract');
      for (let i = 0; i < 3; i++) {
        const coinX = buying ? 205 + i * 7 + 125 * progress : 343 - i * 7 - 125 * progress;
        block(coinX, 148 - i * 7, 4, 4, '#ffd165');
      }
    }
    if (effect && effect.type === 'upgrade') {
      for (let i = 0; i < 9; i++) {
        const x = 67 + i * 13;
        const y = 128 + (i % 3) * 22 - Math.floor(effect.progress * 27);
        block(x, y, 5, 5, '#ffe88d');
      }
    }
  }

  function sailing(time, palette, effect, state) {
    sky(time, palette, false);
    sea(time * 2, palette);
    const progress = effect.progress;
    const coast = 478 - progress * 170;
    block(coast, 111, 110, 12, '#619f86');
    block(coast + 20, 103, 68, 10, '#7eb38c');
    block(coast, 123, 130, 33, palette.land);
    const x = -70 + progress * 365;
    boat(x, 133, time * 1.7, effect.before.cargo_used);
    for (let i = 0; i < 6; i++) block(x - 9 - i * 12, 206 + i % 2 * 4, 9, 2, '#c0e6d2');
    label(`${effect.before.islands[effect.before.location].toUpperCase()}  >  ${state.islands[state.location].toUpperCase()}`, 10, 242);
    label(`DAY ${effect.before.day}  >  DAY ${state.day}`, 10, 255, '#f9dfa1');
  }

  function paint(time) {
    now = time;
    ctx.imageSmoothingEnabled = false;
    const palette = palettes[animation?.type === 'travel' ? animation.after.location : game ? game.location : 0];
    const effect = animation && {type: animation.type, data: animation.data,
      before: animation.before, after: animation.after,
      progress: Math.min(1, (time - animation.start) / animation.duration)};
    const sceneTime = motionPreference.matches ? 0 : manualPause ? frozenTime : time;
    if (effect && effect.type === 'travel') sailing(sceneTime, palette, effect, effect.after);
    else harbor(sceneTime, palette, game, effect);
    // A low-resolution border makes the scene feel like a game viewport.
    block(0, 0, W, 4, '#183d4a');
    block(0, H - 4, W, 4, '#183d4a');
    block(0, 0, 4, H, '#183d4a');
    block(W - 4, 0, 4, H, '#183d4a');
    if (animation && time - animation.start >= animation.duration) {
      const completed = animation;
      animation = null;
      setState(completed.after);
      document.getElementById('scene-mode').textContent = 'DOCKED';
      completed.resolve();
    }
    requestAnimationFrame(paint);
  }

  function setState(state) {
    game = state;
    document.getElementById('scene-place').textContent = state.islands[state.location].toUpperCase();
  }

  function play(type, before, after, data = {}) {
    if (motionPreference.matches || manualPause) {
      setState(after);
      document.getElementById('scene-mode').textContent = 'DOCKED';
      return Promise.resolve();
    }
    if (!['buy', 'sell', 'contract', 'travel', 'upgrade', 'wait'].includes(type)) {
      setState(after);
      document.getElementById('scene-mode').textContent = 'DOCKED';
      return Promise.resolve();
    }
    const descriptions = {
      buy: 'Merchant hands cargo to your crew.',
      sell: 'Your crew unloads goods for the merchant.',
      contract: 'A sealed delivery is loaded onto the ship.',
      travel: `Sailing to ${after.islands[after.location]}…`,
      upgrade: 'Shipwrights expand your cargo hold.',
      wait: 'A day passes at the harbor.'
    };
    document.getElementById('scene-status').textContent = descriptions[type];
    document.getElementById('scene-mode').textContent = type === 'travel' ? 'AT SEA' : 'WORKING';
    return new Promise(resolve => {
      animation = {type, before, after, data, start: now,
        duration: type === 'travel' ? 2200 : 1050, resolve};
    });
  }

  function toggleMotion() {
    manualPause = !manualPause;
    frozenTime = now;
    const button = document.getElementById('motion-toggle');
    button.textContent = manualPause ? 'RESUME ANIMATION' : 'PAUSE ANIMATION';
    button.setAttribute('aria-pressed', String(manualPause));
    if (manualPause && animation) {
      const completed = animation;
      animation = null;
      setState(completed.after);
      document.getElementById('scene-mode').textContent = 'DOCKED';
      completed.resolve();
    }
  }

  requestAnimationFrame(paint);
  window.GameScene = {setState, play, toggleMotion};
})();

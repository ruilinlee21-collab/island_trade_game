/* Pixel chart drawing and pointer navigation. Game rules stay in Python. */
const MapView = (() => {
  const ports = [
    {x: 315, y: 410, kind: 'coral'},
    {x: 425, y: 183, kind: 'palm'},
    {x: 570, y: 365, kind: 'timber'},
    {x: 650, y: 176, kind: 'spice'},
    {x: 485, y: 520, kind: 'city'}
  ];
  const world = document.getElementById('map-world');
  const scroll = document.getElementById('map-scroll');
  const board = document.querySelector('.chart-board');
  const ship = document.getElementById('ship');
  const card = document.getElementById('route-card');
  let game;
  let selected = null;
  let sail = () => {};
  let dragging = false;
  let moved = false;
  let pointerStart;

  function islandArt(port) {
    const {x, y, kind} = port;
    const top = kind === 'city' ? '#8db574' : kind === 'spice' ? '#83a25f' : '#75b77b';
    const buildings = kind === 'city'
      ? `<path d="M-36-25h28v31h-28zM-5-42h26v49H-5zM27-23h22v30H27z" fill="#d3aa70" stroke="#573e3b" stroke-width="4"/><path d="M-38-29h32M-7-46h30M25-27h27" stroke="#a45e47" stroke-width="8"/><path d="M5-28h8v9H5zM-28-17h8v9h-8zM35-12h7v7h-7z" fill="#fff0ae"/>`
      : kind === 'timber'
      ? `<path d="M-42-13h44v18h-44z" fill="#b37c50" stroke="#69463c" stroke-width="4"/><path d="M-47-17h54l-11-12h-31z" fill="#8e5343"/><path d="M22-28v28M33-31v31M43-24v24" stroke="#654936" stroke-width="8"/><path d="M12-30h42M16-42h35" stroke="#3b875d" stroke-width="13"/>`
      : kind === 'spice'
      ? `<path d="M-30-19h38v24h-38z" fill="#ddb775" stroke="#694d3d" stroke-width="4"/><path d="M-35-23h48L3-37h-29z" fill="#b96143"/><path d="M30-22v28M46-16v22" stroke="#6b5640" stroke-width="5"/><path d="M18-31h26M35-28h22" stroke="#9cba60" stroke-width="14"/><path d="M38-4h12" stroke="#c4674d" stroke-width="7"/>`
      : kind === 'palm'
      ? `<path d="M-15-35l8 42M27-47l-9 54" stroke="#825d3c" stroke-width="8"/><path d="M-35-44h49M-25-53h36M5-55h45M9-46h50" stroke="#428d64" stroke-width="13"/><path d="M-6-4h24v12H-6z" fill="#c79565" stroke="#6d4a39" stroke-width="3"/>`
      : `<path d="M-24-22h38v31h-38z" fill="#e5bd7d" stroke="#6c4b3b" stroke-width="4"/><path d="M-29-26h48L6-38h-22z" fill="#bd7050"/><path d="M-2-4h9v13h-9z" fill="#5e5946"/><path d="M34-30v36" stroke="#795a3e" stroke-width="6"/><path d="M21-35h30M28-44h25" stroke="#499a70" stroke-width="12"/>`;
    return `<g transform="translate(${x} ${y})" filter="url(#shadow)">
      <path d="M-82-8l24-39 47-18 49 12 42 36 8 38-22 31-45 14-54-5-48-21z" fill="#7bc7b3"/>
      <path d="M-69-10l18-29 43-18 42 10 38 31 8 31-21 27-38 11-49-6-35-24z" fill="#e8ce84" stroke="#c3a864" stroke-width="4"/>
      <path d="M-55-15l15-24 37-11 34 8 27 28 5 24-20 23-36 6-40-7-22-20z" fill="${top}"/>
      <path d="M-47 23h26M36 24h17M-11 35h25" stroke="#a3c97a" stroke-width="7"/>
      ${buildings}
      <path d="M-78 64h30M56 56h28" stroke="#caeee0" stroke-width="5"/>
    </g>`;
  }

  document.getElementById('island-art').innerHTML = ports.map(islandArt).join('');

  function pos(index) { return ports[index]; }
  function placeShip(x, y) {
    ship.style.left = `${x / 10}%`;
    ship.style.top = `${y / 6.2}%`;
  }
  function dockPosition(index) {
    const p = pos(index);
    // Keep the hull clear of the chart edge at the southernmost island.
    return {x: p.x + 12, y: Math.min(p.y + 70, 580)};
  }
  function resetShip() {
    if (!game) return;
    const p = dockPosition(game.location);
    placeShip(p.x, p.y);
  }
  function pointerPosition(event) {
    const bounds = world.getBoundingClientRect();
    return {x: (event.clientX - bounds.left) / bounds.width * 1000,
      y: (event.clientY - bounds.top) / bounds.height * 620};
  }

  function updateCard() {
    if (selected === null || !game) { card.hidden = true; return; }
    const current = selected === game.location;
    const days = game.distances[game.location][selected];
    const cost = game.transport_costs[selected];
    card.innerHTML = `<strong>${game.islands[selected]}</strong><p>${current ? 'Your ship is docked here.' : `${days} day${days === 1 ? '' : 's'} at sea · ${cost} coins transport`}</p>${current || game.finished ? '' : '<button type="button" data-sail>Set sail</button>'}`;
    card.hidden = false;
  }
  function select(index) {
    selected = index;
    document.querySelectorAll('.island-button').forEach((button, i) =>
      button.classList.toggle('selected', i === index));
    updateCard();
  }

  function render(state, onSail) {
    game = state;
    sail = onSail;
    ship.innerHTML = ShipStyle.svg(state.ship_style);
    const current = pos(state.location);
    document.getElementById('route-lines').setAttribute('d', ports
      .map((p, i) => i === state.location ? '' : `M${current.x} ${current.y} Q${(current.x+p.x)/2} ${Math.min(current.y,p.y)-30} ${p.x} ${p.y}`)
      .join(' '));
    document.getElementById('island-buttons').innerHTML = state.islands.map((name, i) =>
      `<button type="button" class="island-button ${i === state.location ? 'current' : ''} ${i === selected ? 'selected' : ''}" data-island="${i}" style="left:${pos(i).x/10}%;top:${pos(i).y/6.2}%" aria-label="${name}${i === state.location ? ', current port' : ', select route'}"><span>${name}</span></button>`).join('');
    resetShip();
    if (scroll.scrollWidth > scroll.clientWidth) {
      const at = dockPosition(state.location).x / 1000 * world.clientWidth;
      scroll.scrollLeft = Math.max(0, at - scroll.clientWidth / 2);
    }
    updateCard();
  }
  // Keep desktop drawers within the map even when route details expand the board.
  new ResizeObserver(() => board.style.setProperty('--map-height', `${scroll.clientHeight}px`)).observe(scroll);

  document.getElementById('island-buttons').addEventListener('click', event => {
    const button = event.target.closest('[data-island]');
    if (button) select(Number(button.dataset.island));
  });
  card.addEventListener('click', event => {
    if (event.target.closest('[data-sail]') && selected !== null) sail(selected);
  });
  ship.addEventListener('pointerdown', event => {
    if (!game || game.finished) return;
    dragging = true; moved = false;
    pointerStart = {x: event.clientX, y: event.clientY};
    ship.setPointerCapture(event.pointerId);
    ship.classList.add('dragging');
    event.preventDefault();
  });
  ship.addEventListener('pointermove', event => {
    if (!dragging) return;
    if (Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y) > 5) moved = true;
    if (!moved) return;
    const view = scroll.getBoundingClientRect();
    if (scroll.scrollWidth > scroll.clientWidth) {
      if (event.clientX > view.right - 28) scroll.scrollLeft += 18;
      if (event.clientX < view.left + 28) scroll.scrollLeft -= 18;
    }
    const p = pointerPosition(event);
    placeShip(Math.max(20,Math.min(980,p.x)),Math.max(20,Math.min(600,p.y)));
  });
  function drop(event) {
    if (!dragging) return;
    dragging = false; ship.classList.remove('dragging');
    if (!moved) { resetShip(); return; }
    const p = pointerPosition(event);
    const target = ports.findIndex((port, i) => i !== game.location && Math.hypot(port.x-p.x,port.y-p.y) < 75);
    resetShip();
    if (target >= 0) { select(target); sail(target); }
    else document.getElementById('status').textContent = 'Drop the ship on an island to sail.';
  }
  ship.addEventListener('pointerup', drop);
  ship.addEventListener('pointercancel', () => { dragging = false; ship.classList.remove('dragging'); resetShip(); });

  function animateShip(from, to) {
    const start = dockPosition(from), end = dockPosition(to);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden) {
      placeShip(end.x,end.y); return Promise.resolve();
    }
    return new Promise(resolve => {
      const began = performance.now();
      function frame(now) {
        const t = Math.min(1,(now-began)/950);
        const eased = t*t*(3-2*t);
        placeShip(start.x+(end.x-start.x)*eased,start.y+(end.y-start.y)*eased-28*Math.sin(t*Math.PI));
        if (t < 1 && !document.hidden) requestAnimationFrame(frame);
        else { placeShip(end.x,end.y); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }
  return {render, animateShip};
})();

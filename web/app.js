const $ = id => document.getElementById(id);
const icons = ['🐟', '🥥', '🪵', '🌶️'];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
let state;
let toastTimer;
let busy = false;

function notice(message) {
  const box = $('toast');
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('show'), 4500);
}

async function action(name, data = {}) {
  if (busy) return;
  busy = true;
  document.querySelector('.game-shell').setAttribute('aria-busy', 'true');
  try {
    const before = state;
    const oldEventCount = state?.event_count ?? 0;
    const oldCompleted = state?.contracts_completed ?? 0;
    const oldFailed = state?.contracts_failed ?? 0;
    const oldMilestones = new Set((state?.milestone_progress ?? [])
      .filter(item => item.achieved).map(item => item.id));
    const response = await fetch('/api/action', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: name, ...data})
    });
    const result = await response.json();
    if (result.ok && before) await GameScene.play(name, before, result.state, data);
    state = result.state;
    render();
    $('scene-status').textContent = result.message;
    const unlocked = state.milestone_progress.find(item => item.achieved && !oldMilestones.has(item.id));
    if (!result.ok) notice(result.message);
    else if (state.contracts_completed > oldCompleted)
      notice('DELIVERY COMPLETE: Reward paid. Check the captain\'s log.');
    else if (state.contracts_failed > oldFailed)
      notice('DELIVERY EXPIRED: The sealed cargo was returned without payment.');
    else if (state.event_count > oldEventCount)
      notice(`NEW EVENT: ${state.event_history[0].title} — ${state.event_history[0].description}`);
    else if (unlocked) notice(`MILESTONE UNLOCKED: ${unlocked.title} — ${unlocked.reward}`);
    else notice(result.message);
  } catch (error) {
    notice('Connection failed. Restart the Python web server.');
  } finally {
    busy = false;
    document.querySelector('.game-shell').removeAttribute('aria-busy');
  }
}

function renderEvents() {
  const event = state.event_history[0];
  const active = state.active_event;
  $('event-card').innerHTML = event
    ? `<div class="event-latest"><small>DAY ${event.day} · LATEST NEWS</small><strong>${escapeHTML(event.title)}</strong><p>${escapeHTML(event.description)}</p></div>`
    : '<div class="event-latest quiet"><small>DAY 1 · THE SEA IS CALM</small><strong>Awaiting island news</strong><p>Voyage or wait to discover changing market conditions.</p></div>';
  $('event-card').innerHTML += active
    ? `<div class="effect-active"><span>ACTIVE EFFECT</span><strong>${escapeHTML(active.kind.replaceAll('_', ' '))}</strong><span>${active.remaining} day${active.remaining === 1 ? '' : 's'} left</span></div>`
    : '<div class="effect-active muted"><span>ACTIVE EFFECT</span><strong>None</strong><span>Watch the horizon</span></div>';
}

function renderMilestones() {
  $('milestone-list').innerHTML = state.milestone_progress.map(item => {
    const percent = Math.min(100, Math.max(0, item.current / item.target * 100));
    const unit = item.id === 'first_fleet' ? 'assets' : 'trades';
    return `<div class="milestone-row ${item.achieved ? 'achieved' : ''}">
      <div class="milestone-top"><strong>${escapeHTML(item.title)}</strong><span>${item.achieved ? 'UNLOCKED' : `${item.current}/${item.target} ${unit}`}</span></div>
      <div class="progress-track"><span style="width:${percent}%"></span></div>
      <small>Reward: ${escapeHTML(item.reward)}</small></div>`;
  }).join('');
}

function renderContract() {
  const contract = state.active_contract || state.contract_offer;
  const card = $('contract-card');
  if (!contract) {
    card.innerHTML = `<p class="hint">No delivery is available today. Visit another port or wait for the next dispatch.</p>
      <small>${state.contracts_completed} completed · ${state.contracts_failed} expired</small>`;
    return;
  }
  const active = Boolean(state.active_contract);
  card.innerHTML = `<div class="contract-route"><strong>${escapeHTML(state.islands[contract.source])}</strong><span>→</span><strong>${escapeHTML(state.islands[contract.destination])}</strong></div>
    <div class="contract-details"><span>${icons[contract.good]} ${contract.quantity} sealed ${escapeHTML(state.goods[contract.good])}</span><span>Due day ${contract.deadline}</span><strong>+${contract.reward} coins</strong></div>
    <p class="hint">Sealed goods use ${contract.quantity} cargo slots and add to sailing costs. Complete the voyage before the deadline to earn the reward.</p>
    ${active ? '<span class="contract-status">DELIVERY IN PROGRESS</span>' : `<button id="accept-contract" class="primary" ${state.cargo_used + contract.quantity > state.capacity ? 'disabled' : ''}>${state.cargo_used + contract.quantity > state.capacity ? 'NOT ENOUGH CARGO SPACE' : 'ACCEPT CONTRACT ↗'}</button>`}
    <small class="contract-record">${state.contracts_completed} completed · ${state.contracts_failed} expired</small>`;
}

function renderAdvice() {
  const plan = state.advice;
  if (!plan.route.length) {
    $('route-advice').innerHTML = `<div class="advice-empty">${escapeHTML(plan.message)}</div>`;
    return;
  }
  const route = plan.route.map((island, index) =>
    `${index ? '<span class="route-arrow">→</span>' : ''}<span class="route-chip">${escapeHTML(island)}</span>`).join('');
  const sales = plan.sales.map(step => {
    const goods = step.items.map(item => `${item.quantity} ${escapeHTML(item.good)}`).join(', ');
    return `<li>Sell ${goods} at <strong>${escapeHTML(step.island)}</strong> · about ${step.revenue} coins</li>`;
  }).join('');
  const buy = plan.buy
    ? `<li>Buy ${plan.buy.quantity} ${escapeHTML(plan.buy.good)} at <strong>${escapeHTML(plan.buy.island)}</strong> · about ${plan.buy.cost} coins</li>`
    : '';
  const gainLabel = plan.buy ? 'PROJECTED PROFIT' : 'GAIN VS. SELLING HERE';
  $('route-advice').innerHTML = `<div class="advice-main"><div class="advice-route">${route}</div>
    <div class="advice-gain"><small>${gainLabel}</small><strong>+${plan.advantage}</strong><span>coins</span></div></div>
    <ul class="advice-sales">${buy}${sales}</ul>`;
}

function renderMarket() {
  $('market-hint').textContent = `Buying fee: ${state.buy_fee} coin${state.buy_fee === 1 ? '' : 's'} per unit. Shown buy price is for the first unit; larger orders may cost more as stock falls.`;
  $('market-list').innerHTML = state.goods.map((name, i) => `<div class="market-row">
    <div class="good-icon">${icons[i]}</div>
    <div class="good-name">${name}<small>${state.stock[state.location][i]} in market · ${state.cargo[i]} held</small></div>
    <div class="price"><small>BUY +${state.buy_fee}</small><strong>${state.prices[state.location][i] + state.buy_fee}</strong></div>
    <div class="price"><small>SELL</small><strong>${state.sell_prices[state.location][i]}</strong></div>
    <input aria-label="${escapeHTML(name)} quantity" name="market-quantity-${i}" autocomplete="off" inputmode="numeric" type="number" min="1" max="99" value="1" id="qty-${i}">
    <button class="trade-btn" data-action="buy" data-good="${i}" aria-label="Buy ${escapeHTML(name)}; first unit costs ${state.prices[state.location][i] + state.buy_fee} coins" ${state.finished ? 'disabled' : ''}>BUY</button>
    <button class="trade-btn sell" data-action="sell" data-good="${i}" aria-label="Sell ${escapeHTML(name)} for ${state.sell_prices[state.location][i]} coins per unit" ${state.finished ? 'disabled' : ''}>SELL</button>
    </div>`).join('');
}

function renderQuickActions() {
  $('quick-goods').innerHTML = state.goods.map((name, i) => `<div class="quick-good">
    <span class="quick-icon" aria-hidden="true">${icons[i]}</span><div class="quick-name"><strong>${escapeHTML(name)}</strong><small>${state.stock[state.location][i]} market · ${state.cargo[i]} aboard</small></div>
    <input aria-label="Quick ${escapeHTML(name)} quantity" name="quick-quantity-${i}" autocomplete="off" inputmode="numeric" type="number" min="1" max="99" value="1">
    <button data-action="buy" data-good="${i}" aria-label="Buy ${escapeHTML(name)}; first unit costs ${state.prices[state.location][i] + state.buy_fee} coins" ${state.finished ? 'disabled' : ''}>BUY <small>${state.prices[state.location][i] + state.buy_fee}c</small></button>
    <button data-action="sell" data-good="${i}" aria-label="Sell ${escapeHTML(name)} for ${state.sell_prices[state.location][i]} coins per unit" ${state.finished || !state.cargo[i] ? 'disabled' : ''}>SELL <small>${state.sell_prices[state.location][i]}c</small></button>
  </div>`).join('');
  $('quick-destination').innerHTML = state.islands.map((name, i) =>
    `<option value="${i}" ${i === state.location ? 'disabled' : ''}>${escapeHTML(name)} · ${state.distances[state.location][i]}d / ${state.transport_costs[i]} coins</option>`).join('');
  $('quick-destination').value = String(state.islands.findIndex((_, i) => i !== state.location));
  const offer = state.contract_offer;
  const enoughSpace = offer && state.cargo_used + offer.quantity <= state.capacity;
  $('quick-contract').textContent = offer ? enoughSpace ? `TAKE DELIVERY +${offer.reward}` : 'NEED MORE CARGO SPACE' : state.active_contract ? 'DELIVERY IN PROGRESS' : 'NO DELIVERY TODAY';
  $('quick-contract').disabled = state.finished || !offer || state.cargo_used + offer.quantity > state.capacity;
  $('quick-wait').disabled = state.finished;
  $('quick-sail').disabled = state.finished;
}

function renderRoutes() {
  $('route-list').innerHTML = state.islands.map((name, i) => {
    const days = state.distances[state.location][i];
    return `<div class="route-card ${i === state.location ? 'active' : ''}">
      <div class="route-top"><strong>${name}</strong><span>🏝️</span></div>
      <small>${i === state.location ? 'Current port' : `${days} day${days > 1 ? 's' : ''} · ${state.transport_costs[i]} coins`}</small>
      <button class="route-btn" data-destination="${i}" aria-label="${i === state.location ? `Docked at ${escapeHTML(name)}` : `Sail to ${escapeHTML(name)} in ${days} ${days === 1 ? 'day' : 'days'} for ${state.transport_costs[i]} coins`}" ${i === state.location || state.finished ? 'disabled' : ''}>${i === state.location ? 'DOCKED' : 'SET SAIL →'}</button>
    </div>`;
  }).join('');
}

function render() {
  $('day').textContent = `${Math.min(state.day, 30)} / 30`;
  $('port').textContent = state.islands[state.location];
  $('cash').textContent = state.cash.toLocaleString();
  $('cargo').textContent = `${state.cargo_used} / ${state.capacity}`;
  $('assets').textContent = state.summary.assets.toLocaleString();
  $('upgrade-cost').textContent = `${state.upgrade_cost} COINS →`;
  renderEvents(); renderMilestones(); renderContract(); renderAdvice(); renderMarket(); renderRoutes(); renderQuickActions();
  GameScene.setState(state);
  $('manifest').innerHTML = state.goods.map((name, i) =>
    `<div class="manifest-line"><span>${icons[i]} &nbsp; ${name}</span><strong>${state.cargo[i]} ${state.cargo[i] === 1 ? 'crate' : 'crates'}</strong></div>`).join('')
    + (state.active_contract ? `<div class="manifest-line sealed"><span>✉ &nbsp; Sealed delivery</span><strong>${state.active_contract.quantity} crates</strong></div>` : '');
  $('log').innerHTML = [...state.log].reverse().map(line => `<li>${escapeHTML(line)}</li>`).join('');
  $('final').classList.toggle('hidden', !state.finished);
  $('final-copy').textContent = `You finished with ${state.summary.assets} coins in total assets, made ${state.summary.trades} trades, completed ${state.summary.contracts_completed} deliveries, and upgraded your ship ${state.summary.upgrades} times.`;
  $('wait').disabled = state.finished;
  $('upgrade').disabled = state.finished;
}

document.addEventListener('click', event => {
  if (event.target.closest('#accept-contract')) { action('contract'); return; }
  const trade = event.target.closest('[data-action]');
  if (trade) {
    const good = Number(trade.dataset.good);
    const quantityInput = trade.closest('.quick-good')?.querySelector('input') || $(`qty-${good}`);
    action(trade.dataset.action, {good, quantity: Number(quantityInput.value)});
    return;
  }
  const route = event.target.closest('[data-destination]');
  if (route) action('travel', {destination: Number(route.dataset.destination)});
});
$('new').onclick = $('again').onclick = () => { window.location.href = '/shipyard.html?view=harbor'; };
$('save').onclick = () => action('save');
$('load').onclick = () => action('load');
$('wait').onclick = () => action('wait');
$('upgrade').onclick = () => action('upgrade');
$('quick-contract').onclick = () => action('contract');
$('quick-wait').onclick = () => action('wait');
$('quick-sail').onclick = () => action('travel', {destination: Number($('quick-destination').value)});
$('motion-toggle').onclick = () => GameScene.toggleMotion();

if (window.location.protocol === 'file:') {
  $('startup-help').classList.remove('hidden');
} else {
  fetch('/api/state').then(response => {
    if (!response.ok) throw new Error('Game service unavailable');
    return response.json();
  }).then(data => { state = data; render(); }).catch(() => {
    $('startup-help').classList.remove('hidden');
    notice('Could not connect to the Python game server.');
  });
}

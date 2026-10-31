/* Browser controls for the shared Python game. No trading rules are duplicated here. */
const $ = id => document.getElementById(id);
const icons = ['🐟','🥥','🪵','🌶️'];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let state;
let busy = false;

function say(message) { $('status').textContent = message; }
function renderEvent() {
  const latest = state.event_history[0];
  $('event-day').textContent = latest ? `Day ${latest.day} · Island news` : 'Island news';
  $('event-title').textContent = latest?.title || 'The sea is calm';
  $('event-description').textContent = latest?.description || 'Visit a port or wait to discover what changes across the islands.';
  const effect = state.active_event;
  $('event-effect').textContent = effect ? `${effect.kind.replaceAll('_',' ')} · ${effect.remaining} day${effect.remaining === 1 ? '' : 's'} left` : 'No active effect';
}
function renderMilestones() {
  $('milestones').innerHTML = state.milestone_progress.map(item => {
    const percent = Math.min(100,Math.max(0,item.current/item.target*100));
    return `<div class="milestone ${item.achieved?'achieved':''}"><strong>${escapeHTML(item.title)}</strong><small>${item.achieved?'Unlocked':`${item.current}/${item.target}`} · ${escapeHTML(item.reward)}</small><div class="progress-track"><i style="width:${percent}%"></i></div></div>`;
  }).join('');
}
function renderContract() {
  const contract = state.active_contract || state.contract_offer;
  if (!contract) {
    $('contract').innerHTML = '<div class="contract-box">No delivery is available today. Travel or wait for a new dispatch.</div>';
    $('accept-contract').textContent = 'No delivery today';
    $('accept-contract').disabled = true;
    return;
  }
  const active = Boolean(state.active_contract);
  $('contract').innerHTML = `<div class="contract-box"><strong>${escapeHTML(state.islands[contract.source])} → ${escapeHTML(state.islands[contract.destination])}</strong><p>${icons[contract.good]} ${contract.quantity} sealed ${escapeHTML(state.goods[contract.good])} · due day ${contract.deadline}</p><p class="reward">${active?'Delivery in progress':`Reward: +${contract.reward} coins`}</p><p>Sealed crates occupy cargo space.</p></div>`;
  const noRoom = state.cargo_used + contract.quantity > state.capacity;
  $('accept-contract').textContent = active ? 'Delivery in progress' : noRoom ? 'Cargo hold is full' : `Take delivery +${contract.reward}`;
  $('accept-contract').disabled = state.finished || active || noRoom;
}
function renderTrades() {
  $('trades').innerHTML = state.goods.map((name,i) => {
    const buy = state.prices[state.location][i] + state.buy_fee;
    const sell = state.sell_prices[state.location][i];
    return `<div class="trade-row"><div><strong>${icons[i]} ${escapeHTML(name)}</strong><small>${state.stock[state.location][i]} on island · ${state.cargo[i]} aboard</small></div><input id="map-qty-${i}" name="trade-quantity-${i}" aria-label="${escapeHTML(name)} quantity" type="number" min="1" max="99" value="1" inputmode="numeric" autocomplete="off"><button type="button" data-trade="buy" data-good="${i}" aria-label="Buy ${escapeHTML(name)}, first unit ${buy} coins" ${state.finished?'disabled':''}>Buy<span>${buy}c</span></button><button type="button" class="sell" data-trade="sell" data-good="${i}" aria-label="Sell ${escapeHTML(name)}, ${sell} coins each" ${state.finished||!state.cargo[i]?'disabled':''}>Sell<span>${sell}c</span></button></div>`;
  }).join('');
  $('wait').disabled = state.finished;
  $('upgrade').disabled = state.finished || state.cash < state.upgrade_cost;
  $('upgrade').textContent = `Upgrade cargo · ${state.upgrade_cost}c`;
}
function renderMarket() {
  $('panel-market').innerHTML = `<table class="ledger"><thead><tr><th>Good</th><th>Market stock</th><th>Buy from</th><th>Sell for</th><th>Aboard</th></tr></thead><tbody>${state.goods.map((name,i) => `<tr><td>${icons[i]} ${escapeHTML(name)}</td><td>${state.stock[state.location][i]}</td><td>${state.prices[state.location][i]+state.buy_fee} coins</td><td>${state.sell_prices[state.location][i]} coins</td><td>${state.cargo[i]}</td></tr>`).join('')}</tbody></table><p>Buying lowers local stock. The shown buy price is for the first unit; a larger order may cost more.</p>`;
}
function renderRoutes() {
  const routes = state.islands.map((name,i) => i === state.location ? '' : `<div class="route-item"><strong>${escapeHTML(name)}</strong><span>${state.distances[state.location][i]} day${state.distances[state.location][i]===1?'':'s'} · ${state.transport_costs[i]} coins</span><button type="button" data-destination="${i}" ${state.finished?'disabled':''}>Sail to ${escapeHTML(name)}</button></div>`).join('');
  const plan = state.advice;
  const route = plan.route.length ? plan.route.map(escapeHTML).join(' → ') : escapeHTML(plan.message);
  $('panel-routes').innerHTML = `<div class="route-list">${routes}</div><div class="advice"><strong>Captain’s navigator:</strong> ${route}${plan.route.length ? ` · estimated gain ${plan.advantage} coins` : ''}<br>Estimates use today’s prices and known transport costs; future events can change them.</div>`;
}
function renderManifest() {
  $('panel-manifest').innerHTML = `<div class="manifest-list">${state.goods.map((name,i) => `<div class="manifest-item">${icons[i]} ${escapeHTML(name)}<strong>${state.cargo[i]} crates</strong></div>`).join('')}${state.active_contract?`<div class="manifest-item">✉ Sealed delivery<strong>${state.active_contract.quantity} crates</strong></div>`:''}</div><p>${state.cargo_used} of ${state.capacity} cargo slots occupied.</p>`;
}
function renderLog() {
  $('panel-log').innerHTML = `<ol class="log-list">${[...state.log].reverse().map(line => `<li>${escapeHTML(line)}</li>`).join('')}</ol>`;
}
function render() {
  $('day').textContent = `${Math.min(state.day,30)} / 30`;
  $('cash').textContent = state.cash.toLocaleString();
  $('cargo').textContent = `${state.cargo_used} / ${state.capacity}`;
  $('assets').textContent = state.summary.assets.toLocaleString();
  $('port').textContent = state.islands[state.location];
  renderEvent(); renderMilestones(); renderContract(); renderTrades();
  renderMarket(); renderRoutes(); renderManifest(); renderLog();
  MapView.render(state, destination => action('travel',{destination}));
  $('final').hidden = !state.finished;
  $('final-copy').textContent = `You finished with ${state.summary.assets} coins in total assets, made ${state.summary.trades} trades, completed ${state.summary.contracts_completed} deliveries and upgraded your ship ${state.summary.upgrades} times.`;
}

async function action(name, data = {}) {
  if (busy || !state) return;
  busy = true;
  $('main').setAttribute('aria-busy','true');
  const before = state;
  try {
    say(name === 'travel' ? `Sailing to ${state.islands[data.destination]}…` : 'Updating voyage…');
    const response = await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:name,...data})});
    const result = await response.json();
    if (result.ok && name === 'travel') await MapView.animateShip(before.location,result.state.location);
    state = result.state;
    render();
    say(result.message);
  } catch (error) {
    say('Connection failed. Restart the Python game server and reload this page.');
  } finally {
    busy = false;
    $('main').removeAttribute('aria-busy');
  }
}

document.addEventListener('click', event => {
  const trade = event.target.closest('[data-trade]');
  if (trade) {
    const good = Number(trade.dataset.good);
    action(trade.dataset.trade,{good,quantity:Number($(`map-qty-${good}`).value)});
    return;
  }
  const route = event.target.closest('[data-destination]');
  if (route) action('travel',{destination:Number(route.dataset.destination)});
});
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(tab => {
    const active = tab === button;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
    $(tab.getAttribute('aria-controls')).hidden = !active;
  });
}));
document.querySelector('.tab-list').addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  tabs[(current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].focus();
  tabs[(current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].click();
});
$('save').onclick = () => action('save');
$('load').onclick = () => action('load');
$('wait').onclick = () => action('wait');
$('upgrade').onclick = () => action('upgrade');
$('accept-contract').onclick = () => action('contract');
$('new').onclick = $('again').onclick = () => { location.href = '/shipyard.html?view=map'; };
if (location.protocol === 'file:') {
  $('startup-help').hidden = false;
} else {
  fetch('/api/state').then(response => {
    if (!response.ok) throw new Error('Game server unavailable');
    return response.json();
  }).then(data => { state = data; render(); }).catch(() => {
    $('startup-help').hidden = false;
    say('The game server is unavailable. Start it with START_MAP_MAC.command.');
  });
}

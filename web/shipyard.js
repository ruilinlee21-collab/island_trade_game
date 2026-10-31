/* Pre-voyage ship builder using the same palette as both game views. */
const labels = {
  hull: {walnut:'Walnut',coral:'Coral',lagoon:'Lagoon'},
  sail: {ivory:'Ivory',sunset:'Sunset',seafoam:'Seafoam'},
  flag: {coral:'Coral',gold:'Gold',navy:'Navy'},
  pattern: {plain:'Plain',stripe:'Stripe',sunburst:'Sunburst'}
};
const form = document.getElementById('ship-form');
const status = document.getElementById('shipyard-status');
const initialView = new URLSearchParams(location.search).get('view') === 'harbor' ? 'harbor' : 'map';
form.elements.view.value = initialView;
let selected = {...ShipStyle.defaults};
let busy = false;
let currentState;

function drawOptions() {
  document.getElementById('option-groups').innerHTML = Object.entries(labels).map(([group,options]) =>
    `<fieldset class="choice-group"><legend>${group[0].toUpperCase()+group.slice(1)}</legend><div class="choices">${Object.entries(options).map(([id,label]) => {
      const color = ShipStyle.choices[group][id];
      const swatch = group === 'pattern' ? '<span class="mark" aria-hidden="true">✦</span>' : `<span class="swatch" style="--swatch:${color}" aria-hidden="true"></span>`;
      return `<label class="choice"><input type="radio" name="${group}" value="${id}" ${selected[group] === id ? 'checked' : ''}>${swatch}<span>${label}</span></label>`;
    }).join('')}</div></fieldset>`).join('');
}
function updatePreview() {
  selected = ShipStyle.normalize(Object.fromEntries(['hull','sail','flag','pattern'].map(key => [key,form.elements[key].value])));
  document.getElementById('ship-preview').innerHTML = ShipStyle.svg(selected);
  document.getElementById('preview-name').textContent = `${labels.hull[selected.hull]} hull · ${labels.sail[selected.sail]} sail`;
  document.getElementById('ship-preview').setAttribute('aria-label',`${labels.hull[selected.hull]} hull, ${labels.sail[selected.sail]} sail, ${labels.flag[selected.flag]} flag, ${labels.pattern[selected.pattern]} pattern`);
}
drawOptions(); updatePreview();
form.addEventListener('change', updatePreview);

async function submit(action) {
  if (busy) return;
  const hasProgress = currentState && (currentState.day > 1 || currentState.summary.trades > 0 || currentState.summary.upgrades > 0 || currentState.active_contract);
  if (action === 'new' && hasProgress && !window.confirm('Start a new voyage? Unsaved progress in the current voyage will be lost.')) return;
  busy = true;
  form.querySelectorAll('button').forEach(button => button.disabled = true);
  status.textContent = action === 'new' ? 'Building your ship…' : 'Updating your ship…';
  try {
    const response = await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,ship_style:selected})});
    const result = await response.json();
    if (!result.ok) { status.textContent = result.message; return; }
    location.href = form.elements.view.value === 'harbor' ? '/' : '/map/';
  } catch (error) {
    status.textContent = 'The game server is unavailable. Restart it and try again.';
  } finally {
    busy = false;
    form.querySelectorAll('button').forEach(button => button.disabled = false);
  }
}
form.addEventListener('submit', event => { event.preventDefault(); submit('new'); });
document.getElementById('apply-current').addEventListener('click', () => submit('style'));
if (location.protocol === 'file:') document.getElementById('startup-help').hidden = false;
else fetch('/api/state').then(response => response.json()).then(state => {
  currentState = state;
  selected = ShipStyle.normalize(state.ship_style);
  drawOptions(); updatePreview();
}).catch(() => { document.getElementById('startup-help').hidden = false; });

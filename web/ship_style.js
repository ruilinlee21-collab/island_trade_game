/* One visual palette shared by the harbor, map and shipyard preview. */
window.ShipStyle = (() => {
  const choices = {
    hull: {walnut:'#593b35',coral:'#a85b48',lagoon:'#285f69'},
    sail: {ivory:'#fff1be',sunset:'#f4bd75',seafoam:'#c9e9d0'},
    flag: {coral:'#cf604b',gold:'#eec865',navy:'#315e88'},
    pattern: {plain:'Plain',stripe:'Stripe',sunburst:'Sunburst'}
  };
  const defaults = {hull:'walnut',sail:'ivory',flag:'coral',pattern:'plain'};
  function normalize(style = {}) {
    return Object.fromEntries(Object.entries(defaults).map(([key,fallback]) =>
      [key,Object.hasOwn(choices[key],style?.[key]) ? style[key] : fallback]));
  }
  function colors(style) {
    const selected = normalize(style);
    return {hull:choices.hull[selected.hull],sail:choices.sail[selected.sail],
      flag:choices.flag[selected.flag],pattern:selected.pattern};
  }
  function svg(style) {
    const c = colors(style);
    const accent = c.pattern === 'stripe'
      ? '<path d="M51 23h6l15 25h-6zM29 29h5l-8 17h-5z" fill="#a55a4b" opacity=".78"/>'
      : c.pattern === 'sunburst'
      ? '<path d="M55 35l7-7 7 7-7 7zM27 39l4-4 4 4-4 4z" fill="#e9a943"/>' : '';
    return `<svg viewBox="0 0 90 80" aria-hidden="true"><path d="M13 55h65l-11 17H27z" fill="${c.hull}" stroke="#222f3b" stroke-width="4"/><path d="M20 61h51" stroke="#d49b6b" stroke-width="3"/><path d="M44 10v47" stroke="#513b39" stroke-width="4"/><path d="M47 15l26 38H47zM38 18L20 50h18z" fill="${c.sail}" stroke="#543d39" stroke-width="4"/>${accent}<path d="M44 10h20l-5 9H44z" fill="${c.flag}" stroke="#543d39" stroke-width="2"/><path d="M14 74h64" stroke="#c1ebdd" stroke-width="4"/></svg>`;
  }
  return {choices,defaults,normalize,colors,svg};
})();

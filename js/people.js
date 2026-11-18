/* People by need: the list docked beside the network map. Order always follows need, then recency, never the alphabet. */
(function () {
  var H = window.H, h = H.h, HUB = window.HUB;
  var S = { open: {} };

  function isCold(p) { var d = H.daysSince(p._.last); return p._.contacted && d != null && d >= HUB.coldAfterDays; }
  H.isCold = isCold;
  function nextOf(p) { return p.next && p.next.action ? p.next : null; }
  function isDue(p) { var n = nextOf(p); return !!(n && n.date && n.date <= H.todayISO()); }
  /* 0 next step due, 1 going cold, 2 in touch recently, 3 never contacted */
  function need(p) { return isDue(p) ? 0 : isCold(p) ? 1 : p._.contacted ? 2 : 3; }
  function recent(a, b) { return (b._.last > a._.last ? 1 : b._.last < a._.last ? -1 : 0) || (a.id < b.id ? -1 : 1); }
  /* how much we already know around someone we have never contacted: colleagues we know, then links on the map */
  function reach(p) { return (p._.org ? H.knownAt(p._.org).length * 10 : 0) + (nextOf(p) ? 5 : 0) + (p.tags || []).length; }
  function byNeed(a, b) {
    var x = need(a), y = need(b);
    if (x !== y) return x - y;
    if (x === 0) return (nextOf(a).date < nextOf(b).date ? -1 : nextOf(a).date > nextOf(b).date ? 1 : 0) || recent(a, b);   /* longest overdue first */
    if (x === 3) return reach(b) - reach(a) || (a.id < b.id ? -1 : 1);
    return recent(a, b);                                                  /* most recently warm first */
  }

  /* The same by-need groups, docked beside the map. pick(id) selects that person on the map. */
  H.peoplePanel = function (box, pick) {
    var all = H.data.people.slice().sort(byNeed), names = ['Next step due', 'Going cold', 'In touch recently', 'Never contacted'];
    box.appendChild(h('h2', null, 'People by need'));
    box.appendChild(h('p', { class: 'small muted' }, 'Most pressing first. Tap a name to find them on the map.'));
    names.forEach(function (name, i) {
      var part = all.filter(function (p) { return need(p) === i; }); if (!part.length) return;
      var open = S.open['p' + i], cap = i === 0 ? 5 : 0;      /* the pressing group shows five; the rest open on request */
      box.appendChild(h('section', { class: 'section' }, h('h3', null, name + ' ', h('span', { class: 'muted num' }, part.length)),
        h('ul', { class: 'plist' }, part.slice(0, open ? part.length : cap).map(function (p) {
          var n = nextOf(p);
          return h('li', null, h('i', { class: 'sw dot o-' + (p._.owner || 'none') }), h('span', null,
            h('button', { class: 'link', type: 'button', onclick: function () { pick(p.id); } }, p.name.split(/ [—–-] /)[0]),
            h('span', { class: 'small muted' }, ' ' + (i === 0 && n ? H.fmtDate(n.date) + ': ' + H.clip(n.action, 60) : p._.last ? H.ago(p._.last) : p._.orgName || ''))));
        })),
        part.length > cap && !open ? h('button', { class: 'more', type: 'button', onclick: function () { S.open['p' + i] = true; H.render(); } }, cap ? 'Show all ' + part.length : 'Show') : null));
    });
  };
})();

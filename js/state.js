/* The rest of the state on one panel: product (how many recorded user needs stand behind each roadmap item) and market
   (the standing questions, marked where new evidence has arrived, and the newest moves by rivals and money). Read-only. */
(function () {
  var H = window.H, h = H.h;
  var S = {};
  /* which signals bear on which standing question: known ids first, then words in the question itself */
  var MATCH = [
    { id: /loi/, words: /\bloi\b|design partner|first (unit|customer)/, test: function (s) { return /exercise|tender|programme|contract/.test(s.kind) && /fpv|synthetic|training/.test(s.segment || '') && /UK|United Kingdom/i.test(s.geo || ''); } },
    { id: /rival/, words: /rival|competitor|wedge/, test: function (s, rival) { return rival && /product|partnership|contract|round|press/.test(s.kind); } },
    { id: /lead/, words: /pre-seed|lead investor|who leads/, test: function (s) { return s.kind === 'round' || s.kind === 'fund' || /^(investors|capital)$/.test(s.segment || ''); } },
    { id: /money/, words: /non-dilutive|grant|instrument/, test: function (s) { return /window|funding|tender/.test(s.kind) || s.segment === 'funding'; } },
    { id: /data/, words: /ukrain|data feed/, test: function (s) { return /ukrain/i.test((s.geo || '') + ' ' + (s.title || '')); } }];

  function model() {
    var D = H.data, rv = {};
    D.edges.forEach(function (e) { if (e.kind === 'competes') { if (H.isUs(e.target)) rv[e.source] = 1; if (H.isUs(e.source)) rv[e.target] = 1; } });
    var sigs = D.signals.filter(function (s) { return H.parse(s.date); }).map(function (s) { return { s: s, rival: (s.nodes || []).some(function (id) { return rv[id]; }) }; }).sort(function (a, b) { return a.s.date < b.s.date ? 1 : -1; });
    var qs = D.pirs.map(function (p) {
      var q = H.norm(p.q || p.question || ''), m = MATCH.filter(function (x) { return x.id.test(p.id); })[0] || MATCH.filter(function (x) { return x.words.test(q); })[0];
      var hits = m ? sigs.filter(function (x) { return m.test(x.s, x.rival); }) : [];
      return { id: p.id, text: p.q || p.question || 'Untitled question', owner: p.owner || '', hits: hits, fresh: hits.filter(function (x) { return H.daysSince(x.s.date) <= 14; }).length };
    }).sort(function (a, b) { return b.fresh - a.fresh || b.hits.length - a.hits.length; });
    var taken = {}, items = D.roadmap.filter(function (r) { return r.status !== 'dropped'; }).map(function (r) {
      var ids = Array.isArray(r.needIds) ? r.needIds : [], ns = D.needs.filter(function (n) { return n.roadmapId === r.id || ids.indexOf(n.id) >= 0; });
      ns.forEach(function (n) { taken[n.id] = 1; });
      return { r: r, needs: ns, proposed: r.proposed === true || !r.status || r.status === 'idea' || r.status === 'proposed' };
    }).sort(function (a, b) { return b.needs.length - a.needs.length; });
    return { sigs: sigs, qs: qs, items: items, loose: D.needs.filter(function (n) { return !taken[n.id]; }), newest: sigs[0] ? sigs[0].s.date : '' };
  }
  function sigRow(x) {
    var s = x.s;
    return h('li', { class: 'tick' }, h('span', { class: 'num tick-d' }, H.fmtDate(s.date)), h('span', { class: 'tick-k' }, x.rival ? 'Rival' : H.cap(s.kind || 'signal')),
      h('span', { class: 'tick-t', title: s.title }, s.title), s.amountUSD ? h('b', { class: 'num' }, H.money(s.amountUSD)) : null);
  }
  H.stateHead = function () {
    var m = model(), age = m.newest ? H.daysSince(m.newest) : null;
    return { n: H.data.needs.length, unit: 'needs', bad: 0, warn: age != null && age > 9 ? 1 : 0, sub: m.newest ? 'newest signal ' + age + 'd old' : 'no signals' };
  };
  H.statePanel = function (box) {
    var m = model(), max = Math.max.apply(null, m.items.map(function (i) { return i.needs.length; }).concat([m.loose.length, 1]));
    var feed = m.sigs.filter(function (x) { return x.rival || /round|fund|funding|window|contract/.test(x.s.kind); }).slice(0, 4);
    box.appendChild(h('div', { class: 'pm' },
      h('div', { class: 'pm-col' }, h('h3', { class: 'p-sub' }, 'Needs by roadmap item'),
        H.data.needs.length || m.items.length ? h('ul', { class: 'hbars' }, m.items.slice(0, 4).map(function (i) { return H.bar(H.clip(i.r.title || 'Untitled', 28), i.needs.length, max, i.proposed ? 'prop' : '', (i.r.title || '') + (i.proposed ? ' (proposed)' : '')); }), H.bar('Not in the plan', m.loose.length, max, 'loose'))
          : h('p', { class: 'p-empty' }, 'No needs or roadmap yet')),
      h('div', { class: 'pm-col' }, h('h3', { class: 'p-sub' }, 'Standing questions · new evidence'),
        m.qs.length ? h('ul', { class: 'qs' }, m.qs.slice(0, 5).map(function (q) { return h('li', { class: q.fresh ? 'fresh' : '', title: q.text }, h('i', { class: 'qmark', 'aria-hidden': 'true' }), h('span', { class: 'q-t' }, q.text), h('b', { class: 'num' }, q.fresh ? '+' + q.fresh : '0')); }))
          : h('p', { class: 'p-empty' }, 'No standing questions')),
      h('div', { class: 'pm-col wide' }, h('h3', { class: 'p-sub' }, 'Rivals and money, newest'), feed.length ? h('ul', { class: 'ticks' }, feed.map(sigRow)) : h('p', { class: 'p-empty' }, 'No signals recorded'))));
  };
  H.stateDrill = function (box) {
    var m = model();
    function need(n) {
      return h('li', { class: 'row' }, h('span', { class: 'q' }, n.statement || 'No statement'), n.status === 'proposed' ? h('span', { class: 'chip warn' }, 'unchecked') : null,
        h('div', { class: 'kv' }, n.who ? H.who(n.who) : 'Someone', n.org && H.data.nodes.has(n.org) ? [' · ', H.who(n.org)] : null, n.date ? ' · ' + H.fmtDate(n.date) : ''));
    }
    box.appendChild(h('p', { class: 'p-say' }, H.data.needs.length + ' needs · ' + m.items.length + ' roadmap items (' + m.items.filter(function (i) { return i.proposed; }).length + ' proposed) · ' + m.loose.length + ' not in the plan · ' + m.sigs.length + ' signals'));
    m.items.forEach(function (i) {
      box.appendChild(H.fold(S, 'r' + i.r.id, (i.proposed ? 'Proposed: ' : '') + (i.r.title || 'Untitled'), function (b) {
        if (i.r.why) b.appendChild(h('p', { class: 'small muted' }, i.r.why));
        b.appendChild(i.needs.length ? h('ul', { class: 'rows' }, i.needs.map(need)) : h('p', { class: 'p-empty' }, 'No recorded need behind this'));
      }, H.plural(i.needs.length, 'need')));
    });
    box.appendChild(H.fold(S, 'loose', 'Needs not in the plan', function (b) { b.appendChild(m.loose.length ? h('ul', { class: 'rows' }, m.loose.slice(0, 80).map(need)) : h('p', { class: 'p-empty' }, 'Every need is in the plan')); }, String(m.loose.length)));
    m.qs.forEach(function (q) {
      box.appendChild(H.fold(S, 'q' + q.id, q.text, function (b) { b.appendChild(q.hits.length ? h('ul', { class: 'ticks' }, q.hits.slice(0, 15).map(sigRow)) : h('p', { class: 'p-empty' }, 'No evidence filed yet')); },
        (q.fresh ? '+' + q.fresh + ' in 14 d · ' : '') + q.hits.length + ' on file'));
    });
    box.appendChild(H.fold(S, 'feed', 'All signals, newest first', function (b) { b.appendChild(h('ul', { class: 'ticks' }, m.sigs.slice(0, 80).map(sigRow))); }, String(m.sigs.length)));
  };
})();

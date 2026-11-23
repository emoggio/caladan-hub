/* Profile: one layout for a person and an organisation. */
(function () {
  var H = window.H, h = H.h;
  var S = { id: '', back: 'people', allNotes: false };
  var CHANNEL = { email: 'Email', call: 'Call', event: 'Event', meeting: 'Meeting', web: 'Web research', research: 'Research', message: 'Message' };
  var LINK = {
    introduced: ['introduced', 'was introduced by'], works_at: ['works at', 'has on staff'], part_of: ['is part of', 'includes'],
    invested: ['invested in', 'is backed by'], customer: ['is a customer of', 'has as a customer'], partner: ['partners with', 'partners with'],
    knows: ['knows', 'knows'], competes: ['competes with', 'competes with']
  };

  H.openProfile = function (id) {
    if (!H.data.nodes.has(id)) return;
    if (H.view === 'map') return H.mapSelect(id);          /* on the map the profile opens beside it */
    if (H.view !== 'profile') S.back = H.view || 'wall';
    S.id = id; S.allNotes = false;
    try { sessionStorage.setItem('hub.profile', id); } catch (e) { /* fine */ }
    H.go('profile');
    window.scrollTo(0, 0);
  };

  function fact(label, value) { return value ? h('div', { class: 'fact' }, h('dt', null, label), h('dd', null, value)) : null; }

  function touchGroup(title, cls, list) {
    if (!list.length) return null;
    return h('div', { class: 'touch-group' }, h('h3', { class: cls }, title + ' (' + list.length + ')'),
      h('ul', { class: 'touches' }, list.map(function (t) {
        var ref = t.ref || {};
        return h('li', null,
          h('span', { class: 'touch-date num' }, t.date ? H.fmtDate(t.date) : 'No date'),
          h('span', null, h('b', null, CHANNEL[t.channel] || H.cap(t.channel || 'Note')), t.context ? ': ' + t.context : '',
            H.httpUrl(ref.url) ? [' ', H.extLink(ref.url, ref.title ? H.clip(ref.title, 50) : 'source')] : (ref.title ? h('span', { class: 'muted small' }, ' (' + H.clip(ref.title, 50) + ')') : null)));
      })));
  }

  function connections(n) {
    var D = H.data, groups = {}, order = [];
    function push(label, otherId, note) {
      if (!groups[label]) { groups[label] = []; order.push(label); }
      if (!groups[label].some(function (x) { return x.id === otherId; })) groups[label].push({ id: otherId, note: note });
    }
    D.edges.forEach(function (e) {
      if (e.source === n.id) push(LINK[e.kind] ? LINK[e.kind][0] : 'is linked to', e.target, e.note);
      else if (e.target === n.id) push(LINK[e.kind] ? LINK[e.kind][1] : 'is linked to', e.source, e.note);
    });
    if (n._.org && !D.edges.some(function (e) { return e.kind === 'works_at' && e.source === n.id; })) push('works at', n._.org);
    (D.staff.get(n.id) || []).forEach(function (id) { push('has on staff', id); });
    if (!order.length) return h('p', { class: 'muted' }, 'No connections recorded yet.');
    return h('dl', { class: 'facts' }, order.map(function (label) {
      var list = groups[label];
      return fact(n.name + ' ' + label, [list.slice(0, 14).map(function (x, i) { return [i ? ', ' : '', H.nodeLink(x.id)]; }), list.length > 14 ? ' and ' + (list.length - 14) + ' more' : null]);
    }));
  }

  function sources(n) {
    var seen = {}, out = [];
    function add(url, title) { var u = H.httpUrl(url); if (u && !seen[u]) { seen[u] = 1; out.push(H.extLink(u, title ? H.clip(title, 60) : null)); } }
    add(n.website, 'Website'); add(n.linkedin, 'LinkedIn'); add(n.source);
    (n.touchpoints || []).forEach(function (t) { if (t.ref) add(t.ref.url, t.ref.title); });
    [n.fin && n.fin.source, n.fund && n.fund.source, n.factcheck && n.factcheck.sources].forEach(function (s) { [].concat(s || []).forEach(function (u) { add(u); }); });
    var plain = !H.httpUrl(n.source) && n.source ? h('p', { class: 'small muted' }, 'Added from: ' + H.clip(n.source, 160)) : null;
    if (!out.length && !plain) return h('p', { class: 'muted' }, 'No sources recorded.');
    return [plain, h('ul', { class: 'sources' }, out.slice(0, 30).map(function (a) { return h('li', null, a); }))];
  }

  H.views = H.views || {};
  H.views.profile = function (root) {
    var D = H.data, n = D.nodes.get(S.id);
    if (!n) { var saved = null; try { saved = sessionStorage.getItem('hub.profile'); } catch (e) { /* fine */ } n = saved && D.nodes.get(saved); if (n) S.id = n.id; }
    if (!n) { H.go('wall'); return; }
    H.renderProfile(root, n.id, {});
  };
  /* opts.panel: drawn beside the map, so no Back button */
  H.renderProfile = function (root, id, opts) {
    var D = H.data, n = D.nodes.get(id);
    if (!n) return;
    var x = n._, person = n.type === 'person', tps = (n.touchpoints || []).slice().sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; });
    if (!opts.panel) root.appendChild(h('div', null, h('button', { class: 'btn quiet', type: 'button', onclick: function () { H.go(S.back === 'profile' ? 'wall' : S.back); } }, '← Back')));

    var summary = !x.contacted ? 'Neither of you has been in contact yet.'
      : 'Last contact ' + (x.last ? H.ago(x.last) : 'on an unrecorded date') + '. ' + (x.nE ? 'Eugenio ' + H.plural(x.nE, 'time') : '') + (x.nE && x.nA ? ', ' : '') + (x.nA ? 'Alex ' + H.plural(x.nA, 'time') : '') + '.';
    root.appendChild(h('div', { class: 'section profile-head' },
      h('div', { class: 'chips' }, h('span', { class: 'chip' }, person ? 'Person' : n.type === 'org' ? 'Organisation' : n.type === 'military' ? 'Military unit' : 'Programme'),
        n.status && n.status !== 'reference' ? h('span', { class: 'chip' }, H.cap(n.status)) : null,
        x.ref ? h('span', { class: 'chip', title: 'From market research: neither of you has dealt with them directly' }, 'Researched firm') : null,
        H.isCold && person && H.isCold(n) ? h('span', { class: 'chip warn' }, 'Going cold') : null),
      h('h2', null, n.name),
      h('p', { class: 'lead' }, person ? [n.role || 'Role not recorded', x.org ? [' at ', H.nodeLink(x.org)] : null, '. '] : (x.sector ? x.sector + '. ' : ''), summary),
      h('div', { class: 'pills' }, h('button', { class: 'btn', type: 'button', onclick: function () { H.openPaths(n.id); } }, x.contacted ? 'Show who else knows them' : 'Show a route in on the map'))));

    if (n.next && n.next.action) root.appendChild(h('div', { class: 'card next' }, h('b', null, 'Next step' + (n.next.date ? ' · ' + H.fmtDate(n.next.date) : '') + ': '), n.next.action, n.next.who ? h('span', { class: 'muted' }, ' (' + n.next.who + ')') : null,
      ' ', h('button', { class: 'sw-btn', type: 'button', onclick: function () { H.stepAct({ ref: { t: 'node', id: n.id }, task: n.next.action }, 'done'); } }, 'Mark done'), H.lastAction() ? h('button', { class: 'sw-btn quiet', type: 'button', onclick: function () { H.undo(); } }, 'Undo') : null));

    var f = n.fin || {}, fd = n.fund || {};
    root.appendChild(h('div', { class: 'section' }, h('header', null, h('h3', null, 'Facts')), h('dl', { class: 'facts card' },
      fact('Email', n.email), fact('Phone', n.phone), fact('LinkedIn', H.extLink(n.linkedin, 'Open profile')), fact('Website', H.extLink(n.website)),
      fact('Country', n.country), fact('Sector', person ? x.sector : null), fact('Looked after by', x.owner ? H.cap(x.owner) : null),
      fact('First contact', H.fmtDate(n.firstContact)), fact('Tags', (n.tags || []).length ? (n.tags || []).join(', ') : null),
      fact('Raised in total', H.money(f.fundingUSD)), fact('Valued at', H.money(f.valuationUSD)),
      fact('Latest round', f.lastRound ? [f.lastRound.type, H.money(f.lastRound.amountUSD), H.fmtDate(f.lastRound.date), f.lastRound.lead ? 'led by ' + f.lastRound.lead : ''].filter(Boolean).join(' · ') : null),
      fact('Investors', Array.isArray(f.investors) && f.investors.length ? f.investors.join(', ') : null), fact('Head office', f.hq), fact('Staff', f.staff),
      fact('Funding type', fd.cashType), fact('Funding status', fd.status), fact('Next deadline', fd.nextDeadline), fact('Who can apply', fd.eligibility), fact('Amount', fd.amount),
      fact('Fact check', n.factcheck ? [n.factcheck.verdict ? H.cap(n.factcheck.verdict) + ' · ' : '', H.fmtDate(n.factcheck.date)].join('') : null))));

    if (n.notes) {
      var long = n.notes.length > 600 && !S.allNotes;
      root.appendChild(h('div', { class: 'section' }, h('header', null, h('h3', null, 'Notes')),
        h('p', { class: 'notes card' }, long ? H.clip(n.notes, 600) : n.notes),
        long ? h('button', { class: 'btn quiet', type: 'button', onclick: function () { S.allNotes = true; H.render(); } }, 'Show all notes') : null));
    }

    var E = [], A = [], B = [], C = [];
    tps.forEach(function (t) { var w = H.touchWho(t); (w.eugenio && w.alex ? B : w.eugenio ? E : w.alex ? A : C).push(t); });
    root.appendChild(h('div', { class: 'section' }, h('header', null, h('h3', null, 'Contact history')),
      tps.length ? h('div', { class: 'touch-grid' }, touchGroup('Both together', '', B), touchGroup('Eugenio', 'eug', E), touchGroup('Alex', 'alex', A), touchGroup('Background research', 'muted', C))
        : h('div', { class: 'empty' }, h('p', null, 'Nothing logged yet.'))));

    root.appendChild(h('div', { class: 'section' }, h('header', null, h('h3', null, 'Connections')), h('div', { class: 'card' }, connections(n))));
    root.appendChild(h('div', { class: 'section' }, h('header', null, h('h3', null, 'Sources')), h('div', { class: 'card' }, sources(n))));
  };
})();

/* The wall: every instrument in a fixed place, the whole state at once. It is glass: nothing here takes input. Each
   panel's header opens its drill-in (drill.js), where the full lists and the few switches live.
   Who asked for what: Systems = "if things are broken"; Goals, Customers, Raise, Product and market = "where things are
   at / the current state of everything"; Needs doing = "if things need doing"; Network = the graph he asked to keep. */
(function () {
  var H = window.H, h = H.h;
  var OWNER = { eugenio: 'Eugenio', alex: 'Alex', both: 'Both', unassigned: 'No owner' };

  /* one panel: a header that states the number and a light, then the instrument */
  function panel(key, title, head, build, drill) {
    var lvl = head.lvl || (head.bad ? 'bad' : head.warn ? 'warn' : 'ok');
    var body = h('div', { class: 'p-body' });
    var el = h('section', { class: 'panel p-' + key, 'aria-label': title },
      h('button', { class: 'p-head', type: 'button', title: 'Open ' + title, onclick: function () { H.go(drill || key); } },
        h('span', { class: 'p-title' }, title), h('span', { class: 'p-light lvl-' + lvl, 'aria-hidden': 'true' }),
        h('span', { class: 'p-n num' }, head.n, h('small', null, ' ' + head.unit)), head.sub ? h('span', { class: 'p-sub2' }, head.sub) : null, h('span', { class: 'p-open', 'aria-hidden': 'true' }, '↗')), body);
    try { build(body); } catch (e) { console.error(e); body.appendChild(h('p', { class: 'p-empty' }, 'This panel could not be drawn')); }
    return el;
  }

  function todoPanel(box) {
    var b = H.backlog(), total = b.steps.length, props = H.confirmCount(), inbox = H.inboxPending().length;
    function stat(n, label, cls, drill) { return h('button', { class: 'stat' + (cls ? ' ' + cls : ''), type: 'button', onclick: function (ev) { ev.stopPropagation(); H.openTodo(drill); } }, h('b', { class: 'num' }, n), h('span', null, label)); }
    box.appendChild(h('div', { class: 'age', role: 'img', 'aria-label': 'Due steps by age: ' + b.buckets.map(function (x) { return x.label + ' ' + x.n; }).join(', ') },
      b.buckets.map(function (x) { return h('div', { class: 'age-seg a-' + x.key, style: 'flex:' + Math.max(x.n, total ? total * 0.09 : 1) + ' 1 0' }, h('b', { class: 'num' }, x.n), h('span', null, x.label)); })));
    var max = Math.max.apply(null, b.owners.map(function (o) { return o.n; }).concat([1]));
    box.appendChild(h('ul', { class: 'hbars owners' }, b.owners.map(function (o) { return H.bar(OWNER[o.key], o.n, max, 'o-' + o.key); })));
    box.appendChild(h('div', { class: 'stats' },
      stat(b.orphans.length, 'no owner or no goal: drop?', b.orphans.length ? 'warn' : '', 'orphans'),
      stat(b.stale.length, 'stale over 30 days', b.stale.length ? 'bad' : '', 'stale'),
      stat(props, 'awaiting yes / no', props ? 'warn' : '', 'proposals'),
      stat(b.promises.length, 'promises open' + (b.promisesLate ? ', ' + b.promisesLate + ' late' : ''), b.promisesLate ? 'warn' : '', 'promises'),
      inbox ? stat(inbox, 'inbox notes need an answer', 'warn', 'systems') : null));
  }
  function todoHead() { var b = H.backlog(); return { n: b.steps.length, unit: 'due', bad: b.stale.length, warn: b.steps.length, sub: b.buckets[0].n + ' today' }; }

  /* the network map, drawn small by the same code that draws it full screen */
  function networkPanel(box) {
    var M = H.mapState, D = H.data, cold = D.people.filter(function (p) { return H.isCold(p); }).length, never = D.people.filter(function (p) { return !p._.contacted; }).length;
    box.appendChild(h('div', { class: 'stats tight' }, h('div', { class: 'stat' }, h('b', { class: 'num' }, D.people.length), h('span', null, 'people')),
      h('div', { class: 'stat' + (cold ? ' warn' : '') }, h('b', { class: 'num' }, cold), h('span', null, 'gone quiet')), h('div', { class: 'stat' }, h('b', { class: 'num' }, never), h('span', null, 'never reached'))));
    var radar = h('div', { class: 'radar' }), open = h('button', { class: 'radar-open', type: 'button', 'aria-label': 'Open the network map full screen', onclick: function () { M.view = null; M.lens = M.lens || 'attention'; H.go('map'); } });
    box.appendChild(h('div', { class: 'radar-wrap' }, radar, open));
    H.afterRender(function () {
      if (!radar.isConnected || radar.clientHeight < 60) return;
      var keep = { list: M.list, key: M.key, sel: M.sel, route: M.route, extra: M.extra };
      M.list = false; M.key = false; M.sel = ''; M.route = ''; M.extra = null; M.view = null;
      try { H.views.map(radar); } catch (e) { console.error(e); }
      M.list = keep.list; M.key = keep.key; M.sel = keep.sel; M.route = keep.route; M.extra = keep.extra;
    });
  }

  H.views = H.views || {};
  H.views.wall = function (root, drillOpen) {
    var D = H.data;
    var wall = h('div', { class: 'wall' },
      panel('systems', 'Systems', H.systemsHead(), H.systemsPanel),
      panel('todo', 'Needs doing', todoHead(), todoPanel),
      panel('goals', 'Goals', H.goalsHead(), H.goalsPanel),
      panel('customers', 'Customers', H.pipeHead('opp'), function (b) { H.pipePanel('opp', b); }),
      panel('raise', 'Raise', H.pipeHead('raise'), function (b) { H.pipePanel('raise', b); }),
      panel('network', 'Network', { n: D.nodes.size, unit: 'on the map', bad: 0, warn: 0, sub: D.edges.length + ' links' }, drillOpen ? function (b) { b.appendChild(h('p', { class: 'p-empty' }, 'Map paused while a panel is open')); } : networkPanel, 'map'),
      panel('state', 'Product and market', H.stateHead(), H.statePanel));
    root.appendChild(wall);
    var folder = D.settings && typeof D.settings.brainFolderId === 'string' && /^[\w-]{10,}$/.test(D.settings.brainFolderId) ? 'https://drive.google.com/drive/folders/' + D.settings.brainFolderId : '';
    root.appendChild(h('p', { class: 'talk' }, 'This wall only shows. To change anything, tell Claude or Grok',
      folder ? [', or drop a note in the ', h('a', { href: folder, target: '_blank', rel: 'noopener' }, D.settings.brainFolderName || 'bot folder'), '.'] : '.'));
  };
})();

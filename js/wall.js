/* The wall: every instrument in a fixed place, the whole state at once. It is glass: nothing here takes input. Each
   panel's header opens its drill-in (drill.js), where the full lists and the few switches live.
   Who asked for what: Systems = "if things are broken"; Goals, Customers, Raise, Product and market = "where things are
   at / the current state of everything"; Needs doing = "if things need doing"; Network = the graph he asked to keep. */
(function () {
  var H = window.H, h = H.h;
  var OWNER = { eugenio: 'Eugenio', alex: 'Alex', both: 'Both', unassigned: 'No owner' };

  /* one panel: a header that states the number and a light, then the instrument */
  /* which collections each panel reads, for its "updated" stamp */
  var READS = { systems: ['status'], todo: ['commitments', 'decisions', 'opportunities', 'raise'], goals: ['goals'], customers: ['opportunities'], raise: ['raise'], network: ['nodes', 'edges'], state: ['signals', 'needs', 'roadmap'] };
  /* the words a status chip falls back on when the panel has nothing more specific to say */
  var WORD = { ok: 'All clear', warn: 'Needs a look', bad: 'Problem', none: 'No data yet' };
  function panel(key, title, head, build, drill) {
    var last = READS[key] ? H.newest(READS[key]) : '', upd = H.londonWhen(last), old = last && Date.now() - Date.parse(last) > 864e5;
    var lvl = head.lvl || (head.bad ? 'bad' : head.warn ? 'warn' : 'ok');
    var body = h('div', { class: 'p-body' });
    var el = h('section', { class: 'panel p-' + key, 'aria-label': title },
      h('button', { class: 'p-head', type: 'button', title: 'Open ' + title, onclick: function () { H.go(drill || key); } },
        h('span', { class: 'p-row' }, h('span', { class: 'p-title' }, title),
          upd ? h('span', { class: 'p-upd' + (old ? ' old' : ''), title: 'Newest change in what this panel reads (London time)' }, 'Updated ' + upd) : null,
          h('span', { class: 'p-open', 'aria-hidden': 'true' })),
        h('span', { class: 'p-hero' }, h('span', { class: 'p-n num' }, h('span', { 'data-k': 'panel-' + key + '-n', 'data-v': typeof head.n === 'number' ? head.n : null }, head.n), h('small', null, ' ' + head.unit)),
          h('span', { class: 'p-status lvl-' + lvl }, h('i', { class: 'p-light', 'aria-hidden': 'true' }), head.sub || WORD[lvl]), head.side || null),
        head.foot || null), body);
    try { build(body); } catch (e) { console.error(e); body.appendChild(h('p', { class: 'p-empty' }, 'This panel could not be drawn')); }
    return el;
  }

  /* needs doing: one segmented bar of due steps by age, and under it the same buckets as a list with count and share */
  var AGE = { today: 'Due today', week: '1-7 days late', month: '8-30 days late', old: 'Over 30 days late' };
  function todoPanel(box) {
    var b = H.backlog(), total = b.steps.length, props = H.confirmCount(), parked = H.parked().length, inbox = H.inboxPending().length;
    function stat(n, label, cls, drill, k) { return h('button', { class: 'stat' + (cls ? ' ' + cls : ''), type: 'button', onclick: function (ev) { ev.stopPropagation(); H.openTodo(drill); } }, h('b', { class: 'num', 'data-k': 'todo-' + k, 'data-v': n }, n), h('span', null, label)); }
    var shown = b.buckets.filter(function (x) { return x.n; });
    box.appendChild(h('div', { class: 'agebar', role: 'img', 'aria-label': 'Due steps by age: ' + b.buckets.map(function (x) { return AGE[x.key] + ' ' + x.n; }).join(', ') },
      total ? h('span', { class: 'agebar-f', 'data-k': 'todo-age-bar', 'data-v': total }, shown.map(function (x) {
        return h('i', { class: 'a-' + x.key, style: 'flex:' + x.n + ' 1 0', 'data-k': 'todo-age-' + x.key + '-seg', 'data-v': x.n });
      })) : null));
    box.appendChild(h('ul', { class: 'agelist' }, b.buckets.map(function (x) {
      return h('li', { class: 'a-' + x.key + (x.n ? '' : ' zero') }, h('i', { class: 'dot', 'aria-hidden': 'true' }), h('span', null, AGE[x.key]),
        h('b', { class: 'num', 'data-k': 'todo-age-' + x.key, 'data-v': x.n }, x.n), h('span', { class: 'num agelist-p' }, total ? Math.round(x.n / total * 100) + '%' : '–'));
    })));
    box.appendChild(h('div', { class: 'stats' },
      stat(props, 'waiting for your yes / no', props ? 'warn' : '', 'proposals', 'waiting'),
      stat(parked, 'answered, with Alex or parked', '', 'parked', 'parked'),
      stat(b.promises.length, 'promises open' + (b.promisesLate ? ', ' + b.promisesLate + ' late' : ''), b.promisesLate ? 'warn' : '', 'promises', 'promises'),
      inbox ? stat(inbox, 'inbox notes need an answer', 'warn', 'systems', 'inbox') : null));
  }
  /* red when a step is over 30 days late, amber only when some are 8 to 30 days late; a fresh queue is not a warning */
  function todoHead() { var b = H.backlog(), month = b.buckets.filter(function (x) { return x.key === 'month'; })[0]; return { n: b.steps.length, unit: 'due', bad: b.stale.length, warn: month ? month.n : 0, sub: b.buckets[0].n + ' today' }; }

  /* the network map, drawn small by the same code that draws it full screen */
  function networkPanel(box) {
    var M = H.mapState, D = H.data, cold = D.people.filter(function (p) { return H.isCold(p); }).length, never = D.people.filter(function (p) { return !p._.contacted; }).length;
    /* crossed the cold line in the last 7 days: same last-contact date and the same coldAfterDays the cold test uses */
    var C = window.HUB.coldAfterDays, newly = D.people.filter(function (p) { var d = H.daysSince(p._.last); return H.isCold(p) && d < C + 7; }).length;
    box.appendChild(h('div', { class: 'stats tight' }, h('div', { class: 'stat' }, h('b', { class: 'num', 'data-k': 'net-people', 'data-v': D.people.length }, D.people.length), h('span', null, 'people')),
      h('div', { class: 'stat' + (cold ? ' warn' : '') }, h('b', { class: 'num', 'data-k': 'net-quiet', 'data-v': cold }, cold), h('span', null, 'gone quiet'),
        h('small', { class: 'stat-d num', 'data-k': 'net-quiet-week', 'data-v': newly }, newly ? '+' + newly + ' went quiet this week' : 'none went quiet this week')),
      h('div', { class: 'stat' }, h('b', { class: 'num', 'data-k': 'net-never', 'data-v': never }, never), h('span', null, 'never reached'))));
    var radar = h('div', { class: 'radar' }), open = h('button', { class: 'radar-open', type: 'button', 'aria-label': 'Open the network map full screen', onclick: function () { M.view = null; M.lens = M.lens || 'attention'; H.go('map'); } });
    box.appendChild(h('div', { class: 'radar-wrap' }, radar, open));
    H.afterRender(function () {
      if (!radar.isConnected || radar.clientHeight < 60) return;
      var keep = { list: M.list, key: M.key, sel: M.sel, route: M.route, extra: M.extra };
      M.list = false; M.key = false; M.sel = ''; M.route = ''; M.extra = null; M.view = null; M.small = true;   /* the wall's thumbnail is always 2D */
      try { H.views.map(radar); } catch (e) { console.error(e); }
      M.small = false; M.view = null;   /* the thumbnail's framing must not carry over to the full map */
      M.list = keep.list; M.key = keep.key; M.sel = keep.sel; M.route = keep.route; M.extra = keep.extra;
    });
  }

  H.views = H.views || {};
  H.views.wall = function (root, drillOpen) {
    var D = H.data;
    if (!drillOpen) H.drillShown = '';
    var wall = h('div', { class: 'wall' },
      panel('systems', 'Systems', H.systemsHead(), H.systemsPanel),
      panel('goals', 'Goals', H.goalsHead(), H.goalsPanel),
      panel('todo', 'Needs doing', todoHead(), todoPanel),
      panel('customers', 'Customers', H.pipeHead('opp'), function (b) { H.pipePanel('opp', b); }),
      panel('raise', 'Raise', H.pipeHead('raise'), function (b) { H.pipePanel('raise', b); }),
      panel('network', 'Network', { n: (function () { var k = 0; D.nodes.forEach(function (x, id) { if (!H.isUs(id) && !H.refHidden(id)) k++; }); return k; })(), unit: 'on the map', bad: 0, warn: 0, sub: D.edges.length + ' links' }, drillOpen ? function (b) { b.appendChild(h('p', { class: 'p-empty' }, 'Map paused while a panel is open')); } : networkPanel, 'map'),
      panel('state', 'Product and market', H.stateHead(), H.statePanel));
    root.appendChild(wall);
    root.appendChild(h('p', { class: 'talk' }, 'This wall only shows. To change anything, tell Grok.'));
  };
})();

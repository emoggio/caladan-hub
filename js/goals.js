/* Goals: the scoreboard. Reads goals/{id} in whatever shape it is in, draws one gauge per goal on the wall, and in the
   drill-in shows what is tied to each goal with the one small switch a founder has here: the number and the status. */
(function () {
  var H = window.H, h = H.h;
  var STATUS = { 'on-track': ['On track', 'good'], 'at-risk': ['At risk', 'warn'], 'off-track': ['Off track', 'bad'], done: ['Done', 'done'], unknown: ['Unknown', 'none'] };
  var OPTS = [['unknown', 'Unknown'], ['on-track', 'On track'], ['at-risk', 'At risk'], ['off-track', 'Off track'], ['done', 'Done']];

  function num(x) { return typeof x === 'number' && !isNaN(x) ? x : null; }
  /* goals typed as a sentence ("Currently the goal is to open the raise…") are shown as a short label */
  function tidy(t) {
    t = String(t).trim().replace(/^XC(?=[A-Z])/, '').replace(/^(currently,? )?(the|our) goal is to /i, '').replace(/^(to )?have (an? )?/i, '').replace(/[.\s]+$/, '');
    if (t.length > 52) { t = t.slice(0, 52); t = t.slice(0, Math.max(24, t.lastIndexOf(' '))).replace(/[ ,;:]+$/, '') + '…'; }
    return H.cap(t);
  }
  H.goalList = function () {
    var list = H.data.goals.filter(function (g) { return !g.archived; }).map(function (g) {
      var by = typeof g.by === 'string' && H.parse(g.by) ? g.by.slice(0, 10) : '';
      return { id: g.id, raw: g, n: num(g.n), title: tidy(g.short || g.title || g.text || g.measure || 'Untitled goal'), text: g.text || '', measure: g.measure || '',
        by: by, left: H.daysTo(by), owner: g.owner || '', current: num(g.current), currentText: typeof g.current === 'string' && g.current.trim() ? g.current.trim() : '', target: num(g.target), unit: g.unit || '',
        /* who it waits on: the person a founder passed it to (triage), else the owner when a founder has answered */
        waitOn: g.triage && g.triage.answer && g.status !== 'done' ? (g.triage.decisionOwner || g.owner || '') : '', answer: g.triage && g.triage.answer || '',
        status: STATUS[g.status] ? g.status : g.done === true ? 'done' : 'unknown', updatedAt: g.updatedAt || '' };
    });
    list.sort(function (a, b) { return (a.n == null ? 99 : a.n) - (b.n == null ? 99 : b.n) || ((a.raw.createdAt || '') < (b.raw.createdAt || '') ? -1 : 1); });
    list.forEach(function (g, i) { g.no = g.n == null ? i + 1 : g.n; });
    return list;
  };
  H.goalById = function (id) { return H.goalList().filter(function (g) { return g.id === id; })[0] || null; };
  /* a small "G1" tag for anything that serves a goal */
  H.goalChip = function (id) {
    var g = id && H.goalById(id); if (!g) return null;
    return h('span', { class: 'chip gchip g-' + STATUS[g.status][1], title: 'Goal ' + g.no + ': ' + g.title }, h('i', { class: 'gdot' }), 'G' + g.no);
  };
  /* which goal a person or organisation serves, through the two pipelines */
  H.goalLinks = function () {
    var D = H.data, m = {};
    D.opportunities.forEach(function (o) { if (!o.goalId) return; [o.orgId, o.champion].forEach(function (id) { if (id && D.nodes.has(id)) m[id] = o.goalId; }); });
    D.raise.forEach(function (r) { if (r.goalId && r.investorId && D.nodes.has(r.investorId)) m[r.investorId] = r.goalId; });
    return m;
  };
  H.measureText = function (g) {
    if (g.current != null && g.target != null) return g.current + ' of ' + g.target + (g.unit ? ' ' + g.unit : '');
    if (g.current != null) return g.current + (g.unit ? ' ' + g.unit : '');
    if (g.target != null) return 'unknown of ' + g.target + (g.unit ? ' ' + g.unit : '');
    return '';
  };
  function when(g) {
    if (g.status === 'done') return 'done';
    if (g.waitOn && (g.left == null || g.left < 0)) return h('span', { class: 'warn-t' }, (g.by ? 'date passed · ' : '') + 'waiting on ' + H.whoText(g.waitOn));
    if (!g.by) return h('span', { class: 'muted' }, 'no date');
    return g.left < 0 ? h('span', { class: 'late' }, (-g.left) + 'd late') : g.left === 0 ? h('span', { class: 'late' }, 'today') : g.left + 'd left';
  }

  /* one gauge: the number against its target on a track, the status as a light and a word, the days as text */
  function gauge(g) {
    var st = STATUS[g.status], pct = g.current != null && g.target ? Math.max(0, Math.min(1, g.current / g.target)) : null;
    /* a done goal is one quiet line, not a gauge */
    if (g.status === 'done') return h('li', { class: 'gauge g-done done-row', title: g.answer || g.text }, h('div', { class: 'ga-top' }, h('span', { class: 'ga-no num' }, 'G' + g.no), h('span', { class: 'ga-title' }, g.title), h('span', { class: 'ga-status' }, h('i', { class: 'gdot' }), 'Done')));
    /* text in "current" is shown as text; no number is "count not recorded", never a bare "?" */
    if (g.current == null) return h('li', { class: 'gauge g-' + st[1], title: g.answer || g.text || g.title },
      h('div', { class: 'ga-top' }, h('span', { class: 'ga-no num' }, 'G' + g.no), h('span', { class: 'ga-title' }, g.title), h('span', { class: 'ga-when num' }, when(g))),
      h('div', { class: 'ga-mid' }, h('span', { class: 'ga-txt' }, g.currentText || 'Count not recorded', g.target != null ? h('small', null, ' · target ' + g.target + (g.unit ? ' ' + g.unit : '')) : null),
        h('span', { class: 'ga-status' }, h('i', { class: 'gdot' }), g.waitOn ? 'With ' + H.whoText(g.waitOn) : st[0])),
      g.answer ? h('p', { class: 'ga-ans' }, g.answer) : null);
    return h('li', { class: 'gauge g-' + st[1], title: g.text || g.title },
      h('div', { class: 'ga-top' }, h('span', { class: 'ga-no num' }, 'G' + g.no), h('span', { class: 'ga-title' }, g.title), h('span', { class: 'ga-when num' }, when(g))),
      h('div', { class: 'ga-mid' },
        h('span', { class: 'ga-num num' }, g.current != null ? g.current : '?', g.target != null ? h('small', null, ' / ' + g.target + (g.unit ? ' ' + g.unit : '')) : h('small', null, g.current != null && g.unit ? ' ' + g.unit : ' no target')),
        h('span', { class: 'ga-status' }, h('i', { class: 'gdot' }), st[0])),
      h('div', { class: 'ga-track' + (pct == null ? ' unknown' : ''), role: 'img', 'aria-label': pct == null ? 'progress unknown' : Math.round(pct * 100) + ' percent of target' }, pct != null ? h('i', { style: 'width:' + Math.round(pct * 100) + '%' }) : null));
  }
  H.goalsPanel = function (box) {
    var goals = H.goalList();
    if (!goals.length) { box.appendChild(h('p', { class: 'p-empty' }, 'No goals recorded')); return; }
    box.appendChild(h('ul', { class: 'gauges' }, goals.slice(0, 5).map(gauge)));
  };
  H.goalsHead = function () {
    var goals = H.goalList(), bad = goals.filter(function (g) { return g.status === 'off-track' || (g.left != null && g.left < 0 && g.status !== 'done' && !g.waitOn); }).length;
    var waiting = goals.filter(function (g) { return g.waitOn; }).length;
    var unknown = goals.filter(function (g) { return g.status === 'unknown'; }).length;
    return { n: goals.length, unit: goals.length === 1 ? 'goal' : 'goals', bad: bad,
      warn: goals.filter(function (g) { return g.status === 'at-risk'; }).length + waiting,
      sub: bad ? bad + ' off track or late' : waiting ? waiting + ' waiting on someone' : unknown ? unknown + ' unknown' : goals.length ? 'on track' : '' };
  };

  /* drill-in: what stands behind each goal, and the switch */
  function setter(g) {
    var cur = h('input', { id: 'gs-n-' + g.id, class: 'mini-in', type: 'number', step: 'any', value: g.current == null ? '' : g.current, 'aria-label': 'Goal ' + g.no + ' number now' });
    var st = H.select('gs-s-' + g.id, OPTS, g.status); st.className = 'mini-in'; st.setAttribute('aria-label', 'Goal ' + g.no + ' status');
    return h('span', { class: 'switches' }, cur, g.target != null ? h('span', { class: 'kv' }, 'of ' + g.target) : null, st,
      h('button', { class: 'sw-btn', type: 'button', onclick: function () {
        var v = cur.value.trim(), n = v === '' || isNaN(+v) ? null : +v;
        if (n === g.current && st.value === g.status) return H.toast('Nothing changed');
        H.goalSet(g, n, st.value);
      } }, 'Set'));
  }
  H.goalsDrill = function (box) {
    var D = H.data, goals = H.goalList();
    if (!goals.length) { box.appendChild(h('p', { class: 'p-empty' }, 'No goals recorded. Tell a bot the goals and they appear here.')); return; }
    goals.forEach(function (g) {
      var st = STATUS[g.status], opps = D.opportunities.filter(function (o) { return o.goalId === g.id; }), inv = D.raise.filter(function (r) { return r.goalId === g.id; });
      var steps = H.backlog().steps.filter(function (c) { return c.goalId === g.id; }).length, log = Array.isArray(g.raw.log) ? g.raw.log.slice(-3).reverse() : [];
      box.appendChild(h('section', { class: 'd-block g-' + st[1] },
        h('header', { class: 'd-head' }, h('h3', null, h('span', { class: 'ga-no num' }, 'G' + g.no), ' ' + g.title), h('span', { class: 'ga-status' }, h('i', { class: 'gdot' }), st[0])),
        g.answer ? h('p', { class: 'row-ans' }, H.whoText(g.raw.triage.by) + (g.raw.triage.date ? ' (' + H.fmtDate(g.raw.triage.date) + ')' : '') + ': ' + g.answer) : null,
        h('p', { class: 'kv' }, 'Now ', h('b', null, H.measureText(g) || g.currentText || 'count not recorded'), ' · due ', h('b', null, g.by ? H.fmtDate(g.by) : 'not set'), ' (', when(g), ') · owner ', h('b', null, g.owner ? H.whoText(g.owner) : 'not set'),
          ' · ', h('b', null, opps.length), ' customers · ', h('b', null, inv.length), ' investors · ', h('b', null, steps), ' steps due'),
        g.text && g.text !== g.title ? h('p', { class: 'small muted' }, g.text) : null,
        g.measure ? h('p', { class: 'small muted' }, 'Measure: ' + g.measure) : null,
        g.raw.v2Note ? h('p', { class: 'small muted' }, 'Note: ' + H.clip(g.raw.v2Note, 260)) : null,
        log.length ? h('ul', { class: 'rows' }, log.map(function (l) { var to = l.to || {}; return h('li', { class: 'row small' }, h('span', { class: 'num kv' }, H.agoTime(l.date)), ' ' + H.whoText(l.by) + ' set ' + (to.current != null ? to.current : '?') + ', ' + (STATUS[to.status] ? STATUS[to.status][0] : to.status || '') + (l.source ? ' · ' + l.source : '')); })) : null,
        setter(g)));
    });
  };
})();

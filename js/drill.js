/* Drill-ins: a sheet over the wall with the full list behind a panel. Read-only by default; the few switches (done,
   drop, confirm, reject, a goal's number) sit on an opened row, and each one can be undone from the bar at the bottom.
   Esc closes. */
(function () {
  var H = window.H, h = H.h;
  var S = { tab: 'steps', open: '', shown: 20, arm: '' };
  var TITLES = { systems: 'Systems', goals: 'Goals', customers: 'Customers', raise: 'Raise', todo: 'Needs doing', state: 'Market and product' };
  var OWNER = { eugenio: 'Eugenio', alex: 'Alex', both: 'Both', unassigned: 'No owner' };
  H.drills = Object.keys(TITLES);
  H.openTodo = function (tab) { if (tab === 'systems') return H.go('systems'); S.tab = tab || 'steps'; S.open = ''; S.shown = 20; S.arm = ''; if (H.view === 'todo') H.render(); else H.go('todo'); };

  function sw(label, fn, cls) { return h('button', { class: 'sw-btn' + (cls ? ' ' + cls : ''), type: 'button', onclick: function (ev) { ev.stopPropagation(); fn(); } }, label); }
  function people(ids) {
    var D = H.data; ids = (ids || []).filter(function (id) { return D.nodes.has(id) && !H.isUs(id); }).slice(0, 3);
    return ids.length ? h('span', { class: 'chips' }, ids.map(function (id) { return h('span', { class: 'chip who' }, H.nodeLink(id, H.clip(H.shortName(D.nodes.get(id).name), 28))); })) : null;
  }
  function stepRow(c) {
    var open = S.open === c.id;
    return h('li', { class: 'row step' + (open ? ' open' : '') },
      h('button', { class: 'row-h', type: 'button', 'aria-expanded': String(open), onclick: function () { S.open = open ? '' : c.id; H.render(); } },
        h('span', { class: 'age-tag num' + (c.late > 30 ? ' bad' : c.late ? ' warn' : '') }, c.late ? c.late + 'd' : 'today'),
        h('span', { class: 'row-main' }, h('span', { class: 'row-t' }, c.task), h('span', { class: 'row-sub' }, c.kind + (c.name ? ' · ' + c.name : ''))),
        H.goalChip(c.goalId) || h('span', { class: 'chip none' }, 'no goal'),
        h('span', { class: 'own o-' + c.owner }, OWNER[c.owner])),
      open ? h('div', { class: 'row-x' }, h('span', { class: 'kv' }, 'Due ' + H.fmtDate(c.due) + (c.who ? ' · ' + c.who : '')), people(c.nodes),
        h('span', { class: 'switches' }, sw('Done', function () { H.stepAct(c, 'done'); }), sw('Drop', function () { H.stepAct(c, 'drop'); }, 'quiet'))) : null);
  }
  function stepList(box, list, empty, bulk) {
    if (!list.length) { box.appendChild(h('p', { class: 'p-empty' }, empty)); return; }
    if (bulk) box.appendChild(S.arm === bulk
      ? h('p', { class: 'bulk' }, h('b', null, 'Drop all ' + list.length + '? '), 'They stay on record as dropped. One Undo puts them back. ', sw('Yes, drop ' + list.length, function () { S.arm = ''; H.dropMany(list); }), sw('Cancel', function () { S.arm = ''; H.render(); }, 'quiet'))
      : h('p', { class: 'bulk' }, sw('Drop all ' + list.length + '…', function () { S.arm = bulk; H.render(); }, 'quiet')));
    box.appendChild(h('ul', { class: 'rows' }, list.slice(0, S.shown).map(stepRow)));
    if (list.length > S.shown) box.appendChild(h('button', { class: 'more', type: 'button', onclick: function () { S.shown += 40; H.render(); } }, 'Show more (' + (list.length - S.shown) + ' left)'));
  }
  function proposalRow(q) {
    var d = q.doc, dec = q.kind === 'decision', open = S.open === q.key, tri = d.triage && d.triage.answer ? d.triage : null, owner = H.ownerOf(tri && tri.decisionOwner || q.who);
    return h('li', { class: 'row step' + (open ? ' open' : '') },
      h('button', { class: 'row-h', type: 'button', 'aria-expanded': String(open), onclick: function () { S.open = open ? '' : q.key; H.render(); } },
        h('span', { class: 'age-tag' }, dec ? 'Decision' : 'Promise'),
        h('span', { class: 'row-main' }, h('span', { class: 'row-t' }, q.text || 'Untitled'),
          tri ? h('span', { class: 'row-ans' }, H.whoText(tri.by) + (tri.date ? ' (' + H.fmtDate(tri.date) + ')' : '') + ': ' + tri.answer) : h('span', { class: 'row-sub' }, (q.src.title || d.seededFrom || 'source not recorded') + (q.date ? ' · ' + H.fmtDate(q.date) : ''))),
        h('span', { class: 'own o-' + owner }, OWNER[owner])),
      open ? h('div', { class: 'row-x' }, h('span', { class: 'kv' }, dec ? (d.why ? H.clip(d.why, 200) : 'No reason recorded') : ((d.to ? 'To ' + H.idToName(d.to) + ' · ' : '') + (d.due ? 'due ' + H.fmtDate(d.due) : 'no date'))),
        H.extLink(q.src.url, 'source'), h('span', { class: 'switches' }, sw('Confirm', function () { H.proposalAct(q, true); }), sw('Reject', function () { H.proposalAct(q, false); }, 'quiet'))) : null);
  }
  function promiseRow(c) {
    var late = c.due ? Math.max(0, H.daysSince(c.due) || 0) : 0, open = S.open === 'p' + c.id, o = H.ownerOf(c.who);
    return h('li', { class: 'row step' + (open ? ' open' : '') },
      h('button', { class: 'row-h', type: 'button', 'aria-expanded': String(open), onclick: function () { S.open = open ? '' : 'p' + c.id; H.render(); } },
        h('span', { class: 'age-tag num' + (late > 30 ? ' bad' : late ? ' warn' : '') }, !c.due ? 'no date' : late ? late + 'd' : H.fmtDate(c.due)),
        h('span', { class: 'row-main' }, h('span', { class: 'row-t' }, c.what), h('span', { class: 'row-sub' }, (c.to ? 'to ' + H.idToName(c.to) + ' · ' : '') + 'promised ' + H.fmtDate(c.date)),
          c.triage && c.triage.answer ? h('span', { class: 'row-ans' }, H.whoText(c.triage.by) + ': ' + c.triage.answer) : null),
        h('span', { class: 'own o-' + o }, o === 'unassigned' && c.who && c.who !== 'unassigned' ? H.whoText(c.who) : OWNER[o])),
      open ? h('div', { class: 'row-x' }, c.source && c.source.title ? h('span', { class: 'kv' }, c.source.title) : null, h('span', { class: 'switches' }, sw('Done', function () { H.promiseDone(c); }))) : null);
  }
  function todo(box) {
    var b = H.backlog(), props = H.proposals(), parked = H.parked();
    if (b.steps.length) box.appendChild(H.chartDue(b.steps));
    var tabs = [['steps', 'Due now', b.steps.length], ['proposals', 'Waiting for yes / no', props.length], ['parked', 'With Alex / parked', parked.length], ['promises', 'Open promises', b.promises.length], ['stale', 'Over 30 days late', b.stale.length], ['orphans', 'No owner or no goal', b.orphans.length]];
    box.appendChild(h('div', { class: 'tabs2', role: 'group', 'aria-label': 'Which list' }, tabs.map(function (t) {
      return h('button', { type: 'button', 'aria-pressed': String(S.tab === t[0]), onclick: function () { S.tab = t[0]; S.open = ''; S.shown = 20; S.arm = ''; H.render(); } }, t[1], ' ', h('b', { class: 'num' }, t[2]));
    })));
    if (S.tab === 'parked') { box.appendChild(h('p', { class: 'kv' }, 'Answered already; waiting for the person named, or for the bot to set the final status.')); box.appendChild(parked.length ? h('ul', { class: 'rows' }, parked.slice(0, S.shown + 40).map(proposalRow)) : h('p', { class: 'p-empty' }, 'Nothing parked')); }
    else if (S.tab === 'proposals') box.appendChild(props.length ? h('ul', { class: 'rows' }, props.slice(0, S.shown + 20).map(proposalRow)) : h('p', { class: 'p-empty' }, 'Nothing is waiting for a yes or no'));
    else if (S.tab === 'promises') { var ps = b.promises.slice().sort(function (x, y) { return (x.due || '9') < (y.due || '9') ? -1 : 1; }); box.appendChild(ps.length ? h('ul', { class: 'rows' }, ps.slice(0, S.shown + 20).map(promiseRow)) : h('p', { class: 'p-empty' }, 'No open promises')); }
    else if (S.tab === 'orphans') { box.appendChild(h('p', { class: 'kv' }, 'Steps with no named owner or tied to no goal. If nobody owns it and it serves no goal, it probably should not exist.')); stepList(box, b.orphans, 'Every due step has an owner and a goal', ''); }
    else if (S.tab === 'stale') stepList(box, b.stale, 'Nothing is more than 30 days overdue', 'stale');
    else stepList(box, b.steps, 'Nothing is due', '');
  }

  function chart(b, el) { if (el) b.appendChild(el); }
  var BUILD = { systems: function (b) { chart(b, H.chartRuns()); H.systemsDrill(b); }, goals: function (b) { chart(b, H.chartGoals(H.data.goals)); H.goalsDrill(b); }, customers: function (b) { H.pipeDrill('opp', b); }, raise: function (b) { H.pipeDrill('raise', b); }, todo: todo, state: function (b) { H.stateDrill(b); } };
  H.drillView = function (root, key) {
    var body = h('div', { class: 'd-body' }), last = H.lastAction();
    try { BUILD[key](body); } catch (e) { console.error(e); body.appendChild(h('p', { class: 'p-empty' }, 'This list could not be drawn')); }
    root.appendChild(h('div', { class: 'd-back', onclick: function () { H.go('wall'); } }));
    root.appendChild(h('aside', { class: 'drill', role: 'dialog', 'aria-label': TITLES[key] },
      h('header', { class: 'd-top' }, h('h2', null, TITLES[key]), h('span', { class: 'kv' }, 'read-only · switches on opened rows'), h('button', { class: 'sw-btn', type: 'button', id: 'drill-close', onclick: function () { H.go('wall'); } }, 'Close  Esc')),
      body,
      last ? h('footer', { class: 'd-foot' }, h('span', { class: 'kv' }, H.clip(last.label, 60)), h('button', { class: 'sw-btn', type: 'button', onclick: function () { H.undo(); } }, 'Undo')) : null));
  };
})();

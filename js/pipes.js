/* The two pipelines as instruments: Customers (opportunities/{id}) and Raise (raise/{id}). On the wall each is a stage
   funnel with counts, how many cards need a move and the oldest overdue step. The drill-in is the read-only list by
   stage. Cards are added and edited through the bots and jobs, never here. */
(function () {
  var H = window.H, h = H.h;
  var S = { all: {} };
  var BOARDS = {
    opp: { col: 'opportunities', title: 'Customers', stages: [['lead', 'Lead'], ['engaged', 'Engaged'], ['pilot-scoped', 'Pilot'], ['loi', 'LOI'], ['contract', 'Contract']], out: ['lost', 'Lost'], won: { loi: 1, contract: 1 }, wonWord: 'at LOI+' },
    raise: { col: 'raise', title: 'Raise', stages: [['target', 'Target'], ['intro', 'Intro'], ['first-meeting', 'Meeting'], ['diligence', 'Diligence'], ['soft-commit', 'Soft commit'], ['committed', 'Committed']], out: ['passed', 'Passed'], won: { 'soft-commit': 1, committed: 1 }, wonWord: 'soft commit+' }
  };
  function stageOf(b, rec) { return b.stages.concat([b.out]).some(function (s) { return s[0] === rec.stage; }) ? rec.stage : b.stages[0][0]; }
  function nameOf(key, rec) { return key === 'opp' ? (rec.name || H.idToName(rec.orgId) || 'Untitled') : H.raiseName(rec); }
  function lateDays(rec) { var x = H.liveNext(rec); return x && x.date ? Math.max(0, H.daysSince(x.date) || 0) : 0; }
  function evList(rec) { return Array.isArray(rec.evidence) ? rec.evidence : rec.evidence ? [rec.evidence] : []; }

  /* why a card needs a move now, or '' */
  function reason(key, b, rec) {
    var st = stageOf(b, rec); if (st === b.out[0] || st === b.stages[b.stages.length - 1][0]) return null;
    var nx = H.liveNext(rec), late = lateDays(rec), dl = rec.deadline ? H.daysTo(rec.deadline) : null, early = st === b.stages[0][0];
    if (late > 0) return { score: 100 + Math.min(late, 60), why: 'step ' + late + 'd overdue' };
    if (dl != null && dl >= 0 && dl <= 14) return { score: 90 - dl, why: 'deadline in ' + dl + 'd' };
    if (!nx && !early) return { score: 70, why: 'no next step' };
    /* a missing budget holder or an old objection is a note on the card, not a reason to move when a dated step exists */
    return null;
  }
  H.pipe = function (key) {
    var b = BOARDS[key], all = H.data[b.col] || [], open = all.filter(function (r) { return stageOf(b, r) !== b.out[0]; });
    var moves = open.map(function (r) { var m = reason(key, b, r); return m ? { rec: r, score: m.score, why: m.why } : null; }).filter(Boolean).sort(function (x, y) { return y.score - x.score; });
    var oldest = open.reduce(function (m, r) { return Math.max(m, lateDays(r)); }, 0);
    return { key: key, title: b.title, total: all.length, open: open.length, won: open.filter(function (r) { return b.won[stageOf(b, r)]; }).length, wonWord: b.wonWord, moves: moves, oldest: oldest,
      out: all.length - open.length, outName: b.out[1],
      stages: b.stages.map(function (st) { var list = open.filter(function (r) { return stageOf(b, r) === st[0]; }); return { key: st[0], name: st[1], n: list.length, late: list.filter(function (r) { return lateDays(r) > 0; }).length, won: !!b.won[st[0]], list: list }; }) };
  };
  /* the goal most cards on this board serve, if it has a numeric target */
  function boardGoal(key) {
    var c = {}; (H.data[BOARDS[key].col] || []).forEach(function (r) { if (r.goalId) c[r.goalId] = (c[r.goalId] || 0) + 1; });
    var id = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0], g = id && H.goalById(id);
    return g && g.target != null ? g : null;
  }
  /* a founder's note that is newer than the card's next step: shown, never trusted over the date silently */
  function note(rec) {
    var t = rec.triage; if (!t || !t.answer) return null;
    var nx = H.liveNext(rec), newer = nx && nx.date && t.date && t.date > nx.date;
    return h('span', { class: 'row-ans' + (newer ? ' newer' : '') }, (newer ? 'Newer than the next step · ' : '') + H.whoText(t.by) + (t.date ? ' (' + H.fmtDate(t.date) + ')' : '') + ': ' + t.answer);
  }
  H.pipeHead = function (key) { var p = H.pipe(key); return { lvl: p.total ? '' : 'none', n: p.open, unit: 'open', bad: p.oldest > 30 ? 1 : 0, warn: p.moves.length, sub: p.won + ' ' + p.wonWord }; };

  H.pipePanel = function (key, box) {
    var p = H.pipe(key);
    if (!p.total) { box.appendChild(h('p', { class: 'p-empty' }, 'No cards yet')); return; }
    var g = key === 'opp' ? boardGoal(key) : null;   /* the LOI goal is about customers, not investors */
    var max = Math.max.apply(null, p.stages.map(function (s) { return s.n; }).concat([1, g ? g.target : 0])), pk = key === 'opp' ? 'pipe-customers' : 'pipe-raise';
    box.appendChild(h('ul', { class: 'hbars funnel', title: 'Open the board', onclick: function () { H.go(key === 'opp' ? 'customers' : 'raise'); } }, p.stages.map(function (s) {
      /* late cards are the warn piece at the end of the bar; the won stages carry the goal's target as a dashed tick */
      return H.bar(s.name, s.n, max, s.won ? 'won' : '', s.n + ' at ' + s.name + (s.late ? ', ' + s.late + ' with an overdue step' : '') + (s.won && g ? ' · G' + g.no + ' target ' + g.target : ''),
        { k: pk + '-' + s.name, late: s.late, target: s.won && g ? g.target : null });
    })));
    /* cards filed in the last 7 days, from createdAt; only said when the cards carry that date */
    var dated = (H.data[BOARDS[key].col] || []).filter(function (r) { return H.parse(r.createdAt); }), fresh = dated.filter(function (r) { return H.daysSince(r.createdAt) < 7; }).length;
    box.appendChild(h('div', { class: 'stats' },
      g ? h('div', { class: 'stat' }, h('b', { class: 'num', 'data-k': pk + '-won', 'data-v': p.won }, p.won + ' of ' + g.target), h('span', null, p.wonWord + ' · G' + g.no + ' target')) : null,
      h('div', { class: 'stat' + (p.moves.length ? ' warn' : '') }, h('b', { class: 'num', 'data-k': pk + '-moves', 'data-v': p.moves.length }, p.moves.length), h('span', null, 'need a move' + (p.oldest ? ', oldest ' + p.oldest + 'd late' : '')),
        dated.length ? h('small', { class: 'stat-d num', 'data-k': pk + '-new-week', 'data-v': fresh }, fresh ? '+' + fresh + ' new this week' : 'none new this week') : null)));
  };

  function fact(label, value, cls) { return value ? h('span', { class: 'fact-i' + (cls ? ' ' + cls : '') }, h('i', null, label), ' ', value) : null; }
  function card(key, rec, why) {
    var nx = H.liveNext(rec), late = lateDays(rec);
    return h('li', { class: 'row deal' },
      h('div', { class: 'row-main' }, h('div', { class: 'deal-h' }, h('b', null, nameOf(key, rec)), H.goalChip(rec.goalId), why ? h('span', { class: 'chip warn' }, why) : null),
        h('div', { class: 'row-sub' }, nx ? [h('i', { class: 'lab' }, 'Next'), ' ' + H.clip(nx.action, 110), nx.date ? h('span', { class: late ? 'late' : 'kv' }, ' · ' + H.fmtDate(nx.date) + (late ? ', ' + late + 'd late' : '')) : null, nx.who ? h('span', { class: 'kv' }, ' · ' + H.whoText(nx.who)) : null] : h('span', { class: 'kv' }, 'No next step')),
        h('div', { class: 'row-facts' }, key === 'opp'
          ? [fact('Champion', H.who(rec.champion)), rec.budgetHolder ? fact('Budget', H.who(rec.budgetHolder)) : fact('Budget', 'nobody named', 'warn-t'), fact('Deadline', rec.deadline ? H.fmtDate(rec.deadline) : ''), fact('Route', rec.vehicle), fact('Incumbent', rec.incumbent)]
          : [fact('Asked', rec.asked), fact('Objection', rec.objection, 'warn-t'), fact('Cheque', rec.cheque), fact('Lead', rec.owner ? H.whoText(rec.owner) : '')]),
        note(rec), rec.notes ? h('div', { class: 'kv' }, H.clip(rec.notes, 160)) : null, H.sources(evList(rec))));
  }
  function mini(key, rec) {
    var nx = H.liveNext(rec), late = lateDays(rec), open = S.open === rec.id, o = H.ownerOf(nx && nx.who || rec.owner || '');
    return h('li', null, h('button', { type: 'button', class: 'bcard' + (late > 30 ? ' bad' : late ? ' warn' : '') + (open ? ' open' : ''), 'aria-expanded': String(open),
      onclick: function () { S.open = open ? '' : rec.id; H.render(); } },
      h('b', null, H.clip(nameOf(key, rec).split(':')[0], 48)),
      h('span', { class: 'bc-next' + (nx ? '' : ' none') }, nx ? H.clip(nx.action, 80) : 'No next step'),
      key === 'raise' && rec.objection ? h('span', { class: 'bc-obj' }, 'Objection: ' + H.clip(rec.objection, 70)) : null,
      rec.triage && rec.triage.answer && nx && nx.date && rec.triage.date > nx.date ? h('span', { class: 'bc-obj' }, 'Newer note than this step') : null,
      h('span', { class: 'bc-meta' }, late ? h('span', { class: 'age-tag num ' + (late > 30 ? 'bad' : 'warn') }, late + 'd late') : nx && nx.date ? h('span', { class: 'kv' }, H.fmtDate(nx.date)) : null,
        H.goalChip(rec.goalId), o !== 'unassigned' ? h('span', { class: 'own o-' + o }, H.whoText(o)) : null)),
      open ? h('ul', { class: 'rows bc-x' }, card(key, rec, '')) : null);
  }
  H.pipeDrill = function (key, box) {
    var p = H.pipe(key), b = BOARDS[key];
    if (!p.total) { box.appendChild(h('p', { class: 'p-empty' }, 'No cards yet. They are filed by the bots and the daily jobs.')); return; }
    box.appendChild(h('p', { class: 'p-say' }, p.open + ' open · ' + p.won + ' ' + p.wonWord + ' · ' + p.moves.length + ' need a move · oldest overdue ' + (p.oldest ? p.oldest + 'd' : 'none')));
    box.appendChild(h('div', { class: 'board', style: 'grid-template-columns: repeat(' + p.stages.length + ', minmax(150px, 1fr))' }, p.stages.map(function (st) {
      var list = st.list.slice().sort(function (x, y) { return lateDays(y) - lateDays(x); });
      return h('div', { class: 'bcol' + (st.won ? ' won' : '') }, h('h4', null, st.name, h('span', { class: 'num' }, st.n)), list.length ? h('ul', null, list.map(function (r) { return mini(key, r); })) : h('p', { class: 'kv' }, 'None'));
    })));
    var out = (H.data[b.col] || []).filter(function (r) { return stageOf(b, r) === b.out[0]; });
    if (out.length) box.appendChild(h('section', { class: 'd-block' }, h('h3', { class: 'eyebrow' }, b.out[1], h('span', { class: 'num' }, out.length)), h('p', { class: 'kv' }, out.map(function (r) { return nameOf(key, r); }).join(' · '))));
  };
})();

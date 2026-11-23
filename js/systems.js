/* Systems: is the machinery that feeds the brain running? One light per feed (status/{founder}_{source}), a master light
   and one plain sentence. A feed that has never reported is shown as "never run", not as healthy.
   States: ok (ran inside its window), stale (ran, but too long ago), failed (last try did not succeed), never, skipped. */
(function () {
  var H = window.H, h = H.h;
  /* Only routines that actually run get a light (status/grok_<routine>). The morning and evening briefs are off and
     meeting prep is judgement, not a feed, so neither has one. Any other status doc (claude_import, …) is history. */
  var GROK = [['email', 'Eugenio’s email'], ['weekly', 'Saturday upkeep']];
  /* each founder's Grok writes its own email feed; Alex's is status/alex_grok_email (GROK.md section 3) */
  var ROWS = [['grok', 'Grok', GROK], ['alex_grok', 'Alex’s Grok', [['email', 'Alex’s email']]]];
  var WEEKLY = { weekly: 1, research: 1, discovery: 1, review: 1, shared_folder: 1 };   /* weekly feeds are allowed 8 days, the rest 26 hours */
  var WORD = { ok: 'ok', stale: 'stale', failed: 'failed', never: 'never run', skipped: 'skipped' };
  var NAME = { daily: 'daily brief', weekly: 'Saturday upkeep', email: 'email', grok_email: 'Grok email', calendar: 'calendar', gmail: 'email', granola: 'meeting notes', drive: 'Drive', brief: 'brief', prep: 'meeting prep', folder: 'bot folder', notify: 'notification', research: 'research', discovery: 'discovery', index: 'index', review: 'weekly review', inbox: 'bot inbox' };

  function stateOf(d, id) {
    if (!d) return 'never';
    var ok = Date.parse(d.lastSuccess), tried = Date.parse(d.lastAttempt), src = id.slice(id.indexOf('_') + 1);
    if (/^skipped:/i.test(d.lastError || '')) return 'skipped';
    if (!isNaN(tried) && (isNaN(ok) || tried > ok)) return 'failed';
    if (isNaN(ok)) return 'never';
    return Date.now() - ok <= (WEEKLY[src] || WEEKLY[id] ? 8 * 24 : 26) * 3600000 ? 'ok' : 'stale';
  }
  /* every expected feed, whether or not it has ever reported, plus any unexpected status doc */
  H.systems = function () {
    var by = {}, out = [], seen = {}; (H.data.status || []).forEach(function (d) { by[d.id] = d; });
    ROWS.forEach(function (r) { r[2].forEach(function (f) {
      var id = r[0] + '_' + f[0], d = by[id]; seen[id] = 1;
      out.push({ id: id, who: r[0], whoName: r[1], src: f[0], label: f[1], doc: d || null, state: stateOf(d, id) });
    }); });
    Object.keys(by).forEach(function (id) { if (seen[id]) return; var i = id.indexOf('_'), w = id.slice(0, i), s = id.slice(i + 1);
      out.push({ id: id, who: /^(eugenio|alex|grok)$/.test(w) ? w : 'shared', whoName: H.cap(w), src: s, label: H.cap(s), doc: by[id], state: stateOf(by[id], id), extra: true }); });
    return out;
  };
  function phrase(f) { return (f.who === 'shared' ? 'Shared ' : / Grok$/.test(f.whoName) ? f.whoName + ' ' : f.whoName + '’s ') + (NAME[f.src] || f.src); }
  /* the master light: level ok | warn | bad | none, and one sentence */
  H.systemSummary = function () {
    var all = H.systems().filter(function (f) { return !f.extra; }), n = function (s) { return all.filter(function (f) { return f.state === s; }); };
    var failed = n('failed'), stale = n('stale'), never = n('never'), ran = all.length - never.length;
    function more(list) { return list.length > 1 ? ' (+' + (list.length - 1) + ' more)' : ''; }
    if (!ran) return { level: 'none', text: 'No automatic run has happened yet', counts: { failed: 0, stale: 0, never: never.length, ok: 0 } };
    var counts = { failed: failed.length, stale: stale.length, never: never.length, ok: n('ok').length };
    if (failed.length) return { level: 'bad', text: phrase(failed[0]) + ' failed ' + H.age(failed[0].doc.lastAttempt) + ' ago' + more(failed), counts: counts };
    if (stale.length) { var worst = stale.slice().sort(function (a, b) { return a.doc.lastSuccess < b.doc.lastSuccess ? -1 : 1; })[0];
      return { level: 'warn', text: phrase(worst) + ' has not run for ' + H.age(worst.doc.lastSuccess) + more(stale), counts: counts }; }
    /* a routine that has not had its first run yet is not a fault */
    if (never.length) return { level: 'ok', text: 'Running · ' + never.map(phrase).join(', ') + ' not run yet', counts: counts };
    return { level: 'ok', text: 'All systems normal', counts: counts };
  };

  function tip(f) {
    var d = f.doc; if (!d) return phrase(f) + ': never run';
    return phrase(f) + ': ' + WORD[f.state] + (d.lastSuccess ? ', last success ' + H.agoTime(d.lastSuccess) : ', no success yet') +
      (d.read != null ? ', read ' + d.read + ', changed ' + (d.changed || 0) : '') + (d.tokens ? ', ' + d.tokens + ' tokens' : '') + (d.lastError ? '. ' + H.clip(d.lastError, 160) : '');
  }
  /* runs per day for the last 14 days, per feed: from the activity log (by agent) and the status records (by id).
     by[key][day] = runs that day; by[key]['x' + day] = the last try that day failed; by[key]['s' + day] = it was skipped */
  H.runDays = function () {
    var days = H.lastDays(14), by = {};
    (H.data.activity || []).forEach(function (a) { var k = a.agent || 'other', d = String(a.date || a.createdAt || '').slice(0, 10); (by[k] = by[k] || {})[d] = (by[k][d] || 0) + 1; });
    (H.data.status || []).forEach(function (s) {
      var k = s.id, d = String(s.lastSuccess || '').slice(0, 10), f = String(s.lastAttempt || '').slice(0, 10); by[k] = by[k] || {};
      if (d) by[k][d] = by[k][d] || 1;
      if (f && /^skipped:/i.test(s.lastError || '')) by[k]['s' + f] = 1; else if (f && s.lastError) by[k]['x' + f] = 1;
    });
    return { days: days, by: by };
  };
  H.dayResult = function (m, d) { return !m ? 'none' : m['x' + d] ? 'bad' : m[d] ? 'ok' : m['s' + d] ? 'skip' : 'none'; };
  var DAYWORD = { ok: 'ran', bad: 'failed', skip: 'skipped', none: 'no run recorded' };
  /* a 14-day strip: one thin bar per day, coloured by what happened that day */
  function strip(f, runs) {
    var m = runs.by[f.id];
    return h('span', { class: 'strip', 'aria-label': f.label + ', last 14 days' }, runs.days.map(function (d) {
      var r = H.dayResult(m, d);
      return h('i', { class: 'd-' + r, 'data-tip': H.tipData(H.fmtDate(d), [[f.label, DAYWORD[r]]]) });
    }));
  }
  function lamp(f, runs) {
    var t = tip(f);   /* on the light and words only, so the day bars keep their own tooltip */
    return h('li', { class: 'lamp s-' + f.state }, h('i', { class: 'lt', 'aria-hidden': 'true', title: t }), h('span', { class: 'lamp-l', title: t }, f.label),
      h('span', { class: 'lamp-a num', title: t }, f.state === 'never' ? 'not yet' : f.state === 'skipped' ? 'skip' : f.state === 'failed' ? 'fail' : H.age(f.doc.lastSuccess)), h('span', { class: 'sr' }, WORD[f.state]),
      runs ? strip(f, runs) : null);
  }
  H.systemsPanel = function (box) {
    /* a slim bar: one sentence and a light per routine; the history and the key are in the drill-in */
    var all = H.systems().filter(function (f) { return !f.extra; }), sum = H.systemSummary(), pend = H.inboxPending().length;
    /* the sentence is already in the header pill; the bar only adds a light per routine */
    var runs = H.runDays();
    box.appendChild(H.tipBind(h('ul', { class: 'lamps' }, all.map(function (f) { return lamp(f, runs); }))));
    if (pend) box.appendChild(h('b', { class: 'warn-t' }, pend + ' inbox ' + (pend === 1 ? 'note needs' : 'notes need') + ' an answer'));
  };
  /* what ran last: job runs and failures from status/*, plus the jobs' own log lines (activity/*) */
  H.runLog = function () {
    var out = [];
    function ms(v) { var t = Date.parse(v || ''); return isNaN(t) ? 0 : t; }
    (H.data.status || []).forEach(function (d) {
      var i = d.id.indexOf('_'), name = H.cap(d.id.slice(0, i)) + ' ' + (NAME[d.id.slice(i + 1)] || d.id.slice(i + 1));
      if (/^skipped:/i.test(d.lastError || '')) return;
      if (ms(d.lastAttempt) > ms(d.lastSuccess)) out.push({ t: ms(d.lastAttempt), bad: true, text: name + ' failed' + (d.lastError ? ': ' + H.clip(d.lastError, 90) : '') });
      if (ms(d.lastSuccess)) out.push({ t: ms(d.lastSuccess), text: name + ' ran' + (d.read != null ? ' · read ' + d.read + ', changed ' + (d.changed || 0) : '') });
    });
    (H.data.activity || []).forEach(function (a) { var t = ms(a.date || a.createdAt); if (t && a.summary) out.push({ t: t, text: (a.agent ? H.cap(a.agent) + ': ' : '') + H.clip(a.summary, 120) }); });
    return out.sort(function (a, b) { return b.t - a.t; });
  };
  function runRow(e) { return h('li', { class: 'ev' + (e.bad ? ' bad' : ''), title: new Date(e.t).toLocaleString() }, h('span', { class: 'ev-a num' }, H.age(e.t)), h('span', { class: 'ev-t' }, e.text)); }
  H.inboxPending = function () { var d = (H.data.status || []).filter(function (x) { return x.id === 'shared_inbox'; })[0]; return d && Array.isArray(d.pending) ? d.pending.filter(function (x) { return typeof x === 'string'; }) : []; };
  H.systemsHead = function () { var sum = H.systemSummary(), c = sum.counts; return { lvl: sum.level, n: c.ok, unit: 'running', bad: c.failed, warn: c.stale, sub: c.failed ? c.failed + ' failed' : c.stale ? c.stale + ' stale' : '' }; };

  /* drill-in: one row per feed with everything it last reported */
  H.systemsDrill = function (box) {
    var all = H.systems(), sum = H.systemSummary(), order = { failed: 0, stale: 1, never: 2, skipped: 3, ok: 4 }, tokens = 0;
    all.forEach(function (f) { if (f.doc && typeof f.doc.tokens === 'number') tokens += f.doc.tokens; });
    box.appendChild(h('p', { class: 'p-say lvl-' + sum.level }, sum.text + '. ' + sum.counts.ok + ' ok, ' + sum.counts.stale + ' stale, ' + sum.counts.failed + ' failed, ' + sum.counts.never + ' never run. ' + tokens.toLocaleString() + ' tokens on the last runs.'));
    var pend = H.inboxPending();
    if (pend.length) box.appendChild(h('div', { class: 'd-block' }, h('h3', { class: 'eyebrow' }, 'Bot inbox: waiting for an answer', h('span', { class: 'num' }, pend.length)), h('ul', { class: 'rows' }, pend.slice(0, 12).map(function (t) { return h('li', { class: 'row' }, H.clip(t, 220)); }))));
    var body = h('tbody'), hist = all.filter(function (f) { return f.extra; }); all = all.filter(function (f) { return !f.extra; });
    all.slice().sort(function (a, b) { return order[a.state] - order[b.state] || (a.id < b.id ? -1 : 1); }).forEach(function (f) {
      var d = f.doc || {};
      body.appendChild(h('tr', null, h('td', null, h('span', { class: 'lamp s-' + f.state }, h('i', { class: 'lt' }), WORD[f.state])), h('td', null, h('b', null, f.whoName), ' ' + f.label),
        h('td', { class: 'num' }, d.lastSuccess ? H.agoTime(d.lastSuccess) : 'never'), h('td', { class: 'num' }, d.lastAttempt ? H.agoTime(d.lastAttempt) : 'never'),
        h('td', { class: 'r' }, d.read != null ? d.read : ''), h('td', { class: 'r' }, d.changed != null ? d.changed : ''), h('td', { class: 'r' }, d.tokens != null ? Number(d.tokens).toLocaleString() : ''),
        h('td', { class: 'small' }, d.lastError ? H.clip(d.lastError, 200) : '')));
    });
    var runs = H.runLog();
    if (runs.length) box.appendChild(h('section', { class: 'd-block' }, h('h3', { class: 'eyebrow' }, 'Last runs'), h('ul', { class: 'evs full' }, runs.slice(0, 30).map(runRow))));
    box.appendChild(h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['State', 'Feed', 'Last success', 'Last try', 'Read', 'Changed', 'Tokens', 'Last error'].map(function (t, i) { return h('th', { class: i > 3 && i < 7 ? 'r' : null }, t); }))), body)));
    if (hist.length) box.appendChild(h('section', { class: 'd-block' }, h('h3', { class: 'eyebrow' }, 'One-off runs and history'), h('ul', { class: 'rows' }, hist.map(function (f) {
      var d = f.doc || {}; return h('li', { class: 'row small' }, h('b', null, f.whoName + ' ' + f.label), ' · ' + (d.lastSuccess ? 'last success ' + H.agoTime(d.lastSuccess) : 'no success') + (d.lastError ? ' · ' + H.clip(d.lastError, 120) : ''));
    }))));
  };
})();

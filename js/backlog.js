/* The backlog as the wall reads it: every step that is due across the whole company (map, both pipelines, promises),
   worked out by plain rules with no model call, plus the few switches a founder can flip from a drill-in.
   A switch only ever updates an existing record: a step becomes "done" or "dropped" (it keeps its text, gains who and
   when, and the rules stop counting it). Every switch hands back an Undo. */
(function () {
  var H = window.H;
  var memo = null, last = null;   /* last = {label, run} for Undo */
  function stamp() { return new Date().toISOString(); }
  function who() { return H.me || 'hub'; }
  function copy(x) { return x ? JSON.parse(JSON.stringify(x)) : x; }
  function seq(list, fn) { return list.reduce(function (p, x) { return p.then(function () { return fn(x); }); }, Promise.resolve()); }
  /* the database merges nested fields, so putting a step back has to say "open" out loud */
  function reopened(next) { return Object.assign({}, next, { status: 'open' }); }

  var MEETING = { call: 1, meeting: 1, event: 1 };
  /* Every due step in the company, from three places: next steps on people and organisations, next steps on pipeline
     cards, and promises. Steps that serve a goal come first, then the longest overdue. */
  function collect() {
    var D = H.data, today = H.todayISO(), out = [], events = {}, links = H.goalLinks();
    D.nodes.forEach(function (n, id) {
      var x = n.next; if (!x || !x.action || !x.date || x.date > today || n._.ref || H.isUs(id)) return;
      var meet = !!MEETING[x.kind], name = H.shortName(n.name);
      if (meet && x.date === today) {                       /* one calendar event often sits on several people: one step */
        var k = x.eventId || x.action;
        if (events[k]) { events[k].ref.ids.push(id); if (n.type === 'person') events[k].name += ', ' + name; return; }
        out.push(events[k] = { id: 'meet:' + id, kind: 'Meeting today', ref: { t: 'node', id: id, ids: [id] }, due: today, who: x.who || '', task: x.action, name: name, nodes: [id], goalId: links[id] || '' });
        return;
      }
      if (meet && n._.last >= x.date) return;               /* the meeting happened and something was logged after it */
      var dk = 'n|' + x.date + '|' + x.action;               /* the same step is often written on a person and on their organisation: one step */
      if (events[dk]) { events[dk].ref.ids.push(id); events[dk].nodes.push(id); if (!events[dk].goalId) events[dk].goalId = links[id] || ''; return; }
      out.push(events[dk] = { id: 'due:' + id, kind: meet ? 'No outcome logged' : 'Next step', ref: { t: 'node', id: id, ids: [id] }, due: x.date, who: x.who || n._.owner || '', task: x.action, name: name, nodes: [id], goalId: links[id] || '' });
    });
    function pipe(t, col, nameOf) {
      (D[col] || []).forEach(function (rec) {
        var x = H.liveNext(rec); if (!x || !x.date || x.date > today || /^(lost|passed|contract|committed)$/.test(rec.stage || '')) return;
        out.push({ id: t + ':' + rec.id, kind: t === 'opp' ? 'Customer' : 'Raise', ref: { t: t, id: rec.id }, due: x.date, who: x.who || rec.owner || '', task: x.action, name: nameOf(rec), nodes: [rec.orgId, rec.champion, rec.investorId].filter(function (i) { return i && D.nodes.has(i); }), goalId: rec.goalId || '' });
      });
    }
    pipe('opp', 'opportunities', function (o) { return o.name || H.idToName(o.orgId) || 'Opportunity'; });
    pipe('raise', 'raise', H.raiseName);
    D.commitments.forEach(function (c) {
      if (c.status !== 'open' || !c.due || c.due > today) return;
      out.push({ id: 'promise:' + c.id, kind: 'Promise', ref: { t: 'promise', id: c.id }, due: c.due, who: c.who || '', task: c.what, name: c.to ? H.idToName(c.to) : '', nodes: c.to && D.nodes.has(c.to) ? [c.to] : [], goalId: (c.to && links[c.to]) || '' });
    });
    out.forEach(function (c) { c.owner = H.ownerOf(c.who); c.late = Math.max(0, H.daysSince(c.due) || 0); c.orphan = c.owner === 'unassigned' || !c.goalId; });
    return out.sort(function (a, b) { return (a.goalId ? 0 : 1) - (b.goalId ? 0 : 1) || (a.late === 0 ? 0 : 1) - (b.late === 0 ? 0 : 1) || b.late - a.late || (a.id < b.id ? -1 : 1); });
  }
  function build() {
    var steps = collect(), today = H.todayISO();
    var buckets = [['today', 'Today', 0, 0], ['week', '1-7 d', 1, 7], ['month', '8-30 d', 8, 30], ['old', '30 d +', 31, 1e9]].map(function (b) {
      return { key: b[0], label: b[1], n: steps.filter(function (c) { return c.late >= b[2] && c.late <= b[3]; }).length };
    });
    var owners = ['eugenio', 'alex', 'both', 'unassigned'].map(function (o) { return { key: o, n: steps.filter(function (c) { return c.owner === o; }).length }; });
    var promises = H.data.commitments.filter(function (c) { return c.status === 'open'; });
    return { steps: steps, buckets: buckets, owners: owners, stale: steps.filter(function (c) { return c.late > 30; }), orphans: steps.filter(function (c) { return c.orphan; }),
      promises: promises, promisesLate: promises.filter(function (c) { return c.due && c.due < today; }).length };
  }
  H.backlog = function () {
    if (memo && memo.t === H.tick) return memo.v;
    var v = build(); memo = { t: H.tick, v: v }; return v;
  };

  /* what = 'done' | 'drop'. Resolves with a function that puts things back. */
  function act(c, what) {
    var r = c.ref, done = what === 'done';
    if (!r || !/^(node|opp|raise|promise)$/.test(r.t) || !r.id) return Promise.reject(new Error('nothing to change'));
    function closed(prev) { var x = Object.assign({}, prev, { status: done ? 'done' : 'dropped' }); x[done ? 'doneAt' : 'droppedAt'] = stamp(); x[done ? 'doneBy' : 'droppedBy'] = who(); return x; }
    if (r.t === 'promise') {
      var doc = H.byId('commitments', r.id) || {}, prev = { status: doc.status || 'open' };
      var body = done ? { status: 'done', doneAt: stamp(), doneBy: who() } : { status: 'dropped', droppedAt: stamp(), droppedBy: who() };
      return H.put('commitments', r.id, body).then(function () { return function () { return H.put('commitments', r.id, prev); }; });
    }
    if (r.t === 'node') {
      var ids = (r.ids || [r.id]).filter(function (id) { var n = H.data.nodes.get(id); return n && n.next; });
      var before = ids.map(function (id) { return { id: id, next: copy(H.data.nodes.get(id).next) }; });
      if (!before.length) return Promise.reject(new Error('step already closed'));
      return seq(before, function (b) { return H.setNext('node', b.id, closed(b.next)); }).then(function () {
        return function () { return seq(before, function (b) { return H.setNext('node', b.id, reopened(b.next)); }); };
      });
    }
    var rec = H.byId(r.t === 'opp' ? 'opportunities' : 'raise', r.id), was = rec && copy(rec.next);
    if (!was) return Promise.reject(new Error('step already closed'));
    return H.setNext(r.t, r.id, closed(was)).then(function () { return function () { return H.setNext(r.t, r.id, reopened(was)); }; });
  }
  H.canWrite = function () { if (!H.me) H.toast('Choose who you are (top right) first.'); return !!H.me; };
  function fail(e) { console.error(e); H.toast(H.db ? 'Not saved. You may only have view access.' : 'Not saved: the database is not connected.'); H.render(); return false; }
  function ok(label, undo, msg) { last = { label: label, run: undo, at: Date.now() }; H.toast(msg); H.render(); return true; }

  var busy = false;
  function guard(p) { if (busy) return Promise.resolve(false); busy = true; return p().then(function (v) { busy = false; return v; }, function (e) { busy = false; return fail(e); }); }
  H.stepAct = function (c, what) {
    if (!H.canWrite()) return Promise.resolve(false);
    return guard(function () { return act(c, what).then(function (undo) { return ok((what === 'done' ? 'Done: ' : 'Dropped: ') + H.clip(c.task || c.title, 40), undo, what === 'done' ? 'Marked done' : 'Dropped'); }); });
  };
  H.proposalAct = function (q, yes) {
    if (!H.canWrite()) return Promise.resolve(false);
    return guard(function () { return H.proposalVerdict(q, yes).then(function (undo) { return ok((yes ? 'Confirmed: ' : 'Rejected: ') + H.clip(q.text, 40), undo, yes ? 'Confirmed' : 'Rejected'); }); });
  };
  H.promiseDone = function (c) {
    if (!H.canWrite()) return Promise.resolve(false);
    return guard(function () { return act({ ref: { t: 'promise', id: c.id } }, 'done').then(function (undo) { return ok('Done: ' + H.clip(c.what, 40), undo, 'Marked done'); }); });
  };
  /* a goal's number and status, with a line in its log saying who changed what */
  H.goalSet = function (g, current, status) {
    if (!H.canWrite()) return Promise.resolve(false);
    var raw = g.raw, prev = { current: raw.current == null ? null : raw.current, status: raw.status || 'unknown', log: Array.isArray(raw.log) ? raw.log.slice() : [] };
    /* only the fields that changed are written, so the other founder's change to the other field is not overwritten */
    var body = {}, undo = { log: prev.log };
    if (current !== prev.current) { body.current = current; undo.current = prev.current; }
    if (status !== prev.status) { body.status = status; undo.status = prev.status; }
    body.log = prev.log.concat([{ date: stamp(), by: who(), from: { current: prev.current, status: prev.status }, to: { current: current, status: status }, source: 'wall' }]);
    return guard(function () { return H.put('goals', g.id, body).then(function () { return ok('Goal ' + g.no + ' set', function () { return H.put('goals', g.id, undo); }, 'Goal ' + g.no + ' updated'); }); });
  };
  /* drop a whole list (the stale pile), one write at a time; a single Undo puts back whatever was dropped */
  H.dropMany = function (list) {
    if (!H.canWrite()) return Promise.resolve(false);
    var undos = [];
    function all() { return seq(undos.slice().reverse(), function (u) { return u(); }); }
    return guard(function () {
      return seq(list, function (c) { return act(c, 'drop').then(function (u) { undos.push(u); }); })
        .then(function () { return ok('Dropped ' + undos.length + ' steps', all, 'Dropped ' + undos.length); },
          function (e) { if (undos.length) last = { label: 'Dropped ' + undos.length + ' steps', run: all, at: Date.now() }; throw e; });
    });
  };
  H.lastAction = function () { return last; };
  H.undo = function () {
    var l = last; if (!l || busy) return Promise.resolve();
    last = null;
    return guard(function () { return Promise.resolve().then(l.run).then(function () { H.toast('Put back'); H.render(); return true; }); });
  };
})();

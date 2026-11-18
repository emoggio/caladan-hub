/* Proposals: decisions and promises a job picked up from meeting notes or the bot inbox (status "proposed"). They become
   real only when a founder says yes. This file is the data side: the queue and the verdict write (with its undo).
   The wall shows the count; the yes/no switches live in the Needs-doing drill-in. */
(function () {
  var H = window.H, h = H.h;

  H.proposals = function () {
    var D = H.data, out = [];
    D.decisions.forEach(function (d) { if (d.status === 'proposed') out.push({ kind: 'decision', col: 'decisions', id: d.id, key: 'decisions/' + d.id, doc: d, text: d.decision, src: d.source || {}, date: d.date || '', who: d.owner || '' }); });
    D.commitments.forEach(function (c) { if (c.status === 'proposed') out.push({ kind: 'commitment', col: 'commitments', id: c.id, key: 'commitments/' + c.id, doc: c, text: c.what, src: c.source || {}, date: c.date || '', who: c.who || '' }); });
    function mine(q) { return H.me && (q.who === H.me || q.who === 'both') ? 0 : 1; }
    /* yours first, then newest, keeping one meeting's items together */
    return out.sort(function (a, b) { return mine(a) - mine(b) || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.src.title || '').localeCompare(b.src.title || '') || (a.kind < b.kind ? 1 : -1); });
  };
  H.confirmCount = function () { return H.proposals().length; };

  /* yes: decision -> confirmed, promise -> open. no: rejected / dropped. Returns a promise; the caller records the undo. */
  H.proposalVerdict = function (q, yes, extra) {
    var prev = {}; ['status', 'decision', 'why', 'owner', 'what', 'who', 'due'].forEach(function (k) { if (q.doc[k] !== undefined) prev[k] = q.doc[k]; });
    var body = Object.assign({ status: q.kind === 'decision' ? (yes ? 'confirmed' : 'rejected') : (yes ? 'open' : 'dropped') }, extra || {});
    body[yes ? 'confirmedAt' : 'rejectedAt'] = new Date().toISOString(); body[yes ? 'confirmedBy' : 'rejectedBy'] = H.me || 'hub';
    return H.put(q.col, q.id, body).then(function () {
      return function undo() { return H.put(q.col, q.id, { status: prev.status || 'proposed', undoneBy: H.me || 'hub' }); };
    });
  };
})();

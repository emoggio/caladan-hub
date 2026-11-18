/* Loads the shared database once, keeps the small collections live, derives what the panels need, and holds the few writes the wall makes. */
(function () {
  var H = window.H, HUB = window.HUB;
  var D = H.data = {
    ready: false, nodes: new Map(), edges: [], signals: [],
    status: [], activity: [], settings: {},
    goals: [], pirs: [], needs: [], valuations: [], opportunities: [], raise: [], roadmap: [], decisions: [], commitments: [],
    people: [], truncated: []
  };
  var NODE_TYPES = ['person', 'org', 'military', 'programme'];
  var EDGE_KINDS = ['introduced', 'works_at', 'part_of', 'invested', 'customer', 'partner', 'knows', 'competes'];
  var DESK = { web: 1, research: 1 };   /* desk research is not contact with the person */
  var FOUNDER_IDS = {};
  Object.keys(HUB.founders).forEach(function (k) { FOUNDER_IDS[HUB.founders[k].id] = k; });
  H.isUs = function (id) { return !!FOUNDER_IDS[id] || id === HUB.company; };
  H.isRef = function (id) { return /^(r_|fd_|ndf_)/.test(id); };

  function docs(snap) {
    return snap.docs.map(function (d) { var o = Object.assign({}, d.data()); o.id = d.id; return o; });
  }
  /* Collections are read in slices that each stay under the 1000-document page size. */
  function sliced(db, name, field, values) {
    return Promise.all(values.map(function (v) {
      return db.collection(name).where(field, '==', v).limit(1000).get().then(function (s) {
        if (s.size >= 1000) D.truncated.push(name + ' (' + v + ')');
        return docs(s);
      });
    })).then(function (parts) { return [].concat.apply([], parts); });
  }
  function whole(db, name) {
    return db.collection(name).limit(1000).get().then(docs).catch(function () { return []; });
  }

  /* The company-brain collections are small. Dated ones are read newest first; any of them may be empty or absent. */
  var ONCE = ['pirs'];
  var LIVE = ['status', 'goals', 'needs', 'opportunities', 'raise', 'roadmap', 'decisions', 'commitments', 'activity', 'valuations'];
  var NEWEST = { activity: ['date', 20] };
  function query(db, name) {
    var q = db.collection(name), o = NEWEST[name];
    return o ? q.orderBy(o[0], 'desc').limit(o[1]) : q.limit(500);
  }

  H.loadAll = function (db) {
    D.truncated = [];
    var small = ONCE.concat(LIVE);
    return Promise.all([
      sliced(db, 'nodes', 'type', NODE_TYPES), sliced(db, 'edges', 'kind', EDGE_KINDS),
      whole(db, 'signals')
    ].concat(small.map(function (name) { return query(db, name).get().then(docs).catch(function () { return []; }); }))).then(function (r) {
      D.nodes = new Map();
      r[0].forEach(function (n) { D.nodes.set(n.id, n); });
      D.edges = r[1].filter(function (e) { return D.nodes.has(e.source) && D.nodes.has(e.target); });
      D.signals = r[2];
      small.forEach(function (name, i) { D[name] = r[3 + i]; });
      H.derive();
      D.ready = true; H.touched();
      /* where the bot folder lives; the wall works without it */
      db.doc('settings/main').get().then(function (d) { if (d.exists) { D.settings = d.data() || {}; H.render(); } }).catch(function () { /* stays empty */ });
    });
  };

  /* Small, changing collections stay live. cb runs after every change. */
  H.watch = function (db, cb) {
    LIVE.forEach(function (name) {
      var first = true;
      query(db, name).onSnapshot(function (s) {
        D[name] = docs(s);
        if (first) { first = false; return; }   /* loadAll already drew this state */
        H.touched(); cb(name);
      }, function () { /* stays as loaded */ });
    });
  };

  function who(t) {
    var w = String(t.who || '');
    return { eugenio: /eugenio/i.test(w), alex: /alex/i.test(w) };
  }
  H.touchWho = who;
  H.isContact = function (t) { var w = who(t); return (w.eugenio || w.alex) && !DESK[t.channel]; };

  function deriveNode(n) {
    var x = { lastE: '', lastA: '', nE: 0, nA: 0, contacted: false };
    (n.touchpoints || []).forEach(function (t) {
      if (!H.isContact(t)) return;
      var w = who(t), d = t.date || '';
      x.contacted = true;
      if (w.eugenio) { x.nE++; if (d > x.lastE) x.lastE = d; }
      if (w.alex) { x.nA++; if (d > x.lastA) x.lastA = d; }
    });
    x.last = x.lastE > x.lastA ? x.lastE : x.lastA;
    x.owner = n.owner || (x.nE + x.nA === 0 ? '' : x.nE > x.nA ? 'eugenio' : x.nA > x.nE ? 'alex' : 'both');
    n._ = x;
    return x;
  }

  H.derive = function () {
    var worksAt = {};
    D.edges.forEach(function (e) { if (e.kind === 'works_at' && !worksAt[e.source]) worksAt[e.source] = e.target; });
    D.staff = new Map();   /* org id -> [person ids] */
    D.nodes.forEach(function (n, id) {
      /* a next step someone closed (done or dropped in triage) stays on the record but no view treats it as pending */
      if (n.next && /^(dropped|done)$/.test(n.next.status || '')) { n.closedNext = n.next; n.next = null; }
      var x = deriveNode(n);
      x.ref = H.isRef(id);
      x.org = (n.org && D.nodes.has(n.org) ? n.org : worksAt[id]) || '';
      if (n.type === 'person' && x.org) {
        if (!D.staff.has(x.org)) D.staff.set(x.org, []);
        D.staff.get(x.org).push(id);
      }
    });
    D.people = [];
    D.nodes.forEach(function (n, id) {
      var x = n._, org = x.org && D.nodes.get(x.org);
      x.orgName = org ? org.name : '';
      x.sector = n.sector || (org && org.sector) || '';
      if (n.type === 'person' && !x.ref && !H.isUs(id) && !n.us) D.people.push(n);
    });
    H.graph = null;   /* rebuilt on demand by graph.js */
    H.rev = (H.rev || 0) + 1;   /* the map layout is rebuilt when this changes */
  };

  /* People at an organisation (or the organisation itself) one of us has been in contact with. */
  H.knownAt = function (orgId) {
    return (D.staff.get(orgId) || []).map(function (id) { return D.nodes.get(id); })
      .filter(function (p) { return p._.contacted; })
      .sort(function (a, b) { return a._.last < b._.last ? 1 : -1; });
  };

  /* ---- writes. The wall is glass: the only things it can change are a goal's number or status, whether a next step
     is done or dropped, and the verdict on a proposal. Each is an update to an existing document, never a create or delete. ---- */
  function db() { if (!H.db) throw new Error('offline'); return H.db; }
  function stamp() { return new Date().toISOString(); }
  function by() { return H.userId || H.me || 'hub'; }

  /* Update one document and patch the page's own copy so the wall does not wait for the database to echo it back. */
  H.put = function (collection, id, body) {
    if (!id) return Promise.reject(new Error('the wall never creates records'));
    var patch = Object.assign({ updatedAt: stamp(), updatedBy: by() }, body), list = D[collection] || [];
    return db().doc(collection + '/' + id).update(patch).then(function () {
      var cur = list.filter(function (x) { return x.id === id; })[0]; if (cur) Object.assign(cur, patch);
      H.touched(); return id;
    });
  };
  /* Replace the next step on a person/organisation (kind 'node') or a pipeline card. Never deletes it. The database
     merges nested fields, so callers always pass the whole step with an explicit status. */
  H.setNext = function (kind, id, next) {
    if (kind !== 'node') return H.put(kind === 'opp' ? 'opportunities' : 'raise', id, { next: next });
    var patch = { next: next, updatedAt: stamp(), updatedBy: by() };
    return db().doc('nodes/' + id).update(patch).then(function () { var n = D.nodes.get(id); if (n) { n.next = next; n.closedNext = null; } H.derive(); H.touched(); });
  };
  H.liveNext = function (rec) { var x = rec && rec.next; return x && x.action && !/^(dropped|done)$/.test(x.status || '') ? x : null; };
  H.byId = function (collection, id) { return (D[collection] || []).filter(function (x) { return x.id === id; })[0] || null; };
  H.touched = function () { H.lastChange = Date.now(); };
})();

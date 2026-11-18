/* Route finding: who can get us to a person or organisation.
   Every link has an "effort" (lower is warmer). A route's effort is the sum of its links.
   Recent conversations and introductions are the warmest links; "is part of" is the weakest. */
(function () {
  var H = window.H, HUB = window.HUB;
  var EFFORT = { introduced: 1.0, works_at: 0.6, knows: 1.6, partner: 1.6, customer: 1.8, invested: 1.8, part_of: 2.6 };
  var MAX_HOPS = 3;        /* links after our own contact */
  var HUB_DEGREE = 40;     /* umbrella nodes with more links than this are not used as stepping stones */

  function build() {
    var D = H.data, adj = new Map(), first = new Map();
    function link(a, b, cost, e) {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push({ to: b, cost: cost, e: e });
      adj.get(b).push({ to: a, cost: cost, e: e });
    }
    var seen = {};
    D.edges.forEach(function (e) {
      if (!(e.kind in EFFORT)) return;                       /* competitors are not a route */
      if (H.isUs(e.source) || H.isUs(e.target)) return;      /* our own links are handled as first steps */
      var cost = EFFORT[e.kind], age = H.daysSince(e.date);
      if (age != null && age <= 90) cost *= 0.85;
      seen[e.source + '|' + e.target] = seen[e.target + '|' + e.source] = 1;
      link(e.source, e.target, cost, e);
    });
    D.nodes.forEach(function (n, id) {                        /* the "organisation" field on a person */
      var o = n._.org;
      if (n.type === 'person' && o && !H.isUs(id) && !H.isUs(o) && !seen[id + '|' + o])
        link(id, o, EFFORT.works_at, { kind: 'works_at', source: id, target: o });
    });
    /* First steps: everyone a founder has actually been in contact with. */
    D.nodes.forEach(function (n, id) {
      if (H.isUs(id) || !n._.contacted) return;
      ['eugenio', 'alex'].forEach(function (f) {
        var last = f === 'eugenio' ? n._.lastE : n._.lastA, count = f === 'eugenio' ? n._.nE : n._.nA;
        if (!count) return;
        var age = H.daysSince(last);
        var cost = age == null ? 2.2 : age <= 14 ? 0.8 : age <= 45 ? 1.1 : age <= 120 ? 1.6 : 2.2;
        if (count >= 3) cost -= 0.2;
        if (/partner|advisor|ally/.test(n.status || '')) cost -= 0.2;
        var cur = first.get(id);
        var step = { founder: f, cost: cost, last: last, count: count };
        if (!cur) first.set(id, { best: step, all: [step] });
        else { cur.all.push(step); if (cost < cur.best.cost) cur.best = step; }
      });
    });
    return { adj: adj, first: first };
  }
  H.getGraph = function () { return H.graph || (H.graph = build()); };

  /* Cheapest effort from the target outwards (Dijkstra; the graph is small). */
  function spread(g, sources) {
    var dist = new Map(), prev = new Map(), hops = new Map(), open = [];
    sources.forEach(function (s) { dist.set(s, 0); hops.set(s, 0); open.push(s); });
    var done = new Set();
    while (open.length) {
      var bi = 0, i;
      for (i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
      var u = open.splice(bi, 1)[0];
      if (done.has(u)) continue;
      done.add(u);
      var links = g.adj.get(u) || [];
      if (hops.get(u) >= MAX_HOPS) continue;
      if (links.length > HUB_DEGREE && sources.indexOf(u) < 0) continue;
      for (i = 0; i < links.length; i++) {
        var l = links[i], nd = dist.get(u) + l.cost;
        if (!dist.has(l.to) || nd < dist.get(l.to)) {
          dist.set(l.to, nd); prev.set(l.to, { via: u, e: l.e }); hops.set(l.to, hops.get(u) + 1);
          open.push(l.to);
        }
      }
    }
    return { dist: dist, prev: prev };
  }

  H.warmth = function (effort) {
    if (effort <= 2.3) return { key: 'good', label: 'Warm', meaning: 'someone we spoke with recently is one step away' };
    if (effort <= 4) return { key: 'warn', label: 'Possible', meaning: 'the link exists but is older or goes through two steps' };
    return { key: 'bad', label: 'Long shot', meaning: 'several weak links in a row' };
  };

  /* Routes from the founders to a target. Returns up to `max`, warmest first. */
  H.routesTo = function (targetId, max) {
    var D = H.data, g = H.getGraph(), t = D.nodes.get(targetId);
    if (!t) return { direct: null, routes: [] };
    var sp = spread(g, [targetId]);
    var direct = g.first.get(targetId) || null;
    var routes = [];
    g.first.forEach(function (f, id) {
      if (id === targetId || !sp.dist.has(id)) return;
      if (D.nodes.get(id).type !== 'person') return;          /* you ask a person, not an organisation */
      var steps = [], at = id, guard = 0;
      while (at !== targetId && guard++ < 8) {
        var p = sp.prev.get(at); if (!p) return;
        steps.push({ from: at, to: p.via, e: p.e });
        at = p.via;
      }
      routes.push({ contact: id, first: f, steps: steps, effort: f.best.cost + sp.dist.get(id) });
    });
    routes.sort(function (a, b) { return a.effort - b.effort || a.steps.length - b.steps.length; });
    /* keep routes that differ in substance: one per second step */
    var out = [], used = {};
    routes.forEach(function (r) {
      var key = r.steps.length > 1 ? r.steps[0].to : r.contact;
      if (r.steps.length > 1 && (used[key] || 0) >= 2) return;
      used[key] = (used[key] || 0) + 1;
      if (out.length < (max || 6)) out.push(r);
    });
    return { direct: direct, routes: out };
  };

  /* One link in plain words. */
  H.stepText = function (s) {
    var D = H.data, e = s.e, a = D.nodes.get(e.source).name, b = D.nodes.get(e.target).name;
    switch (e.kind) {
      case 'introduced': return a + ' introduced ' + b;
      case 'works_at': return a + ' works at ' + b;
      case 'knows': return a + ' knows ' + b;
      case 'partner': return a + ' partners with ' + b;
      case 'customer': return a + ' and ' + b + ' have a customer relationship';
      case 'invested': return a + ' invested in ' + b;
      case 'part_of': return a + ' is part of ' + b;
      default: return a + ' is linked to ' + b;
    }
  };
  H.firstText = function (contactId, step) {
    var n = H.data.nodes.get(contactId), name = HUB.founders[step.founder].name;
    return name + (n.type === 'person' ? ' last spoke with ' : ' was last in touch with ') + n.name + (step.last ? ' ' + H.ago(step.last) : ' (date not recorded)') +
      (step.count > 1 ? ', ' + step.count + ' contacts in total' : '');
  };

  /* Organisations where we know someone, and the people there we have not reached yet. */
  H.footholds = function () {
    var D = H.data, out = [];
    D.staff.forEach(function (ids, orgId) {
      var org = D.nodes.get(orgId);
      if (!org || H.isUs(orgId)) return;
      var known = [], unknown = [];
      ids.forEach(function (id) { var p = D.nodes.get(id); (p._.contacted ? known : unknown).push(p); });
      if (known.length && unknown.length) out.push({ org: org, known: known, unknown: unknown });
    });
    function warm(f) { return f.known.reduce(function (m, p) { return p._.last > m ? p._.last : m; }, ''); }
    /* where our contact is freshest first: those introductions are easiest to ask for */
    return out.sort(function (a, b) { var x = warm(a), y = warm(b); return (y > x ? 1 : y < x ? -1 : 0) || b.unknown.length - a.unknown.length || (a.org.id < b.org.id ? -1 : 1); });
  };
})();

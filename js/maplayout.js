/* Map layout: where every bubble sits. Pure arithmetic, no simulation, so the picture is identical on every load.
   - Angle  = territory (what kind of organisation it is).
   - Radius = warmth: four rings, most recent contact nearest the centre.
   - Each organisation carries its people around it. */
(function () {
  var H = window.H, HUB = window.HUB;
  var GROUPS = [
    ['partners', 'Partners and customers', 'Partners'], ['investors', 'Investors', 'Investors'], ['forces', 'Armed forces and government', 'Forces, gov'],
    ['programmes', 'Programmes and funding', 'Funding'], ['competitors', 'Competitors', 'Competitors'], ['other', 'Industry and others', 'Industry']
  ];
  var RINGS = ['In touch in the last ' + HUB.coldAfterDays + ' days', 'Gone quiet, 1 to 3 months', 'Cold, over 3 months', 'Never contacted'];
  var GAP = 30;            /* empty band between rings; the ring captions sit in it */
  var CORE = 112;          /* radius kept clear around Caladan */
  var TWO_PI = Math.PI * 2;

  function classify() {
    var D = H.data, inv = {}, comp = {}, part = {}, group = {};
    D.edges.forEach(function (e) {
      var us = H.isUs(e.source) ? e.target : H.isUs(e.target) ? e.source : null;
      if (e.kind === 'invested') inv[e.source] = 1;
      if (us && e.kind === 'competes') comp[us] = 1;
      if (us && (e.kind === 'partner' || e.kind === 'customer')) part[us] = 1;
    });
    D.nodes.forEach(function (n, id) {
      var s = (n.sector || '') + ' ' + (n.tags || []).join(' '), st = n.status || '';
      group[id] =
        comp[id] || /competitor|rival/i.test(s) ? 'competitors'
        : part[id] || /^(partner|ally|advisor)$/.test(st) ? 'partners'
        : inv[id] || st === 'investor' || /invest|\bvc\b|venture|capital|angel/i.test(s) ? 'investors'
        : n.type === 'military' || /\bmod\b|government|army|navy|air force|nato|front door|ministry|hmg|armed forces|military/i.test(s) ? 'forces'
        : n.type === 'programme' || n.fund || /non-dilutive|procurement|framework|programme|accelerator|grant|funding/i.test(s) ? 'programmes'
        : /customer|partner/i.test(s) ? 'partners' : 'other';
    });
    return group;
  }

  function ringOf(last, contacted) {
    if (!contacted) return 3;
    var d = H.daysSince(last);
    return d == null ? 2 : d < HUB.coldAfterDays ? 0 : d <= 90 ? 1 : 2;
  }
  function attention(n) {
    if (n.next && n.next.action && n.next.date && n.next.date <= H.todayISO()) return 'due';
    var d = H.daysSince(n._.last);
    return n._.contacted && d != null && d >= HUB.coldAfterDays ? 'cold' : '';
  }
  H.attention = attention;
  function ownerOf(nE, nA) { return nE + nA === 0 ? 'none' : nE > nA * 1.5 ? 'eugenio' : nA > nE * 1.5 ? 'alex' : 'both'; }

  /* A landscape record joins the map when something on the map, the founders and Caladan included, has an edge to it
     (Sophia's firm, a contact's investor). The record stays as it is in the brain; the map only stops hiding it. */
  var linkedCache = { rev: -1, set: {} };
  H.refLinked = function () {
    var D = H.data; if (linkedCache.rev === H.rev && linkedCache.n === D.edges.length) return linkedCache.set;
    var set = {};
    D.edges.forEach(function (e) {
      var a = D.nodes.get(e.source), b = D.nodes.get(e.target); if (!a || !b) return;
      if (a._.ref && !b._.ref) set[e.source] = 1;
      if (b._.ref && !a._.ref) set[e.target] = 1;
    });
    linkedCache = { rev: H.rev, n: D.edges.length, set: set }; return set;
  };
  /* hidden unless the landscape is switched on */
  H.refHidden = function (id) { var n = H.data.nodes.get(id); return !!(n && n._.ref && !H.refLinked()[id]); };

  /* Builds the units (an organisation with its people, or a person on their own) that get a place on the map. */
  function units(landscape, group) {
    var D = H.data, out = [], placed = {}, linked = H.refLinked();
    function show(id) { return !H.isUs(id) && (landscape || !D.nodes.get(id)._.ref || linked[id]); }
    D.nodes.forEach(function (n, id) {
      if (n.type === 'person' || !show(id)) return;
      var staff = (D.staff.get(id) || []).filter(show).map(function (p) { return D.nodes.get(p); });
      var nE = n._.nE, nA = n._.nA, last = n._.last, contacted = n._.contacted;
      staff.forEach(function (p) {
        placed[p.id] = 1; nE += p._.nE; nA += p._.nA; contacted = contacted || p._.contacted;
        if (p._.last > last) last = p._.last;
      });
      staff.sort(function (a, b) { return (b._.last > a._.last ? 1 : b._.last < a._.last ? -1 : 0) || (a.id < b.id ? -1 : 1); });
      var imp = nE + nA + staff.length + (n.next && n.next.action ? 3 : 0) + (n.fin ? 1 : 0);
      out.push({ id: id, n: n, staff: staff, group: group[id], ring: ringOf(last, contacted), last: last, imp: imp,
        owner: n.owner || ownerOf(nE, nA), r: contacted ? Math.min(20, 7 + 2.1 * Math.sqrt(imp)) : n._.ref ? 4.5 : 6 });
    });
    D.nodes.forEach(function (n, id) {
      if (n.type !== 'person' || placed[id] || !show(id) || n.us) return;
      out.push({ id: id, n: n, staff: [], solo: true, group: group[id], ring: ringOf(n._.last, n._.contacted), last: n._.last,
        imp: n._.nE + n._.nA + (n.next && n.next.action ? 3 : 0), owner: n._.owner || 'none', r: 5 });
    });
    out.forEach(function (u) {
      var m = u.staff.length, perOrbit = Math.max(6, Math.floor(TWO_PI * (u.r + 8) / 11));
      u.orbits = m ? Math.ceil(m / perOrbit) : 0; u.perOrbit = perOrbit;
      u.foot = u.r + u.orbits * 11 + (m ? 3 : 0);
    });
    return out;
  }

  H.mapLayout = function (landscape) {
    var group = classify(), all = units(landscape, group), nodes = [], pos = {};
    /* each territory's share of the circle follows how much it has to hold */
    var need = {}, total = 0;
    GROUPS.forEach(function (g) { need[g[0]] = 0; });
    /* the inner rings are the tight ones, so they count most towards a territory's share */
    all.forEach(function (u) { need[u.group] += (u.foot * 2 + 8) * [1, 0.6, 0.35, 0.3][u.ring]; });
    GROUPS.forEach(function (g) { need[g[0]] = Math.pow(need[g[0]] + 200, 0.62); total += need[g[0]]; });
    /* the first territory straddles twelve o'clock, so no dividing line runs through the ring captions there */
    var a = -Math.PI / 2 - Math.PI * need[GROUPS[0][0]] / total, groups = GROUPS.map(function (g) {
      var span = TWO_PI * need[g[0]] / total, o = { key: g[0], label: g[1], short: g[2], a0: a, a1: a + span, count: 0, people: 0 };
      a += span; return o;
    });
    var rings = [], r0 = CORE;
    for (var k = 0; k < 4; k++) {
      var thick = 0, any = all.some(function (u) { return u.ring === k; });
      if (!any) { rings.push({ label: RINGS[k], r0: r0, r1: r0, empty: true }); continue; }   /* an empty ring takes no room */
      groups.forEach(function (g) {
        var list = all.filter(function (u) { return u.group === g.key && u.ring === k; });
        /* warmest first, so the most recent contacts take the inner rows; never-contacted go by how connected they are */
        list.sort(function (x, y) { return k < 3 ? ((y.last > x.last ? 1 : y.last < x.last ? -1 : 0) || y.imp - x.imp || (x.id < y.id ? -1 : 1)) : (y.imp - x.imp || (x.id < y.id ? -1 : 1)); });
        var i = 0, rowIn = r0, pad = 0.035;
        while (i < list.length) {
          var row = [], h = 0, used = 0, first = list[i];
          var rr = rowIn + first.foot, arc = (g.a1 - g.a0 - 2 * pad) * rr;
          while (i < list.length && (row.length === 0 || used + list[i].foot * 2 + 9 <= arc)) {
            used += list[i].foot * 2 + 9; h = Math.max(h, list[i].foot); row.push(list[i]); i++;
          }
          rr = rowIn + h;
          /* rows are packed tight and centred in their territory, so each territory reads as one island */
          var at = (g.a0 + g.a1) / 2 * rr - used / 2;
          row.forEach(function (u) {
            var ang = (at + u.foot + 4.5) / rr; at += u.foot * 2 + 9;
            place(u, rr * Math.cos(ang), rr * Math.sin(ang), ang, g);
          });
          rowIn += h * 2 + 9;
        }
        thick = Math.max(thick, rowIn - r0);
      });
      rings.push({ label: RINGS[k], r0: r0, r1: r0 + thick });
      r0 += thick + GAP;
    }
    function place(u, x, y, ang, g) {
      var n = u.n, solo = !!u.solo;
      var o = { id: u.id, x: x, y: y, r: u.r, person: solo, group: u.group, ring: u.ring, owner: u.owner, imp: u.imp,
        attn: attention(n), name: n.name, ref: n._.ref, contacted: solo ? n._.contacted : u.ring < 3, last: u.last, foot: u.foot };
      nodes.push(o); pos[u.id] = o;
      if (solo) g.people++; else g.count++;
      u.staff.forEach(function (p, j) {
        var orbit = Math.floor(j / u.perOrbit), inOrbit = Math.min(u.perOrbit, u.staff.length - orbit * u.perOrbit);
        var t = ang + TWO_PI * (j % u.perOrbit) / inOrbit + orbit * 0.3, d = u.r + 8 + orbit * 11;
        var q = { id: p.id, x: x + d * Math.cos(t), y: y + d * Math.sin(t), r: 4.2, person: true, group: u.group, ring: u.ring,
          owner: p._.owner || 'none', imp: p._.nE + p._.nA + (p.next && p.next.action ? 3 : 0), attn: attention(p), name: p.name,
          ref: p._.ref, contacted: p._.contacted, last: p._.last, org: u.id };
        nodes.push(q); pos[p.id] = q; g.people++;
      });
    }
    /* the two founders sit just below Caladan; routes start from them */
    var core = [{ id: HUB.company, x: 0, y: -8, r: 26, name: 'Caladan', core: true },
      { id: HUB.founders.eugenio.id, x: -24, y: 34, r: 8, name: 'Eugenio', core: true, owner: 'eugenio' },
      { id: HUB.founders.alex.id, x: 24, y: 34, r: 8, name: 'Alex', core: true, owner: 'alex' }];
    core.forEach(function (c) { pos[c.id] = c; });
    return { nodes: nodes, core: core, pos: pos, groups: groups, rings: rings, R: r0 - GAP };
  };
})();

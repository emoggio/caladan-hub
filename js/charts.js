/* Charts for the drill-ins. Plain SVG, drawn from the same records the bots write; nothing here writes.
   Which fields each chart needs is listed in GROK.md section 6 ("The control room"), so the bots keep them filled.
   - Market:  signals {date, kind, segment, amountUSD}  -> money by quarter, segments heating up
   - Rivals:  nodes {caps{12 scores 0-3}, fin{fundingUSD}} -> overlap vs funding, capability matrix
   - Rounds:  valuations {company, stage, date, amountUSD, valuationUSD, like} -> rounds of companies like us, valuations over time */
(function () {
  var H = window.H, h = H.h;
  var CAPS = [['se', 'Synthetic env'], ['phys', 'Flight physics'], ['ew', 'EW / GPS-denied'], ['cuas', 'Counter-UAS'], ['auto', 'Autonomy data'], ['fpv', 'FPV training'],
    ['bms', 'BMS link'], ['aar', 'Replay'], ['ukr', 'Ukraine data'], ['accr', 'Accreditation'], ['usv', 'Maritime'], ['oem', 'OEM library']];
  var SEGS = [['fpv-training', 'FPV and operator training', '#e8a33d'], ['synthetic-env', 'Synthetic environments', '#3d9be8'], ['autonomy', 'Autonomy and AI', '#9d7be0'],
    ['counter-uas', 'Counter-UAS', '#e0609f'], ['oem-drones', 'Drone OEMs', '#3fbf86'], ['maritime', 'Maritime', '#45b8ad'], ['policy', 'Policy and capital', '#8792a3']];
  var SEG_ALIAS = { cuas: 'counter-uas', 'synthetic-training': 'synthetic-env', capital: 'policy', funding: 'policy', investors: 'policy' };
  var STAGES = [[/pre-?seed/i, 'Pre-seed', '#3fbf86'], [/seed/i, 'Seed', '#3d9be8'], [/series a/i, 'Series A', '#8db1f0'], [/series b/i, 'Series B', '#9d7be0'], [/series c/i, 'Series C', '#e0609f'], [/./, 'Later', '#e8a33d']];
  H.CAPS = CAPS;
  function seg(s) { var k = SEG_ALIAS[s] || s; return SEGS.some(function (x) { return x[0] === k; }) ? k : 'policy'; }
  function stage(s) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i][0].test(s || '')) return STAGES[i]; return STAGES[5]; }
  function usd(n) { return n == null ? '–' : n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'k' : '$' + n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  H.usd = usd;
  /* an SVG chart from a string; clicking an element with data-go opens that record */
  function svg(W, Hh, inner, label) {
    var d = document.createElement('div'); d.className = 'chart';
    d.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(label) + '">' + inner + '</svg>';
    d.addEventListener('click', function (ev) { var g = ev.target.closest('[data-go]'); if (g && g.getAttribute('data-go') && H.data.nodes.has(g.getAttribute('data-go'))) H.mapSelect(g.getAttribute('data-go')); });
    return d;
  }
  function legend(items) { return h('div', { class: 'ch-legend' }, items.map(function (x) { return h('span', null, h('i', { style: 'background:' + x[1] }), x[0]); })); }
  /* greedy label placement: try a few spots, skip one that would collide */
  function placer(W, Hh) {
    var boxes = [];
    return function (x, y, r, text) {
      var w = text.length * 6.8 + 6, hh = 13, c = [[x + r + 4, y - 6], [x - r - 4 - w, y - 6], [x - w / 2, y - r - 15], [x - w / 2, y + r + 3]];
      for (var i = 0; i < c.length; i++) {
        var b = { x: c[i][0], y: c[i][1], w: w, h: hh };
        if (b.x < 2 || b.x + w > W - 2 || b.y < 2 || b.y + hh > Hh - 2) continue;
        if (boxes.some(function (o) { return b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y; })) continue;
        boxes.push(b); return '<text x="' + b.x.toFixed(1) + '" y="' + (b.y + 10).toFixed(1) + '" class="ch-lb">' + esc(text) + '</text>';
      }
      return '';
    };
  }
  function section(title, note, body) { return h('section', { class: 'd-block ch-block' }, h('h3', { class: 'eyebrow' }, title), note ? h('p', { class: 'kv' }, note) : null, body); }

  /* ---------- Market ---------- */
  function quarter(d) { var t = H.parse(d); return t ? t.getFullYear() + ' Q' + (Math.floor(t.getMonth() / 3) + 1) : null; }
  H.chartMoney = function () {
    /* budgets and fund closes are a different scale (billions); they are counted in the note, not drawn */
    var q = {}, aside = 0; H.data.signals.forEach(function (s) {
      if (!(s.kind === 'round' || s.kind === 'contract') || !s.amountUSD) return;
      var k = quarter(s.date); if (!k) return;
      if (seg(s.segment) === 'policy') { if (H.daysSince(s.date) <= 730) aside += s.amountUSD; return; }
      (q[k] = q[k] || {})[seg(s.segment)] = (q[k][seg(s.segment)] || 0) + s.amountUSD;
    });
    var ks = Object.keys(q).sort().slice(-8);
    if (!ks.length) return section('Money raised and won, by quarter', '', h('p', { class: 'p-empty' }, 'No rounds or contracts with an amount yet'));
    var tot = ks.map(function (k) { return Object.keys(q[k]).reduce(function (a, s) { return a + q[k][s]; }, 0); }), max = Math.max.apply(null, tot);
    var W = 760, Hh = 240, P = 34, slot = (W - 2 * P) / ks.length, bw = Math.min(56, slot - 16), out = '';
    [0.5, 1].forEach(function (f) { var y = Hh - P - f * (Hh - 2 * P - 14); out += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y + '" y2="' + y + '" class="ch-grid"/><text x="' + (P - 6) + '" y="' + (y + 4) + '" class="ch-ax" text-anchor="end">' + usd(max * f) + '</text>'; });
    ks.forEach(function (k, i) {
      var x = P + i * slot + (slot - bw) / 2, y = Hh - P;
      SEGS.forEach(function (sg) {
        var v = q[k][sg[0]] || 0; if (!v) return; var hh = v / max * (Hh - 2 * P - 14);
        out += '<rect x="' + x.toFixed(1) + '" y="' + (y - hh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, hh).toFixed(1) + '" fill="' + sg[2] + '"><title>' + esc(k + ' · ' + sg[1] + ': ' + usd(v)) + '</title></rect>'; y -= hh;
      });
      out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (Hh - P + 16) + '" class="ch-ax" text-anchor="middle">' + k + '</text><text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" class="ch-v" text-anchor="middle">' + usd(tot[i]) + '</text>';
    });
    out += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + (Hh - P) + '" y2="' + (Hh - P) + '" class="ch-axis"/>';
    return section('Money raised and won, by quarter', 'Rounds and contracts in our segments that state an amount. Hover a block for the figure.' + (aside ? ' Not drawn: ' + usd(aside) + ' of budgets and fund closes in the last two years.' : ''),
      [svg(W, Hh, out, 'Money by quarter and segment'), legend(SEGS.slice(0, 6).map(function (s) { return [s[1], s[2]]; }))]);
  };
  H.chartHeat = function () {
    var now = Date.now(), rows = SEGS.map(function (sg) {
      var mine = H.data.signals.filter(function (s) { return seg(s.segment) === sg[0]; });
      function within(a, b) { return mine.filter(function (s) { var t = H.parse(s.date); var d = t ? (now - t) / 864e5 : 1e9; return d >= a && d < b; }); }
      var now90 = within(0, 90), prev90 = within(90, 180), cap = within(0, 365).filter(function (s) { return s.amountUSD && /round|contract/.test(s.kind); }).reduce(function (a, s) { return a + s.amountUSD; }, 0);
      return { sg: sg, n: now90.length, prev: prev90.length, cap: cap };
    }).sort(function (a, b) { return b.n - a.n; });
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.n, r.prev); }).concat([1]));
    return section('Which segments are heating up', 'Signals in the last 90 days (bar) against the 90 days before (tick), and money in the last 12 months.',
      h('ul', { class: 'heat' }, rows.map(function (r) {
        var d = r.n - r.prev;
        return h('li', null, h('span', { class: 'hb-l' }, h('i', { class: 'dot', style: 'background:' + r.sg[2] }), r.sg[1]),
          h('span', { class: 'heat-t' }, h('i', { style: 'width:' + (r.n / max * 100) + '%;background:' + r.sg[2] }), h('em', { style: 'left:' + (r.prev / max * 100) + '%' })),
          h('b', { class: 'num' }, r.n), h('span', { class: 'num heat-d ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') }, d > 0 ? '+' + d : d < 0 ? String(d) : '='), h('span', { class: 'num kv' }, r.cap ? usd(r.cap) : ''));
      })));
  };

  /* ---------- Rivals ---------- */
  function us() { var D = H.data; return D.nodes.get(window.HUB.company); }
  function overlap(a, b) { var n = 0, d = 0; CAPS.forEach(function (c) { var x = a[c[0]] || 0, y = b[c[0]] || 0; n += Math.min(x, y); d += Math.max(x, y); }); return d ? n / d : 0; }
  H.rivals = function () {
    var me = us(), mine = me && me.caps;
    return Array.from(H.data.nodes.values()).filter(function (n) { return n.caps && !H.isUs(n.id); }).map(function (n) {
      return { n: n, ov: mine ? overlap(mine, n.caps) : 0, fund: n.fin && n.fin.fundingUSD || 0 };
    }).sort(function (a, b) { return b.ov - a.ov || b.fund - a.fund; });
  };
  H.chartPositioning = function () {
    var list = H.rivals().filter(function (r) { return r.ov > 0; }).slice(0, 40);
    if (!list.length) return section('Who overlaps with us', '', h('p', { class: 'p-empty' }, 'No capability scores recorded yet'));
    var W = 760, Hh = 400, P = 50, lane = 56, lo = 5.7, hi = Math.max(9, Math.log10(Math.max.apply(null, list.map(function (r) { return r.fund || 1; }))) + 0.3);
    function sx(v) { return P + v * (W - 2 * P); }
    function sy(f) { return Hh - P - lane - (Math.max(lo, Math.log10(f)) - lo) / (hi - lo) * (Hh - 2 * P - lane); }
    var out = '', put = placer(W, Hh);
    [1e6, 1e7, 1e8, 1e9].forEach(function (v) { if (Math.log10(v) > hi) return; var y = sy(v); out += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y + '" y2="' + y + '" class="ch-grid"/><text x="' + (P - 6) + '" y="' + (y + 4) + '" class="ch-ax" text-anchor="end">' + usd(v) + '</text>'; });
    [0.25, 0.5, 0.75].forEach(function (v) { var x = sx(v); out += '<line x1="' + x + '" x2="' + x + '" y1="' + P + '" y2="' + (Hh - P) + '" class="ch-grid"/><text x="' + x + '" y="' + (Hh - P + 26) + '" class="ch-ax" text-anchor="middle">' + v * 100 + '%</text>'; });
    out += '<rect x="' + sx(0.5) + '" y="' + P + '" width="' + (sx(1) - sx(0.5)) + '" height="' + (sy(3e7) - P) + '" class="ch-zone"><title>Close overlap and well funded</title></rect>';
    /* rivals with no funding recorded sit in their own strip at the bottom, staggered so they do not stack */
    var k = 0, pts = list.map(function (r) { return { r: r, x: sx(r.ov), y: r.fund ? sy(r.fund) : Hh - P - 8 - (k++ % 3) * 16, rad: r.fund ? Math.min(14, 4 + Math.sqrt(r.fund / 1e6) * 0.9) : 4.5 }; }).sort(function (a, b) { return b.rad - a.rad; });
    out += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + (Hh - P - lane + 6) + '" y2="' + (Hh - P - lane + 6) + '" class="ch-axis"/><text x="' + (P - 6) + '" y="' + (Hh - P - 20) + '" class="ch-ax" text-anchor="end">not</text><text x="' + (P - 6) + '" y="' + (Hh - P - 8) + '" class="ch-ax" text-anchor="end">recorded</text>';
    pts.forEach(function (p) {
      out += '<g data-go="' + esc(p.r.n.id) + '" class="ch-pt"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + p.rad.toFixed(1) + '" class="' + (p.r.fund ? '' : 'nofund') + '"><title>' + esc(p.r.n.name + ' · overlap ' + Math.round(p.r.ov * 100) + '% · ' + (p.r.fund ? 'raised ' + usd(p.r.fund) : 'funding not recorded')) + '</title></circle></g>';
    });
    pts.forEach(function (p) { out += put(p.x, p.y, p.rad, H.shortName(p.r.n.name).split(' (')[0].slice(0, 22)); });
    out += '<text x="' + (W - P) + '" y="' + (Hh - 10) + '" class="ch-axl" text-anchor="end">capability overlap with Caladan →</text><text x="' + P + '" y="' + (P - 14) + '" class="ch-axl">↑ money raised (log)</text>';
    return section('Who overlaps with us, and how much money they have', 'Top right is the threat: close to what we do and well funded. Hollow dots: funding not recorded. Click a dot to open it.', svg(W, Hh, out, 'Rivals by overlap and funding'));
  };
  H.chartCaps = function () {
    var me = us(), list = H.rivals().slice(0, 14);
    if (!list.length) return section('Capability matrix', '', h('p', { class: 'p-empty' }, 'No capability scores recorded yet'));
    var rows = (me && me.caps ? [{ n: me, us: true }] : []).concat(list);
    var t = h('table', { class: 'capm' }, h('thead', null, h('tr', null, h('th', null, ''), CAPS.map(function (c) { return h('th', { title: c[1] }, h('span', null, c[1])); }), h('th', null, 'Overlap'))),
      h('tbody', null, rows.map(function (r) {
        var c = r.n.caps || {};
        return h('tr', { class: r.us ? 'us' : '' }, h('th', null, r.us ? 'Caladan (us)' : H.nodeLink(r.n.id, H.clip(H.shortName(r.n.name), 24))),
          CAPS.map(function (k) { var v = c[k[0]] || 0, m = me && me.caps ? me.caps[k[0]] || 0 : 0; return h('td', { class: 'v' + v + (!r.us && v >= 2 && m >= 2 ? ' clash' : ''), title: k[1] + ': ' + v + ' of 3' }, v || ''); }),
          h('td', { class: 'num' }, r.us ? '' : Math.round(r.ov * 100) + '%'));
      })));
    var gaps = CAPS.filter(function (k) { return !list.some(function (r) { return (r.n.caps[k[0]] || 0) >= 2; }); }).map(function (k) { return k[1]; });
    return section('Capability matrix', 'Scores 0 to 3. Outlined cells: both we and they are strong (contested). ' + (gaps.length ? 'Nobody among them is strong in: ' + gaps.join(', ') + '.' : ''), h('div', { class: 'tablewrap' }, t));
  };

  /* ---------- Rounds ---------- */
  H.chartLikeUs = function () {
    var like = (H.data.valuations || []).filter(function (v) { return v.like; }), cos = {};
    like.forEach(function (v) { var k = String(v.company || '').replace(' (our ask)', ''); (cos[k] = cos[k] || []).push(v); });
    var list = Object.keys(cos).map(function (k) { var vs = cos[k].sort(function (a, b) { return a.date < b.date ? -1 : 1; }); return { co: k, vs: vs, total: vs.reduce(function (a, v) { return a + (v.amountUSD || 0); }, 0), us: vs.some(function (v) { return H.isUs(v.node); }) }; })
      .sort(function (a, b) { return b.total - a.total; });
    if (!list.length) return section('Companies like us', '', h('p', { class: 'p-empty' }, 'No comparable rounds marked yet'));
    var max = Math.max.apply(null, list.map(function (r) { return r.total; }).concat([1]));
    return section('Companies like us: what they raised, round by round', 'Each block is one round, coloured by stage. Our ask is in the brand colour.',
      [h('ul', { class: 'likebars' }, list.map(function (r) {
        return h('li', { class: r.us ? 'us' : '' }, h('span', { class: 'lb-name' }, r.vs[0].node && H.data.nodes.has(r.vs[0].node) ? H.nodeLink(r.vs[0].node, r.co) : r.co),
          h('span', { class: 'lb-bar' }, r.vs.filter(function (v) { return v.amountUSD; }).map(function (v) {
            var w = v.amountUSD / max * 100, st = stage(v.stage);
            return h('i', { style: 'width:' + w.toFixed(2) + '%;background:' + (r.us ? 'var(--brand-grad)' : st[2]), title: v.stage + ' · ' + String(v.date || '').slice(0, 7) + ' · ' + usd(v.amountUSD) + (v.lead ? ' · ' + v.lead : '') }, w > 7 ? usd(v.amountUSD) : '');
          })),
          h('b', { class: 'num' }, r.total ? usd(r.total) : 'undisclosed'), h('span', { class: 'kv' }, r.vs.map(function (v) { return stage(v.stage)[1] + ' ' + String(v.date || '').slice(0, 7); }).join(' → ')));
      })), legend(STAGES.map(function (s) { return [s[1], s[2]]; }))]);
  };
  H.chartValuations = function () {
    var rows = (H.data.valuations || []).filter(function (v) { return v.valuationUSD && H.parse(v.date); });
    if (!rows.length) return section('Valuations over time', '', h('p', { class: 'p-empty' }, 'No valuations recorded yet'));
    var W = 760, Hh = 320, P = 52, years = rows.map(function (v) { return H.parse(v.date).getFullYear(); });
    var t0 = new Date(Math.min.apply(null, years), 0, 1).getTime(), t1 = Date.now() + 60 * 864e5;
    var vmax = Math.max.apply(null, rows.map(function (v) { return v.valuationUSD; })), lo = Math.floor(Math.log10(Math.min.apply(null, rows.map(function (v) { return v.valuationUSD; })))), hi = Math.max(8, Math.ceil(Math.log10(vmax)));
    function sx(d) { return P + (H.parse(d).getTime() - t0) / (t1 - t0) * (W - 2 * P); }
    function sy(v) { return Hh - P - (Math.log10(Math.max(v, 1e6)) - lo) / (hi - lo) * (Hh - 2 * P); }
    var out = '', put = placer(W, Hh), by = {};
    for (var e = lo; e <= hi; e++) { var y = sy(Math.pow(10, e)); out += '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + y + '" y2="' + y + '" class="ch-grid"/><text x="' + (P - 6) + '" y="' + (y + 4) + '" class="ch-ax" text-anchor="end">' + usd(Math.pow(10, e)) + '</text>'; }
    for (var yr = new Date(t0).getFullYear(); yr <= new Date().getFullYear(); yr++) { var x = sx(yr + '-01-01'); out += '<line x1="' + x + '" x2="' + x + '" y1="' + P + '" y2="' + (Hh - P) + '" class="ch-grid"/><text x="' + x + '" y="' + (Hh - P + 16) + '" class="ch-ax" text-anchor="middle">' + yr + '</text>'; }
    rows.forEach(function (v) { (by[v.company] = by[v.company] || []).push(v); });
    Object.keys(by).forEach(function (k) { var vs = by[k].sort(function (a, b) { return a.date < b.date ? -1 : 1; }); if (vs.length > 1) out += '<polyline class="ch-line" points="' + vs.map(function (v) { return sx(v.date).toFixed(1) + ',' + sy(v.valuationUSD).toFixed(1); }).join(' ') + '"/>'; });
    var pts = rows.map(function (v) { return { v: v, x: sx(v.date), y: sy(v.valuationUSD), r: v.amountUSD ? Math.min(11, 4 + Math.sqrt(v.amountUSD / 1e6) * 0.25) : 5 }; });
    pts.forEach(function (p) { var st = stage(p.v.stage); out += '<g data-go="' + esc(p.v.node || '') + '" class="ch-pt"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + p.r.toFixed(1) + '" style="fill:' + st[2] + '"><title>' + esc(p.v.company + ' · ' + p.v.stage + ' · ' + p.v.date + ' · ' + (p.v.amountUSD ? usd(p.v.amountUSD) + ' at ' : '') + usd(p.v.valuationUSD)) + '</title></circle></g>'; });
    pts.sort(function (a, b) { return b.v.valuationUSD - a.v.valuationUSD; }).forEach(function (p) { out += put(p.x, p.y, p.r, String(p.v.company).split(' ')[0]); });
    out += '<text x="' + P + '" y="' + (P - 14) + '" class="ch-axl">↑ valuation after the round (log)</text>';
    return section('Valuations over time', 'Each dot is a priced round; lines join the same company. Size is the amount raised.', [svg(W, Hh, out, 'Valuations over time'), legend(STAGES.map(function (s) { return [s[1], s[2]]; }))]);
  };

  /* ---------- small charts for the other drill-ins ---------- */
  /* due steps: one row per owner, segments by age */
  H.chartDue = function (steps) {
    var AGES = [['due today', 0, 0, 'var(--s1)'], ['1–7 days late', 1, 7, 'var(--s0)'], ['8–30 days late', 8, 30, 'var(--warn)'], ['over 30 days late', 31, 1e9, 'var(--bad)']];
    var OWN = [['eugenio', 'Eugenio'], ['alex', 'Alex'], ['both', 'Both'], ['unassigned', 'No owner']];
    var rows = OWN.map(function (o) { var mine = steps.filter(function (c) { return c.owner === o[0]; }); return { o: o, n: mine.length, seg: AGES.map(function (a) { return mine.filter(function (c) { return (c.late || 0) >= a[1] && (c.late || 0) <= a[2]; }).length; }) }; }).filter(function (r) { return r.n; });
    var max = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
    return h('div', { class: 'ch-block' }, h('ul', { class: 'stackbars' }, rows.map(function (r) {
      return h('li', null, h('span', { class: 'hb-l' }, r.o[1]), h('span', { class: 'sb-t' }, r.seg.map(function (n, i) { return n ? h('i', { style: 'width:' + (n / max * 100) + '%;background:' + AGES[i][3], title: r.o[1] + ': ' + n + ' ' + AGES[i][0] }, n) : null; })), h('b', { class: 'num' }, r.n));
    })), legend(AGES.map(function (a) { return [a[0], a[3]]; })));
  };
  /* feeds: a dot per day for the last 14 days, from the activity log and the status records */
  H.chartRuns = function () {
    var days = [], today = H.parse(H.todayISO());
    for (var i = 13; i >= 0; i--) { var d = new Date(today.getTime() - i * 864e5); days.push(d.toISOString().slice(0, 10)); }
    var by = {};
    (H.data.activity || []).forEach(function (a) { var k = a.agent || 'other', d = String(a.date || a.createdAt || '').slice(0, 10); (by[k] = by[k] || {})[d] = (by[k][d] || 0) + 1; });
    (H.data.status || []).forEach(function (s) { var k = s.id, d = String(s.lastSuccess || '').slice(0, 10), f = String(s.lastAttempt || '').slice(0, 10); by[k] = by[k] || {}; if (d) by[k][d] = by[k][d] || 1; if (f && s.lastError) by[k]['x' + f] = 1; });
    var keys = Object.keys(by).sort();
    if (!keys.length) return null;
    return h('div', { class: 'ch-block' }, h('h3', { class: 'eyebrow' }, 'Runs, last 14 days'),
      h('div', { class: 'runs', style: 'grid-template-columns: 150px repeat(14, 1fr)' }, h('span', null, ''), days.map(function (d) { return h('span', { class: 'runs-d' }, d.slice(8)); }),
        keys.map(function (k) { return [h('span', { class: 'runs-k' }, k.replace(/_/g, ' '))].concat(days.map(function (d) { var bad = by[k]['x' + d], n = by[k][d]; return h('i', { class: bad ? 'bad' : n ? 'ok' : '', title: k + ' · ' + d + (bad ? ' · failed' : n ? ' · ran' : '') }); })); })),
      legend([['ran', 'var(--good)'], ['failed', 'var(--bad)'], ['nothing', 'var(--tint)']]));
  };
  /* goals: from when it was set to its deadline, with today marked and the share done */
  H.chartGoals = function (goals) {
    var today = Date.now(), list = goals.filter(function (g) { return H.parse(g.by); });
    if (!list.length) return null;
    var t0 = Math.min.apply(null, list.map(function (g) { return (H.parse(g.createdAt) || H.parse(g.by)).getTime(); }).concat([today - 30 * 864e5])), t1 = Math.max.apply(null, list.map(function (g) { return H.parse(g.by).getTime(); }).concat([today + 14 * 864e5]));
    function x(t) { return ((t - t0) / (t1 - t0) * 100).toFixed(2) + '%'; }
    return h('div', { class: 'ch-block' }, h('ul', { class: 'gtrack' }, list.map(function (g) {
      var done = g.status === 'done', s = (H.parse(g.createdAt) || new Date(t0)).getTime(), e = H.parse(g.by).getTime(), late = !done && today > e, pct = done ? 1 : g.target && typeof g.current === 'number' ? Math.min(1, g.current / g.target) : null;
      return h('li', null, h('span', { class: 'hb-l' }, 'G' + (g.n || '') + ' ' + H.clip(g.title || g.short || g.text || '', 40)),
        h('span', { class: 'gt-t' }, h('i', { class: 'gt-span' + (late ? ' late' : '') + (done ? ' done' : ''), style: 'left:' + x(s) + ';width:calc(' + x(e) + ' - ' + x(s) + ')' }, pct != null ? h('b', { style: 'width:' + (pct * 100) + '%' }) : null),
          h('em', { class: 'gt-now', style: 'left:' + x(today) }, 'today')),
        h('b', { class: 'num ' + (late ? 'late' : '') }, done ? 'done' : pct == null ? 'not recorded' : Math.round(pct * 100) + '%'));
    })));
  };
})();

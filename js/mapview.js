/* Map view: draws the layout as SVG, handles pan / zoom / tap, labels that never overlap, lenses and routes. */
(function () {
  var H = window.H, h = H.h, HUB = window.HUB;
  var NS = 'http://www.w3.org/2000/svg';
  var S = H.mapState = { lens: 'attention', landscape: false, sel: '', route: '', view: null, three: false };
  try { S.three = localStorage.getItem('hub-map-3d') === '1'; } catch (e) { /* storage blocked: start in 2D */ }
  function set3d(on) { S.three = on; try { localStorage.setItem('hub-map-3d', on ? '1' : '0'); } catch (e) { /* not remembered */ } H.render(); }
  var L = null, key = '', el = {}, routes = null, hi = {}, hover = null, raf = 0, fitK = 1, links = [], net = [];
  /* motion: what the previous full-screen 2D draw showed, so a programmatic move (Reset, a lens, a pick, a route) glides
     there instead of jumping. Wheel, pan and pinch stay direct. */
  var shown = null, mapTick = -1, tw = 0, lastHi = null, overAt = null;   /* overAt: the view the labels were laid out for */

  function s(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function layout() {
    var k = S.landscape + '|' + (H.rev || 0) + '|' + H.todayISO();
    if (k !== key) { L = H.mapLayout(S.landscape); key = k; }
    return L;
  }
  /* A route or selection may involve background-reference nodes: switch the landscape on so they have a place. */
  function ensureVisible(ids) {
    if (S.landscape) return;
    if (ids.some(H.refHidden)) { S.landscape = true; S.autoLand = true; }
  }

  H.mapSelect = function (id) { S.sel = id; S.route = ''; S.extra = null; ensureVisible([id]); layout(); focus([id], 1.6); H.go('map'); };
  H.mapRoute = function (id) { S.route = id; S.sel = ''; S.extra = null; S.view = null; H.go('map'); };
  H.mapLens = function (key) { S.lens = key; S.route = ''; S.sel = ''; S.extra = null; S.view = null; H.go('map'); };
  /* "Show on map" from a briefing card: every bubble the card names is lit, and the warmest route is drawn to the one
     we know least (someone never contacted if there is one). */
  H.mapShow = function (ids, title) {
    var D = H.data, list = ids.filter(function (id) { return D.nodes.has(id) && !H.isUs(id); });
    if (!list.length) return H.mapLens('attention');
    var target = list.filter(function (id) { return !D.nodes.get(id)._.contacted; })[0] || list[0];
    S.route = target; S.sel = ''; S.extra = list; S.note = title || ''; S.view = null; H.go('map');
  };

  function computeRoutes() {
    routes = null;
    if (!S.route || !H.data.nodes.has(S.route)) { S.route = ''; return; }
    var res = H.routesTo(S.route, 3), ids = [S.route];
    res.routes.forEach(function (r) { ids.push(r.contact); r.steps.forEach(function (st) { ids.push(st.to); }); });
    (S.extra || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    ensureVisible(ids);
    routes = { res: res, ids: ids };
  }

  /* ---------- view transform ---------- */
  /* on a phone the profile is a bottom sheet over the map, so only the part above it counts as visible */
  function size() { var hh = el.stage.clientHeight; return { w: el.stage.clientWidth, h: el.sheet ? Math.min(hh, window.innerHeight * 0.55 - 20) : hh }; }
  function fit() {
    var z = size(), room = Math.min(z.w, z.h) / 2;
    /* open on the rings we have actually been in contact with; the never-contacted ring starts at the edge */
    var r = L.rings[2].r1 + (L.rings[3].r1 - L.rings[3].r0) * 0.45;
    fitK = room / (L.R + 40);
    var k = /^(never|money|all)$/.test(S.lens) && !routes ? fitK : Math.max(fitK, Math.min(room / r, fitK * (z.w < 560 ? 1 : 1.7)));   /* these lenses need the outer ring in view */
    return { k: k, x: z.w / 2, y: z.h / 2 };
  }
  function focus(ids, zoom) {
    if (!el.stage || !el.stage.isConnected || !L) { S.view = null; S.pendingFocus = { ids: ids, zoom: zoom }; return; }
    var pts = ids.map(function (id) { return L.pos[id]; }).filter(Boolean), z = size();
    if (!pts.length) return;
    var x0 = Math.min.apply(null, pts.map(function (p) { return p.x; })), x1 = Math.max.apply(null, pts.map(function (p) { return p.x; }));
    var y0 = Math.min.apply(null, pts.map(function (p) { return p.y; })), y1 = Math.max.apply(null, pts.map(function (p) { return p.y; }));
    var base = fit(), k = pts.length === 1 ? Math.max(S.view ? S.view.k : 0, base.k * zoom)
      : Math.max(fitK, Math.min(base.k * 2.4, (z.w - 150) / (x1 - x0 + 1), (z.h - 110) / (y1 - y0 + 1)));
    S.view = { k: k, x: z.w / 2 - k * (x0 + x1) / 2, y: z.h / 2 - k * (y0 + y1) / 2 };
  }
  function apply(now) {
    el.world.setAttribute('transform', 'translate(' + S.view.x + ',' + S.view.y + ') scale(' + S.view.k + ')');
    el.world.style.setProperty('--cap', Math.min(11 / S.view.k, 19) + 'px');   /* ring captions stay about 11px on screen */
    shown = S.small ? null : { x: S.view.x, y: S.view.y, k: S.view.k };
    /* mid-glide the label layout is too costly to redo every frame: the labels laid out at the start ride along with the
       map (scaled with it) and are laid out again on the last frame */
    if (now === 'glide' && overAt) { var f = S.view.k / overAt.k; el.over.setAttribute('transform', 'translate(' + (S.view.x - overAt.x * f) + ',' + (S.view.y - overAt.y * f) + ') scale(' + f + ')'); }
    else if (now) { if (raf) { cancelAnimationFrame(raf); raf = 0; } overlay(); }
    else if (!raf) raf = requestAnimationFrame(function () { raf = 0; overlay(); });
  }
  function zoomAt(mx, my, f) {
    var v = S.view, k = Math.max(fitK * 0.8, Math.min(fitK * 14, v.k * f));
    v.x = mx - (mx - v.x) * k / v.k; v.y = my - (my - v.y) * k / v.k; v.k = k; apply();
  }
  function stopTween() { if (tw) { cancelAnimationFrame(tw); tw = 0; } }
  /* glide from the view on screen to `to` over --d3: the point at the centre moves in a straight line, the zoom moves on
     a log scale so zooming in and out feel the same speed. Reduced motion, or nothing to move: jump. */
  function tweenTo(to) {
    stopTween();
    var from = S.view, z = size(), d = H.dur(3);
    if (!from || H.calm.matches || !(z.w > 0) || (Math.abs(from.k / to.k - 1) < 0.002 && Math.abs(from.x - to.x) + Math.abs(from.y - to.y) < 1)) { S.view = to; apply(); return; }
    var c0 = { x: (z.w / 2 - from.x) / from.k, y: (z.h / 2 - from.y) / from.k }, c1 = { x: (z.w / 2 - to.x) / to.k, y: (z.h / 2 - to.y) / to.k };
    var lk0 = Math.log(from.k), lk1 = Math.log(to.k), v = S.view = { x: from.x, y: from.y, k: from.k }, world = el.world, t0 = performance.now();
    apply(true);
    function step(now) {
      tw = 0;
      if (!world.isConnected || S.view !== v) return;   /* redrawn or taken over by the hand: stop where it is */
      var p = Math.min(1, (now - t0) / d), e = H.ease(p);
      if (p >= 1) { v.x = to.x; v.y = to.y; v.k = to.k; }
      else {
        var cx = c0.x + (c1.x - c0.x) * e, cy = c0.y + (c1.y - c0.y) * e;
        v.k = Math.exp(lk0 + (lk1 - lk0) * e); v.x = z.w / 2 - v.k * cx; v.y = z.h / 2 - v.k * cy;
      }
      apply(p < 1 ? 'glide' : true);
      if (p < 1) tw = requestAnimationFrame(step);
    }
    tw = requestAnimationFrame(step);
  }
  /* the zoom buttons glide too; the wheel and pinch do not */
  function zoomBy(f) {
    var z = size(), v = S.view, k = Math.max(fitK * 0.8, Math.min(fitK * 14, v.k * f)), mx = z.w / 2, my = z.h / 2;
    tweenTo({ x: mx - (mx - v.x) * k / v.k, y: my - (my - v.y) * k / v.k, k: k });
  }
  function nearest(mx, my, reach) {
    var v = S.view, best = null, bd = reach * reach;
    L.nodes.forEach(function (o) {
      var dx = o.x * v.k + v.x - mx, dy = o.y * v.k + v.y - my, rr = o.r * v.k, d = dx * dx + dy * dy - rr * rr;
      if (d < bd && (!best || d < bd)) { bd = d; best = o; }
    });
    return best;
  }

  /* ---------- screen-space overlay: labels, markers, selection ring ---------- */
  function overlay() {
    if (!el.over || !el.over.isConnected || !S.view) return;   /* the view can be reset between the frame being asked for and drawn */
    var v = S.view, z = size(), g = H.clear(el.over), boxes = [], zoom = v.k / fitK;
    overAt = { x: v.x, y: v.y, k: v.k }; g.removeAttribute('transform');
    function free(b) { for (var i = 0; i < boxes.length; i++) { var a = boxes[i]; if (b[0] < a[2] && b[2] > a[0] && b[1] < a[3] && b[3] > a[1]) return false; } return true; }
    function sx(o) { return o.x * v.k + v.x; } function sy(o) { return o.y * v.k + v.y; }
    function text(x, y, str, cls, anchor) { g.appendChild(s('text', { x: x, y: y, class: cls, 'text-anchor': anchor || 'start' }, str)); }
    L.core.forEach(function (c) {
      var hq = c.id === HUB.company, x = sx(c), y = sy(c) + 4, w = c.name.length * 7.2 + 4, rr = c.r * v.k;
      if (hq) { boxes.push([x - rr, y - 4 - rr, x + rr, y - 4 + rr]); boxes.push([x - w / 2, y - rr - 20, x + w / 2, y - rr - 6]); text(x, y - rr - 9, c.name, 'mlab strong', 'middle'); return; }
      var left = c.x < 0, tx = x + (left ? -rr - 4 : rr + 4);
      var cb = left ? [tx - w, y - 11, x + rr, y + 4] : [x - rr, y - 11, tx + w, y + 4];
      if (!free(cb)) { boxes.push([x - rr, y - 4 - rr, x + rr, y - 4 + rr]); return; }     /* a territory name is in the way: the dot's colour still says who */
      boxes.push(cb); text(tx, y, c.name, 'mlab strong', left ? 'end' : 'start');
    });
    /* territory names sit outside the outer ring, clamped to the frame so they stay readable when zoomed in */
    L.groups.forEach(function (gr) {
      var a = (gr.a0 + gr.a1) / 2, rad = (L.R + 30) * v.k, x = v.x + rad * Math.cos(a), y = v.y + rad * Math.sin(a);
      var str = (z.w < 560 ? gr.short : gr.label) + ' · ' + (gr.count + gr.people), w = str.length * 7.4 + 10;
      var anchor = Math.cos(a) > 0.35 ? 'start' : Math.cos(a) < -0.35 ? 'end' : 'middle';
      var left = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
      left = Math.max(6, Math.min(z.w - w - 6, left)); y = Math.max(16, Math.min(z.h - 8, y));
      var b = [left, y - 13, left + w, y + 5];
      for (var t = 0; t < 6 && !free(b); t++) { y += (y > z.h / 2 ? -20 : 20); b = [left, y - 13, left + w, y + 5]; }
      boxes.push(b);
      g.appendChild(s('rect', { x: b[0], y: b[1], width: w, height: 18, rx: 9, class: 'terr-bg' }));
      text(left + 4, y, str, 'terr');
    });
    /* ring captions sit at the top of each ring; keep names off them */
    L.rings.forEach(function (r) { if (!r.empty) { var cw = r.label.length * 3.3 * Math.max(1, v.k) + 6, cy = v.y - (r.r1 + 9) * v.k; boxes.push([v.x - cw, cy - 12 * v.k - 2, v.x + cw, cy + 6]); } });
    var must = {}; if (S.sel) must[S.sel] = 1; if (hover) must[hover.id] = 1;
    /* money lens: all links stay faint; the ones touching the bubble under the pointer (or selected) are drawn strong and named */
    links.forEach(function (e) {
      if (!(hover && (e.source === hover.id || e.target === hover.id)) && e.source !== S.sel && e.target !== S.sel) return;
      var a = L.pos[e.source], b = L.pos[e.target]; must[e.source] = must[e.target] = 1;
      g.appendChild(s('line', { x1: sx(a), y1: sy(a), x2: sx(b), y2: sy(b), class: 'money-strong' }));
    });
    /* who is connected to whom: the links of the bubble under the pointer (or selected) are drawn strong and named by relationship */
    var REL = { introduced: 'introduced', works_at: 'works at', part_of: 'part of', invested: 'invested', customer: 'customer', partner: 'partner', knows: 'knows', competes: 'competes' };
    net.forEach(function (e) {
      var on = (hover && (e.source === hover.id || e.target === hover.id)) || e.source === S.sel || e.target === S.sel;
      if (!on) return;
      var a = L.pos[e.source], b = L.pos[e.target]; must[e.source] = must[e.target] = 1;
      g.appendChild(s('line', { x1: sx(a), y1: sy(a), x2: sx(b), y2: sy(b), class: 'net-strong k-' + e.kind }));
      var mx = (sx(a) + sx(b)) / 2, my = (sy(a) + sy(b)) / 2, str = REL[e.kind] || e.kind, bw = str.length * 6 + 8;
      g.appendChild(s('rect', { x: mx - bw / 2, y: my - 9, width: bw, height: 14, rx: 7, class: 'net-tag-bg' }));
      text(mx, my + 2, str, 'net-tag', 'middle');
    });
    if (routes) routes.ids.forEach(function (id) { must[id] = 1; });
    var cand = L.nodes.filter(function (o) {
      var x = sx(o), y = sy(o);
      return x > -20 && x < z.w + 20 && y > -20 && y < z.h + 20 && (must[o.id] || hi[o.id]);
    });
    function pr(o) { return (must[o.id] ? 1e4 : 0) + o.imp + (o.attn === 'due' ? 4 : 0) - (o.person && zoom < 2.2 ? 6 : 0) - (o.ref ? 4 : 0); }
    cand.sort(function (a, b) { return pr(b) - pr(a) || (a.id < b.id ? -1 : 1); });
    /* markers first (they are part of the bubble), then as many names as fit without touching */
    var own = {}, thin = Math.max(0.5, Math.min(1, v.k / 0.5));   /* rings get finer when the map is small, so they never swallow the bubbles */
    cand.forEach(function (o) {
      var x = sx(o), y = sy(o), rr = o.r * v.k + (o.attn ? 4.5 : 1);
      own[o.id] = boxes.length; boxes.push([x - rr, y - rr, x + rr, y + rr]);       /* names must not sit on a highlighted bubble */
      if (o.attn && hi[o.id] && !routes && !links.length) g.appendChild(s('circle', { cx: x, cy: y, r: o.r * v.k + 3 * thin, class: 'halo ' + o.attn, 'stroke-width': (o.attn === 'due' ? 2.5 : 1.2) * thin }));
    });
    var budget = Math.round(Math.min(260, (z.w * z.h / 17000) * Math.pow(zoom, 1.5))), shown = 0;
    cand.forEach(function (o) {
      if (!must[o.id] && shown >= budget) return;
      /* names in the data often carry a note after a dash; the map shows the name only */
      var str = H.clip(o.name.split(/ [—–-] /)[0], 24), w = str.length * 7 + 4, x = sx(o), y = sy(o), r = (o.foot || o.r) * v.k + 5;
      var tries = [[x + r, y + 4, 'start', x + r, x + r + w], [x - r, y + 4, 'end', x - r - w, x - r], [x, y + r + 10, 'middle', x - w / 2, x + w / 2], [x, y - r - 2, 'middle', x - w / 2, x + w / 2]];
      /* a name that has to show (selected, hovered, on a route) keeps looking further out rather than sit on another */
      if (must[o.id]) for (var j = 1; j <= 5; j++) tries.push([x + r, y + 4 + j * 14, 'start', x + r, x + r + w], [x - r, y + 4 - j * 14, 'end', x - r - w, x - r]);
      for (var i = 0; i < tries.length; i++) {
        var t = tries[i], b = [t[3] - 2, t[1] - 11, t[4] + 2, t[1] + 4];
        var mine = boxes[own[o.id]]; boxes[own[o.id]] = [0, 0, -1, -1];
        var ok = b[0] >= 2 && b[2] <= z.w - 2 && b[1] >= 2 && b[3] <= z.h - 2 && free(b); boxes[own[o.id]] = mine;   /* never cut off at the frame */
        if (ok) {
          boxes.push(b); shown++;
          text(t[0], t[1], str, 'mlab' + (must[o.id] ? ' strong' : ''), t[2]);
          return;
        }
      }
    });
    [S.sel, hover && hover.id].forEach(function (id) {
      var o = id && L.pos[id]; if (o) g.appendChild(s('circle', { cx: sx(o), cy: sy(o), r: o.r * v.k + 4, class: 'sel-ring' }));
    });
  }

  /* ---------- world drawing ---------- */
  var STORY = { introduced: 1, invested: 1, customer: 1, partner: 1 };
  function drawWorld(fadeFrom) {
    var w = H.clear(el.world), lens = H.lensByKey(S.lens);
    /* brand gradient in map units, for the warmest route */
    var gd = s('linearGradient', { id: 'cw-route', gradientUnits: 'userSpaceOnUse', x1: -L.R * 0.6, y1: -L.R * 0.6, x2: L.R * 0.6, y2: L.R * 0.6 });
    [['0', '#f3c9a6'], ['.3', '#b9a4ec'], ['.62', '#2f7cf6'], ['1', '#3ccbd0']].forEach(function (st) { gd.appendChild(s('stop', { offset: st[0], 'stop-color': st[1] })); });
    var defs = s('defs', {}); defs.appendChild(gd); w.appendChild(defs);
    L.rings.slice().reverse().forEach(function (r, j) {
      var i = 3 - j; if (r.empty) return;
      w.appendChild(s('circle', { cx: 0, cy: 0, r: r.r1 + 15, class: 'ring' + (i === 3 ? ' ring-out' : '') }));
      var id = 'ringp' + i, rr = r.r1 + 9;
      w.appendChild(s('path', { id: id, d: 'M' + (-rr) + ' 0A' + rr + ' ' + rr + ' 0 0 1 ' + rr + ' 0', fill: 'none' }));
      var t = s('text', { class: 'ring-lab' }); var tp = s('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' }, r.label);
      t.appendChild(tp); w.appendChild(t);
    });
    L.groups.forEach(function (g) {
      w.appendChild(s('line', { x1: 70 * Math.cos(g.a0), y1: 70 * Math.sin(g.a0), x2: (L.R + 12) * Math.cos(g.a0), y2: (L.R + 12) * Math.sin(g.a0), class: 'spoke' }));
    });
    hi = {};
    if (routes) routes.ids.forEach(function (id) { hi[id] = 1; });
    else L.nodes.forEach(function (o) { if (lens.test(o, L)) hi[o.id] = 1; });
    if (S.sel) hi[S.sel] = 1;
    /* links: money lens, or the routes */
    links = !routes && lens.links ? lens.links(L) : [];
    links.forEach(function (e) {
      var a = L.pos[e.source], b = L.pos[e.target];
      w.appendChild(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'money-link' }));
    });
    /* every relationship between two bubbles on the map (landscape links appear when the landscape is shown). All of them
       light up for the bubble under the pointer or selected; at rest only the ones that tell a story are drawn: links to
       the founders and Caladan repeat the colours, staff sit beside their organisation already, and "knows" / "part of"
       are background */
    net = (routes || links.length) ? [] : H.data.edges.filter(function (e) {
      var a = L.pos[e.source], b = L.pos[e.target]; return a && b && e.source !== e.target;
    });
    /* on a phone or the wall's small preview even these are a tangle: draw none at rest; a tap still shows them */
    var roomy = !S.small && !(el.stage && el.stage.clientWidth < 600);
    net.filter(function (e) {
      var a = L.pos[e.source], b = L.pos[e.target]; if (!roomy) return false;
      return STORY[e.kind] && !a.core && !b.core && a.org !== e.target && b.org !== e.source;
    }).forEach(function (e) {
      var a = L.pos[e.source], b = L.pos[e.target];
      w.appendChild(s('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'net-link k-' + e.kind }));
    });
    var flips = [];
    L.nodes.forEach(function (o) {
      var c = s('circle', { cx: o.x, cy: o.y, r: o.r, class: 'mn ' + (o.person ? 'p' : 'o') + ' o-' + o.owner + (hi[o.id] ? '' : ' dim') });
      w.appendChild(c);
      if (fadeFrom && o.id in fadeFrom && !fadeFrom[o.id] !== !hi[o.id]) flips.push([c, !!hi[o.id]]);
    });
    /* a lens or selection change: bubbles that lit up or dimmed fade between the two (the dim value stays the CSS one) */
    if (flips.length && !H.calm.matches) {
      var probe = flips.filter(function (f) { return !f[1]; })[0] || null, dimO = probe ? parseFloat(getComputedStyle(probe[0]).opacity) : NaN;
      if (!(dimO >= 0)) dimO = 0.82;
      flips.forEach(function (f) { f[0].animate([{ opacity: f[1] ? dimO : 1 }, { opacity: f[1] ? 1 : dimO }], { duration: H.dur(2), easing: H.easing() }); });
    }
    if (routes) routes.res.routes.slice().reverse().forEach(function (r, i, all) {
      var pts = [L.pos[HUB.founders[r.first.best.founder].id], L.pos[r.contact]].concat(r.steps.map(function (st) { return L.pos[st.to]; })).filter(Boolean);
      w.appendChild(s('polyline', { points: pts.map(function (p) { return p.x + ',' + p.y; }).join(' '), class: 'route-line' + (i === all.length - 1 ? ' best' : '') }));
    });
    L.core.forEach(function (c) {
      w.appendChild(s('circle', { cx: c.x, cy: c.y, r: c.r, class: 'mn core ' + (c.owner ? 'o-' + c.owner : 'hq') }));
      /* Caladan itself is the globe mark in the brand gradient, on near-black */
      if (!c.owner) w.appendChild(s('use', { href: '#cw-mark', x: c.x - c.r * 0.72, y: c.y - c.r * 0.72, width: c.r * 1.44, height: c.r * 1.44, fill: 'url(#cw-grad)' }));
    });
    return lens;
  }

  /* ---------- pointer handling ---------- */
  function bind(svg) {
    var pts = new Map(), moved = false, pinch = 0;
    function local(ev) { var b = svg.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; }
    svg.addEventListener('pointerdown', function (ev) { stopTween(); try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* not capturable: panning still works inside the map */ } pts.set(ev.pointerId, local(ev)); moved = false; pinch = 0; });
    svg.addEventListener('pointermove', function (ev) {
      var p = local(ev), prev = pts.get(ev.pointerId);
      if (!prev) {                                       /* plain hover */
        var o = nearest(p.x, p.y, 10);
        if (o !== hover) { hover = o; svg.style.cursor = o ? 'pointer' : 'grab'; apply(); }
        return;
      }
      if (pts.size === 1) {
        if (Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) > 3) moved = true;
        if (moved) { S.view.x += p.x - prev.x; S.view.y += p.y - prev.y; pts.set(ev.pointerId, p); apply(); }
      } else if (pts.size === 2) {
        pts.set(ev.pointerId, p); moved = true;
        var a = Array.from(pts.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinch) zoomAt((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2, d / pinch);
        pinch = d;
      }
    });
    function up(ev) {
      var p = pts.get(ev.pointerId); pts.delete(ev.pointerId); pinch = 0;
      if (!p || moved || ev.type === 'pointercancel') return;
      var o = nearest(p.x, p.y, 14);
      if (o) { S.sel = o.id; H.render(); }
      else if (S.sel) { S.sel = ''; H.render(); }
    }
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('pointerleave', function () { if (hover) { hover = null; apply(); } });
    svg.addEventListener('wheel', function (ev) { ev.preventDefault(); stopTween(); var p = local(ev); zoomAt(p.x, p.y, Math.exp(-ev.deltaY * 0.0015)); }, { passive: false });
  }

  function panel() {
    if (!S.sel && !routes && !S.list) return null;
    /* closing a profile falls back to the route or the list behind it */
    var close = h('button', { class: 'btn quiet panel-close', type: 'button', 'aria-label': 'Close panel', onclick: function () {
      if (S.sel) S.sel = ''; else if (routes) { S.route = ''; S.extra = null; } else S.list = false;
      S.view = S.sel || routes ? S.view : null; H.render();
    } }, S.sel && (routes || S.list) ? '← Back' : 'Close');
    var box = h('aside', { class: 'map-panel' }, close);
    if (S.sel) H.renderProfile(box, S.sel, { panel: true });
    else if (routes) { if (S.extra && S.note) box.appendChild(h('p', { class: 'small muted' }, 'From your briefing: ' + S.note)); box.appendChild(H.routeBlock(S.route, routes.res, function (id) { S.sel = id; H.render(); })); }
    else H.peoplePanel(box, function (id) { S.sel = id; ensureVisible([id]); layout(); focus([id], 1.4); H.render(); });
    return box;
  }

  H.views = H.views || {};
  H.views.map = function (root) {
    /* full-screen 2D drawn twice in a row (a click, a lens, live data): the new view may glide from the old one */
    stopTween();
    var again = !S.small && mapTick === H.tick - 1 && H.view === 'map';
    mapTick = S.small ? -1 : H.tick;
    if (S.list == null) S.list = window.innerWidth >= 1300;      /* wide screens open with the by-need list docked */
    if (S.key == null) S.key = window.innerWidth >= 1100;
    computeRoutes();
    /* the landscape was only switched on to show a route or a profile: put it away again afterwards */
    if (S.autoLand && !routes && !(S.sel && H.refHidden(S.sel))) { S.landscape = false; S.autoLand = false; S.view = null; }
    layout();
    var lensNow = H.lensByKey(S.lens);
    var three = !!S.three && !S.small;
    var bar = h('div', { class: 'map-bar' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Map style' },
        h('button', { type: 'button', 'aria-pressed': String(!three), onclick: function () { if (three) set3d(false); } }, '2D'),
        h('button', { type: 'button', 'aria-pressed': String(three), onclick: function () { if (!three) set3d(true); } }, '3D')),
      h('div', { class: 'lenses', role: 'group', 'aria-label': 'What to highlight' }, H.lenses.map(function (l) {
        return h('button', { class: 'pill', type: 'button', 'aria-pressed': String(!routes && l.key === S.lens),
          onclick: function () { S.lens = l.key; S.route = ''; S.extra = null; S.view = null; H.render(); } }, l.label);
      })),
      h('button', { class: 'btn', type: 'button', 'aria-pressed': String(!!S.list), onclick: function () { S.list = !S.list; S.sel = ''; S.view = null; H.render(); } }, S.list ? 'Hide people by need' : 'People by need'),
      h('label', { class: 'map-toggle small' }, h('input', { type: 'checkbox', id: 'map-landscape', checked: S.landscape,
        onchange: function (ev) { S.landscape = ev.target.checked; S.autoLand = false; S.view = null; H.render(); } }), ' Show landscape'));
    var say = h('p', { class: 'lead map-say' });
    el.stage = h('div', { class: 'map-stage' });
    var svg = s('svg', { class: 'map-svg', role: 'img', 'aria-label': 'Map of the Caladan network. Use search to reach any person or organisation.' });
    el.world = s('g', {}); el.over = s('g', { class: 'over' });
    svg.appendChild(el.world); svg.appendChild(el.over); el.stage.appendChild(svg);
    if (three) svg.style.display = 'none';
    el.stage.appendChild(h('div', { class: 'map-zoom' },
      h('button', { class: 'btn', type: 'button', 'aria-label': 'Zoom in', onclick: function () { if (three) return H.map3dZoom(1.4); zoomBy(1.5); } }, '+'),
      h('button', { class: 'btn', type: 'button', 'aria-label': 'Zoom out', onclick: function () { if (three) return H.map3dZoom(1 / 1.4); zoomBy(1 / 1.5); } }, '−'),
      h('button', { class: 'btn', type: 'button', onclick: function () { if (three) return H.map3dReset(); tweenTo(fit()); } }, 'Reset'),
      h('button', { class: 'btn', type: 'button', 'aria-pressed': String(!!S.key), onclick: function () { S.key = !S.key; H.render(); } }, S.key ? 'Hide key' : 'Key')));
    var side = panel(), wasSheet = el.sheet;
    el.sheet = !!side && window.matchMedia('(max-width: 760px)').matches;
    root.appendChild(bar); root.appendChild(say);
    if (S.key) root.appendChild(H.mapLegend());                 /* one line of key above the map; behind the Key button on small screens */
    root.appendChild(h('div', { class: 'map-main' + (side ? ' with-panel' : '') }, el.stage, side));
    /* the map takes whatever height is left in the window; the panel is docked beside it at the same height */
    if (window.innerWidth > 760) {
      var tall = Math.max(420, window.innerHeight - (el.stage.getBoundingClientRect().top + window.scrollY) - 14) + 'px';
      el.stage.style.height = tall; if (side) side.style.maxHeight = side.style.height = tall;
    }

    var lens = drawWorld(again && !three && lastHi ? lastHi : null);
    lastHi = three || S.small ? null : hi;
    var hit = L.nodes.filter(function (o) { return lens.test(o, L); });
    if (routes) {
      var t = H.data.nodes.get(S.route), best = routes.res.routes[0];
      [h('b', null, 'Route to ' + t.name + '. '), routes.res.direct ? 'You already know them; the lines show who else could vouch for you.'
        : best ? 'Warmest way in: ask ' + H.data.nodes.get(best.contact).name + '. The steps are listed beside the map.'
        : 'No one either of you has spoken with is linked to them within three steps.'].forEach(function (c) { say.appendChild(c.nodeType ? c : document.createTextNode(c)); });
    } else lens.say(hit, L).forEach(function (c) { say.appendChild(c.nodeType ? c : document.createTextNode(String(c))); });

    if (three) {
      shown = null;
      H.map3d(el.stage, L, { hi: hi, sel: S.sel, route: !!routes, pick: function (id) { S.sel = id; if (id) ensureVisible([id]); H.render(); } });
      return;
    }
    if (S.pendingFocus) { var pf = S.pendingFocus; S.pendingFocus = null; S.view = null; fit(); focus(pf.ids, pf.zoom); }
    if (routes && !S.view) { fit(); focus(routes.ids.concat([HUB.company]), 1); }
    if (!S.view) S.view = fit(); else fit();
    if (el.sheet && S.sel) focus([S.sel], 1);                 /* bring the tapped bubble above the sheet */
    if (el.sheet && !wasSheet) el.stage.scrollIntoView({ block: 'start' });
    bind(svg);
    var to = S.view;
    if (again && shown && !S.jump) { S.view = shown; tweenTo(to); } else apply();
    S.jump = false;
  };
  var lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', function () {
    /* phones fire resize when the address bar hides: there only a change of width counts */
    if (window.innerWidth === lastW && (window.innerWidth <= 760 || window.innerHeight === lastH)) return;
    lastW = window.innerWidth; lastH = window.innerHeight;
    /* forget the old framing whatever is on screen, so the map opened later fits the new window */
    S.view = null; S.jump = true;
    if (H.view === 'map' && H.data.ready && el.stage && el.stage.isConnected) H.render();
  });
})();

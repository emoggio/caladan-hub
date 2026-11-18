/* The network map in 3D. Same people, colours, lens and selection as the 2D map, and the same meaning:
   direction = territory, distance from the centre = how recently we were in touch. The third dimension only spreads the
   bubbles so the map can be turned and seen from any side. Positions are fixed (no simulation), so the picture is the
   same on every load. The 3D library loads the first time 3D is chosen; the instance is kept and re-attached on every
   render, so turning the map survives a click. */
(function () {
  var H = window.H;
  var LIB = 'https://cdn.jsdelivr.net/npm/3d-force-graph@1.73.4/dist/3d-force-graph.min.js';
  var BG = '#05070d';
  var G = null, box = null, labs = null, loading = null, raf = 0, hover = '', els = new Map(), titles = [];
  var cur = { L: null, hi: {}, sel: '', pick: null, C: null, route: false, flownTo: '' };

  function load() {
    if (window.ForceGraph3D) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = LIB; s.async = true;
      s.onload = ok; s.onerror = function () { loading = null; no(new Error('The 3D library did not load')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function css(name, fb) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; }
  function hash(id) { var x = 7; for (var i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) | 0; return ((x >>> 0) % 997) / 997; }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mix(hex, k) {   /* fade a colour towards the background: k = 0 keeps it, 1 is background */
    var m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    var a = parseInt(m[1], 16), b = parseInt(BG.slice(1), 16), out = 0;
    for (var s = 16; s >= 0; s -= 8) out = (out << 8) | Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
    return '#' + ('00000' + out.toString(16)).slice(-6);
  }
  function idOf(v) { return v && typeof v === 'object' ? v.id : v; }

  function build(L) {
    var nodes = [], byId = {};
    function add(o, core) {
      var r = Math.hypot(o.x, o.y), a = Math.atan2(o.y, o.x);
      var lat = core ? 0 : (hash(o.id) - 0.5) * 1.5 * Math.min(1, r / 180);
      var n = { id: o.id, name: o.name || (H.data.nodes.get(o.id) || {}).name || o.id, owner: core && !o.owner ? 'hq' : (o.owner || 'none'),
        core: !!core, person: !!o.person, ref: !!o.ref, group: o.group, val: Math.max(1, (o.r * o.r) / 10), imp: o.imp || 0 };
      n.fx = n.x = r * Math.cos(lat) * Math.cos(a); n.fy = n.y = r * Math.sin(lat); n.fz = n.z = r * Math.cos(lat) * Math.sin(a);
      nodes.push(n); byId[n.id] = n;
    }
    L.nodes.forEach(function (o) { add(o, false); });
    L.core.forEach(function (c) { add(c, true); });
    var links = H.data.edges.filter(function (e) { var a = byId[e.source], b = byId[e.target]; return a && b && !a.ref && !b.ref && e.source !== e.target; })
      .map(function (e) { return { source: e.source, target: e.target, kind: e.kind }; });
    /* one title per territory, floating at the middle of its bubbles */
    titles = (L.groups || []).map(function (g) {
      var m = nodes.filter(function (n) { return n.group === g.key && !n.core; }); if (!m.length) return null;
      var c = m.reduce(function (s, n) { s.x += n.x; s.y += n.y; s.z += n.z; return s; }, { x: 0, y: 0, z: 0 });
      return { id: 'g:' + g.key, x: c.x / m.length * 1.25, y: c.y / m.length * 1.25 + 40, z: c.z / m.length * 1.25, name: g.label + ' · ' + m.length, title: true };
    }).filter(Boolean);
    return { nodes: nodes, links: links };
  }

  function lit(n) { return n.core || cur.hi[n.id] || n.id === cur.sel; }
  function strong(l) { var a = idOf(l.source), b = idOf(l.target), f = cur.sel || hover; return f ? (a === f || b === f) : cur.route ? !!(cur.hi[a] && cur.hi[b]) : false; }
  function colour(n) {
    var c = cur.C[n.owner] || cur.C.none;
    if (n.id === cur.sel) return '#ffffff';
    return lit(n) ? c : mix(c, 0.78);
  }

  function make() {
    box = document.createElement('div'); box.className = 'map3d';
    var gl = document.createElement('div'); gl.className = 'map3d-gl'; box.appendChild(gl);
    labs = document.createElement('div'); labs.className = 'map3d-labels'; box.appendChild(labs);
    G = window.ForceGraph3D({ controlType: 'orbit' })(gl)
      .backgroundColor(BG).showNavInfo(false).enableNodeDrag(false)
      .cooldownTicks(0).warmupTicks(0)
      .nodeRelSize(3.2).nodeResolution(14).nodeOpacity(0.95).nodeVal('val')
      .nodeColor(colour)
      .nodeLabel(function (n) { return n.core ? '' : '<div class="map3d-tip">' + esc(n.name) + '</div>'; })
      .linkColor(function (l) { return strong(l) ? '#3c8cff' : '#5b6878'; })
      .linkOpacity(0.22)
      .linkWidth(function (l) { return strong(l) ? 1.1 : 0; })
      .onNodeHover(function (n) { hover = n && !n.core ? n.id : ''; gl.style.cursor = hover ? 'pointer' : 'grab'; G.linkColor(G.linkColor()).linkWidth(G.linkWidth()); })
      .onNodeClick(function (n) { if (cur.pick && !n.core) cur.pick(n.id); })
      .onBackgroundClick(function () { if (cur.pick && cur.sel) cur.pick(''); });
  }

  /* labels: founders, the selection and hover always; then the biggest lit bubbles while they do not collide */
  function label(id, html, cls) {
    var e = els.get(id);
    if (!e) { e = document.createElement('span'); labs.appendChild(e); els.set(id, e); }
    if (e._h !== html) { e.innerHTML = html; e._h = html; e._w = 0; }
    e.className = cls; return e;
  }
  function tick() {
    raf = 0;
    if (!G) return;
    if (!box.isConnected) { G.pauseAnimation(); return; }   /* left the map: stop drawing frames */
    raf = requestAnimationFrame(tick);
    var cam = G.camera(), M = cam.matrixWorldInverse.elements, W = box.clientWidth, Hh = box.clientHeight;
    var data = G.graphData(), want = [], seen = {};
    function cand(n, pri, cls) {
      var zc = M[2] * n.x + M[6] * n.y + M[10] * n.z + M[14]; if (zc >= -1) return;   /* behind the camera */
      var p = G.graph2ScreenCoords(n.x, n.y, n.z); if (p.x < -50 || p.y < -20 || p.x > W + 50 || p.y > Hh + 20) return;
      want.push({ n: n, x: p.x, y: p.y, pri: pri, cls: cls, d: -zc });
    }
    data.nodes.forEach(function (n) {
      if (n.core) return cand(n, 5, 'core');
      if (n.id === cur.sel) return cand(n, 6, 'sel');
      if (n.id === hover) return cand(n, 5.5, 'hov');
      if (lit(n) && (n.val > 3 || cur.route || Object.keys(cur.hi).length < 60)) cand(n, 1 + Math.min(3, n.val / 8) + n.imp / 50, n.person ? 'p' : 'o');
    });
    titles.forEach(function (t) { cand(t, 4, 'title'); });
    want.sort(function (a, b) { return b.pri - a.pri || a.d - b.d; });
    var placed = [];
    want.forEach(function (c) {
      var id = c.n.id, e = label(id, esc(c.n.name), 'm3l ' + c.cls);
      var w = (e._w || c.n.name.length * 6.5) + 8, hgt = (e._h2 || 15) + 4;
      var R = { l: c.x - w / 2, r: c.x + w / 2, t: c.y - hgt - 6, b: c.y - 6 };
      if (c.pri < 5.5 && placed.some(function (P) { return R.l < P.r && R.r > P.l && R.t < P.b && R.b > P.t; })) return;
      placed.push(R); seen[id] = 1;
      e.style.display = ''; e.style.transform = 'translate(' + c.x.toFixed(1) + 'px,' + (c.y - 6).toFixed(1) + 'px) translate(-50%,-100%)';
      if (!e._w) { e._w = e.offsetWidth; e._h2 = e.offsetHeight; }
    });
    els.forEach(function (e, id) { if (!seen[id]) e.style.display = 'none'; });
  }

  /* draw (or re-attach) the 3D map inside the stage */
  H.map3d = function (stage, L, opt) {
    stage.classList.add('is-3d');
    var wait = document.createElement('p'); wait.className = 'map3d-wait'; wait.textContent = 'Loading the 3D map…';
    stage.appendChild(wait);
    load().then(function () {
      if (!stage.isConnected) return;
      if (!G) make();
      wait.remove(); stage.appendChild(box);
      cur.C = { eugenio: css('--eug', '#cc7a33'), alex: css('--alex', '#8f72ea'), both: css('--both', '#27a59b'), none: '#8a96a3', hq: '#f3f5f8' };
      cur.hi = opt.hi || {}; cur.pick = opt.pick; cur.route = !!opt.route;
      var selChanged = cur.sel !== (opt.sel || ''); cur.sel = opt.sel || '';
      G.width(stage.clientWidth).height(stage.clientHeight);
      /* new data rebuilds the layout object; redraw only if the bubbles actually moved, and keep the camera where it is */
      var sig = L.nodes.length + ':' + Math.round(L.nodes.reduce(function (a, o) { return a + o.x * 3 + o.y; }, 0));
      if (cur.sig !== sig) {
        var first = !cur.sig; cur.sig = sig; els.forEach(function (e) { e.remove(); }); els.clear();
        G.graphData(build(L));
        if (first) G.cameraPosition({ x: 0, y: 260, z: (L.R || 600) * 2.1 }, { x: 0, y: 0, z: 0 }, 0);
      }
      cur.L = L;
      G.nodeColor(colour).linkColor(G.linkColor()).linkWidth(G.linkWidth());
      G.resumeAnimation();
      if (selChanged && cur.sel) {
        var n = G.graphData().nodes.filter(function (x) { return x.id === cur.sel; })[0];
        /* fly in along the current line of sight, stopping 160 units short of the bubble */
        if (n) { var c = G.cameraPosition(), dx = c.x - n.x, dy = c.y - n.y, dz = c.z - n.z, d = Math.hypot(dx, dy, dz) || 1; G.cameraPosition({ x: n.x + dx / d * 160, y: n.y + dy / d * 160, z: n.z + dz / d * 160 }, { x: n.x, y: n.y, z: n.z }, 900); }
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }, function (e) {
      wait.textContent = e.message + '. The 2D map still works.';
    });
  };
  H.map3dReset = function () { if (G && cur.L) G.cameraPosition({ x: 0, y: 260, z: (cur.L.R || 600) * 2.1 }, { x: 0, y: 0, z: 0 }, 800); };
  H.map3dZoom = function (f) { if (!G) return; var p = G.cameraPosition(), t = G.controls().target; G.cameraPosition({ x: t.x + (p.x - t.x) / f, y: t.y + (p.y - t.y) / f, z: t.z + (p.z - t.z) / f }, { x: t.x, y: t.y, z: t.z }, 300); };
})();

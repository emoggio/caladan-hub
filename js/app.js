/* Start-up, who is viewing, and what is on screen: the wall, a drill-in over it, or the network map full screen.
   Stays live: every change in the database redraws the wall and moves the "updated" tick. Keys: / search, Esc close. */
(function () {
  var H = window.H, h = H.h, HUB = window.HUB;
  var FULL = { map: 1, profile: 1 };           /* screens that replace the wall; everything else is the wall or a drill-in over it */
  var OLD = { home: 'wall', briefing: 'wall', triage: 'todo', pipeline: 'customers', product: 'state', market: 'state', review: 'wall', people: 'map', paths: 'map', classic: 'map', hiring: 'wall', money: 'raise' };
  var pending = false, soon = 0, after = [], memo = '';   /* memo: the screen (and viewer) the last draw showed */
  H.view = 'wall';

  function viewFromHash() {
    var v = location.hash.replace('#', ''); v = OLD[v] || v;
    return FULL[v] || H.drills.indexOf(v) >= 0 ? v : 'wall';
  }
  H.go = function (v) {
    v = OLD[v] || v;
    if (location.hash === '#' + v) { H.view = v; H.render(); } else location.hash = v;   /* hashchange renders */
  };
  window.addEventListener('hashchange', function () {
    var was = H.view; H.view = viewFromHash(); H.render();
    if (FULL[was] !== FULL[H.view]) window.scrollTo(0, 0);
  });
  H.afterRender = function (fn) { after.push(fn); };

  H.render = function () {
    pending = false; H.tick = (H.tick || 0) + 1; after = [];
    var page = document.getElementById('page'), root = document.getElementById('view'), full = !!FULL[H.view];
    page.className = 'page ' + (full ? 'is-full' : 'is-wall') + (H.view === 'map' ? ' wide' : '');
    if (!H.data.ready) return;
    drawMaster();
    var keepScroll = root.querySelector('.d-body') ? root.querySelector('.d-body').scrollTop : 0;
    /* numbers and bars move only on a redraw of the same screen for the same viewer; a new screen just appears */
    var same = memo === H.view + '|' + H.me, prev = null;
    if (same && root.firstChild) try { prev = H.snapshot(root); } catch (e) { prev = null; }
    memo = H.view + '|' + H.me;
    H.clear(root);
    root.className = 'view v-' + H.view;
    try {
      if (full) {
        if (H.view === 'map') root.appendChild(h('div', { class: 'subnav' }, h('button', { class: 'sw-btn', type: 'button', onclick: function () { H.go('wall'); } }, '← Wall'), h('span', { class: 'kv' }, 'Network map')));
        H.views[H.view](root);
      } else {
        var drill = H.view !== 'wall';
        H.views.wall(root, drill);
        if (drill) { H.drillView(root, H.view); var b = root.querySelector('.d-body'); if (b) b.scrollTop = keepScroll; }
      }
      after.forEach(function (fn) { fn(); });
      try { H.settle(root, prev); } catch (e) { console.error(e); }
    } catch (e) {
      console.error(e);
      H.clear(root).appendChild(h('div', { class: 'empty' }, h('h2', null, 'This screen could not be drawn'), h('p', null, 'Something in the data was not in the shape the page expects. Reload to try again; nothing was changed.')));
    }
  };
  /* A change arriving from the database must not wipe a field someone is typing in. Several collections often change together. */
  function renderSoon() { clearTimeout(soon); soon = setTimeout(renderNow, 80); }
  function renderNow() {
    var a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && document.getElementById('view').contains(a);
    if (!typing) return H.render();
    if (pending) return;
    pending = true;
    a.addEventListener('blur', function () { setTimeout(function () { if (pending) renderNow(); }, 300); }, { once: true });
  }

  /* the master light: the one place the brand gradient is used besides the mark */
  function drawMaster() {
    var s = H.systemSummary(), el = document.getElementById('master');
    el.className = 'master lvl-' + s.level; el.title = 'Open Systems';
    H.clear(el); el.appendChild(h('i', { class: 'master-light', 'aria-hidden': 'true' })); el.appendChild(h('span', { class: 'master-text' }, s.text));
    drawTick();
  }
  function drawTick() {
    var el = document.getElementById('tick'); if (!el) return;
    el.textContent = H.lastChange ? 'live · updated ' + (Date.now() - H.lastChange < 8000 ? 'just now' : H.age(H.lastChange) + ' ago') : H.db ? 'connecting' : 'offline';
    el.classList.toggle('fresh', !!H.lastChange && Date.now() - H.lastChange < 8000);
  }
  function drawViewer(detected) {
    var box = H.clear(document.getElementById('viewer'));
    function btn(key) { return h('button', { type: 'button', 'aria-pressed': String(H.me === key), onclick: function () { H.me = key; H.store.set('me', key); drawViewer(false); H.render(); } }, HUB.founders[key].name); }
    box.appendChild(h('span', { class: 'viewer-l' }, detected && H.me ? 'Signed in as' : 'Viewing as'));
    box.appendChild(h('span', { class: 'seg', role: 'group', 'aria-label': 'Who is viewing' }, btn('eugenio'), btn('alex')));
    if (H.signedIn && window.brainSignOut) box.appendChild(h('button', { class: 'sw-btn signout', type: 'button', onclick: function () { window.brainSignOut(); } }, 'Sign out'));
  }
  /* Display names are "Eugenio Moggio" and "Al". */
  function founderFromName(name) {
    var n = H.norm(name).trim();
    return /^eugenio\b/.test(n) ? 'eugenio' : /^al(ex\w*)?\b/.test(n) ? 'alex' : null;
  }
  function offline(title, text) {
    var el = document.getElementById('master'); el.className = 'master lvl-bad'; H.clear(el); el.appendChild(h('i', { class: 'master-light' })); el.appendChild(h('span', { class: 'master-text' }, title));
    H.clear(document.getElementById('view')).appendChild(h('div', { class: 'empty' }, h('h2', null, title), h('p', null, text)));
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); document.getElementById('q').focus(); }
    else if (e.key === 'Escape' && !typing && H.view !== 'wall') { if (H.drills.indexOf(H.view) >= 0) H.closeDrill(); else H.go('wall'); }
  });

  function start() {
    document.getElementById('master').addEventListener('click', function () { if (H.data.ready) H.go('systems'); });
    H.me = H.store.get('me') || null;
    H.view = viewFromHash();
    drawViewer(false);
    H.initSearch();
    if (!window.claude || !window.claude.use) return offline('Not connected', 'The page could not reach the Caladan brain. Check your connection and reload.');

    window.claude.use('user').then(function (user) {
      if (!user) return;
      H.signedIn = true; drawViewer(false);
      return user.me().then(function (me) {
        H.userId = me.id || null;
        var who = founderFromName(me.name);
        if (who) { H.me = who; drawViewer(true); if (H.data.ready) H.render(); }
      });
    }).catch(function () { /* the switch at the top still works */ });

    window.claude.use('db').then(function (db) {
      if (!db) return offline('Database not available', 'Sign in again and reload.');
      H.db = db;
      return H.loadAll(db).then(function () {
        H.render();
        if (H.data.truncated.length) H.toast('Some lists were cut at 1000: ' + H.data.truncated.join(', '));
        H.watch(db, function () { renderSoon(); });
        setInterval(drawTick, 15000);
        /* lights go stale with time even when nothing changes: redraw once a minute, never while a field has focus */
        setInterval(function () { if (!document.hidden) renderNow(); }, 60000);
      });
    }).catch(function (e) {
      console.error(e);
      offline('The brain could not be loaded', 'Reload the page to try again. Nothing has been changed.');
    });
  }
  var lastW = window.innerWidth;
  window.addEventListener('resize', function () { if (window.innerWidth !== lastW && H.view !== 'map') { lastW = window.innerWidth; if (H.data.ready) renderSoon(); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

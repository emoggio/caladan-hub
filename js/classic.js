/* Classic 3D map loader.
   When the address ends in #classic, this swaps the hub out and runs the old page (published
   beside this one as classic.html, byte for byte) inside the same document, so it keeps the
   same database connection. Nothing in classic.html is changed. */
(function () {
  var H = window.H, HUB = window.HUB;
  window.addEventListener('hashchange', function () {
    var want = location.hash === '#classic' && !!HUB.classicFile;
    /* into the classic map: swap in place (a reload may not keep the #classic part); back out: reload for a clean hub */
    if (want && !H.classic) { H.classic = true; start(); }
    else if (!want && H.classic) location.reload();
  });

  function fail(msg) {
    document.body.innerHTML = '';
    var p = document.createElement('p');
    p.style.cssText = 'font:16px system-ui;padding:24px;max-width:40em';
    p.textContent = msg + ' ';
    var a = document.createElement('a');
    a.href = '#people'; a.textContent = 'Back to the hub';
    p.appendChild(a); document.body.appendChild(p);
  }

  function run(scripts, i, done) {
    if (i >= scripts.length) return done();
    var old = scripts[i], s = document.createElement('script');
    for (var k = 0; k < old.attributes.length; k++) { var an = old.attributes[k].name; if (an !== 'type' && an !== 'data-ctype') s.setAttribute(an, old.attributes[k].value); }
    if (old.getAttribute('data-ctype')) s.setAttribute('type', old.getAttribute('data-ctype'));
    var next = function () { run(scripts, i + 1, done); };
    if (old.src) { s.onload = next; s.onerror = next; old.parentNode.replaceChild(s, old); }
    else { s.textContent = old.textContent; old.parentNode.replaceChild(s, old); next(); }
  }

  var started = false;
  function start() {
    if (started) return;      /* the replayed DOMContentLoaded below must not start a second load */
    started = true;
    fetch(HUB.classicFile).then(function (r) {
      if (!r.ok) throw new Error('missing');
      return r.text();
    }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      document.body.innerHTML = '';
      /* the hub's own stylesheets would restyle the classic page (hidden labels, padded boxes): drop them */
      Array.prototype.slice.call(document.head.querySelectorAll('link[rel="stylesheet"], style')).forEach(function (n) { n.remove(); });
      if (doc.title) document.title = doc.title;
      var frag = document.createDocumentFragment();
      /* styles and the page's own content, in source order (head first, then body) */
      [doc.head, doc.body].forEach(function (part) {
        Array.prototype.slice.call(part.childNodes).forEach(function (n) {
          if (n.nodeName === 'META' || n.nodeName === 'TITLE') return;
          frag.appendChild(document.importNode(n, true));
        });
      });
      /* park the imported scripts as inert text so each runs exactly once, in order, when run() re-creates it */
      Array.prototype.slice.call(frag.querySelectorAll('script')).forEach(function (sc) {
        sc.setAttribute('data-ctype', sc.getAttribute('type') || ''); sc.setAttribute('type', 'text/plain');
      });
      document.body.appendChild(frag);
      var back = document.createElement('a');
      back.href = '#people'; back.textContent = '← Caladan hub';
      back.style.cssText = 'position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483000;font:500 13px system-ui;padding:6px 10px;border-radius:999px;background:#10242a;color:#fff;text-decoration:none;opacity:.85';
      document.body.appendChild(back);
      var scripts = Array.prototype.slice.call(document.body.querySelectorAll('script'));
      run(scripts, 0, function () {
        /* the old page may wait for these; they already fired for the hub shell */
        document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
        window.dispatchEvent(new Event('load'));
      });
    }).catch(function () {
      fail('The classic 3D map could not be loaded here.');
    });
  }
  if (!H.classic) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

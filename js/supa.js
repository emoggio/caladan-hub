/* Connects the control room to the Caladan brain on Supabase.
   It provides the same small database interface the page used on claude.ai (window.claude.use('db') / ('user')),
   so the panels did not change. Only the two founders can sign in; the database refuses everyone else. */
(function () {
  var C = window.BRAIN || {};
  if (!C.url || !window.supabase) return;   /* app.js then shows "Not connected" */
  var sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } });
  window.SB = sb;
  var FIELDS = 'id,data,version,updated_at';

  function wrap(r) { return { id: r.id, exists: true, version: r.version, data: function () { return r.data; } }; }
  function snap(rows) { return { size: rows.length, empty: !rows.length, docs: rows.map(wrap) }; }
  function check(res) { if (res.error) throw res.error; return res.data || []; }

  function Query(col, filters, order, lim) { this.col = col; this.filters = filters || []; this.ord = order || null; this.lim = lim || 1000; }
  Query.prototype.where = function (f, op, v) {
    if (op !== '==' && op !== 'eq') throw new Error('only == filters are supported');
    return new Query(this.col, this.filters.concat([[f, v]]), this.ord, this.lim);
  };
  Query.prototype.orderBy = function (f, dir) { return new Query(this.col, this.filters, [f, dir || 'asc'], this.lim); };
  Query.prototype.limit = function (n) { return new Query(this.col, this.filters, this.ord, Math.min(n, 1000)); };
  Query.prototype.run = function () {
    var q = sb.from('docs').select(FIELDS).eq('collection', this.col);
    this.filters.forEach(function (f) { q = q.eq('data->>' + f[0], typeof f[1] === 'string' ? f[1] : JSON.stringify(f[1])); });
    if (this.ord) q = q.order('data->>' + this.ord[0], { ascending: this.ord[1] !== 'desc', nullsFirst: false });
    return q.limit(this.lim).then(check);
  };
  Query.prototype.get = function () { return this.run().then(snap); };
  /* Live: re-read the query whenever any record in its collection changes (debounced). */
  Query.prototype.onSnapshot = function (cb, onErr) {
    var self = this, t = null, alive = true;
    function pull() { self.run().then(function (rows) { if (alive) cb(snap(rows)); }, function (e) { if (onErr) onErr(e); }); }
    pull();
    var ch = sb.channel('docs-' + self.col + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'collection=eq.' + self.col }, function () {
        clearTimeout(t); t = setTimeout(pull, 400);
      }).subscribe();
    return function () { alive = false; sb.removeChannel(ch); };
  };

  function Doc(path) { var i = path.indexOf('/'); this.col = path.slice(0, i); this.id = path.slice(i + 1); }
  Doc.prototype.get = function () {
    var id = this.id;
    return sb.from('docs').select(FIELDS).eq('collection', this.col).eq('id', id).maybeSingle().then(function (res) {
      if (res.error) throw res.error;
      return res.data ? wrap(res.data) : { id: id, exists: false, data: function () { return undefined; } };
    });
  };
  /* Merge fields into an existing record; logged in the change log with who did it. */
  Doc.prototype.update = function (patch) {
    return sb.rpc('doc_merge', { p_collection: this.col, p_id: this.id, p_patch: patch }).then(function (res) { if (res.error) throw res.error; return res.data; });
  };
  Doc.prototype.set = Doc.prototype.update;
  Doc.prototype.onSnapshot = function (cb, onErr) {
    var self = this;
    return new Query(self.col).onSnapshot(function () { self.get().then(cb, onErr); }, onErr);
  };
  Doc.prototype.delete = function () { return Promise.reject(new Error('the brain never deletes')); };

  var db = {
    collection: function (name) { return new Query(name); },
    doc: function (path) { return new Doc(path); }
  };

  var NAMES = { eugenio: 'Eugenio', alex: 'Alex' };
  var ready = sb.auth.getSession().then(function (r) { return r.data && r.data.session; });

  function member() {
    return sb.from('members').select('founder').maybeSingle().then(function (r) { return r.data && r.data.founder; });
  }

  function signIn() {
    var view = document.getElementById('view');
    if (!view) return;
    view.innerHTML = '';
    var box = document.createElement('form');
    box.className = 'login';
    box.innerHTML = '<h2>Sign in</h2><p>Enter your Caladan email. We send you a link; open it on this device.</p>' +
      '<input type="email" required autocomplete="email" placeholder="name@caladanworlds.com"><button type="submit">Send sign-in link</button><p class="login-note" aria-live="polite"></p>';
    var input = box.querySelector('input'), note = box.querySelector('.login-note'), btn = box.querySelector('button');
    box.addEventListener('submit', function (e) {
      e.preventDefault(); btn.disabled = true; note.textContent = 'Sending…';
      sb.auth.signInWithOtp({ email: input.value.trim().toLowerCase(), options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
        btn.disabled = false;
        note.textContent = r.error ? 'Could not send: ' + r.error.message : 'Check your inbox for the link from Supabase.';
      });
    });
    view.appendChild(box);
    var m = document.querySelector('#master .master-text'); if (m) m.textContent = 'Signed out';
  }

  window.claude = {
    use: function (what) {
      if (what === 'db') {
        return ready.then(function (s) {
          if (!s) { signIn(); return new Promise(function () { /* the sign-in link reloads the page */ }); }
          return member().then(function (f) {
            if (!f) {
              var v = document.getElementById('view');
              if (v) v.innerHTML = '<div class="empty"><h2>Not on the list</h2><p>This brain is only for Eugenio and Alex. <a href="#" id="signout">Sign out</a></p></div>';
              var so = document.getElementById('signout'); if (so) so.onclick = function (e) { e.preventDefault(); sb.auth.signOut().then(function () { location.reload(); }); };
              return new Promise(function () {});
            }
            return db;
          });
        });
      }
      if (what === 'user') {
        return ready.then(function (s) {
          if (!s) return null;
          return { me: function () { return member().then(function (f) { return { id: f || s.user.email, name: NAMES[f] || s.user.email }; }); } };
        });
      }
      return Promise.resolve(null);   /* sample, mcp, downloads: not available outside claude.ai */
    }
  };
  window.brainSignOut = function () { sb.auth.signOut().then(function () { location.reload(); }); };
})();

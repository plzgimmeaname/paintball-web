// rooms live in firebase realtime database; the host's browser still runs the match
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[(Math.random() * ALPHABET.length) | 0];
  return s;
}

export const cleanCode = raw => (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
export const netAvailable = () => !!(firebaseConfig.apiKey && firebaseConfig.databaseURL);

let loading = null;
function loadFirebase() {
  if (!loading) {
    loading = (async () => {
      const [app, auth, api] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-database.js'),
      ]);
      const fbApp = app.initializeApp(firebaseConfig);
      const cred = await auth.signInAnonymously(auth.getAuth(fbApp));
      return { api, db: api.getDatabase(fbApp), uid: cred.user.uid };
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

class NetError extends Error {}

export class Net {
  constructor() {
    this.fb = null;
    this.role = null;
    this.code = null;
    this.sid = null;
    this.link = false;
    this.gen = 0;
    this.subs = [];
    this.linkSubs = [];
    this.owned = null;
    this.onReady = () => {};
    this.onConnect = () => {};
    this.onData = () => {};
    this.onClose = () => {};
    this.onError = () => {};
  }

  get connected() { return this.link; }

  path(p) { return this.fb.api.ref(this.fb.db, `rooms/${this.code}/${p}`); }

  async host() {
    this.close();
    const gen = this.gen;
    this.role = 'host';
    try {
      const fb = this.fb = await loadFirebase();
      const { ref, runTransaction, onDisconnect, onValue, remove } = fb.api;
      for (let i = 0; i < 5; i++) {
        if (gen !== this.gen) return;
        const code = makeCode();
        const room = ref(fb.db, `rooms/${code}`);
        let committed = false;
        try {
          const tx = await runTransaction(room, cur => (cur ? undefined : { host: fb.uid, created: Date.now() }), { applyLocally: false });
          committed = tx.committed;
        } catch (e) {
          // someone else's room under that code is rejected by the rules
          if (!/permission/i.test(e.code || e.message)) throw e;
        }
        if (!committed) continue;
        if (gen !== this.gen) { remove(room).catch(() => {}); return; }
        this.code = code;
        this.owned = room;
        await onDisconnect(room).remove();
        if (gen !== this.gen) return;
        this.subs.push(onValue(this.path('guest'), s => this.guestChanged(s.val())));
        this.subs.push(onValue(this.path('host'), s => {
          if (s.val() === fb.uid) return;
          this.drop();
          this.onError('Lost the connection to the game server. Go back and host again.');
        }));
        this.onReady(code);
        return;
      }
      throw new NetError('Could not create a room. Try again.');
    } catch (e) {
      if (gen !== this.gen) return;
      this.close();
      this.onError(describe(e));
    }
  }

  guestChanged(g) {
    const sid = g && typeof g.sid === 'string' ? g.sid : null;
    if (sid === this.sid) return;
    const { onChildAdded, remove } = this.fb.api;
    if (this.sid) {
      this.unlink();
      remove(this.path(`s/${this.sid}`)).catch(() => {});
      this.sid = null;
      if (this.link) { this.link = false; this.onClose(); }
    }
    if (!sid) return;
    this.sid = sid;
    this.linkSubs.push(onChildAdded(this.path(`s/${sid}/g2h`), s => {
      remove(s.ref).catch(() => {});
      this.receive(s.val(), sid);
    }));
    this.link = true;
    this.onConnect();
  }

  async join(code) {
    this.close();
    const gen = this.gen;
    this.role = 'guest';
    this.code = code;
    const timer = setTimeout(() => {
      if (gen !== this.gen || this.link) return;
      this.close();
      this.onError('Could not reach that game. Check the code and try again.');
    }, 12000);
    try {
      const fb = this.fb = await loadFirebase();
      const { get, push, runTransaction, onDisconnect, onValue, onChildAdded, remove } = fb.api;
      if (gen !== this.gen) return;
      const host = await get(this.path('host'));
      if (gen !== this.gen) return;
      if (!host.exists()) throw new NetError(`No game found with code ${code}.`);

      const sid = push(this.path('s')).key;
      const slot = this.path('guest');
      let committed = false;
      try {
        const tx = await runTransaction(slot, cur => (cur ? undefined : { uid: fb.uid, sid }), { applyLocally: false });
        committed = tx.committed;
      } catch (e) {
        if (!/permission/i.test(e.code || e.message)) throw e;
      }
      if (gen !== this.gen) { if (committed) remove(slot).catch(() => {}); return; }
      if (!committed) throw new NetError('That game already has two players.');
      this.owned = slot;
      this.sid = sid;
      await onDisconnect(slot).remove();
      if (gen !== this.gen) return;

      // the slot stops being ours when the host leaves or the room is deleted
      this.subs.push(onValue(this.path('guest/sid'), s => { if (s.val() !== sid) this.drop(); }));
      this.subs.push(onChildAdded(this.path(`s/${sid}/h2g`), s => this.receive(s.val(), sid)));
      this.subs.push(onValue(this.path(`s/${sid}/snap`), s => this.receive(s.val(), sid)));
      clearTimeout(timer);
      this.link = true;
      this.onConnect();
    } catch (e) {
      clearTimeout(timer);
      if (gen !== this.gen) return;
      this.close();
      this.onError(describe(e));
    }
  }

  receive(raw, sid) {
    if (typeof raw !== 'string' || sid !== this.sid || !this.link) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    this.onData(msg);
  }

  // payloads go over as json strings so empty arrays and nulls survive the database
  send(msg) {
    if (!this.link) return;
    const { set, push } = this.fb.api;
    const data = JSON.stringify(msg);
    const base = `s/${this.sid}/`;
    let p;
    if (this.role === 'guest') p = push(this.path(base + 'g2h'), data);
    else if (msg.t === 'snap') p = set(this.path(base + 'snap'), data);
    else p = push(this.path(base + 'h2g'), data);
    Promise.resolve(p).catch(() => {});
  }

  drop() {
    const wasLinked = this.link;
    this.close();
    if (wasLinked) this.onClose();
  }

  unlink() {
    this.linkSubs.forEach(off => off());
    this.linkSubs = [];
  }

  close() {
    this.gen++;
    this.unlink();
    this.subs.forEach(off => off());
    this.subs = [];
    if (this.owned) {
      const { onDisconnect, remove } = this.fb.api;
      onDisconnect(this.owned).cancel().catch(() => {});
      remove(this.owned).catch(() => {});
    }
    this.owned = null;
    this.sid = null;
    this.link = false;
  }
}

function describe(err) {
  if (err instanceof NetError) return err.message;
  const code = String(err && (err.code || err.message) || '');
  if (code.includes('operation-not-allowed') || code.includes('admin-restricted')) {
    return 'Online play needs anonymous sign-in enabled in Firebase.';
  }
  if (/permission/i.test(code)) return 'The game server refused the request. Check the database rules.';
  return 'Could not reach the game server. Check your connection.';
}

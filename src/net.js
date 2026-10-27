// peerjs cloud only brokers the connection; game data goes peer to peer
const PREFIX = 'paintarena-v1-';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[(Math.random() * ALPHABET.length) | 0];
  return s;
}

export const cleanCode = raw => (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
export const netAvailable = () => typeof window.Peer === 'function';

export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.role = null;
    this.code = null;
    this.onReady = () => {};
    this.onConnect = () => {};
    this.onData = () => {};
    this.onClose = () => {};
    this.onError = () => {};
  }

  get connected() { return !!(this.conn && this.conn.open); }

  host(attempt = 0) {
    this.close();
    this.role = 'host';
    this.code = makeCode();
    const peer = new window.Peer(PREFIX + this.code, { debug: 0 });
    this.peer = peer;
    peer.on('open', () => this.onReady(this.code));
    peer.on('connection', conn => {
      if (this.connected) {
        conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); });
        return;
      }
      this.attach(conn);
    });
    peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) peer.reconnect(); });
    peer.on('error', err => {
      if (this.peer !== peer) return;
      if (err.type === 'unavailable-id' && attempt < 3) this.host(attempt + 1);
      else this.onError(describe(err));
    });
  }

  join(code) {
    this.close();
    this.role = 'guest';
    this.code = code;
    const peer = new window.Peer({ debug: 0 });
    this.peer = peer;
    const timeout = setTimeout(() => {
      if (this.peer === peer && !this.connected) this.onError('Could not reach that game. Check the code and try again.');
    }, 12000);
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { serialization: 'json', reliable: true });
      this.attach(conn, () => clearTimeout(timeout));
    });
    peer.on('error', err => {
      if (this.peer !== peer) return;
      clearTimeout(timeout);
      this.onError(err.type === 'peer-unavailable' ? `No game found with code ${code}.` : describe(err));
    });
  }

  attach(conn, opened = () => {}) {
    this.conn = conn;
    conn.on('open', () => { opened(); this.onConnect(); });
    conn.on('data', d => { if (this.conn === conn) this.onData(d); });
    conn.on('close', () => {
      if (this.conn !== conn) return;
      this.conn = null;
      this.onClose();
    });
    conn.on('error', () => {});
  }

  send(msg) {
    if (this.connected) this.conn.send(msg);
  }

  close() {
    const c = this.conn, p = this.peer;
    this.conn = null;
    this.peer = null;
    if (c) try { c.close(); } catch { /* ignore */ }
    if (p) try { p.destroy(); } catch { /* ignore */ }
  }
}

function describe(err) {
  switch (err.type) {
    case 'browser-incompatible': return 'This browser does not support online play.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed': return 'Could not reach the matchmaking server. Check your connection.';
    default: return 'Connection problem: ' + (err.message || err.type);
  }
}

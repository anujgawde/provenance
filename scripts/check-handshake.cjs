const { io } = require('socket.io-client');

const url = process.env.URL || 'http://localhost:4101';
const sock = io(url, { transports: ['websocket'] });

const fail = (msg) => {
  console.error('FAIL:', msg);
  sock.close();
  process.exit(1);
};

const t = setTimeout(() => fail('timeout (no connect or no ack within 4s)'), 4000);

sock.on('connect_error', (e) => fail('connect_error ' + e.message));

sock.on('connect', () => {
  console.log('connected as', sock.id);
  sock.emit(
    'session:join',
    { projectId: 'demo', user: { id: sock.id, name: 'Tester', color: '#7aa2f7' } },
    (resp) => {
      clearTimeout(t);
      console.log('ack:', JSON.stringify(resp));
      if (!resp || !resp.ok) fail('ack not ok');
      sock.close();
      process.exit(0);
    },
  );
});

const mysql = require('mysql2');
const dgram = require('dgram');
const udpServer = dgram.createSocket('udp4');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

udpServer.on('message', (msg, rinfo) => {
  console.log(`📩 Mensaje recibido de ${rinfo.address}:${rinfo.port} -> ${msg}`);

  const data = msg.toString().match(/Latitud:\s*([-0-9.]+)\s*Longitud:\s*([-0-9.]+)\s*Fecha y Hora GPS:\s*(.+)/);
  if (data) {
    const latitud = parseFloat(data[1]);
    const longitud = parseFloat(data[2]);
    const [fecha, hora] = data[3].split(' ');

    db.query('INSERT INTO coordenadas (latitud, longitud, fecha, hora) VALUES (?, ?, ?, ?)',
      [latitud, longitud, fecha, hora], (err) => {
        if (err) console.error('❌ Error al insertar en MySQL:', err.message);
        else console.log(`📌 Nueva coordenada guardada: Lat: ${latitud}, Long: ${longitud}`);
      });
  }
});

db.connect(err => {
  if (err) {
    console.error('❌ Error conectando a MySQL:', err);
    return;
  }
  console.log('✅ Conexión exitosa a la base de datos.');
});

module.exports = db;
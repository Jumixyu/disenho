const path = require('path');
const express = require('express');
const dgram = require('dgram');
const cors = require('cors');
const mysql = require('mysql2');
// const dotenv = require('dotenv');

const app = express();
const port = process.env.PORT || 5000// 80; // Acceso sin :5000
const udpPort = 5000; // Puerto UDP

// Conexión a MySQL
require('dotenv').config();
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('❌ Error conectando a MySQL:', err);
    return;
  }
  console.log('✅ Conexión exitosa a la base de datos.');
});

module.exports = db;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

// Servir la página web con el mapa
app.get('/', (req, res) => {
  console.log('Rendering index page');
  return res.render('index');  // This assumes there is an 'index.ejs' in the 'views' folder
});

// Endpoint para obtener SOLO la última coordenada
app.get('/ultima-coordenada', (req, res) => {
  db.query('SELECT * FROM coordenadas ORDER BY id DESC LIMIT 1', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows[0]); // Solo enviamos la última coordenada
  });
});

// Endpoint para obtener recorrido histórico
app.get('/recorrido-historico', (req, res) => {
  const { inicio, fin } = req.query;

  if (!inicio || !fin) {
    return res.status(400).json({ error: 'Faltan parámetros inicio y fin' });
  }

  db.query(
    'SELECT * FROM coordenadas WHERE CONCAT(fecha, " ", hora) BETWEEN ? AND ? ORDER BY id ASC',
    [inicio, fin],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Servidor UDP para recibir coordenadas
const udpServer = dgram.createSocket('udp4');

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

app.get('/config', (req, res) => {
  res.json({ nombre: process.env.NOMBRE });
});
console.log('llega hasta aqui')

app.use([
  (req, res, next) => {
    res.locals.error = {
      status: '404 Not Found',
      message: 'The server cannot find the requested resource.',
    };
    res.status(404);
    return res.render('error');
  },
  (error, req, res, next) => {
    if (config.debug) console.log(error);
    if (error.status === 405) {
      res.status(405);
      res.locals.error = {
        status: '405 Method Not Allowed',
        message: 'The method received in the request is not supported by the target resource.',
      };
    } else {
      res.status(500);
      res.locals.error = {
        status: '500 Internal Server Error',
        message: 'Something went wrong, please contact the developer if the problem persists.',
      };
    }
  },
]);

udpServer.bind(udpPort, () => {
  console.log(`✅ Servidor UDP escuchando en el puerto ${udpPort}`);
});

// Iniciar servidor HTTP en el puerto 80
app.listen(port, '0.0.0.0', () => {
  console.log("🚀 Servidor corriendo en http://0.0.0.0");
});
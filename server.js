const path = require('path');
const express = require('express');
const dgram = require('dgram');
const cors = require('cors');
const mysql = require('mysql2');
const dotenv = require('dotenv');

const app = express();
const port = process.env.PORT || 80; // Acceso sin :5000
const udpPort = 5000; // Puerto UDP

// Conexión a MySQL
require('dotenv').config();
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
 
console.log('✅ Conexión exitosa a la base de datos.');

// Add the periodic ping right here
setInterval(() => {
  db.query('SELECT 1', (err) => {
    if (err) console.error('❌ Error pineando la base de datos:', err);
    else console.log('💓 La conexión a la base de datos está viva');
  });
}, 60000); // Ping every minute

module.exports = db;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Servir la página web con el mapa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Test database insertion
const testData = {
  latitud: 11.0055555,
  longitud: -74.8000000,
  fecha: '2025-04-28', 
  hora: '14:30:00',
  rpm: 1500
};

db.query(
  'INSERT INTO coordenadas (latitud, longitud, fecha, hora, rpm) VALUES (?, ?, ?, ?, ?)',
  [testData.latitud, testData.longitud, testData.fecha, testData.hora, testData.rpm],
  (err, results) => {
    if (err) {
      console.error('❌ TEST ERROR al insertar en MySQL:', err.message);
    } else {
      console.log(`✅ TEST OK: Datos de prueba insertados con ID=${results.insertId}`);
    }
  }
);

// Endpoint para buscar coordenadas dentro del círculo
app.get('/buscar-por-area', (req, res) => {
  const { lat, lng, radio, inicio, fin } = req.query;
  
  if (!lat || !lng || !radio || !inicio || !fin) {
    return res.status(400).json({ error: 'Faltan parámetros necesarios' });
  }
  
  // Consulta que utiliza la fórmula de Haversine para calcular distancias
  const query = `
    SELECT *, 
    (6371 * acos(cos(radians(?)) * cos(radians(latitud)) * cos(radians(longitud) - radians(?)) + sin(radians(?)) * sin(radians(latitud)))) AS distancia 
    FROM coordenadas 
    WHERE CONCAT(fecha, " ", hora) BETWEEN ? AND ? 
    HAVING distancia <= ? 
    ORDER BY fecha ASC, hora ASC`;
  
  db.query(
    query,
    [lat, lng, lat, inicio, fin, radio/1000], // Convertimos metros a kilómetros
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// .env para nombres en la ventana de la página
app.get('/config', (req, res) => {
  res.json({ nombre: process.env.NOMBRE });
});
 
udpServer.bind(udpPort, () => {
  console.log(`✅ Servidor UDP escuchando en el puerto ${udpPort}`);
});

// Iniciar servidor HTTP en el puerto 80
app.listen(port, '0.0.0.0', () => {
  console.log("🚀 Servidor corriendo en http://0.0.0.0");
});
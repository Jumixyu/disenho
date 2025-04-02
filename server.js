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

 // Endpoint para buscar coordenadas por nombre de lugar
app.post('/buscar-lugar', (req, res) => {
  const { nombre } = req.body;
  
  const query = `SELECT latitud, longitud FROM coordenadas WHERE nombre = ? LIMIT 1`;
  db.query(query, [nombre], (err, results) => {
      if (err) {
          res.status(500).send('Error en la consulta');
          return;
      }
      if (results.length > 0) {
          res.json({ encontrado: true, latitud: results[0].latitud, longitud: results[0].longitud });
      } else {
          res.json({ encontrado: false });
      }
  });
});

// Endpoint para verificar si el vehículo pasó por una ubicación
app.post('/verificar-ubicacion', (req, res) => {
  const { latitud, longitud } = req.body;
  const rango = 0.0001;
  
  const query = `SELECT * FROM coordenadas WHERE 
                 (latitud BETWEEN ? AND ?) AND 
                 (longitud BETWEEN ? AND ?)
                 ORDER BY fecha_hora DESC LIMIT 1`;
  
  db.query(query, [latitud - rango, latitud + rango, longitud - rango, longitud + rango], (err, results) => {
      if (err) {
          res.status(500).send('Error en la consulta');
          return;
      }
      if (results.length > 0) {
          res.json({ paso: true, fecha_hora: results[0].fecha_hora });
      } else {
          res.json({ paso: false });
      }
  });
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
 
 udpServer.bind(udpPort, () => {
   console.log(`✅ Servidor UDP escuchando en el puerto ${udpPort}`);
 });
 
 // Iniciar servidor HTTP en el puerto 80
 app.listen(port, '0.0.0.0', () => {
   console.log("🚀 Servidor corriendo en http://0.0.0.0");
 });
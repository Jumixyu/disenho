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

 // Endpoint para buscar si el vehículo estuvo cerca de una coordenada específica
  app.get('/buscar-ubicacion', (req, res) => {
    const { lat, lon, radio } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Se requieren latitud y longitud' });
    }
    
    // Radio de búsqueda en kilómetros (por defecto 0.5 km si no se especifica)
    const radioKm = radio ? parseFloat(radio) : 0.5;
    
    // Fórmula Haversine para búsqueda de proximidad
    // 111.045 es aproximadamente la cantidad de km por grado de latitud
    const query = `
      SELECT *, 
      (111.045 * DEGREES(ACOS(LEAST(1.0, COS(RADIANS(?)) * COS(RADIANS(latitud)) * 
      COS(RADIANS(longitud) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(latitud)))))) 
      AS distancia_km
      FROM coordenadas
      HAVING distancia_km < ?
      ORDER BY distancia_km, fecha DESC, hora DESC
      LIMIT 20
    `;
    
    db.query(query, [lat, lon, lat, radioKm], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
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
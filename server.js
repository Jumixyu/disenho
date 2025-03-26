const express = require('express');
const dgram = require('dgram');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const fs = require("fs");
const https = require("https");

const app = express();
const udpPort = 5000; // Puerto UDP


// Cargar certificados
const options = {
  key: fs.readFileSync("/etc/letsencrypt/archive/abquintero.ddns.net/privkey1.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/archive/abquintero.ddns.net/cert1.pem"),
  ca: fs.readFileSync("/etc/letsencrypt/archive/abquintero.ddns.net/fullchain1.pem"),
};

// Servidor HTTPS
https.createServer(options, app).listen(443, () => {
  console.log("Servidor HTTPS corriendo en el puerto 443");
});

// Redirección de HTTP a HTTPS
const http = require("http");
http.createServer((req, res) => {
  res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
  res.end();
}).listen(80);

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

udpServer.bind(udpPort, () => {
    console.log(`✅ Servidor UDP escuchando en el puerto ${udpPort}`);
});

const express = require('express');
const dgram = require('dgram');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 80; // Acceso sin :5000
const udpPort = 5000; // Puerto UDP

// Conexión a MySQL
const db = mysql.createConnection({
    host: 'dbandrea2.cr00uqgym11o.us-east-2.rds.amazonaws.com',
    user: 'dbandrea2',
    password: 'diseno123',
    database: 'dbandrea2'
});

db.connect(err => {
    if (err) {
        console.error('❌ Error conectando a MySQL:', err);
        return;
    }
    console.log('✅ Conexión exitosa a la base de datos.');
});

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

// Iniciar servidor HTTP en el puerto 80
app.listen(port, '0.0.0.0', () => {
    console.log("🚀 Servidor corriendo en http://0.0.0.0");
});


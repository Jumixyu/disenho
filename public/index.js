(async () => {
  'use-strict';

  const map = L.map('map'); // Vista inicial

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

  const search = new GeoSearch.GeoSearchControl({
    provider: new GeoSearch.OpenStreetMapProvider(),
    style: 'bar',
  });

  map.addControl(search);

  let marker = null;
  let ruta = null; // Polilínea que representa el recorrido
  let liveRoute = null;
  let coordenadas = []; // Guarda el historial de coordenadas
  let liveCoords = [];
  const messageEl = document.getElementById('message');

  // Function to create or update a marker
  function updateMarker(lat, lon, fecha, hora) {

    console.log(lat, lon, fecha, hora)
    const popupContent = `📍 Lat: ${lat}, Long: ${lon}<br>📅 ${fecha} ${hora}`;

    // Check if lat and lon are valid numbers
    if (isNaN(lat) || isNaN(lon)) {
      console.error('Invalid coordinates:', lat, lon);
      return; // Exit if coordinates are invalid
    }

    if (!marker) {
      marker = L.marker([lat, lon]).addTo(map).bindPopup(popupContent);
      map.openPopup(marker.getPopup()); // Open the popup explicitly
    } else {
      marker.setLatLng([lat, lon]).setPopupContent(popupContent);
      if (marker.getPopup().isOpen()) {
        // If the popup is already open, we can just update its content
        marker.getPopup().setContent(popupContent);
      } else {
        map.openPopup(marker.getPopup()); // Open the popup explicitly
      }
    }
  }

  // Function to handle button activation
  function resaltarBotonActivo(btn) {
    document.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  async function fetchData(url) {
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data || data.error) throw new Error('Error fetching data');
      return data;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  async function obtenerUltimaCoordenada() {
    return await fetchData('/ultima-coordenada');
  }

  async function obtenerRecorridoHistorico(inicio, fin) {
    if (!inicio || !fin) throw new TypeError('"inicio" y "fin" son parámetros requeridos');
    return await fetchData(`/recorrido-historico?inicio=${inicio}&fin=${fin}`);
  }

  function substractArrayEvenly(arr, maxLength) {
    const n = arr.length;
    if (maxLength === 1) return [arr[n - 1]];
    const step = Math.floor((n - 1) / (maxLength - 1));
    return [arr[0], ...Array.from({ length: maxLength - 2 }, (_, i) => arr[(i + 1) * step]), arr[n - 1]];
  }

  async function solicitarRuta(puntos) {
    if (puntos.length < 2) return;
    const coordenadasStr = substractArrayEvenly(puntos, 20).map(coord => `${coord[1]},${coord[0]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordenadasStr}?overview=full&geometries=geojson`;
    const data = await fetchData(url);
    return data?.routes?.[0]?.geometry?.coordinates.map(coord => [coord[1], coord[0]]) || null;
  }

  function reiniciarRuta() {
    console.log('🔄 Reiniciando recorrido...');
    if (ruta) {
      map.removeLayer(ruta); // Remove the route from the map if it exists
      ruta = null; // Reset ruta to null after removal
    }
    if (liveRoute) {
      map.removeLayer(liveRoute); // Remove the live route from the map if it exists
      liveRoute = null; // Reset liveRoute to null after removal
    }
    coordenadas = []; // Reset history of coordinates
    liveCoords = []; // Reset live coordinates
  }

  function formatearFecha(fromServer, fecha, hora) {
    return fromServer ? fecha.replace('T00:00:00.000Z', ' ' + hora) : fecha.replace('T', ' ').replace('Z', '');
  }

  // Event listeners
  const tiempoRealBtn = document.getElementById('tiempo-real-btn')
  const historicoBtn = document.getElementById('historico-btn')

  tiempoRealBtn.addEventListener('click', () => resaltarBotonActivo(tiempoRealBtn));
  historicoBtn.addEventListener('click', () => resaltarBotonActivo(historicoBtn));

  document.getElementById('reiniciar-btn').addEventListener('click', reiniciarRuta);
  document.getElementById('switch-historico-btn').addEventListener('click', () => {
    const historicoControlsInput = document.getElementById('historico-controls');
    historicoControlsInput.classList.toggle('hidden');
  });

  async function handleHistorico() {
    reiniciarRuta();
    const ultimaCoord = await obtenerUltimaCoordenada();
    const inicio = formatearFecha(false, document.getElementById('inicio').value);
    const fin = formatearFecha(false, document.getElementById('fin').value);

    if (!inicio || !fin) {
      messageEl.classList.remove('hidden');
      messageEl.classList.add('error');
      messageEl.textContent = 'Debe llenar los campos de inicio y fin';
      return;
    }

    messageEl.classList.add('hidden');
    messageEl.classList.remove('error');
    messageEl.textContent = '';

    const historico = await obtenerRecorridoHistorico(inicio, fin);
    if (!historico || historico.length === 0) {
      messageEl.classList.remove('hidden');
      messageEl.classList.add('error');
      messageEl.textContent = 'No hay datos para este rango';
      return;
    }

    const rutaCoords = historico.map(coord => [parseFloat(coord.latitud), parseFloat(coord.longitud)]);
    const rutaPlacement = await solicitarRuta(rutaCoords);
    if (ruta) map.removeLayer(ruta);

    const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];
    updateMarker(lat, lon, ultimaCoord.fecha, ultimaCoord.hora);
    ruta = new L.polyline(rutaPlacement, { color: 'red', weight: 4 }).addTo(map);
  }

  document.getElementById('historico-btn').addEventListener('click', handleHistorico);

  async function iniciarTiempoReal() {
    reiniciarRuta();
    const ultimaCoord = await obtenerUltimaCoordenada();
    const rutaCoords = [[ultimaCoord.latitud, ultimaCoord.longitud], [ultimaCoord.latitud, ultimaCoord.longitud]];
    coordenadas = rutaCoords;

    const rutaPlacement = await solicitarRuta(coordenadas);
    if (ruta) map.removeLayer(ruta);
    updateMarker(ultimaCoord.latitud, ultimaCoord.longitud, ultimaCoord.fecha, ultimaCoord.hora);
    ruta = new L.polyline(rutaPlacement, { color: 'red', weight: 4 }).addTo(map);

    setInterval(actualizarMapa, 5000);
  }

  document.getElementById('tiempo-real-btn').addEventListener('click', iniciarTiempoReal);

  async function actualizarMapa() {
    const ultimaCoord = await obtenerUltimaCoordenada();
    const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];
    liveCoords.push([ultimaCoord.latitud, ultimaCoord.longitud]);
    const rutaPlacement = await solicitarRuta(liveCoords.length <= 1 ? [liveCoords[0], liveCoords[0]] : liveCoords);
    if (liveRoute) map.removeLayer(liveRoute);
    updateMarker(ultimaCoord.latitud, ultimaCoord.longitud, ultimaCoord.fecha, ultimaCoord.hora);
    liveRoute = new L.polyline(rutaPlacement, { color: 'blue', weight: 4 }).addTo(map);
    map.fitBounds(liveRoute.getBounds());
    if (map) map.setView([lat, lon], 20);
  }

  await actualizarMapa()

  function obtenerFechaHoraActual() {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    const fechaHoy = `${año}-${mes}-${dia}T00:00`;
    const hora = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const finDefecto = `${año}-${mes}-${dia}T${hora}:${minutos}`;
    document.getElementById('inicio').value = fechaHoy;
    document.getElementById('fin').value = finDefecto;
  }

  obtenerFechaHoraActual();

  fetch('/config')
    .then(response => response.json())
    .then(data => {
      document.getElementById('titulo').textContent = `Mapa MyCoords - ${data.nombre}`;
    })
    .catch(error => console.error('Error al obtener el nombre:', error));

})();
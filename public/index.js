(async () => {
  'use-strict';

  const map = L.map('map'); // Vista inicial

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

  const search = new GeoSearch.GeoSearchControl({
    provider: new GeoSearch.OpenStreetMapProvider(),
    style: 'bar',
    resetButton: '🔍', // Example of using a magnifying glass icon
  });

  map.addControl(search);

  let marker = null;
  let ruta = null; // Polilínea que representa el recorrido
  let liveRoute = null;
  let coordenadas = []; // Guarda el historial de coordenadas
  let liveCoords = [];

  const messageEl = document.getElementById('message');

  // Inicializar el Autocomplete de Google Places
  function initAutocomplete() {

    const input = document.getElementById('search-box');
    console.log(input.value)
    const autocomplete = new google.maps.places.PlaceAutocompleteElement(input);
    autocomplete.addListener('place_changed', function () {
      const place = autocomplete.getPlace();
      if (!place.geometry) {
        console.log("No se encontró la ubicación");
        return;
      }

      // Obtener coordenadas del lugar seleccionado
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Centrar el mapa en la nueva ubicación
      map.setView([lat, lng], 14);

      // Agregar o mover el marcador
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng]).addTo(map);
      }
    });
  }

  // Esperar a que la API de Google Maps cargue antes de inicializar
  window.onload = initAutocomplete;

  // Función para resaltar el botón activo
  function resaltarBotonActivo(btn) {
    // Quitar la clase active de todos los botones
    const botones = document.querySelectorAll('button');
    botones.forEach(boton => boton.classList.remove('active'));

    // Agregar la clase active al botón clickeado
    btn.classList.add('active');
  }

  async function updateMapa(lat, lon) {
    marker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup(`📍 Lat: ${lat}, Long: ${lon}<br>📅 ${data.fecha} ${data.hora}`)
      .openPopup();
  }

  async function obtenerUltimaCoordenada() {
    try {
      const response = await fetch('/ultima-coordenada');

      const data = await response.json();

      if (!data || data.error) {
        return error;
      }

      return data;
    } catch (e) {
      console.log(e);
      return e;
    }
  }

  // Función para obtener recorrido histórico
  async function obtenerRecorridoHistorico(inicio, fin) {
    if (!inicio || !fin) {
      throw new TypeError('"inicio" y "fin" son parámetros requeridos');
    }

    try {
      const response = await fetch(`/recorrido-historico?inicio=${inicio}&fin=${fin}`);

      const data = await response.json();

      if (!data.length) {
        return;
      }

      return data;
    } catch (e) {
      console.error('❌ Error al obtener recorrido histórico:', error);
    }
  }

  function substractArrayEvenly(arr, maxLength) {
    const n = arr.length;
    const result = [];

    if (maxLength === 1) return [arr[n - 1]];

    const step = Math.floor((n - 1) / (maxLength - 1));

    result.push(arr[0]);

    for (let i = 1; i < maxLength - 1; i++) {
      const index = i * step;
      result.push(arr[index]);
    }

    result.push(arr[n - 1]);

    return result;
  }


  async function solicitarRuta(puntos) {
    if (puntos.length < 2) return;

    let coordenadasStr = substractArrayEvenly(puntos, 20)
      .map((coord) => `${coord[1]},${coord[0]}`)
      .join(';');
    let url = `https://router.project-osrm.org/route/v1/driving/${coordenadasStr}?overview=full&geometries=geojson`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        console.warn('⚠ No se encontró una ruta válida.');
        return;
      }

      return data.routes[0].geometry.coordinates.map((coord) => [coord[1], coord[0]]);
    } catch (error) {
      console.error('❌ Error al solicitar la ruta:', error);
    }
  }

  const mapContainer = document.getElementById('map');
  const tiempoRealBtn = document.getElementById('tiempo-real-btn');
  const historicoBtn = document.getElementById('historico-btn');
  const reiniciarBtn = document.getElementById('reiniciar-btn');
  const switchHistoricoBtn = document.getElementById('switch-historico-btn');
  const inicioInput = document.getElementById('inicio');
  const finInput = document.getElementById('fin');
  const historicoControlsInput = document.getElementById('historico-controls');

  // CON ESTO SE RESALTAN LOS BOTONES
  tiempoRealBtn.addEventListener('click', () => {
    resaltarBotonActivo(tiempoRealBtn); // Resalta el botón de Tiempo Real
  });

  switchHistoricoBtn.addEventListener('click', () => {
    resaltarBotonActivo(switchHistoricoBtn); // Resalta el botón de Historial
  });


  function formatearFecha(fromServer, fecha, hora) {
    return fromServer ? fecha.replace('T00:00:00.000Z', ' ' + hora) : fecha.replace('T', ' ').replace('Z', '');
  }

  function reiniciarRuta() {
    console.log('🔄 Reiniciando recorrido...');
    if (ruta) {
      map.removeLayer(ruta); // Eliminar la ruta del mapa
    }

    if (liveRoute) {
      map.removeLayer(liveRoute);
    }
    coordenadas = []; // Reiniciar historial de coordenadas
    liveCoords = [];
  }

  reiniciarBtn.addEventListener('click', reiniciarRuta);

  switchHistoricoBtn.addEventListener('click', async () => {
    return historicoControlsInput.classList.contains('hidden')
      ? historicoControlsInput.classList.remove('hidden')
      : historicoControlsInput.classList.add('hidden');
  });

  historicoBtn.addEventListener('click', async () => {
    reiniciarRuta();
    const ultimaCoord = await obtenerUltimaCoordenada();
    if (!inicioInput.value || !finInput.value) {
      messageEl.classList.remove('hidden');
      messageEl.classList.add('error');
      messageEl.textContent = 'Debe llenar los campos de inicio y fin';
      return;
    }

    // ✅ Aquí ocultamos el mensaje si los valores son correctos
    messageEl.classList.add('hidden');
    messageEl.classList.remove('error');
    messageEl.textContent = '';

    const historico = await obtenerRecorridoHistorico(
      formatearFecha(false, inicioInput.value),
      formatearFecha(false, finInput.value)
    );

    if (!historico || historico.length === 0) {
      messageEl.classList.remove('hidden');
      messageEl.classList.add('error');
      messageEl.textContent = 'No hay datos para este rango';
      return;
    }

    const rutaCoords = historico.map((coord) => [parseFloat(coord.latitud), parseFloat(coord.longitud)]);
    const rutaPlacement = await solicitarRuta(rutaCoords);

    if (ruta) map.removeLayer(ruta); // Eliminar ruta anterior

    const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];

    if (!marker) {
      marker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(`📍 Lat: ${lat}, Long: ${lon}<br>📅 ${ultimaCoord.fecha} ${ultimaCoord.hora}`)
        .openPopup();
    } else {
      marker
        .setLatLng([lat, lon])
        .setPopupContent(`📍 Lat: ${lat}, Long: ${lon}<br>📅 ${ultimaCoord.fecha} ${ultimaCoord.hora}`)
        .openPopup();
    }

    ruta = new L.polyline(rutaPlacement, { color: 'red', weight: 4 }).addTo(map);

    map.fitBounds(ruta.getBounds());
  });

  async function iniciarTiempoReal(intervalId = null, runs = 0) {
    historicoControlsInput.classList.add('hidden');
    reiniciarRuta();

    if (intervalId) clearInterval(intervalId);
    const ultimaCoord = await obtenerUltimaCoordenada();

    const currentDate = new Date(formatearFecha(true, ultimaCoord.fecha, ultimaCoord.hora));
    const substractHours = (d, n) =>
      new Date(d.setHours(d.getHours() - n)).toISOString().replace('T', ' ').substring(0, 19);

    const rutaCoords = [[ultimaCoord.latitud, ultimaCoord.longitud], [ultimaCoord.latitud, ultimaCoord.longitud]]// historico.map((coord) => [parseFloat(coord.latitud), parseFloat(coord.longitud)]);
    coordenadas = rutaCoords;
    coordenadas.push([ultimaCoord.latitud, ultimaCoord.longitud]);

    const rutaPlacement = await solicitarRuta(coordenadas);

    if (ruta) map.removeLayer(ruta); // Eliminar ruta anterior

    const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];

    if (!marker) {
      marker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(`📍 Lat: ${lat}, Long: ${lon}<br>📅 ${ultimaCoord.fecha} ${ultimaCoord.hora}`)
        .openPopup();
    } else {
      marker
        .setLatLng([lat, lon])
        .setPopupContent(`📍 Lat: ${lat}, Long: ${lon}<br>📅 ${ultimaCoord.fecha} ${ultimaCoord.hora}`)
        .openPopup();
    }

    ruta = new L.polyline(rutaPlacement, { color: 'red', weight: 4 }).addTo(map);
    
    if (runs === 0) {
      map.fitBounds(ruta.getBounds());
      const currentZoom = map.getZoom();
      map.setView([lat, lon], currentZoom);
    }


    intervalId = setInterval(actualizarMapa, 5000);
  }

  tiempoRealBtn.addEventListener('click', async () => {
    await iniciarTiempoReal()
  });

  await iniciarTiempoReal()

  async function actualizarMapa() {
    const ultimaCoord = await obtenerUltimaCoordenada();
    liveCoords.push([ultimaCoord.latitud, ultimaCoord.longitud]);

    const rutaPlacement = await solicitarRuta(liveCoords.length <= 1 ? [liveCoords[0], liveCoords[0]] : liveCoords);

    if (liveRoute) map.removeLayer(liveRoute); // Eliminar ruta anterior

    const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];

    if (!marker) {
      marker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(`📍 Lat: ${lat}, Long: ${lon}<br>📅 ${ultimaCoord.fecha} ${ultimaCoord.hora}`)
        .openPopup();
    } else {
      marker
        .setLatLng([lat, lon])
        .setPopupContent(`📍 Lat: ${lat}, Long: ${lon}<br>📅 ${ultimaCoord.fecha} ${ultimaCoord.hora}`)
        .openPopup();
    }

    liveRoute = new L.polyline(rutaPlacement, { color: 'blue', weight: 4 }).addTo(map);

    //const currentZoom = map.getZoom();
    //map.setView([lat, lon], currentZoom);
  }

  obtenerFechaHoraActual()

  fetch('/config')
    .then(response => response.json())
    .then(data => {
      document.getElementById('titulo').textContent = `Mapa MyCoords - ${data.nombre}`;
    })
    .catch(error => console.error('Error al obtener el nombre:', error));

  // FUNCIÓN PARA RECIBIR CON ALGO EN EL CALENDARIO
  function obtenerFechaHoraActual() {
    const ahora = new Date();

    // Obtener la fecha en formato YYYY-MM-DD
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');

    // Formato para el campo datetime-local
    const fechaHoy = `${año}-${mes}-${dia}`;
    const inicioDefecto = `${fechaHoy}T00:00`;

    // Obtener la hora actual en formato HH:MM
    const hora = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const finDefecto = `${fechaHoy}T${hora}:${minutos}`;

    // Asignar valores a los inputs
    document.getElementById('inicio').value = inicioDefecto;
    document.getElementById('fin').value = finDefecto;
  }

  function toggleHistorico() {
    const historicoContainer = document.getElementById('historicoContainer');
    historicoContainer.style.display = historicoContainer.style.display === 'none' ? 'block' : 'none';
  }

})();

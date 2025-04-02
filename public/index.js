(async () => {
  'use-strict';

  const map = L.map('map'); // Vista inicial

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

  const search = new GeoSearch.GeoSearchControl({
    provider: new GeoSearch.OpenStreetMapProvider({
      params: {
        'accept-language': 'es', // render results in Dutch
        addressdetails: 1, // include additional address detail parts
      },
    }),
    style: 'bar',
    searchLabel: 'Introduzca una dirección',
    notFoundMessage: 'No pudimos encontrar la dirección especificada.',
  });

  let marker = null;
  let ruta = null; // Polilínea que representa el recorrido
  let liveRoute = null;
  let coordenadas = []; // Guarda el historial de coordenadas
  let liveCoords = [];
  let currentIntervalId = null;
  let historicoHasSearch = false;

  // Function to create or update a marker
  function updateMarker(lat, lon, fecha, hora) {
    const popupContent = `📍 Lat: ${lat}, Long: ${lon}<br>📅 ${fecha} ${hora}`;

    if (!marker) marker = L.marker([lat, lon]).addTo(map).bindPopup(popupContent).openPopup();
    else marker.setLatLng([lat, lon]).setPopupContent(popupContent).openPopup();
  }

  const messageEl = document.getElementById('message');

  // Función para resaltar el botón activo y cambiar a rojo cuando es Tiempo Real o Histórico
  function resaltarBotonActivo(btn) {
    // Quitar la clase active y active-red de todos los botones
    const botones = document.querySelectorAll('button');
    botones.forEach(b => {
      if (btn.textContent === 'Histórico') {
        historicoHasSearch = document.getElementById('historico-controls').classList.contains('hidden') ? false : true;
      } else {
        map.removeControl(search);
        historicoHasSearch = false;
      }
      b.classList.remove('active', 'active-red');
    });

    // Agregar la clase active y active-red solo a Tiempo Real o Histórico
    btn.classList.add('active');
    if (btn.id === 'tiempo-real-btn' || btn.id === 'historico-btn') {
      btn.classList.add('active-red');
    }
  }

  async function obtenerUltimaCoordenada() {
    try {
      const response = await fetch('/ultima-coordenada');
      const data = await response.json();

      if (!data || data.error) return error;
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

      if (!data.length) return;
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

  const buscarBtn = document.getElementById('tiempo-real-btn');
  const tiempoRealBtn = document.getElementById('tiempo-real-btn');
  const historicoBtn = document.getElementById('historico-btn');
  const reiniciarBtn = document.getElementById('reiniciar-btn');
  const switchHistoricoBtn = document.getElementById('switch-historico-btn');
  const inicioInput = document.getElementById('inicio');
  const finInput = document.getElementById('fin');
  const historicoControlsInput = document.getElementById('historico-controls');

  tiempoRealBtn.addEventListener('click', async () => {
    resaltarBotonActivo(tiempoRealBtn); // Resalta el botón de Tiempo Real en rojo
    await iniciarTiempoReal(null, 'RUNNING FROM CLICK');
  });
  
  historicoBtn.addEventListener('click', async () => {
    resaltarBotonActivo(historicoBtn); // Resalta el botón de Histórico en rojo
    await iniciarTiempoReal(null, 'RUNNING FROM CLICK');
  });
  

  function formatearFecha(fromServer, fecha, hora) {
    return fromServer ? fecha.replace('T00:00:00.000Z', ' ' + hora) : fecha.replace('T', ' ').replace('Z', '');
  }

  function reiniciarRuta() {
    console.log('🔄 Reiniciando recorrido...');
    if (ruta) map.removeLayer(ruta); // Eliminar la ruta del mapa
    if (liveRoute) map.removeLayer(liveRoute);
    coordenadas = []; // Reiniciar historial de coordenadas
    liveCoords = [];
  }

  // TIEMPO REAL
  async function iniciarTiempoReal() {
    reiniciarRuta();
    historicoControlsInput.classList.add('hidden');
    if (currentIntervalId) clearInterval(currentIntervalId);

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

    updateMarker(lat, lon, ultimaCoord.fecha, ultimaCoord.hora)

    ruta = new L.polyline(rutaPlacement, { color: 'red', weight: 4 }).addTo(map);
    map.fitBounds(ruta.getBounds());

    currentIntervalId = setInterval(actualizarMapa, 5000);
  }

  await iniciarTiempoReal(null, 'RUNNING FROM INIT')

  async function actualizarMapa() {
    const ultimaCoord = await obtenerUltimaCoordenada();
    liveCoords.push([ultimaCoord.latitud, ultimaCoord.longitud]);

    const rutaPlacement = await solicitarRuta(liveCoords.length <= 1 ? [liveCoords[0], liveCoords[0]] : liveCoords);

    if (liveRoute) map.removeLayer(liveRoute); // Eliminar ruta anterior

    const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];

    // updateMarker(lat, lon, ultimaCoord.fecha, ultimaCoord.hora)

    liveRoute = new L.polyline(rutaPlacement, { color: 'blue', weight: 4 }).addTo(map);

    // const currentZoom = map.getZoom();
    // map.setView([lat, lon], 20);
  }

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
    const historicoContainer = document.getElementById('historico-controls');
    historicoContainer.classList.toggle('hidden');
  }

  // EVENT LISTENERS //
  switchHistoricoBtn.addEventListener('click', () => {
    resaltarBotonActivo(switchHistoricoBtn); // Resalta el botón de Historial
    toggleHistorico();
    if (!historicoHasSearch) {
      map.addControl(search);
    }
  });

  reiniciarBtn.addEventListener('click', reiniciarRuta);

  historicoBtn.addEventListener('click', async () => {
    if (currentIntervalId) clearInterval(currentIntervalId)
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

    updateMarker(lat, lon, ultimaCoord.fecha, ultimaCoord.hora)

    ruta = new L.polyline(rutaPlacement, { color: 'red', weight: 4 }).addTo(map);
    liveRoute = null;

    map.fitBounds(ruta.getBounds());
  });

  tiempoRealBtn.addEventListener('click', async () => {
    resaltarBotonActivo(tiempoRealBtn); // Resalta el botón de Tiempo Real
    await iniciarTiempoReal(null, 'RUNNING FROM CLICK')
  });

  // RUNTIME

  fetch('/config')
    .then(response => response.json())
    .then(data => {
      document.getElementById('titulo').textContent = `Mapa MyCoords - ${data.nombre}`;
    })
    .catch(error => console.error('Error al obtener el nombre:', error));
  obtenerFechaHoraActual()
})();
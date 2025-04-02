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
  let ruta = null; // Polilínea que representa el recorrido histórico
  let liveRoute = null; // Polilínea que representa el recorrido en tiempo real
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
    // Quitar la clase active de todos los botones
    const botones = document.querySelectorAll('#tiempo-real-btn, #historico-btn, #switch-historico-btn');
    botones.forEach(b => {
      if (btn.textContent === 'Histórico') {
        historicoHasSearch = document.getElementById('historico-controls').classList.contains('hidden') ? false : true;
      } else {
        map.removeControl(search);
        historicoHasSearch = false;
      }
      b.classList.remove('active'); // Solo eliminamos active
    });
  
    // Agregar la clase active al botón clickeado
    btn.classList.add('active');
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

  function formatearFecha(fromServer, fecha, hora) {
    return fromServer ? fecha.replace('T00:00:00.000Z', ' ' + hora) : fecha.replace('T', ' ').replace('Z', '');
  }

  function reiniciarRuta() {
    console.log('🔄 Reiniciando recorrido...');
    // Solo eliminamos la ruta histórica, mantenemos la ruta en tiempo real
    if (ruta) map.removeLayer(ruta); 
    coordenadas = []; // Reiniciar historial de coordenadas históricos
    // NO reiniciamos liveCoords para mantener el historial de la ruta en tiempo real
  }

  // TIEMPO REAL
  async function iniciarTiempoReal() {
    historicoControlsInput.classList.add('hidden');
    if (currentIntervalId) clearInterval(currentIntervalId);

    const ultimaCoord = await obtenerUltimaCoordenada();

    const currentDate = new Date(formatearFecha(true, ultimaCoord.fecha, ultimaCoord.hora));
    
    // Si no existe liveRoute, la creamos por primera vez
    if (!liveRoute) {
      liveCoords = [[ultimaCoord.latitud, ultimaCoord.longitud]];
      
      // Necesitamos al menos dos puntos para crear una ruta
      const puntos = [[ultimaCoord.latitud, ultimaCoord.longitud], [ultimaCoord.latitud, ultimaCoord.longitud]];
      const rutaPlacement = await solicitarRuta(puntos);
      
      if (rutaPlacement) {
        liveRoute = new L.polyline(rutaPlacement, { color: 'blue', weight: 4 }).addTo(map);
      }
    } else {
      // Si ya existe liveRoute, la hacemos visible
      liveRoute.setStyle({ opacity: 1 });
    }

    const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];
    updateMarker(lat, lon, ultimaCoord.fecha, ultimaCoord.hora);

    map.setView([lat, lon], map.getZoom() || 15);

    currentIntervalId = setInterval(actualizarMapa, 5000);
  }

  await iniciarTiempoReal(null, 'RUNNING FROM INIT')

  async function actualizarMapa() {
    const ultimaCoord = await obtenerUltimaCoordenada();
    
    // Añadimos la nueva coordenada al arreglo de coordenadas en tiempo real
    liveCoords.push([ultimaCoord.latitud, ultimaCoord.longitud]);

    const rutaPlacement = await solicitarRuta(liveCoords.length <= 1 ? [liveCoords[0], liveCoords[0]] : liveCoords);

    if (rutaPlacement) {
      if (liveRoute) {
        // Actualizamos la ruta existente con las nuevas coordenadas
        liveRoute.setLatLngs(rutaPlacement);
      } else {
        // Creamos una nueva ruta si no existe
        liveRoute = new L.polyline(rutaPlacement, { color: 'blue', weight: 4 }).addTo(map);
      }
    }

    const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];
    updateMarker(lat, lon, ultimaCoord.fecha, ultimaCoord.hora);
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

  reiniciarBtn.addEventListener('click', () => {
    reiniciarRuta();
    // También eliminamos la ruta en tiempo real si se presiona el botón de reiniciar
    if (liveRoute) {
      map.removeLayer(liveRoute);
      liveRoute = null;
      liveCoords = [];
    }
  });

  historicoBtn.addEventListener('click', async () => {
    resaltarBotonActivo(historicoBtn);
    
    if (currentIntervalId) clearInterval(currentIntervalId);
    
    // Si hay una ruta en tiempo real, la ocultamos pero NO la eliminamos
    if (liveRoute) { 
      liveRoute.setStyle({ opacity: 0.3 }); // Hacemos la ruta semitransparente en lugar de ocultarla
    }

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

    // Eliminamos solo la ruta histórica anterior
    if (ruta) map.removeLayer(ruta);

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

    if (rutaPlacement) {
      ruta = new L.polyline(rutaPlacement, { color: 'red', weight: 4 }).addTo(map);
      map.fitBounds(ruta.getBounds());
    }
  });

  tiempoRealBtn.addEventListener('click', async () => {
    resaltarBotonActivo(tiempoRealBtn); // Resalta el botón de Tiempo Real
    messageEl.classList.add('hidden'); // ✅ Oculta el mensaje al cambiar a Tiempo Real
    messageEl.classList.remove('error');
    messageEl.textContent = '';

    // Ocultamos la ruta histórica pero no la eliminamos
    if (ruta) {
      ruta.setStyle({ opacity: 0.3 }); // Hacemos la ruta histórica semitransparente
    }
    
    // Activamos la ruta en tiempo real
    await iniciarTiempoReal(null, 'RUNNING FROM CLICK');
  });

  // RUNTIME
  fetch('/config')
    .then(response => response.json())
    .then(data => {
      document.getElementById('titulo').textContent = `Mapa MyCoords - ${data.nombre}`;
    })
    .catch(error => console.error('Error al obtener el nombre:', error));
  obtenerFechaHoraActual();
})();
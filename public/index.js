  (async () => {
    'use-strict';

    const map = L.map('map'); // Vista inicial

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    let marker = null;
    let ruta = null; // Polilínea que representa el recorrido histórico
    let liveRoute = null; // Polilínea que representa el recorrido en tiempo real
    let coordenadas = []; // Guarda el historial de coordenadas
    let liveCoords = [];
    let currentIntervalId = null;
    let historicoHasSearch = false;
    let searchResults = []; // Para almacenar resultados de búsqueda por ubicación
    let searchResultsMarkers = []; // Para almacenar marcadores de resultados

    // Crear o asegurarse que existe el elemento de resultados de búsqueda
    const createResultsPanel = () => {
      let resultsPanel = document.getElementById('search-results-panel');

      if (!resultsPanel) {
        resultsPanel = document.createElement('div');
        resultsPanel.id = 'search-results-panel';
        resultsPanel.className = 'search-results-panel hidden';
        resultsPanel.innerHTML = `
          <div class="results-header">
            <h3>Resultados de búsqueda</h3>
            <button id="close-results">×</button>
          </div>
          <div id="results-content"></div>
        `;
        document.body.appendChild(resultsPanel);

        // Agregar evento para cerrar el panel
        document.getElementById('close-results').addEventListener('click', () => {
          resultsPanel.classList.add('hidden');
          // Eliminar marcadores de resultados previos
          searchResultsMarkers.forEach(m => map.removeLayer(m));
          searchResultsMarkers = [];
        });
      }

      return resultsPanel;
    };

    // Función para mostrar resultados de búsqueda
    const mostrarResultadosBusqueda = (resultados) => {
      const resultsPanel = createResultsPanel();
      const resultsContent = document.getElementById('results-content');

      // Eliminar marcadores anteriores
      searchResultsMarkers.forEach(m => map.removeLayer(m));
      searchResultsMarkers = [];

      if (!resultados || resultados.length === 0) {
        resultsContent.innerHTML = '<p>No se encontraron registros del vehículo cerca de esta ubicación.</p>';
        resultsPanel.classList.remove('hidden');
        return;
      }

      // Formato para los resultados
      let html = `<p>Se encontraron ${resultados.length} registros del vehículo cerca de esta ubicación:</p>`;
      html += '<ul class="results-list">';

      resultados.forEach((result, index) => {
        const distanciaFormateada = result.distancia_km.toFixed(2);
        html += `
          <li class="result-item" data-index="${index}">
            <strong>📅 Fecha:</strong> ${result.fecha} ${result.hora}<br>
            <strong>📍 Distancia:</strong> ${distanciaFormateada} km
          </li>
        `;

        // Crear marcador para cada resultado
        const resultMarker = L.marker([result.latitud, result.longitud], {
          icon: L.divIcon({
            className: 'result-marker',
            html: `<div class="marker-number">${index + 1}</div>`,
            iconSize: [25, 25],
          })
        }).addTo(map);

        resultMarker.bindPopup(`
          <strong>Resultado #${index + 1}</strong><br>
          📅 Fecha: ${result.fecha} ${result.hora}<br>
          📍 Coordenadas: ${result.latitud}, ${result.longitud}<br>
          🔍 Distancia: ${distanciaFormateada} km
        `);

        searchResultsMarkers.push(resultMarker);
      });

      html += '</ul>';
      resultsContent.innerHTML = html;

      // Agregar eventos para los items de la lista
      document.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', () => {
          const index = parseInt(item.dataset.index);
          const result = resultados[index];

          // Centrar mapa en este resultado
          map.setView([result.latitud, result.longitud], 16);

          // Abrir popup del marcador
          searchResultsMarkers[index].openPopup();
        });
      });

      // Si hay resultados, ajustar el mapa para mostrarlos todos
      if (searchResultsMarkers.length > 0) {
        const group = new L.featureGroup(searchResultsMarkers);
        map.fitBounds(group.getBounds().pad(0.2));
      }

      resultsPanel.classList.remove('hidden');
    };

    // Función para buscar si el vehículo estuvo cerca de una ubicación
    async function buscarUbicacion(lat, lon, radio = 0.5) {
      try {
        const response = await fetch(`/buscar-ubicacion?lat=${lat}&lon=${lon}&radio=${radio}`);
        const data = await response.json();

        if (response.ok) {
          searchResults = data;
          mostrarResultadosBusqueda(data);
        } else {
          console.error('Error al buscar ubicación:', data.error);
          alert('Error al buscar ubicación');
        }
      } catch (error) {
        console.error('Error en la petición de búsqueda:', error);
        alert('Error al comunicarse con el servidor');
      }
    }

    // Función para guardar las coordenadas en localStorage
    function saveLiveCoords() {
      try {
        localStorage.setItem('liveCoords', JSON.stringify(liveCoords));
        localStorage.setItem('lastSaveTime', new Date().toISOString());
      } catch (e) {
        console.error('Error al guardar coordenadas:', e);
      }
    }

    // Función para cargar las coordenadas desde localStorage
    function loadLiveCoords() {
      try {
        const savedCoords = localStorage.getItem('liveCoords');
        const lastSaveTime = localStorage.getItem('lastSaveTime');

        if (savedCoords) {
          // Verificamos si los datos guardados son recientes (menos de 24 horas)
          const now = new Date();
          const saveTime = new Date(lastSaveTime || 0);
          const hoursDiff = (now - saveTime) / (1000 * 60 * 60);

          // Solo cargamos si los datos son recientes
          if (hoursDiff < 24) {
            return JSON.parse(savedCoords);
          }
        }
        return null;
      } catch (e) {
        console.error('Error al cargar coordenadas:', e);
        return null;
      }
    }

    let lastPopupContent = "";
let infoVisible = true; // Por defecto, visible al cargar la página

function updateMarker(lat, lon, fecha, hora) {
  lastPopupContent = `📍 Lat: ${lat}, Long: ${lon}<br>📅 ${fecha} ${hora}`;

  if (!marker) {
    marker = L.marker([lat, lon]).addTo(map);
  } else {
    marker.setLatLng([lat, lon]);
  }

  // Mostrar automáticamente al cargar
  const infoDiv = document.getElementById("tiempoRealInfo");
  if (infoVisible) {
    infoDiv.innerHTML = `<strong>Última ubicación:</strong><br>${lastPopupContent}`;
    infoDiv.style.display = "block";
  }

  // Asegurarse de que no haya popups en el mapa
  if (marker.getPopup()) marker.closePopup();
}

document.getElementById("btnTiempoReal").addEventListener("click", () => {
  const infoDiv = document.getElementById("tiempoRealInfo");

  infoVisible = !infoVisible;

  if (infoVisible) {
    infoDiv.innerHTML = `<strong>Última ubicación:</strong><br>${lastPopupContent}`;
    infoDiv.style.display = "block";
  } else {
    infoDiv.innerHTML = "";
    infoDiv.style.display = "none";
  }
});


    const messageEl = document.getElementById('message');

    // Función para resaltar el botón activo y cambiar a rojo cuando es Tiempo Real o Histórico
    function resaltarBotonActivo(btn) {
      // Quitar la clase active de todos los botones
      const botones = document.querySelectorAll('#tiempo-real-btn, #historico-btn, #switch-historico-btn');
      botones.forEach(b => {
        if (btn.textContent === 'Histórico') {
          historicoHasSearch = document.getElementById('historico-controls').classList.contains('hidden') ? false : true;
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

      // Opción para reiniciar también el seguimiento en tiempo real
      if (liveRoute) {
        map.removeLayer(liveRoute);
        liveRoute = null;
        liveCoords = [];
        // Eliminamos también los datos guardados
        localStorage.removeItem('liveCoords');
        localStorage.removeItem('lastSaveTime');
      }

      // Eliminamos los marcadores de resultados de búsqueda
      searchResultsMarkers.forEach(m => map.removeLayer(m));
      searchResultsMarkers = [];

      // Ocultamos el panel de resultados
      const resultsPanel = document.getElementById('search-results-panel');
      if (resultsPanel) resultsPanel.classList.add('hidden');
    }

    // TIEMPO REAL
    async function iniciarTiempoReal() {
      historicoControlsInput.classList.add('hidden');
      if (currentIntervalId) clearInterval(currentIntervalId);

      const ultimaCoord = await obtenerUltimaCoordenada();

      // Intentamos cargar las coordenadas guardadas
      const savedCoords = loadLiveCoords();

      if (savedCoords && savedCoords.length > 0) {
        console.log('🔄 Restaurando ruta guardada con ' + savedCoords.length + ' puntos');
        liveCoords = savedCoords;
      } else if (!liveCoords.length) {
        // Si no hay coordenadas guardadas ni coordenadas actuales, inicializamos
        liveCoords = [[ultimaCoord.latitud, ultimaCoord.longitud]];
      }

      // Añadimos la última coordenada obtenida (la actual)
      liveCoords.push([ultimaCoord.latitud, ultimaCoord.longitud]);

      // Dibujamos la ruta con todas las coordenadas (históricas + actuales)
      const rutaPlacement = await solicitarRuta(liveCoords);

      if (rutaPlacement) {
        if (liveRoute) {
          // Actualizamos la ruta existente
          liveRoute.setLatLngs(rutaPlacement);
          liveRoute.setStyle({ opacity: 1 });
        } else {
          // Creamos una nueva ruta
          liveRoute = new L.polyline(rutaPlacement, { color: 'blue', weight: 4 }).addTo(map);
        }
      }

      const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];
      updateMarker(lat, lon, ultimaCoord.fecha, ultimaCoord.hora);

      // Ajustamos el mapa para ver toda la ruta
      if (liveRoute) {
        map.fitBounds(liveRoute.getBounds());
      } else {
        map.setView([lat, lon], map.getZoom() || 15);
      }

      // Guardamos la ruta actual en localStorage
      saveLiveCoords();

      currentIntervalId = setInterval(actualizarMapa, 5000);
    }

    // Iniciamos el modo tiempo real cuando carga la página
    await iniciarTiempoReal();

    async function actualizarMapa() {

      if (!liveRoute) return;
      const ultimaCoord = await obtenerUltimaCoordenada();

      // Añadimos la nueva coordenada al arreglo de coordenadas en tiempo real
      liveCoords.push([ultimaCoord.latitud, ultimaCoord.longitud]);

      const rutaPlacement = await solicitarRuta(liveCoords.length <= 1 ? [liveCoords[0], liveCoords[0]] : liveCoords);

      if (rutaPlacement && liveRoute) {  
        // Actualizamos la ruta existente con las nuevas coordenadas
        liveRoute.setLatLngs(rutaPlacement);
      }

      const [lat, lon] = [ultimaCoord.latitud, ultimaCoord.longitud];
      updateMarker(lat, lon, ultimaCoord.fecha, ultimaCoord.hora);

      // Guardamos la ruta actualizada en localStorage
      saveLiveCoords();
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
    });

    reiniciarBtn.addEventListener('click', reiniciarRuta);

    historicoBtn.addEventListener('click', async () => {
      resaltarBotonActivo(historicoBtn);

      if (currentIntervalId) {
        clearInterval(currentIntervalId);
        currentIntervalId = null;
      }

      // Ocultamos completamente la ruta en tiempo real cuando estamos en modo histórico
      if (liveRoute) { 
        map.removeLayer(liveRoute);
        liveRoute = null;  
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

      // Ocultamos la ruta histórica
      if (ruta) {
        map.removeLayer(ruta);
        ruta = null;
      }

      // Activamos la ruta en tiempo real
      await iniciarTiempoReal();
    });

    // RUNTIME
    fetch('/config')
      .then(response => response.json())
      .then(data => {
        document.getElementById('title').textContent = `MyCoords - ${data.nombre}`;
      })
      .catch(error => console.error('Error al obtener el nombre:', error));
    obtenerFechaHoraActual();

    // NUEVA FUNCIONALIDAD: Manejar búsqueda por ubicación
    // Agregar evento para reaccionar cuando se selecciona una ubicación en la barra de búsqueda
    map.on('geosearch/showlocation', (e) => {
      const { location } = e;
      console.log('Ubicación seleccionada:', location);

      // Buscar si el vehículo estuvo cerca de esta ubicación
      buscarUbicacion(location.y, location.x, 0.5); // 0.5 km de radio por defecto
      });
    
  })();
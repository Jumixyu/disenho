//Variables
let marker = null;
let ruta = null; // Polilínea que representa el recorrido histórico
let liveRoute = null; // Polilínea que representa el recorrido en tiempo real
let coordenadas = []; // Guarda el historial de coordenadas
let liveCoords = [];
let currentIntervalId = null;
let historicoHasSearch = false;
let realtimeHasSearch = false;
let searchResults = []; // Para almacenar resultados de búsqueda por ubicación
let searchResultsMarkers = []; // Para almacenar marcadores de resultados
let searchCircle = null; // para mantener referencia al círculo
let lastSearchLatLng = null;
let lastSearchRadius = null;
let marcadorSeleccionado;
let lastPopupContent = "";
let currentZoom = 15;
let vehiculoreal;
let resultadosGlobales = []; // se llena desde crearPanelResultados

const tiempoRealBtn = document.getElementById('tiempo-real-btn');
const tiemporealControls = document.getElementById('tiempo-real-controls');
const historicoBtn = document.getElementById('historico-btn');
const reiniciarBtn = document.getElementById('reiniciar-btn');
const switchHistoricoBtn = document.getElementById('switch-historico-btn');
const inicioInput = document.getElementById('inicio');
const finInput = document.getElementById('fin');
const historicoControlsInput = document.getElementById('historico-controls');
const buscadorBtn = document.getElementById('buscador-btn');
const busquedaBtn =document.getElementById('busqueda-btn');
const buscadorControls = document.getElementById('buscador-controls');
const radioSlider = document.getElementById('radioSlider');
const radioValor = document.getElementById('radioValor');
const infoBtn = document.getElementById('info-btn');
const modal = document.getElementById('infoModal');
const closeBtn = document.getElementById('closeModal');
const infoDiv = document.getElementById("tiempoRealInfo");
const checkbox = document.getElementById("toggleUbicacion");
const messageEl = document.getElementById('message');
const slidermap = document.getElementById('slider-map');

// Vista inicial del mapa

const map = L.map('map');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

// NOMBRES EN EL TITLE

fetch('/config')
.then(response => response.json())
.then(data => {
  document.getElementById('title').textContent = `MyCoords - ${data.nombre}`;
})
.catch(error => console.error('Error al obtener el nombre:', error));
obtenerFechaHoraActual();


//--------------------------------COORDS ULTIMA UBICACION POPUP-------------------------------------------------------
function updateMarker(lat, lon, fecha, hora, rpm, vehiculo) {

  vehiculoreal= vehiculo+1

  lastPopupContent = `📍 Lat: ${lat}, Long: ${lon}<br>📅 ${fecha} ${hora} <br>🚗 RPM: ${rpm},    Vehiculo: ${vehiculoreal}`;

  if (!marker) {
    marker = L.marker([lat, lon]).addTo(map);
  } else {
    marker.setLatLng([lat, lon]);
  }

  // Mostrar contenido si la casilla está activada
  if (checkbox.checked) {
    infoDiv.innerHTML = `<strong>Última ubicación:</strong><br>${lastPopupContent}`;
    infoDiv.style.display = "block";
  }

  // Asegúrate de que no salga popup en el mapa
  if (marker.getPopup()) marker.closePopup();
}

//------------------------------------------BOTONES-------------------------------------------------------------------------

// Función para resaltar el botón activo y cambiar a rojo cuando es Tiempo Real o Histórico
function resaltarBotonActivo(btn) {
  // Quitar la clase active de todos los botones
  const botones = document.querySelectorAll('#tiempo-real-btn, #switch-historico-btn, #buscador-btn');
  botones.forEach(b => {
    if (btn.textContent === 'Histórico') {
      historicoHasSearch = document.getElementById('historico-controls').classList.contains('hidden') ? false : true;
    }else if (btn.textContent === 'Tiempo real'){
      console.log("Tiempo real");
      realtimeHasSearch = document.getElementById('tiempo-real-controls').classList.contains('hidden') ? false : true;
    }else if (btn.textContent === 'Buscador'){
      console.log("Buscador");
      realtimeHasSearch = document.getElementById('buscador-controls').classList.contains('hidden') ? false : true;
    }
    b.classList.remove('active'); // Solo eliminamos active
  });
  // Agregar la clase active al botón clickeado
  btn.classList.add('active');
}

function resaltarBotonActuador(btn) {
  // Quitar la clase active de todos los botones
  const botones = document.querySelectorAll('#historico-btn');
  botones.forEach(b => {
    b.classList.remove('active'); // Solo eliminamos active
  });
  // Agregar la clase active al botón clickeado
  btn.classList.add('active');
}

// Obtener fecha y hora actual

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

  document.getElementById('inicio').value = inicioDefecto;
  document.getElementById('fin').value = finDefecto;
  document.getElementById('inicioSearch').value = inicioDefecto;
  document.getElementById('finSearch').value = finDefecto;
}


//CIRCULOS
function mostrarCirculoBuscador() {
  if (lastSearchLatLng && lastSearchRadius) {
    if (searchCircle) {
      map.removeLayer(searchCircle); // Evita duplicados
    }
    searchCircle = L.circle(lastSearchLatLng, {
      color: '#007bff',
      fillColor: '#cce5ff',
      fillOpacity: 0.4,
      radius: lastSearchRadius
    }).addTo(map);
  }
}

function ocultarCirculoBuscador() {
  if (searchCircle) {
    map.removeLayer(searchCircle);
  }
}

// menus desplegables

function toggleHistorico() {
  const historicoContainer = document.getElementById('historico-controls');
  historicoContainer.classList.toggle('hidden');
}

function toggleBuscador() {
  const BuscadorContainer = document.getElementById('buscador-controls');
  BuscadorContainer.classList.toggle('hidden');
}

function toggleTiempoReal() {
  const tiempoRealContainer = document.getElementById('tiempo-real-controls');
  tiempoRealContainer.classList.toggle('hidden');
}

//SELECTOR VEHICULO

function mostrarDatosFiltrados(grupo) {
  console.log("Filtrando por:", grupo);
  // aquí haces tu consulta o filtrado de datos
}

function mostrarTodosLosDatos() {
  console.log("Mostrando todos los datos");
  // aquí muestras todos
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
    console.error('❌ Error al obtener recorrido histórico:', e);
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

// FUNCION PARA PARAR EL REAL TIME CUANDO PASAMOS A HISTORICO Y BUSCADOR
function stopRealTime() {
  // Verificar si existe un intervalo activo
  if (currentIntervalId) {
    console.log("⏹️ Deteniendo actualización en tiempo real...");
    clearInterval(currentIntervalId);
    currentIntervalId = null;
    
    // Ocultar el marcador de tiempo real si existe
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    
    // Ocultar la ruta de tiempo real si existe
    if (liveRoute) {
      map.removeLayer(liveRoute);
      liveRoute = null;
    }
    
    return true;
  } else {
    console.log("ℹ️ No hay actualización en tiempo real activa");
    return false;
  }
}

/// Función para mostrar los resultados de búsqueda solo en el panel lateral
function mostrarResultadosBusqueda(resultados) {
  // Limpiamos marcadores anteriores por si acaso
  searchResultsMarkers.forEach(m => map.removeLayer(m));
  searchResultsMarkers = [];
  
  // No creamos marcadores, solo el panel de resultados
  crearPanelResultados(resultados);
}

// Función para crear el panel de resultados
function crearPanelResultados(resultados) {
  // Verificamos si ya existe el panel
  let resultsPanel = document.getElementById('search-results-panel');
  
  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'search-results-panel';
    resultsPanel.className = 'search-results-panel';
    
    // Creamos el encabezado del panel
    const header = document.createElement('div');
    header.className = 'results-header';
    header.innerHTML = `
      <h3>Resultados de búsqueda (${resultados.length})</h3>
      <button id="close-results">×</button>
    `;
    
    const content = document.createElement('div');
    content.id = 'results-content';
    
    resultsPanel.appendChild(header);
    resultsPanel.appendChild(content);
    document.body.appendChild(resultsPanel);
    
    // Evento para cerrar el panel
    document.getElementById('close-results').addEventListener('click', () => {
      resultsPanel.classList.add('hidden');
    });
  } else {
    // Si ya existe, actualizamos el título y lo mostramos
    resultsPanel.querySelector('h3').textContent = `Resultados (${resultados.length})`;
    resultsPanel.classList.remove('hidden');
    const content = document.getElementById('results-content');
    content.innerHTML = '';
  }
  
  // Crear la lista de resultados
  const resultsList = document.createElement('ul');
  resultsList.className = 'results-list';
  
  resultados.slice().reverse().forEach((resultado, index) => {
    const fecha = resultado.fecha.split('T')[0];
    const item = document.createElement('li');
    const vehiculoresult = resultado.vehiculo;
    item.className = 'result-item';
    item.innerHTML = `
      <strong>#${index + 1}</strong> - ${fecha} ${resultado.hora}<br>
      <small>Latitud: ${resultado.latitud}</small><br>
      <small>Longitud: ${resultado.longitud}</small><br>
      <small>Vehiculo: ${vehiculoresult}</small>
    `;
    
    // Al hacer clic en un resultado, centra el mapa en ese punto y abrir popup
    item.addEventListener('click', () => {
      map.setView([resultado.latitud, resultado.longitud], 18);

////////////////////////////////////////////////////////////////////////////////////////////////////
    // Configurar el slider
    resultadosGlobales = resultados.slice().reverse(); // guardar para el slider
    const slidermap = document.getElementById('slider-map');
    const sliderInput = document.getElementById('velocidad-slider');

    sliderInput.min = 1;
    sliderInput.max = resultadosGlobales.length;
    sliderInput.value = 1;

    slidermap.classList.remove('hidden');

////////////////////////////////////////////////////////////////////////////////////////////////////
      // Eliminar marcador anterior si existe
      if (marcadorSeleccionado) {
        map.removeLayer(marcadorSeleccionado);
      }
      
      // Crear y agregar el nuevo marcador
      marcadorSeleccionado = L.marker([resultado.latitud, resultado.longitud]).addTo(map);
    });
    
    resultsList.appendChild(item);
  });
  
  document.getElementById('results-content').appendChild(resultsList);

}

////////////////////////////////////////////////////////////////////////////////////////////////////
//Manejador del Slider
const sliderInput = document.getElementById('velocidad-slider');

sliderInput.addEventListener('input', () => {
  const index = parseInt(sliderInput.value, 10) - 1;
  const resultado = resultadosGlobales[index];

  if (!resultado) return;

  // Mover el mapa
  map.setView([resultado.latitud, resultado.longitud], 18);

  // Quitar el marcador anterior
  if (marcadorSeleccionado) {
    map.removeLayer(marcadorSeleccionado);
  }

  // Agregar nuevo marcador
  marcadorSeleccionado = L.marker([resultado.latitud, resultado.longitud]).addTo(map);
});

//mostrar valores del panel debajo del slider
const valorVelocidad = document.getElementById('valor-velocidad');

sliderInput.addEventListener('input', () => {
  const index = parseInt(sliderInput.value, 10) - 1;
  const resultado = resultadosGlobales[index];

  if (!resultado) return;

  valorVelocidad.textContent = `#${index + 1} - ${resultado.fecha.split('T')[0]} ${resultado.hora}`;
});

////////////////////////////////////////////////////////////////////////////////////////////////////
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

function solicitarRuta(puntos) {
  if (puntos.length < 2) {
    console.warn('⚠ No hay suficientes coordenadas para trazar ruta.');
    return null;
  }
  
  console.log("📍 Puntos recibidos:", puntos);

  // Primero filtramos las coordenadas inválidas
  let coordenadasValidas = puntos.filter(coord =>
    Array.isArray(coord) &&
    coord.length === 2 &&
    !isNaN(parseFloat(coord[0])) &&
    !isNaN(parseFloat(coord[1]))
  );

  console.log("✅ Coordenadas válidas:", coordenadasValidas);

  // Si no hay suficientes coordenadas válidas, no podemos crear una ruta
  if (coordenadasValidas.length < 2) {
    console.warn('⚠ No hay suficientes coordenadas válidas para trazar ruta.');
    return null;
  }

  // Luego reducimos el número si es necesario
  let coordenadasFiltradas = substractArrayEvenly(coordenadasValidas, 300);

  console.log("🔄 Coordenadas filtradas para API:", coordenadasFiltradas);

  // Asegurar que hay suficientes coordenadas filtradas
  if (coordenadasFiltradas.length < 2) {
    console.warn('⚠ No hay suficientes coordenadas filtradas para trazar ruta.');
    return coordenadasValidas; // Retornamos las válidas directamente si las filtradas son insuficientes
  }

  // Construimos la URL con coordenadas en formato "lon,lat" como espera OSRM
  let coordenadasStr = coordenadasFiltradas
    .map((coord) => `${coord[1]},${coord[0]}`)
    .join(';');
  
  let url = `https://router.project-osrm.org/route/v1/driving/${coordenadasStr}?overview=full&geometries=geojson`;

  // Para desarrollo, retornamos las coordenadas directamente sin llamar a la API
  // Esto evita problemas de CORS y limitaciones de la API   
  console.log("🔄 Retornando coordenadas filtradas sin llamar a API");
  return coordenadasValidas;
}

function formatearFecha(fromServer, fecha, hora) {
  return fromServer ? fecha.replace('T00:00:00.000Z', ' ' + hora) : fecha.replace('T', ' ').replace('Z', '');
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

//-----------------------------------------------------------MAINFUNTION--------------------------------------------


(async () => {
  'use-strict';


  resaltarBotonActivo(tiempoRealBtn);

  // Iniciamos el modo tiempo real cuando carga la página
  await iniciarTiempoReal();

  // TIEMPO REAL
  async function iniciarTiempoReal() {
    historicoControlsInput.classList.add('hidden');
    buscadorControls.classList.add('hidden');
  
    try {
      console.log("⏱️ Iniciando tiempo real...");
    
      if (currentIntervalId) {
        clearInterval(currentIntervalId);
        currentIntervalId = null;
      }
  
      const ultimaCoord = await obtenerUltimaCoordenada();
      if (!ultimaCoord) {
        console.error("❌ No se pudo obtener la última coordenada");
        return;
      }
  
      // Convertimos las coordenadas a números
      const lat = parseFloat(ultimaCoord.latitud);
      const lon = parseFloat(ultimaCoord.longitud);
  
      // Verificamos que sean números válidos
      if (isNaN(lat) || isNaN(lon)) {
        console.error("❌ Coordenadas inválidas:", ultimaCoord);
        return;
      }
  
      // Intentamos cargar las coordenadas guardadas
      const savedCoords = loadLiveCoords();
  
      if (savedCoords && savedCoords.length > 0) {
        console.log('🔄 Restaurando ruta guardada con ' + savedCoords.length + ' puntos');
        liveCoords = savedCoords;
      } else {
        // Si no hay coordenadas guardadas, inicializamos con la coordenada actual
        console.log('🆕 Iniciando nueva ruta con coordenada actual');
        liveCoords = [[lat, lon]];
      }
  
      // Comprobar si la última coordenada ya está en liveCoords para evitar duplicados
      const ultimaEnArray = liveCoords[liveCoords.length - 1];
      if (!ultimaEnArray || ultimaEnArray[0] !== lat || ultimaEnArray[1] !== lon) {
        console.log('➕ Añadiendo última coordenada al array');
        liveCoords.push([lat, lon]);
      }
  
      console.log('📍 Coordenadas actuales:', liveCoords);
  
      // Si hay suficientes coordenadas, dibujamos la ruta
      if (liveCoords.length >= 2) {
        console.log('🗺️ Dibujando ruta con ' + liveCoords.length + ' puntos');
        
        // Solicitar la ruta optimizada (o usar las coordenadas directamente)
        const rutaPlacement = await solicitarRuta(liveCoords);
        
        if (rutaPlacement && rutaPlacement.length >= 2) {
          console.log('✅ Ruta calculada con éxito:', rutaPlacement.length + ' puntos');
          
          if (liveRoute) {
            // Actualizamos la ruta existente
            console.log('🔄 Actualizando ruta existente');
            liveRoute.setLatLngs(rutaPlacement);
            liveRoute.setStyle({ color: 'blue', weight: 4, opacity: 1 });
          } else {
            // Creamos una nueva ruta
            console.log('🆕 Creando nueva ruta');
            liveRoute = new L.polyline(rutaPlacement, { 
              color: 'blue', 
              weight: 4,
              opacity: 1
            }).addTo(map);
          }
          
          // Ajustamos el mapa para ver toda la ruta
          map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
        } else {
          console.warn('⚠ No se pudo calcular la ruta');
        }
      } else {
        console.log('⚠ No hay suficientes coordenadas para dibujar una ruta');
        map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
      }
  
      // Actualizar el marcador con la última coordenada
      const car = ultimaCoord.vehiculo;
      const fechacorregida = ultimaCoord.fecha.split("T")[0];
      updateMarker(lat, lon, fechacorregida, ultimaCoord.hora, ultimaCoord.rpm || 0, car);
      
      // Guardamos la ruta actual en localStorage
      saveLiveCoords();
  
      // Crear un intervalo para actualizar el mapa cada 5 segundos
      currentIntervalId = setInterval(async () => {
        await actualizarMapa();
      }, 5000); // Actualizar cada 5 segundos para dar tiempo a las operaciones
  
      console.log("✅ Intervalo creado:", currentIntervalId);
  
    } catch (e) {
      console.error("❌ Error en iniciarTiempoReal:", e);
    }
  }

  async function obtenerUltimaCoordenada() {
    try {
      const response = await fetch('/ultima-coordenada');
      const data = await response.json();
  
      console.log('Datos recibidos:', data); // 👈 Esto te muestra lo que llega
  
      if (!data || data.error) {
        console.error('Error en datos:', data);
        return null;
      }

      return data;
    } catch (e) {
      console.error('Error en fetch:', e);
      return null;
    }
  }

  async function actualizarMapa() {
    try {
      console.log("⏱️ Actualizando datos en tiempo real...");
      
      // Obtener la última coordenada
      const ultimaCoord = await obtenerUltimaCoordenada();
      
      if (!ultimaCoord) {
        console.warn("⚠️ No se pudo obtener la última coordenada");
        return;
      }
      
      // Convertir a números y verificar validez
      const lat = parseFloat(ultimaCoord.latitud);
      const lon = parseFloat(ultimaCoord.longitud);
      
      if (isNaN(lat) || isNaN(lon)) {
        console.warn("⚠️ Coordenadas inválidas:", ultimaCoord);
        return;
      }
      
      // Verificar si la nueva coordenada es diferente de la última
      const ultimaAlmacenada = liveCoords.length > 0 ? liveCoords[liveCoords.length - 1] : null;
      
      const esNuevaCoordenada = !ultimaAlmacenada || 
        ultimaAlmacenada[0] !== lat || 
        ultimaAlmacenada[1] !== lon;
      
      // Si la coordenada es nueva, actualizamos todo
      if (esNuevaCoordenada) {
        console.log("🆕 Nueva coordenada detectada:", lat, lon);
        
        // Añadimos la nueva coordenada al arreglo
        liveCoords.push([lat, lon]);
        
        console.log("📍 Total de coordenadas:", liveCoords.length);
        
        // Si hay suficientes coordenadas, actualizamos la ruta
        if (liveCoords.length >= 2) {
          const rutaPlacement = await solicitarRuta(liveCoords);
          
          if (rutaPlacement && rutaPlacement.length >= 2) {
            if (liveRoute) {
              console.log("🔄 Actualizando ruta existente");
              liveRoute.setLatLngs(rutaPlacement);
              liveRoute.setStyle({ color: 'blue', weight: 4, opacity: 1 });
            } else {
              console.log("🆕 Creando nueva ruta");
              liveRoute = new L.polyline(rutaPlacement, { 
                color: 'blue', 
                weight: 4,
                opacity: 1 
              }).addTo(map);
            }
            
            // Ajustamos para ver toda la ruta o solo la última posición
            const bounds = liveRoute.getBounds();
            if (bounds.isValid()) {
              map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
            } else {
              map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
            }
          } else {
            console.warn("⚠️ No se pudo calcular la ruta");
            map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
          }
        } else {
          map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
        }
        
        // Actualizar el marcador con la nueva posición
        const car = ultimaCoord.vehiculo;
        const fechaCorrregida = ultimaCoord.fecha.split("T")[0];
        updateMarker(lat, lon, fechaCorrregida, ultimaCoord.hora, ultimaCoord.rpm || 0, car);
        
        // Guardar la ruta actualizada
        saveLiveCoords();
      } else {
        console.log("ℹ️ Misma coordenada, no se actualiza el mapa");
      }
    } catch (error) {
      console.error("❌ Error en actualizarMapa:", error);
    }
  }
  

  // ----------------------------------------------- EVENT LISTENERS --------------------------------------------

  switchHistoricoBtn.addEventListener('click', () => {
    // Detener tiempo real
    stopRealTime();

    slidermap.classList.add('hidden')
    buscadorControls.classList.add('hidden');
    tiemporealControls.classList.add('hidden');
    resaltarBotonActivo(switchHistoricoBtn); // Resalta el botón de Historial
    toggleHistorico();
    obtenerFechaHoraActual();        // ✅ Llenar fechas por defecto

    ocultarCirculoBuscador(); // <- Ocultar círculo
  });

  buscadorBtn.addEventListener('click', () => {
    // Detener tiempo real
    stopRealTime();

    slidermap.classList.remove('hidden');
    tiemporealControls.classList.add('hidden');
    historicoControlsInput.classList.add('hidden');
    resaltarBotonActivo(buscadorBtn); // ✅ Resalta el botón de Buscador
    toggleBuscador();                // ✅ Muestra el panel de fechas
    obtenerFechaHoraActual();        // ✅ Llenar fechas por defecto

    mostrarCirculoBuscador(); // <- Mostrar círculo si hay uno guardado

    // Ocultamos la ruta histórica
    if (ruta) {
      map.removeLayer(ruta);
      ruta = null;
    }
  });

  radioSlider.addEventListener('input', () => {
    radioValor.textContent = radioSlider.value;
  });
  
  reiniciarBtn.addEventListener('click', reiniciarRuta);

  tiempoRealBtn.addEventListener('click', async () => {
    resaltarBotonActivo(tiempoRealBtn); // Resalta el botón de Tiempo Real
    toggleTiempoReal();
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

    slidermap.classList.add('hidden');
    buscadorControls.classList.add('hidden');
    ocultarCirculoBuscador(); // <- Ocultar círculo
  });

  historicoBtn.addEventListener('click', async () => {
    resaltarBotonActuador(historicoBtn);

    // Asegurarse de que tiempo real esté detenido
    stopRealTime();

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

  infoBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById("filtro").addEventListener("change", function () {
    const seleccion = this.value;
  
    switch (seleccion) {
      case "opcion1":
        // Filtra la base de datos para mostrar ciertos datos
        mostrarDatosFiltrados("grupo1");
        break;
      case "opcion2":
        // Filtra para otros
        mostrarDatosFiltrados("grupo2");
        break;
      case "todos":
        // Muestra todo
        mostrarTodosLosDatos();
        break;
    }
  });

  // Opcional: cerrar al hacer clic fuera del contenido
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

    ////////////////////////////////////////////////////////////////// prueba
    const slider = document.getElementById('velocidad-slider');
    const sliderContainer = document.querySelector('.slider-container');
  
    L.DomEvent.disableClickPropagation(sliderContainer);
    L.DomEvent.disableScrollPropagation(sliderContainer);
    //////////////////////////////////////////////////////////////////  
  //--------------------------------------------------- CIRCULO ----------------------------------------------------

  map.on('click', async (e) => {
    // Solo activar si el modo Buscador está visible
    if (buscadorControls.classList.contains('hidden')) return;
  
      const { lat, lng } = e.latlng;
      
      // Guarda latlng y radio
      lastSearchLatLng = e.latlng;
      lastSearchRadius = parseInt(radioSlider.value, 10);
    
    // Elimina círculo anterior si existe
    if (searchCircle) {
      map.removeLayer(searchCircle);
    }
  
    // Crear nuevo círculo
    searchCircle = L.circle([lat, lng], {
      color: '#007bff',
      fillColor: '#cce5ff',
      fillOpacity: 0.4,
      radius: lastSearchRadius
    }).addTo(map);
  });
  

  // -------------------------------- FUNCION PARA BUSCAR COORDENADAS DENTRO DEL CIRCULO -----------------------------------

  // Buscar ubicaciones en el área del círculo
  document.getElementById('busqueda-btn').addEventListener('click', async () => {
    if (!lastSearchLatLng) {
      messageEl.classList.remove('hidden');
      messageEl.classList.add('error');
      messageEl.textContent = 'Primero haz clic en el mapa para definir un área de búsqueda';
      return;
    }
    
    const inicioSearch = document.getElementById('inicioSearch').value;
    const finSearch = document.getElementById('finSearch').value;
    
    if (!inicioSearch || !finSearch) {
      messageEl.classList.remove('hidden');
      messageEl.classList.add('error');
      messageEl.textContent = 'Debe llenar los campos de inicio y fin para la búsqueda';
      return;
    }
    
    // Ocultamos mensaje si hay
    messageEl.classList.add('hidden');
    
    // Limpiamos marcadores anteriores
    searchResultsMarkers.forEach(m => map.removeLayer(m));
    searchResultsMarkers = [];
    
    const { lat, lng } = lastSearchLatLng;
    const radio = parseInt(radioSlider.value, 10);
    
    try {
      const response = await fetch(`/buscar-por-area?lat=${lat}&lng=${lng}&radio=${radio}&inicio=${formatearFecha(false, inicioSearch)}&fin=${formatearFecha(false, finSearch)}`);
      searchResults = await response.json();
      
      if (!searchResults || searchResults.length === 0) {
        messageEl.classList.remove('hidden');
        messageEl.textContent = 'No se encontraron ubicaciones en esta área y período de tiempo';
        return;
      }
      
      // Mostrar resultados en el mapa
      mostrarResultadosBusqueda(searchResults);
      
    } catch (error) {
      console.error('Error al buscar por área:', error);
      messageEl.classList.remove('hidden');
      messageEl.classList.add('error');
      messageEl.textContent = 'Error al realizar la búsqueda';
    }
  });

  // ----------------------------------------------------------------------------------------------------------------------- 

  // Evento al cambiar el checkbox de ultima ubicación
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      infoDiv.innerHTML = `<strong>Última ubicación:</strong><br>${lastPopupContent}`;
      infoDiv.style.display = "block";
    } else {
      infoDiv.innerHTML = "";
      infoDiv.style.display = "none";
    }
  });

  tiempoRealBtn.click();
})();
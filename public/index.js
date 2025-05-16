//----------------------------- VARIABLES ----------------------------------------

let markers = {
  0: null,  // Vehiculo 1 marker 
  1: null   // Vehiculo 2 marker 
};
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

let vehiculoFiltro = "todos"; // Por defecto muestra ambos vehículos
let searchRoutePolylines = {
  0: null, // Vehicle 1 polyline (blue)
  1: null  // Vehicle 2 polyline (green)
};

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

// --------------------- FUCNIONES PARA FILTRAR VEHICULOS Y DIBUJAR LINEAS -------------------------------------

function filtrarCoordenadasPorVehiculo(coordsData) {
  // Si mostramos ambos vehículos, devolvemos todas las coordenadas
  if (vehiculoFiltro === "todos") {
    return coordsData;
  }
  
  // Determinamos el valor numérico del vehículo a filtrar (0 para vehículo 1, 1 para vehículo 2)
  const vehiculoNumero = vehiculoFiltro === "vehiculo1" ? 0 : 1;
  
  // Filtramos las coordenadas que corresponden al vehículo seleccionado
  return coordsData.filter(coord => coord.vehiculo === vehiculoNumero);
}

// Update this function to properly clear all existing routes before drawing new ones
function dibujarRutaFiltrada(coords) {
  // Remove ALL existing polylines first
  map.eachLayer(function(layer) {
    if (layer instanceof L.Polyline && layer !== ruta) {
      map.removeLayer(layer);
    }
  });
  
  // Reset liveRoute
  liveRoute = null;

  // If no coordinates or insufficient, don't proceed
  if (!coords || coords.length < 2) {
    console.warn('⚠ No hay suficientes coordenadas para trazar ruta.');
    return;
  }
  
  // If showing both vehicles
  if (vehiculoFiltro === "todos") {
    // Separamos las coordenadas por vehículo
    const coordsVehiculo1 = coords.filter(coord => coord.vehiculo === 0);
    const coordsVehiculo2 = coords.filter(coord => coord.vehiculo === 1);
    
    // Draw route for vehicle 1 if enough coordinates
    if (coordsVehiculo1.length >= 2) {
      const rutaVehiculo1 = coordsVehiculo1.map(coord => [parseFloat(coord.latitud), parseFloat(coord.longitud)]);
      const rutaPlacement1 = solicitarRuta(rutaVehiculo1);
      
      if (rutaPlacement1 && rutaPlacement1.length >= 2) {
        new L.polyline(rutaPlacement1, { 
          color: 'blue', 
          weight: 4, 
          opacity: 1 
        }).addTo(map);
      }
    }
    
    // Draw route for vehicle 2 if enough coordinates
    if (coordsVehiculo2.length >= 2) {
      const rutaVehiculo2 = coordsVehiculo2.map(coord => [parseFloat(coord.latitud), parseFloat(coord.longitud)]);
      const rutaPlacement2 = solicitarRuta(rutaVehiculo2);
      
      if (rutaPlacement2 && rutaPlacement2.length >= 2) {
        new L.polyline(rutaPlacement2, { 
          color: 'green', 
          weight: 4, 
          opacity: 1 
        }).addTo(map);
      }
    }
  } else {
    // If showing only one vehicle
    const vehiculoNumero = vehiculoFiltro === "vehiculo1" ? 0 : 1;
    const coordsVehiculo = coords.filter(coord => coord.vehiculo === vehiculoNumero);
    
    if (coordsVehiculo.length >= 2) {
      const rutaVehiculo = coordsVehiculo.map(coord => [parseFloat(coord.latitud), parseFloat(coord.longitud)]);
      const rutaPlacement = solicitarRuta(rutaVehiculo);
      
      if (rutaPlacement && rutaPlacement.length >= 2) {
        // Color azul para vehículo 1, verde para vehículo 2
        const color = vehiculoNumero === 0 ? 'blue' : 'green';
        
        liveRoute = new L.polyline(rutaPlacement, { 
          color: color, 
          weight: 4, 
          opacity: 1 
        }).addTo(map);
      }
    }
  }
}


//-------------------------------- RECUADRO ULTIMA UBICACION -------------------------------------------------------
function updateMarker(lat, lon, fecha, hora, rpm, vehiculo) {
  vehiculoreal = vehiculo + 1;

  lastPopupContent = `📍 Lat: ${lat}, Long: ${lon}<br>📅 ${fecha} ${hora} <br>🚗 RPM: ${rpm},    Vehiculo: ${vehiculoreal}`;

  // Create or update the marker for this specific vehicle
  if (!markers[vehiculo]) {
    const iconColor = vehiculo === 0 ? 'blue' : 'green';
    const vehicleIcon = L.divIcon({
      className: 'vehicle-marker',
      html: `<div style="background-color: ${iconColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    
    markers[vehiculo] = L.marker([lat, lon], {icon: vehicleIcon}).addTo(map);
  } else {
    markers[vehiculo].setLatLng([lat, lon]);
  }

  // Show content in info box if checkbox is checked
  if (checkbox.checked) {
    infoDiv.innerHTML = `<strong>Última ubicación:</strong><br>${lastPopupContent}`;
    infoDiv.style.display = "block";
  }

  // No popups
  if (markers[vehiculo].getPopup()) markers[vehiculo].closePopup();
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


// CIRCULOS
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

// SELECTOR VEHICULO

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
async function obtenerRecorridoHistorico(inicio, fin, vehiculo = "todos") {
  if (!inicio || !fin) {
    throw new TypeError('"inicio" y "fin" son parámetros requeridos');
  }

  try {
    const response = await fetch(`/recorrido-historico?inicio=${inicio}&fin=${fin}`);
    const data = await response.json();

    if (!data.length) return;
    
    // Filter data if a specific vehicle is requested
    if (vehiculo !== "todos") {
      const vehiculoNumero = vehiculo === "vehiculo1" ? 0 : 1;
      return data.filter(coord => coord.vehiculo === vehiculoNumero);
    }
    
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
    
    // Ocultar los marcadores de tiempo real si existen
    Object.values(markers).forEach(marker => {
      if (marker && map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    
    // Reset marker references
    markers = { 0: null, 1: null };
    
    // Remove ALL polylines that aren't the historical route (ruta)
    map.eachLayer(function(layer) {
      if (layer instanceof L.Polyline && layer !== ruta) {
        map.removeLayer(layer);
      }
    });
    
    // Reset liveRoute reference
    liveRoute = null;
    
    return true;
  } else {
    console.log("ℹ️ No hay actualización en tiempo real activa");
    return false;
  }
}

function reiniciarRuta() {
  console.log('🔄 Reiniciando recorrido...');

  // Verificar en qué pestaña estamos actualmente
  const estaEnHistorico = switchHistoricoBtn.classList.contains('active');
  const estaEnBuscador = buscadorBtn.classList.contains('active');
  const estaEnTiempoReal = tiempoRealBtn.classList.contains('active');

  // Solo eliminamos la ruta histórica si NO estamos en la pestaña histórico
  if (ruta && !estaEnHistorico) {
    map.removeLayer(ruta);
  } else if (ruta && estaEnHistorico) {
    // Si se esta en historico y hay ruta, solo se reinicia si se presiona el boton de reiniciar
    map.removeLayer(ruta);
    ruta = null;
    coordenadas = [];
  }

  // Eliminar todas las rutas en tiempo real (pueden ser múltiples por vehículo)
  map.eachLayer(function(layer) {
    if (layer instanceof L.Polyline && layer !== ruta) {
      map.removeLayer(layer);
    }
  });
  
  // Clear markers
  Object.values(markers).forEach(marker => {
    if (marker && map.hasLayer(marker)) {
      map.removeLayer(marker);
    }
  });
  markers = { 0: null, 1: null };
  
  liveRoute = null;
  
  // Completely reset liveCoords to prevent redrawing previous paths
  liveCoords = [];
  
  // Eliminamos también los datos guardados
  localStorage.removeItem('liveCoords');
  localStorage.removeItem('lastSaveTime');

  // Eliminamos los marcadores de resultados de búsqueda
  searchResultsMarkers.forEach(m => map.removeLayer(m));
  searchResultsMarkers = [];
  
  // Si se esta en buscador, eliminamos el marcador seleccionado
  if (estaEnBuscador && marcadorSeleccionado) {
    map.removeLayer(marcadorSeleccionado);
    marcadorSeleccionado = null;
  }

  if (searchRoutePolyline) {
    map.removeLayer(searchRoutePolyline);
    searchRoutePolyline = null;
  }

  Object.values(searchRoutePolylines).forEach(polyline => {
    if (polyline && map.hasLayer(polyline)) {
      map.removeLayer(polyline);
    }
  });
  searchRoutePolylines = { 0: null, 1: null };
  
  // Si estamos en tiempo real, necesitamos obtener la última coordenada
  // para iniciar un nuevo trazado desde el punto actual
  if (estaEnTiempoReal) {
    // This will restart tracking from current point only
    obtenerUltimaCoordenada().then(ultimaCoord => {
      if (ultimaCoord) {
        liveCoords = [{
          latitud: ultimaCoord.latitud,
          longitud: ultimaCoord.longitud,
          vehiculo: ultimaCoord.vehiculo,
          fecha: ultimaCoord.fecha,
          hora: ultimaCoord.hora,
          rpm: ultimaCoord.rpm || 0
        }];
        
        // Update the marker for the current position
        const lat = parseFloat(ultimaCoord.latitud);
        const lon = parseFloat(ultimaCoord.longitud);
        const car = ultimaCoord.vehiculo;
        const fechacorregida = ultimaCoord.fecha.split("T")[0];
        
        // Only show marker if it passes the vehicle filter
        if (vehiculoFiltro === "todos" || 
            (vehiculoFiltro === "vehiculo1" && car === 0) || 
            (vehiculoFiltro === "vehiculo2" && car === 1)) {
          updateMarker(lat, lon, fechacorregida, ultimaCoord.hora, ultimaCoord.rpm || 0, car);
        }
      }
    });
  }
  
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

//---------------------------------------------------- MAINFUNTION ---------------------------------------------------

(async () => {
  'use-strict';


  resaltarBotonActivo(tiempoRealBtn);

  // Iniciamos el modo tiempo real cuando carga la página
  await iniciarTiempoReal();

  // ------------------------------------------------- TIEMPO REAL ---------------------------------------------------- 
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
        liveCoords = [{
          latitud: lat,
          longitud: lon,
          vehiculo: ultimaCoord.vehiculo,
          fecha: ultimaCoord.fecha,
          hora: ultimaCoord.hora,
          rpm: ultimaCoord.rpm || 0
        }];
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
        
        // Limpiar rutas previas
        if (liveRoute) {
          map.removeLayer(liveRoute);
          liveRoute = null;
        }
        
        // Dibujar ruta filtrada por vehículo
        dibujarRutaFiltrada(liveCoords);
        
        // Ajustamos el mapa para ver toda la ruta
        map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
      } else {
        console.log('⚠ No hay suficientes coordenadas para dibujar una ruta');
        map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
      }
  
      // Actualizar el marcador con la última coordenada
      const car = ultimaCoord.vehiculo;
      const fechacorregida = ultimaCoord.fecha.split("T")[0];
      
      if (vehiculoFiltro === "todos" || 
        (vehiculoFiltro === "vehiculo1" && car === 0) || 
        (vehiculoFiltro === "vehiculo2" && car === 1)) {
      updateMarker(lat, lon, fechacorregida, ultimaCoord.hora, ultimaCoord.rpm || 0, car);
      }
      
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
      
      // Obtener las coordenadas filtradas según el vehículo seleccionado
      const ultimaCoord = await obtenerUltimaCoordenada();
      
      if (!ultimaCoord) {
        console.warn("⚠️ No se pudo obtener la última coordenada");
        return;
      }
      
      // Si el filtro actual no coincide con el vehículo de la última coordenada y no es "todos",
      // no actualizamos el marcador
      if (vehiculoFiltro !== "todos") {
        const vehiculoNumero = vehiculoFiltro === "vehiculo1" ? 0 : 1;
        if (ultimaCoord.vehiculo !== vehiculoNumero) {
          console.log(`ℹ️ Filtro activo para vehículo ${vehiculoNumero+1}, ignorando actualización para vehículo ${ultimaCoord.vehiculo+1}`);
          return;
        }
      }
      
      // Convertir a números y verificar validez
      const lat = parseFloat(ultimaCoord.latitud);
      const lon = parseFloat(ultimaCoord.longitud);
      
      if (isNaN(lat) || isNaN(lon)) {
        console.warn("⚠️ Coordenadas inválidas:", ultimaCoord);
        return;
      }
      
      // If liveCoords is empty (after reset), just add the current position without drawing route
      if (liveCoords.length === 0) {
        liveCoords.push(ultimaCoord);
        
        // Update the marker with the new position
        const car = ultimaCoord.vehiculo;
        const fechaCorrregida = ultimaCoord.fecha.split("T")[0];
        
        if (vehiculoFiltro === "todos" || 
          (vehiculoFiltro === "vehiculo1" && car === 0) || 
          (vehiculoFiltro === "vehiculo2" && car === 1)) {
          updateMarker(lat, lon, fechaCorrregida, ultimaCoord.hora, ultimaCoord.rpm || 0, car);
        }
        
        return;
      }
      
      // Verificar si la nueva coordenada es diferente de la última
      const ultimaAlmacenada = liveCoords.length > 0 ? liveCoords[liveCoords.length - 1] : null;
      
      const esNuevaCoordenada = !ultimaAlmacenada || 
        ultimaAlmacenada.latitud !== lat || 
        ultimaAlmacenada.longitud !== lon;
      
      // Si la coordenada es nueva, actualizamos todo
      if (esNuevaCoordenada) {
        console.log("🆕 Nueva coordenada detectada:", lat, lon);
        
        // Añadimos la nueva coordenada completa (incluyendo info del vehículo)
        liveCoords.push(ultimaCoord);
        
        console.log("📍 Total de coordenadas:", liveCoords.length);
        
        // If we have at least 2 coordinates, draw the route
        if (liveCoords.length >= 2) {
          // Limpiar rutas previas
          if (liveRoute) {
            map.removeLayer(liveRoute);
            liveRoute = null;
          }
          
          // Dibujar ruta filtrada por vehículo
          dibujarRutaFiltrada(liveCoords);
        }
        
        // Actualizar el marcador con la nueva posición
        const car = ultimaCoord.vehiculo;
        const fechaCorrregida = ultimaCoord.fecha.split("T")[0];
        
        if (vehiculoFiltro === "todos" || 
          (vehiculoFiltro === "vehiculo1" && car === 0) || 
          (vehiculoFiltro === "vehiculo2" && car === 1)) {
          updateMarker(lat, lon, fechaCorrregida, ultimaCoord.hora, ultimaCoord.rpm || 0, car);
        }
        
        // Ajustar vista del mapa
        map.setView([lat, lon], map.getZoom() ?? (currentZoom ?? 15));
        
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

    // Eliminar el marcadorSeleccionado si existe
    if (marcadorSeleccionado) {
      map.removeLayer(marcadorSeleccionado);
    }

    if (searchRoutePolyline) {
    map.removeLayer(searchRoutePolyline);
    searchRoutePolyline = null;
    }
    
    // Si hay una ruta histórica guardada, la volvemos a mostrar
    if (ruta) {
      if (!map.hasLayer(ruta)) {
        map.addLayer(ruta);
        // Si la ruta tiene bounds válidos, ajustamos la vista
        if (ruta.getBounds && ruta.getBounds().isValid()) {
          map.fitBounds(ruta.getBounds());
        }
      }
    }
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
    }
      // Restaurar el marcador seleccionado si existe
    if (marcadorSeleccionado && !map.hasLayer(marcadorSeleccionado)) {
      map.addLayer(marcadorSeleccionado);
      // Si el marcador tiene un popup, lo abrimos nuevamente
      if (marcadorSeleccionado.getPopup()) {
        marcadorSeleccionado.openPopup();
      }
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
    }

    // Eliminar el marcadorSeleccionado si existe
    if (marcadorSeleccionado) {
      map.removeLayer(marcadorSeleccionado);
    }

    if (searchRoutePolyline) {
    map.removeLayer(searchRoutePolyline);
    searchRoutePolyline = null;
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
    
    // Get the selected vehicle filter
    const filtroHistorico = document.getElementById('filtroHistorico').value;
  
    const historico = await obtenerRecorridoHistorico(
      formatearFecha(false, inicioInput.value),
      formatearFecha(false, finInput.value),
      filtroHistorico // Pass the vehicle filter to the function
    );
  
    if (!historico || historico.length === 0) {
      messageEl.classList.remove('hidden');
      messageEl.classList.add('error');
      messageEl.textContent = 'No hay datos para este rango';
      return;
    }
  
    // Eliminar el marcadorSeleccionado si existe
    if (marcadorSeleccionado) {
      map.removeLayer(marcadorSeleccionado);
      marcadorSeleccionado = null;
    }
  
    const rutaCoords = historico.map((coord) => [parseFloat(coord.latitud), parseFloat(coord.longitud)]);
    const rutaPlacement = await solicitarRuta(rutaCoords);
  
    if (rutaPlacement) {
      // Si ya teníamos una ruta, la removemos primero
      if (ruta) {
        map.removeLayer(ruta);
      }
      
      // Color selection based on vehicle filter
      let color = 'red'; // Default for "todos"
      if (filtroHistorico === "vehiculo1") {
        color = 'blue';
      } else if (filtroHistorico === "vehiculo2") {
        color = 'green';
      }
      
      // Creamos la nueva ruta
      ruta = new L.polyline(rutaPlacement, { color: color, weight: 4 }).addTo(map);
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
    vehiculoFiltro = this.value;
    
    // Update marker visibility based on the selected filter
    if (markers[0]) {
      if (vehiculoFiltro === "todos" || vehiculoFiltro === "vehiculo1") {
        if (!map.hasLayer(markers[0])) map.addLayer(markers[0]);
      } else {
        if (map.hasLayer(markers[0])) map.removeLayer(markers[0]);
      }
    }
    
    if (markers[1]) {
      if (vehiculoFiltro === "todos" || vehiculoFiltro === "vehiculo2") {
        if (!map.hasLayer(markers[1])) map.addLayer(markers[1]);
      } else {
        if (map.hasLayer(markers[1])) map.removeLayer(markers[1]);
      }
    }
    
    // Si estamos en tiempo real, actualizamos la vista inmediatamente
    if (currentIntervalId) {
      // Clear ALL polylines (not just liveRoute)
      map.eachLayer(function(layer) {
        if (layer instanceof L.Polyline && layer !== ruta) {
          map.removeLayer(layer);
        }
      });
      
      liveRoute = null;
      
      // Redibujamos la ruta con el nuevo filtro
      if (liveCoords && liveCoords.length >= 2) {
        dibujarRutaFiltrada(liveCoords);
      }
    }
  });

  // Opcional: cerrar al hacer clic fuera del contenido
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

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
  // Remove existing polylines
  Object.values(searchRoutePolylines).forEach(polyline => {
    if (polyline && map.hasLayer(polyline)) {
      map.removeLayer(polyline);
    }
  });
  searchRoutePolylines = { 0: null, 1: null };
  
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
  
  // Get the selected vehicle filter
  const filtroBuscador = document.getElementById('filtroBuscador').value;
  
  try {
    const response = await fetch(`/buscar-por-area?lat=${lat}&lng=${lng}&radio=${radio}&inicio=${formatearFecha(false, inicioSearch)}&fin=${formatearFecha(false, finSearch)}`);
    let searchResults = await response.json();
    
    // Filter results based on selected vehicle
    if (filtroBuscador !== "todos") {
      const vehiculoNumero = filtroBuscador === "vehiculo1" ? 0 : 1;
      searchResults = searchResults.filter(resultado => resultado.vehiculo === vehiculoNumero);
    }
    
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

//-------------------------------------- PANEL LATERAL Y SLIDER ----------------------------------------------------------

/// Función para mostrar los resultados de búsqueda solo en el panel lateral
function mostrarResultadosBusqueda(resultados) {
  // Limpiamos marcadores anteriores por si acaso
  searchResultsMarkers.forEach(m => map.removeLayer(m));
  searchResultsMarkers = [];

  // Remove previous search route polylines if they exist
  Object.values(searchRoutePolylines).forEach(polyline => {
    if (polyline && map.hasLayer(polyline)) {
      map.removeLayer(polyline);
    }
  });
  searchRoutePolylines = { 0: null, 1: null };
  
  // Create polylines for the search results if we have results
  if (resultados.length >= 2) {
    // Sort results chronologically to create a proper route
    resultados.sort((a, b) => {
      // Compare dates first
      const dateA = new Date(a.fecha + 'T' + a.hora);
      const dateB = new Date(b.fecha + 'T' + b.hora);
      return dateA - dateB;
    });
    
    // Group coordinates by vehicle
    const vehicleResults = {
      0: [], // Vehicle 1
      1: []  // Vehicle 2
    };
    
    // Separate results by vehicle
    resultados.forEach(result => {
      const vehiculo = result.vehiculo;
      if (vehiculo === 0 || vehiculo === 1) {
        vehicleResults[vehiculo].push(result);
      }
    });
    
    // Process each vehicle's results
    Object.keys(vehicleResults).forEach(vehiculo => {
      const vehicleData = vehicleResults[vehiculo];
      
      // Only create a polyline if there are at least 2 points
      if (vehicleData.length >= 2) {
        // Extract coordinates for the polyline
        const routeCoords = vehicleData.map(coord => [
          parseFloat(coord.latitud), 
          parseFloat(coord.longitud)
        ]);
        
        // Define color based on vehicle
        const color = vehiculo == 0 ? 'blue' : 'green';
        
        // Create polyline with appropriate styling - no dashes for continuous lines
        searchRoutePolylines[vehiculo] = L.polyline(routeCoords, {
          color: color,
          weight: 4,
          opacity: 0.8,
          smoothFactor: 1 // Lower values create smoother line (more segments)
        }).addTo(map);
      }
    });
    
    // Get bounds of all polylines to fit the view
    const bounds = [];
    Object.values(searchRoutePolylines).forEach(polyline => {
      if (polyline && polyline.getBounds().isValid()) {
        bounds.push(polyline.getBounds());
      }
    });
    
    // If we have valid bounds, fit the map to show all routes
    if (bounds.length > 0) {
      // Create a bounds object that includes all our polylines
      const combinedBounds = L.latLngBounds(bounds.map(b => b.getSouthWest()));
      bounds.forEach(b => combinedBounds.extend(b.getNorthEast()));
      
      map.fitBounds(combinedBounds);
    }
  }
  
  // No creamos marcadores, solo el panel de resultados
  crearPanelResultados(resultados);
  
  // Add this to display which filter is active
  const filtroBuscador = document.getElementById('filtroBuscador').value;
  let filterText = "Ambos vehículos";
  if (filtroBuscador === "vehiculo1") filterText = "Vehículo 1";
  if (filtroBuscador === "vehiculo2") filterText = "Vehículo 2";
  
  // You can show the active filter in the results panel title if you want
  const resultsPanel = document.getElementById('search-results-panel');
  if (resultsPanel) {
    resultsPanel.querySelector('h3').textContent = `Resultados (${resultados.length}) - ${filterText}`;
  }
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

    // Configurar el slider
    resultadosGlobales = resultados.slice(); // guardar para el slider
    const slidermap = document.getElementById('slider-map');
    const sliderInput = document.getElementById('velocidad-slider');

    sliderInput.min = 1;
    sliderInput.max = resultadosGlobales.length;
    sliderInput.value = 1;

    slidermap.classList.remove('hidden');
}

// Control del Slider
const sliderInput = document.getElementById('velocidad-slider');

sliderInput.addEventListener('input', () => {
  const index = parseInt(sliderInput.value, 10) - 1;
  const resultado = resultadosGlobales[index];

  if (!resultado) return;

  // Mover el mapa manteniendo el nivel de zoom actual
  const currentZoomLevel = map.getZoom();
  map.setView([resultado.latitud, resultado.longitud], currentZoomLevel);

  // Quitar el marcador anterior
  if (marcadorSeleccionado) {
    map.removeLayer(marcadorSeleccionado);
  }

  // Agregar nuevo marcador
  marcadorSeleccionado = L.marker([resultado.latitud, resultado.longitud]).addTo(map);
  
  // Crear contenido del popup
  const fecha = resultado.fecha.split('T')[0];
  const popupContent = `
    <div style="font-family: Arial, sans-serif; font-size: 12px;">
      <div><strong>Última ubicación:</strong></div>
      <div>📍 Lat: ${resultado.latitud}, Long: ${resultado.longitud}</div>
      <div>📅 ${fecha} ${resultado.hora}</div>
      <div>🚗 Vehiculo: ${resultado.vehiculo + 1}</div>
    </div>
  `;
  
  // Añadir y abrir el popup
  marcadorSeleccionado.bindPopup(popupContent).openPopup();
});

// Actualizar el texto debajo del slider
const valorVelocidad = document.getElementById('valor-velocidad');

sliderInput.addEventListener('input', () => {
  const index = parseInt(sliderInput.value, 10) - 1;
  const resultado = resultadosGlobales[index];

  if (!resultado) return;

  valorVelocidad.textContent = `#${index + 1} - ${resultado.fecha.split('T')[0]} ${resultado.hora}`;
});

const slider = document.getElementById('velocidad-slider');
const sliderContainer = document.querySelector('.slider-container');

L.DomEvent.disableClickPropagation(sliderContainer);
L.DomEvent.disableScrollPropagation(sliderContainer);
// --------------------------------------------------------------------------------------------------------------------- 

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
// Variables globales
let currentFileName = null;
let selectedDirectory = null;
let currentPath = "/QGISserver/qgisprojekt";  // Valor por defecto; idealmente se lee de qgis.json
let qgisServerLink = "";
let proxyServerLink = "";

// EN TU ARCHIVO script_qgis.js

let currentProjectForCache = null; // Guardar el nombre del proyecto actual


// --- NUEVA Función para Eliminar Caché ---
// Asegúrate de que esta función esté definida en tu script_qgis.js

function removeCache(fileName) {
  // Confirmación del usuario
  // Traducido a español para consistencia
  if (!confirm(`¿Estás seguro de que quieres eliminar la configuración de caché y los datos cacheados para ${fileName}? Esta acción no se puede deshacer.`)) {
      return; // Si el usuario cancela, no hacer nada
  }

  console.log(`[removeCache] Solicitando eliminación de caché para: ${fileName}`);
  
  // Opcional: Encontrar y deshabilitar el botón mientras se procesa
  const listItem = document.querySelector(`.box[data-filename="${fileName}"]`);
  const removeButton = listItem ? listItem.querySelector('.is-danger') : null; // Busca el botón rojo
  if (removeButton) {
      removeButton.disabled = true;
      removeButton.classList.add('is-loading'); // Añadir indicador de carga si usas Bulma
  }

  // Llamar al endpoint DELETE del backend
  fetch(`/qgiscache/api/remove-cache/${encodeURIComponent(fileName)}`, { 
      method: 'DELETE' 
  })
  .then(response => {
      if (!response.ok) {
          // Si la respuesta no es OK, intentar leer el mensaje de error JSON del backend
          return response.json().then(err => { 
              // Crear un error con el mensaje del backend o un mensaje genérico
              throw new Error(err.message || `Error ${response.status} al eliminar caché.`); 
          });
      }
      // Si la respuesta es OK, parsear el JSON (que debería contener un mensaje de éxito)
      return response.json();
  })
  .then(result => {
      // Éxito
      console.log('[removeCache] Resultado:', result);
      alert(`Éxito: ${result.message}`); // Mostrar mensaje del backend
      loadFiles(); // ¡Importante! Recargar la lista de archivos para actualizar el estado del botón
  })
  .catch(error => {
      // Error durante el fetch o por respuesta no-OK
      console.error('[removeCache] Error:', error);
      alert(`Error al eliminar el caché para ${fileName}: ${error.message}`);
      // Volver a habilitar el botón si falló
      if (removeButton) {
          removeButton.disabled = false;
          removeButton.classList.remove('is-loading');
      }
  });
}

// --- NUEVAS Funciones para Gestión de Cache ---

function getCacheLink(fileName) {
  console.log(`[getCacheLink] Obteniendo enlace de cache para: ${fileName}`);

  // Obtener información del cache del backend
  fetch(`/qgiscache/api/cache-info/${encodeURIComponent(fileName)}`)
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { 
          throw new Error(err.message || `Error ${response.status} obteniendo información del cache.`); 
        });
      }
      return response.json();
    })
    .then(cacheInfo => {
      console.log('[getCacheLink] Información del cache:', cacheInfo);
      
      // Crear modal con la información de enlaces
      showCacheLinksModal(fileName, cacheInfo);
    })
    .catch(error => {
      console.error('[getCacheLink] Error:', error);
      alert(`Error obteniendo enlaces del cache para ${fileName}: ${error.message}`);
    });
}

function openCacheAdmin(fileName) {
  console.log(`[openCacheAdmin] Abriendo administrador de cache para: ${fileName}`);

  // Obtener información del cache del backend
  fetch(`/qgiscache/api/cache-info/${encodeURIComponent(fileName)}`)
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { 
          throw new Error(err.message || `Error ${response.status} obteniendo información del cache.`); 
        });
      }
      return response.json();
    })
    .then(cacheInfo => {
      console.log('[openCacheAdmin] Abriendo demo page:', cacheInfo.urls.demo);
      
      // Abrir la página de demo/administración de MapProxy en nueva ventana
      window.open(cacheInfo.urls.demo, '_blank');
    })
    .catch(error => {
      console.error('[openCacheAdmin] Error:', error);
      alert(`Error accediendo al administrador del cache para ${fileName}: ${error.message}`);
    });
}

function showCacheLinksModal(fileName, cacheInfo) {
  // Crear contenido del modal dinámicamente
  const modalContent = `
    <div class="modal is-active" id="cacheLinksModal">
      <div class="modal-background" onclick="closeCacheLinksModal()"></div>
      <div class="modal-card">
        <header class="modal-card-head">
          <p class="modal-card-title">Enlaces de Cache - ${fileName}</p>
          <button class="delete" aria-label="close" onclick="closeCacheLinksModal()"></button>
        </header>
        <section class="modal-card-body">
          <div class="content">
            <h4>Servicio: ${cacheInfo.serviceName}</h4>
            
            <div class="field">
              <label class="label">URL Base WMS:</label>
              <div class="control">
                <input class="input" type="text" value="${window.location.origin}${cacheInfo.urls.wms}" readonly>
              </div>
              <p class="help">URL base para servicios WMS del cache</p>
            </div>

            <div class="field">
              <label class="label">GetCapabilities:</label>
              <div class="control">
                <input class="input" type="text" value="${window.location.origin}${cacheInfo.urls.capabilities}" readonly>
              </div>
              <p class="help">URL para obtener las capacidades del servicio</p>
            </div>

            <div class="field">
              <label class="label">Página de Demo/Admin:</label>
              <div class="control">
                <input class="input" type="text" value="${window.location.origin}${cacheInfo.urls.demo}" readonly>
              </div>
              <p class="help">URL para la página de administración y demo</p>
            </div>

            <h5>Capas Individuales:</h5>
            ${Object.entries(cacheInfo.layerUrls).map(([layerName, urls]) => `
              <div class="box">
                <h6 class="subtitle is-6">${layerName}</h6>
                <div class="field">
                  <label class="label">Demo Capa:</label>
                  <div class="control">
                    <input class="input is-small" type="text" value="${window.location.origin}${urls.demo}" readonly>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
        <footer class="modal-card-foot">
          <button class="button is-primary" onclick="copyAllLinks('${fileName}', ${JSON.stringify(cacheInfo).replace(/"/g, '&quot;')})">
            Copiar Enlaces
          </button>
          <button class="button" onclick="closeCacheLinksModal()">Cerrar</button>
        </footer>
      </div>
    </div>
  `;

  // Agregar modal al body
  document.body.insertAdjacentHTML('beforeend', modalContent);
}

function closeCacheLinksModal() {
  const modal = document.getElementById('cacheLinksModal');
  if (modal) {
    modal.remove();
  }
}

function copyAllLinks(fileName, cacheInfo) {
  const linksText = `
Enlaces de Cache - ${fileName}
Servicio: ${cacheInfo.serviceName}

URL Base WMS: ${window.location.origin}${cacheInfo.urls.wms}
GetCapabilities: ${window.location.origin}${cacheInfo.urls.capabilities}
Admin/Demo: ${window.location.origin}${cacheInfo.urls.demo}

Capas:
${Object.entries(cacheInfo.layerUrls).map(([layerName, urls]) => 
  `- ${layerName}: ${window.location.origin}${urls.demo}`
).join('\n')}
  `.trim();

  navigator.clipboard.writeText(linksText).then(() => {
    alert('Enlaces copiados al portapapeles!');
  }).catch(err => {
    console.error('Error copiando enlaces:', err);
    // Fallback: mostrar texto en un textarea para copiar manualmente
    const textarea = document.createElement('textarea');
    textarea.value = linksText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Enlaces copiados al portapapeles!');
  });
}

// --- Funciones para el nuevo Modal ---
function openCacheConfigModal(fileName) {
  currentProjectForCache = fileName;
  const modal = document.getElementById('cacheConfigModal');
  document.getElementById('cacheConfigProjectName').textContent = fileName;

  // Resetear y mostrar estado de carga
  document.getElementById('cacheConfigContent').style.display = 'none';
  document.getElementById('cacheLayersList').innerHTML = '';
  document.getElementById('cacheCRSList').innerHTML = '';
  document.getElementById('cacheConfigError').style.display = 'none';
  document.getElementById('cacheConfigLoading').style.display = 'block';
  document.getElementById('cacheServiceName').value = ''; // Limpiar nombre de servicio

  modal.classList.add('is-active');

  // Llamar al backend para obtener capabilities
  fetch(`/qgiscache/api/capabilities/${encodeURIComponent(fileName)}`)
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.message || `Error ${response.status}`) });
      }
      return response.json();
    })
    .then(data => {
      console.log("Capabilities recibidas:", data);
      populateCacheConfigModal(data);
      document.getElementById('cacheConfigLoading').style.display = 'none';
      document.getElementById('cacheConfigContent').style.display = 'block';
    })
    .catch(error => {
      console.error('Error obteniendo capabilities:', error);
      document.getElementById('cacheConfigLoading').style.display = 'none';
      document.getElementById('cacheConfigError').textContent = `Error al cargar información: ${error.message}`;
      document.getElementById('cacheConfigError').style.display = 'block';
    });
}

function closeCacheConfigModal() {
  const modal = document.getElementById('cacheConfigModal');
  modal.classList.remove('is-active');
  currentProjectForCache = null;
}

function populateCacheConfigModal(data) {
  const layersListDiv = document.getElementById('cacheLayersList');
  layersListDiv.innerHTML = ''; // Limpiar
  if (data.layers && data.layers.length > 0) {
    data.layers.forEach(layer => {
      const label = document.createElement('label');
      label.className = 'checkbox';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = layer.name;
      checkbox.setAttribute('data-extent-wgs84', JSON.stringify(layer.extentWGS84)); // Guardar extent si lo tienes
      checkbox.setAttribute('data-extent-project', JSON.stringify(layer.extentProject)); // Guardar extent si lo tienes
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${layer.name} (${layer.title || 'Sin título'})`));
      layersListDiv.appendChild(label);
      layersListDiv.appendChild(document.createElement('br'));
    });
  } else {
    layersListDiv.textContent = 'No se encontraron capas publicadas en el proyecto.';
  }

  const crsSelect = document.getElementById('cacheCRSList');
  crsSelect.innerHTML = ''; // Limpiar
  if (data.crs && data.crs.length > 0) {
    data.crs.forEach(crs => {
      const option = document.createElement('option');
      option.value = crs;
      option.textContent = crs;
      // Guardar el extent asociado a este CRS si viene del backend
      if (data.extents && data.extents[crs]) {
        option.setAttribute('data-extent', JSON.stringify(data.extents[crs]));
      }
      crsSelect.appendChild(option);
    });
  } else {
    const option = document.createElement('option');
    option.textContent = 'No se encontraron CRS soportados.';
    option.disabled = true;
    crsSelect.appendChild(option);
  }
}

function submitCacheConfiguration() {
  const selectedLayers = [];
  document.querySelectorAll('#cacheLayersList input[type="checkbox"]:checked').forEach(checkbox => {
    selectedLayers.push(checkbox.value);
  });

  const selectedCRSOption = document.getElementById('cacheCRSList').selectedOptions[0];
  if (!selectedCRSOption || !selectedCRSOption.value) {
    alert('Por favor, selecciona un Sistema de Coordenadas.');
    return;
  }
  const selectedCRS = selectedCRSOption.value;
  const selectedCRSExtent = selectedCRSOption.dataset.extent ? JSON.parse(selectedCRSOption.dataset.extent) : null; // Obtener extent asociado


  if (selectedLayers.length === 0) {
    alert('Por favor, selecciona al menos una capa para cachear.');
    return;
  }

  const serviceName = document.getElementById('cacheServiceName').value.trim() || path.basename(currentProjectForCache, path.extname(currentProjectForCache)); // Usa nombre de proyecto si está vacío

  const configData = {
    fileName: currentProjectForCache,
    layers: selectedLayers,
    crs: selectedCRS,
    extent: selectedCRSExtent, // Enviar el extent para el CRS seleccionado
    serviceName: serviceName
  };

  console.log('Enviando configuración de cache:', configData);

  const submitButton = document.getElementById('submitCacheConfigButton');
  submitButton.classList.add('is-loading'); // Mostrar indicador de carga en el botón

  // Llamar al backend para configurar y ejecutar el seed
  fetch('/qgiscache/api/configure-and-seed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(configData),
  })
    .then(response => {
      submitButton.classList.remove('is-loading'); // Quitar indicador
      if (!response.ok) {
        return response.json().then(err => { throw new Error(err.message || `Error ${response.status}`) });
      }
      return response.json();
    })
    .then(result => {
      alert(`Éxito: ${result.message}`);
      closeCacheConfigModal();
    })
    .catch(error => {
      console.error('Error al configurar/ejecutar cache:', error);
      alert(`Error: ${error.message}`);
      // No cerrar el modal en caso de error para que el usuario pueda reintentar o revisar
    });
}




// Función para eliminar un archivo
function deleteFile(fileName) {
  fetch(`/qgisserver/api/files/${fileName}`, { method: 'DELETE' })
    .then(response => response.json())
    .then(result => {
      console.log(result);
      loadFiles();
    })
    .catch(error => {
      console.error(error);
    });
}

// Función para descargar un archivo
function downloadFile(fileName) {
  const fileExtension = fileName.split('.').pop();
  if (fileExtension !== 'folder') {
    window.location.href = `/qgisserver/api/files/${fileName}`;
  }
}

// Función para abrir servicio WMS usando la URL pública del proxy y el catálogo definido en currentPath
function openWMS(fileName) {
  // Se asume que currentPath ya contiene el directorio del proyecto (por ejemplo, "/QGISserver/qgisprojekt")

  // 1. Combina la ruta y el nombre del archivo
  const rawMapPath = currentPath + "/" + fileName;

  // 2. Codifica la ruta completa (maneja espacios, etc.)
  let encodedMapPath = encodeURIComponent(rawMapPath);

  // 3. Reemplaza específicamente %2F (barras codificadas) de vuelta a /
  encodedMapPath = encodedMapPath.replace(/%2F/g, '/');

  // 4. Construye el enlace final con la ruta modificada
  const link = `${qgisServerLink}map=${encodedMapPath}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;

  // Mantenemos el log para depuración si es necesario
  console.log("Current catalog path for WMS:", currentPath);
  console.log("Generated WMS link for Origo:", link); // Puedes añadir este log para verificar

  // Abre la ventana
  window.open(link);
}

// Para WMTS, usamos también currentPath (ya que debe leerse de qgis.json)
function openWMTS(fileName) {
  // 1. Combina la ruta y el nombre del archivo
  const rawMapPath = currentPath + "/" + fileName;

  // 2. Codifica la ruta completa (maneja espacios, etc.)
  let encodedMapPath = encodeURIComponent(rawMapPath);

  // 3. Reemplaza específicamente %2F (barras codificadas) de vuelta a /
  encodedMapPath = encodedMapPath.replace(/%2F/g, '/');

  // 4. Construye el enlace final con la ruta modificada
  const link = `${qgisServerLink}map=${encodedMapPath}&SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities`;

  console.log("Generated WMTS link for Origo:", link); // Log opcional para verificar

  // Abre la ventana
  window.open(link);
}

function openWFS(fileName) {
  // 1. Combina la ruta y el nombre del archivo
  const rawMapPath = currentPath + "/" + fileName;

  // 2. Codifica la ruta completa (esto manejará espacios, etc., convirtiéndolos a %20, por ejemplo)
  let encodedMapPath = encodeURIComponent(rawMapPath);

  // 3. Reemplaza específicamente SOLO los %2F (barras codificadas) de vuelta a /
  //    La 'g' en /%2F/g asegura que se reemplacen *todas* las ocurrencias.
  encodedMapPath = encodedMapPath.replace(/%2F/g, '/');

  // 4. Construye el enlace final con la ruta modificada
  const link = `${qgisServerLink}map=${encodedMapPath}&SERVICE=WFS&VERSION=1.1.0&REQUEST=GetCapabilities`;

  // Abre la ventana
  window.open(link);
}

function openWMSMap(fileName) {
  // Use WMS parameters instead of WFS
  const link = `${qgisServerLink}map=${encodeURIComponent(currentPath + "/" + fileName)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;
  // It’s a good idea to encode the entire query parameter
  window.open(`/qgisserver/map?wmsLink=${encodeURIComponent(link)}`);
}


// Funciones para crear botones
function createButton(iconClass, className, onClickHandler) {
  const button = document.createElement('button');
  button.className = `button ${className}`;
  button.onclick = onClickHandler;
  const icon = document.createElement('i');
  icon.className = iconClass;
  button.appendChild(icon);
  return button;
}

function createTextButton(text, className, onClickHandler) {
  const button = document.createElement('button');
  button.textContent = text;
  button.className = `button ${className}`;
  button.onclick = onClickHandler;
  return button;
}

// Funciones de descripción
function openDescriptionModal(fileName, description) {
  currentFileName = fileName;
  console.log('Opening modal for:', fileName);
  if (window.joditEditor) {
    window.joditEditor.value = description || '';
    document.getElementById('descriptionModal').classList.add('is-active');
  } else {
    console.error('Jodit Editor instance not found.');
  }
}

function saveDescription() {
  if (!window.joditEditor) {
    console.error('Jodit Editor instance not found.');
    return;
  }
  const description = window.joditEditor.value;
  console.log('Saving description for:', currentFileName, description);
  fetch(`/qgisserver/api/description/${currentFileName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description })
  })
    .then(response => response.json())
    .then(result => {
      console.log('Description saved:', result);
      closeDescriptionModal();
      updateDescriptionInDOM(currentFileName, description);
    })
    .catch(error => console.error('Error saving description:', error));
}

function closeDescriptionModal() {
  document.getElementById('descriptionModal').classList.remove('is-active');
  currentFileName = null;
}

function updateDescriptionInDOM(fileName, description) {
  const descriptionElement = document.getElementById(`description-${fileName}`);
  if (descriptionElement) {
    descriptionElement.innerHTML = description;
  }
}

// Función para agregar archivos a la lista (MODIFICADA con botón dinámico y logs)
function addFileToList(file) {
  // Log inicial para ver qué datos llegan
  console.log("[addFileToList] Processing file:", file); 

  if (file && typeof file.name === 'string' && file.name !== 'geodata') {
      const fileList = document.getElementById('fileList');
      const listItem = document.createElement('div');
      listItem.className = 'box';
      listItem.setAttribute('data-filename', file.name);

      // Contenedor de la información del archivo
      const fileInfoContainer = document.createElement('div');
      fileInfoContainer.className = 'media mb-3';

      // Contenedor para el icono
      const mediaLeft = document.createElement('div');
      mediaLeft.className = 'media-left';
      const iconElement = document.createElement('figure');
      iconElement.className = 'image is-24x24';
      const img = document.createElement('img');
      img.className = 'file-icon';
      // *** SE MOVIÓ LA DEFINICIÓN DE fileExtension AQUÍ ARRIBA ***
      const fileExtension = file.name.split('.').pop().toLowerCase(); // Asegurar minúsculas
      img.src = (fileExtension === 'qgz' || fileExtension === 'qgs')
          ? '/public/css/icons/qgis.png'
          : '/public/css/icons/box.png'; // Asumiendo que box.png es para otros o carpetas
      iconElement.appendChild(img);
      mediaLeft.appendChild(iconElement);

      // Contenedor para el contenido (nombre, descripción y checkbox)
      const mediaContent = document.createElement('div');
      mediaContent.className = 'media-content';

      // Nombre del archivo
      const fileNameElement = document.createElement('p');
      fileNameElement.className = 'title is-6';
      fileNameElement.textContent = file.name.replace(/^\./, '');
      mediaContent.appendChild(fileNameElement);

      // Descripción del archivo
      const descriptionElement = document.createElement('div');
      descriptionElement.className = 'content';
      descriptionElement.innerHTML = file.description || 'No description available';
      descriptionElement.setAttribute('id', `description-${file.name}`);
      mediaContent.appendChild(descriptionElement);

      // Checkbox Público (solo para proyectos QGIS)
      if (fileExtension === 'qgz' || fileExtension === 'qgs') {
          const publicLabel = document.createElement('label');
          publicLabel.style.marginTop = '5px';
          publicLabel.textContent = ' Public: ';
          const publicCheckbox = document.createElement('input');
          publicCheckbox.type = 'checkbox';
          publicCheckbox.className = 'project-public-toggle';
          publicCheckbox.setAttribute('data-project', file.name);
          if (file.isPublic) {
              publicCheckbox.checked = true;
          }
          publicLabel.appendChild(publicCheckbox);
          mediaContent.appendChild(publicLabel);
      }

      // Contenedor de botones de edición/recarga
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'buttons are-centered';
      const descriptionButton = createButton('fas fa-edit', 'is-small is-info', () => openDescriptionModal(file.name, file.description));
      const reloadButton = createButton('fas fa-sync-alt', 'is-small is-primary', loadFiles);
      buttonContainer.appendChild(descriptionButton);
      buttonContainer.appendChild(reloadButton);

      // Agregar contenedores al fileInfoContainer
      fileInfoContainer.appendChild(mediaLeft);
      fileInfoContainer.appendChild(mediaContent);
      fileInfoContainer.appendChild(buttonContainer);

      // Contenedor para los botones de formato/acciones (WMS, Cache, etc.)
      const formatButtonsContainer = document.createElement('div');
      formatButtonsContainer.className = 'buttons are-centered';

      // Botones estándar (Delete, Download, Map) - Añadirlos siempre
      const deleteButton = createButton('fas fa-trash-alt', 'is-danger is-small', () => deleteFile(file.name)); // is-small añadido
      const downloadButton = createButton('fas fa-download', 'is-info is-small', () => downloadFile(file.name)); // is-small añadido
      const openWMSMapButton = createButton('fas fa-map', 'is-primary is-small', () => openWMSMap(file.name)); // is-small añadido
      [deleteButton, downloadButton, openWMSMapButton].forEach(btn => formatButtonsContainer.appendChild(btn));

      // Botones específicos para proyectos QGIS (WMS, WMTS, WFS, Caché)
      if (fileExtension === 'qgz' || fileExtension === 'qgs') {
           console.log(`[addFileToList] Es proyecto QGIS (${file.name}). Cache Info:`, file.cacheInfo); // Log cacheInfo
          
          const wmsButton = createTextButton('WMS', 'is-primary is-small', () => openWMS(file.name)); // is-small añadido
          const wmtsButton = createTextButton('WMTS', 'is-primary is-small', () => openWMTS(file.name)); // is-small añadido
          const wfsButton = createTextButton('WFS', 'is-primary is-small', () => openWFS(file.name)); // is-small añadido
          
          // === Lógica para Botones de Caché DINÁMICOS ===
          const cacheButtons = []; // Array para múltiples botones de cache
          
          // Verificar que cacheInfo exista y tenga la propiedad cached
          if (file.cacheInfo && file.cacheInfo.cached === true) { 
               // Si ya está cacheado, mostrar botones de gestión
               console.log(`[addFileToList] Creating cache management buttons for: ${file.name}`);
               
               // Botón para obtener enlaces del cache
               const getLinkButton = createTextButton('Ver Enlaces', 'is-success is-small', () => getCacheLink(file.name));
               
               // Botón para abrir administrador del cache
               const adminButton = createTextButton('Admin Cache', 'is-warning is-small', () => openCacheAdmin(file.name));
               
               // Botón para eliminar cache
               const removeButton = createTextButton('Eliminar Cache', 'is-danger is-small', () => removeCache(file.name));
               
               cacheButtons.push(getLinkButton, adminButton, removeButton);
          } else {
               // Si no está cacheado, mostrar botón de configurar
               console.log(`[addFileToList] Creating 'Configurar Caché' button for: ${file.name}`);
               const configButton = createTextButton('Configurar Caché', 'is-info is-small', () => openCacheConfigModal(file.name));
               cacheButtons.push(configButton);
          }
          // === Fin Lógica Botones Caché ===

          // Añadir botones específicos de QGIS al contenedor
          const qgisButtons = [wmsButton, wmtsButton, wfsButton, ...cacheButtons];
          console.log(`[addFileToList] Adding ${qgisButtons.length} buttons for ${file.name}`);
           qgisButtons.forEach(btn => formatButtonsContainer.appendChild(btn));
           console.log(`[addFileToList] Appended buttons for ${file.name}:`, formatButtonsContainer.innerHTML); // Log HTML botones
      }

      // Agregar todo al elemento de la lista
      listItem.appendChild(fileInfoContainer);
      // Solo añadir el contenedor de botones de formato si tiene botones dentro
      if (formatButtonsContainer.hasChildNodes()) { 
          listItem.appendChild(formatButtonsContainer);
      } else {
           console.warn("[addFileToList] formatButtonsContainer was empty for:", file.name);
      }
      
      fileList.appendChild(listItem);
      console.log(`[addFileToList] Appended listItem for ${file.name} to fileList.`); // Log final append

  } else {
      console.warn("[addFileToList] Skipping file processing for:", file); // Log si el archivo es inválido o 'geodata'
  }
}

// Función para asignar los listeners a los checkboxes de los proyectos
function attachProjectToggleListeners() {
  document.querySelectorAll('.project-public-toggle').forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const project = this.dataset.project;
      const isPublic = this.checked;
      console.log(`Proyecto ${project}, isPublic: ${isPublic}`);
      fetch('/qgisserver/api/project-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, isPublic })
      })
        .then(response => response.json())
        .then(data => {
          alert(data.message);
        })
        .catch(err => console.error('Error updating project settings:', err));
    });
  });
}

// Llama a esta función al final de la carga de archivos, por ejemplo:
function loadFiles() {
  fetch('/qgisserver/api/files')
    .then(response => response.json())
    .then(files => {
      console.log('Files loaded:', files);
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';

      files.forEach(file => {
        addFileToList(file);
      });

      // Después de generar la lista, asigna los listeners
      attachProjectToggleListeners();
    })
    .catch(error => {
      console.error(error);
    });
}




// Funciones para la navegación de directorios
function openSettingsModal() {
  document.getElementById('settingsModal').classList.add('is-active');
  loadDirectories('/');
}

function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('is-active');
}

function loadDirectories(path) {
  fetch(`/qgisserver/api/directories?path=${encodeURIComponent(path)}`)
    .then(response => response.json())
    .then(data => {
      const directoryList = document.getElementById('directoryList');
      directoryList.innerHTML = '';
      document.getElementById('currentPath').textContent = data.currentPath;
      // Actualizamos la variable global currentPath
      currentPath = data.currentPath;
      if (data.currentPath !== '/') {
        const upItem = document.createElement('div');
        upItem.className = 'box';
        const upIcon = document.createElement('i');
        upIcon.className = 'fas fa-arrow-up';
        upItem.appendChild(upIcon);
        upItem.appendChild(document.createTextNode(' ..'));
        upItem.onclick = () => {
          const parentPath = path.split('/').slice(0, -1).join('/') || '/';
          loadDirectories(parentPath);
        };
        directoryList.appendChild(upItem);
      }
      data.drives.forEach(drive => {
        const driveItem = document.createElement('div');
        driveItem.className = 'box';
        driveItem.textContent = drive;
        driveItem.onclick = () => loadDirectories(drive);
        directoryList.appendChild(driveItem);
      });
      data.directories.forEach(directory => {
        const directoryItem = document.createElement('div');
        directoryItem.className = 'box';
        directoryItem.textContent = directory;
        directoryItem.onclick = () => {
          const newPath = path === '/' ? `/${directory}` : `${path}/${directory}`;
          loadDirectories(newPath);
        };
        directoryList.appendChild(directoryItem);
      });
      selectedDirectory = data.currentPath;
    })
    .catch(error => {
      console.error(error);
    });
}

function saveSettings() {
  if (selectedDirectory) {
    fetch('/qgisserver/api/update-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPath: selectedDirectory })
    })
      .then(response => response.json())
      .then(result => {
        console.log('Path updated:', result);
        closeSettingsModal();
        loadFiles();
      })
      .catch(error => {
        console.error('Error updating path:', error);
      });
  }
}

// Funciones para el modal de enlace del servidor QGIS
function openServerLinkModal() {
  document.getElementById('serverLinkModal').classList.add('is-active');
  document.getElementById('serverLinkInput').value = qgisServerLink;
}

function closeServerLinkModal() {
  document.getElementById('serverLinkModal').classList.remove('is-active');
}

function saveServerLink() {
  const newLink = document.getElementById('serverLinkInput').value.trim();
  console.log('New QGIS server link to be saved:', newLink);
  if (!newLink) {
    alert('Please enter a valid link.');
    return;
  }
  // Use the same endpoint (/qgisserver/api/server-link) for both POST and GET.
  fetch('/qgisserver/api/server-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link: newLink })
  })
    .then(response => response.json())
    .then(data => {
      alert(data.message); // e.g., "QGIS-server address updated successfully"
      // After saving the new link, fetch the updated configuration
      return fetch('/qgisserver/api/server-link');
    })
    .then(response => response.json())
    .then(data => {
      // Use the publicLink property from the response for building URLs on the front end
      // (Your server_proxy.json should supply this value)
      qgisServerLink = data.publicLink || "/qgisserver/services?";
      console.log('QGIS server public link loaded:', qgisServerLink);
      loadFiles();
      loadWMSProjects();
      closeServerLinkModal();
    })
    .catch(error => console.error('Error updating QGIS server link:', error));
}


document.addEventListener('DOMContentLoaded', () => {

  const submitCacheButton = document.getElementById('submitCacheConfigButton');
  if (submitCacheButton) {
    submitCacheButton.addEventListener('click', submitCacheConfiguration);
  }
  // Añadir listener para cerrar el modal con el botón 'X' (ya que no tiene ID específico)
  const cacheModalCloseButton = document.querySelector('#cacheConfigModal .delete');
  if (cacheModalCloseButton) {
    cacheModalCloseButton.addEventListener('click', closeCacheConfigModal);
  }
  const cacheModalBackground = document.querySelector('#cacheConfigModal .modal-background');
  if (cacheModalBackground) {
    cacheModalBackground.addEventListener('click', closeCacheConfigModal);
  }

  const saveDescriptionButton = document.getElementById('saveDescriptionButton');
  const settingsButton = document.getElementById('settingsButton');
  const saveSettingsButton = document.getElementById('saveSettingsButton');
  const serverLinkButton = document.getElementById('serverLinkButton');
  const saveServerLinkButton = document.getElementById('saveServerLinkButton');

  saveDescriptionButton.addEventListener('click', saveDescription);
  settingsButton.addEventListener('click', openSettingsModal);
  saveSettingsButton.addEventListener('click', saveSettings);
  serverLinkButton.addEventListener('click', openServerLinkModal);
  saveServerLinkButton.addEventListener('click', saveServerLink);

  document.querySelectorAll('.modal-close').forEach(closeButton => {
    closeButton.addEventListener('click', closeDescriptionModal);
    closeButton.addEventListener('click', closeSettingsModal);
    closeButton.addEventListener('click', closeServerLinkModal);
  });
  document.querySelectorAll('.modal-background').forEach(background => {
    background.addEventListener('click', closeDescriptionModal);
    background.addEventListener('click', closeSettingsModal);
    background.addEventListener('click', closeServerLinkModal);
  });

});

let availableWMSProjects = [];

function loadWMSProjects() {
  fetch('/qgisserver/api/files')
    .then(response => response.json())
    .then(files => {
      availableWMSProjects = files
        .filter(file => file.name.endsWith('.qgs') || file.name.endsWith('.qgz'))
        .map(file => ({
          name: file.name,
          url: `${qgisServerLink}MAP=${encodeURIComponent(currentPath + "/" + file.name)}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`
        }));
      console.log('Available WMS projects:', availableWMSProjects);
    })
    .catch(error => {
      console.error('Error loading WMS projects:', error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  fetch('/qgisserver/api/server-link')
    .then(response => response.json())
    .then(data => {
      // Use the publicLink from your configuration
      qgisServerLink = data.publicLink || "/qgisserver/api/services?";
      console.log('QGIS server public link loaded:', qgisServerLink);
      loadFiles();
      loadWMSProjects();
    })
    .catch(error => console.error('Error loading QGIS server link:', error));
});








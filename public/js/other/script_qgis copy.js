// Variables globales
let currentFileName = null;
let selectedDirectory = null;
let currentPath = "/QGISserver/qgisprojekt";  // Valor por defecto; idealmente se lee de qgis.json
let qgisServerLink = "";
let proxyServerLink = "";

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

// Función para agregar archivos a la lista
function addFileToList(file) {
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
    const fileExtension = file.name.split('.').pop();
    img.src = (fileExtension === 'qgz' || fileExtension === 'qgs')
      ? '/public/css/icons/qgis.png'
      : '/public/css/icons/box.png';
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

    // Si es un proyecto QGIS (por ejemplo, con extensión .qgz o .qgs), agrega el checkbox para marcarlo como público
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
    

    // Contenedor de botones para acciones (editar, recargar, etc.)
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'buttons are-centered';
    const descriptionButton = createButton('fas fa-edit', 'is-small is-info', () => openDescriptionModal(file.name, file.description));
    const reloadButton = createButton('fas fa-sync-alt', 'is-small is-primary', loadFiles);
    buttonContainer.appendChild(descriptionButton);
    buttonContainer.appendChild(reloadButton);

    // Agregar los contenedores al fileInfoContainer
    fileInfoContainer.appendChild(mediaLeft);
    fileInfoContainer.appendChild(mediaContent);
    fileInfoContainer.appendChild(buttonContainer);

    // Botones de acciones adicionales (eliminar, descargar, abrir WMS, etc.)
    const deleteButton = createButton('fas fa-trash-alt', 'is-danger', () => deleteFile(file.name));
    const downloadButton = createButton('fas fa-download', 'is-info', () => downloadFile(file.name));
    const openWMSMapButton = createButton('fas fa-map', 'is-primary', () => openWMSMap(file.name));

    const formatButtonsContainer = document.createElement('div');
    formatButtonsContainer.className = 'buttons are-centered';
    [deleteButton, downloadButton, openWMSMapButton].forEach(btn => formatButtonsContainer.appendChild(btn));

    // Si es un proyecto QGIS, agregar botones para abrir los servicios
    if (fileExtension === 'qgz' || fileExtension === 'qgs') {
      const wmsButton = createTextButton('WMS', 'is-primary', () => openWMS(file.name));
      const wmtsButton = createTextButton('WMTS', 'is-primary', () => openWMTS(file.name));
      const wfsButton = createTextButton('WFS', 'is-primary', () => openWFS(file.name));
      [wmsButton, wmtsButton, wfsButton].forEach(btn => formatButtonsContainer.appendChild(btn));
    }

    

    // Agregar todo al elemento de la lista
    listItem.appendChild(fileInfoContainer);
    listItem.appendChild(formatButtonsContainer);
    fileList.appendChild(listItem);
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




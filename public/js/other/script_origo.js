

const copyJsonButtons = document.querySelectorAll('[id^="copyJsonButton-"]'); copyJsonButtons.forEach((b) => { b.addEventListener('click', () => { const f = b.getAttribute('data-file'); if (!f) return; const nB = prompt(`Enter base name for copy of '${f}' (no .json extension):`); if (nB && nB.trim()) { const nF = nB.trim() + '.json'; if (!/^[a-zA-Z0-9_-]+$/.test(nB)) { alert("Invalid name. Use letters, numbers, underscore, hyphen."); return; } if (!confirm(`Create copy named '${nF}' (and corresponding .ejs)?`)) return; fetch(`/origoadmin/copy-json?file=${encodeURIComponent(f)}&newFileName=${encodeURIComponent(nB)}`, { method: 'POST' }).then(r => { if (!r.ok) return r.json().then(err => { throw new Error(`Error copying (${r.status}): ${err.error || '?'}`); }); return r.json(); }).then(d => { console.log('Copy response:', d); alert(`Map '${f}' copied to '${nF}'.`); location.reload(); }).catch(err => { console.error('Error copying map:', err); alert('Error copying map: ' + err.message); }); } }); });
const publishButtons = document.querySelectorAll('[id^="publishButton-"]'); const unpublishButtons = document.querySelectorAll('[id^="unpublishButton-"]'); publishButtons.forEach((b) => { b.addEventListener('click', () => { const f = b.getAttribute('data-file'); if (f) handlePublish(f); }); }); unpublishButtons.forEach((b) => { b.addEventListener('click', () => { const f = b.getAttribute('data-file'); if (f) handleUnpublish(f); }); });



// Configuración para cargar Monaco Editor desde CDN
require.config({ paths: { 'vs': '/monaco-editor/min/vs/' } });

// Variables globales
let editor;
let currentFileName;
let currentJsonData = {};
// Coloca esto en algún lugar accesible en tu script_origo.js,
// por ejemplo, antes o después de las funciones de manejo de modales.

// Variable global para almacenar los datos de los proyectos QGIS cargados
let availableQgisProjects = [];

// Define esta función globalmente en script_origo.js o asegúrate que sea accesible
window.populateGroupParentOptions = function (groupsArray, targetOptionsArray, prefix = '') {
    groupsArray.forEach(g => {
        targetOptionsArray.push({ value: g.name, text: prefix + (g.title || g.name) });
        if (g.groups && g.groups.length > 0) {
            window.populateGroupParentOptions(g.groups, targetOptionsArray, prefix + '- ');
        }
    });
};


async function loadAndSelectQgisProjectForSource() {
    const sourceNameInput = document.getElementById('source-name');
    const sourceUrlInput = document.getElementById('source-url');
    const sourceTypeSelect = document.getElementById('source-type'); // El select para WMS, WFS, etc.
    const sourceVersionInput = document.getElementById('source-version');
    const qgisProjectSelectorContainer = document.getElementById('qgis-project-selector-container');

    if (!qgisProjectSelectorContainer || !sourceNameInput || !sourceUrlInput || !sourceTypeSelect) {
        console.error("Faltan elementos del DOM para la selección de proyectos QGIS.");
        qgisProjectSelectorContainer.innerHTML = '<p class="help is-danger">Error: Faltan elementos del formulario.</p>';
        return;
    }

    qgisProjectSelectorContainer.innerHTML = '<p class="help">Cargando proyectos QGIS publicados...</p>';
    qgisProjectSelectorContainer.style.display = 'block';

    try {
        // Asegúrate que la ruta /qgisserver/api/... sea correcta según tu configuración de proxy/rutas
        const response = await fetch('/qgisserver/api/published-qgis-sources');
        if (!response.ok) {
            const errData = await response.json().catch(() => ({ message: `Error HTTP ${response.status}` }));
            throw new Error(errData.message || `Error HTTP ${response.status}`);
        }
        availableQgisProjects = await response.json();

        if (!availableQgisProjects || availableQgisProjects.length === 0) {
            qgisProjectSelectorContainer.innerHTML = '<p class="help">No se encontraron proyectos QGIS publicados.</p>';
            return;
        }

        let selectHtml = '<div class="field"><label class="label">Seleccionar Proyecto QGIS</label><div class="control"><div class="select is-fullwidth"><select id="qgis-project-select"><option value="">-- Elige un proyecto --</option>';
        availableQgisProjects.forEach(proj => {
            selectHtml += `<option value="${proj.projectName}">${proj.projectName} ${proj.description ? '(' + proj.description + ')' : ''}</option>`;
        });
        selectHtml += '</select></div></div></div>';

        selectHtml += `
            <div class="field" id="qgis-service-type-selector" style="display:none;">
                <label class="label">Tipo de Servicio a Crear</label>
                <div class="control buttons are-small">
                    <button type="button" class="button is-outlined is-link" data-service-type="WMS">Usar como WMS</button>
                    <button type="button" class="button is-outlined is-link" data-service-type="WFS">Usar como WFS</button>
                    <button type="button" class="button is-outlined is-link" data-service-type="WMTS">Usar como WMTS</button>
                </div>
            </div>`;

        qgisProjectSelectorContainer.innerHTML = selectHtml;

        const projectSelect = document.getElementById('qgis-project-select');
        const serviceTypeSelectorDiv = document.getElementById('qgis-service-type-selector');

        projectSelect.addEventListener('change', function () {
            if (this.value) {
                serviceTypeSelectorDiv.style.display = 'block';
            } else {
                serviceTypeSelectorDiv.style.display = 'none';
            }
        });


        serviceTypeSelectorDiv.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', function () {
                const selectedProjectName = projectSelect.value;
                if (!selectedProjectName) return;

                const projectData = availableQgisProjects.find(p => p.projectName === selectedProjectName);
                if (!projectData) {
                    console.error(`No se encontraron datos para el proyecto seleccionado: ${selectedProjectName}`);
                    return;
                }

                const serviceType = this.getAttribute('data-service-type');
                const baseName = projectData.projectName.replace(/\.qgz$|\.qgs$/i, ''); // Quita extensión

                sourceNameInput.value = `${baseName}_${serviceType.toLowerCase()}`;

                // --- INICIO DE LA MODIFICACIÓN: Construir URL Absoluta ---
                let relativeSourceBaseUrl = projectData.sourceBaseUrl;

                // La sourceBaseUrl del backend ya debería empezar con '/' (ej. /qgisserver/api/services?MAP=...)
                // window.location.origin NO tiene una barra al final (ej. https://int.rabbalshedekraft.se)
                // Así que la concatenación directa funciona.
                const absoluteSourceUrl = window.location.origin + relativeSourceBaseUrl;

                sourceUrlInput.value = absoluteSourceUrl; // Usar la URL absoluta
                console.log('URL Absoluta generada para la fuente:', absoluteSourceUrl);
                // --- FIN DE LA MODIFICACIÓN ---

                sourceTypeSelect.value = serviceType; // Asigna al select existente de tipo de fuente

                // Valores por defecto para versiones (puedes ajustarlos)
                if (serviceType === 'WMS') sourceVersionInput.value = '1.3.0'; // o 1.1.1
                else if (serviceType === 'WFS') sourceVersionInput.value = '1.1.0'; // o 2.0.0
                else if (serviceType === 'WMTS') sourceVersionInput.value = '1.0.0';
                else sourceVersionInput.value = '';

                // Limpiar errores si los hubiera
                [sourceNameInput, sourceUrlInput, sourceTypeSelect, sourceVersionInput].forEach(el => {
                    if (typeof clearFieldError === 'function' && el && el.id) { // Asegurarse que clearFieldError y el.id existen
                        clearFieldError(el.id);
                    }
                });

                alert(`Campos rellenados para ${projectData.projectName} como ${serviceType} con URL: ${absoluteSourceUrl}. Verifica y ajusta si es necesario.`);
            });
        });


    } catch (error) {
        console.error("Error cargando proyectos QGIS:", error);
        qgisProjectSelectorContainer.innerHTML = `<p class="help is-danger">Error al cargar proyectos: ${error.message}</p>`;
    }
}

require(['vs/editor/editor.main'], function () {

    window.handleToggleAccess = async function (mapBaseName) {
        const iconElement = document.getElementById(`access-toggle-${mapBaseName}`);
        if (!iconElement) {
            console.error(`Icon element not found for map: ${mapBaseName}`);
            return;
        }

        const currentState = iconElement.getAttribute('data-current-state'); // 'public' or 'private'
        console.log(`Toggling access for ${mapBaseName}, current state: ${currentState}`);

        // Indicar carga (opcional)
        iconElement.style.opacity = '0.5';
        iconElement.style.pointerEvents = 'none'; // Deshabilitar clics mientras procesa

        try {
            // Llama a la nueva ruta del backend para cambiar el estado
            const response = await fetch('/origoadmin/toggle-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mapName: mapBaseName }) // Envía el nombre base del mapa
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                // Si falla, muestra un error y revierte la opacidad/puntero
                throw new Error(data.message || `Server error ${response.status}`);
            }

            const newState = data.newState; // 'public' or 'private' (devuelto por el backend)
            console.log(`New state for ${mapBaseName}: ${newState}`);

            // Actualizar el icono y los atributos en la UI
            iconElement.classList.remove('fa-lock', 'fa-lock-open', 'is-public', 'is-private');
            if (newState === 'public') {
                iconElement.classList.add('fa-lock-open', 'is-public');
                iconElement.setAttribute('data-current-state', 'public');
                iconElement.setAttribute('title', 'Map is Public (Click to make Private)');
            } else { // private
                iconElement.classList.add('fa-lock', 'is-private');
                iconElement.setAttribute('data-current-state', 'private');
                iconElement.setAttribute('title', 'Map is Private (Click to make Public)');
            }
            // Considera actualizar currentJsonData.accessState si lo usas localmente,
            // aunque recargar los datos del servidor es más seguro.

        } catch (error) {
            console.error(`Error toggling access for ${mapBaseName}:`, error);
            alert(`Error updating access state: ${error.message}`);
            // Podrías revertir el icono al estado anterior aquí si falló
        } finally {
            // Quitar indicador de carga
            iconElement.style.opacity = '1';
            iconElement.style.pointerEvents = 'auto'; // Rehabilitar clics
        }
    };

    // Dentro de require(['vs/editor/editor.main'], function () { ... });

    const miOrigoSimpleSchema = {
        uri: "http://misitio.com/schemas/origomap_simple.json", // Identificador único
        // fileMatch: ["*"], // Para que aplique a cualquier JSON que abras en este editor
        schema: {
            "type": "object",
            "properties": {
                "styles": { // Asumiendo que tus estilos están bajo una clave "styles"
                    "type": "object",
                    "patternProperties": {
                        ".*": { // Para cualquier nombre de estilo (ej. "foto", "station")
                            "type": "array",
                            "items": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "fill": {
                                            "type": "object",
                                            "properties": {
                                                "color": { "type": "string", "format": "color" }
                                            }
                                        },
                                        "stroke": {
                                            "type": "object",
                                            "properties": {
                                                "color": { "type": "string", "format": "color" }
                                            }
                                        },
                                        "text": {
                                            "type": "object",
                                            "properties": {
                                                "fill": {
                                                    "type": "object",
                                                    "properties": {
                                                        "color": { "type": "string", "format": "color" }
                                                    }
                                                },
                                                "stroke": {
                                                    "type": "object",
                                                    "properties": {
                                                        "color": { "type": "string", "format": "color" }
                                                    }
                                                }
                                            }
                                        }
                                        // ... puedes añadir más propiedades aquí ...
                                    }
                                }
                            }
                        }
                    }
                }
                // ... puedes añadir "layers", "source" si quieres que Monaco también los valide/sugiera ...
            }
        }
    };

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [miOrigoSimpleSchema]
    });

    // TU CÓDIGO PARA window.openJsonEditor, etc. SIGUE AQUÍ
    // Asegúrate que al crear el editor, el 'language' es 'json'
    // y 'colorDecorators: true' (aunque a menudo es el comportamiento por defecto para JSON con schema)
    // ...

    // --- Funciones del Editor y Modales (Textos en Inglés) ---
    window.openJsonEditor = function (fileName) {
        if (editor) { closeJsonEditor(); }
        const encodedFileName = encodeURIComponent(fileName);
        fetch(`/origoadmin/edit-json?file=${encodedFileName}`)
            .then(response => { if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
            .then(json => {
                const editorSection = document.getElementById('json-editor-section');
                const editorFilenameSpan = document.getElementById('json-editor-filename');
                const container = document.getElementById('monaco-editor-container');

                if (!editorSection || !editorFilenameSpan || !container) {
                    console.error("Error: Elementos clave del editor no encontrados.");
                    return;
                }

                // --- INICIO: Aplicar estilos para comportamiento modal ---
                editorSection.style.display = 'flex'; // Cambiado a flex para el layout interno
                editorSection.style.position = 'fixed';
                editorSection.style.top = '50%';
                editorSection.style.left = '50%';
                editorSection.style.transform = 'translate(-50%, -50%)';
                editorSection.style.width = '90vw';
                editorSection.style.maxWidth = '1400px'; // O el que prefieras
                editorSection.style.height = '90vh';
                // Los estilos de fondo, borde, sombra, z-index, padding ya los tienes en el CSS
                // Si no, añádelos aquí también:
                // editorSection.style.backgroundColor = 'white';
                // editorSection.style.border = '1px solid #ccc';
                // editorSection.style.boxShadow = '0 8px 16px rgba(0,0,0,0.2)';
                // editorSection.style.zIndex = '1050';
                // editorSection.style.padding = '20px';

                document.body.classList.add('has-editor-active'); // Prevenir scroll del body
                // --- FIN: Aplicar estilos para comportamiento modal ---

                editorFilenameSpan.textContent = fileName;

                // Ajustar la altura del contenedor de Monaco
                // Si #json-editor-section es flex y column, y este container es flex-grow:1,
                // no necesitarías fijar la altura aquí. Pero si no, una altura fija es necesaria.
                // container.style.height = '600px'; // Como lo tenías, o ajústalo
                // Para que ocupe el espacio restante si editorSection es flex:
                // Esto es un cálculo aproximado, puede necesitar ajuste si los controles tienen altura variable.
                const controlsHeight = editorSection.querySelector('.editor-controls')?.offsetHeight || 0;
                const titleHeight = editorSection.querySelector('.title')?.offsetHeight || 0; // Si el título está dentro de editorSection
                const paddingAndMargins = 60; // Suma de paddings, margins, etc. dentro de editorSection
                container.style.height = `calc(100% - ${controlsHeight + titleHeight + paddingAndMargins}px)`;


                if (!editor) { // Crear solo si no existe o fue destruido

                    editor = monaco.editor.create(container, {
                        value: JSON.stringify(json, null, 2),
                        language: 'json',
                        theme: 'vs-dark',
                        scrollBeyondLastLine: false,
                        automaticLayout: true, // Muy importante
                        autoClosingBrackets: 'always',
                        autoClosingOvertype: 'always',
                        autoClosingQuotes: 'always',
                        colorDecorators: true
                    });

                    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                        validate: true,
                        allowComments: false, // o true si usas comentarios
                        schemas: [
                            {
                                uri: "http://misitio.com/schemas/origomap.json", // Un URI único para tu schema
                                // fileMatch: ["*"], // Aplica a todos los JSON, o sé más específico
                                schema: { /* ... Aquí va tu objeto schema completo ... */ }
                            }
                        ]
                    });
                } else { // Si ya existe (raro si closeJsonEditor lo destruye), solo actualiza el valor
                    editor.setValue(JSON.stringify(json, null, 2));
                    editor.layout(); // Fuerza un redibujo si el contenedor cambió
                }

                currentFileName = fileName;
                currentJsonData = json;
                console.log("JSON loaded and Monaco editor initialized:", currentJsonData);
            })
            .catch(error => {
                console.error('Error loading or initializing JSON editor:', error);
                const errorDiv = document.getElementById('error-message');
                if (errorDiv) errorDiv.textContent = 'Error loading JSON editor: ' + error.message;

                const editorSection = document.getElementById('json-editor-section');
                if (editorSection) editorSection.style.display = 'none'; // Ocultar en error
                document.body.classList.remove('has-editor-active'); // Restaurar scroll en error
            });
    };

    window.closeJsonEditor = function () {
        if (editor) {
            editor.dispose();
            editor = null;
        }
        const container = document.getElementById('monaco-editor-container');
        if (container) container.innerHTML = ''; // Limpia el contenedor

        const editorSection = document.getElementById('json-editor-section');
        if (editorSection) {
            editorSection.style.display = 'none';
            // Opcional: resetear los estilos de posicionamiento, aunque display:none los anula visualmente
            editorSection.style.position = '';
            editorSection.style.top = '';
            editorSection.style.left = '';
            editorSection.style.transform = '';
            editorSection.style.width = '';
            editorSection.style.maxWidth = '';
            editorSection.style.height = '';
            // Los de background, border, etc., pueden quedarse o resetearse si quieres
        }

        document.body.classList.remove('has-editor-active'); // Restaura el scroll del body

        currentFileName = null;
        currentJsonData = {};
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) errorDiv.textContent = '';
        console.log("JSON Editor closed and cleaned.");
    };

    window.saveJson = function () { /* ... unchanged ... */
        if (!editor) { alert('Error: Editor is not initialized.'); return; }
        const editedJsonValue = editor.getValue(); let editedJson;
        try { editedJson = JSON.parse(editedJsonValue); } catch (error) { alert('Invalid JSON in editor: ' + error.message); return; }
        if (!currentFileName) { alert('Error: No file selected to save.'); return; }
        fetch(`/origoadmin/save-json?file=${encodeURIComponent(currentFileName)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editedJson) })
            .then(response => { if (response.ok) { alert('JSON saved successfully!'); /* closeJsonEditor(); */ } else { response.text().then(text => { console.error('Error saving JSON:', response.status, text); alert('Error saving JSON. Status: ' + response.status + (text ? `\nMsg: ${text}` : '')); }).catch(() => { console.error('Error saving JSON:', response.status); alert('Error saving JSON. Status: ' + response.status); }); } })
            .catch(error => { console.error('Network error saving JSON:', error); alert('Network error saving JSON. Check console.'); });
    };

    window.openEditModal = function () { /* ... unchanged ... */
        if (!editor) { alert("Please open a JSON file first."); return; }
        document.querySelector('#edit-modal .title').textContent = "Edit Element";
        const editSelector = document.getElementById('edit-selector');
        editSelector.innerHTML = `<option value="wms">Edit WMS Layer</option><option value="wfs">Edit WFS Layer</option><option value="wmts">Edit WMTS Layer</option><option value="style">Edit Style</option><option value="source">Edit Source</option><option value="group">Edit Group (Legend)</option>`;
        document.getElementById('edit-modal').style.display = 'block';
        handleEditSelection();
    };
    window.closeEditModal = function () { /* ... unchanged ... */
        document.getElementById('edit-modal').style.display = 'none'; document.getElementById('edit-form').innerHTML = '';
    };
    window.openCreateModal = function () { /* ... unchanged ... */
        if (!editor) { alert("Please open a JSON file first."); return; }
        document.querySelector('#create-modal .title').textContent = "Create New Element";
        const createSelector = document.getElementById('create-selector');
        createSelector.innerHTML = `<option value="wms">New WMS Layer</option><option value="wmts">New WMTS Layer</option><option value="wfs">New WFS Layer</option><option value="style">New Style</option><option value="source">New Source</option><option value="group">New Group (Legend)</option>`;
        document.getElementById('create-modal').style.display = 'block';
        handleCreateSelection();
    };
    window.closeCreateModal = function () { /* ... unchanged ... */
        document.getElementById('create-modal').style.display = 'none'; document.getElementById('create-form').innerHTML = '';
    };
    window.openDeleteModal = function () { /* ... unchanged ... */
        if (!editor) { alert("Please open a JSON file first."); return; }
        document.querySelector('#delete-modal .title').textContent = "Delete Element";
        const deleteSelector = document.getElementById('delete-selector');
        deleteSelector.innerHTML = `<option value="">-- Select Type --</option><option value="layer">Layer</option><option value="style">Style</option><option value="source">Source</option><option value="group">Group (Legend)</option>`;
        document.getElementById('delete-modal').style.display = 'block';
        handleDeleteTypeSelection();
    };
    window.closeDeleteModal = function () { /* ... unchanged ... */
        document.getElementById('delete-modal').style.display = 'none'; document.getElementById('delete-element-options').innerHTML = '<p class="help">Select element type first.</p>'; document.getElementById('delete-confirm-button').disabled = true;
    };
    window.handleDeleteTypeSelection = function () { /* ... unchanged ... */
        const deleteType = document.getElementById('delete-selector').value; const optsContainer = document.getElementById('delete-element-options'); const delButton = document.getElementById('delete-confirm-button'); optsContainer.innerHTML = ''; delButton.disabled = true; if (!deleteType) { optsContainer.innerHTML = '<p class="help">Select element type first.</p>'; return; } let elOpts = []; try { const jsonData = editor ? JSON.parse(editor.getValue()) : currentJsonData; currentJsonData = jsonData; switch (deleteType) { case 'layer': if (jsonData.layers) elOpts = jsonData.layers.map(l => ({ value: l.name, text: `${l.title || l.name} (${l.type || '?'})` })); break; case 'style': if (jsonData.styles) elOpts = Object.keys(jsonData.styles).map(n => ({ value: n, text: n })); break; case 'source': if (jsonData.source) elOpts = Object.keys(jsonData.source).map(n => ({ value: n, text: n })); break; case 'group': if (jsonData.groups) { const collect = (grps, pfx = '') => { grps.forEach(g => { elOpts.push({ value: g.name, text: pfx + (g.title || g.name) }); if (g.groups) collect(g.groups, pfx + '- '); }); }; collect(jsonData.groups); } break; } if (elOpts.length > 0) { let selHtml = createSelect('delete-element-selector', `Select ${deleteType} to Delete`, elOpts, '', '', true, false); optsContainer.innerHTML = selHtml; delButton.disabled = false; } else { optsContainer.innerHTML = `<p class="help has-text-warning">No ${deleteType} elements found.</p>`; } } catch (e) { console.error("Error populating delete options:", e); optsContainer.innerHTML = '<p class="help is-danger">Error reading data.</p>'; }
    }
    window.applyDelete = function () { /* ... unchanged ... */
        const delType = document.getElementById('delete-selector').value; const elSel = document.getElementById('delete-element-selector'); const elName = elSel ? elSel.value : null; if (!delType || !elName) { alert("Select type and element first."); return; } if (!editor) { alert("Editor not ready."); return; } let confMsg = `Delete ${delType} "${elName}"?\nCannot be undone.`; if (delType === 'source') confMsg += "\n\nWarning: Layers using this source might break."; if (delType === 'group') confMsg += "\n\nWarning: Affects layers in this group & legend."; if (!confirm(confMsg)) return; console.log(`Deleting ${delType}: ${elName}`); try { let jsonData = JSON.parse(editor.getValue()); let deleted = false; switch (delType) { case 'layer': if (jsonData.layers) { const len = jsonData.layers.length; jsonData.layers = jsonData.layers.filter(l => l.name !== elName); deleted = jsonData.layers.length < len; } break; case 'style': if (jsonData.styles && jsonData.styles.hasOwnProperty(elName)) { delete jsonData.styles[elName]; deleted = true; } break; case 'source': if (jsonData.source && jsonData.source.hasOwnProperty(elName)) { delete jsonData.source[elName]; deleted = true; } break; case 'group': const findAndRem = (n, grps) => { for (let i = grps.length - 1; i >= 0; i--) { if (grps[i].name === n) { grps.splice(i, 1); return true; } if (grps[i].groups) if (findAndRem(n, grps[i].groups)) return true; } return false; }; if (jsonData.groups) deleted = findAndRem(elName, jsonData.groups); break; } if (deleted) { currentJsonData = jsonData; editor.setValue(JSON.stringify(jsonData, null, 2)); console.log(`${delType} "${elName}" deleted.`); closeDeleteModal(); alert(`${delType.charAt(0).toUpperCase() + delType.slice(1)} "${elName}" deleted.\nPress "Save Changes" to make permanent.`); } else { alert(`Could not find/delete ${delType} "${elName}".`); handleDeleteTypeSelection(); } } catch (error) { console.error("Error deleting:", error); alert("Error deleting element: " + error.message); }
    };





    // --- Funciones Auxiliares de Formulario ---
    function createField(id, label, type = 'text', value = '', helpText = '', required = false, otherAttributes = '') { /* ... unchanged ... */
        return `<div class="field"><label class="label" for="${id}">${label} ${required ? '<span class="has-text-danger">*</span>' : ''}</label><div class="control"><input class="input" type="${type}" id="${id}" name="${id}" value="${value}" placeholder="${helpText}" ${required ? 'required' : ''} ${otherAttributes}></div><p class="help" id="${id}-help">${helpText}</p></div>`;
    }
    function createTextarea(id, label, value = '', helpText = '', rows = 3, required = false, otherAttributes = '') { /* ... unchanged ... */
        return `<div class="field"><label class="label" for="${id}">${label} ${required ? '<span class="has-text-danger">*</span>' : ''}</label><div class="control"><textarea class="textarea" id="${id}" name="${id}" placeholder="${helpText}" rows="${rows}" ${required ? 'required' : ''} ${otherAttributes}>${value}</textarea></div><p class="help" id="${id}-help">${helpText}</p></div>`;
    }
    function createSelect(id, label, options, selectedValue = '', helpText = '', required = false, allowEmpty = true) { /* ... unchanged ... */
        let optionsHtml = allowEmpty ? '<option value="">-- Select --</option>' : ''; options.forEach(opt => { const v = typeof opt === 'object' ? opt.value : opt; const t = typeof opt === 'object' ? opt.text : opt; const s = v !== '' && v === selectedValue ? ' selected' : ''; optionsHtml += `<option value="${v}"${s}>${t}</option>`; }); return `<div class="field"><label class="label" for="${id}">${label} ${required ? '<span class="has-text-danger">*</span>' : ''}</label><div class="control"><div class="select is-fullwidth"><select id="${id}" name="${id}" ${required ? 'required' : ''}>${optionsHtml}</select></div></div><p class="help" id="${id}-help">${helpText}</p></div>`;
    }
    function createCheckbox(id, label, checked = false) { /* ... unchanged ... */
        return `<div class="field"><div class="control"><label class="checkbox"><input type="checkbox" id="${id}" name="${id}" ${checked ? 'checked' : ''}> ${label}</label></div></div>`;
    }
    function createRadio(name, options, selectedValue, label) { /* ... unchanged ... */
        let rH = `<label class="label">${label}</label><div class="control">`; options.forEach(opt => { const c = opt.value === selectedValue ? ' checked' : ''; rH += `<label class="radio"><input type="radio" name="${name}" value="${opt.value}"${c}> ${opt.text}</label>`; }); rH += '</div>'; return `<div class="field">${rH}</div>`;
    }

    // --- Funciones de Validación ---
    function showFieldError(elementId, message) { /* ... unchanged ... */
        const el = document.getElementById(elementId); const h = document.getElementById(`${elementId}-help`); if (el) { el.classList.add('is-danger'); if (el.tagName === 'SELECT') el.closest('.select')?.classList.add('is-danger'); } if (h) { h.textContent = message; h.classList.add('is-danger'); }
    }
    function clearFieldError(elementId) { /* ... unchanged ... */
        const el = document.getElementById(elementId); const h = document.getElementById(`${elementId}-help`); const o = el?.getAttribute('placeholder') || ''; if (el) { el.classList.remove('is-danger'); if (el.tagName === 'SELECT') el.closest('.select')?.classList.remove('is-danger'); } if (h) { h.textContent = o; h.classList.remove('is-danger'); }
    }
    function validateModalForm(formContainerId) { /* ... unchanged ... */
        let isValid = true; const c = document.getElementById(formContainerId);
        if (!c) return true;
        c.querySelectorAll('.input, .textarea, .select select').forEach(el => clearFieldError(el.id));
        c.querySelectorAll('input[required], textarea[required], select[required]').forEach(el => { if (!el.value) { showFieldError(el.id, `${el.previousElementSibling?.textContent?.replace('*', '').trim() || 'This field'} is required.`); isValid = false; } }); c.querySelectorAll('input[type="url"]').forEach(el => { if (el.value) { try { new URL(el.value); } catch (_) { showFieldError(el.id, 'Please enter a valid URL (e.g., http://...).'); isValid = false; } } }); c.querySelectorAll('input[type="number"]').forEach(el => { if (el.value && isNaN(parseFloat(el.value))) { showFieldError(el.id, 'Must be a valid number.'); isValid = false; } else if (el.value) { const v = parseFloat(el.value), min = parseFloat(el.getAttribute('min')), max = parseFloat(el.getAttribute('max')); if (!isNaN(min) && v < min) { showFieldError(el.id, `Value must be ${min} or higher.`); isValid = false; } if (!isNaN(max) && v > max) { showFieldError(el.id, `Value must be ${max} or lower.`); isValid = false; } } }); c.querySelectorAll('textarea[data-validate-json="true"]').forEach(el => { if (el.value) { try { JSON.parse(el.value); } catch (e) { showFieldError(el.id, 'Invalid JSON: ' + e.message); isValid = false; } } }); c.querySelectorAll('input[data-validate-unique]').forEach(el => { const name = el.value.trim(), type = el.getAttribute('data-validate-unique'), orig = c.querySelector(`#edit-${type}-original-name`)?.value; if (name && name !== orig) { let exists = false; try { const d = JSON.parse(editor.getValue()); if (type === 'layer' && d.layers) exists = d.layers.some(i => i.name === name); if (type === 'style' && d.styles) exists = !!d.styles[name]; if (type === 'source' && d.source) exists = !!d.source[name]; if (type === 'group' && d.groups) { const _e = (n, gr) => { for (let i = 0; i < gr.length; i++) { if (gr[i].name === n) return true; if (gr[i].groups) if (_e(n, gr[i].groups)) return true; } return false; }; exists = _e(name, d.groups); } } catch (e) { console.warn("Err validating uniqueness"); } if (exists) { showFieldError(el.id, `A ${type} with the name '${name}' already exists.`); isValid = false; } } }); return isValid;
    }


    // *** NEW: Function to Load Layer List ***
    async function loadLayerList(sourceSelectId, targetLayerInputId, serviceTypeHint = null) {
        const sourceSelect = document.getElementById(sourceSelectId);
        // Target the '.control' div that contains the input/select for layers
        const targetControlDiv = document.getElementById(targetLayerInputId)?.closest('.control');

        if (!sourceSelect || !targetControlDiv) {
            console.error(`loadLayerList: Could not find source select (#${sourceSelectId}) or target control div for #${targetLayerInputId}.`);
            return;
        }

        const sourceName = sourceSelect.value;
        const originalPlaceholder = "Select Source to load layers or type manually"; // Default placeholder

        // Reset target field to a disabled input while loading or if no source
        targetControlDiv.innerHTML = `<input class="input" type="text" id="${targetLayerInputId}" placeholder="${sourceName ? 'Loading layers...' : originalPlaceholder}" disabled required>`; // Keep required
        const targetInput = document.getElementById(targetLayerInputId); // Get ref to the new input

        if (!sourceName) {
            clearFieldError(targetLayerInputId); // Clear any previous error
            targetInput.placeholder = originalPlaceholder; // Set placeholder back
            targetInput.disabled = true; // Keep disabled
            return; // No source selected
        }
        targetInput.disabled = true; // Ensure it's disabled while loading

        try {
            const sourceInfo = currentJsonData.source?.[sourceName];
            if (!sourceInfo || !sourceInfo.url) {
                throw new Error(`Source '${sourceName}' definition or URL not found.`);
            }

            const serviceType = (serviceTypeHint || sourceInfo.service || sourceInfo.type || 'WMS').toUpperCase();
            let capabilitiesUrl = sourceInfo.url;
            const urlParams = new URLSearchParams();

            if (serviceType === 'WMS') { urlParams.set('service', 'WMS'); urlParams.set('request', 'GetCapabilities'); urlParams.set('version', sourceInfo.version || '1.1.1'); }
            else if (serviceType === 'WMTS') { urlParams.set('service', 'WMTS'); urlParams.set('request', 'GetCapabilities'); urlParams.set('version', sourceInfo.version || '1.0.0'); }
            else if (serviceType === 'WFS') { urlParams.set('service', 'WFS'); urlParams.set('request', 'GetCapabilities'); urlParams.set('version', sourceInfo.version || '1.1.0'); }
            else { throw new Error(`Service type '${serviceType}' not supported.`); }
            capabilitiesUrl += (capabilitiesUrl.includes('?') ? '&' : '?') + urlParams.toString();

            console.log(`Workspaceing capabilities: ${capabilitiesUrl}`);
            targetControlDiv.classList.add('is-loading'); // Add Bulma loading state to control

            // --- Fetch (Direct method, requires CORS or Proxy) ---
            // IMPORTANT: If CORS fails, implement a backend proxy route
            // e.g., const response = await fetch(`/origoadmin/get-capabilities?url=${encodeURIComponent(capabilitiesUrl)}`);
            let response;
            try { response = await fetch(capabilitiesUrl); }
            catch (networkError) { throw new Error(`Network error. Check CORS/URL. (${networkError.message})`); }

            if (!response.ok) { throw new Error(`Server error (${response.status}).`); }
            const xmlText = await response.text();

            // --- Parse XML ---
            const parser = new DOMParser(); const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const parseError = xmlDoc.querySelector("parsererror"); if (parseError) { console.error("XML Parse Error:", parseError.textContent); throw new Error("Invalid XML response from server."); }
            const exception = xmlDoc.querySelector("ExceptionReport Exception, ServiceExceptionReport ServiceException"); if (exception) { console.error("OGC Error:", exception.textContent); throw new Error(`Server error: ${exception.textContent.substring(0, 100)}...`); }

            // --- Extract Layers ---
            let layerOptions = [];
            if (serviceType === 'WMS') { const layers = xmlDoc.querySelectorAll("Capability > Layer"); const collect = (nodes) => { nodes.forEach(n => { const nameEl = n.querySelector(":scope > Name"); if (nameEl) { const name = nameEl.textContent; const titleEl = n.querySelector(":scope > Title"); layerOptions.push({ value: name, text: `${titleEl ? titleEl.textContent.trim() : name} (${name})` }); } const nested = n.querySelectorAll(":scope > Layer"); if (nested.length > 0) collect(nested); }); }; collect(layers); }
            else if (serviceType === 'WMTS') { xmlDoc.querySelectorAll("Contents > Layer > Identifier").forEach(idEl => { const name = idEl.textContent; const titleEl = idEl.parentNode.querySelector("Title"); layerOptions.push({ value: name, text: `${titleEl ? titleEl.textContent.trim() : name} (${name})` }); }); }
            else if (serviceType === 'WFS') { xmlDoc.querySelectorAll("FeatureTypeList > FeatureType > Name").forEach(nameEl => { const name = nameEl.textContent; const titleEl = nameEl.parentNode.querySelector("Title"); layerOptions.push({ value: name, text: `${titleEl ? titleEl.textContent.trim() : name} (${name})` }); }); }

            // --- Populate Select ---
            if (layerOptions.length > 0) {
                layerOptions.sort((a, b) => a.text.localeCompare(b.text));

                // --- INICIO DE LA MODIFICACIÓN ---
                // Ya tenemos una etiqueta fuera del targetControlDiv.
                // Solo necesitamos construir el HTML para el elemento select y su contenedor 'div.select'.
                let selectElementHtml = `<div class="select is-fullwidth">
                                            <select id="${targetLayerInputId}" name="${targetLayerInputId}" required>`; // Mantenemos 'required'

                // Asumimos que para un selector de capas, no quieres una opción vacía si hay capas.
                // Si sí la quisieras, la añadirías aquí:
                // selectElementHtml += '<option value="">-- Select a Layer --</option>';

                layerOptions.forEach(opt => {
                    // opt debe ser un objeto como { value: "nombre_capa", text: "Nombre Capa (nombre_capa)" }
                    const optionValue = opt.value; // El valor real a enviar
                    const optionText = opt.text;   // Lo que ve el usuario
                    // Intentar preseleccionar si el input original (ahora reemplazado) tenía un valor que coincide
                    const preselectedValue = document.getElementById(targetLayerInputId)?.value; // Valor del input original si existía
                    const selectedAttr = (preselectedValue && preselectedValue === optionValue) ? ' selected' : '';
                    selectElementHtml += `<option value="${optionValue}"${selectedAttr}>${optionText}</option>`;
                });
                selectElementHtml += `</select></div>`;

                // Si necesitas el <p class="help">, también lo puedes añadir aquí, pero la etiqueta NO.
                // selectElementHtml += `<p class="help" id="${targetLayerInputId}-help">Please select a layer from the list.</p>`;

                targetControlDiv.innerHTML = selectElementHtml; // Reemplaza el contenido del div.control
                // --- FIN DE LA MODIFICACIÓN ---

                clearFieldError(targetLayerInputId);
            } else {
                throw new Error(`No layers found for source '${sourceName}'.`);
            }

        } catch (error) {
            console.error("Error loading layer list:", error);
            // Revert to text input, show error
            targetControlDiv.innerHTML = createField(targetLayerInputId, 'Layer Name', 'text', '', `Error: ${error.message}. Type manually.`, true).replace('<div class="field">', '').replace('</div>', ''); // Generate input+help, remove outer field div
            showFieldError(targetLayerInputId, `Error loading: ${error.message}`);
            document.getElementById(targetLayerInputId).disabled = false; // Enable manual input on error
        } finally {
            targetControlDiv.classList.remove('is-loading'); // Remove loading state
        }
    }


    // --- Lógica de Edición (Attach listener in loadEditElementDetails) ---
    window.handleEditSelection = function () { /* ... sin cambios ... */
        const editType = document.getElementById('edit-selector').value; populateEditForm(editType);
    };
    function populateEditForm(editType) { /* ... sin cambios ... */
        const editForm = document.getElementById('edit-form'); editForm.innerHTML = ''; let formHtml = ''; try { let jsonData = editor ? JSON.parse(editor.getValue()) : currentJsonData; currentJsonData = jsonData; formHtml += `<div class="field"><label class="label">Select ${editType} to Edit</label><div class="control"><div class="select is-fullwidth"><select id="edit-element-selector">`; let optsAvail = false; switch (editType) { case 'wms': case 'wfs': case 'wmts': if (jsonData.layers?.length) { const lOfType = jsonData.layers.filter(l => l.type?.toUpperCase() === editType.toUpperCase()); if (lOfType.length) { lOfType.forEach(l => { formHtml += `<option value="${l.name}">${l.title || l.name}</option>`; }); optsAvail = true; } } break; case 'style': if (jsonData.styles) { for (const n in jsonData.styles) { formHtml += `<option value="${n}">${n}</option>`; } optsAvail = Object.keys(jsonData.styles).length > 0; } break; case 'source': if (jsonData.source) { for (const n in jsonData.source) { formHtml += `<option value="${n}">${n}</option>`; } optsAvail = Object.keys(jsonData.source).length > 0; } break; case 'group': if (jsonData.groups?.length) { const addOpts = (grps, pfx = '') => { grps.forEach(g => { formHtml += `<option value="${g.name}">${pfx}${g.title || g.name}</option>`; if (g.groups) addOpts(g.groups, pfx + '- '); }); }; addOpts(jsonData.groups); optsAvail = true; } break; } if (!optsAvail) { formHtml += `<option value="">No ${editType} elements found</option>`; } formHtml += '</select></div></div></div>'; formHtml += '<div id="edit-details-form" style="margin-top:15px;border-top:1px solid #dbdbdb;padding-top:15px;"></div>'; editForm.innerHTML = formHtml; const elSel = document.getElementById('edit-element-selector'); if (elSel) { elSel.addEventListener('change', () => loadEditElementDetails(editType)); if (optsAvail) loadEditElementDetails(editType); else document.getElementById('edit-details-form').innerHTML = `<p>No ${editType} selected or available.</p>`; } } catch (e) { console.error(`Error populating edit form for ${editType}:`, e); editForm.innerHTML = '<p class="has-text-danger">Error loading edit options.</p>'; }
    }

    // /public/js/other/script_origo.js (loadEditElementDetails MODIFICADA)

    function loadEditElementDetails(editType) {
        console.log(`[Load Edit] Type: ${editType}`);
        const detailsForm = document.getElementById('edit-details-form');
        const selector = document.getElementById('edit-element-selector');
        if (!detailsForm || !selector) { console.error("[Load Edit] Crucial elements missing (form or selector)"); return; }

        const selectedName = selector.value;
        console.log(`[Load Edit] Selected Name: '${selectedName}'`);
        detailsForm.innerHTML = '<p>Loading details...</p>'; // Mensaje de carga

        if (!selectedName) { detailsForm.innerHTML = `<p>No ${editType} selected.</p>`; return; }

        try {
            let elementData;
            let formHtml = '';
            let jsonData = currentJsonData; // Usar la variable global cargada
            let targetLayerInputId = null; // Para WMS/WFS/WMTS
            let sourceSelectId = 'edit-layer-source'; // Para WMS/WFS/WMTS
            let currentSourceValue = null; // Para WMS/WFS/WMTS

            if (!jsonData || typeof jsonData !== 'object') {
                throw new Error("currentJsonData is invalid or not loaded.");
            }

            console.log("[Load Edit] Finding element data...");
            switch (editType) {
                case 'wms': case 'wfs': case 'wmts':
                    if (!jsonData.layers || !Array.isArray(jsonData.layers)) throw new Error(`'layers' array missing or invalid in JSON data.`);
                    elementData = jsonData.layers.find(l => l.name === selectedName);
                    if (elementData) {
                        console.log("[Load Edit] Found layer data:", elementData);
                        try {
                            formHtml = generateLayerEditForm(elementData, elementData.type.toUpperCase()); // Genera HTML
                            console.log("[Load Edit] Generated Layer Form HTML (partial):", formHtml.substring(0, 200) + "...");
                            if (!formHtml) throw new Error("generateLayerEditForm returned empty.");
                        } catch (genError) { throw new Error(`Error generating layer form: ${genError.message}`); }
                        // Determina IDs para cargar lista de capas después
                        if (elementData.type.toUpperCase() === 'WMS') targetLayerInputId = 'edit-layer-layers';
                        else if (elementData.type.toUpperCase() === 'WFS') targetLayerInputId = 'edit-layer-typeName';
                        else if (elementData.type.toUpperCase() === 'WMTS') targetLayerInputId = 'edit-layer-layer';
                        currentSourceValue = elementData.source;
                    } else { console.warn(`[Load Edit] Layer '${selectedName}' not found in JSON data.`); }
                    break;
                case 'style':
                    if (!jsonData.styles) throw new Error("'styles' object missing in JSON data.");
                    elementData = jsonData.styles[selectedName];
                    if (elementData) {
                        console.log("[Load Edit] Found style data:", elementData);
                        try { formHtml = generateStyleEditForm(selectedName, elementData); } catch (e) { throw new Error(`Error in generateStyleEditForm: ${e.message}`); }
                    } else { console.warn(`[Load Edit] Style '${selectedName}' not found.`); }
                    break;
                case 'source':
                    if (!jsonData.source) throw new Error("'source' object missing in JSON data.");
                    elementData = jsonData.source[selectedName];
                    if (elementData) {
                        console.log("[Load Edit] Found source data:", elementData);
                        try {
                            // Generar HTML directamente aquí para sources (como antes)
                            formHtml += `<input type="hidden" id="edit-source-original-name" value="${selectedName}">`;
                            formHtml += createField('edit-source-name', 'Name (ID)', 'text', selectedName, 'Unique ID (read-only)', true, 'readonly');
                            formHtml += createField('edit-source-url', 'URL', 'url', elementData.url || '', 'Service base URL', true);
                            formHtml += createField('edit-source-type', 'Type', 'text', elementData.service || elementData.type || '', 'Type (WMS, WFS...)', true, 'readonly');
                            formHtml += createField('edit-source-version', 'Version', 'text', elementData.version || '');
                            formHtml += createField('edit-source-workspace', 'Workspace', 'text', elementData.workspace || '');
                            if ((elementData.service || elementData.type)?.toUpperCase() === 'WMTS') { formHtml += createField('edit-source-matrixSet', 'MatrixSet (WMTS)', 'text', elementData.matrixSet || '', 'Required for WMTS'); }
                        } catch (e) { throw new Error(`Error generating source form: ${e.message}`); }
                    } else { console.warn(`[Load Edit] Source '${selectedName}' not found.`); }
                    break;
                case 'group':
                    if (!jsonData.groups) throw new Error("'groups' array missing in JSON data.");
                    const _findGrp = (n, grps) => { /* ... tu función _findGrp ... */ };
                    elementData = _findGrp(selectedName, jsonData.groups || []);
                    if (elementData) {
                        console.log("[Load Edit] Found group data:", elementData);
                        try {
                            // Generar HTML directamente aquí para groups (como antes)
                            formHtml += `<input type="hidden" id="edit-group-name" value="${elementData.name}">`;
                            formHtml += createField('edit-group-title', 'Title', 'text', elementData.title || '', 'Title in legend', true);
                            formHtml += createCheckbox('edit-group-expanded', 'Expanded by Default', elementData.expanded || false);
                        } catch (e) { throw new Error(`Error generating group form: ${e.message}`); }
                    } else { console.warn(`[Load Edit] Group '${selectedName}' not found.`); }
                    break;
            } // Fin switch

            // Asignar HTML al formulario (si se encontró data y se generó HTML)
            if (!elementData) {
                detailsForm.innerHTML = `<p class="has-text-warning">Data not found for ${editType} "${selectedName}".</p>`;
            } else if (formHtml) {
                detailsForm.innerHTML = formHtml;
                console.log("[Load Edit] Form HTML successfully set.");
            } else if (!formHtml && elementData) {
                // Esto indicaría un problema en generateLayer/StyleEditForm que no lanzó error
                detailsForm.innerHTML = `<p class="has-text-danger">Error: Form generation failed silently for ${editType} "${selectedName}".</p>`;
                console.error("[Load Edit] Form HTML is empty but elementData was found.");
            } else {
                // Caso genérico si algo raro pasó
                detailsForm.innerHTML = `<p class="has-text-danger">Failed to load details for ${editType} "${selectedName}".</p>`;
            }


            // Intentar cargar lista de capas SI es relevante y se generó el form
            if (targetLayerInputId && elementData && formHtml) {
                console.log("[Load Edit] Attempting to attach listener and load layer list...");
                setTimeout(() => {
                    const sourceDropdown = document.getElementById(sourceSelectId); // ID es 'edit-layer-source'
                    const targetLayerElement = document.getElementById(targetLayerInputId); // ID es 'edit-layer-layers' o 'edit-layer-typeName', etc.

                    if (sourceDropdown && targetLayerElement) {
                        sourceDropdown.addEventListener('change', (event) => {
                            console.log(`[Load Edit] Source changed for ${editType}, reloading layer list...`);
                            // Pasar el tipo correcto (ej 'WFS') a loadLayerList
                            loadLayerList(sourceSelectId, targetLayerInputId, elementData.type.toUpperCase());
                        });
                        console.log(`[Load Edit] Attached listener to source dropdown #${sourceSelectId}.`);

                        // Cargar lista inicial si hay una fuente seleccionada
                        if (currentSourceValue) {
                            console.log(`[Load Edit] Triggering initial layer list load for source: ${currentSourceValue}`);
                            loadLayerList(sourceSelectId, targetLayerInputId, elementData.type.toUpperCase());
                        } else {
                            console.log("[Load Edit] No initial source value, list not loaded automatically.");
                        }
                    } else {
                        console.error(`[Load Edit] Could not find source (#${sourceSelectId}) or target (#${targetLayerInputId}) element inside setTimeout.`);
                    }
                }, 50); // Delay pequeño
            }

        } catch (e) {
            console.error(`[Load Edit] Error loading details for ${editType} '${selectedName}':`, e);
            detailsForm.innerHTML = `<p class="has-text-danger">Error loading details: ${e.message}</p>`;
        }
    } // Fin loadEditElementDetails

    // generateLayerEditForm - MODIFIED to create initial placeholder input
    // /public/js/other/script_origo.js (generateLayerEditForm con más logs)

    // En /public/js/other/script_origo.js
    // DENTRO de require(['vs/editor/editor.main'], function () { ... });

    function generateLayerEditForm(layerData, layerType) {
        console.log(`[Generate Edit Form] Generating for ${layerType} layer:`, layerData);
        let fH = ''; // Usaremos fH para el form HTML

        try {
            const isWMS = layerType === 'WMS';
            const isWFS = layerType === 'WFS';
            const isWMTS = layerType === 'WMTS';

            let serverLayerFieldName = 'Layer Name on Server (ID)'; // Etiqueta por defecto
            let serverLayerInputId = '';    // ID del campo para el nombre de la capa del servidor
            let serverLayerValue = '';      // Valor actual del nombre de la capa del servidor

            if (isWMS) {
                serverLayerInputId = 'edit-layer-layers';
                serverLayerValue = layerData.layers || '';
                serverLayerFieldName = 'Layer Name(s) on Server (ID)';
            } else if (isWFS) {
                serverLayerInputId = 'edit-layer-typeName';
                serverLayerValue = layerData.typeName || ''; // WFS usa typeName
                serverLayerFieldName = 'Feature Type Name (ID)';
            } else if (isWMTS) {
                serverLayerInputId = 'edit-layer-layer';
                serverLayerValue = layerData.layer || '';
                serverLayerFieldName = 'Layer Name on Server (ID)';
            }

            // Campo oculto para el nombre original (ID de Origo), útil para la validación si se permitiera cambiar
            // pero como el nombre ahora es el nombre de la capa del servidor y lo haremos readonly,
            // 'selectedName' en applyEditChanges ya es el ID.
            fH += `<input type="hidden" id="edit-layer-original-name" value="${layerData.name || ''}">`;

            // No creamos un campo 'edit-layer-name' separado.
            // El ID de la capa Origo ('name') será el mismo que el nombre de la capa del servidor.
            // Este campo será de solo lectura en el formulario de edición.
            fH += createField(serverLayerInputId, serverLayerFieldName, 'text', serverLayerValue, 'Layer ID (from server, read-only)', true, 'readonly');


            fH += createField('edit-layer-title', 'Title', 'text', layerData.title || '', 'Legend title', true);

            // --- Selector de Grupo (Corregido para poblar y preseleccionar) ---
            const grpOpts = [{ value: '', text: '(No Group)' }];
            if (currentJsonData.groups && Array.isArray(currentJsonData.groups)) {
                window.populateGroupParentOptions(currentJsonData.groups, grpOpts); // Usa tu función helper
            }
            fH += createSelect('edit-layer-group', 'Group', grpOpts, layerData.group || '', 'Assign to legend group', false, true);
            // No necesitas el input para nuevo grupo aquí, ya que eso es para la creación.

            // --- Selector de Fuente (Corregido para poblar y preseleccionar) ---
            const srcOpts = [{ value: '', text: '-- Select Source --' }];
            if (currentJsonData.source) {
                for (const n in currentJsonData.source) {
                    srcOpts.push({ value: n, text: n });
                }
            }
            fH += createSelect('edit-layer-source', 'Source', srcOpts, layerData.source || '', 'Source defined in "source"', true, false);


            // --- Campos específicos del tipo de capa (WMS, WFS, WMTS) ---
            if (isWMS) {
                const fmtWMS = ['image/png', 'image/jpeg', 'image/gif', 'image/tiff'].map(f => ({ value: f, text: f }));
                fH += createSelect('edit-layer-format', 'Image Format', fmtWMS, layerData.format || 'image/png');
                fH += createRadio('edit-layer-tiled', [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], String(layerData.tiled !== false), 'Tiled');
                // El campo 'layers' (serverLayerInputId) ya está arriba y es readonly.
                // Si permitieras cambiarlo (ej. si cambia la fuente), necesitarías que loadLayerList se active.
            } else if (isWFS) {
                fH += createField('edit-layer-geometryName', 'Geometry Attribute', 'text', layerData.geometryName || 'geom');
                fH += createField('edit-layer-outputFormat', 'Output Format', 'text', layerData.outputFormat || 'application/json');
                fH += createCheckbox('edit-layer-editable', 'Editable', layerData.editable || false);
                const attributesTextareaId = 'edit-layer-attributes-json';
                fH += `<div class="field">
         <label class="label" for="${attributesTextareaId}">Attributes (JSON)
           <button type="button" class="button is-small is-link is-outlined ml-2"
                   onclick="fetchAndPopulateWfsAttributes('edit-layer-source', '${serverLayerInputId}', '${attributesTextareaId}', event)" 
                   title="Fetch attributes from selected Feature Type">
             <span class="icon is-small"><i class="fas fa-sync-alt"></i></span>
             <span>Fetch</span>
           </button>
         </label>
                     <div class="control">
                       <textarea class="textarea" id="${attributesTextareaId}" name="${attributesTextareaId}" rows="5" data-validate-json="true">${layerData.attributes ? JSON.stringify(layerData.attributes, null, 2) : '[]'}</textarea>
                     </div>
                     <p class="help">e.g., [{"name":"prop", "title":"Title"}]</p>
                   </div>`;
            } else if (isWMTS) {
                fH += createField('edit-layer-matrixSet', 'Matrix Set', 'text', layerData.matrixSet || '', 'e.g., 3006', true);
                fH += createField('edit-layer-wmts-style', 'Server Style', 'text', layerData.style || 'default'); // WMTS 'style' es el estilo del servidor
                const fmtWMTS = ['image/png', 'image/jpeg'].map(f => ({ value: f, text: f }));
                fH += createSelect('edit-layer-format', 'Image Format', fmtWMTS, layerData.format || 'image/png');
            }

            // Campos comunes finales
            fH += createField('edit-layer-attribution', 'Attribution', 'text', layerData.attribution || '');
            fH += createCheckbox('edit-layer-queryable', 'Queryable', layerData.queryable !== false);
            fH += createCheckbox('edit-layer-visible', 'Visible by Default', layerData.visible || false);

            // Selector de Estilo Origo (solo para WMS y WFS)
            if (isWMS || isWFS) {
                const origoStyOpts = [{ value: '', text: '(Default Origo Style)' }];
                if (currentJsonData.styles) {
                    for (const n in currentJsonData.styles) {
                        origoStyOpts.push({ value: n, text: n });
                    }
                }
                fH += createSelect('edit-layer-origo-style', 'Origo Style Override', origoStyOpts, layerData.style || '', 'Optional. Select a style defined in "styles"', false, true);
            }

            console.log("[Generate Edit Form] Form generated successfully for layer:", layerData.name);
            return fH;

        } catch (error) {
            console.error(`[Generate Edit Form] Error generating form for ${layerType}:`, error);
            return `<p class="has-text-danger">Error generating form details: ${error.message}</p>`;
        }
    }
    // /public/js/other/script_origo.js

function generateStyleEditForm(styleName, styleData) {
    let fH = ''; // Usaremos fH para el form HTML
    fH += `<input type="hidden" id="edit-style-name" value="${styleName}">`; // ID del estilo que se está editando
    fH += `<h4>Editing Style: ${styleName}</h4>`;
    let dType = 'json'; // Por defecto, se asume que se edita el JSON crudo

    // Detectar el tipo de estilo simple (si aplica)
    if (Array.isArray(styleData) && styleData.length > 0 && Array.isArray(styleData[0]) && styleData[0].length > 0) {
        const r = styleData[0][0];
        if (r.circle) dType = 'simple_point';
        else if (r.icon) dType = 'icon';
        else if (r.text) dType = 'text';
        else if (r.stroke && !r.fill) dType = 'simple_line';
        else if (r.fill && r.stroke) dType = 'simple_polygon';
    }

    // --- AÑADIR CAMPO OCULTO CON EL TIPO DETECTADO ---
    fH += `<input type="hidden" id="edit-style-detected-type" value="${dType}">`;
    fH += `<p>Detected type: ${dType} (basic detection)</p>`;


    // Generar campos simples si es un tipo conocido
    if (['simple_point', 'icon', 'text', 'simple_line', 'simple_polygon'].includes(dType)) {
        fH += '<p class="help">Edit basic properties OR use JSON textarea below for full control.</p>';
        const r = styleData[0][0]; // El primer objeto de regla del estilo

        if (r.circle) { // Para simple_point
            fH += createField('edit_style_point_radius', 'Radius', 'number', r.circle.radius || '5', '', false, 'step="0.1"');
            fH += createField('edit_style_point_fill_color', 'Fill Color', 'color', r.circle.fill?.color || '#ffffff');
            fH += createField('edit_style_point_stroke_color', 'Stroke Color', 'color', r.circle.stroke?.color || '#000000');
            fH += createField('edit_style_point_stroke_width', 'Stroke Width', 'number', r.circle.stroke?.width || '1', '', false, 'step="0.1"');
        }
        if (r.icon) { // Para icon
            fH += createField('edit_style_icon_src', 'Icon URL', 'text', r.icon.src || '', 'e.g., /images/my_icon.png', true);
            fH += createField('edit_style_icon_scale', 'Scale', 'number', r.icon.scale || '1', '', false, 'step="0.1"');
            fH += createField('edit_style_icon_anchorX', 'Anchor X (0-1)', 'number', r.icon.anchor?.[0] || '0.5', '', false, 'step="0.01" min="0" max="1"');
            fH += createField('edit_style_icon_anchorY', 'Anchor Y (0-1)', 'number', r.icon.anchor?.[1] || '0.5', '', false, 'step="0.01" min="0" max="1"');
            fH += createField('edit_style_icon_opacity', 'Opacity (0-1)', 'number', r.icon.opacity || '1', '', false, 'step="0.01" min="0" max="1"');
        }
        if (r.stroke && dType === 'simple_line') { // Para simple_line
            fH += createField('edit_style_line_stroke_color', 'Stroke Color', 'color', r.stroke.color || '#0000ff');
            fH += createField('edit_style_line_stroke_width', 'Stroke Width', 'number', r.stroke.width || '2', '', false, 'step="0.1"');
            fH += createField('edit_style_line_stroke_dash', 'Stroke Dash (e.g., 5,5)', 'text', r.stroke.lineDash?.join(',') || '');
        }
        if (r.fill && r.stroke && dType === 'simple_polygon') { // Para simple_polygon
            let fc = '#00ff00', fo = 0.5; // Valores por defecto
            if (r.fill.color) {
                if (r.fill.color.startsWith('rgba')) {
                    const p = r.fill.color.match(/(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)/);
                    if (p) { fc = `#${parseInt(p[1]).toString(16).padStart(2, '0')}${parseInt(p[2]).toString(16).padStart(2, '0')}${parseInt(p[3]).toString(16).padStart(2, '0')}`; fo = parseFloat(p[4]); }
                } else if (r.fill.color.startsWith('#')) { fc = r.fill.color; }
            }
            fH += createField('edit_style_poly_fill_color', 'Fill Color', 'color', fc);
            fH += createField('edit_style_poly_fill_opacity', 'Fill Opacity (0-1)', 'number', fo, '', false, 'step="0.01" min="0" max="1"');
            fH += createField('edit_style_poly_stroke_color', 'Stroke Color', 'color', r.stroke.color || '#000000');
            fH += createField('edit_style_poly_stroke_width', 'Stroke Width', 'number', r.stroke.width || '1', '', false, 'step="0.1"');
            fH += createField('edit_style_poly_stroke_dash', 'Stroke Dash (e.g., 5,5)', 'text', r.stroke.lineDash?.join(',') || '');
        }
        // Puedes añadir el caso para 'text' aquí si lo necesitas
        fH += '<hr>';
    } else {
        fH += '<p class="help">This style type can only be edited via the JSON textarea below.</p>';
    }

    // Siempre mostrar el textarea para edición avanzada o tipos 'json'
    fH += createTextarea('edit-style-json-value', 'Style Definition (JSON)', JSON.stringify(styleData, null, 2), 'Edit here for full control or for complex/rule-based styles', 15, false, 'data-validate-json="true"');
    return fH;
}
   // /public/js/other/script_origo.js

// ... (require, variables globales, otras funciones como openJsonEditor, modales, helpers de formulario, buildStyleObject, generateStyleEditForm, etc.) ...
// Asegúrate de que buildStyleObject y generateStyleEditForm estén como en la respuesta #97.

window.applyEditChanges = function () {
    const editType = document.getElementById('edit-selector').value;
    const selector = document.getElementById('edit-element-selector');
    const selectedName = selector ? selector.value : null; // Nombre/ID del elemento a editar
    const formContainerId = 'edit-details-form';

    if (!editor || !selectedName) {
        alert("Editor not ready or no element selected.");
        return;
    }
    if (!validateModalForm(formContainerId)) {
        // validateModalForm debería mostrar sus propios errores de campo específicos
        return;
    }
    console.log(`[Apply Edit] Applying for: ${editType} - ${selectedName}`);
    let changed = false;

    try {
        let jsonData = JSON.parse(editor.getValue());
        const getValue = (id) => document.getElementById(id)?.value?.trim();
        const getCheckbox = (id) => document.getElementById(id)?.checked;
        const getRadio = (name) => document.querySelector(`#${formContainerId} input[name="${name}"]:checked`)?.value;
        const getSelect = (id) => document.getElementById(id)?.value;

        switch (editType) {
            case 'wms': case 'wfs': case 'wmts':
                const layerIndex = jsonData.layers.findIndex(l => l.name === selectedName);
                if (layerIndex !== -1) {
                    const originalLayerString = JSON.stringify(jsonData.layers[layerIndex]); // Copia para comparar
                    let layerToEdit = jsonData.layers[layerIndex]; // Referencia para modificar

                    // Actualizar propiedades comunes
                    layerToEdit.title = getValue('edit-layer-title') ?? layerToEdit.title;
                    layerToEdit.group = getSelect('edit-layer-group') || undefined; // undefined si está vacío
                    layerToEdit.source = getSelect('edit-layer-source') || undefined;
                    layerToEdit.attribution = getValue('edit-layer-attribution') || undefined;
                    layerToEdit.queryable = getCheckbox('edit-layer-queryable') ?? layerToEdit.queryable;
                    layerToEdit.visible = getCheckbox('edit-layer-visible') ?? layerToEdit.visible;

                    // Propiedades específicas del tipo
                    if (layerToEdit.type === 'WMS') {
                        layerToEdit.layers = getSelect('edit-layer-layers') ?? layerToEdit.layers;
                        layerToEdit.format = getSelect('edit-layer-format') ?? layerToEdit.format;
                        layerToEdit.tiled = getRadio('edit-layer-tiled') === 'true';
                        layerToEdit.style = getSelect('edit-layer-origo-style') || undefined;
                    } else if (layerToEdit.type === 'WFS') {
                        layerToEdit.typeName = getSelect('edit-layer-typeName') ?? layerToEdit.typeName;
                        layerToEdit.geometryName = getValue('edit-layer-geometryName') ?? layerToEdit.geometryName;
                        layerToEdit.outputFormat = getValue('edit-layer-outputFormat') ?? layerToEdit.outputFormat;
                        layerToEdit.editable = getCheckbox('edit-layer-editable') ?? layerToEdit.editable;
                        layerToEdit.style = getSelect('edit-layer-origo-style') || undefined;
                        const attrJson = getValue('edit-layer-attributes-json');
                        try { layerToEdit.attributes = attrJson ? JSON.parse(attrJson) : undefined; }
                        catch (e) { throw new Error("Invalid JSON in Attributes: " + e.message); }
                    } else if (layerToEdit.type === 'WMTS') {
                        layerToEdit.layer = getSelect('edit-layer-layer') ?? layerToEdit.layer;
                        layerToEdit.matrixSet = getValue('edit-layer-matrixSet') ?? layerToEdit.matrixSet;
                        layerToEdit.style = getValue('edit-layer-wmts-style') ?? layerToEdit.style; // Estilo del servidor WMTS
                        layerToEdit.format = getSelect('edit-layer-format') ?? layerToEdit.format;
                    }
                     Object.keys(layerToEdit).forEach(key => layerToEdit[key] === undefined && delete layerToEdit[key]);
                    if (JSON.stringify(layerToEdit) !== originalLayerString) {
                        changed = true;
                    }
                } else { throw new Error(`Layer '${selectedName}' not found.`); }
                break;

            case 'style':
                if (jsonData.styles && jsonData.styles.hasOwnProperty(selectedName)) {
                    const originalStyleString = JSON.stringify(jsonData.styles[selectedName]);
                    let updatedStyleObject = null;
                    const detectedType = getValue('edit-style-detected-type'); // Del campo oculto
                    console.log("[Apply Edit Style] Detected type from form:", detectedType);

                    // Intentar reconstruir desde campos simples si el tipo detectado es uno de ellos
                    if (detectedType && detectedType !== 'json' && ['simple_point', 'simple_line', 'simple_polygon', 'icon', 'text'].includes(detectedType)) {
                        try {
                            // Usar 'edit_style' como prefijo para los IDs de los campos de edición
                            updatedStyleObject = buildStyleObject(detectedType, 'edit_style');
                            console.log("[Apply Edit Style] Rebuilt style object from simple fields:", updatedStyleObject);
                        } catch (buildError) {
                            console.warn("[Apply Edit Style] Error rebuilding style from simple fields (will try textarea):", buildError.message);
                            updatedStyleObject = null; // Fallback al textarea
                        }
                    }

                    // Si no se pudo reconstruir (o es tipo 'json'), usar el contenido del textarea
                    if (!updatedStyleObject) {
                        const styleJsonText = getValue('edit-style-json-value');
                        if (styleJsonText) {
                            console.log("[Apply Edit Style] Using JSON from textarea.");
                            try {
                                updatedStyleObject = JSON.parse(styleJsonText);
                            } catch (e) {
                                throw new Error("Invalid JSON in style textarea: " + e.message);
                            }
                        } else if (detectedType !== 'json') { // Solo es error si se esperaban campos simples Y el textarea está vacío
                            throw new Error("Style data is empty. Cannot update.");
                        }
                        // Si detectedType es 'json' y el textarea está vacío, updatedStyleObject quedará null
                    }

                    if (updatedStyleObject === null && detectedType === 'json' && !getValue('edit-style-json-value')) {
                        // Caso especial: el tipo es 'json' y el usuario vació el textarea.
                        // Esto podría interpretarse como borrar el contenido del estilo.
                        console.log("[Apply Edit Style] Textarea for 'json' type is empty. Assuming intent to clear style definition.");
                        jsonData.styles[selectedName] = []; // O {} según lo que prefieras para un estilo "vacío"
                        if (originalStyleString !== JSON.stringify(jsonData.styles[selectedName])) {
                            changed = true;
                        }
                    } else if (updatedStyleObject) {
                        if (JSON.stringify(originalStyleString) !== JSON.stringify(updatedStyleObject)) {
                            jsonData.styles[selectedName] = updatedStyleObject;
                            changed = true;
                            console.log("[Apply Edit Style] Style updated in jsonData.");
                        }
                    } else {
                        console.warn("[Apply Edit Style] No updated style data could be obtained.");
                    }

                } else { throw new Error(`Style '${selectedName}' not found.`); }
                break;

            case 'source':
                if (jsonData.source && jsonData.source.hasOwnProperty(selectedName)) {
                    const originalSourceString = JSON.stringify(jsonData.source[selectedName]);
                    let sourceToEdit = jsonData.source[selectedName]; // Referencia
                    // 'edit-source-name' es readonly, el nombre original es 'selectedName'
                    sourceToEdit.url = getValue('edit-source-url') ?? sourceToEdit.url;
                    sourceToEdit.version = getValue('edit-source-version') || undefined;
                    sourceToEdit.workspace = getValue('edit-source-workspace') || undefined;
                    if ((sourceToEdit.service || sourceToEdit.type)?.toUpperCase() === 'WMTS') {
                        sourceToEdit.matrixSet = getValue('edit-source-matrixSet') || undefined;
                    }
                    Object.keys(sourceToEdit).forEach(k => sourceToEdit[k] === undefined && delete sourceToEdit[k]);
                    if (JSON.stringify(sourceToEdit) !== originalSourceString) {
                        changed = true;
                    }
                } else { throw new Error(`Source '${selectedName}' not found.`); }
                break;

            case 'group':
                // 'edit-group-name' es el ID del grupo, usualmente no se cambia el 'name' en edición, solo title/expanded
                const groupName = document.getElementById('edit-group-name')?.value; // ID original desde el campo oculto
                if (!groupName) throw new Error("Original group name not found in form.");

                const _findAndModifyGroup = (name, groups, newTitle, newExpanded) => {
                    for (let g of groups) {
                        if (g.name === name) {
                            const originalGroupString = JSON.stringify(g);
                            g.title = newTitle;
                            g.expanded = newExpanded;
                            if (JSON.stringify(g) !== originalGroupString) {
                                changed = true; // Marcar cambio
                            }
                            return true; // Encontrado y modificado (o no, si no hubo cambio)
                        }
                        if (g.groups && _findAndModifyGroup(name, g.groups, newTitle, newExpanded)) {
                            return true;
                        }
                    }
                    return false;
                };

                const newTitle = getValue('edit-group-title');
                const newExpanded = getCheckbox('edit-group-expanded');
                if (!jsonData.groups || !_findAndModifyGroup(groupName, jsonData.groups, newTitle, newExpanded)) {
                    throw new Error(`Group '${groupName}' not found for update.`);
                }
                break;
            default:
                console.warn("Unrecognized edit type:", editType);
                break;
        } // Fin switch

        if (changed) {
            currentJsonData = jsonData;
            editor.setValue(JSON.stringify(jsonData, null, 2));
            closeEditModal();
            alert("Element updated. Press 'Save Changes' in the main editor to make it permanent.");
        } else {
            console.log("[Apply Edit] No effective changes detected for", editType, selectedName);
            closeEditModal();
        }
    } catch (error) {
        console.error("[Apply Edit] Error applying edits:", error);
        alert("Error applying changes: " + error.message);
    }
};

    // --- Lógica de Creación (Attach Listener in populateCreateSelector) ---
    window.handleCreateSelection = function () { /* ... sin cambios ... */
        const createType = document.getElementById('create-selector').value; populateCreateSelector(createType);
    };


    window.fetchAndPopulateWfsAttributes = async function (sourceDropdownId, typeNameFieldId, attributesTextareaId, event) {
        const fetchButton = event.currentTarget; // Obtener el botón que fue clickeado
        const originalButtonContent = fetchButton.innerHTML; // Guardar el contenido original del botón

        if (fetchButton) {
            fetchButton.disabled = true;
            fetchButton.innerHTML = '<span class="icon is-small"><i class="fas fa-spinner fa-spin"></i></span><span>Fetching...</span>';
        }

        const sourceName = document.getElementById(sourceDropdownId)?.value;
        const typeNameElement = document.getElementById(typeNameFieldId);
        // typeName puede venir de un input (si GetCaps falló o no se usó) o de un select (si GetCaps funcionó)
        const typeName = typeNameElement?.tagName === 'SELECT' ? typeNameElement.value : typeNameElement?.value?.trim();
        const attributesTextarea = document.getElementById(attributesTextareaId);

        function restoreButton() {
            if (fetchButton && originalButtonContent) {
                fetchButton.disabled = false;
                fetchButton.innerHTML = originalButtonContent;
            }
        }

        if (!sourceName) {
            alert('Please select a WFS Source first.');
            restoreButton();
            return;
        }
        if (!typeName) {
            alert('Please provide or select a Feature Type Name first.');
            restoreButton();
            return;
        }
        if (!attributesTextarea) {
            console.error('Attributes textarea not found with ID:', attributesTextareaId);
            alert('Internal error: Attributes textarea not found.');
            restoreButton();
            return;
        }

        try {
            if (!currentJsonData || !currentJsonData.source || !currentJsonData.source[sourceName]) {
                throw new Error(`Source configuration for '${sourceName}' not found in current map JSON.`);
            }
            const sourceConfig = currentJsonData.source[sourceName];
            if (!sourceConfig.url) {
                throw new Error(`URL for source '${sourceName}' is missing in configuration.`);
            }

            let baseUrl = sourceConfig.url;
            // Si la URL de la fuente es una URL GetCapabilities, extraemos la base.
            const questionMarkIndex = baseUrl.indexOf('?');
            if (questionMarkIndex !== -1) {
                baseUrl = baseUrl.substring(0, questionMarkIndex);
            }
            // Asegurarse de que la URL base no termine con una barra si vamos a añadir '?'
            if (baseUrl.endsWith('/')) {
                baseUrl = baseUrl.slice(0, -1);
            }


            const wfsVersion = sourceConfig.version || '1.1.0'; // WFS version

            // Construir URL para DescribeFeatureType
            // Usamos URLSearchParams para construir la query string de forma segura
            const params = new URLSearchParams();
            params.set('SERVICE', 'WFS');
            params.set('VERSION', wfsVersion);
            params.set('REQUEST', 'DescribeFeatureType');
            params.set('TYPENAME', typeName);
            params.set('OUTPUTFORMAT', 'application/json'); // Pedimos JSON

            const describeUrl = `${baseUrl}?${params.toString()}`;

            console.log('Fetching DescribeFeatureType from:', describeUrl);

            const response = await fetch(describeUrl);
            if (!response.ok) {
                let errorText = await response.text().catch(() => `HTTP error ${response.status}`);
                // Intentar parsear como JSON si es posible para un mensaje de error más detallado
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson && errorJson.exceptions && errorJson.exceptions[0] && errorJson.exceptions[0].text) {
                        errorText = errorJson.exceptions[0].text;
                    } else if (errorJson.message) {
                        errorText = errorJson.message;
                    }
                } catch (e) { /* No hacer nada si no es JSON */ }
                throw new Error(`Failed to fetch DescribeFeatureType: ${response.status} ${response.statusText}. Server said: ${errorText.substring(0, 250)}`);
            }

            const describeData = await response.json();
            console.log('DescribeFeatureType response:', describeData);

            let properties = [];
            if (describeData.featureTypes && describeData.featureTypes.length > 0) {
                // Buscar el featureType específico, considerando que typeName puede o no tener prefijo
                const ftInfo = describeData.featureTypes.find(ft => ft.typeName === typeName || ft.typeName.endsWith(':' + typeName));

                if (ftInfo && ftInfo.properties) {
                    properties = ftInfo.properties;
                } else if (describeData.featureTypes.length === 1 && describeData.featureTypes[0].properties && !typeName.includes(':') && describeData.featureTypes[0].typeName.endsWith(':' + typeName)) {
                    // Fallback si solo hay un tipo y el typeName no tiene prefijo pero el del servidor sí
                    console.warn(`typeName '${typeName}' matched partially with '${describeData.featureTypes[0].typeName}'. Using its properties.`);
                    properties = describeData.featureTypes[0].properties;
                } else {
                    throw new Error(`Feature type '${typeName}' not found in DescribeFeatureType response or has no properties.`);
                }
            } else {
                throw new Error('DescribeFeatureType response format not recognized or no featureTypes found.');
            }

            const commonGeometryNames = ['geom', 'geometry', 'the_geom', 'shape', 'geov kubb geom']; // Nombres comunes de geometrías
            const geometryTypes = [ // Tipos GML comunes
                'gml:MultiSurfacePropertyType', 'gml:PointPropertyType',
                'gml:LineStringPropertyType', 'gml:PolygonPropertyType',
                'gml:GeometryPropertyType', 'gml:MultiPointPropertyType',
                'gml:MultiLineStringPropertyType', 'gml:MultiPolygonPropertyType'
            ];

            const origoAttributes = properties
                .filter(prop => {
                    // Filtrar geometrías y IDs comunes
                    const propNameLower = prop.name.toLowerCase();
                    const isGeomByName = commonGeometryNames.includes(propNameLower);
                    const isGeomByType = geometryTypes.includes(prop.type) || geometryTypes.includes(prop.localType);
                    const isFidGid = propNameLower === 'fid' || propNameLower === 'gid' || propNameLower === 'ogc_fid';
                    return !isGeomByName && !isGeomByType && !isFidGid;
                })
                .map(prop => ({
                    name: prop.name,
                    title: prop.title || prop.name.charAt(0).toUpperCase() + prop.name.slice(1).replace(/_/g, ' ') // Título simple
                }));

            if (origoAttributes.length === 0) {
                attributesTextarea.value = JSON.stringify([], null, 2); // Poner array vacío
                alert('No data attributes found for this feature type (excluding geometry and common IDs). Please review the server response or add attributes manually.');
            } else {
                attributesTextarea.value = JSON.stringify(origoAttributes, null, 2);
                alert('Attributes populated! Please review and adjust titles or included attributes as needed.');
            }

        } catch (error) {
            console.error('Error in fetchAndPopulateWfsAttributes:', error);
            attributesTextarea.value = `// Error fetching attributes: ${error.message}\n[]`;
            alert(`Error fetching attributes: ${error.message}`);
        } finally {
            restoreButton();
        }
    };
    function populateCreateSelector(createType) { // MODIFIED to add listener
        const createForm = document.getElementById('create-form'); createForm.innerHTML = ''; let formHtml = ''; console.log("Populating create form:", createType);
        try {
            if (Object.keys(currentJsonData).length === 0 && editor) currentJsonData = JSON.parse(editor.getValue()); else if (!editor) { createForm.innerHTML = '<p class="has-text-danger">Editor not ready.</p>'; return; }
            const grpOpts = [{ value: '', text: '(No Group)' }, { value: '__NEW__', text: '-- Create New --' }]; const exGrps = new Set(); if (currentJsonData.layers) currentJsonData.layers.forEach(l => { if (l.group) exGrps.add(l.group); }); exGrps.forEach(g => grpOpts.push({ value: g, text: g }));
            const srcOpts = [{ value: '', text: '-- Select --' }]; if (currentJsonData.source) for (const n in currentJsonData.source) srcOpts.push({ value: n, text: n });
            const styOpts = [{ value: '', text: '(Default/None)' }]; if (currentJsonData.styles) for (const n in currentJsonData.styles) styOpts.push({ value: n, text: n });

            let targetLayerInputId = null; let sourceSelectId = '';

            switch (createType) {
                case 'wms':
                    sourceSelectId = 'wms-source'; targetLayerInputId = 'wms-layers-name';
                    formHtml += createField('wms-name', 'Name', 'text', '', 'Unique ID', true, 'data-validate-unique="layer"');
                    formHtml += createField('wms-title', 'Title', 'text', '', 'Legend title', true);
                    formHtml += createSelect('wms-group', 'Group', grpOpts, '', '', false, true); formHtml += `<div class="control" id="new-group-input" style="display:none;margin-top:10px;"><input class="input" type="text" id="wms-new-group-name" placeholder="New group name"></div>`;
                    formHtml += createField('wms-attribution', 'Attribution', 'text');
                    formHtml += createSelect(sourceSelectId, 'Source', srcOpts, '', 'WMS Source', true, false); // Source Select
                    formHtml += `<div class="field"><label class="label" for="${targetLayerInputId}">Layer Name(s) on Server <span class="has-text-danger">*</span></label><div class="control"><input class="input" type="text" id="${targetLayerInputId}" placeholder="Select Source to load layers" required disabled><p class="help" id="${targetLayerInputId}-help">Select Source to load layers</p></div></div>`; // Placeholder Input
                    formHtml += createSelect('wms-style', 'Origo Style Override', styOpts, '', 'Optional', false, true);
                    formHtml += createRadio('wms-tiled', [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], 'true', 'Tiled');
                    const fmtWMS = ['image/png', 'image/jpeg', 'image/gif', 'image/tiff'].map(f => ({ value: f, text: f })); formHtml += createSelect('wms-format', 'Image Format', fmtWMS, 'image/png'); formHtml += createCheckbox('wms-queryable', 'Queryable', true); formHtml += createCheckbox('wms-visible', 'Visible by Default', false);
                    break;
                case 'wmts':
                    sourceSelectId = 'wmts-source'; targetLayerInputId = 'wmts-layer-name';
                    formHtml += createField('wmts-name', 'Name', 'text', '', 'Unique ID', true, 'data-validate-unique="layer"');
                    formHtml += createField('wmts-title', 'Title', 'text', '', 'Legend title', true);
                    formHtml += createSelect('wmts-group', 'Group', grpOpts, '', '', false, true); formHtml += `<div class="control" id="new-group-input" style="display:none;margin-top:10px;"><input class="input" type="text" id="wmts-new-group-name" placeholder="New group name"></div>`;
                    formHtml += createField('wmts-attribution', 'Attribution', 'text');
                    formHtml += createSelect(sourceSelectId, 'Source', srcOpts, '', 'WMTS Source', true, false);
                    formHtml += `<div class="field"><label class="label" for="${targetLayerInputId}">Layer Name on Server <span class="has-text-danger">*</span></label><div class="control"><input class="input" type="text" id="${targetLayerInputId}" placeholder="Select Source to load layers" required disabled><p class="help" id="${targetLayerInputId}-help">Select Source to load layers</p></div></div>`;
                    formHtml += createField('wmts-matrixSet', 'Matrix Set', 'text', '', 'e.g., 3006', true);
                    formHtml += createField('wmts-style', 'Server Style', 'text', 'default'); const fmtWMTS = ['image/png', 'image/jpeg'].map(f => ({ value: f, text: f })); formHtml += createSelect('wmts-format', 'Image Format', fmtWMTS, 'image/png'); formHtml += createCheckbox('wmts-visible', 'Visible by Default', false);
                    break;
                case 'wfs':
                    sourceSelectId = 'wfs-source';
                    targetLayerInputId = 'wfs-typeName';
                    //formHtml += createField('wfs-name', 'Name', 'text', '', 'Unique ID', true, 'data-validate-unique="layer"');
                    formHtml += createField('wfs-title', 'Title', 'text', '', 'Legend title', true);
                    formHtml += createSelect('wfs-group', 'Group', grpOpts, '', '', false, true); formHtml += `<div class="control" id="new-group-input" style="display:none;margin-top:10px;"><input class="input" type="text" id="wfs-new-group-name" placeholder="New group name"></div>`;
                    formHtml += createField('wfs-attribution', 'Attribution', 'text');
                    formHtml += createSelect(sourceSelectId, 'Source', srcOpts, '', 'WFS Source', true, false);
                    formHtml += `<div class="field"><label class="label" for="${targetLayerInputId}">Feature Type Name (ID) <span class="has-text-danger">*</span></label><div class="control"><input class="input" type="text" id="${targetLayerInputId}" placeholder="Select Source to load types or type ID" required data-validate-unique="layer"><p class="help" id="${targetLayerInputId}-help">Select Source to load types or type unique ID</p></div></div>`; // Modificado el label y placeholder
                    formHtml += createField('wfs-geometryName', 'Geometry Attribute', 'text', 'geom'); formHtml += createSelect('wfs-style', 'Origo Style', styOpts, '', 'Style for features', false, true); formHtml += createField('wfs-outputFormat', 'Output Format', 'text', 'application/json'); formHtml += createCheckbox('wfs-queryable', 'Queryable', true); formHtml += createCheckbox('wfs-visible', 'Visible by Default', false); formHtml += createCheckbox('wfs-editable', 'Editable', false); formHtml += createTextarea('wfs-attributes-json', 'Attributes (JSON)', '[]', 'e.g., [{"name":"col1"}]', 5, false, 'data-validate-json="true"');
                    break;
                // ... other cases (style, source, group) unchanged ...
                case 'style': formHtml += createField('style-name', 'Style Name', 'text', '', 'Unique name', true, 'data-validate-unique="style"'); const styTypOpts = [{ value: 'simple_point', text: 'Simple Point' }, { value: 'simple_line', text: 'Simple Line' }, { value: 'simple_polygon', text: 'Simple Polygon' }, { value: 'icon', text: 'Icon' }, { value: 'text', text: 'Text Label' }, { value: 'rule', text: 'Rule-based (Adv)' }, { value: 'json', text: 'Raw JSON' }]; formHtml += createSelect('style-type', 'Style Type', styTypOpts, 'simple_point'); formHtml += '<div id="style-details-form" style="margin-top:10px;"></div>'; setTimeout(() => { const s = document.getElementById('style-type'); if (s) { s.addEventListener('change', populateStyleDetailsForm); populateStyleDetailsForm(); } }, 0); break;

                case 'group':
                    formHtml += createField('group-name', 'Group Name (ID)', 'text', '', 'Unique ID', true, 'data-validate-unique="group"');
                    formHtml += createField('group-title', 'Group Title', 'text', '', 'Title in legend', true);

                    const parentGroupOptions = [{ value: '', text: '(Root Group)' }]; // Opción para no tener padre
                    if (currentJsonData.groups && Array.isArray(currentJsonData.groups)) {
                        window.populateGroupParentOptions(currentJsonData.groups, parentGroupOptions);
                    }
                    formHtml += createSelect('group-parent', 'Parent Group (Optional)', parentGroupOptions, '', '', false, true);
                    formHtml += createCheckbox('group-expanded', 'Expanded by Default', false);
                    break;

                case 'source':
                    formHtml += createField('source-name', 'Source Name', 'text', '', 'Unique ID', true, 'data-validate-unique="source"');

                    // --- INICIO: NUEVOS ELEMENTOS PARA SELECCIÓN DE QGIS ---
                    formHtml += `
        <div class="field">
            <div class="control">
                <button type="button" class="button is-info is-outlined is-small" onclick="loadAndSelectQgisProjectForSource()">
                    <span class="icon is-small"><i class="fas fa-cogs"></i></span> 
                    <span>Seleccionar desde QGIS Publicado</span>
                </button>
            </div>
        </div>
        <div id="qgis-project-selector-container" style="display:none; margin-bottom: 1rem; padding: 0.75rem; background-color: #f5f5f5; border-radius: 4px;">
            </div>
    `;


                    formHtml += createField('source-url', 'URL', 'text', '', 'Service base URL (auto-filled if selected from QGIS)', true); // <-- CAMBIADO 'url' a 'text'
                    const srcTypOpts = ['WMS', 'WFS', 'WMTS', 'XYZ', 'VectorTile'].map(t => ({ value: t, text: t }));
                    formHtml += createSelect('source-type', 'Service Type', srcTypOpts, 'WMS'); // El select que se auto-rellenará
                    formHtml += createField('source-version', 'Version (WMS/WFS/WMTS)', 'text', '', 'e.g. 1.1.1, 1.1.0, 1.0.0');
                    formHtml += createField('source-workspace', 'Workspace (GeoServer)', 'text', '');
                    formHtml += createField('source-matrixSet', 'MatrixSet (WMTS)', 'text', '', 'Only if Type=WMTS');
                    break;

                default: formHtml = '<p>Unrecognized type.</p>';
            }
            createForm.innerHTML = formHtml;

            // *** ATTACH LISTENER to Source Select (if applicable) ***
            if (sourceSelectId && targetLayerInputId) {
                setTimeout(() => { // Ensure element exists after innerHTML update
                    const sourceDropdown = document.getElementById(sourceSelectId);
                    if (sourceDropdown) {
                        sourceDropdown.addEventListener('change', (event) => {
                            loadLayerList(sourceSelectId, targetLayerInputId, createType.toUpperCase());
                        });
                        console.log(`Attached create listener to #${sourceSelectId}, target #${targetLayerInputId}`);
                    } else { console.error(`Could not find source dropdown #${sourceSelectId}`); }
                }, 0);
            }

            // Listener for new group input
            const groupSelect = createForm.querySelector('#wms-group, #wmts-group, #wfs-group'); const newGroupInputDiv = createForm.querySelector('#new-group-input'); if (groupSelect && newGroupInputDiv) { groupSelect.addEventListener('change', function () { newGroupInputDiv.style.display = (this.value === '__NEW__') ? 'block' : 'none'; }); }

        } catch (e) { console.error("Error populating create form:", e); createForm.innerHTML = '<p class="has-text-danger">Error generating form.</p>'; }
    } // Fin populateCreateSelector

    function populateStyleDetailsForm() { /* ... unchanged ... */
        const styleType = document.getElementById('style-type')?.value; const detailsDiv = document.getElementById('style-details-form'); if (!styleType || !detailsDiv) return; detailsDiv.innerHTML = ''; let dH = ''; switch (styleType) { case 'simple_point': dH += createField('style-point-radius', 'Radius', 'number', '5'); dH += createField('style-point-fill-color', 'Fill Color', 'color', '#ff0000'); dH += createField('style-point-stroke-color', 'Stroke Color', 'color', '#000000'); dH += createField('style-point-stroke-width', 'Stroke Width', 'number', '1'); break; case 'simple_line': dH += createField('style-line-stroke-color', 'Stroke Color', 'color', '#0000ff'); dH += createField('style-line-stroke-width', 'Stroke Width', 'number', '2'); dH += createField('style-line-stroke-dash', 'Stroke Dash', 'text', ''); break; case 'simple_polygon': dH += createField('style-poly-fill-color', 'Fill Color', 'color', '#00ff00'); dH += createField('style-poly-fill-opacity', 'Fill Opacity', 'number', '0.5', '', false, 'step="0.1" min="0" max="1"'); dH += createField('style-poly-stroke-color', 'Stroke Color', 'color', '#000000'); dH += createField('style-poly-stroke-width', 'Stroke Width', 'number', '1'); dH += createField('style-poly-stroke-dash', 'Stroke Dash', 'text', ''); break; case 'icon': dH += createField('style-icon-src', 'Icon URL', 'url', '', 'e.g., /img/icon.png', true); dH += createField('style-icon-scale', 'Scale', 'number', '1', '', false, 'step="0.1"'); dH += createField('style-icon-anchorX', 'Anchor X', 'number', '0.5', '', false, 'step="0.1" min="0" max="1"'); dH += createField('style-icon-anchorY', 'Anchor Y', 'number', '0.5', '', false, 'step="0.1" min="0" max="1"'); dH += createField('style-icon-opacity', 'Opacity', 'number', '1', '', false, 'step="0.1" min="0" max="1"'); break; case 'text': dH += createField('style-text-property', 'Text Property', 'text', 'name', 'Feature attribute', true); dH += createField('style-text-font', 'Font', 'text', '12px Arial'); dH += createField('style-text-fill-color', 'Fill Color', 'color', '#000000'); dH += createField('style-text-stroke-color', 'Stroke Color', 'color', '#ffffff'); dH += createField('style-text-stroke-width', 'Stroke Width', 'number', '2'); dH += createField('style-text-offsetX', 'Offset X', 'number', '0'); dH += createField('style-text-offsetY', 'Offset Y', 'number', '-15'); break; case 'rule': dH = '<p>Rule-based creation not implemented. Use "Raw JSON".</p>'; break; case 'json': dH = createTextarea('style-raw-json', 'Style JSON', '[\n [\n {\n "fill": { "color": "#ff0000" }\n }\n ]\n]', 'Paste full Origo style definition', 10, true, 'data-validate-json="true"'); break; } detailsDiv.innerHTML = dH;
    }
    // /public/js/other/script_origo.js

// Modificada para aceptar un prefijo para los IDs de los campos
function buildStyleObject(styleType, fieldIdPrefix = 'style') {
    // Helper interno para obtener valores usando el prefijo
    const getValue = (suffix) => {
        const element = document.getElementById(`${fieldIdPrefix}_${suffix}`); // Nota el guion bajo
        return element ? element.value.trim() : undefined;
    };
    // Helper para números, con fallback
    const getFloat = (suffix, defaultValue) => {
        const valStr = getValue(suffix);
        const valNum = parseFloat(valStr);
        return isNaN(valNum) ? defaultValue : valNum;
    };
    const getInt = (suffix, defaultValue) => {
        const valStr = getValue(suffix);
        const valNum = parseInt(valStr, 10);
        return isNaN(valNum) ? defaultValue : valNum;
    };

    let styleDef = {};

    switch (styleType) {
        case 'simple_point':
            styleDef = [[{ "circle": {
                radius: getFloat('point_radius', 5),
                fill: { color: getValue('point_fill_color') || '#ff0000' },
                stroke: {
                    color: getValue('point_stroke_color') || '#000000',
                    width: getInt('point_stroke_width', 1)
                }
            }}]];
            break;
        case 'simple_line':
            const ldStr = getValue('line_stroke_dash') || '';
            const ld = ldStr ? ldStr.split(',').map(Number).filter(n => !isNaN(n)) : undefined;
            styleDef = [[{ "stroke": {
                color: getValue('line_stroke_color') || '#0000ff',
                width: getInt('line_stroke_width', 2),
                lineDash: ld && ld.length > 0 ? ld : undefined
            }}]];
            // Limpiar lineDash si está vacío para que no se guarde como [null] o similar
            if (styleDef[0][0].stroke.lineDash === undefined) delete styleDef[0][0].stroke.lineDash;
            break;
        case 'simple_polygon':
            const pdStr = getValue('poly_stroke_dash') || '';
            const pd = pdStr ? pdStr.split(',').map(Number).filter(n => !isNaN(n)) : undefined;
            const fo = getFloat('poly_fill_opacity', 0.5);
            const fc = getValue('poly_fill_color') || '#00ff00';
            const h2r = (h, a) => { // Asegúrate que esta función h2r esté definida o sea accesible
                const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
                return `rgba(${r},${g},${b},${a})`;
            };
            const fcr = fc.startsWith('#') ? h2r(fc, fo) : fc; // Convierte hex+alpha a rgba
            styleDef = [[{
                "fill": { color: fcr },
                "stroke": {
                    color: getValue('poly_stroke_color') || '#000000',
                    width: getInt('poly_stroke_width', 1),
                    lineDash: pd && pd.length > 0 ? pd : undefined
                }
            }]];
            if (styleDef[0][0].stroke.lineDash === undefined) delete styleDef[0][0].stroke.lineDash;
            break;
        case 'icon':
            const iconSrc = getValue('icon_src');
            if (!iconSrc) throw new Error("Icon URL (src) is required for icon style.");
            styleDef = [[{ "icon": {
                src: iconSrc,
                scale: getFloat('icon_scale', 1),
                anchor: [getFloat('icon_anchorX', 0.5), getFloat('icon_anchorY', 0.5)],
                opacity: getFloat('icon_opacity', 1)
            }}]];
            break;
        case 'text':
             const textProperty = getValue('text_property');
             if (!textProperty) throw new Error("Text Property is required for text style.");
            styleDef = [[{ "text": {
                property: textProperty,
                font: getValue('text_font') || '12px Arial',
                fill: { color: getValue('text_fill_color') || '#000000' },
                stroke: {
                    color: getValue('text_stroke_color') || '#ffffff',
                    width: getInt('text_stroke_width', 2)
                },
                offsetX: getInt('text_offsetX', 0),
                offsetY: getInt('text_offsetY', -15) // Origo suele necesitar negativo para Y
            }}]];
            break;
        case 'json': // Para el tipo 'json', el contenido se toma directamente del textarea en applyEditChanges/applyCreateChanges
            const rawJsonTextareaId = (fieldIdPrefix === 'style') ? 'style-raw-json' : 'edit-style-json-value'; // ID del textarea raw
            const rj = document.getElementById(rawJsonTextareaId)?.value?.trim();
            if (!rj) throw new Error("JSON content is empty for 'Raw JSON' type.");
            try { styleDef = JSON.parse(rj); }
            catch (e) { throw new Error("Invalid JSON: " + e.message); }
            if (!Array.isArray(styleDef) || !styleDef.every(Array.isArray) || (styleDef.length > 0 && !styleDef.every(inner => inner.every(item => typeof item === 'object')))) {
                 throw new Error("JSON for styles must be an array of arrays of objects, e.g., [[{ rule1part1 }, {rule1part2}], [{rule2part1}]]");
            }
            break;
        default:
            console.warn(`[Build Style] Tipo de estilo no simple o desconocido: ${styleType}. No se construyó desde campos simples.`);
            return null; // Indica que no se pudo construir desde campos simples
    }
    return styleDef;
}
    // /public/js/other/script_origo.js (Función applyCreateChanges CON MÁS LOGS)

window.applyCreateChanges = function () {
    console.log("[Apply Create] PASO 0_A: Función applyCreateChanges INICIADA."); // LOG INICIAL

    const createType = document.getElementById('create-selector')?.value;
    const formContainerId = 'create-form';

    if (!editor) {
        alert("Editor not ready.");
        console.error("[Apply Create] ERROR FATAL: Editor no está inicializado.");
        return;
    }
    console.log("[Apply Create] PASO 0_B: Editor está listo. Validando formulario...");

    if (!validateModalForm(formContainerId)) { // Esta función debe devolver true/false
        // validateModalForm ya debería mostrar sus propios alerts/errores de campo
        console.warn("[Apply Create] validateModalForm devolvió false. Saliendo.");
        return;
    }
    console.log(`[Apply Create] PASO 0_C: Formulario validado. Creando tipo: ${createType}`);

    let elementAdded = false;

    try {
        console.log("[Apply Create] PASO 1: Entrando al bloque TRY.");
        let jsonData = JSON.parse(editor.getValue()); // Posible punto de error si el JSON es inválido
        console.log("[Apply Create] PASO 2: JSON parseado desde el editor.");

        let newItem, targetArray, targetObject, targetKey;
        const getValue = (id) => document.getElementById(id)?.value?.trim();
        const getCheckbox = (id) => document.getElementById(id)?.checked;
        const getRadio = (name) => document.querySelector(`#${formContainerId} input[name="${name}"]:checked`)?.value;
        const getSelect = (id) => document.getElementById(id)?.value;
        const handleNewGroup = (grpSelId, newGrpInpId, existingGroups) => { // Asumo que esta función existe y funciona
             const gs = document.getElementById(grpSelId), ngi = document.getElementById(newGrpInpId);
             if (gs?.value === '__NEW__') { const n = ngi?.value?.trim(); if (!n) throw new Error('New group name required.'); return n; }
             return gs?.value || undefined;
        };


        console.log(`[Apply Create] PASO 3: Procesando switch para createType: ${createType}`);

        switch (createType) {
            case 'wms': case 'wmts': case 'wfs':
                console.log(`[Apply Create] Entrando al case para: ${createType}`);
                newItem = { type: createType.toUpperCase() };
                // ... (resto de la lógica para capas, asegúrate de tener logs si sospechas aquí) ...
                newItem.name = getValue(`${createType}-name`); // Para WFS, este es el que se auto-rellena
                newItem.title = getValue(`${createType}-title`);
                newItem.group = handleNewGroup(`${createType}-group`, `${createType}-new-group-name`, jsonData.groups || []);
                newItem.source = getSelect(`${createType}-source`);
                // ... más propiedades ...

                if (!jsonData.layers) jsonData.layers = [];
                const firstBaseLayerIndex = jsonData.layers.findIndex(layer => layer.group && layer.group.toLowerCase() === 'background');
                if (firstBaseLayerIndex > -1) {
                    jsonData.layers.splice(firstBaseLayerIndex, 0, newItem);
                } else {
                    jsonData.layers.unshift(newItem);
                }
                elementAdded = true;
                console.log(`[Apply Create] Capa '${newItem.name}' preparada para añadir.`);
                break;

            case 'style':
                console.log("[Apply Create] Entrando al case para: style");
                targetKey = getValue('style-name');
                console.log("[Create Style] LOG 1 - Style Name (targetKey):", targetKey);

                if (!targetKey) { // Validación extra
                    console.error("[Create Style] ERROR: Style Name (targetKey) está vacío o es nulo.");
                    throw new Error("Style Name is required and cannot be empty.");
                }

                if (!jsonData.styles) {
                    jsonData.styles = {};
                    console.log("[Create Style] Objeto jsonData.styles inicializado.");
                }
                
                newItem = buildStyleObject(getSelect('style-type')); // Asume que buildStyleObject existe y funciona
                if (!newItem) {
                     console.error("[Create Style] ERROR: buildStyleObject devolvió null o undefined.");
                     throw new Error("Could not build the style object.");
                }
                console.log("[Create Style] LOG 2 - Built Style Object (newItem):", newItem);
                targetObject = jsonData.styles;
                break;

            case 'source':
                 console.log("[Apply Create] Entrando al case para: source");
                 targetKey = getValue('source-name');
                 console.log("[Create Source] Source Name (targetKey):", targetKey);
                 if (!targetKey) throw new Error("Source Name is required.");
                 if (!jsonData.source) jsonData.source = {};
                 newItem = { /* ... tu lógica para construir newItem de source ... */ };
                 console.log("[Create Source] Built Source Object (newItem):", newItem);
                 targetObject = jsonData.source;
                 break;

            case 'group':
                 console.log("[Apply Create] Entrando al case para: group");
                 newItem = { name: getValue('group-name'), /* ... */ };
                 // ... tu lógica para grupos, usando findAndAddSub o targetArray y elementAdded ...
                 break;

            default:
                console.error(`[Apply Create] ERROR: Tipo desconocido - ${createType}`);
                throw new Error(`Unrecognized create type: ${createType}`);
        } // Fin switch

        console.log("[Apply Create] PASO 4: Saliendo del switch. ElementAdded:", elementAdded, "TargetKey:", targetKey, "TargetObject:", !!targetObject);

        // Añadir el elemento si se preparó un array o un objeto
        if (targetArray) { // Solo para capas y grupos raíz (si targetArray se asignó en 'group')
            targetArray.push(newItem);
            elementAdded = true;
            console.log("[Apply Create] PASO 5a: Elemento añadido a targetArray.");
        } else if (targetObject && targetKey) { // Para estilos y fuentes
            console.log("[Apply Create] PASO 5b: Intentando añadir a targetObject. TargetKey:", targetKey, "newItem:", newItem);
            targetObject[targetKey] = newItem;
            elementAdded = true;
            console.log("[Apply Create] Elemento añadido a targetObject.");
        }

        // Verificar si se añadió el elemento de alguna forma
        if (!elementAdded && createType === 'group' && getSelect('group-parent')) {
             console.warn("[Apply Create] Se intentó añadir subgrupo, pero findAndAddSub no marcó elementAdded (error ya debería haberse lanzado).");
        } else if (!elementAdded) {
             console.error("[Apply Create] PASO 6: Elemento NO añadido. Revisar logs anteriores.");
             throw new Error("Failed to add element. Target array/object not set or key missing.");
        }

        console.log("[Apply Create] PASO 7: Actualizando editor y cerrando modal.");
        currentJsonData = jsonData;
        editor.setValue(JSON.stringify(jsonData, null, 2));
        closeCreateModal();
        const finalName = (createType === 'style' || createType === 'source') ? getValue(`${createType}-name`) : newItem?.name;
        alert(`Element '${finalName}' created (Press 'Save Changes' to make permanent).`);
        console.log("[Apply Create] Proceso de creación de elemento exitoso.");

    } catch (error) {
        console.error("[Apply Create] ERROR DENTRO DEL TRY CATCH:", error.message, error.stack); // LOG DETALLADO DEL ERROR
        alert("Error creating element: " + error.message);
    }
};

    // Pon esta función en tu script_origo.js, fuera de otras funciones
    // Asegúrate que esta función está definida globalmente en script_origo.js
    window.findAndAddSubForOrigo = function (parentGroupName, groupsArray, newSubgroup) {
        for (let i = 0; i < groupsArray.length; i++) {
            const group = groupsArray[i];
            if (group.name === parentGroupName) {
                if (!group.groups) {
                    group.groups = [];
                }
                group.groups.unshift(newSubgroup); // Añade al principio
                console.log(`Subgroup '${newSubgroup.name}' added to '${parentGroupName}'.`);
                return true;
            }
            if (group.groups && group.groups.length > 0) {
                if (window.findAndAddSubForOrigo(parentGroupName, group.groups, newSubgroup)) {
                    return true;
                }
            }
        }
        return false;
    };

});

window.handleNewGroupForOrigo = function (groupSelectId, newGroupNameInputId, existingGroupsArray) {
    const selectedGroupValue = document.getElementById(groupSelectId).value;
    const newGroupName = document.getElementById(newGroupNameInputId).value.trim();

    if (selectedGroupValue === '__NEW__') {
        if (!newGroupName) {
            throw new Error('New group name cannot be empty if "-- Create New --" is selected.');
        }
        // Validar que el nuevo nombre de grupo no exista ya (opcional pero recomendado)
        const groupExists = (name, groups) => groups.some(g => g.name === name || (g.groups && groupExists(name, g.groups)));
        if (groupExists(newGroupName, existingGroupsArray)) {
            throw new Error(`A group with the name '${newGroupName}' already exists.`);
        }

        return newGroupName; // El nombre del nuevo grupo a crear/usar
    }
    return selectedGroupValue || undefined; // Devuelve el valor seleccionado o undefined si es vacío
};


const deleteJSONButtons = document.querySelectorAll('[id^="deleteJSON-"]');
deleteJSONButtons.forEach((b) => {
    b.addEventListener('click', () => {
        const f = b.getAttribute('data-file'); // ej: 'index.json'
        if (!f) return;

        // ---> AÑADIR ESTA COMPROBACIÓN <---
        if (f.toLowerCase() === 'index.json') {
            alert("The default 'index' map cannot be deleted.");
            return; // Detiene antes de confirmar o llamar a fetch
        }
        // ---> FIN DE LA COMPROBACIÓN <---

        if (!confirm(`Delete entire map '${f}' (JSON and EJS)? This cannot be undone.`)) return;

        // ... resto del código fetch sin cambios ...
        const j = '/origoadmin/delete-json?file=' + encodeURIComponent(f);
        const e = f.replace('.json', '') + '.ejs';
        const ej = '/origoadmin/delete-ejs?file=' + encodeURIComponent(e);
        fetch(j, { method: 'DELETE' })
            .then(r => { /* ... */ })
            .then(d => { /* ... */ return fetch(ej, { method: 'DELETE' }); })
            .then(r => { /* ... */ })
            .then(d => { /* ... */ alert(`Map '${f}' deleted.`); location.reload(); })
            .catch(err => {
                console.error('Error deleting map:', err);
                alert('Error deleting map: ' + err.message); // Muestra el error (del backend o del fetch)
            });
    });
});
function handlePublish(jsonFileName) { /* ... unchanged ... */
    const ejsFileName = jsonFileName.replace('.json', ''); console.log(`Publishing: ${ejsFileName}`); fetch('/origoadmin/publicar', { method: 'POST', body: JSON.stringify({ fileName: ejsFileName }), headers: { 'Content-Type': 'application/json' } }).then(r => { if (!r.ok) return r.json().then(err => { throw new Error(`Publish error (${r.status}): ${err.error || '?'}`); }); return r.json(); }).then(d => { console.log(`Publish OK: ${d.message}`); const i = document.getElementById(`icon-${jsonFileName}`); if (i) { i.style.color = 'green'; i.onclick = function () { redirectToMapPage(ejsFileName); }; i.style.cursor = 'pointer'; } const pb = document.getElementById(`publishButton-${jsonFileName}`); if (pb) pb.disabled = true; const upb = document.getElementById(`unpublishButton-${jsonFileName}`); if (upb) upb.disabled = false; alert(`Map '${ejsFileName}' published.`); }).catch(err => { console.error('Publish request error:', err); alert('Error publishing: ' + err.message); });
}
function handleUnpublish(jsonFileName) { /* ... unchanged ... */
    const ejsFileName = jsonFileName.replace('.json', ''); console.log(`Unpublishing: ${ejsFileName}`); const ep = `/origoadmin/delete-ejs?file=${encodeURIComponent(ejsFileName + '.ejs')}`; fetch(ep, { method: 'DELETE' }).then(r => { if (!r.ok) return r.json().then(err => { throw new Error(`Unpublish error (${r.status}): ${err.error || '?'}`); }); return r.json(); }).then(d => { console.log(`Unpublish OK: ${d.message}`); const i = document.getElementById(`icon-${jsonFileName}`); if (i) { i.style.color = 'black'; i.onclick = null; i.style.cursor = 'default'; } const pb = document.getElementById(`publishButton-${jsonFileName}`); if (pb) pb.disabled = false; const upb = document.getElementById(`unpublishButton-${jsonFileName}`); if (upb) upb.disabled = true; alert(`Map '${ejsFileName}' unpublished.`); }).catch(err => { console.error('Unpublish request error:', err); alert('Error unpublishing: ' + err.message); });
}
function redirectToMapPage(fileNameBase) { /* ... unchanged ... */
    const url = `/OrigoMap/${encodeURIComponent(fileNameBase)}`; window.open(url, '_blank');
}


//editor

// /public/js/other/script_origo.js (Añadir estas funciones)

// ... (require.config, require([...]), variables globales editor, currentFileName, currentJsonData ...) ...

require(['vs/editor/editor.main'], function () {

    // --- Editor Jodit ---
    let descriptionEditor = null; // Variable global para la instancia de Jodit
    let currentDescriptionMapName = null; // Para saber qué mapa estamos editando

    window.openDescriptionEditor = async function (mapBaseName) {
        console.log(`Opening description editor for: ${mapBaseName}`);
        currentDescriptionMapName = mapBaseName; // Guarda el nombre del mapa actual

        const modal = document.getElementById('description-modal');
        const mapNameDisplay = document.getElementById('description-modal-mapname');
        const textarea = document.getElementById('descriptionEditorTextarea');
        const saveButton = document.getElementById('saveDescriptionButton');

        if (!modal || !mapNameDisplay || !textarea || !saveButton) {
            console.error("Description modal elements not found!");
            return;
        }

        mapNameDisplay.textContent = `Editing description for: ${mapBaseName}.json`;
        saveButton.onclick = () => saveDescription(mapBaseName); // Asegura que el botón llame a guardar con el nombre correcto

        // Limpiar contenido anterior y destruir instancia previa de Jodit si existe
        textarea.value = '';
        if (descriptionEditor) {
            try { descriptionEditor.destruct(); } catch (e) { console.warn("Error destroying previous Jodit instance:", e); }
            descriptionEditor = null;
        }

        // Mostrar modal antes de inicializar Jodit (a veces ayuda)
        modal.classList.add('is-active');

        // Mostrar un loader simple mientras se carga la descripción
        textarea.placeholder = 'Loading description...';

        // Obtener la descripción actual del backend
        try {
            const response = await fetch(`/origoadmin/get-description?map=${encodeURIComponent(mapBaseName)}`);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to load description');
            }

            textarea.value = data.description || ''; // Carga la descripción obtenida
            textarea.placeholder = ''; // Limpia el placeholder

            // Inicializar Jodit en el textarea
            // Espera un poco para asegurar que el textarea está visible
            setTimeout(() => {
                try {
                    descriptionEditor = Jodit.make('#descriptionEditorTextarea', {
                        // Opciones de configuración de Jodit (opcional)
                        // examples: https://xdsoft.net/jodit/docs/options/
                        // height: 300,
                        // buttons: "bold,italic,underline,|,ul,ol,|,link,image"
                    });
                    console.log("Jodit editor initialized.");
                } catch (joditError) {
                    console.error("Failed to initialize Jodit:", joditError);
                    textarea.placeholder = 'Error loading rich text editor.';
                    alert('Error loading description editor.');
                    closeDescriptionModal(); // Cierra si falla la inicialización
                }
            }, 100); // 100ms delay

        } catch (error) {
            console.error("Error fetching description:", error);
            textarea.placeholder = `Error loading description: ${error.message}`;
            alert(`Error loading description: ${error.message}`);
            // Considerar cerrar el modal si falla la carga
            // closeDescriptionModal();
        }
    };

    window.closeDescriptionModal = function () {
        const modal = document.getElementById('description-modal');
        if (modal) modal.classList.remove('is-active');
        // Destruir instancia de Jodit para liberar memoria
        if (descriptionEditor) {
            try { descriptionEditor.destruct(); } catch (e) { console.warn("Error destroying Jodit instance on close:", e); }
            descriptionEditor = null;
        }
        currentDescriptionMapName = null;
        // Limpiar textarea por si acaso
        const textarea = document.getElementById('descriptionEditorTextarea');
        if (textarea) textarea.value = '';
        console.log("Description modal closed.");
    };

    // Esta función es llamada por el botón "Save Description"
    // NO necesita 'window.' si el onclick en el HTML se ajustó para pasar el mapName
    // Pero si mantienes onclick="saveDescription()", SÍ necesita window.
    window.saveDescription = async function () {
        if (!descriptionEditor || !currentDescriptionMapName) {
            alert("Editor not ready or no map selected.");
            return;
        }

        const descriptionHtml = descriptionEditor.value; // Obtiene el contenido HTML del editor
        const mapName = currentDescriptionMapName; // Usa la variable guardada

        console.log(`Saving description for ${mapName}:`, descriptionHtml.substring(0, 50) + '...');

        try {
            const response = await fetch('/origoadmin/save-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mapName: mapName, description: descriptionHtml })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || `Server error ${response.status}`);
            }

            alert('Description saved successfully!');
            closeDescriptionModal();

        } catch (error) {
            console.error(`Error saving description for ${mapName}:`, error);
            alert(`Error saving description: ${error.message}`);
        }
    };

    // *** ---------- NUEVAS FUNCIONES PARA BOTONES DEL EDITOR MONACO ---------- ***

    window.editorUndo = function () {
        if (editor) {
            editor.trigger('button', 'undo', null); // 'button' es una fuente arbitraria
            editor.focus();
        } else { console.warn("Undo failed: Editor not ready."); }
    }

    window.editorRedo = function () {
        if (editor) {
            editor.trigger('button', 'redo', null);
            editor.focus();
        } else { console.warn("Redo failed: Editor not ready."); }
    }

    window.editorFind = function () {
        if (editor) {
            editor.getAction('actions.find').run(); // Abre el widget de búsqueda
        } else { console.warn("Find failed: Editor not ready."); }
    }

    window.editorFormat = function () {
        if (editor) {
            editor.getAction('editor.action.formatDocument').run().then(() => {
                console.log("Document formatted.");
                editor.focus();
            }).catch(e => {
                console.error("Formatting failed:", e);
                alert("Could not format document. Check JSON validity.");
            });
        } else { console.warn("Format failed: Editor not ready."); }
    }

    window.editorCommandPalette = function () {
        if (editor) {
            editor.trigger('button', 'editor.action.quickCommand', null); // Abre paleta de comandos (F1)
        } else { console.warn("Command Palette failed: Editor not ready."); }
    }

    // Opcional: Toggle para Minimapa
    let minimapEnabled = false; // O lee el estado inicial del editor si lo configuras
    window.toggleMinimap = function () {
        if (editor) {
            minimapEnabled = !minimapEnabled;
            editor.updateOptions({ minimap: { enabled: minimapEnabled } });
            console.log("Minimap enabled:", minimapEnabled);
            editor.focus();
            // Aquí podrías cambiar el texto/icono del botón que llama a esta función
        } else { console.warn("Minimap toggle failed: Editor not ready."); }
    }
    // *** ---------- FIN NUEVAS FUNCIONES MONACO ---------- ***


});


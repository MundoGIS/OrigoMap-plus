// /public/js/other/script_origo.js (Version with GetCapabilities Layer Loading)

// Configuración para cargar Monaco Editor desde CDN
require.config({ paths: { 'vs': '/monaco-editor/min/vs/' } });

// Variables globales
let editor;
let currentFileName;
let currentJsonData = {};

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

    // --- Funciones del Editor y Modales (Textos en Inglés) ---
    window.openJsonEditor = function (fileName) { /* ... unchanged ... */
        if (editor) { closeJsonEditor(); }
        const encodedFileName = encodeURIComponent(fileName);
        fetch(`/origoadmin/edit-json?file=${encodedFileName}`)
            .then(response => { if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`); return response.json(); })
            .then(json => {
                document.getElementById('json-editor-section').style.display = 'block';
                document.getElementById('json-editor-filename').textContent = fileName;
                const container = document.getElementById('monaco-editor-container');
                if (!container) { console.error("Error: Container 'monaco-editor-container' not found."); return; }
                container.style.display = 'block'; container.style.height = '600px';
                editor = monaco.editor.create(container, { value: JSON.stringify(json, null, 2), language: 'json', theme: 'vs-dark', automaticLayout: true });
                currentFileName = fileName; currentJsonData = json;
                console.log("JSON loaded and Monaco editor initialized:", currentJsonData);
            })
            .catch(error => {
                console.error('Error loading or initializing JSON editor:', error);
                const errorDiv = document.getElementById('error-message'); if (errorDiv) errorDiv.textContent = 'Error loading JSON editor: ' + error.message;
                document.getElementById('json-editor-section').style.display = 'none';
            });
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
    window.closeJsonEditor = function () { /* ... unchanged ... */
        if (editor) { editor.dispose(); editor = null; }
        const container = document.getElementById('monaco-editor-container'); if (container) container.innerHTML = '';
        document.getElementById('json-editor-section').style.display = 'none';
        currentFileName = null; currentJsonData = {};
        const errorDiv = document.getElementById('error-message'); if (errorDiv) errorDiv.textContent = '';
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
        let isValid = true; const c = document.getElementById(formContainerId); if (!c) return true; c.querySelectorAll('.input, .textarea, .select select').forEach(el => clearFieldError(el.id)); c.querySelectorAll('input[required], textarea[required], select[required]').forEach(el => { if (!el.value) { showFieldError(el.id, `${el.previousElementSibling?.textContent?.replace('*', '').trim() || 'This field'} is required.`); isValid = false; } }); c.querySelectorAll('input[type="url"]').forEach(el => { if (el.value) { try { new URL(el.value); } catch (_) { showFieldError(el.id, 'Please enter a valid URL (e.g., http://...).'); isValid = false; } } }); c.querySelectorAll('input[type="number"]').forEach(el => { if (el.value && isNaN(parseFloat(el.value))) { showFieldError(el.id, 'Must be a valid number.'); isValid = false; } else if (el.value) { const v = parseFloat(el.value), min = parseFloat(el.getAttribute('min')), max = parseFloat(el.getAttribute('max')); if (!isNaN(min) && v < min) { showFieldError(el.id, `Value must be ${min} or higher.`); isValid = false; } if (!isNaN(max) && v > max) { showFieldError(el.id, `Value must be ${max} or lower.`); isValid = false; } } }); c.querySelectorAll('textarea[data-validate-json="true"]').forEach(el => { if (el.value) { try { JSON.parse(el.value); } catch (e) { showFieldError(el.id, 'Invalid JSON: ' + e.message); isValid = false; } } }); c.querySelectorAll('input[data-validate-unique]').forEach(el => { const name = el.value.trim(), type = el.getAttribute('data-validate-unique'), orig = c.querySelector(`#edit-${type}-original-name`)?.value; if (name && name !== orig) { let exists = false; try { const d = JSON.parse(editor.getValue()); if (type === 'layer' && d.layers) exists = d.layers.some(i => i.name === name); if (type === 'style' && d.styles) exists = !!d.styles[name]; if (type === 'source' && d.source) exists = !!d.source[name]; if (type === 'group' && d.groups) { const _e = (n, gr) => { for (let i = 0; i < gr.length; i++) { if (gr[i].name === n) return true; if (gr[i].groups) if (_e(n, gr[i].groups)) return true; } return false; }; exists = _e(name, d.groups); } } catch (e) { console.warn("Err validating uniqueness"); } if (exists) { showFieldError(el.id, `A ${type} with the name '${name}' already exists.`); isValid = false; } } }); return isValid;
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
                const labelElement = targetControlDiv.closest('.field')?.querySelector('.label');
                const labelText = labelElement?.textContent.replace('*', '').trim() || 'Layer Name';
                // Use the helper, make required, no empty option
                let selectHtml = createSelect(targetLayerInputId, labelText, layerOptions, '', '', true, false);
                targetControlDiv.innerHTML = selectHtml; // Replace input with select
                clearFieldError(targetLayerInputId); // Clear any previous loading errors
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
                     try { formHtml = generateStyleEditForm(selectedName, elementData); } catch(e) { throw new Error(`Error in generateStyleEditForm: ${e.message}`); }
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
                      } catch(e) { throw new Error(`Error generating source form: ${e.message}`); }
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
                      } catch(e) { throw new Error(`Error generating group form: ${e.message}`); }
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

function generateLayerEditForm(layerData, layerType) {
    console.log(`[Generate Edit Form] Generating for ${layerType} layer:`, layerData);
    let formHtml = '';
    let fH = ''; // Usar fH consistentemente como en tu código original

    try { // Envuelve todo en try...catch
        const isWMS = layerType === 'WMS'; const isWFS = layerType === 'WFS'; const isWMTS = layerType === 'WMTS';
        let layerFieldName = 'Layer Name'; let layerInputId = ''; let layerValue = '';

        if (isWMS) { layerInputId = 'edit-layer-layers'; layerValue = layerData.layers || ''; layerFieldName = 'Layer Name(s) on Server'; }
        else if (isWFS) { layerInputId = 'edit-layer-typeName'; layerValue = layerData.typeName || layerData.name || ''; layerFieldName = 'Feature Type Name'; } // Asegura que layerData.name exista
        else if (isWMTS) { layerInputId = 'edit-layer-layer'; layerValue = layerData.layer || ''; layerFieldName = 'Layer Name on Server'; }

        // Campos comunes
        fH += `<input type="hidden" id="edit-layer-original-name" value="${layerData.name || ''}">`; // Guarda nombre original
        fH += createField('edit-layer-name', 'Name (ID)', 'text', layerData.name || '', 'Unique ID for Origo', true, 'data-validate-unique="layer"'); // Permitir editar Name
        fH += createField('edit-layer-title', 'Title', 'text', layerData.title || '', 'Legend title', true);
        // ... (Group select) ...
        const grpOpts = [{ value: '', text: '(No Group)' }]; /* ... poblar grpOpts ... */ fH += createSelect('edit-layer-group', 'Group', grpOpts, layerData.group || '', '', false, true);
        // ... (Source select) ...
        const srcOpts = [{ value: '', text: '-- Select --' }]; /* ... poblar srcOpts ... */ fH += createSelect('edit-layer-source', 'Source', srcOpts, layerData.source || '', 'Source defined in "source"', true, false);

        // Campo para Layer/Type Name (inicialmente input, loadLayerList lo cambia a select)
        fH += `<div class="field"><label class="label" for="${layerInputId}">${layerFieldName} <span class="has-text-danger">*</span></label><div class="control"><input class="input" type="text" id="${layerInputId}" value="${layerValue}" placeholder="Select Source or type manually" required><p class="help" id="${layerInputId}-help">Select Source or type manually</p></div></div>`;

        // Campos específicos del tipo
        if (isWMS) { const fmt = ['image/png', 'image/jpeg', 'image/gif', 'image/tiff'].map(f => ({ value: f, text: f })); fH += createSelect('edit-layer-format', 'Image Format', fmt, layerData.format || 'image/png'); fH += createRadio('edit-layer-tiled', [{ value: 'true', text: 'True' }, { value: 'false', text: 'False' }], String(layerData.tiled !== false), 'Tiled'); }
        else if (isWFS) {
             fH += createField('edit-layer-geometryName', 'Geometry Attribute', 'text', layerData.geometryName || 'geom');
             fH += createField('edit-layer-outputFormat', 'Output Format', 'text', layerData.outputFormat || 'application/json');
             fH += createCheckbox('edit-layer-editable', 'Editable', layerData.editable || false);
             // Añadir botón Fetch junto al textarea
              const attributesTextareaId = 'edit-layer-attributes-json';
              fH += `<div class="field">
                         <label class="label" for="${attributesTextareaId}">Attributes (JSON)
                             <button type="button" class="button is-small is-link is-outlined ml-2"
                                     onclick="fetchAndPopulateWfsAttributes('edit-layer-source', 'edit-layer-typeName', '${attributesTextareaId}')"
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
        }
        else if (isWMTS) { /* ... */ }

        // Campos comunes finales
        fH += createField('edit-layer-attribution', 'Attribution', 'text', layerData.attribution || '');
        fH += createCheckbox('edit-layer-queryable', 'Queryable', layerData.queryable !== false);
        fH += createCheckbox('edit-layer-visible', 'Visible by Default', layerData.visible || false);
        if (isWMS || isWFS) { /* ... Origo Style select ... */ }

        formHtml = fH; // Asigna el HTML construido
        console.log("[Generate Edit Form] Form generated successfully.");
        return formHtml;

    } catch (error) {
         console.error(`[Generate Edit Form] Error generating form for ${layerType}:`, error);
         // Devuelve un mensaje de error HTML o lanza el error para que lo capture el llamador
         return `<p class="has-text-danger">Error generating form details: ${error.message}</p>`;
         // O: throw error;
    }
}
    function generateStyleEditForm(styleName, styleData) { /* ... unchanged ... */
        let fH = ''; fH += `<input type="hidden" id="edit-style-name" value="${styleName}"><h4>Editing Style: ${styleName}</h4>`; let dType = 'json'; if (Array.isArray(styleData) && styleData.length > 0 && Array.isArray(styleData[0]) && styleData[0].length > 0) { const r = styleData[0][0]; if (r.circle) dType = 'simple_point'; else if (r.icon) dType = 'icon'; else if (r.text) dType = 'text'; else if (r.stroke && !r.fill) dType = 'simple_line'; else if (r.fill && r.stroke) dType = 'simple_polygon'; } fH += `<p>Detected type: ${dType} (basic detection)</p>`; if (['simple_point', 'icon', 'text', 'simple_line', 'simple_polygon'].includes(dType)) { fH += '<p class="help">Edit basic properties OR use JSON textarea.</p>'; const r = styleData[0][0]; if (r.circle) { fH += createField('edit_style_point_radius', 'Radius', 'number', r.circle.radius || '5'); fH += createField('edit_style_point_fill_color', 'Fill Color', 'color', r.circle.fill?.color || '#fff'); fH += createField('edit_style_point_stroke_color', 'Stroke Color', 'color', r.circle.stroke?.color || '#000'); fH += createField('edit_style_point_stroke_width', 'Stroke Width', 'number', r.circle.stroke?.width || '1'); } if (r.icon) { fH += createField('edit_style_icon_src', 'Icon URL', 'text', r.icon.src || '', '', true); fH += createField('edit_style_icon_scale', 'Scale', 'number', r.icon.scale || '1', 'step="0.1"'); fH += createField('edit_style_icon_anchorX', 'Anchor X', 'number', r.icon.anchor?.[0] || '0.5', 'step="0.1"'); fH += createField('edit_style_icon_anchorY', 'Anchor Y', 'number', r.icon.anchor?.[1] || '0.5', 'step="0.1"'); fH += createField('edit_style_icon_opacity', 'Opacity', 'number', r.icon.opacity || '1', 'step="0.1" min="0" max="1"'); } if (r.stroke && dType === 'simple_line') { fH += createField('edit_style_line_stroke_color', 'Stroke Color', 'color', r.stroke.color || '#00f'); fH += createField('edit_style_line_stroke_width', 'Stroke Width', 'number', r.stroke.width || '2'); fH += createField('edit_style_line_stroke_dash', 'Stroke Dash', 'text', r.stroke.lineDash?.join(',') || ''); } if (r.fill && r.stroke && dType === 'simple_polygon') { let fc = '#fff', fo = 0.5; if (r.fill.color?.startsWith('rgba')) { const p = r.fill.color.match(/(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)/); if (p) { fc = `#${parseInt(p[1]).toString(16).padStart(2, '0')}${parseInt(p[2]).toString(16).padStart(2, '0')}${parseInt(p[3]).toString(16).padStart(2, '0')}`; fo = parseFloat(p[4]); } } else if (r.fill.color?.startsWith('#')) { fc = r.fill.color; } fH += createField('edit_style_poly_fill_color', 'Fill Color', 'color', fc); fH += createField('edit_style_poly_fill_opacity', 'Fill Opacity', 'number', fo, 'step="0.1" min="0" max="1"'); fH += createField('edit_style_poly_stroke_color', 'Stroke Color', 'color', r.stroke.color || '#000'); fH += createField('edit_style_poly_stroke_width', 'Stroke Width', 'number', r.stroke.width || '1'); fH += createField('edit_style_poly_stroke_dash', 'Stroke Dash', 'text', r.stroke.lineDash?.join(',') || ''); } fH += '<hr>'; } else { fH += '<p class="help">Form editing unavailable. Edit JSON directly.</p>'; } fH += createTextarea('edit-style-json-value', 'Style Definition (JSON)', JSON.stringify(styleData, null, 2), 'Edit here for full control', 15, false, 'data-validate-json="true"'); return fH;
    }
    window.applyEditChanges = function () { /* ... unchanged logic, uses getSelect for layer name now ... */
        const editType = document.getElementById('edit-selector').value; const selector = document.getElementById('edit-element-selector'); const selectedName = selector ? selector.value : null; const formContainerId = 'edit-details-form'; if (!editor || !selectedName) { alert("Editor not ready or no element selected."); return; } if (!validateModalForm(formContainerId)) { alert('Please fix errors in the form.'); return; } console.log(`Applying edit: ${editType}: ${selectedName}`); try { let jsonData = JSON.parse(editor.getValue()); let changed = false; const getValue = (id) => document.getElementById(id)?.value?.trim(); const getCheckbox = (id) => document.getElementById(id)?.checked; const getRadio = (name) => document.querySelector(`#${formContainerId} input[name="${name}"]:checked`)?.value; const getSelect = (id) => document.getElementById(id)?.value; switch (editType) { case 'wms': case 'wfs': case 'wmts': const lIdx = jsonData.layers.findIndex(l => l.name === selectedName); if (lIdx !== -1) { const l = jsonData.layers[lIdx]; l.title = getValue('edit-layer-title') ?? l.title; l.group = getSelect('edit-layer-group') || undefined; l.source = getSelect('edit-layer-source') || undefined; l.attribution = getValue('edit-layer-attribution') || undefined; l.queryable = getCheckbox('edit-layer-queryable') ?? l.queryable; l.visible = getCheckbox('edit-layer-visible') ?? l.visible; if (l.type === 'WMS') { l.layers = getSelect('edit-layer-layers') ?? l.layers; l.format = getSelect('edit-layer-format') ?? l.format; l.tiled = getRadio('edit-layer-tiled') === 'true'; l.style = getSelect('edit-layer-origo-style') || undefined; } else if (l.type === 'WFS') { l.typeName = getSelect('edit-layer-typeName') ?? l.typeName; l.geometryName = getValue('edit-layer-geometryName') ?? l.geometryName; l.outputFormat = getValue('edit-layer-outputFormat') ?? l.outputFormat; l.editable = getCheckbox('edit-layer-editable') ?? l.editable; l.style = getSelect('edit-layer-origo-style') || undefined; const attrJson = getValue('edit-layer-attributes-json'); l.attributes = attrJson ? JSON.parse(attrJson) : undefined; } else if (l.type === 'WMTS') { l.layer = getSelect('edit-layer-layer') ?? l.layer; l.matrixSet = getValue('edit-layer-matrixSet') ?? l.matrixSet; l.style = getValue('edit-layer-wmts-style') ?? l.style; l.format = getSelect('edit-layer-format') ?? l.format; } changed = true; } else { throw new Error(`Layer '${selectedName}' not found.`); } break; case 'style': if (jsonData.styles && jsonData.styles[selectedName]) { const styleJsonText = getValue('edit-style-json-value'); if (styleJsonText) { const updatedStyleData = JSON.parse(styleJsonText); if (JSON.stringify(jsonData.styles[selectedName]) !== JSON.stringify(updatedStyleData)) { jsonData.styles[selectedName] = updatedStyleData; changed = true; console.log("Style updated from JSON."); } } else { console.warn("Edit from simple style fields not implemented."); } } else { throw new Error(`Style '${selectedName}' not found.`); } break; case 'source': if (jsonData.source && jsonData.source[selectedName]) { const srcData = jsonData.source[selectedName]; srcData.url = getValue('edit-source-url') ?? srcData.url; srcData.version = getValue('edit-source-version') || undefined; srcData.workspace = getValue('edit-source-workspace') || undefined; if (srcData.service?.toUpperCase() === 'WMTS') { srcData.matrixSet = getValue('edit-source-matrixSet') || undefined; } Object.keys(srcData).forEach(k => srcData[k] === undefined && delete srcData[k]); changed = true; } else { throw new Error(`Source '${selectedName}' not found.`); } break; case 'group': const grpName = getValue('edit-group-name'); const _findUpdGrp = (n, grps, t, e) => { for (let g of grps) { if (g.name === n) { g.title = t; g.expanded = e; return true; } if (g.groups) if (_findUpdGrp(n, g.groups, t, e)) return true; } return false; }; const newT = getValue('edit-group-title'); const newE = getCheckbox('edit-group-expanded'); if (grpName && _findUpdGrp(grpName, jsonData.groups || [], newT, newE)) { changed = true; } else { throw new Error(`Group '${grpName}' not found.`); } break; } if (changed) { currentJsonData = jsonData; editor.setValue(JSON.stringify(jsonData, null, 2)); closeEditModal(); alert("Element updated (Press 'Save Changes')."); } else { console.log("No changes detected."); closeEditModal(); } } catch (error) { console.error("Error applying edits:", error); alert("Error applying changes: " + error.message); }
    };

    // --- Lógica de Creación (Attach Listener in populateCreateSelector) ---
    window.handleCreateSelection = function () { /* ... sin cambios ... */
        const createType = document.getElementById('create-selector').value; populateCreateSelector(createType);
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
                    sourceSelectId = 'wfs-source'; targetLayerInputId = 'wfs-typeName';
                    formHtml += createField('wfs-name', 'Name', 'text', '', 'Unique ID', true, 'data-validate-unique="layer"');
                    formHtml += createField('wfs-title', 'Title', 'text', '', 'Legend title', true);
                    formHtml += createSelect('wfs-group', 'Group', grpOpts, '', '', false, true); formHtml += `<div class="control" id="new-group-input" style="display:none;margin-top:10px;"><input class="input" type="text" id="wfs-new-group-name" placeholder="New group name"></div>`;
                    formHtml += createField('wfs-attribution', 'Attribution', 'text');
                    formHtml += createSelect(sourceSelectId, 'Source', srcOpts, '', 'WFS Source', true, false);
                    formHtml += `<div class="field"><label class="label" for="${targetLayerInputId}">Feature Type Name <span class="has-text-danger">*</span></label><div class="control"><input class="input" type="text" id="${targetLayerInputId}" placeholder="Select Source to load types" required disabled><p class="help" id="${targetLayerInputId}-help">Select Source to load types</p></div></div>`;
                    formHtml += createField('wfs-geometryName', 'Geometry Attribute', 'text', 'geom'); formHtml += createSelect('wfs-style', 'Origo Style', styOpts, '', 'Style for features', false, true); formHtml += createField('wfs-outputFormat', 'Output Format', 'text', 'application/json'); formHtml += createCheckbox('wfs-queryable', 'Queryable', true); formHtml += createCheckbox('wfs-visible', 'Visible by Default', false); formHtml += createCheckbox('wfs-editable', 'Editable', false); formHtml += createTextarea('wfs-attributes-json', 'Attributes (JSON)', '[]', 'e.g., [{"name":"col1"}]', 5, false, 'data-validate-json="true"');
                    break;
                // ... other cases (style, source, group) unchanged ...
                case 'style': formHtml += createField('style-name', 'Style Name', 'text', '', 'Unique name', true, 'data-validate-unique="style"'); const styTypOpts = [{ value: 'simple_point', text: 'Simple Point' }, { value: 'simple_line', text: 'Simple Line' }, { value: 'simple_polygon', text: 'Simple Polygon' }, { value: 'icon', text: 'Icon' }, { value: 'text', text: 'Text Label' }, { value: 'rule', text: 'Rule-based (Adv)' }, { value: 'json', text: 'Raw JSON' }]; formHtml += createSelect('style-type', 'Style Type', styTypOpts, 'simple_point'); formHtml += '<div id="style-details-form" style="margin-top:10px;"></div>'; setTimeout(() => { const s = document.getElementById('style-type'); if (s) { s.addEventListener('change', populateStyleDetailsForm); populateStyleDetailsForm(); } }, 0); break;
                case 'source': formHtml += createField('source-name', 'Source Name', 'text', '', 'Unique ID', true, 'data-validate-unique="source"'); formHtml += createField('source-url', 'URL', 'url', '', 'Service base URL', true); const srcTypOpts = ['WMS', 'WFS', 'WMTS', 'XYZ', 'VectorTile'].map(t => ({ value: t, text: t })); formHtml += createSelect('source-type', 'Service Type', srcTypOpts, 'WMS'); formHtml += createField('source-version', 'Version (WMS/WFS)', 'text', ''); formHtml += createField('source-workspace', 'Workspace (GeoServer)', 'text', ''); formHtml += createField('source-matrixSet', 'MatrixSet (WMTS)', 'text', '', 'Only if Type=WMTS'); break;
                case 'group': formHtml += createField('group-name', 'Group Name (ID)', 'text', '', 'Unique ID', true, 'data-validate-unique="group"'); formHtml += createField('group-title', 'Group Title', 'text', '', 'Title in legend', true); const pOpts = [{ value: '', text: '(Root Group)' }]; const addPOpts = (grps, pfx = '') => { grps.forEach(g => { pOpts.push({ value: g.name, text: pfx + (g.title || g.name) }); if (g.groups) addPOpts(g.groups, pfx + '- '); }); }; if (currentJsonData.groups) addPOpts(currentJsonData.groups); formHtml += createSelect('group-parent', 'Parent Group (Optional)', pOpts, '', '', false, true); formHtml += createCheckbox('group-expanded', 'Expanded by Default', false); break;
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
    function buildStyleObject(styleType) { /* ... unchanged ... */
        const getValue = (id) => document.getElementById(id)?.value?.trim(); let styleDef = {}; switch (styleType) { case 'simple_point': styleDef = [[{ "circle": { radius: parseFloat(getValue('style-point-radius') || 5), fill: { color: getValue('style-point-fill-color') || '#f00' }, stroke: { color: getValue('style-point-stroke-color') || '#000', width: parseInt(getValue('style-point-stroke-width') || 1) } } }]]; break; case 'simple_line': const ld = (getValue('style-line-stroke-dash') || '').split(',').map(Number).filter(n => !isNaN(n)); styleDef = [[{ "stroke": { color: getValue('style-line-stroke-color') || '#00f', width: parseInt(getValue('style-line-stroke-width') || 2), lineDash: ld.length ? ld : undefined } }]]; if (!styleDef[0][0].stroke.lineDash) delete styleDef[0][0].stroke.lineDash; break; case 'simple_polygon': const pd = (getValue('style-poly-stroke-dash') || '').split(',').map(Number).filter(n => !isNaN(n)); const fo = parseFloat(getValue('style-poly-fill-opacity') || 0.5); const fc = getValue('style-poly-fill-color') || '#0f0'; const h2r = (h, a) => { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return `rgba(${r},${g},${b},${a})`; }; const fcr = fc.startsWith('#') ? h2r(fc, fo) : fc; styleDef = [[{ "fill": { color: fcr }, "stroke": { color: getValue('style-poly-stroke-color') || '#000', width: parseInt(getValue('style-poly-stroke-width') || 1), lineDash: pd.length ? pd : undefined } }]]; if (!styleDef[0][0].stroke.lineDash) delete styleDef[0][0].stroke.lineDash; break; case 'icon': styleDef = [[{ "icon": { src: getValue('style-icon-src'), scale: parseFloat(getValue('style-icon-scale') || 1), anchor: [parseFloat(getValue('style-icon-anchorX') || 0.5), parseFloat(getValue('style-icon-anchorY') || 0.5)], opacity: parseFloat(getValue('style-icon-opacity') || 1) } }]]; if (!styleDef[0][0].icon.src) throw new Error("Icon URL required."); break; case 'text': styleDef = [[{ "text": { property: getValue('style-text-property') || 'name', font: getValue('style-text-font') || '12px Arial', fill: { color: getValue('style-text-fill-color') || '#000' }, stroke: { color: getValue('style-text-stroke-color') || '#fff', width: parseInt(getValue('style-text-stroke-width') || 2) }, offsetX: parseInt(getValue('style-text-offsetX') || 0), offsetY: parseInt(getValue('style-text-offsetY') || -15) } }]]; break; case 'rule': throw new Error("Rule-based creation not implemented."); case 'json': const rj = getValue('style-raw-json'); if (!rj) throw new Error("JSON is empty."); try { styleDef = JSON.parse(rj); if (!Array.isArray(styleDef) || !styleDef.every(Array.isArray)) throw new Error("JSON must be array of arrays."); } catch (e) { throw new Error("Invalid JSON: " + e.message); } break; default: throw new Error("Unsupported style type."); } return styleDef;
    }
    // /public/js/other/script_origo.js (Función applyCreateChanges ACTUALIZADA para ordenar capas)

window.applyCreateChanges = function () {
    const createType = document.getElementById('create-selector').value;
    const formContainerId = 'create-form';
    if (!editor) { alert("Editor not ready."); return; }
    if (!validateModalForm(formContainerId)) { alert('Please fix errors in the form.'); return; }

    console.log(`[Apply Create] Type: ${createType}`);
    let elementAdded = false;

    try {
        let jsonData = JSON.parse(editor.getValue());
        let newItem; // Definir newItem fuera del switch para acceso general al final
        const getValue = (id) => document.getElementById(id)?.value?.trim();
        const getCheckbox = (id) => document.getElementById(id)?.checked;
        const getRadio = (name) => document.querySelector(`#${formContainerId} input[name="${name}"]:checked`)?.value;
        const getSelect = (id) => document.getElementById(id)?.value;
        const handleNewGroup = (grpSelId, newGrpInpId) => { /* ... tu helper handleNewGroup ... */ };

        switch (createType) {
            case 'wms': case 'wmts': case 'wfs':
                newItem = { type: createType.toUpperCase() };
                newItem.name = getValue(`${createType}-name`);
                newItem.title = getValue(`${createType}-title`);
                newItem.group = handleNewGroup(`${createType}-group`, `${createType}-new-group-name`);
                newItem.attribution = getValue(`${createType}-attribution`) || undefined;
                newItem.source = getSelect(`${createType}-source`);
                newItem.visible = getCheckbox(`${createType}-visible`) || false;
                // Specific fields...
                if (createType === 'wms') { newItem.layers = getSelect('wms-layers-name'); newItem.style = getSelect('wms-style') || undefined; newItem.tiled = getRadio('wms-tiled') === 'true'; newItem.format = getSelect('wms-format') || 'image/png'; newItem.queryable = getCheckbox('wms-queryable'); }
                else if (createType === 'wmts') { newItem.layer = getSelect('wmts-layer-name'); newItem.style = getValue('wmts-style') || 'default'; newItem.matrixSet = getValue('wmts-matrixSet'); newItem.format = getSelect('wmts-format') || 'image/png'; }
                else if (createType === 'wfs') { newItem.typeName = getSelect('wfs-typeName'); newItem.geometryName = getValue('wfs-geometryName') || 'geom'; newItem.style = getSelect('wfs-style') || undefined; newItem.outputFormat = getValue('wfs-outputFormat') || 'application/json'; newItem.queryable = getCheckbox('wfs-queryable'); newItem.editable = getCheckbox('wfs-editable'); const attrJson = getValue('wfs-attributes-json'); newItem.attributes = attrJson ? JSON.parse(attrJson) : undefined; }
                Object.keys(newItem).forEach(key => newItem[key] === undefined && delete newItem[key]);

                // *** Lógica de Inserción de Capa ***
                if (!jsonData.layers) jsonData.layers = [];
                // Busca el índice de la primera capa base (grupo 'background')
                const firstBaseLayerIndex = jsonData.layers.findIndex(layer => layer.group && layer.group.toLowerCase() === 'background');

                if (firstBaseLayerIndex > -1) {
                    // Si se encontró una capa base, inserta la nueva ANTES
                    console.log(`[Apply Create] Inserting new layer before background layer at index ${firstBaseLayerIndex}`);
                    jsonData.layers.splice(firstBaseLayerIndex, 0, newItem);
                } else {
                    // Si no hay capas base, añade la nueva al PRINCIPIO
                    console.log("[Apply Create] No background layers found, adding new layer to the top (index 0).");
                    jsonData.layers.unshift(newItem);
                }
                elementAdded = true; // Marca como añadido
                // *** FIN Lógica de Inserción ***
                break;

            case 'style':
                 const styleName = getValue('style-name');
                 if (!jsonData.styles) jsonData.styles = {};
                 newItem = buildStyleObject(getSelect('style-type'));
                 jsonData.styles[styleName] = newItem; // Asigna al objeto
                 elementAdded = true;
                 break; // Necesitamos el nombre (key) para el mensaje final

            case 'source':
                 const sourceName = getValue('source-name');
                 if (!jsonData.source) jsonData.source = {};
                 newItem = { url: getValue('source-url'), /* ... otros campos source ... */ };
                 Object.keys(newItem).forEach(key => newItem[key] === undefined && delete newItem[key]);
                 jsonData.source[sourceName] = newItem; // Asigna al objeto
                 elementAdded = true;
                 break; // Necesitamos el nombre (key) para el mensaje final

            case 'group':
                newItem = { name: getValue('group-name'), title: getValue('group-title'), expanded: getCheckbox('group-expanded') || false };
                const parentGroupName = getSelect('group-parent');
                if (!jsonData.groups) jsonData.groups = [];

                const findAndAddSub = (name, grps, newG) => { /* ... tu función findAndAddSub que pone elementAdded = true; ... */ };

                if (parentGroupName) { // Añadiendo subgrupo
                    if (!findAndAddSub(parentGroupName, jsonData.groups, newItem)) {
                        throw new Error(`Parent group '${parentGroupName}' not found.`);
                    }
                    // elementAdded se establece dentro de findAndAddSub
                } else { // Añadiendo grupo raíz
                    console.log("[Apply Create] Adding new group to the top of the root groups.");
                    jsonData.groups.unshift(newItem); // <-- Añade al PRINCIPIO de los grupos raíz
                    elementAdded = true;
                }
                break;

            default:
                throw new Error("Unrecognized create type.");
        } // Fin switch

        // Verificar si se añadió (esta lógica ya estaba corregida)
        if (!elementAdded && createType === 'group' && getSelect('group-parent')) { /* Ya se lanzó error si falló */ }
        else if (!elementAdded) { throw new Error("Failed to add element."); }

        // Actualizar editor y cerrar modal
        currentJsonData = jsonData;
        editor.setValue(JSON.stringify(jsonData, null, 2));
        closeCreateModal();
        // Obtener el nombre/key para el mensaje, incluso para style/source
        const finalName = (createType === 'style' || createType === 'source') ? getValue(`${createType}-name`) : newItem?.name;
        alert(`Element '${finalName}' created (Press 'Save Changes' to make permanent).`);

    } catch (error) {
        console.error("Error creating:", error);
        alert("Error creating element: " + error.message);
    }
}; // Fin applyCreateChanges

    // --- Delete Modal Functions ---
    // openDeleteModal, closeDeleteModal, handleDeleteTypeSelection, applyDelete
    // No changes needed here

}); // Fin require


// --- Listeners y Funciones Adicionales ---
// DOMContentLoaded, handlePublish, handleUnpublish, redirectToMapPage
// No changes needed here
// En public/js/other/script_origo.js -> dentro de document.addEventListener('DOMContentLoaded', ...)

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
 const copyJsonButtons = document.querySelectorAll('[id^="copyJsonButton-"]'); copyJsonButtons.forEach((b) => { b.addEventListener('click', () => { const f = b.getAttribute('data-file'); if (!f) return; const nB = prompt(`Enter base name for copy of '${f}' (no .json extension):`); if (nB && nB.trim()) { const nF = nB.trim() + '.json'; if (!/^[a-zA-Z0-9_-]+$/.test(nB)) { alert("Invalid name. Use letters, numbers, underscore, hyphen."); return; } if (!confirm(`Create copy named '${nF}' (and corresponding .ejs)?`)) return; fetch(`/origoadmin/copy-json?file=${encodeURIComponent(f)}&newFileName=${encodeURIComponent(nB)}`, { method: 'POST' }).then(r => { if (!r.ok) return r.json().then(err => { throw new Error(`Error copying (${r.status}): ${err.error || '?'}`); }); return r.json(); }).then(d => { console.log('Copy response:', d); alert(`Map '${f}' copied to '${nF}'.`); location.reload(); }).catch(err => { console.error('Error copying map:', err); alert('Error copying map: ' + err.message); }); } }); });
    const publishButtons = document.querySelectorAll('[id^="publishButton-"]'); const unpublishButtons = document.querySelectorAll('[id^="unpublishButton-"]'); publishButtons.forEach((b) => { b.addEventListener('click', () => { const f = b.getAttribute('data-file'); if (f) handlePublish(f); }); }); unpublishButtons.forEach((b) => { b.addEventListener('click', () => { const f = b.getAttribute('data-file'); if (f) handleUnpublish(f); }); });
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

    window.openDescriptionEditor = async function(mapBaseName) {
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
            try { descriptionEditor.destruct(); } catch(e) { console.warn("Error destroying previous Jodit instance:", e); }
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

    window.closeDescriptionModal = function() {
        const modal = document.getElementById('description-modal');
        if (modal) modal.classList.remove('is-active');
        // Destruir instancia de Jodit para liberar memoria
        if (descriptionEditor) {
             try { descriptionEditor.destruct(); } catch(e) { console.warn("Error destroying Jodit instance on close:", e); }
            descriptionEditor = null;
        }
        currentDescriptionMapName = null;
        // Limpiar textarea por si acaso
         const textarea = document.getElementById('descriptionEditorTextarea');
         if(textarea) textarea.value = '';
        console.log("Description modal closed.");
    };

    // Esta función es llamada por el botón "Save Description"
    // NO necesita 'window.' si el onclick en el HTML se ajustó para pasar el mapName
    // Pero si mantienes onclick="saveDescription()", SÍ necesita window.
    window.saveDescription = async function() {
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
                headers: {'Content-Type': 'application/json'},
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

      window.editorUndo = function() {
        if (editor) {
            editor.trigger('button', 'undo', null); // 'button' es una fuente arbitraria
            editor.focus();
        } else { console.warn("Undo failed: Editor not ready."); }
    }

    window.editorRedo = function() {
        if (editor) {
            editor.trigger('button', 'redo', null);
            editor.focus();
        } else { console.warn("Redo failed: Editor not ready."); }
    }

    window.editorFind = function() {
        if (editor) {
            editor.getAction('actions.find').run(); // Abre el widget de búsqueda
        } else { console.warn("Find failed: Editor not ready."); }
    }

    window.editorFormat = function() {
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

    window.editorCommandPalette = function() {
         if (editor) {
            editor.trigger('button', 'editor.action.quickCommand', null); // Abre paleta de comandos (F1)
         } else { console.warn("Command Palette failed: Editor not ready."); }
    }

    // Opcional: Toggle para Minimapa
    let minimapEnabled = false; // O lee el estado inicial del editor si lo configuras
    window.toggleMinimap = function() {
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
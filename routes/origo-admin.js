const { isAuthenticated, checkRole } = require('./auth.js');
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');



const publishStateFilePath = path.join(__dirname, '..', 'models', 'publish-state.json');
if (!fs.existsSync(publishStateFilePath)) { fs.writeFileSync(publishStateFilePath, JSON.stringify({})); }

const isMapName = name => typeof name === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(name);
const isFileOfType = (file, ext) => typeof file === 'string' && file.endsWith(ext) && isMapName(file.slice(0, -ext.length));

router.use((req, res, next) => {
    const { file } = req.query;
    const mapName = req.body && (req.body.mapName ?? req.body.fileName);
    if (file !== undefined && !isFileOfType(file, '.json') && !isFileOfType(file, '.ejs')) {
        return res.status(400).json({ error: 'Invalid file name.' });
    }
    if (mapName !== undefined && !isMapName(mapName)) {
        return res.status(400).json({ error: 'Invalid map name.' });
    }
    next();
});

router.get('/origo-admin', (req, res) => {
    const mapConfigFolderPath = path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map');

    fs.readdir(mapConfigFolderPath, (err, files) => {
        if (err) {
            console.error('[Admin Route] Error reading map config directory:', err);
            return res.status(500).render('error', { message: "Error reading map directory.", error: err });
        }

        const jsonFiles = files.filter(file => path.extname(file) === '.json');
        let publishState = {}; // Define fuera del try

        try {
            // Lee publish-state.json si existe
            if (fs.existsSync(publishStateFilePath)) {
                publishState = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
            }
        } catch (error) {
            console.error("[Admin Route] Error reading state file:", error);
            // publishState seguirá siendo {} si hay error
        }

        // Log para depurar los datos que se envían
        console.log("[ADMIN LIST] Data being passed to map-list:", { files: jsonFiles.length, publishState });

        // Pasar SOLO publishState a la vista
        // *** ¡RECUERDA ACTUALIZAR map-list.ejs! ***
        //    Debe usar publishState[mapName].public para el icono del candado
        res.render('map-list', {
            files: jsonFiles,
            publishStateData: publishState // Cambié el nombre para que coincida con tu EJS
            // accessState ya no se pasa
        });
    });
});


// --- RUTA POST /toggle-access (CORREGIDA para usar SOLO publish-state.json) ---
router.post('/toggle-access', (req, res) => {
    const mapBaseName = req.body.mapName; // Nombre base del mapa

    if (!mapBaseName) {
        return res.status(400).json({ success: false, message: 'Map name not provided.' });
    }

    try {
        let publishStateData = {};
        // Leer publish-state.json de forma segura
        if (fs.existsSync(publishStateFilePath)) {
            try {
                publishStateData = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
            } catch (parseError) {
                console.error("Error parsing publish-state.json:", parseError);
                // Si el archivo principal está corrupto, es un error grave
                return res.status(500).json({ success: false, message: 'Error reading publish state file.' });
            }
        } else {
            // Si el archivo no existe, tampoco podemos continuar
            console.error("publish-state.json not found!");
            return res.status(500).json({ success: false, message: 'Publish state file not found.' });
        }

        // Verificar que la entrada para este mapa existe y es un objeto
        if (!publishStateData[mapBaseName] || typeof publishStateData[mapBaseName] !== 'object') {
            console.error(`[Toggle Access] Map state entry for '${mapBaseName}' not found or invalid in publish-state.json.`);
            // Devuelve 404 si no encontramos la entrada del mapa
            return res.status(404).json({ success: false, message: `Map state entry for '${mapBaseName}' not found or invalid.` });
        }

        // ----> Lógica Principal de Toggle <----
        // Obtener el estado 'public' actual del objeto del mapa (default a false si no existe)
        const currentState = publishStateData[mapBaseName].public === true; // Asegura que sea booleano
        const newState = !currentState; // Invertir el estado
        publishStateData[mapBaseName].public = newState; // Actualizar la propiedad 'public' en el objeto
        // ----> Fin Lógica Principal <----

        // Guardar el objeto publishStateData COMPLETO actualizado en el archivo
        fs.writeFileSync(publishStateFilePath, JSON.stringify(publishStateData, null, 2));

        // Log actualizado para reflejar que se cambia el estado 'public'
        console.log(`[Admin Route] Public access for map '${mapBaseName}' toggled to: ${newState}`);
        // Devolver el nuevo estado para que el frontend actualice la UI
        res.json({ success: true, newState: newState ? 'public' : 'private' });

    } catch (error) {
        // Captura errores generales (ej. error al escribir archivo)
        console.error(`[Admin Route] Error toggling public access state for map '${mapBaseName}':`, error);
        res.status(500).json({ success: false, message: 'Error updating public access state file.' });
    }
});
// --- FIN RUTA POST /toggle-access ---

// --- OTRAS RUTAS DE ADMIN (get-json, edit-json, save-json, delete-*, copy-json) ---
// (Mantenidas como estaban en tu código original)

router.get('/get-json', (req, res) => {
    const fileName = req.query.file;
    const filePath = path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map', fileName);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) { console.error('Error reading JSON:', err); return res.sendStatus(500); }
        try { const json = JSON.parse(data); res.json(json); }
        catch (error) { console.error('Error parsing JSON content:', error); return res.sendStatus(500); }
    });
});

router.get('/edit-json', (req, res) => {
    const fileName = req.query.file;
    const filePath = path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map', fileName);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) { console.error('Error reading JSON for edit:', err); return res.sendStatus(500); }
        try { const json = JSON.parse(data); res.json(json); } // Devuelve JSON para Monaco
        catch (error) { console.error('Error parsing JSON for edit:', error); return res.sendStatus(500); }
    });
});

router.post('/save-json', (req, res) => {
    const editedJson = req.body;
    const fileName = req.query.file;
    if (!fileName) return res.status(400).send('Error: Missing file name parameter.');
    if (!editedJson) return res.status(400).send('Error: Missing JSON data in request body.');

    const filePath = path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map', `${fileName}`);
    console.log('JSON received on /save-json for file:', fileName); // Log filename

    try {
        // Validar JSON recibido antes de escribir (opcional, Monaco ya valida)
        const jsonString = JSON.stringify(editedJson, null, 2); // Formatear
        fs.writeFile(filePath, jsonString, 'utf8', (error) => {
            if (error) { console.error('Error saving JSON:', error); return res.status(500).send('Error saving JSON file.'); }
            console.log('JSON file saved successfully:', filePath);
            res.sendStatus(200); // OK
        });
    } catch (error) { // Catch errors during stringify or path handling
        console.error('Error processing save request:', error);
        res.status(500).send('Error processing save request.');
    }
});

// --- RUTA DELETE /delete-json (MODIFICADA para eliminar estado) ---
router.delete('/delete-json', (req, res) => {
    const fileName = req.query.file; // Nombre del archivo JSON (ej: 'mapa.json')
    if (!fileName) {
        return res.status(400).json({ error: 'Missing file name parameter.' });
    }

    // Evitar borrar index.json
    if (fileName.toLowerCase() === 'index.json') {
        console.error('Attempt to delete protected index.json denied.');
        return res.status(400).json({ error: 'The default index.json cannot be deleted.' });
    }

    const mapBaseName = fileName.replace('.json', ''); // Nombre base (ej: 'mapa')
    const filePath = path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map', fileName);

    if (fs.existsSync(filePath)) {
        // 1. Borrar el archivo JSON
        fs.unlink(filePath, (error) => {
            if (error) {
                console.error('Error deleting JSON file:', error);
                return res.status(500).json({ error: 'Error deleting JSON file.' });
            }
            console.log(`JSON file deleted: ${filePath}`);

            // ---> INICIO: Eliminar entrada de publish-state.json <---
            try {
                if (fs.existsSync(publishStateFilePath)) {
                    const publishState = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
                    // Verifica si la entrada existe antes de borrarla
                    if (publishState.hasOwnProperty(mapBaseName)) {
                        delete publishState[mapBaseName]; // Elimina la entrada completa del objeto
                        fs.writeFileSync(publishStateFilePath, JSON.stringify(publishState, null, 2));
                        console.log(`Removed entry '${mapBaseName}' from publish state.`);
                    } else {
                         console.warn(`Entry '${mapBaseName}' not found in publish state. No state removed.`);
                    }
                }
                 // Envía la respuesta DESPUÉS de intentar actualizar el estado
                 // Nota: Si la actualización del estado falla, el archivo JSON ya se borró.
                 // Considera si necesitas una lógica de rollback más compleja si la escritura del estado falla.
                 res.json({ message: 'JSON file deleted and state entry removed successfully.' });

            } catch (stateError) {
                 console.error(`Error updating publish state after deleting JSON for ${mapBaseName}:`, stateError);
                 // Informar que el JSON se borró pero el estado falló
                 res.status(500).json({ message: 'JSON file deleted, but encountered error removing state entry.' });
            }
            // ---> FIN: Eliminar entrada de publish-state.json <---

            // Ya no se envía la respuesta aquí, se envía dentro del try/catch de arriba
            // res.json({ message: 'JSON file deleted successfully.' });
        });
    } else {
        console.warn('Attempt to delete non-existent JSON file:', filePath);
        // Si el JSON no existe, igual intenta limpiar el estado por si quedó huérfano
        try {
             if (fs.existsSync(publishStateFilePath)) {
                 const publishState = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
                 if (publishState.hasOwnProperty(mapBaseName)) {
                     delete publishState[mapBaseName];
                     fs.writeFileSync(publishStateFilePath, JSON.stringify(publishState, null, 2));
                     console.log(`Cleaned up orphaned entry '${mapBaseName}' from publish state.`);
                 }
             }
        } catch(e) { console.error("Error cleaning up orphaned state for non-existent JSON:", e); }
        res.status(404).json({ error: 'JSON file not found.' });
    }
});

router.delete('/delete-ejs', (req, res) => {
    const ejsFileName = req.query.file;
    if (!isFileOfType(ejsFileName, '.ejs')) return res.status(400).json({ error: 'Invalid file name.' });

    const mapBaseName = ejsFileName.replace('.ejs', '');
    const filePath = path.join(__dirname, '..', 'views', 'Origo', ejsFileName);

    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (error) => {
            if (error) { /* ... manejo error ... */ }
            console.log(`EJS file deleted: ${filePath}`);

            // Actualizar SOLO publish-state.json para poner published: false
            try {
                if (fs.existsSync(publishStateFilePath)) {
                    const publishState = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
                    if (publishState[mapBaseName] && typeof publishState[mapBaseName] === 'object') {
                        publishState[mapBaseName].published = false; // Correcto: Solo cambia published
                        fs.writeFileSync(publishStateFilePath, JSON.stringify(publishState, null, 2));
                        console.log(`Updated '${mapBaseName}' in publish state to published: false.`);
                    } else {
                        console.warn(`[Unpublish State] Entry for '${mapBaseName}' not found or invalid in publish state.`);
                    }
                }
                // Ya no se modifica access-state.json

                res.json({ message: `Map '${mapBaseName}' unpublished (EJS deleted, state updated).` });

            } catch (stateError) {
                console.error("Error updating state files after EJS deletion:", stateError);
                return res.status(500).json({ message: 'EJS file deleted, but encountered error updating state files.' });
            }
        });
    } else {
        console.warn('Attempt to delete non-existent EJS file:', filePath);
        // Limpiar estado si el EJS no existe (esta parte puede quedar igual,
        // aunque ahora solo limpiaría publishState)
        try {
            let stateChanged = false;
            if (fs.existsSync(publishStateFilePath)) {
                const ps = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
                if (ps.hasOwnProperty(mapBaseName)) {
                    // Quizás aquí también deberías poner published: false en lugar de borrar?
                    // O borrar está bien si el EJS no existía? Por coherencia, pongamos false:
                    if (ps[mapBaseName] && typeof ps[mapBaseName] === 'object') {
                        ps[mapBaseName].published = false;
                        stateChanged = true;
                    } else { // Si no era objeto, o no existía, bórralo para limpiar
                        delete ps[mapBaseName];
                        stateChanged = true;
                    }
                    if (stateChanged) {
                        fs.writeFileSync(publishStateFilePath, JSON.stringify(ps, null, 2));
                        console.log(`Cleaned up/Updated publish state for non-existent EJS '${ejsFileName}'.`);
                    }
                }
            }
            // Ya no se limpia access-state.json
        } catch (e) { console.error("Error cleaning up states for non-existent EJS:", e); }
        res.status(404).json({ error: 'Origo map EJS file not found.' });
    }
});


// ... (otras rutas como GET /origo-admin, POST /toggle-access, etc.) ...

// --- RUTA POST /copy-json (ACTUALIZADA para crear estado inicial) ---
// --- RUTA POST /copy-json (ESTRUCTURA CORREGIDA) ---
router.post('/copy-json', (req, res) => {
    const fileName = req.query.file;        // original .json (e.g., 'index.json')
    const newFileNameBase = req.query.newFileName; // base name for new file (e.g., 'mycopy')

    // --- Validaciones iniciales (sin cambios) ---
    if (!fileName || !newFileNameBase) {
        return res.status(400).json({ error: 'Original file and new file name base are required.' });
    }
    if (!isFileOfType(fileName, '.json')) {
        return res.status(400).json({ error: 'Invalid file name.' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newFileNameBase)) {
        return res.status(400).json({ error: "Invalid new file name. Use letters, numbers, underscore, hyphen." });
    }
    // ... (resto de validaciones: 'index', archivos existen, etc. sin cambios) ...
    const newJsonFileName = `${newFileNameBase}.json`;
    const newEjsFileName = `${newFileNameBase}.ejs`;
    const jsonSourcePath = path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map', fileName);
    const jsonDestPath = path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map', newJsonFileName);
    const ejsViewsDir = path.join(__dirname, '..', 'views', 'Origo');
    const ejsSourcePath = path.join(ejsViewsDir, `${fileName.replace('.json', '')}.ejs`);
    const ejsDestPath = path.join(ejsViewsDir, newEjsFileName);

    if (newFileNameBase.toLowerCase() === 'index') return res.status(400).json({ error: "The name 'index' is reserved." });
    if (fs.existsSync(jsonDestPath) || fs.existsSync(ejsDestPath)) return res.status(409).json({ error: 'A map with that name already exists.' });
    if (!fs.existsSync(jsonSourcePath)) return res.status(404).json({ error: 'Source JSON not found.' });
    if (!fs.existsSync(ejsSourcePath)) return res.status(404).json({ error: 'Source EJS not found. Publish the source map first.' });
    // --- Fin Validaciones ---

    // 1. Copiar JSON
    fs.copyFile(jsonSourcePath, jsonDestPath, (jsonError) => {
        if (jsonError) {
            console.error('Error copying JSON:', jsonError);
            return res.status(500).json({ error: 'Error copying JSON file.' });
        }
        console.log(`[Admin Copy] JSON copied to ${newJsonFileName}`);

        // 2. Copiar EJS (anidado dentro del callback de éxito de copiar JSON)
        fs.copyFile(ejsSourcePath, ejsDestPath, (ejsError) => {
            if (ejsError) {
                console.error('Error copying EJS file:', ejsError);
                // Intentar borrar el JSON copiado si falla la copia del EJS
                try { fs.unlinkSync(jsonDestPath); console.log(`Rolled back JSON copy: ${newJsonFileName}`); } catch (e) { }
                return res.status(500).json({ error: `Error copying EJS template file.` });
            }
            console.log(`[Admin Copy] EJS copied to ${newEjsFileName}`);

            // 3. Modificar el nuevo EJS Y LUEGO actualizar estado y responder
            //    (anidado dentro del callback de éxito de copiar EJS)
            // 3. Modificar el nuevo EJS
            try {
                let ejsContents = fs.readFileSync(ejsDestPath, 'utf8');
                const originalContent = ejsContents; // Guardar original para comparar

                // ----> INICIO: Lógica de Reemplazo CORREGIDA <----
                // Expresión Regular: Ahora busca '/origo/' dentro de las comillas
                const searchRegex = /Origo\s*\(\s*['"]\/origo\/([\w.-]+)\.json['"]\s*\)/;

                // Texto de Reemplazo: Ahora incluye '/origo/'
                const replacement = `Origo('/origo/${newJsonFileName}')`; // newJsonFileName ya es ej: 'demos.json'

                ejsContents = ejsContents.replace(searchRegex, replacement);
                // ----> FIN: Lógica de Reemplazo CORREGIDA <----

                // Verificar si el reemplazo tuvo éxito (opcional pero útil para depurar)
                if (originalContent === ejsContents) {
                    console.warn(`[Admin Copy] ADVERTENCIA: No se encontró o reemplazó el patrón Origo('/origo/....json') en ${newEjsFileName}. Revisa la expresión regular o el contenido del EJS fuente.`);
                    // Puedes decidir si esto es un error fatal o solo una advertencia. Continuaremos.
                } else {
                    console.log(`[Admin Copy] Llamada Origo() actualizada en ${newEjsFileName} para apuntar a ${newJsonFileName}.`);
                }

                // Actualizar título (opcional, usando el nombre base)
                ejsContents = ejsContents.replace(/<title>.*?<\/title>/i, `<title>${newFileNameBase} Map</title>`); // Usa newFileNameBase (ej: 'demos')

                // Escribir el archivo EJS modificado
                fs.writeFileSync(ejsDestPath, ejsContents);
                console.log(`[Admin Copy] EJS file '${newEjsFileName}' (re)written with modifications.`);

                // ---> Bloque para actualizar publish-state.json (sin cambios aquí, ya estaba bien) <---
                try {
                    let publishStateData = {};
                    if (fs.existsSync(publishStateFilePath)) { try { publishStateData = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8')); } catch (e) { /* ... */ } }
                    publishStateData[newFileNameBase] = { published: false, public: false, description: "" };
                    fs.writeFileSync(publishStateFilePath, JSON.stringify(publishStateData, null, 2));
                    console.log(`[Admin Copy] Added '${newFileNameBase}' to publish state (unpublished, private).`);
                } catch (stateError) {
                     console.error("[Admin Copy] Error updating state file after copy:", stateError);
                     return res.status(500).json({ message: `Map '${fileName}' copied, EJS updated, BUT failed to update state file.` });
                 }
                // ---> Fin bloque estado <---

                // ---> Respuesta final de éxito (sin cambios aquí) <---
                res.json({ message: `Map '${fileName}' copied successfully to '${newFileNameBase}'. Initial state set to unpublished/private.` });

            } catch (modifyError) {
                // Si falla la modificación del EJS (lectura/escritura)
                console.error("[Admin Copy] Error modifying copied EJS:", modifyError);
                // Intentar borrar los archivos copiados si la modificación falla
                try { fs.unlinkSync(jsonDestPath); } catch (e) { }
                try { fs.unlinkSync(ejsDestPath); } catch (e) { }
                return res.status(500).json({ error: 'Error modifying the copied EJS file.' });
            }
        }); 
    }); 
});


router.get('/get-description', (req, res) => {
    const mapBaseName = req.query.map; // Obtener de query param
    if (!isMapName(mapBaseName)) { return res.status(400).json({ success: false, description: '', message: 'Map name not provided.' }); }
    try {
        let description = ''; let publishStateData = {};
        if (fs.existsSync(publishStateFilePath)) { // Leer el archivo que contiene la descripción
            try { publishStateData = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8')); }
            catch (e) { console.error("Error parsing publish state for get description", e); /* Devolver vacío */ }
        }
        // Acceder a la descripción DENTRO del objeto del mapa
        if (publishStateData[mapBaseName] && typeof publishStateData[mapBaseName].description !== 'undefined') {
            description = publishStateData[mapBaseName].description;
        } else {
            console.warn(`Description not found in publish state for map '${mapBaseName}'.`);
        }
        res.json({ success: true, description: description }); // Devuelve la descripción encontrada o vacía
    } catch (error) {
        console.error(`Error getting description for ${mapBaseName}:`, error);
        res.status(500).json({ success: false, description: '', message: 'Error reading description state.' });
    }
});

// *** --- NUEVA RUTA POST /save-description --- ***
// --- AÑADE ESTA RUTA COMPLETA EN /routes/origo-admin.js ---

router.post('/save-description', (req, res) => {
    const { mapName, description } = req.body; // Obtener nombre y descripción del cuerpo POST

    // Validar que mapName exista
    if (!mapName) {
        return res.status(400).json({ success: false, message: 'Map name not provided.' });
    }
    // 'description' puede ser null o un string vacío, está bien

    console.log(`[Admin Route /save-description] Received request for: ${mapName}`);

    try {
        let publishStateData = {};
        // Leer el archivo de estado de publicación de forma segura
        if (fs.existsSync(publishStateFilePath)) {
            try {
                publishStateData = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
            } catch (e) {
                console.error("[Admin Route /save-description] Error parsing publish-state.json:", e);
                // Devolver error 500 si el archivo esencial está corrupto
                return res.status(500).json({ success: false, message: 'Error reading existing publish state file.' });
            }
        } else {
            console.error("[Admin Route /save-description] publish-state.json not found!");
            // Devolver error si el archivo no existe (necesitamos la estructura)
            return res.status(500).json({ success: false, message: 'Publish state file not found.' });
        }

        // Verificar si la entrada para este mapa existe en el objeto publishStateData
        // Y si es un objeto (para poder asignarle .description)
        if (!publishStateData[mapName] || typeof publishStateData[mapName] !== 'object') {
            console.error(`[Admin Route /save-description] Map state entry for '${mapName}' not found or invalid in publish-state.json. Found:`, publishStateData[mapName]);
            // Si no existe la entrada o no es un objeto, no podemos guardar la descripción.
            // Podrías decidir crearlo aquí si tiene sentido:
            // publishStateData[mapName] = { published: false, description: description || "" };
            // Pero por ahora, devolvemos error 404 (Not Found)
            return res.status(404).json({ success: false, message: `Map state entry for '${mapName}' not found or invalid. Cannot save description.` });
        }

        // Actualizar la propiedad 'description' del objeto existente
        publishStateData[mapName].description = description || ""; // Guarda descripción o string vacío

        // Guardar el objeto completo actualizado en el archivo
        fs.writeFileSync(publishStateFilePath, JSON.stringify(publishStateData, null, 2));

        console.log(`[Admin Route /save-description] Description saved successfully for map '${mapName}'.`);
        res.json({ success: true, message: 'Description saved successfully.' }); // Enviar éxito

    } catch (error) {
        // Capturar errores de escritura de archivo u otros errores inesperados
        console.error(`[Admin Route /save-description] General error saving description for map '${mapName}':`, error);
        res.status(500).json({ success: false, message: 'Internal server error while saving description state file.' });
    }
});

// --- Redirección Raíz ---
router.get('/', (req, res) => { res.redirect('/'); });


// --- RUTA PARA PUBLICAR UN MAPA ---
// --- RUTA PARA PUBLICAR UN MAPA (COMPLETA Y CORREGIDA) ---
router.post('/publicar', (req, res) => {
    const mapBaseName = req.body.fileName;
    console.log(`Publish map requested for: ${mapBaseName}`); // Log inicial

    if (!mapBaseName) {
        return res.status(400).json({ error: 'Map name (fileName) not provided.' });
    }

    // ----> ASEGÚRATE QUE ESTAS LÍNEAS EXISTEN <----
    const templateEjsPath = path.join(__dirname, '..', 'views', 'Origo', 'index.ejs');
    const newEjsFilePath = path.join(__dirname, '..', 'views', 'Origo', `${mapBaseName}.ejs`);
    // ----> FIN LÍNEAS IMPORTANTES <----

    if (!fs.existsSync(templateEjsPath)) {
        console.error("Server configuration error: Template EJS file missing.");
        return res.status(500).json({ error: 'Server configuration error: Template EJS file missing.' });
    }

    // --- Función auxiliar updatePublishState (ya la tienes corregida) ---
    const updatePublishState = (mapName) => {
        try {
            if (fs.existsSync(publishStateFilePath)) {
                const ps = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
                if (ps[mapName] && typeof ps[mapName] === 'object') {
                    ps[mapName].published = true;
                } else {
                    console.warn(`[Publish State] Entry for '${mapName}' not found or invalid. Creating/Resetting.`);
                    ps[mapName] = { published: true, public: false, description: ps[mapName]?.description || "" };
                }
                // Log antes de escribir
                console.log(`[Publish State] PREPARANDO para escribir: ${mapName} -> published: ${ps[mapName]?.published}`);
                fs.writeFileSync(publishStateFilePath, JSON.stringify(ps, null, 2));
                 // Log después de escribir
                console.log(`[Publish State] ESCRITURA completada para publish-state.json`);
                console.log(`Publish state updated for '${mapName}' to published: true`);
            } else {
                 console.warn(`publish-state.json not found.`);
             }
        } catch (e) {
             console.error(`Error updating publish-state.json for '${mapName}':`, e);
         }
    };
    // --- Fin función auxiliar ---

    // --- Lógica principal de publicar ---
    if (fs.existsSync(newEjsFilePath)) {
        // Si el EJS ya existe, solo actualiza el estado
        console.log(`EJS file ${newEjsFilePath} already exists.`);
        updatePublishState(mapBaseName);
        res.status(200).json({ message: `Map '${mapBaseName}' already published. State updated.` });
    } else {
        // Si el EJS no existe, cópialo, modifícalo y actualiza el estado
        console.log(`Copying and publishing ${newEjsFilePath}...`);
        fs.copyFile(templateEjsPath, newEjsFilePath, (err) => {
            if (err) {
                console.error('Error copying template file:', err);
                return res.status(500).json({ error: 'Error copying template file.' });
            }
            // Si la copia fue exitosa, modifica el archivo
            try {
                // ----> ASEGÚRATE QUE ESTE BLOQUE EXISTE <----
                let contents = fs.readFileSync(newEjsFilePath, 'utf8');
                const searchRegex = /Origo\s*\(\s*['"](index|\w+)\.json['"]\s*\)/;
                contents = contents.replace(searchRegex, `Origo('${mapBaseName}.json')`);
                // Puedes añadir aquí la modificación del <title> si quieres
                // contents = contents.replace(/<title>.*?<\/title>/i, `<title>${mapBaseName}</title>`);
                fs.writeFileSync(newEjsFilePath, contents);
                console.log(`EJS file ${newEjsFilePath} modified successfully.`);
                // ----> FIN BLOQUE MODIFICACIÓN EJS <----

                // Actualiza el estado DESPUÉS de modificar el EJS
                updatePublishState(mapBaseName);

                // Envía la respuesta de éxito
                res.status(200).json({ message: `Map '${mapBaseName}' published.` });

            } catch (e) {
                // Si falla la modificación (lectura/escritura)
                console.error("Error processing file after copy:", e);
                // Intenta borrar el EJS recién copiado (rollback)
                try { fs.unlinkSync(newEjsFilePath); } catch (e2) { console.error("Error during rollback unlink:", e2);}
                return res.status(500).json({ error: 'Error processing file after copy.' });
            }
        });
    }
});


router.get('/api/maps', isAuthenticated, checkRole('admin'), (req, res) => {
    try {
        const publishState = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
        // Devuelve solo los mapas que tienen un estado (publicados o no)
        const mapNames = Object.keys(publishState); 
        res.json(mapNames);
    } catch (err) {
        res.status(500).json({ error: 'Could not retrieve map list' });
    }
});



router.get('/api/users/:username/maps', isAuthenticated, checkRole('admin'), (req, res) => {
    const usersFilePath = path.join(__dirname, '..', 'auth', 'users.json'); // Definir path al archivo de usuarios
    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = users.find(u => u.username === req.params.username);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ allowedMaps: user.allowedMaps || [] });
    } catch (err) {
        console.error("Error reading users.json in admin route:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT para actualizar los mapas de un usuario
router.put('/api/users/:username/maps', isAuthenticated, checkRole('admin'), (req, res) => {
    const usersFilePath = path.join(__dirname, '..', 'auth', 'users.json'); // Definir path al archivo de usuarios
    const { maps } = req.body;
    if (!Array.isArray(maps)) return res.status(400).json({ error: 'Data must be an array of map names.' });

    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.username === req.params.username);
        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

        users[userIndex].allowedMaps = maps;
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        res.json({ success: true, message: `Permissions updated for ${req.params.username}` });
    } catch (err) {
        console.error("Error writing to users.json in admin route:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});




module.exports = router;
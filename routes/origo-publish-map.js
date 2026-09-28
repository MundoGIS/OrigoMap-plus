// /routes/origo-publish-map.js (CORREGIDO)

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const accessStateFilePath = path.join(__dirname, '..', 'models', 'access-state.json');
// const publishStateFilePath = path.join(__dirname, '..', 'models', 'publish-state.json'); // Si lo necesitas aquí

// --- Rutas Estáticas ---
router.use(express.static(path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map')));

// --- Redirección Raíz ---
router.get('/', (req, res) => { res.redirect('/'); });


// --- RUTA PARA PUBLICAR UN MAPA ---
// POST /OrigoMap/publicar (Sin cambios funcionales, mantenla como estaba)
router.post('/publicar', (req, res) => {
    const mapBaseName = req.body.fileName;
    console.log(`Publish map requested for: ${mapBaseName}`);
    if (!mapBaseName) { /* ... manejo error ... */ return res.status(400).json({ error: 'Map name (fileName) not provided.' }); }
    const templateEjsPath = path.join(__dirname, '..', 'views', 'Origo', 'index.ejs');
    const newEjsFilePath = path.join(__dirname, '..', 'views', 'Origo', `${mapBaseName}.ejs`);
    if (!fs.existsSync(templateEjsPath)) { /* ... manejo error ... */ return res.status(500).json({ error: 'Server configuration error: Template EJS file missing.' }); }
    const updatePublishState = (mapName) => { /* ... tu función auxiliar ... */ try { if (fs.existsSync(publishStateFilePath)) { const ps = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8')); ps[mapName] = true; fs.writeFileSync(publishStateFilePath, JSON.stringify(ps, null, 2)); console.log(`Publish state updated for '${mapName}'`); } else { console.warn(`publish-state.json not found.`); } } catch (e) { console.error(`Error updating publish-state.json for '${mapName}':`, e); } };
    if (fs.existsSync(newEjsFilePath)) { /* ... archivo existe, solo actualiza estado ... */ console.log(`EJS file ${newEjsFilePath} already exists.`); updatePublishState(mapBaseName); res.status(200).json({ message: `Map '${mapBaseName}' already published. State updated.` }); }
    else { /* ... copia y modifica EJS ... */ console.log(`Copying and publishing ${newEjsFilePath}...`); fs.copyFile(templateEjsPath, newEjsFilePath, (err) => { if (err) { /*...*/ return res.status(500).json({ error: 'Error copying template file.' }); } try { let contents = fs.readFileSync(newEjsFilePath, 'utf8'); const searchRegex = /Origo\s*\(\s*['"](index|\w+)\.json['"]\s*\)/; contents = contents.replace(searchRegex, `Origo('${mapBaseName}.json')`); fs.writeFileSync(newEjsFilePath, contents); updatePublishState(mapBaseName); res.status(200).json({ message: `Map '${mapBaseName}' published.` }); } catch (e) { /*...*/ try { fs.unlinkSync(newEjsFilePath); } catch (e2) { } res.status(500).json({ error: 'Error processing file.' }); } }); }
});

// --- RUTA PARA ACCEDER A UN MAPA ESPECÍFICO ---
router.get('/:nombreMapa', (req, res, next) => {
    const nombreMapa = req.params.nombreMapa;
    const sessionUser = req.session.user; // Para logs
    const userRole = sessionUser ? sessionUser.role : 'Guest';

    console.log(`\n--- [MAP ACCESS] Attempt for: /OrigoMap/${nombreMapa} by User Role: ${userRole} ---`);

    // Validar nombre básico
    if (!nombreMapa || nombreMapa.includes('..') || !/^[a-zA-Z0-9_-]+$/.test(nombreMapa)) {
        console.warn(`[MAP ACCESS] Invalid map name requested: ${nombreMapa}`);
        return res.status(400).render('error', { message: 'Invalid map name.', error: { status: 400 } });
    }

    const ejsFilePath = path.join(__dirname, '..', 'views', 'Origo', `${nombreMapa}.ejs`);

    if (!fs.existsSync(ejsFilePath)) {
        console.error(`[MAP ACCESS] EJS file not found: ${ejsFilePath}`);
        return res.status(404).render('error', { message: `Map '${nombreMapa}' not found.`, error: { status: 404 } });
    }
    console.log(`[MAP ACCESS] EJS file found: ${ejsFilePath}`);

    let isPublic = false;
    let accessState = {};
    try {
        if (fs.existsSync(accessStateFilePath)) {
            accessState = JSON.parse(fs.readFileSync(accessStateFilePath, 'utf8'));
            isPublic = accessState[nombreMapa] === true; // Es público SOLO si la clave existe y es true
            console.log(`[MAP ACCESS] Read access state. Map '${nombreMapa}' is explicitely public: ${isPublic}`);
        } else {
            console.warn("[MAP ACCESS] access-state.json not found. Assuming map is private.");
        }
    } catch (error) {
        console.error("[MAP ACCESS] Error reading access-state.json:", error);
    }

    if (!isPublic) {
        console.log(`[MAP ACCESS] Map '${nombreMapa}' is private. Checking user-specific permissions...`);

        const sessionUser = req.session.user;

        if (!sessionUser) {
            console.log("[MAP ACCESS] Access DENIED: User not authenticated.");
                req.flash('error', 'Du måste logga in för att visa den här kartan.');
            return res.redirect('/login');
        }

        const userHasPermission =
            sessionUser.role === 'admin' ||
            (sessionUser.allowedMaps && sessionUser.allowedMaps.includes(nombreMapa));

        if (userHasPermission) {
            console.log(`[MAP ACCESS] Access GRANTED for private map (User: ${sessionUser.username}).`);
        } else {
            console.log(`[MAP ACCESS] Access DENIED: User '${sessionUser.username}' does not have permission for map '${nombreMapa}'.`);
                req.flash('error', 'Du saknar behörighet för att visa den här kartan.');
            return res.redirect('/');
        }

    } else {
        console.log(`[MAP ACCESS] Access GRANTED for public map '${nombreMapa}'.`);
    }

    // 4. Renderizar el mapa (si pasó las verificaciones o es público)
    console.log(`[MAP ACCESS] Rendering map view: Origo/${nombreMapa}`);
    res.render(`Origo/${nombreMapa}`, {
        isAuthenticated: !!sessionUser, // Doble negación para asegurar booleano
        userRole: userRole === 'Guest' ? null : userRole
    });
});


module.exports = router;
// /routes/map-viewer.js (CORREGIDO - con readStateData definido)

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Path al archivo de estado unificado
const stateFilePath = path.join(__dirname, '..', 'models', 'publish-state.json');

// *** AÑADIR ESTA FUNCIÓN HELPER AQUÍ ***
const readStateData = () => {
    try {
        if (fs.existsSync(stateFilePath)) {
            return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
        }
    } catch (e) {
        console.error("[VIEWER] Error reading state file:", e);
    }
    console.warn("[VIEWER] State file not found or unreadable, returning empty object.");
    return {}; // Devuelve objeto vacío si no existe o hay error de parseo
};
// *** FIN FUNCIÓN HELPER ***




router.get('/viewer360', (req, res) => {
    const videoUrlFromQuery = req.query.url; // Obtiene el parámetro 'url' de la query string

    if (!videoUrlFromQuery) {
        // Renderizar una página de error o enviar un mensaje si no hay URL
        return res.status(400).send('Error: No se proporcionó la URL del video.');
    }

    // Renderiza tu plantilla EJS y le pasa la URL del video
    // Asegúrate de que 'viewer_360' (o el nombre que le diste) esté en tu carpeta 'views'
    // y que tu motor de vistas EJS esté configurado en app.js
    res.render('viewer_360', { // Asume que tu archivo es views/viewer_360.ejs
        videoUrl: videoUrlFromQuery // Pasamos la URL a la plantilla EJS
    });
});

// --- RUTA PARA VER UN MAPA ESPECÍFICO ---
// GET /OrigoMap/:nombreMapa
router.get('/:nombreMapa', (req, res, next) => {
    const nombreMapa = req.params.nombreMapa;
    const sessionUser = req.session.user;
    const userRole = sessionUser ? sessionUser.role : 'Guest';

    console.log(`\n--- [VIEWER ACCESS] Attempt for /OrigoMap/${nombreMapa} by User Role: ${userRole} ---`);

    // Validar nombre básico
    if (!nombreMapa || !/^[a-zA-Z0-9_-]+$/.test(nombreMapa) || nombreMapa.includes('..')) {
        console.warn(`[VIEWER ACCESS] Invalid map name requested: ${nombreMapa}`);
        return res.status(400).render('error', { message: 'Invalid map name.'}); // Usar plantilla de error
    }

    const stateData = readStateData(); // <-- Ahora esta función existe en este archivo
    const mapData = stateData[nombreMapa];

    console.log(`[VIEWER ACCESS] State data for '${nombreMapa}':`, mapData);

    // Verificar si está publicado
    if (!mapData || typeof mapData !== 'object' || mapData.published !== true) {
        console.warn(`[VIEWER ACCESS] Map '${nombreMapa}' not found in state or not published.`);
        return res.status(404).render('error', { message: `Map '${nombreMapa}' not published or does not exist.`}); // Usar plantilla de error
    }

    // Verificar si el EJS existe
    const ejsFilePath = path.join(__dirname, '..', 'views', 'Origo', `${nombreMapa}.ejs`);
    if (!fs.existsSync(ejsFilePath)) {
        console.error(`[VIEWER ACCESS] EJS file MISSING but state indicates published: ${ejsFilePath}`);
        // Considera marcar como no publicado aquí para corregir inconsistencia
        // mapData.published = false; writeStateData(stateData);
        return res.status(404).render('error', { message: `Map view file missing for '${nombreMapa}'. Please republish.`}); // Usar plantilla de error
    }

    // Verificar acceso público
    const isPublic = mapData.public === true;
    console.log(`[VIEWER ACCESS] Calculated isPublic for '${nombreMapa}': ${isPublic}`);
    console.log(`[VIEWER ACCESS] Session user exists: ${!!sessionUser}`);

    if (!isPublic) { // Mapa Privado
    console.log("[VIEWER ACCESS] Entering PRIVATE check block...");
    if (!sessionUser) {
        console.log("[VIEWER ACCESS] REDIRECTING TO LOGIN.");
                req.flash('error', 'Du måste logga in för att visa den här privata kartan.');
        return res.redirect(`/login?redirectTo=/OrigoMap/${nombreMapa}`);
    }

    // --- LÓGICA DE PERMISOS CORRECTA ---
    const userHasPermission =
        sessionUser.role === 'admin' ||
        (sessionUser.allowedMaps && sessionUser.allowedMaps.includes(nombreMapa));

    if (userHasPermission) {
        console.log(`[VIEWER ACCESS] Access GRANTED for private map (User: ${sessionUser.username}).`);
    } else {
        console.log(`[VIEWER ACCESS] Access DENIED: User '${sessionUser.username}' does not have permission for this specific map.`);
                req.flash('error', 'Du saknar behörighet för att visa den här kartan.');
        return res.redirect('/');
    }

} else { // Mapa Público
    console.log("[VIEWER ACCESS] Skipping auth check (public).");
}

    // Renderizar
    console.log(`[VIEWER ACCESS] Rendering map view: Origo/${nombreMapa}`);
    res.render(`Origo/${nombreMapa}`); // No es necesario pasar isAuthenticated/userRole si usas res.locals
});



module.exports = router;
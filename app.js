// app.js - COMPLETO Y ACTUALIZADO (Limpiado)
const path = require('path');
const fs = require('fs');
const express = require('express');
require('dotenv').config();
const session = require('express-session');
const FileStore = require('session-file-store')(session);

// const jwt = require('jsonwebtoken'); // Descomenta si lo usas
const cors = require('cors');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');

// --- Require tus archivos de rutas ---
const OrigoAdmin = require('./routes/origo-admin');
const MapViewer = require('./routes/map-viewer'); 

const help = require('./routes/help');
const Media = require('./routes/media');
const Sections = require('./routes/sections');

const { authRouter, credentialStamp } = require('./routes/auth');
//const OrigoPublishMap = require('./routes/origo-publish-map'); // Asegúrate que el nombre sea correcto

const usersFilePath = path.join(__dirname, './auth/users.json');
// const bodyParser = require('body-parser'); // No necesario con Express >= 4.16
const proxy = require('express-http-proxy');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set in the environment.');
}

const sessionStorePath = path.resolve(
  __dirname,
  process.env.SESSION_STORE_PATH || path.join('data', 'sessions')
);
fs.mkdirSync(sessionStorePath, { recursive: true });
const sessionStore = new FileStore({
  path: sessionStorePath,
  ttl: 60 * 60 * 24 * 60,
  reapInterval: 60 * 60,
  retries: 0,
  secret: sessionSecret
});
const pendingSessionWrites = new Map();
const writeSession = sessionStore.set.bind(sessionStore);
sessionStore.set = (sessionId, sessionData, callback) => {
  const previousWrite = pendingSessionWrites.get(sessionId) || Promise.resolve();
  const currentWrite = previousWrite.catch(() => {}).then(() => new Promise(resolve => {
    let attempts = 0;
    const write = () => writeSession(sessionId, sessionData, error => {
      if (error && error.code === 'EPERM' && attempts < 3) {
        attempts += 1;
        return setTimeout(write, attempts * 50);
      }
      resolve();
      if (callback) callback(error);
    });
    write();
  }));
  pendingSessionWrites.set(sessionId, currentWrite);
  const clearQueue = () => {
    if (pendingSessionWrites.get(sessionId) === currentWrite) {
      pendingSessionWrites.delete(sessionId);
    }
  };
  currentWrite.then(clearQueue, clearQueue);
};
const readStoredSession = sessionStore.get.bind(sessionStore);
sessionStore.get = (sessionId, callback) => {
  readStoredSession(sessionId, (error, storedSession) => {
    if (error && error.code === 'ENOENT') return callback(null, null);
    callback(error, storedSession);
  });
};
sessionStore.touch = (sessionId, sessionData, callback) => callback && callback();

// --- Paths ---
const accessStateFilePath = path.join(__dirname, 'models', 'access-state.json'); // Necesario para GET /

// --- Configuración de Express ---
//app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('views', [path.join(__dirname, 'views'), path.join(__dirname, 'auth')]);
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// --- Middlewares ---
app.use(cookieParser());
app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(flash());
app.use((req, res, next) => {
  const flashTypes = [
    ['error', 'is-danger'],
    ['success', 'is-success'],
    ['warning', 'is-warning'],
    ['info', 'is-info']
  ];
  res.locals.flashMessages = flashTypes.flatMap(([type, className]) =>
    req.flash(type).map(text => ({ className, text }))
  );
  next();
});
app.use((req, res, next) => {
  const sessionUser = req.session.user;
  if (!sessionUser) return next();
  let storedUser;
  try {
    storedUser = JSON.parse(fs.readFileSync(usersFilePath, 'utf8')).find(u => u.username === sessionUser.username);
  } catch (error) {
    console.error('Error reading users file:', error);
    return res.sendStatus(503);
  }
  if (!storedUser || sessionUser.credentialStamp !== credentialStamp(storedUser)) {
    return req.session.destroy(() => res.redirect('/login'));
  }
  sessionUser.role = storedUser.role;
  sessionUser.allowedMaps = storedUser.allowedMaps || [];
  next();
});
if (process.env.CORS_ORIGIN) {
  app.use(cors({
    origin: process.env.CORS_ORIGIN,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true
  }));
}

const publishStateFilePath = path.join(__dirname, 'models', 'publish-state.json');

app.use((req, res, next) => {
  const configPathPatterns = [
    /^\/origo\/(.+\.json)$/i,
    /^\/OrigoMap\/(.+\.json)$/i,
    /^\/public\/Thirdparty\/origo-map\/(.+\.json)$/i,
    /^\/(.+\.json)$/i
  ];
  const configPath = configPathPatterns
    .map(pattern => req.path.match(pattern))
    .find(match => match);

  if (!configPath) return next();

  const mapName = path.basename(configPath[1], '.json');
  let mapState;
  try {
    const publishState = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
    mapState = publishState[mapName];
  } catch (error) {
    console.error('Unable to read map publication state:', error);
    return res.sendStatus(503);
  }

  if (!mapState || mapState.published !== true) return res.sendStatus(404);
  if (mapState.public === true) return next();

  const user = req.session.user;
  const canAccess = user && (
    user.role === 'admin' ||
    (Array.isArray(user.allowedMaps) && user.allowedMaps.includes(mapName))
  );

  if (!canAccess) return res.sendStatus(user ? 403 : 401);
  next();
});

// --- Rutas Estáticas ---
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/origo', express.static(path.join(__dirname, 'public/Thirdparty/origo-map')));
app.use('/OrigoMap', express.static(path.join(__dirname, 'public/Thirdparty/origo-map')));
app.use('/media-files', express.static(path.join(__dirname, 'data', 'uploaded', 'media')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use('/monaco-editor', express.static(path.join(__dirname, 'node_modules/monaco-editor/')));
app.use(express.static(path.join(__dirname, '..', 'public', 'Thirdparty', 'origo-map')));

// --- Middlewares Globales para Vistas ---
app.use((req, res, next) => {
  res.locals.isAuthenticated = !!req.session.user; // Establece para todas las vistas
  res.locals.userRole = req.session.user ? req.session.user.role : null;
  res.locals.menuSections = Sections.visibleSections(req.session.user);
  next();
});
app.use((req, res, next) => {
  const configPath = path.join(__dirname, 'data', 'site-config', 'site-config.json');
  const defaultLogo = '/public/images/MGIS-logo_azul_.png';
  try {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.locals.siteLogoPath = configData.logo ? `/media-files/logo/${encodeURIComponent(configData.logo)}` : defaultLogo;
  } catch (error) {
    if (error.code !== 'ENOENT') console.error("Error reading site-config:", error);
    res.locals.siteLogoPath = defaultLogo;
  }
  next();
});

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next(); // Usuario autenticado, continuar
  } else {
      req.flash('error', 'Du måste logga in för att fortsätta.');
    res.redirect('/login'); // No autenticado, redirigir a login
  }
}

function checkRole(...roles) {
  return function (req, res, next) {
    // Asume que isAuthenticated se llamó antes o req.session.user existe
    if (!req.session.user) {
        req.flash('error', 'Du måste logga in för att fortsätta.');
      return res.redirect('/login');
    }
    if (roles.includes(req.session.user.role)) {
      next(); // Rol permitido
    } else {
        req.flash('error', 'Du saknar behörighet för den här sidan.');
      res.redirect('/'); // Rol no permitido, redirigir a inicio
    }
  };
}

// --- RUTAS PRINCIPALES ---
app.use('/', authRouter); // Login/Logout

app.get('/', (req, res) => {
    const origoViewsPath = path.join(__dirname, 'views', 'Origo');
    let potentialMapNames = [];
    let publishStateData = {}; 
    let allMapInfo = []; 
    let mapsToList = [];

    try {
        // --- PASO 1, 2 y 3: Obtener la información de TODOS los mapas publicados ---

        // 1. Obtener nombres potenciales de mapas
        if (fs.existsSync(origoViewsPath)) {
            const filesInDir = fs.readdirSync(origoViewsPath);
            potentialMapNames = filesInDir
                .filter(fileName => fileName.endsWith('.ejs') && fileName.toLowerCase() !== 'index.ejs')
                .map(fileName => fileName.slice(0, -4));
        }

        // 2. Leer el archivo de estado
        if (fs.existsSync(publishStateFilePath)) {
            publishStateData = JSON.parse(fs.readFileSync(publishStateFilePath, 'utf8'));
        }

        // 3. Crear una lista completa de mapas que están publicados
        allMapInfo = potentialMapNames.map(name => {
            const mapData = publishStateData[name];
            if (mapData && typeof mapData === 'object' && mapData.published === true) {
                return {
                    name: name,
                    title: name.replace(/[_-]/g, ' '),
                    public: mapData.public === true,
                    description: mapData.description || `Access the '${name.replace(/[_-]/g, ' ')}' Origo map.`
                };
            }
            return null;
        }).filter(map => map !== null);

        console.log("[APP LOG /] Found PUBLISHED map info objects:", allMapInfo.length);

        // --- PASO 4: Filtrar la lista final (ESTE ES EL LUGAR CORRECTO) ---
        // Ahora que 'allMapInfo' tiene datos, podemos filtrarla.
        
        if (req.session.user) { // Usuario Autenticado
            console.log("[APP LOG /] User IS authenticated. Filtering based on permissions.");
            const currentUser = req.session.user;

            mapsToList = allMapInfo.filter(map => 
                // El mapa se muestra si se cumple CUALQUIERA de estas condiciones:
                // 1. El mapa es público
                map.public || 
                // O 2. El usuario es un 'admin'
                currentUser.role === 'admin' ||
                // O 3. El mapa está en la lista de permitidos del usuario
                (currentUser.allowedMaps && currentUser.allowedMaps.includes(map.name))
            );
        } else { // Usuario NO Autenticado
            console.log("[APP LOG /] User is NOT authenticated. Filtering for PUBLIC maps.");
            mapsToList = allMapInfo.filter(map => map.public === true);
        }

    } catch (error) {
        console.error("[APP LOG /] Error processing map list for root route:", error);
        mapsToList = []; // Asegura lista vacía en caso de error
    }

    const viewData = {
        publishedMaps: mapsToList
    };
    console.log("[APP LOG /] Rendering index.ejs with maps:", mapsToList.map(m => m.name));
    res.render('index', viewData);
});

// --- OTRAS RUTAS (Montaje con prefijos y protección) ---
app.use('/om', help);
app.use('/sections', Sections.router);
app.use('/origoadmin', isAuthenticated, checkRole('admin'), OrigoAdmin);
app.use('/OrigoMap', MapViewer); // Rutas para ver mapas (protección interna)

app.use('/media', isAuthenticated, checkRole('admin'), Media);



// Middleware para leer qgis.json y definir req.pathToQgisProjekt
// Aplícalo a las rutas base que lo necesiten

// --- MANEJO DE 404 ---
app.use((req, res, next) => { res.status(404).render('404'); }); // Asegúrate que views/404.ejs existe

// --- MANEJO DE ERRORES GENERAL ---
app.use((err, req, res, next) => {
     console.error("Unhandled Error:", err.stack);
  if (res.headersSent) return next(err);
     res.status(err.status || 500).render('error', { // Asegúrate que views/error.ejs existe
         message: err.message || "An unexpected error occurred.",
         error: process.env.NODE_ENV === 'development' ? err : {}
     });
});

// --- INICIAR SERVIDOR ---
const port = process.env.PORT || 3000;
app.listen(port, () => { console.log(`Server listening at http://localhost:${port}`); });

// module.exports = app; // Si es necesario exportar
// routes/media.js
const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const router = express.Router();


// ─── RUTA PARA MOSTRAR EL VISOR DE PANORAMA ───────────────────────────────────
router.get('/panorama-view', (req, res) => {
  res.render('panorama'); 
});


// Directorio base para subir media
const mediaDir = path.join(__dirname, '..', 'data', 'uploaded', 'media');
const categories = ['ikons', 'images', 'logo'];

// Definir formatos permitidos
const allowedFormats = ['.svg', '.png', '.jpg', '.jpeg'];

// Configurar el middleware para parsear cuerpos grandes y fileUpload
router.use(express.json({ limit: '900mb' }));
router.use(express.urlencoded({ limit: '900mb', extended: true }));
router.use(
  fileUpload({
    limits: { fileSize: 2000 * 1024 * 1024 }, // 2 GB
    abortOnLimit: true,
  })
);

// Middleware para verificar autenticación
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  else res.redirect('/login');
}
router.use(isAuthenticated);



// Si usas algún middleware de autenticación, inclúyelo aquí (por ejemplo, isAuthenticated)
// router.use(isAuthenticated);

// ─── RUTA PARA SUBIR ARCHIVOS ────────────────────────────────────────────────
router.post('/api/files', isAuthenticated, async (req, res) => {
  let uploadType = req.body.uploadType;
  console.log('uploadType from client:', uploadType);
  console.log('files received:', req.files);

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  // Si uploadType viene como array, tomar el primero
  if (Array.isArray(uploadType)) {
    uploadType = uploadType[0];
  }

  // Determinar la subcarpeta según uploadType
  let subFolder;
  if (uploadType === 'ikons') {
    subFolder = 'ikons';
  } else if (uploadType === 'images') {
    subFolder = 'images';
  } else if (uploadType === 'logo') {
    subFolder = 'logo';
  } else {
    subFolder = 'others';
  }

  // Definir el directorio destino y asegurarse de que exista
  const targetDir = path.join(mediaDir, subFolder);
  fsExtra.ensureDirSync(targetDir);

  // Convertir a array por si se sube un solo archivo
  const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
  const uploadedFiles = [];
  const unsupportedFiles = [];

  for (const file of files) {
    const fileName = path.basename(file.name);
    const fileExtension = path.extname(fileName).toLowerCase();
    const filePath = path.join(targetDir, fileName);

    // 1) Comprobar la extensión
    if (!allowedFormats.includes(fileExtension)) {
      unsupportedFiles.push({
        name: file.name,
        error: 'File format not allowed.'
      });
      continue;
    }

    // 2) Mover el archivo a la carpeta destino
    try {
      await file.mv(filePath);
      console.log(`File moved to: ${filePath}`);
      uploadedFiles.push({ name: file.name, category: subFolder });
    } catch (err) {
      console.error(`Error moving file ${file.name}:`, err);
      unsupportedFiles.push({
        name: file.name,
        error: 'Error moving file.'
      });
      continue;
    }
  }

  // Mensaje final según el resultado
  let message;
  if (uploadedFiles.length > 0 && unsupportedFiles.length === 0) {
    message = 'All files were uploaded and processed successfully.';
  } else if (uploadedFiles.length > 0 && unsupportedFiles.length > 0) {
    message = 'Some files were uploaded successfully, but others failed.';
  } else {
    message = 'No files were uploaded successfully.';
  }

  return res.status(uploadedFiles.length > 0 ? 200 : 400).json({
    message,
    uploadedFiles,
    unsupportedFiles
  });
});

// ─── RUTA PARA LISTAR ARCHIVOS POR CATEGORÍA ─────────────────────────────────
router.get('/api/files', isAuthenticated, (req, res) => {
  try {
    // Definimos las categorías que queremos listar
    const categories = ['ikons', 'images', 'logo'];
    const result = {};
    for (const cat of categories) {
      const dirPath = path.join(mediaDir, cat);
      result[cat] = [];
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            result[cat].push(file);
          }
        }
      }
    }
    res.json(result);
  } catch (err) {
    console.error('Error reading files:', err);
    res.status(500).json({ error: 'Error reading files.' });
  }
});

// ─── RUTA PARA RENDERIZAR LA VISTA (si la deseas renderizar desde el servidor) ─
router.get('/', isAuthenticated, (req, res) => {
  const categories = ['ikons', 'images', 'logo'];
  const mediaFiles = {};
  for (const cat of categories) {
    const dirPath = path.join(mediaDir, cat);
    mediaFiles[cat] = fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
  }
  res.render('media', { mediaFiles });
});




router.post('/api/use-logo', isAuthenticated, (req, res) => {
  const { fileName } = req.body;
  if (typeof fileName !== 'string' || !fileName || path.basename(fileName) !== fileName) {
    return res.status(400).json({ error: 'No fileName provided.' });
  }
  if (!fs.existsSync(path.join(mediaDir, 'logo', fileName))) {
    return res.status(404).json({ error: 'Logo file not found.' });
  }

  // Actualiza la ruta para que apunte a data/site-config/site-config.json
  const configPath = path.join(__dirname, '..', 'data', 'site-config', 'site-config.json');
  try {
    let configData = {};
    try {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (readError) {
      if (readError.code !== 'ENOENT') throw readError;
    }
    configData.logo = fileName;
    fsExtra.ensureDirSync(path.dirname(configPath));
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
    console.log('Logo updated to:', fileName);
    return res.json({ message: 'Logo updated successfully!' });
  } catch (error) {
    console.error('Error updating site config:', error);
    return res.status(500).json({ error: 'Could not update logo.' });
  }
});

// ─── RUTA PARA ELIMINAR UN ARCHIVO ───────────────────────────────────────────
router.delete('/api/files/delete', isAuthenticated, (req, res) => {
  const { fileName, category } = req.body;
  if (typeof fileName !== 'string' || !categories.includes(category) || path.basename(fileName) !== fileName) {
    return res.status(400).json({ error: 'Missing fileName or category.' });
  }

  const filePath = path.join(mediaDir, category, fileName);
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`Error deleting file ${fileName}:`, err);
      return res.status(500).json({ error: 'Error deleting file.' });
    }
    console.log(`File deleted: ${filePath}`);
    return res.json({ message: 'File deleted successfully.' });
  });
});





module.exports = router;

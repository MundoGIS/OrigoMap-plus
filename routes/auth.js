// auth.js
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const { rateLimit } = require('express-rate-limit');
const router = express.Router();

const usersFilePath = path.join(__dirname, '../auth/users.json');
const standardSessionMs = 8 * 60 * 60 * 1000;
const rememberedSessionMs = 60 * 24 * 60 * 60 * 1000;
const invalidLoginMessage = 'Fel användarnamn eller lösenord. Försök igen.';
const dummyPasswordHash = bcrypt.hashSync('not-a-real-origomap-password', 14);

// Changes whenever the stored password hash changes, so old sessions can be rejected.
function credentialStamp(user) {
  return crypto.createHash('sha256').update(String(user.password)).digest('hex');
}

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).render('login', {
    loginError: 'För många inloggningsförsök. Vänta 15 minuter innan du försöker igen.'
  })
});

// Configuración de middleware para flash y JSON
router.use(express.json());
router.use(flash());



// Middleware para verificar si el usuario tiene sesión
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    res.locals.isAuthenticated = true;
    next();
  } else {
      req.flash('error', 'Du måste logga in för att fortsätta.');
    res.redirect('/login');
  }
}

// Middleware para verificar roles permitidos
function checkRole(...roles) {
  return function (req, res, next) {
    if (req.session && req.session.user && roles.includes(req.session.user.role)) {
      next();
    } else {
        req.flash('error', 'Du saknar behörighet för den här sidan.');
      res.redirect('/');
    }
  };
}

// RUTA GET: Mostrar formulario de login
router.get('/login', (req, res) => {
  res.render('login');
});

// RUTA POST: Procesar login
router.post('/login', loginRateLimit, (req, res) => {
  const { username, password, rememberMe } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(401).render('login', { loginError: invalidLoginMessage });
  }

  fs.readFile(usersFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading users file:', err);
      return res.status(500).send('Internal server error');
    }
    let users;
    try {
      users = JSON.parse(data);
      if (!Array.isArray(users)) throw new Error('Users file must contain an array.');
    } catch (parseError) {
      console.error('Error parsing users file:', parseError);
      return res.status(500).send('Internal server error');
    }
    const user = users.find(u => u.username === username);
    bcrypt.compare(password, user ? user.password : dummyPasswordHash, (compareError, result) => {
      if (compareError) {
        console.error('Error comparing passwords:', compareError);
        return res.status(500).send('Internal server error');
      }
      if (!user || !result) {
        return res.status(401).render('login', { loginError: invalidLoginMessage });
      }
      req.session.regenerate((sessionError) => {
        if (sessionError) {
          console.error('Error regenerating session:', sessionError);
          return res.status(500).send('Internal server error');
        }
        req.session.user = {
          username: user.username,
          role: user.role,
          allowedMaps: user.allowedMaps || [],
          credentialStamp: credentialStamp(user)
        };
        req.session.cookie.maxAge = rememberMe === 'on' || rememberMe === 'true'
          ? rememberedSessionMs
          : standardSessionMs;
        req.session.save(saveError => {
          if (saveError) {
            console.error('Error saving authenticated session:', saveError);
            return res.status(500).send('Internal server error');
          }
          res.redirect('/');
        });
      });
    });
  });
});

// RUTA GET: Logout
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.error('Error closing session:', err);
    res.redirect('/');
  });
});

// RUTA GET: Página de gestión de usuarios (solo admin)
router.get('/admin/users', isAuthenticated, checkRole('admin'), (req, res) => {
  fs.readFile(usersFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading users file:', err);
      return res.status(500).send('Internal server error');
    }
    const users = JSON.parse(data);
    res.render('manage-users', { users, flash: req.flash() });
  });
});

router.post('/admin/users/add', isAuthenticated, checkRole('admin'), async (req, res) => {
  const { username, password, role } = req.body;
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 12) {
    req.flash('error', 'Användarnamn och ett lösenord på minst 12 tecken krävs.');
    return res.redirect('/admin/users');
  }
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    if (users.find(u => u.username === username.trim())) {
      req.flash('error', 'Användarnamnet används redan.');
      return res.redirect('/admin/users');
    }
    const hashedPassword = await bcrypt.hash(password, 14);
    users.push({ username: username.trim(), password: hashedPassword, role, allowedMaps: [] });
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    req.flash('success', 'Användaren har lagts till.');
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).send('Internal server error');
  }
});

router.post('/admin/users/edit', isAuthenticated, checkRole('admin'), async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || password.length < 12) {
    req.flash('error', 'Användarnamn och ett lösenord på minst 12 tecken krävs.');
    return res.redirect('/admin/users');
  }
  try {
    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    const user = users.find(u => u.username === username);
    if (!user) {
      req.flash('error', 'Användaren kunde inte hittas.');
      return res.redirect('/admin/users');
    }
    user.password = await bcrypt.hash(password, 14);
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    req.flash('success', 'Lösenordet har uppdaterats.');
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error updating password:', err);
    res.status(500).send('Internal server error');
  }
});

// RUTA POST: Eliminar un usuario (excepto admin)
router.post('/admin/users/delete', isAuthenticated, checkRole('admin'), (req, res) => {
  const { username } = req.body;
  if (username === 'admin') {
    req.flash('error', 'Administratörskontot kan inte tas bort.');
    return res.redirect('/admin/users');
  }
  try {
    let users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    users = users.filter(u => u.username !== username);
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    req.flash('success', 'Användaren har tagits bort.');
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).send('Internal server error');
  }
});

module.exports = {
  authRouter: router,
  credentialStamp,
  isAuthenticated,
  checkRole
};

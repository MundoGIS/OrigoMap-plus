// routes/sections.js - Admin-managed content sections shown in the header menu
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const sectionsDir = path.join(__dirname, '..', 'data', 'sections');
const contentDir = path.join(sectionsDir, 'content');
const sectionsFile = path.join(sectionsDir, 'sections.json');
const usersFile = path.join(__dirname, '..', 'auth', 'users.json');
const legacyDir = path.join(__dirname, '..', 'data', 'qgis-jsons');

const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const reservedSlugs = ['api'];
const visibilities = ['public', 'authenticated', 'restricted'];
const roles = ['intern', 'extern'];

const legacySections = [
  { slug: 'strategi', title: 'Screening', file: 'GIS-strategy.json' },
  { slug: 'omqgis', title: 'QGIS FAQ', file: 'QGIS-handledning.json' },
  { slug: 'omdatabas', title: 'Database FAQ', file: 'Databas-handledning.json' }
];

function seedSections() {
  fs.mkdirSync(contentDir, { recursive: true });
  const sections = legacySections.map(({ slug, title, file }) => {
    try {
      const legacy = JSON.parse(fs.readFileSync(path.join(legacyDir, file), 'utf8'));
      if (legacy.text) fs.writeFileSync(contentFile(slug), legacy.text, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') console.error(`Could not migrate ${file}:`, error);
    }
    return { slug, title, visibility: 'restricted', allowedRoles: ['intern'], allowedUsers: [] };
  });
  saveSections(sections);
  return sections;
}

function loadSections() {
  try {
    const sections = JSON.parse(fs.readFileSync(sectionsFile, 'utf8'));
    return Array.isArray(sections) ? sections : [];
  } catch (error) {
    if (error.code === 'ENOENT') return seedSections();
    console.error('Error reading sections:', error);
    return [];
  }
}

function saveSections(sections) {
  fs.mkdirSync(sectionsDir, { recursive: true });
  fs.writeFileSync(sectionsFile, JSON.stringify(sections, null, 2), 'utf8');
}

function contentFile(slug) {
  return path.join(contentDir, `${slug}.html`);
}

function canView(section, user) {
  if (user && user.role === 'admin') return true;
  if (section.visibility === 'public') return true;
  if (!user) return false;
  if (section.visibility === 'authenticated') return true;
  return (section.allowedRoles || []).includes(user.role) ||
    (section.allowedUsers || []).includes(user.username);
}

function visibleSections(user) {
  return loadSections()
    .filter(section => canView(section, user))
    .map(({ slug, title }) => ({ slug, title }));
}

function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function readUsernames() {
  try {
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    return Array.isArray(users) ? users.filter(u => u.role !== 'admin').map(u => u.username) : [];
  } catch (error) {
    console.error('Error reading users:', error);
    return [];
  }
}

function parseAccess(body) {
  const visibility = visibilities.includes(body.visibility) ? body.visibility : 'authenticated';
  const knownUsers = readUsernames();
  const allowedRoles = Array.isArray(body.allowedRoles) ? body.allowedRoles.filter(r => roles.includes(r)) : [];
  const allowedUsers = Array.isArray(body.allowedUsers) ? body.allowedUsers.filter(u => knownUsers.includes(u)) : [];
  return { visibility, allowedRoles, allowedUsers };
}

function requireAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  if (req.accepts('html') && req.method === 'GET') {
    req.flash('error', 'Du saknar behörighet för den här sidan.');
    return res.redirect(req.session.user ? '/' : '/login');
  }
  res.status(403).json({ error: 'Du saknar behörighet.' });
}

function findViewable(req, res, next) {
  const section = loadSections().find(s => s.slug === req.params.slug);
  if (!section) return res.status(404).render('404');
  if (!canView(section, req.session.user)) {
    if (!req.session.user) {
      req.flash('error', 'Du måste logga in för att fortsätta.');
      return res.redirect('/login');
    }
    return res.status(403).render('404');
  }
  req.section = section;
  next();
}

router.use(express.json({ limit: '20mb' }));

// --- Admin: manage sections ---
router.get('/', requireAdmin, (req, res) => {
  res.render('sections-admin', { sections: loadSections(), users: readUsernames(), roles });
});

router.post('/api', requireAdmin, (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  const slug = slugify(req.body.slug || title);
  if (!slugPattern.test(slug) || reservedSlugs.includes(slug)) {
    return res.status(400).json({ error: 'Invalid slug.' });
  }
  const sections = loadSections();
  if (sections.some(s => s.slug === slug)) {
    return res.status(409).json({ error: 'A section with that slug already exists.' });
  }
  const section = { slug, title: title.slice(0, 100), ...parseAccess(req.body) };
  sections.push(section);
  saveSections(sections);
  res.status(201).json(section);
});

router.put('/api/:slug', requireAdmin, (req, res) => {
  const sections = loadSections();
  const section = sections.find(s => s.slug === req.params.slug);
  if (!section) return res.status(404).json({ error: 'Section not found.' });
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (title) section.title = title.slice(0, 100);
  Object.assign(section, parseAccess(req.body));
  saveSections(sections);
  res.json(section);
});

router.put('/api/:slug/move', requireAdmin, (req, res) => {
  const sections = loadSections();
  const index = sections.findIndex(s => s.slug === req.params.slug);
  const target = index + (req.body.direction === 'up' ? -1 : 1);
  if (index < 0 || target < 0 || target >= sections.length) return res.status(400).json({ error: 'Cannot move.' });
  [sections[index], sections[target]] = [sections[target], sections[index]];
  saveSections(sections);
  res.json({ ok: true });
});

router.delete('/api/:slug', requireAdmin, (req, res) => {
  const sections = loadSections();
  const remaining = sections.filter(s => s.slug !== req.params.slug);
  if (remaining.length === sections.length) return res.status(404).json({ error: 'Section not found.' });
  saveSections(remaining);
  fs.rm(contentFile(req.params.slug), { force: true }, () => {});
  res.json({ ok: true });
});

// --- View and edit a section ---
router.get('/:slug', findViewable, (req, res) => {
  res.render('section', { section: req.section });
});

router.get('/:slug/data', findViewable, (req, res) => {
  fs.readFile(contentFile(req.section.slug), 'utf8', (err, text) => {
    res.json({ text: err ? '' : text });
  });
});

router.post('/:slug', requireAdmin, findViewable, (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text : '';
  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFile(contentFile(req.section.slug), text, 'utf8', err => {
    if (err) return res.status(500).json({ error: 'Det gick inte att spara.' });
    res.json({ message: 'Ändringarna har sparats.' });
  });
});

module.exports = { router, visibleSections };

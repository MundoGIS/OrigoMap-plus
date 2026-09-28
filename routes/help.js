const express = require('express');
const router = express.Router();

// Legacy /om/* URLs now live in routes/sections.js
const legacyPages = ['strategi', 'omqgis', 'omdatabas'];

router.get('/:page', (req, res, next) => {
  if (!legacyPages.includes(req.params.page)) return next();
  res.redirect(301, `/sections/${req.params.page}`);
});

module.exports = router;

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();


router.get('/om-gismanager', (req, res) => {
  res.render('info');
});

module.exports = router;

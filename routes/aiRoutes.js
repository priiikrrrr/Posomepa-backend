const express = require('express');
const router = express.Router();
const { smartSearch, getSuggestions } = require('../controllers/aiController');

router.post('/search', smartSearch);
router.get('/suggestions', getSuggestions);

module.exports = router;

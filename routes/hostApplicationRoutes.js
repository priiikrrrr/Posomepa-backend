const express = require('express');
const router = express.Router();
const hostApplicationController = require('../controllers/hostApplicationController');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/hostAppUpload');

// User routes (require authentication)
router.post('/', auth, upload.fields([
  { name: 'idImage', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'businessProof', maxCount: 1 }
]), hostApplicationController.submitApplication);
router.get('/my', auth, hostApplicationController.getMyApplication);
router.post('/resubmit', auth, hostApplicationController.resubmitApplication);

// Admin routes (require authentication)
router.get('/', auth, hostApplicationController.getAllApplications);
router.get('/:id', auth, hostApplicationController.getApplicationById);
router.post('/:id/approve', auth, hostApplicationController.approveApplication);
router.post('/:id/reject', auth, hostApplicationController.rejectApplication);

module.exports = router;

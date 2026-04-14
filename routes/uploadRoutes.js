const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');
const auth = require('../middleware/authMiddleware');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter
});

router.post('/images', auth, upload.array('images', 10), async (req, res) => {
  try {
    console.log('=== Upload request received ===');
    console.log('User:', req.user);
    console.log('Files:', req.files);
    
    if (!req.files || req.files.length === 0) {
      console.log('No files found in request');
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const imageUrls = [];
    
    for (const file of req.files) {
      try {
        const result = await uploadToCloudinary(file.buffer, 'posomepa');
        imageUrls.push({
          url: result.url,
          publicId: result.publicId
        });
      } catch (cloudError) {
        console.error('Cloudinary upload failed:', cloudError.message);
        return res.status(500).json({ message: 'Image upload failed: ' + cloudError.message });
      }
    }

    console.log('Upload success, URLs:', imageUrls);
    res.json({ images: imageUrls });
  } catch (error) {
    console.log('Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/images', auth, async (req, res) => {
  try {
    const { publicId } = req.body;
    
    if (!publicId) {
      return res.status(400).json({ message: 'Public ID is required' });
    }

    const result = await deleteFromCloudinary(publicId);
    
    if (result.success) {
      res.json({ message: 'Image deleted from Cloudinary' });
    } else {
      res.status(500).json({ message: 'Failed to delete image' });
    }
  } catch (error) {
    console.log('Delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

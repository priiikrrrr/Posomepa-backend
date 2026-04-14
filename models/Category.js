const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  icon: {
    type: String,
    default: 'folder-outline'
  },
  description: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#8B5CF6'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);

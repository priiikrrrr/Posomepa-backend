const mongoose = require('mongoose');

const spaceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  images: [{
    type: String
  }],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    coordinates: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 }
    }
  },
  price: {
    type: Number,
    required: true
  },
  priceType: {
    type: String,
    enum: ['hourly', 'daily', 'monthly'],
    default: 'hourly'
  },
  amenities: [{
    type: String
  }],
  availability: [{
    date: { type: Date },
    slots: [{
      start: String,
      end: String,
      available: { type: Boolean, default: true }
    }]
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  blockedDates: [{
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, default: 'unavailable' }
  }],
  rules: [{
    type: String
  }],
  notes: {
    type: String,
    default: ''
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }]
}, { timestamps: true });

spaceSchema.index({ title: 'text', description: 'text', 'location.city': 'text' });
spaceSchema.index({ category: 1 });
spaceSchema.index({ 'location.city': 1 });
spaceSchema.index({ price: 1 });
spaceSchema.index({ rating: -1 });

module.exports = mongoose.model('Space', spaceSchema);

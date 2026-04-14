const mongoose = require('mongoose');

const flaggedMessageSchema = new mongoose.Schema({
  content: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Space' },
  category: String,
  reason: String,
  createdAt: { type: Date, default: Date.now, expires: '30d' }
});

module.exports = mongoose.model('FlaggedMessage', flaggedMessageSchema);

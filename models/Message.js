const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Space',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 30
  },
  read: {
    type: Boolean,
    default: false
  },
  replies: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: {
      type: String,
      required: true,
      maxlength: 30
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  closedAt: {
    type: Date,
    default: null
  },
  deletedBySender: {
    type: Boolean,
    default: false
  },
  deletedByReceiver: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

messageSchema.methods.isClosed = function() {
  return this.closedAt && new Date() > new Date(this.closedAt);
};

messageSchema.methods.canReply = function() {
  if (!this.closedAt) return true;
  return new Date() <= new Date(this.closedAt);
};

messageSchema.index({ receiver: 1, deletedByReceiver: 1 });
messageSchema.index({ sender: 1, deletedBySender: 1 });
messageSchema.index({ property: 1 });
messageSchema.index({ sender: 1, property: 1 });
messageSchema.index({ sender: 1, property: 1 });
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Message', messageSchema);

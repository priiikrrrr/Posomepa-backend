const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: function() { return !this.firebaseUid; },
    unique: true,
    lowercase: true,
    trim: true,
    sparse: true
  },
  password: {
    type: String,
    required: false,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'host'],
    default: 'user'
  },
  hostApplicationStatus: {
    type: String,
    enum: ['not_applied', 'pending', 'verified', 'rejected'],
    default: 'not_applied'
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true
  },
  avatar: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: null,
    sparse: true,
    set: (v) => (v === '' ? null : v)
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  deviceTokens: [{
    token: String,
    platform: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);

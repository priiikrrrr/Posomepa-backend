const express = require('express');
const router = express.Router();
const { sendPushNotification, sendMulticastNotification } = require('../services/firebaseService');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { firebaseAuth, optionalFirebaseAuth } = require('../middleware/firebaseAuth');

// Save device token
router.post('/device-token', firebaseAuth, async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Device token is required' });
    }

    // Check if token already exists
    const user = await User.findById(req.user._id);
    const existingToken = user.deviceTokens.find(t => t.token === token);

    if (!existingToken) {
      user.deviceTokens.push({
        token,
        platform: platform || 'android',
        addedAt: new Date()
      });
      await user.save();
    }

    res.json({ message: 'Device token saved successfully' });
  } catch (error) {
    console.error('Save device token error:', error);
    res.status(500).json({ message: 'Failed to save device token' });
  }
});

// Remove device token
router.delete('/device-token', firebaseAuth, async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findById(req.user._id);
    user.deviceTokens = user.deviceTokens.filter(t => t.token !== token);
    await user.save();

    res.json({ message: 'Device token removed successfully' });
  } catch (error) {
    console.error('Remove device token error:', error);
    res.status(500).json({ message: 'Failed to remove device token' });
  }
});

// Send test notification
router.post('/test', firebaseAuth, async (req, res) => {
  try {
    const { title, body } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.deviceTokens || user.deviceTokens.length === 0) {
      return res.status(400).json({ message: 'No device tokens found' });
    }

    const tokens = user.deviceTokens.map(t => t.token);
    const result = await sendMulticastNotification(tokens, title || 'Test Notification', body || 'This is a test notification from PosomePa!');

    res.json({ message: 'Test notification sent', result });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ message: 'Failed to send test notification' });
  }
});

// Notify user about booking status change (called from bookingController)
router.post('/booking-notification', async (req, res) => {
  try {
    const { userId, bookingId, status, title, body } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.deviceTokens || user.deviceTokens.length === 0) {
      return res.json({ message: 'No device tokens found for user' });
    }

    const tokens = user.deviceTokens.map(t => t.token);
    const data = {
      bookingId: bookingId,
      status: status,
      click_action: 'OPEN_BOOKING'
    };

    await sendMulticastNotification(tokens, title, body, data);

    res.json({ message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Booking notification error:', error);
    res.status(500).json({ message: 'Failed to send notification' });
  }
});

module.exports = router;

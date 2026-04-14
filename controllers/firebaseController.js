const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { verifyIdToken } = require('../services/firebaseService');

const JWT_SECRET = process.env.JWT_SECRET;

const verifyFirebaseOTP = async (req, res) => {
  try {
    const { phone, firebaseUid, idToken, fcmToken } = req.body;

    if (!phone || !firebaseUid || !idToken) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await verifyIdToken(idToken);
    if (!result.success) {
      console.error('Firebase token verification failed:', result.error);
      return res.status(401).json({ message: 'Invalid Firebase token' });
    }

    const decodedToken = result.decodedToken;

    if (decodedToken.uid !== firebaseUid) {
      return res.status(401).json({ message: 'Token UID mismatch' });
    }

    let user = await User.findOne({ phone });

    if (!user) {
      return res.json({
        requiresRegistration: true,
        firebaseUid,
        phone,
        message: 'New user, registration required'
      });
    }

    if (fcmToken && !user.deviceTokens.includes(fcmToken)) {
      user.deviceTokens.push(fcmToken);
      await user.save();
    }

    user.firebaseUid = firebaseUid;
    await user.save();

    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        firebaseUid: user.firebaseUid
      }
    });
  } catch (error) {
    console.error('Firebase OTP verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const completeFirebaseRegistration = async (req, res) => {
  try {
    const { name, email, phone, firebaseUid, fcmToken } = req.body;

    if (!name || !email || !phone || !firebaseUid) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    let user = await User.findOne({ phone });

    if (user) {
      user.name = name;
      user.email = email;
      user.firebaseUid = firebaseUid;
      if (fcmToken && !user.deviceTokens.includes(fcmToken)) {
        user.deviceTokens.push(fcmToken);
      }
      await user.save();
    } else {
      user = new User({
        name,
        email,
        phone,
        firebaseUid,
        role: 'user',
        deviceTokens: fcmToken ? [fcmToken] : []
      });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        firebaseUid: user.firebaseUid
      }
    });
  } catch (error) {
    console.error('Firebase registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const verifyFirebaseToken = async (req, res) => {
  try {
    const { idToken, email, name, photoURL, uid, phone, fcmToken } = req.body;

    if (!idToken || !uid) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await verifyIdToken(idToken);
    if (!result.success) {
      return res.status(401).json({ message: 'Invalid Firebase token' });
    }

    const decodedToken = result.decodedToken;

    if (decodedToken.uid !== uid) {
      return res.status(401).json({ message: 'Token UID mismatch' });
    }

    let user = await User.findOne({ firebaseUid: uid });

    if (!user && email) {
      user = await User.findOne({ email: email });
    }

    if (user) {
      user.firebaseUid = uid;
      if (name && !user.name) {
        user.name = name;
      }
      if (photoURL) user.avatar = photoURL;
      if (phone) user.phone = phone;
      if (fcmToken && !user.deviceTokens.includes(fcmToken)) {
        user.deviceTokens.push(fcmToken);
      }
      await user.save();
    } else {
      try {
        const userEmail = email || `${uid}@firebase.user`;
        const userData = {
          email: userEmail,
          name: name || 'User',
          firebaseUid: uid,
          avatar: photoURL || '',
          role: 'user',
          deviceTokens: fcmToken ? [fcmToken] : []
        };
        if (phone && phone.trim()) {
          userData.phone = phone.trim();
        }
        user = new User(userData);
        await user.save();
      } catch (createError) {
        if (createError.code === 11000 && createError.keyPattern.email) {
          user = await User.findOne({ email: email });
          if (user) {
            user.firebaseUid = uid;
            if (name && !user.name) user.name = name;
            if (photoURL) user.avatar = photoURL;
            if (phone) user.phone = phone;
            if (fcmToken && !user.deviceTokens.includes(fcmToken)) {
              user.deviceTokens.push(fcmToken);
            }
            await user.save();
          }
        } else {
          throw createError;
        }
      }
    }

    const token = jwt.sign(
      { id: user._id, phone: user.phone || '' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        firebaseUid: user.firebaseUid
      }
    });
  } catch (error) {
    console.error('Firebase token verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  verifyFirebaseOTP,
  completeFirebaseRegistration,
  verifyFirebaseToken
};

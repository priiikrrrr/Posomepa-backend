const { verifyIdToken, getUserByUID } = require('../services/firebaseService');
const User = require('../models/User');

const firebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify token
    const result = await verifyIdToken(idToken);

    if (!result.success) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const firebaseUser = result.decodedToken;
    
    // Check if user exists in DB
    let user = await User.findOne({ firebaseUid: firebaseUser.uid })
      .populate('role', 'name')
      .populate('permissions', 'name');

    if (!user) {
      if (firebaseUser.email) {
        user = await User.findOne({ email: firebaseUser.email });
        if (user) {
          user.firebaseUid = firebaseUser.uid;
          await user.save();
        }
      }
      if (!user) {
        user = await User.create({
          name: firebaseUser.name || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          phone: firebaseUser.phone_number || '',
          firebaseUid: firebaseUser.uid,
          role: 'user', 
          isVerified: true,
        });
      }
    }

    req.user = user;
    req.firebaseUser = firebaseUser;
    next();
  } catch (error) {
    console.log('Firebase auth middleware error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

const optionalFirebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); 
    }

    const idToken = authHeader.split('Bearer ')[1];
    const result = await verifyIdToken(idToken);

    if (result.success) {
      const firebaseUser = result.decodedToken;
      const user = await User.findOne({ firebaseUid: firebaseUser.uid });
      
      if (user) {
        req.user = user;
        req.firebaseUser = firebaseUser;
      }
    }

    next();
  } catch (error) {
    next(); 
  }
};

module.exports = {
  firebaseAuth,
  optionalFirebaseAuth,
};

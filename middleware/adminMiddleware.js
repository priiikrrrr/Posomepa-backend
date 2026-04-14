const jwt = require('jsonwebtoken');

const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    req.user = { email: decoded.email, role: decoded.role };
    req.token = token;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

module.exports = adminMiddleware;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const spaceRoutes = require('./routes/spaceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const userRoutes = require('./routes/userRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const aiRoutes = require('./routes/aiRoutes');
const hostApplicationRoutes = require('./routes/hostApplicationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

connectDB();

// Scheduled cleanup of stale abandoned bookings (15 minutes)
const Booking = require('./models/Booking');
const cleanupStaleBookings = async () => {
  try {
    const result = await Booking.deleteMany({
      paymentStatus: 'pending',
      status: 'requested',
      createdAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) }
    });
    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} stale bookings`);
    }
  } catch (error) {
    console.error('Stale booking cleanup failed:', error);
  }
};

// Run every 15 minutes
setInterval(cleanupStaleBookings, 15 * 60 * 1000);

// Also run once on server start
cleanupStaleBookings();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://localhost:8081',
    'https://posomepa.onrender.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/host-applications', hostApplicationRoutes);
app.use('/api/messages', messageRoutes);
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'PosomePa API is running' });
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PosomePa API is running' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server running at: http://localhost:${PORT}`);
});

module.exports = app;

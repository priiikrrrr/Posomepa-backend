# PosomePa Backend

Backend API server for PosomePa - A property rental platform.

## Tech Stack

- **Runtime:** Node.js + Express
- **Database:** MongoDB (Atlas)
- **Authentication:** Firebase Auth + JWT
- **Payments:** Razorpay
- **File Storage:** Cloudinary
- **AI Services:** Groq (LLM for search & moderation)
- **SMS/OTP:** Firebase Phone Auth

## Features

- User authentication (email/password, Google, OTP)
- Host verification (KYC with document uploads)
- Property listings with categories, amenities, rules
- Booking system with payment integration
- Real-time messaging between users and hosts
- AI-powered property search
- Message content moderation
- Push notifications (Firebase Cloud Messaging)
- Admin dashboard

## API Endpoints

### Auth
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/google` - Google sign-in
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile

### Spaces (Properties)
- `GET /api/spaces` - List all spaces
- `GET /api/spaces/:id` - Get space details
- `POST /api/spaces` - Create space (host only)
- `PUT /api/spaces/:id` - Update space
- `DELETE /api/spaces/:id` - Delete space

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/my` - User's bookings
- `GET /api/bookings/host` - Host's bookings
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Messages
- `POST /api/messages` - Send message to host
- `GET /api/messages/my` - User's messages
- `GET /api/messages/host` - Host's messages
- `POST /api/messages/:id/reply` - Host reply

### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/users` - List users
- `GET /api/admin/spaces` - List spaces
- `GET /api/admin/bookings` - List bookings
- `PUT /api/admin/bookings/:id` - Update booking status

## Environment Variables

See `.env.example` for required environment variables.

## Setup

```bash
npm install
npm start
```

## Deployment

Deployed on Render. See GitHub Actions for auto-deployment on push to main.

## License

MIT

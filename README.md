# 🎬 ReelVibe - Netflix-Style Streaming Platform

A full-stack streaming platform for movies and music with user authentication, role-based access control, and subscription management.

## 🚀 Features

### Authentication System
- User Registration & Login
- Admin Login
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (Admin/User)
- OTP-based signup verification via email

### User Dashboard
- Browse Movies & Music
- Search & Filter by genre
- Watch History
- Subscription Status
- Profile Management

### Admin Dashboard
- Add/Edit/Delete Movies & Music
- Upload Media Files
- Manage Subscriptions
- Manage Users
- Analytics Dashboard

### Subscription Tiers
- **Free**: Limited content access
- **Premium**: Unlimited access

## 🛠️ Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT, bcrypt

## 📦 Installation

1. Install dependencies:
```bash
npm install
```

2. Configure MySQL database:
- Create a database named `reelvibe`
- Update `.env` file with your database credentials

OTP email options in `.env`:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (optional; falls back to `SMTP_USER`)
- `OTP_EXPIRY_MINUTES`

Users now complete registration in 2 steps:
1. Submit name, email, and password to receive an OTP by email.
2. Enter OTP to verify and create the account.

3. Initialize database:
```bash
node config/initDatabase.js
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## 🌐 Access

- Application: http://localhost:3000
- Default Admin: admin@reelvibe.com / admin123

## 📁 Project Structure

```
ReelVibe/
├── config/          # Database configuration
├── middleware/      # Authentication middleware
├── routes/          # API routes
├── controllers/     # Business logic
├── public/          # Frontend files
├── uploads/         # Media files
└── server.js        # Entry point
```

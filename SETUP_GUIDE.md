# 📱 ARES Authentication System - Setup Guide

## Overview
This is an implementation of key functionalities for the ARES (Autonomous Self-Healing Authentication & Adaptive Security) system, including:

1. **User Registration** - Create new user accounts with email/password
2. **Login with Risk Assessment** - Email/Phone + Password authentication with fraud detection
3. **Social Authentication** - Google and Facebook OAuth 2.0 integration
4. **Account State Management** - Track account states (Active, Locked, Challenged)
5. **Failed Attempt Tracking** - Automatic account locking after 10 failed attempts
6. **Session Management** - Secure session handling with Passport.js
7. **User Dashboard** - Protected profile page with account information

## Prerequisites

- **Node.js** v18+
- **npm** (Node Package Manager)
- **Firebase Project** - For user/authentication data storage
- **Google OAuth Credentials** - (Optional) For Google sign-in
- **Facebook OAuth Credentials** - (Optional) For Facebook sign-in

## Installation

### 1. Clone the Repository
```bash
cd CS458_Project1
```

### 2. Install Dependencies
```bash
npm install
```

This will install:
- `express` - Web server framework
- `ejs` - Template engine for views
- `firebase-admin` - Firebase backend services
- `passport` - Authentication middleware
- `passport-local` - Local authentication strategy
- `passport-google-oauth20` - Google OAuth strategy
- `passport-facebook` - Facebook OAuth strategy
- `express-session` - Session management
- `bcrypt` - Password hashing

### 3. Configure Firebase

#### a. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a new project"
3. Follow the setup wizard

#### b. Generate Service Account Key
1. In Firebase Console, go to **Settings** ⚙️ → **Service Accounts**
2. Click "Generate New Private Key"
3. Save the JSON file as `serviceAccountKey.json` in the project root
4. **⚠️ IMPORTANT**: Add `serviceAccountKey.json` to `.gitignore` (already done)

#### c. Enable Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. Click "Create Database"
3. Start in "Production mode" (configure security rules later)
4. Choose a region

### 4. Configure Environment Variables (Optional - for OAuth)

Copy `.env.example` to `.env` and fill in your OAuth credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
PORT=3000
```

#### For Google OAuth:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application type)
5. Add authorized redirect URIs: `http://localhost:3000/auth/google/callback`
6. Copy Client ID and Secret

#### For Facebook OAuth:
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app
3. Add Facebook Login product
4. Configure redirect URIs: `http://localhost:3000/auth/facebook/callback`
5. Copy App ID and Secret

## Running the Application

Start the server:
```bash
npm start
# or
node server.js
```

The application will run at: **http://localhost:3000**

## Features Implemented

### 1. **User Registration** (`/signup`)
- Email and optional phone input
- Password strength validation (minimum 6 characters)
- Duplicate email checking
- Password confirmation
- Social signup options (Google/Facebook)

### 2. **Login** (`/login`)
- Email or phone-based login
- Risk assessment interceptor tracks failed attempts
- Automatic account locking after 10 failed attempts
- Social login (Google/Facebook)
- Session-based authentication

### 3. **Risk Assessment** 
- Tracks login attempts per user
- Detects new IP addresses
- Calculates risk score
- Triggers high-risk alerts for LLM fraud analysis
- Automatic account locking mechanism

### 4. **OAuth 2.0 Integration**
- **Google**: `/auth/google` → Automatic user creation/login
- **Facebook**: `/auth/facebook` → Automatic user creation/login
- Persistent user records in Firestore

### 5. **User Dashboard** (`/profile`)
- Profile information display
- Security settings and failed attempt counter
- Last login timestamp
- Account creation date
- View active authentication methods
- Secure logout functionality

### 6. **Account States**
- **Active**: Normal account state
- **Locked**: Account locked after 10 failed login attempts
- **Challenged**: Account flagged for unusual activity (extensible for MFA)

## API Routes

| Method | Route | Authentication | Description |
|--------|-------|---|---|
| GET | `/` | None | Redirects to /login or /profile |
| GET | `/login` | None | Login page |
| POST | `/login` | None | Authenticate user |
| GET | `/signup` | None | Signup page |
| POST | `/register` | None | Register new user |
| GET | `/profile` | Required | User dashboard |
| GET | `/logout` | Required | Logout and destroy session |
| GET | `/auth/google` | None | Start Google OAuth flow |
| GET | `/auth/google/callback` | None | Google OAuth callback |
| GET | `/auth/facebook` | None | Start Facebook OAuth flow |
| GET | `/auth/facebook/callback` | None | Facebook OAuth callback |

## Database Schema (Firestore)

### Users Collection
```
users/
  {userId}/
    - email: string
    - password: string (hashed, only for local auth)
    - phone: string (optional)
    - displayName: string
    - photo: string (for OAuth)
    - googleId: string (for Google auth)
    - facebookId: string (for Facebook auth)
    - accountState: 'Active' | 'Locked' | 'Challenged'
    - failedAttempts: number
    - lastIP: string
    - createdAt: timestamp
    - lastLogin: timestamp
    - lockedAt: timestamp (when account was locked)
```

## Security Considerations

1. **Password Hashing**: Uses bcrypt with salt rounds
2. **Session Security**: HTTP-only cookies, secure settings
3. **Input Validation**: Basic validation on registration
4. **Account Locking**: Automatic after failed attempts
5. **OAuth Security**: Uses Passport.js secure implementations
6. **Environment Variables**: Sensitive credentials stored separately

## Future Enhancements

- [ ] Two-Factor Authentication (2FA/MFA)
- [ ] Email verification
- [ ] Password reset functionality
- [ ] LLM-based fraud detection integration
- [ ] Self-healing Selenium test framework
- [ ] Account recovery options
- [ ] Rate limiting on login attempts
- [ ] IP whitelisting
- [ ] Device tracking

## Troubleshooting

### "Cannot find module" errors
```bash
npm install
```

### Firebase initialization errors
- Ensure `serviceAccountKey.json` exists in project root
- Check Firebase project is active and accessible

### OAuth not working
- Verify environment variables are set correctly
- Check redirect URIs match in OAuth provider settings
- Ensure callbacks are properly handled

### Port already in use
```bash
# Change PORT in .env or use:
PORT=3001 node server.js
```

## Files Structure

```
CS458_Project1/
├── server.js              # Main application file
├── package.json           # Dependencies
├── .env.example           # Environment variables template
├── .env                   # Environment variables (create from .env.example)
├── serviceAccountKey.json # Firebase service account (DO NOT COMMIT)
├── README.md              # This file
├── views/
│   ├── login.ejs          # Login page
│   ├── signup.ejs         # Registration page
│   ├── profile.ejs        # User dashboard
│   └── error.ejs          # Error page
└── public/                # Static files directory
```

## References

- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Passport.js](http://www.passportjs.org/)
- [Express.js](https://expressjs.com/)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [OAuth 2.0 Flow](https://oauth.net/2/)

## License

This project is part of CS458 - Software Verification and Validation course.

---

**Last Updated**: February 2026
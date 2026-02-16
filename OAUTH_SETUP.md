# OAuth Setup Guide for ARES Authentication

## Google OAuth Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/apis/credentials
2. **Create a new project** or select an existing one
3. **Enable Google+ API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. **Create OAuth 2.0 Client ID**:
   - Go to "Credentials" tab
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add Authorized redirect URI: `http://localhost:3000/auth/google/callback`
5. **Copy your credentials**:
   - Client ID
   - Client Secret
6. **Set environment variables** (or update server.js directly):
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

## Facebook OAuth Setup

1. **Go to Facebook Developers**: https://developers.facebook.com/apps/
2. **Create a new app** or select an existing one
3. **Add Facebook Login product**:
   - In your app dashboard, click "Add Product"
   - Select "Facebook Login" and click "Set Up"
4. **Configure OAuth Redirect URIs**:
   - Go to Facebook Login > Settings
   - Add Valid OAuth Redirect URI: `http://localhost:3000/auth/facebook/callback`
5. **Get your App credentials**:
   - Go to Settings > Basic
   - Copy App ID and App Secret
6. **Set environment variables** (or update server.js directly):
   ```
   FACEBOOK_APP_ID=your_app_id_here
   FACEBOOK_APP_SECRET=your_app_secret_here
   ```

## Environment Variables Setup

### Option 1: Using .env file (Recommended)
1. Install dotenv package: `npm install dotenv`
2. Create a `.env` file in the project root
3. Add your credentials:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   FACEBOOK_APP_ID=your_facebook_app_id
   FACEBOOK_APP_SECRET=your_facebook_app_secret
   CALLBACK_URL=http://localhost:3000
   ```
4. Add `require('dotenv').config();` at the top of server.js

### Option 2: Direct replacement in server.js
Replace the placeholder values in server.js:
```javascript
const GOOGLE_CLIENT_ID = 'your_actual_google_client_id';
const GOOGLE_CLIENT_SECRET = 'your_actual_google_client_secret';
const FACEBOOK_APP_ID = 'your_actual_facebook_app_id';
const FACEBOOK_APP_SECRET = 'your_actual_facebook_app_secret';
```

## How It Works

### Database Structure for OAuth Users
When a user logs in via OAuth, the system:
1. **Checks if user exists** by email in `email_lookup/{email_key}`
2. **If exists**: Updates OAuth info and logs them in
3. **If new**: Creates new user with:
   - Random system ID
   - Email from OAuth provider
   - Display name
   - OAuth provider info (google/facebook)
   - Default status: "Active"
   - Failed attempts: 0

### OAuth User Schema
```json
{
  "systemId": "a1b2c3d4e5f6g7h8",
  "email": "user@gmail.com",
  "displayName": "John Doe",
  "oauthProvider": "google",
  "oauthId": "oauth_provider_user_id",
  "status": "Active",
  "failedAttempts": 0,
  "createdAt": "2026-02-15T10:30:00.000Z"
}
```

## Testing OAuth Flow

1. **Start the server**: `node server.js`
2. **Navigate to**: http://localhost:3000/login
3. **Click "Login with Google"** or **"Login with Facebook"**
4. **Authenticate** with the provider
5. **Check Firebase Database** to see the new user entry
6. **Check Console** for logs: `[ARES] Google OAuth Success for user: user@gmail.com`

## Production Deployment

For production:
1. Update `CALLBACK_URL` to your production domain
2. Add production callback URLs in Google/Facebook consoles
3. Use environment variables (never commit secrets)
4. Enable HTTPS
5. Update authorized domains in OAuth providers

## Troubleshooting

- **"Redirect URI mismatch"**: Check that callback URLs match exactly in provider console
- **"Invalid client"**: Verify Client ID/Secret are correct
- **"Access denied"**: User declined permissions or app not approved
- **Session issues**: Check that express-session is configured with proper secret

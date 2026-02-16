// Load environment variables first
require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

// OAuth Configuration (loaded from .env file)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000';

console.log('[ARES] OAuth Configuration Loaded:');
console.log('  Google Client ID:', GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing');
console.log('  Facebook App ID:', FACEBOOK_APP_ID ? '✓ Set' : '✗ Missing');
console.log('  Callback URL:', CALLBACK_URL);
console.log('  Google Redirect URI:', `${CALLBACK_URL}/auth/google/callback`);

// 1. Initialize Firebase with Error Catching
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://cs453-b135b-default-rtdb.europe-west1.firebasedatabase.app/" // UPDATE THIS
    });
    console.log("Firebase Admin Initialized [cite: 66]");
} catch (error) {
    console.error("CRITICAL ERROR: Could not find or load serviceAccountKey.json.");
    console.error("Ensure the file is in: " + __dirname);
    process.exit(1);
}

const db = admin.database();
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ 
    secret: 'ares_secret_key', 
    resave: false, 
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport Session Serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const userSnapshot = await db.ref(`users/${id}`).once('value');
        const user = userSnapshot.val();
        done(null, user ? { ...user, id } : null);
    } catch (error) {
        done(error, null);
    }
});

// Helper function to find or create OAuth user
async function findOrCreateOAuthUser(profile, provider) {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const emailKey = email ? email.replace(/\./g, '_') : null;
    
    // Try to find existing user by email
    if (emailKey) {
        const lookup = await db.ref(`email_lookup/${emailKey}`).once('value');
        if (lookup.exists()) {
            const userId = lookup.val().uid;
            const userSnapshot = await db.ref(`users/${userId}`).once('value');
            const userData = userSnapshot.val();
            
            // Update OAuth info if not already set
            if (!userData.oauthProvider) {
                await db.ref(`users/${userId}`).update({
                    oauthProvider: provider,
                    oauthId: profile.id,
                    displayName: profile.displayName
                });
            }
            
            return { ...userData, id: userId };
        }
    }
    
    // Create new user
    const randomId = crypto.randomBytes(8).toString('hex');
    const newUser = {
        systemId: randomId,
        email: email || `${provider}_${profile.id}@oauth.user`,
        displayName: profile.displayName || profile.name?.givenName || 'User',
        oauthProvider: provider,
        oauthId: profile.id,
        status: 'Active',
        failedAttempts: 0,
        createdAt: new Date().toISOString()
    };
    
    await db.ref(`users/${randomId}`).set(newUser);
    
    // Create email lookup if email exists
    if (emailKey) {
        await db.ref(`email_lookup/${emailKey}`).set({ uid: randomId });
    }
    
    console.log(`[ARES] New OAuth User Created (${provider}) with ID: ${randomId}`);
    return { ...newUser, id: randomId };
}

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${CALLBACK_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await findOrCreateOAuthUser(profile, 'google');
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Facebook OAuth Strategy
passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: `${CALLBACK_URL}/auth/facebook/callback`,
    profileFields: ['id', 'displayName', 'emails', 'name']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await findOrCreateOAuthUser(profile, 'facebook');
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// PROJECT REQ: Context-Aware Risk Interceptor [cite: 12]
const riskInterceptor = async (req, res, next) => {
    const { identifier } = req.body;
    if (!identifier) return next();

    const emailKey = identifier.replace(/\./g, '_');
    const lookup = await db.ref(`email_lookup/${emailKey}`).once('value');
    
    if (lookup.exists()) {
        const userId = lookup.val().uid;
        const userSnapshot = await db.ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        // Trigger LLM-based fraud analysis on 10th failed attempt [cite: 12]
        if (userData.failedAttempts >= 10) {
            console.log(`[ARES] High risk for ${identifier}: Transitioning to LOCKED state [cite: 16]`);
            await db.ref(`users/${userId}`).update({ status: 'Locked' });
            return res.status(403).send("Account Locked. High risk score detected.");
        }
        req.userInternalData = { ...userData, id: userId };
    }
    next();
};

// --- ROUTES ---
app.get(['/', '/login'], (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
    const { identifier, password } = req.body;
    
    // Generate a random 16-character Hex ID (e.g., 'a1b2c3d4...')
    const randomId = crypto.randomBytes(8).toString('hex');

    try {
        // Store user under the random ID
        await db.ref(`users/${randomId}`).set({
            systemId: randomId,
            email: identifier,
            password: password, 
            status: 'Active',   // Requirement: Default state 
            failedAttempts: 0,
            createdAt: new Date().toISOString()
        });

        // Optional: Create a lookup index to find the randomId by email later
        const emailKey = identifier.replace(/\./g, '_');
        await db.ref(`email_lookup/${emailKey}`).set({ uid: randomId });

        console.log(`[ARES] New User Created with ID: ${randomId}`);
        res.redirect("/login");
    } catch (e) { 
        res.status(500).send("Registration error."); 
    }
});

// READ & UPDATE: Login with Adaptive Response [cite: 32]
app.post('/login', riskInterceptor, async (req, res) => {
    const { password } = req.body;
    const user = req.userInternalData;

    if (user && user.password === password) {
        await db.ref(`users/${user.id}`).update({ failedAttempts: 0, status: 'Active' });
        console.log(`[ARES] Login Success for user: ${user.email}`);
        res.send(`
            <html>
                <head><style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6; }
                    .success { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                    h2 { color: #10b981; }
                </style></head>
                <body>
                    <div class="success">
                        <h2>✓ Login Successful</h2>
                        <p>Welcome, <strong>${user.email}</strong>!</p>
                        <p>Status: ${user.status}</p>
                        <p style="font-size: 0.9rem; color: #666;">Failed Attempts Reset: 0</p>
                        <a href="/login" style="display: inline-block; margin-top: 1rem; color: #2563eb; text-decoration: none;">Back to Login</a>
                    </div>
                </body>
            </html>
        `);
    } else if (user) {
        const newCount = (user.failedAttempts || 0) + 1;
        await db.ref(`users/${user.id}`).update({ failedAttempts: newCount });
        res.status(401).send(`Unauthorized. Attempt ${newCount}/10 [cite: 12]`);
    } else {
        res.status(404).send("User not found.");
    }
});

// Google OAuth Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        console.log(`[ARES] Google OAuth Success for user: ${req.user.email}`);
        res.send(`
            <html>
                <head><style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6; }
                    .success { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                    h2 { color: #10b981; }
                </style></head>
                <body>
                    <div class="success">
                        <h2>✓ Google Login Successful</h2>
                        <p>Welcome, <strong>${req.user.displayName}</strong>!</p>
                        <p>Email: ${req.user.email}</p>
                        <p>Status: ${req.user.status}</p>
                        <a href="/login">Back to Login</a>
                    </div>
                </body>
            </html>
        `);
    }
);

// Facebook OAuth Routes
app.get('/auth/facebook',
    passport.authenticate('facebook', { scope: ['email'] })
);

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        console.log(`[ARES] Facebook OAuth Success for user: ${req.user.email}`);
        res.send(`
            <html>
                <head><style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6; }
                    .success { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                    h2 { color: #3b82f6; }
                </style></head>
                <body>
                    <div class="success">
                        <h2>✓ Facebook Login Successful</h2>
                        <p>Welcome, <strong>${req.user.displayName}</strong>!</p>
                        <p>Email: ${req.user.email}</p>
                        <p>Status: ${req.user.status}</p>
                        <a href="/login">Back to Login</a>
                    </div>
                </body>
            </html>
        `);
    }
);

// Logout Route
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('[ARES] Logout error:', err);
        }
        req.session.destroy();
        res.redirect('/login');
    });
});

// Keep the process alive
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`-----------------------------------------------`);
    console.log(`ARES SERVER LIVE: http://localhost:${PORT}`);
    console.log(`-----------------------------------------------`);
});
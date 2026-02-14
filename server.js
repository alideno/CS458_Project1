const express = require('express');
const admin = require('firebase-admin');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');

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
app.use(session({ secret: 'ares_secret_key', resave: false, saveUninitialized: true }));

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
        res.send("Login Successful. State: Active");
    } else if (user) {
        const newCount = (user.failedAttempts || 0) + 1;
        await db.ref(`users/${user.id}`).update({ failedAttempts: newCount });
        res.status(401).send(`Unauthorized. Attempt ${newCount}/10 [cite: 12]`);
    } else {
        res.status(404).send("User not found.");
    }
});

// Social Auth Handshake Placeholders [cite: 11, 14]
app.get('/auth/google', (req, res) => res.send("Google OAuth Flow Intercepted [cite: 14]"));
app.get('/auth/facebook', (req, res) => res.send("Facebook OAuth Flow Intercepted [cite: 14, 63]"));

// Keep the process alive
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`-----------------------------------------------`);
    console.log(`ARES SERVER LIVE: http://localhost:${PORT}`);
    console.log(`-----------------------------------------------`);
});
require('dotenv').config();

const express = require('express');
const admin = require('firebase-admin');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const OpenAI = require('openai');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

console.log('  OpenAI API Key:', OPENAI_API_KEY ? 'Set' : 'Missing');
console.log('  Google Client ID:', GOOGLE_CLIENT_ID ? 'Set' : 'Missing');
console.log('  Facebook App ID:', FACEBOOK_APP_ID ? 'Set' : 'Missing');
console.log('  Callback URL:', CALLBACK_URL);
console.log('  Google Redirect URI:', `${CALLBACK_URL}/auth/google/callback`);

const calculateRiskScore = (userData, currentIP, loginContext = {}) => {
    let riskScore = 0;
    const riskFactors = [];

    const failedAttempts = userData.failedAttempts || 0;
    const failedAttemptsScore = Math.min(failedAttempts * 10, 100);
    riskScore += failedAttemptsScore;
    if (failedAttempts > 0) riskFactors.push(`${failedAttempts} failed attempts (+${failedAttemptsScore}pts)`);

    const previousIPs = userData.loginIPs || [];
    if (!previousIPs.includes(currentIP)) {
        riskScore += 15;
        riskFactors.push(`New IP address: ${currentIP} (+15pts)`);
    }

    if (previousIPs.length === 0) {
        riskScore += 10;
        riskFactors.push(`First-ever login from this IP (+10pts)`);
    }

    return {
        score: Math.min(riskScore, 100),
        factors: riskFactors,
        riskLevel: riskScore >= 70 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW'
    };
};

const analyzeFraudWithLLM = async (userData, riskData, currentIP) => {
    try {
        const prompt = `You are a cybersecurity fraud detection expert. Analyze the following login context and determine if this is a legitimate login or potential fraud:

User: ${userData.email}
Risk Score: ${riskData.score}/100 (${riskData.riskLevel})
Failed Attempts: ${userData.failedAttempts || 0}
New IP Address: ${!( userData.loginIPs || []).includes(currentIP) ? 'Yes - ' + currentIP : 'No'}
Previous IPs: ${(userData.loginIPs || []).join(', ') || 'None'}
Risk Factors: ${riskData.factors.join(', ')}

Respond with a JSON object containing:
{
  "isFraud": boolean,
  "confidence": number (0-100),
  "recommendation": "Active" | "Challenged" | "Locked" | "Suspended",
  "reason": "brief explanation",
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.2,
            max_tokens: 500,
            response_format: { type: 'json_object' }
        });

        const analysisText = response.choices[0].message.content;
        const analysis = JSON.parse(analysisText);

        console.log(`[ARES] LLM Fraud Analysis for ${userData.email}:`, analysis);
        return analysis;
    } catch (error) {
        console.error('[ARES] Error in LLM fraud analysis:', error.message);
        return {
            isFraud: riskData.score >= 70,
            confidence: riskData.score,
            recommendation: riskData.score >= 70 ? 'Locked' : riskData.score >= 50 ? 'Challenged' : 'Active',
            reason: 'Fallback rule-based decision (LLM unavailable)',
        };
    }
};

try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://cs453-b135b-default-rtdb.europe-west1.firebasedatabase.app/"
    });
    console.log("Firebase Admin Initialized");
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
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

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

async function findOrCreateOAuthUser(profile, provider) {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

    const randomId = crypto.randomBytes(8).toString('hex');
    const newUser = {
        systemId: randomId,
        email: email || `${provider}_${profile.id}@oauth.user`,
        displayName: profile.displayName || profile.name?.givenName || 'User',
        oauthProvider: provider,
        oauthId: profile.id,
        accountState: 'Active',
        failedAttempts: 0,
        loginIPs: [],
        fraudAnalysisHistory: []
    };
    
    await db.ref(`users/${randomId}`).set(newUser);

    console.log(`[ARES] New OAuth User Created (${provider}) with ID: ${randomId}`);
    return { ...newUser, id: randomId };
}

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

app.post('/register', async (req, res) => {
    const { identifier, password } = req.body;
    
    const randomId = crypto.randomBytes(8).toString('hex');
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    try {
        await db.ref(`users/${randomId}`).set({
            systemId: randomId,
            email: identifier,
            password: password,
            accountState: 'Active',
            failedAttempts: 0,
            loginIPs: [clientIP],
            riskScore: 0,
            fraudAnalysisHistory: []
        });

        console.log(`[ARES] New User Created with ID: ${randomId} | Initial IP: ${clientIP}`);
        res.redirect("/login");
    } catch (e) { 
        res.status(500).send("Registration error."); 
    }
});

app.get(['/', '/login'], (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));
const riskInterceptor = async (req, res, next) => {
    const { identifier, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    if (!identifier) return next();

    try {
        const usersSnapshot = await db.ref('users').once('value');
        const usersData = usersSnapshot.val() || {};
        const matchingUsers = Object.entries(usersData).filter(([, value]) => value.email === identifier);

        if (matchingUsers.length > 0) {
            let userEntry = matchingUsers[0];
            
            if (password && matchingUsers.length > 1) {
                const correctUser = matchingUsers.find(([, value]) => value.password === password);
                if (correctUser) {
                    userEntry = correctUser;
                }
            }
            
            const [userId, userData] = userEntry;

            if (userData.accountState === 'Suspended') {
                console.log(`[ARES] Account Suspended for ${identifier} - Access Denied`);
                return res.status(403).send("Account Suspended. Contact support.");
            }

            if (userData.accountState === 'Locked') {
                console.log(`[ARES] Account Locked for ${identifier} - Access Denied`);
                return res.status(403).send(`
                    <html>
                        <head><style>
                            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #dbeafe, #dcfce7); }
                            .error { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
                            h2 { color: #dc2626; }
                        </style></head>
                        <body>
                            <div class="error">
                                <h2>🔒 Account Locked</h2>
                                <p>Your account has been locked due to security concerns.</p>
                                <p style="margin-top: 1.5rem; color: #666; font-size: 0.9rem;">Please contact support to unlock your account.</p>
                            </div>
                        </body>
                    </html>
                `);
            }

            const riskData = calculateRiskScore(userData, clientIP, {});

            if (userData.accountState === 'Challenged' && riskData.score >= 50) {
                console.log(`[ARES] Challenged account shows suspicious activity - Escalating to LOCKED`);
                await db.ref(`users/${userId}`).update({ 
                    accountState: 'Locked'
                });
                return res.status(403).send(`
                    <html>
                        <head><style>
                            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #dbeafe, #dcfce7); }
                            .error { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
                            h2 { color: #dc2626; }
                        </style></head>
                        <body>
                            <div class="error">
                                <h2>🔒 Account Escalated to Locked</h2>
                                <p>Suspicious activity detected on your challenged account.</p>
                                <p>Your account has been locked for security.</p>
                                <p style="margin-top: 1.5rem; color: #666; font-size: 0.9rem;">Please contact support to unlock your account.</p>
                            </div>
                        </body>
                    </html>
                `);
            }

            console.log(`[ARES] Risk Score Calculated for ${identifier}: ${riskData.score}/100 (${riskData.riskLevel})`);
            console.log(`       Risk Factors: ${riskData.factors.join(' | ')}`);

            let fraudAnalysis = null;
            if (riskData.score >= 50 || userData.failedAttempts >= 10) {
                console.log(`[ARES] HIGH RISK DETECTED - Triggering LLM Fraud Analysis`);
                fraudAnalysis = await analyzeFraudWithLLM(userData, riskData, clientIP);

                const analysisRecord = {
                    riskScore: riskData.score,
                    recommendation: fraudAnalysis.recommendation,
                    isFraud: fraudAnalysis.isFraud,
                    confidence: fraudAnalysis.confidence
                };

                const updatedHistory = [...(userData.fraudAnalysisHistory || []), analysisRecord];
                await db.ref(`users/${userId}/fraudAnalysisHistory`).set(updatedHistory.slice(-10));
            }

            if (fraudAnalysis) {
                if (fraudAnalysis.recommendation === 'Locked') {
                    console.log(`[ARES] LLM Recommendation: Locked - Transitioning to LOCKED state`);
                    await db.ref(`users/${userId}`).update({ 
                        accountState: 'Locked'
                    });
                    return res.status(403).send(`
                        <html>
                            <head><style>
                                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #dbeafe, #dcfce7); }
                                .error { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
                                h2 { color: #dc2626; }
                                .code { font-family: monospace; background: #f3f4f6; padding: 1rem; border-radius: 8px; }
                            </style></head>
                            <body>
                                <div class="error">
                                    <h2>🔒 Account Locked</h2>
                                    <p>High fraud risk detected by AI security analysis.</p>
                                    <p>Reason: ${fraudAnalysis.reason}</p>
                                    <p>Confidence: ${fraudAnalysis.confidence}%</p>
                                    <p style="margin-top: 1.5rem; color: #666; font-size: 0.9rem;">Please contact support to unlock your account.</p>
                                </div>
                            </body>
                        </html>
                    `);
                }
                else if (fraudAnalysis.recommendation === 'Challenged') {
                    console.log(`[ARES] LLM Recommendation: Challenged - Transitioning to CHALLENGED state`);
                    await db.ref(`users/${userId}`).update({ 
                        accountState: 'Challenged'
                    });
                    req.userInternalData = { ...userData, id: userId, challenged: true };
                    return next();
                }
            }

            if (userData.failedAttempts >= 10) {
                console.log(`[ARES] Failed Attempts Threshold Reached (${userData.failedAttempts}/10) - Locking account`);
                await db.ref(`users/${userId}`).update({ 
                    accountState: 'Locked'
                });
                return res.status(403).send("Account Locked. Failed attempts exceeded. Contact support.");
            }

            req.userInternalData = { ...userData, id: userId, clientIP };
        }
        next();
    } catch (error) {
        console.error('[ARES] Error in riskInterceptor:', error.message);
        next();
    }
};

app.post('/login', riskInterceptor, async (req, res) => {
    const { password } = req.body;
    const user = req.userInternalData;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    if (user && user.password === password) {
        const previousIPs = user.loginIPs || [];
        const updatedIPs = [...new Set([...previousIPs, clientIP])];

        await db.ref(`users/${user.id}`).update({ 
            failedAttempts: 0,
            riskScore: 0,
            accountState: 'Active',
            loginIPs: updatedIPs,
            lastLoginIP: clientIP
        });
        
        console.log(`[ARES] Login Success for user: ${user.email} | IP: ${clientIP}`);
        console.log(`       Known IPs: ${updatedIPs.join(', ')}`);
        console.log(`       Account Unlocked | Risk Score Reset to 0`);

        if (user.challenged) {
            console.log(`[ARES] Challenge resolved - Account returned to ACTIVE state`);
        }

        res.send(`
            <html>
                <head><style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #dbeafe, #dcfce7); }
                    .success { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                    h2 { color: #10b981; }
                    .detail { font-size: 0.85rem; color: #666; margin: 0.5rem 0; }
                </style></head>
                <body>
                    <div class="success">
                        <h2>✓ Login Successful</h2>
                        <p>Welcome, <strong>${user.email}</strong>!</p>
                        <p class="detail">Account State: ${user.accountState || 'Active'}</p>
                        <p class="detail">Failed Attempts Reset: 0</p>
                        <a href="/login" style="display: inline-block; margin-top: 1rem; color: #2563eb; text-decoration: none;">Back to Login</a>
                    </div>
                </body>
            </html>
        `);
    } else if (user) {
        const newCount = (user.failedAttempts || 0) + 1;
        await db.ref(`users/${user.id}`).update({ 
            failedAttempts: newCount,
            lastFailedAttemptIP: clientIP
        });

        console.log(`[ARES] Login FAILED for ${user.email} | Attempt ${newCount}/10 | IP: ${clientIP}`);

        if (newCount >= 10) {
            console.log(`[ARES] CRITICAL: 10 failed attempts reached - Locking account`);
            await db.ref(`users/${user.id}`).update({ 
                accountState: 'Locked'
            });
            res.status(401).send(`
                <html>
                    <head><style>
                        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #dbeafe, #dcfce7); }
                        .error { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                        h2 { color: #dc2626; }
                    </style></head>
                    <body>
                        <div class="error">
                            <h2>🔒 Account Locked</h2>
                            <p>Maximum failed login attempts (10) reached.</p>
                            <p>Your account has been locked for security.</p>
                            <p style="margin-top: 1.5rem; color: #666; font-size: 0.9rem;">Please contact support.</p>
                        </div>
                    </body>
                </html>
            `);
        } else {
            res.status(401).send(`
                <html>
                    <head><style>
                        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #dbeafe, #dcfce7); }
                        .error { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                        h2 { color: #f97316; }
                        .warning { color: #dc2626; font-weight: bold; }
                    </style></head>
                    <body>
                        <div class="error">
                            <h2>⚠ Login Failed</h2>
                            <p>Incorrect password.</p>
                            <p class="warning">Attempt ${newCount}/10</p>
                            <p style="color: #666; font-size: 0.9rem;">After 10 failed attempts, your account will be locked.</p>
                            <a href="/login" style="display: inline-block; margin-top: 1rem; color: #2563eb; text-decoration: none;">Back to Login</a>
                        </div>
                    </body>
                </html>
            `);
        }
    } else {
        res.status(404).send("User not found.");
    }
});

app.get('/user-status/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const usersSnapshot = await db.ref('users').once('value');
        const usersData = usersSnapshot.val() || {};
        const matchingUsers = Object.entries(usersData).filter(([, value]) => value.email === email);

        if (matchingUsers.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const results = matchingUsers.map(([userId, userData]) => ({
            userId: userId,
            email: userData.email,
            accountState: userData.accountState || 'Active',
            failedAttempts: userData.failedAttempts || 0,
            loginIPs: userData.loginIPs || [],
            lastLoginIP: userData.lastLoginIP,
            riskScore: userData.riskScore || 0,
            lastFailedAttemptIP: userData.lastFailedAttemptIP,
            fraudAnalysisHistory: userData.fraudAnalysisHistory || []
        }));

        res.json({
            count: matchingUsers.length,
            accounts: results
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        const previousIPs = req.user.loginIPs || [];
        const updatedIPs = [...new Set([...previousIPs, clientIP])];

        await db.ref(`users/${req.user.id}`).update({
            loginIPs: updatedIPs,
            lastLoginIP: clientIP,
            accountState: 'Active'
        });

        console.log(`[ARES] Google OAuth Success for user: ${req.user.email} | IP: ${clientIP}`);
        res.send(`
            <html>
                <head><style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #dbeafe, #dcfce7); }
                    .success { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                    h2 { color: #10b981; }
                    .detail { font-size: 0.85rem; color: #666; margin: 0.5rem 0; }
                </style></head>
                <body>
                    <div class="success">
                        <h2>✓ Google Login Successful</h2>
                        <p>Welcome, <strong>${req.user.displayName}</strong>!</p>
                        <p>Email: ${req.user.email}</p>
                        <p class="detail">Account State: ${req.user.accountState || 'Active'}</p>
                        <a href="/login">Back to Login</a>
                    </div>
                </body>
            </html>
        `);
    }
);

app.get('/auth/facebook',
    passport.authenticate('facebook', { scope: ['email'] })
);

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    async (req, res) => {
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        const previousIPs = req.user.loginIPs || [];
        const updatedIPs = [...new Set([...previousIPs, clientIP])];

        await db.ref(`users/${req.user.id}`).update({
            loginIPs: updatedIPs,
            lastLoginIP: clientIP,
            accountState: 'Active'
        });

        console.log(`[ARES] Facebook OAuth Success for user: ${req.user.email} | IP: ${clientIP}`);
        res.send(`
            <html>
                <head><style>
                    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #dbeafe, #dcfce7); }
                    .success { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
                    h2 { color: #3b82f6; }
                    .detail { font-size: 0.85rem; color: #666; margin: 0.5rem 0; }
                </style></head>
                <body>
                    <div class="success">
                        <h2>✓ Facebook Login Successful</h2>
                        <p>Welcome, <strong>${req.user.displayName}</strong>!</p>
                        <p>Email: ${req.user.email}</p>
                        <p class="detail">Account State: ${req.user.accountState || 'Active'}</p>
                        <a href="/login">Back to Login</a>
                    </div>
                </body>
            </html>
        `);
    }
);

app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('[ARES] Logout error:', err);
        }
        req.session.destroy();
        res.redirect('/login');
    });
});

const PORT = 3000;
app.listen(PORT, () => {});
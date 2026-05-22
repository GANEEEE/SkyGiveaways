const express = require('express');
const router = express.Router();
const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');
const session = require('express-session');
const crypto = require('crypto');
const dbManager = require('./Bot/Data/database'); // غير المسار لو مختلف

// إعدادات Discord - غير الأرقام دي بأرقامك
const DISCORD_CLIENT_ID = '1504271268290105575';
const DISCORD_CLIENT_SECRET = 'hrSF303vAUEW3I5R11UnbPmh2pN_etwS';
const DISCORD_CALLBACK_URL = 'https://27692ddf-91ea-48c1-ae98-43ef07c39a69-00-tl937tiqv1jp.riker.replit.dev:3000/auth/discord/callback';

// إعداد الجلسة
router.use(session({
    secret: 'my_secret_key_change_this',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

router.use(passport.initialize());
router.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: DISCORD_CALLBACK_URL,
    scope: ['identify']
}, async (accessToken, refreshToken, profile, done) => {
    const user = {
        id: profile.id,
        username: profile.username,
        avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null
    };
    return done(null, user);
}));

// روت تسجيل الدخول
router.get('/discord', passport.authenticate('discord'));

// روت الـ callback
// روت الـ callback
router.get('/discord/callback', 
    passport.authenticate('discord', { 
        failureRedirect: 'https://32b58da6-da22-459e-979f-03831d03cf2e-00-14j2otp08i6l.kirk.replit.dev/',
        successRedirect: 'https://32b58da6-da22-459e-979f-03831d03cf2e-00-14j2otp08i6l.kirk.replit.dev/'
    }),
    async (req, res) => {
        const sessionId = req.sessionID;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await dbManager.upsertWebUser(
            req.user.id,
            req.user.username,
            req.user.avatar,
            sessionId,
            expiresAt
        );
    }
);

// روت تسجيل خروج
router.get('/logout', async (req, res) => {
    await dbManager.deleteSession(req.sessionID);
    req.logout(() => {
        res.redirect('/');
    });
});

// جلب بيانات المستخدم الحالي
router.get('/me', async (req, res) => {
    if (req.isAuthenticated()) {
        const user = await dbManager.getWebUser(req.user.id);
        res.json({ success: true, user: req.user });
    } else {
        res.json({ success: false, user: null });
    }
});

module.exports = router;
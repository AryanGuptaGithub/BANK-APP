import jwt from "jsonwebtoken";
import crypto from "crypto";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import config from "../../config/env.js";
import { getRedisClient } from "../../config/redis.js";
import User from "./auth.model.js";
import logger from "../../utils/logger.js";

import AppError from "../../utils/AppError.js";


// ------------------ Token Helpers --------------------


const generateAccessToken = (userId, role) => { 
    return jwt.sign( 
        {id: userId, role},
        config.jwt.accessSecret,
        {
            expiresIn: config.jwt.accessExpiresIn,
            issuer: config.app.name,
        }
    );
}


const generateRefreshToken = (userId) => {
    return jwt.sign(
        {id: userId},
        config.jwt.refreshSecret,
        {
            expiresIn: config.jwt.refreshExpiresIn,
            issuer: config.app.name,
        }
    );
};


const hashToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};





const storeRefreshToken = async (userId, refreshToken) => {
    const redis = getRedisClient();
    const hash = hashToken(refreshToken);
    const ttlSeconds = 7 * 24 * 60 * 60; // 7 days in seconds
    
    // Store in redis for the fash lookup
    await redis.setEx(`refresh:${userId}`, ttlSeconds, hash );
    // Also store hash on user document for cross-reference
    await User.findByIdAndUpdate(userId, {refreshTokenHash: hash});
};

export const register = async ({firstName, lastName, email, phone, password}) => {
    // Check if email already exists - give a generic message to avoid user enumeration
    const existingUser = await User.findOne({ $or: [{email}, {phone}]});
    if(existingUser){
        throw new AppError("An Account with these details already exists", 409, "ACCOUNT_EXISTS");
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationHash = hashToken(verificationToken);

    const user = await User.create({
        firstName,
        lastName,
        email,
        phone,
        password, // pre-save hook hashes this automatically
        emailVerificationToken: verificationHash,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    });

    logger.info("New user registered", {userId: user._id, email: user.email});

    return {
        userId: user._id,
        email: user.email,
        message: "Registration successful. Please verify your email.",
    };
};

//  ----------- Login ----------------------------

export const login = async ({email, password, mfaToken, ip}) => {

    // Explicitly select password (select: false by default) and lockout fields 
    const user = await User.findOne({ email }).select(
        "+password +failedLoginAttempts +lockUntill +mfaSecret +refreshTokenHash"
    );

    // Check 1: Does user exist?
    // Use a generic message - never confirm whether an email exists (user enumeration)
    if(!user){
        throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }
    
    // Check 2: Is Account Active?
    if(!user.isActive){
        throw new AppError("Your account has been deactivated. Please contact support.", 403, "ACCOUNT_DEACTIVATED");
    }

    // Check 3: Is Account locked?
    if(user.isLocked){
        const minutesLeft = Math.ceil((user.lockUntill - Date.now()) / 1000 / 60);
        throw new AppError(
            `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
            423,
            "ACCOUNT_LOCKED"
        );
    }

    // Check 4: Is Password correct?
    const isPasswordValid = await user.comparePassword(password);
    if(!isPasswordValid){
        await user.incrementFailedAttempts();

        const attemptsLeft = 5 - user.failedLoginAttempts;

        const message = attemptsLeft > 0 
        ? `Invalid email or password. ${attemptsLeft} attempt(s) remaining.`
        : "Account locked due too many failed attempts. Try again in 30 minutes.";
        
        throw new AppError(message, 401, "INVALID_CREDENTIALS");
    }

    // Check 5: Is email verified? 
    if(!user.isEmailVerified){
        throw new AppError("Please verify your email before logging in.", 403, "EMAIL_NOT_VERIFIED");
    }

    // Check 6: MFA validation (if enabled)
    if(user.isMfaEnabled){
        if(!mfaToken){
            // Signal to frontend that MFA is required - don't issue token yet 
            throw new AppError("MFA token required", 202, "MFA_REQUIRED");
        }
        
        const isMfaValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: "base32",
        token: mfaToken,
        window: 1, // Allow 1 step (30s) clock drift
         });

         if(!isMfaValid){
            throw new AppError("Invalid MFA token", 401, "INVALID_MFA_TOKEN");
        }

        
    }

    
    

   

    // -- All checks passed -- Issue tokens
    await user.resetFailedAttempts();

    // Updates last login info
    user.lastLoginAt = new Date();
    user.lastLoginIp = ip;
    await user.save();


    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);


    await storeRefreshToken(user._id, refreshToken);

    logger.info("User logged in ", {userId: user._id, ip});

    return {
        accessToken,
        refreshToken,
        user:{
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            isMfaEnabled: user.isMfaEnabled,
            kycStatus: user.kycStatus,
        }
    }

}




export const refreshAccessToken = async (refreshToken) => {
    let decoded;
    try{
        decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    }catch{
        throw new AppError("Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN");
    }

    const redis = getRedisClient();
    const storedHash = await redis.get(`refresh:${decoded.id}`);

    //Compare hash of incomming token with stored
    const incomingHash = hashToken(refreshToken);
    // Token not in Redis - either logged out or reuse attack 
    if(!storedHash || storedHash !== incomingHash){
        logger.warn("Refresh token reuse attempt detected", {userId: decoded.id });
        throw new AppError("User not found or deactivated", 401, "INVALID_REFRESH_TOKEN");
    }

    const user = await User.findById(decoded.id);
    if(!user || !user.isActive){
        throw new AppError("User not found or deactivated", 401, "INVALID_REFRESH_TOKEN");
    }

    // -- TOKEN Rotation: invalidate old token, issue new pair ------
    // This means each refresh token can only be used ONCE;
    // If an attacker steals and uses a refresh token, the real user's next
    // request will fail (token already rotated), alerting you to the breach.

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    await storeRefreshToken(user._id, newRefreshToken);
    
    return {accessToken: newAccessToken, refreshToken: newRefreshToken};
};

// ------------ Logout ----------------------------------------------

export const logout = async (userId) => {
    const redis = getRedisClient();

    // Delete refresh token from Redis -- immediately invalidates it 
    await redis.del(`refresh:${userId}`);

    // Clear hash from user document
    await User.findByIdAndUpdate(userId, {refreshTokenHash: null});

    logger.info("User logged out", {userId});
};


// -------- MFA Setup -------------------------------


export const setupMfa = async (userId) => {
    
    const user = await User.findById(userId);
    
    if(!user) throw new AppError("User not found", 404);

    if(user.isMfaEnabled){
        throw new AppError("MFA is already enabled for this account", 400, "MFA_ALREADY_ENABLED");
    }

    // Generate a TOTP secret
    const secret = speakeasy.generateSecret({
        name: `${config.mfa.appName} (${user.email})`,
        length: 20,
    });

    // Temporarily store secret (not enabled until user verifies it)
    await User.findByIdAndUpdate(userId, {mfaSecret: secret.base32});

    // Generate QR code the user scans with Google Authenticator
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);


    return {
        qrCode: qrCodeDataUrl,
        manualKey: secret.base32,
    };
};

// --- MFA Verify (confirm Setup) ------ 

export const verifyMfaSetup = async (userId, token) => {
    const user = await User.findById(userId).select("+mfaSecret");

    if(!user.mfaSecret){
        throw new AppError("MFA setup not initiated. Call /mfa/setup first.", 400, "MFA_NOT_SETUP");
    }

    // Verify the token they scanned actually works before enabling MFA
    const isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: "base32",
        token,
        window: 1,
    });

    if(!isValid){
        throw new AppError("Invalid MFA token, Please scan the QR code again.", 400, "INVALID_MFA_TOKEN");
    }

    // Token verified - now officially enable MFA
    await User.findByIdAndUpdate(userId, {isMfaEnabled: true});

    logger.info("MFA enabled", {userId});

    return {message: "MFA has been successfully enabled on your account."};
};





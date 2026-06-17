// env.js
import dotenv from "dotenv";

dotenv.config();


const requiredEnvVars = [
    "MONGO_URI",
    "REDIS_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "ENCRYPTION_KEY",
];


requiredEnvVars.forEach((key)=>{
    if(!process.env[key]){
        throw new Error(`Missing required environment variable: ${key}`);
    }
});


if(process.env.ENCRYPTION_KEY.length !== 32){
    throw new Error('ENCRYPTION_KEY must be exactly 32 characters for AES-256');
}


const config = {
    app:{
        env: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT, 10) || 5000,
        name: process.env.APP_NAME || 'BankAPI',
        isDev: process.env.NODE_ENV === 'development',
        isProd: process.env.NODE_ENV === 'production',
    },
    db:{
        uri: process.env.MONGO_URI,
    },
    redis:{
        url: process.env.REDIS_URL,
    },
    jwt:{
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    bcrypt:{
        saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
    },
    email:{
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.EMAIL_FROM || 'noreply@bankapi.com',
    },
    rateLimit:{
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    },
    mfa: {
        appName: process.env.MFA_APP_NAME || 'BankAPI',
    },
    encryption: {
        key: process.env.ENCRYPTION_KEY, 
    }
}


export default config;

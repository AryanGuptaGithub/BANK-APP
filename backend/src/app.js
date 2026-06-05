import express from "express";
import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-rate-limit";
import xss from "xss-clean";
import hpp from "hpp";
import morgan from "morgan";

import config from './config/env';
import connectDB from "./config/database";
import {connectRedis} from "./config/redis";
import logger from "./utils/logger";
import errorHandler from './middlewares/errorHandler';
import {globalLimiter} from "./middlewares/rateLimiter";
import {sendSuccess, sendNotFound } from './utils/apiResponse';

const app = express();

// ---- Security Middleware -----------------------


// Set security HTTP headers ( XSS protection, no-sniff, HSTS, etc.)
app.use(helmet());

// CORS - Only Allow requests from trusted origins
app.use(cors({
    origin: config.app.isDev ? ['http://localhost:3000'] : process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));



// --- Request Parsing ----------------

app.use(express.json({limit: '10kb'}));  // Limit body size — prevents large payload attacks
app.use(express.urlencoded({extended: true, limit: "10kb"}));


// --- Data Sanitization -----------------

// Strip MongoDB operators ($, .) from user input -- prevents NoSQL injection
app.use(mongoSanitize());

// Sanitize user input against XSS -- String HTML tags from body/query/params
app.use(xss());

// Prevent HTTP parameter pollution 
// e.g. ?sort=name&sort=email would be reduced to the last value only  
app.use(hpp({
    whitelist: ['type', 'status', "currency"], // These params CAN  be arrays
}));


// --- Rate  

app.use("/api", globalLimiter);

if(config.app.isDev){
    app.use(morgan('dev'));
}else{
    app.use(morgan('combined',{
        stream: {write: (message) => logger.info(message.trim())},
    }));
}

app.get("/health",(req, res) => {
    sendSuccess(res, {
        message: "Server is healthy",
        data:{
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toString(),
            environment: config.app.env,
        },
    });
});






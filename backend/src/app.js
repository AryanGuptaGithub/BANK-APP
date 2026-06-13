import express from "express";
import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";
import morgan from "morgan";

import config from './config/env.js';
import connectDB from "./config/database.js";
import {connectRedis} from "./config/redis.js";
import logger from "./utils/logger.js";
import errorHandler from './middlewares/errorHandler.js';
import {globalLimiter} from "./middlewares/rateLimiter.js";
import {sendSuccess, sendNotFound } from './utils/apiResponse.js';

import authRoutes from './modules/auth/auth.routes.js'
import accountsRoute  from './modules/accounts/accounts.routes.js'
import transactionsRoute  from './modules/transactions/transactions.routes.js'


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


// --- Rate Limiting ------------------------------------

app.use("/api", globalLimiter);


// ---- Logging -------------------------------------------

if(config.app.isDev){
    app.use(morgan('dev'));
}else{
    // Production: Structured request logs piped through Winston
    app.use(morgan('combined',{
        stream: {write: (message) => logger.info(message.trim())},
    }));
}

// --- Health Check -----------------------------------------------

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

// ---- API Routes ---------------------------------------------------

app.use("/api/v1/auth", authRoutes);

// app.use("/api/v1/account", accountsRoute);
// app.use("/api/v1/transactions", transactionsRoute);

// ----- 404 Handler -------------------------------------------------

app.all('*', (req, res) => {
    sendNotFound(res, `Route ${req.method} ${req.originalUrl} not found`);
});


// ------ Global Error Handler (must be last) ---------------------------

app.use(errorHandler);

// ----- Start Server --------------------------------------------
const startServer = async () => {
    try{
        await connectDB();
        await connectRedis();

        app.listen(config.app.port, () => {
            logger.info(`${config.app.name} running on port ${config.app.port} [${config.app.env}]`);
        });

    }catch(error){
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
};


// Handle unhandled promise rejection globally 
process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION -- shutting down gracefully', {error: err.message});
    process.exit(1);
});


// Handle uncaught exception
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION -- shutting down gracefully', {error: err.message, stack: err.stack});
    process.exit(1);
});

startServer();

export default app;


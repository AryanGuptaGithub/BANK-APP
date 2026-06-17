// app.js
import express from "express";
import helmet from "helmet";
import cors from "cors";
// import mongoSanitize from "express-mongo-sanitize";
import sanitizeRequest from './middlewares/sanitize.js';


import morgan from "morgan";

import config from './config/env.js';
import connectDB from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import logger from "./utils/logger.js";
import errorHandler from './middlewares/errorHandler.js';
import { createGlobalLimiter } from "./middlewares/rateLimiter.js";
import { sendSuccess, sendNotFound } from './utils/apiResponse.js';

// ✅ Import router factories, not router instances
import createAuthRouter from './modules/auth/auth.routes.js';
import createAccountsRouter from './modules/accounts/accounts.routes.js';

const app = express();

// ---- Security Middleware ----
app.use(helmet());
app.use(cors({
    origin: config.app.isDev
        ? ['http://localhost:3000']
        : process.env.ALLOWED_ORIGINS?.split(',') || [],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ---- Request Parsing ----
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ---- Data Sanitization ----
 // app.use(mongoSanitize());
app.use(sanitizeRequest);


// ---- Logging ----
if (config.app.isDev) {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        stream: { write: (message) => logger.info(message.trim()) },
    }));
}

// ---- Health Check (no Redis dependency, safe at top level) ----
app.get("/health", (req, res) => {
    sendSuccess(res, {
        message: "Server is healthy",
        data: {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toString(),
            environment: config.app.env,
        },
    });
});

// ---- Start Server ----
const startServer = async () => {
    try {
        await connectDB();
        await connectRedis();

        app.use("/api", createGlobalLimiter());
        app.use("/api/v1/auth", createAuthRouter());
        app.use("/api/v1/accounts", createAccountsRouter());

        app.use((req, res) => {
            sendNotFound(res, `Route ${req.method} ${req.originalUrl} not found`);
        });

        app.use(errorHandler);

        app.listen(config.app.port, () => {
            logger.info(`${config.app.name} running on port ${config.app.port} [${config.app.env}]`);
        });

    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
};


process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION -- shutting down gracefully', { error: err.message });
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION -- shutting down gracefully', { error: err.message, stack: err.stack });
    process.exit(1);
});

startServer();

export default app;
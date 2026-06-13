import rateLimit from "express-rate-limit";
import {RedisStore} from "rate-limit-redis";
import {getRedisClient} from "../config/redis";
import config from "../config/env";



const createLimiter = ({ windowMs, max, message, keyPrefix }) => {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {success: false, message, error: {code: "TOO_MANY_REQUESTS"}},
        store: new RedisStore({
            sendCommand: (...args) => getRedisClient().sendCommand(args),
            prefix: `rl:${keyPrefix}:`,
        }),
        skip: () => config.app.env === 'test',
    });
};

const globalLimiter = createLimiter({
   windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: "Too many requests, please try again later.",
    keyPrefix: 'global',
});

const authLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: "Too many authentication attempts. Please wait before trying again.",
    keyPrefix: "auth",
});



// Transaction limiter — 10 per minute per user
const transactionLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: "To many transaction requests. Please slow down.",
    keyPrefix: 'txn',
    keyGenerator: (req) => req.user?.id || req.ip, // Key by user, not IP

});


export {globalLimiter, authLimiter, transactionLimiter};

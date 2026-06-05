import rateLimter from "express-rate-limit";
import {RedisStore} from "rate-limit-redis";
import {getRedisClient} from "../config/redis";
import config from "../config/env";
import { error } from "winston";


const createLimiter = ({windowMs, max, message, keyPredix }) => {
    return rateLimter({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {success: false, message, error: {code: "TOO_MANY_REQUESTS"}},
        store: new RedisStore({
            sendCommand: (...agrs) => getRedisClient().sendCommand(args),
            prefix: `rl:${keyPredix}:`,
        }),
        skip: () => config.app.env === 'test',
    });
};

const globalLimiter = createLimiter({
    windowMs: config.rateLimter.windowMs,
    max: config.rateLimter.max,
    message: "Too many requests, please try again later.",
    keyprefix: 'global',
});

const authLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: config.rateLimter.max,
    message: 'Too many requests, please try again later.',
    keyPrefix: 'global',
});


const authLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 5,
    message: "Too many authentication attempts. Please wait before trying again.",
    keyPredix: "auth",
});


// Transaction limiter — 10 per minute per user
const transactionLimiter = createLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: "To many transaction requests. Please slow down.",
    keyPrefix: 'txn',
    keyGenerator: (req) => req.user?.id || req.ip, // Key by user, not IP

});


module.exports = {globalLimiter, authLimiter, transactionLimiter};

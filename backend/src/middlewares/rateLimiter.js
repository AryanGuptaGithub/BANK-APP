import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../config/redis.js";
import config from "../config/env.js";

const createLimiter = ({
    windowMs,
    max,
    message,
    keyPrefix,
    keyGenerator,
}) => {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message,
            error: {
                code: "TOO_MANY_REQUESTS",
            },
        },
        store: new RedisStore({
            sendCommand: (...args) =>
                getRedisClient().sendCommand(args),
            prefix: `rl:${keyPrefix}:`,
        }),
        skip: () => config.app.env === "test",
        ...(keyGenerator && { keyGenerator }),
    });
};

export const createGlobalLimiter = () =>
    createLimiter({
        windowMs: config.rateLimit.windowMs,
        max: config.rateLimit.max,
        message: "Too many requests, please try again later.",
        keyPrefix: "global",
    });

export const createAuthLimiter = () =>
    createLimiter({
        windowMs: 60 * 1000,
        max: 5,
        message:
            "Too many authentication attempts. Please wait before trying again.",
        keyPrefix: "auth",
    });

export const createTransactionLimiter = () =>
    createLimiter({
        windowMs: 60 * 1000,
        max: 10,
        message:
            "Too many transaction requests. Please slow down.",
        keyPrefix: "txn",
        keyGenerator: (req) => req.user?.id || req.ip,
    });
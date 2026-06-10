import winston from "winston";
import config from "../config/env";

const {combine, timestamp, errors, json, colorize, simple } = winston.format;

const productionFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

const developmentFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss' }),
    simple()
);

const logger = winston.createLogger({
    level: config.app.isDev ? 'debug' : 'info',
    format: config.app.isProd ? productionFormat : developmentFormat,
    transports: [
        new winston.transports.Console(),
    ],
    exitOnError: false,
});


if(config.app.isProd){
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: "error",
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
    }));
}

export default logger;



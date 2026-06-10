import {createClient} from "redis";
import config from "./env";
import logger from "../utils/logger";

let redisClient;

const connectRedis = async () => {
    redisClient = createClient({ 
        url: config.redis.url,
        socket: {
            reconnectStrategy: (retries) => {
                if( retries > 10 ){
                    logger.error('Redis max reconnection attempts reached');
                    return new Error('Redis max retries exceeded');
                }

                // Exponential backoff: wait longer between each retry
                const delay = Math.min(retries * 100, 3000);
                logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
                return delay;

            },
        },
     });

     redisClient.on('error', (err) => logger.error(`Redis error: ${err}`));
     redisClient.on('connect', () => logger.info('Redis connected'));
     redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

     await redisClient.connect();
};

const getRedisClient = () => {
    if(!redisClient){
        throw new Error('Redis client not initialized. call connectRedis() first.');
    }
    return redisClient;
};

export { connectRedis, getRedisClient };




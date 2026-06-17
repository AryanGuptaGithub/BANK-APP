import config from "../config/env.js";
import logger from "../utils/logger.js";
import {sendError} from "../utils/apiResponse.js";
import AppError from '../utils/AppError.js';


const handleMongoErrors = (err) => {
    if(err.code === 11000){
        const field = Object.keys(err.keyValue)[0];
        return new AppError(`${field} already exists`, 409, 'DUPLICATE_KEY');
    }

    if(err.name === 'CastError'){
        return new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'INVALID_ID' );
    }

    if(err.name === "ValidationError"){
        const message = Object.values(err.errors).map((e) => e.message);
        return new AppError(message.join(', '), 422, 'VALIDATION_ERROR');
    }

    return err;
};


// Handle JWT errors

const handleJWTErrors = (err) => {
    if(err.name === 'JsonWebTokenError'){
        return new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }

    if(err.name === 'TokenExpiredError'){
        return new AppError('Token has expired', 401, 'TOKEN_EXPIRED');
    }

    return err;
}


const errorHandler = (err, req, res, next) => {
     let error = err; 

    error = handleMongoErrors(error);
    error = handleJWTErrors(error);

    if(!error.isOperational){
        logger.error('UNEXPECTED ERROR', {
            message: error.message,
            stack: error.stack,
            url: req.originalUrl,
            method: req.method,
            userId: req.user?.id,
        });
    }else{
        logger.warn('Operational error', {
            message: error.message,
            code: error.code,
            url: req.originalUrl,
            method: req.method,
        });
    }


    const statusCode = error.statusCode || 500;
    const message = error.isOperational ? error.message : config.app.isProd ? "Something went wrong. Please Try again later." : error.message;

    return sendError(res, {
        message,
        code: error.code || 'INTERNAL_ERROR',
        statusCode,
        details: !config.app.isProd && !error.isOperational ? error.stack : undefined,
    });

};

export default errorHandler;





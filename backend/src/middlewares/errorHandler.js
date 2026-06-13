import config from "../config/env.js";
import logger from "../utils/logger.js";
import {sendError} from "../utils/apiResponse.js";
import AppError from "../utils/AppError.js";


// Handle specific Mongoose errors and convert to AppError

const handleMongoErrors = (err) => {
    // Duplicate key error 
    if(err.code === 11000){
        const field = Object.keys(err.keyValue)[0];
        return new AppError(`${field} already exists`, 409, "DUPLICATE_KEY");
    }

    //Invalid ObjectId(e.g. /accounts/not-a-valid-id)
    if(err.name === "CastError"){
        return new AppError(`Invalid ${err.path}: ${err.value}`, 400, "INVALID_ID");
    }

    // MONGOOSE Validation error
    if(err.name === "ValidationError"){
        const messages = Object.values(err.errors).map((e) => e.message);
        return new AppError(messages.join(', '), 422, 'VALIDATION_ERROR');
    }

    return err;
}


// Handle JWT errors
const handleJWTErrors = (err) => {
    if(err.name === "JsonWebTokenError"){
        return new AppError("Invalid token", 401, "INVALID_TOKEN");
    }
    if(err.name === "TokenExpiredError"){
        return new AppError("Token has expired", 401, "TOKEN_EXPIRED");
    } 
    return err;
};


const errorHandler = (err, req, res, next) => {
    let error = {...err, message: err.message};
    
    // Convert known error types to AppError
    error = handleMongoErrors(error);
    error = handleJWTErrors(error);

    // Log All errors (but only stack trace for unexpected ones)
    if(!error.isOperational){
        logger.error("UNEXPECTED ERROR", {
            message: error.message,
            stack: error.stack,
            url: req.originalUrl,
            method: req.method,
            userId: req.user?.id,
        });
    }else{
        logger.warn('Operational Error',{
            message: error.message,
            code: error.code,
            url: req.originalUrl,
            method: req.method,
        });
    }



    // In production, never send stack traces or internal error details to client 

        const statusCode = error.statusCode || 500;
        const message = error.isOperational ? error.message : config.app.isProd ? 'Something went wrong. Please try again later' : error.message;

        return sendError(res, {
            message,
            code: error.code || "INTERNAL_ERROR",
            statusCode,
            details: !Config.app.isProd && !error.isOperational ? error.stack : undefined,
        });


        
}

export default errorHandler; 



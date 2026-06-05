

class AppError extends Error {
    constructor(message, statusCode, code = null){
        super(message);
        
        this.statusCode = statusCode;
        this.code = code || this._codeFromStatus(statusCode);
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }

    _codeFromStatus(statusCode){
        const codes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORISZED',
            403: 'FORBINDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'VALIDATION_ERROR',
            429: 'TOO_MANY_REQUESTS',
            500: 'INTERNAL_ERROR',
        };
        return codes[statusCode] || 'ERROR';
    }
}

modules.exports = AppError;

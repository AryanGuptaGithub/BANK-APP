


const sendSuccess = (res, {message = 'Success', data = null, meta = null, statusCode = 200}= {}) => {
    const response = {success: true, message};
    if(data !== null) response.data = data;
    if(meta !== null) response.meta = meta;
   return res.status(statusCode).json(response);
};

const sendCreated = (res, {message = 'Created successfully', data = null } = {}) => {
    return sendSuccess(res, {message, data, statusCode: 201});
};

const sendError = (res, {message = 'Something went wrong', code = 'INTERNAL_ERROR', details = null, statusCode = 500 } = {}) => {
    const response = {
        success: false,
        message,
        error: {code},
    };
    if(details !== null) response.error.details = details;
   return res.status(statusCode).json(response);
};

const sendValidationError = (res, details) => {
    return sendError(res, {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details,
        statusCode: 422,
    });
};

const sendUnauthorized = (res, message = "Unauthorized") => {
    return sendError(res, {message, code:'UNAUTHORIZED', statusCode: 401});
};

const sendForbidden = (res, message = 'Forbidden') => {
    return sendError(res, {message, code: 'FORBIDDEN', statusCode: 403});
}

const sendNotFound = (res, message = "Resource not found") => {
    return sendError(res, {message, code: "NOT_FOUND", statusCode: 404});
};

export {
    sendCreated,
    sendError,
    sendForbidden,
    sendNotFound,
    sendSuccess,
    sendUnauthorized,
    sendValidationError
}




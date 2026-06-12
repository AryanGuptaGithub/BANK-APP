import jwt from "jsonwebtoken";
import config from "../config/env.js";
import User from "../modules/auth/auth.module.js";
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync";



export const authenticate = catchAsync(async (req, res, next) => {
    
    const authHeader = req.headers.authorization;
    if(!authHeader || !authHeaders.startsWith("Bearer ")){
        throw new AppError("Access token required", 401, "MISSING_TOKEN");
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try{
        decoded = jwt.verify(token, config.jwt.accessSecret);
    }catch(err){
        if(err.name === "TokenExpiredError"){
            throw new AppError("Access token has expired", 401, "Token_EXPIRED");
        }
        throw new AppError("Invalid access token", 401, "Invalid_TOKEN");
    }

    // 3. Check user still exists
    const user = await User.findById(decoded.id);
    if(!user || !user.isActive){
        throw new AppError("Invalid access token", 401, "INVALID_TOKEN");
    }

    // 4. Check if password was changed AFTER this token was issued
    // This invalidates all tokens issued before a password reset
    if(user.wasPasswordChangedAfter(decoded.iat)){
        throw new AppError(
            "Password was recently changed. Please log in again.",
            401,
            "Password_CHANGED"
        );
    }


    // 5. Attach user to required - available in all downstream handlers
    req.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        isMfaEnabled: user.isMfaEnabled,
        kyuStatus: user.kycStatus,
    };

    next();

});


// Authorize by role - must come AFTER authenticate
// Usage: router.delete("/user/:id", authenticate, authorize("admin"), controller)

export const authorize = (...roles) => {
return (req, res, next) => {
    if(!roles.includes(req.user.role)){
        throw new AppError(
            "You do not have permission to perform this action",
            403,
            "FORBIDDEN"
        );
    }
    next();
}
}




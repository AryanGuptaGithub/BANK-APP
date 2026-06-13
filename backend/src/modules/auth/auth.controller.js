import * as authService from "./auth.service.js";
import catchAsync from "../../utils/catchAsync.js";
import {sendSuccess, sendCreated} from "../../utils/apiResponse.js"


    //    Controllers are intentionally Thin -- no business login Here
    // They Only:
    //  1. Extract what the services needs from req
    //  2. Call the services
    //  3. Send the response


    // POST /api/v1/auth/register
    export const register = catchAsync(async (req, res) => {
        const result = await authService.register(req.body);
        return sendCreated(res, {
            message: result.message,
            data: {userId: result.userId, email: result.email},
        });
    });

    // POST /api/v1/auth/login
    export const login = catchAsync(async (req, res) => {
        const {email, password, mfaToken} = req.body;
        const ip = req.ip || req.headers["x-forwarded-for"];

        const result = await authService.login({email, password, mfaToken, ip});

        // Send refresh token as HttpOnly cookie -- JS cannot read it (XSS protection)
        // Send access token in response body -- frontend stores in memory, not localStorage
        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true, // Not Accessible via JavaScript
            secure: process.env.NODE_ENV === "production", // HTTPS only in prod
            sameSite: "strict", // No Cross-site request
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        });

        return sendSuccess(res,{
            message: "Login Successful",
            data:{
                accessToken: result.accessToken,
                user: result.user,
            }
        })
    })

    // POST api/v1/auth/refresh
    export const refreshToken = catchAsync(async (req, res) => {
        // Get refresh token from cookie (preferred) or body (fallback)
        const token = req.cookies?.refreshToken || req.body?.refreshToken;

        if(!token){
            return res.status(401).json({
                success: false,
                message: "Refresh token not provided",
                error: {code: "MISSING_REFRESH_TOKEN"},
            });
        }

        const result = await authService.refreshAccessToken(token);

        // Rotate the cookie too
        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return sendSuccess(res, { message: "Token refreshed", data: { accessToken: result.accessToken }});
    });

    // POST /api/v1/auth/logout
    export const logout = catchAsync(async (req, res) => {
        await authService.logout(req.user.id);

        // Clear the cookie
        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        return sendSuccess(res, {message: "Logged out successfully "});
    });


    // POST /api/v1/auth/mfa/setup
    export const setupMfa = catchAsync(async (req, res) => {
        const result = await authService.setupMfa(req.user.id);
        return sendSuccess(res, {
            message: "Scan the QR code with your authenticator app",
            data: result,
        });
    });


    // POST /api/v1/auth/mfa/verify
    export const verifyMfa = catchAsync(async (req, res) => {
        const result = await authService.verifyMfaSetup(req.user.id, req.body.token);
        return sendSuccess(res, {message: result.message});
    });






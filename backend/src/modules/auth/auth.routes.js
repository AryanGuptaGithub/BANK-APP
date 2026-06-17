import { Router } from "express";
import * as authController from "./auth.controller.js";
import { validate, registerSchema, loginSchema, refreshTokenSchema, mfaVerifySchema, verifyEmailSchema, resendOtpSchema } from "./auth.validation.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { createAuthLimiter } from "../../middlewares/rateLimiter.js";

// ✅ Factory function — called inside startServer(), after connectRedis()
const createAuthRouter = () => {
    const router = Router();

    router.use(createAuthLimiter()); // ✅ Redis is connected by the time this runs

    // Public routes
    router.post("/register", validate(registerSchema), authController.register);
    router.post("/login", validate(loginSchema), authController.login);
    router.post("/refresh", authController.refreshToken);

    // Protected routes
    router.post("/logout", authenticate, authController.logout);
    router.post("/mfa/setup", authenticate, authController.setupMfa);
    router.post("/mfa/verify", authenticate, validate(mfaVerifySchema), authController.verifyMfa);

    // Verify-email otp
router.post("/verify-email", validate(verifyEmailSchema), authController.verifyEmail);
router.post("/resend-otp", validate(resendOtpSchema), authController.resendOtp);

    return router;
};

export default createAuthRouter;
import { Router } from "express";
import * as authController from "./auth.controller.js";
import { validate, registerSchema, loginSchema, refreshTokenSchema, mfaVerifySchema } from "./auth.validation.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authLimiter } from "../../middlewares/rateLimiter.js";


const router = Router();

// Apply strict rate limiting to All auth routes
router.use(authLimiter);

// --- Public Routes (no token required) ----------
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/refresh", authController.refreshToken);

// ---- Protected Routes (token required) -----------------------
router.post("/logout", authenticate, authController.logout);
router.post("/mfa/setup", authenticate, authController.setupMfa);
router.post("/mfa/verify", authenticate, validate(mfaVerifySchema), authController.verifyMfa);

export default router;

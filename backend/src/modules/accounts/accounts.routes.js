import { Router } from "express";
import * as accountsController from "./accounts.controller.js";
import {
    validate,
    createAccountSchema,
    updateStatusSchema,
    statementQuerySchema,
} from "./accounts.validation.js";
import { authenticate, authorize } from "../../middlewares/authenticate.js";

const router = Router();

// All accounts routes require authentication
router.use(authenticate);

// ─── Customer Routes ───────────────────────────────────────────────────────
router.post("/", validate(createAccountSchema), accountsController.createAccount);
router.get("/", accountsController.getUserAccounts);
router.get("/:id", accountsController.getAccountById);
router.get("/:id/statement", validate(statementQuerySchema, "query"), accountsController.getAccountStatement);

// ─── Admin Only Routes ─────────────────────────────────────────────────────
router.patch("/:id/status", authorize("admin"), validate(updateStatusSchema), accountsController.updateAccountStatus);

export default router;
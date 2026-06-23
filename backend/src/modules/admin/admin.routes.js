import { Router } from "express";
import * as adminController from "./admin.controller.js";
import {
    validate,
    listUsersSchema,
    updateUserStatusSchema,
    listAccountsSchema,
    listTransactionsSchema,
} from "./admin.validation.js";
import { authenticate, authorize } from "../../middlewares/authenticate.js";

// Factory pattern — consistent with your other modules
const createAdminRouter = () => {
    const router = Router();

    // Every route in this module requires authentication AND admin role
    router.use(authenticate);
    router.use(authorize("admin"));

    router.get("/stats", adminController.getDashboardStats);

    router.get("/users", validate(listUsersSchema, "query"), adminController.listUsers);
    router.get("/users/:id", adminController.getUserById);
    router.patch("/users/:id/status", validate(updateUserStatusSchema), adminController.updateUserStatus);

    router.get("/accounts", validate(listAccountsSchema, "query"), adminController.listAllAccounts);
    router.get("/transactions", validate(listTransactionsSchema, "query"), adminController.listAllTransactions);

    return router;
};

export default createAdminRouter;
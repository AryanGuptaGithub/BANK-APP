import { Router } from "express";
import * as transactionsController from "./transactions.controller.js";
import {
    validate,
    transferSchema,
    depositSchema,
    listQuerySchema,
} from "./transactions.validation.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { createTransactionLimiter } from "../../middlewares/rateLimiter.js";

// Factory pattern — matches your existing rateLimiter approach
// since createTransactionLimiter() needs Redis to be connected first
const createTransactionsRouter = () => {
    const router = Router();

    router.use(authenticate);
    router.use(createTransactionLimiter());

    router.post("/transfer", validate(transferSchema), transactionsController.transferFunds);
    router.post("/deposit", validate(depositSchema), transactionsController.depositFunds);
    router.get("/", validate(listQuerySchema, "query"), transactionsController.getTransactions);
    router.get("/:id", transactionsController.getTransactionById);

    return router;
};

export default createTransactionsRouter;
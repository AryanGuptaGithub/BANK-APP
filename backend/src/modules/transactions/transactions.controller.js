import * as transactionsService from "./transactions.service.js";
import catchAsync from "../../utils/catchAsync.js";
import { sendSuccess, sendCreated } from "../../utils/apiResponse.js";

// POST /api/v1/transactions/transfer
export const transferFunds = catchAsync(async (req, res) => {
    const transaction = await transactionsService.transferFunds(req.user.id, req.body);
    return sendCreated(res, {
        message: "Transfer completed successfully",
        data: transaction,
    });
});

// POST /api/v1/transactions/deposit
export const depositFunds = catchAsync(async (req, res) => {
    const transaction = await transactionsService.depositFunds(req.user.id, req.body);
    return sendCreated(res, {
        message: "Deposit completed successfully",
        data: transaction,
    });
});

// GET /api/v1/transactions
export const getTransactions = catchAsync(async (req, res) => {
    const result = await transactionsService.getTransactions(
        req.user.id,
        req.user.role,
        req.validatedQuery
    );
    return sendSuccess(res, {
        message: "Transactions retrieved successfully",
        data: result.transactions,
        meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
        },
    });
});

// GET /api/v1/transactions/:id
export const getTransactionById = catchAsync(async (req, res) => {
    const transaction = await transactionsService.getTransactionById(
        req.params.id,
        req.user.id,
        req.user.role
    );
    return sendSuccess(res, {
        message: "Transaction retrieved successfully",
        data: transaction,
    });
});
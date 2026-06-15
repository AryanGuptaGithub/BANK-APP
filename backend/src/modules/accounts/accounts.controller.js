import * as accountsService from "./accounts.service.js";
import catchAsync from "../../utils/catchAsync.js";
import {
    sendSuccess,
    sendCreated,
} from "../../utils/apiResponse.js";

// POST /api/v1/accounts
export const createAccount = catchAsync(async (req, res) => {
    const account = await accountsService.createAccount(req.user.id, req.body);
    return sendCreated(res, {
        message: "Account created successfully",
        data: account,
    });
});

// GET /api/v1/accounts
export const getUserAccounts = catchAsync(async (req, res) => {
    const accounts = await accountsService.getUserAccounts(req.user.id);
    return sendSuccess(res, {
        message: "Accounts retrieved successfully",
        data: accounts,
        meta: { total: accounts.length },
    });
});

// GET /api/v1/accounts/:id
export const getAccountById = catchAsync(async (req, res) => {
    const account = await accountsService.getAccountById(
        req.params.id,
        req.user.id,
        req.user.role
    );
    return sendSuccess(res, {
        message: "Account retrieved successfully",
        data: account,
    });
});

// GET /api/v1/accounts/:id/statement
export const getAccountStatement = catchAsync(async (req, res) => {
    const result = await accountsService.getAccountStatement(
        req.params.id,
        req.user.id,
        req.user.role,
        req.query
    );
    return sendSuccess(res, {
        message: "Statement retrieved successfully",
        data: result.transactions,
        meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
            from: result.from,
            to: result.to,
        },
    });
});

// PATCH /api/v1/accounts/:id/status
export const updateAccountStatus = catchAsync(async (req, res) => {
    const account = await accountsService.updateAccountStatus(
        req.params.id,
        req.body,
        req.user.id
    );
    return sendSuccess(res, {
        message: `Account ${req.body.status} successfully`,
        data: account,
    });
});
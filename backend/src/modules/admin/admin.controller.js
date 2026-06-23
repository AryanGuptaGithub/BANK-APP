import * as adminService from "./admin.service.js";
import catchAsync from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";

// GET /api/v1/admin/users
export const listUsers = catchAsync(async (req, res) => {
    const result = await adminService.listUsers(req.validatedQuery);
    return sendSuccess(res, {
        message: "Users retrieved successfully",
        data: result.users,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
});

// GET /api/v1/admin/users/:id
export const getUserById = catchAsync(async (req, res) => {
    const result = await adminService.getUserById(req.params.id);
    return sendSuccess(res, {
        message: "User retrieved successfully",
        data: result,
    });
});

// PATCH /api/v1/admin/users/:id/status
export const updateUserStatus = catchAsync(async (req, res) => {
    const user = await adminService.updateUserStatus(req.params.id, req.body, req.user.id);
    return sendSuccess(res, {
        message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
        data: user,
    });
});

// GET /api/v1/admin/accounts
export const listAllAccounts = catchAsync(async (req, res) => {
    const result = await adminService.listAllAccounts(req.validatedQuery);
    return sendSuccess(res, {
        message: "Accounts retrieved successfully",
        data: result.accounts,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
});

// GET /api/v1/admin/transactions
export const listAllTransactions = catchAsync(async (req, res) => {
    const result = await adminService.listAllTransactions(req.validatedQuery);
    return sendSuccess(res, {
        message: "Transactions retrieved successfully",
        data: result.transactions,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
});

// GET /api/v1/admin/stats
export const getDashboardStats = catchAsync(async (req, res) => {
    const stats = await adminService.getDashboardStats();
    return sendSuccess(res, {
        message: "Dashboard stats retrieved successfully",
        data: stats,
    });
});
import Account from "./accounts.model.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";

// ─── Create Account ────────────────────────────────────────────────────────
export const createAccount = async (userId, { accountType, currency, nickname }) => {

    // One user can have max 3 accounts — a realistic fintech constraint
    const existingCount = await Account.countDocuments({ userId, status: { $ne: "closed" } });
    if (existingCount >= 3) {
        throw new AppError("You can have a maximum of 3 active accounts", 400, "MAX_ACCOUNTS_REACHED");
    }

    // Prevent duplicate account types per user
    const duplicate = await Account.findOne({ userId, accountType, status: { $ne: "closed" } });
    if (duplicate) {
        throw new AppError(`You already have an active ${accountType} account`, 409, "DUPLICATE_ACCOUNT_TYPE");
    }

    const account = await Account.create({
        userId,
        accountType,
        currency: currency || "INR",
        nickname,
    });

    logger.info("Account created", { userId, accountId: account._id, accountType });

    return account;
};

// ─── Get All Accounts for a User ──────────────────────────────────────────
export const getUserAccounts = async (userId) => {
    const accounts = await Account.find({ userId, status: { $ne: "closed" } })
        .select("-dailyTransactionTotal -dailyLimitResetAt") // Don't expose internal tracking fields
        .sort({ createdAt: -1 });

    return accounts;
};

// ─── Get Single Account ────────────────────────────────────────────────────
export const getAccountById = async (accountId, userId, role) => {
    const account = await Account.findById(accountId);

    if (!account) {
        throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
    }

    // IDOR protection — users can only access their own accounts
    // Admins can access any account
    if (role !== "admin" && account.userId.toString() !== userId) {
        throw new AppError("You do not have access to this account", 403, "FORBIDDEN");
    }

    return account;
};

// ─── Get Statement (paginated transaction list) ────────────────────────────
// Note: Transaction model doesn't exist yet — we'll populate this fully
// in the Transactions module. For now it returns account + pagination meta.
export const getAccountStatement = async (accountId, userId, role, { page, limit, from, to }) => {

    // First verify access
    await getAccountById(accountId, userId, role);

    // Build date filter
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    // We'll import Transaction model here once it's built
    // For now, return a placeholder that we'll fill in during the transactions module
    const skip = (page - 1) * limit;

    return {
        accountId,
        page,
        limit,
        from: from || null,
        to: to || null,
        transactions: [], // Will be populated in transactions module
        total: 0,
        totalPages: 0,
    };
};

// ─── Update Account Status (admin only) ───────────────────────────────────
export const updateAccountStatus = async (accountId, { status, reason }, adminId) => {
    const account = await Account.findById(accountId);

    if (!account) {
        throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
    }

    if (account.status === "closed") {
        throw new AppError("Cannot modify a closed account", 400, "ACCOUNT_CLOSED");
    }

    const previousStatus = account.status;
    account.status = status;

    if (status === "closed") {
        account.closedAt = new Date();
    }

    await account.save();

    logger.info("Account status updated", {
        accountId,
        from: previousStatus,
        to: status,
        reason,
        adminId,
    });

    return account;
};
import User from "../auth/auth.model.js";
import Account from "../accounts/accounts.model.js";
import Transaction from "../transactions/transactions.model.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";

// ─── List Users ──────────────────────────────────────────────────────────
export const listUsers = async ({ page, limit, role, kycStatus, isActive, search }) => {
    const filter = {};

    if (role) filter.role = role;
    if (kycStatus) filter.kycStatus = kycStatus;
    if (isActive !== undefined) filter.isActive = isActive;

    if (search) {
        // Search by name or email — case-insensitive partial match
        filter.$or = [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
        User.find(filter)
            // Explicitly exclude sensitive fields even though select:false covers most
            .select("-password -mfaSecret -refreshTokenHash -emailVerificationToken -passwordResetToken")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        User.countDocuments(filter),
    ]);

    return {
        users,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};

// ─── Get Single User (with account summary) ────────────────────────────
export const getUserById = async (userId) => {
    const user = await User.findById(userId).select(
        "-password -mfaSecret -refreshTokenHash -emailVerificationToken -passwordResetToken"
    );

    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const accounts = await Account.find({ userId }).select("-dailyTransactionTotal -dailyLimitResetAt");

    return { user, accounts };
};

// ─── Update User Status (activate/deactivate) ──────────────────────────
export const updateUserStatus = async (userId, { isActive, reason }, adminId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    if (user.role === "admin") {
        throw new AppError("Cannot deactivate an admin account", 403, "CANNOT_MODIFY_ADMIN");
    }

    user.isActive = isActive;
    await user.save();

    logger.warn("User status changed by admin", {
        targetUserId: userId,
        isActive,
        reason,
        adminId,
    });

    return user;
};

// ─── List All Accounts (admin view) ─────────────────────────────────────
export const listAllAccounts = async ({ page, limit, status, accountType }) => {
    const filter = {};
    if (status) filter.status = status;
    if (accountType) filter.accountType = accountType;

    const skip = (page - 1) * limit;

    const [accounts, total] = await Promise.all([
        Account.find(filter)
            .populate("userId", "firstName lastName email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Account.countDocuments(filter),
    ]);

    return {
        accounts,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};

// ─── List All Transactions (fraud monitoring view) ──────────────────────
export const listAllTransactions = async ({ page, limit, type, status, minAmount, from, to }) => {
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (minAmount) filter.amount = { $gte: minAmount };
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .populate("fromAccount", "accountNumber accountType")
            .populate("toAccount", "accountNumber accountType")
            .populate("initiatedBy", "firstName lastName email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Transaction.countDocuments(filter),
    ]);

    return {
        transactions,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────
export const getDashboardStats = async () => {
    const [
        totalUsers,
        activeUsers,
        totalAccounts,
        frozenAccounts,
        totalTransactions,
        last24hTransactions,
        volumeAgg,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        Account.countDocuments({ status: { $ne: "closed" } }),
        Account.countDocuments({ status: "frozen" }),
        Transaction.countDocuments({ status: "completed" }),
        Transaction.countDocuments({
            status: "completed",
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
        // Total transaction volume — sum of all completed transaction amounts
        Transaction.aggregate([
            { $match: { status: "completed" } },
            { $group: { _id: null, totalVolume: { $sum: "$amount" } } },
        ]),
    ]);

    return {
        users: { total: totalUsers, active: activeUsers },
        accounts: { total: totalAccounts, frozen: frozenAccounts },
        transactions: {
            total: totalTransactions,
            last24h: last24hTransactions,
            totalVolume: volumeAgg[0]?.totalVolume || 0,
        },
    };
};
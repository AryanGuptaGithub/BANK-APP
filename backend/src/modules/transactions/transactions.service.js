import mongoose from "mongoose";
import Transaction from "./transactions.model.js";
import Account from "../accounts/accounts.model.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";
import { createNotification } from "../notifications/notifications.service.js";

// ─── Idempotency Check ──────────────────────────────────────────────────
// If this idempotency key was already used, return the existing transaction
// instead of processing it again. This protects against network retries
// causing duplicate transfers.
const checkIdempotency = async (idempotencyKey) => {
    const existing = await Transaction.findOne({ idempotencyKey });
    return existing;
};

// ─── Transfer Funds ─────────────────────────────────────────────────────
export const transferFunds = async (userId, { fromAccountId, toAccountId, amount, description, idempotencyKey }) => {

    // 1. Idempotency check — BEFORE starting a transaction
    const existing = await checkIdempotency(idempotencyKey);
    if (existing) {
        logger.info("Idempotent request detected, returning existing transaction", { idempotencyKey });
        return existing;
    }

    // 2. Start a MongoDB session for atomicity
    // Either BOTH the debit and credit happen, or NEITHER does.
    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            // ── Fetch both accounts WITHIN the session ──────────────────
            const fromAccount = await Account.findById(fromAccountId).session(session);
            const toAccount = await Account.findById(toAccountId).session(session);

            if (!fromAccount) {
                throw new AppError("Source account not found", 404, "ACCOUNT_NOT_FOUND");
            }
            if (!toAccount) {
                throw new AppError("Destination account not found", 404, "ACCOUNT_NOT_FOUND");
            }

            // ── Ownership check — IDOR protection ────────────────────────
            if (fromAccount.userId.toString() !== userId) {
                throw new AppError("You do not have access to this account", 403, "FORBIDDEN");
            }

            // ── Status checks ─────────────────────────────────────────────
            if (fromAccount.status !== "active") {
                throw new AppError(`Source account is ${fromAccount.status}`, 400, "ACCOUNT_NOT_ACTIVE");
            }
            if (toAccount.status !== "active") {
                throw new AppError(`Destination account is ${toAccount.status}`, 400, "ACCOUNT_NOT_ACTIVE");
            }

            // ── Sufficient balance check ───────────────────────────────────
            if (fromAccount.balance < amount) {
                throw new AppError("Insufficient funds", 400, "INSUFFICIENT_FUNDS");
            }

            // ── Daily limit check ───────────────────────────────────────────
            if (!fromAccount.checkDailyLimit(amount)) {
                throw new AppError(
                    `This transfer exceeds your daily limit of ${fromAccount.dailyTransactionLimit}`,
                    400,
                    "DAILY_LIMIT_EXCEEDED"
                );
            }

            // ── Perform the actual balance updates ──────────────────────────
            fromAccount.balance -= amount;
            fromAccount.dailyTransactionTotal += amount;
            toAccount.balance += amount;

            await fromAccount.save({ session });
            await toAccount.save({ session });

            // ── Create the transaction record ───────────────────────────────
            const [transaction] = await Transaction.create(
                [{
                    fromAccount: fromAccountId,
                    toAccount: toAccountId,
                    type: "transfer",
                    amount,
                    description,
                    status: "completed",
                    idempotencyKey,
                    initiatedBy: userId,
                    fromBalanceAfter: fromAccount.balance,
                    toBalanceAfter: toAccount.balance,
                }],
                { session }
            );

            result = transaction;
        });

        logger.info("Transfer completed", {
            userId,
            fromAccountId,
            toAccountId,
            amount,
            transactionId: result._id,
        });

        
        // -----------------Notifications--------------------------------------
        // Fire-and-forget notifications — don't await blocking, don't let failure break the transfer
        createNotification({
            userId,
            type: "transaction_debit",
            title: "Money Sent",
            message: `₹${amount} sent successfully. Ref: ${result.reference}`,
            relatedEntity: { entityType: "transaction", entityId: result._id },
        });

        // Notify the receiver too — fetch their userId from the toAccount
        const toAccount = await Account.findById(toAccountId).select("userId");
        if (toAccount) {
            createNotification({
                userId: toAccount.userId.toString(),
                type: "transaction_credit",
                title: "Money Received",
                message: `₹${amount} received. Ref: ${result.reference}`,
                relatedEntity: { entityType: "transaction", entityId: result._id },
            });
        }


        return result;

    } catch (error) {
        // If transaction failed, record a failed transaction for audit trail
        // (outside the session since the session itself was rolled back)
        if (error.code !== "DUPLICATE_KEY") {
            await Transaction.create({
                fromAccount: fromAccountId,
                toAccount: toAccountId,
                type: "transfer",
                amount,
                description,
                status: "failed",
                failureReason: error.message,
                idempotencyKey: `${idempotencyKey}-failed-${Date.now()}`, // avoid unique collision
                initiatedBy: userId,
            }).catch((e) => logger.error("Failed to log failed transaction", { error: e.message }));
        }

        logger.warn("Transfer failed", { userId, fromAccountId, toAccountId, amount, reason: error.message });
        throw error;

    } finally {
        await session.endSession();
    }
};

// ─── Deposit Funds ──────────────────────────────────────────────────────
export const depositFunds = async (userId, { toAccountId, amount, description, idempotencyKey }) => {

    const existing = await checkIdempotency(idempotencyKey);
    if (existing) {
        return existing;
    }

    const session = await mongoose.startSession();

    try {
        let result;

        await session.withTransaction(async () => {
            const toAccount = await Account.findById(toAccountId).session(session);

            if (!toAccount) {
                throw new AppError("Account not found", 404, "ACCOUNT_NOT_FOUND");
            }

            if (toAccount.userId.toString() !== userId) {
                throw new AppError("You do not have access to this account", 403, "FORBIDDEN");
            }

            if (toAccount.status !== "active") {
                throw new AppError(`Account is ${toAccount.status}`, 400, "ACCOUNT_NOT_ACTIVE");
            }

            toAccount.balance += amount;
            await toAccount.save({ session });

            const [transaction] = await Transaction.create(
                [{
                    toAccount: toAccountId,
                    type: "deposit",
                    amount,
                    description,
                    status: "completed",
                    idempotencyKey,
                    initiatedBy: userId,
                    toBalanceAfter: toAccount.balance,
                }],
                { session }
            );

            result = transaction;
        });

        logger.info("Deposit completed", { userId, toAccountId, amount, transactionId: result._id });

        createNotification({
            userId,
            type: "transaction_credit",
            title: "Deposit Successful",
            message: `₹${amount} deposited successfully. Ref: ${result.reference}`,
            relatedEntity: { entityType: "transaction", entityId: result._id },
        });

        return result;

    } finally {
        await session.endSession();
    }
};

// ─── Get Transaction History ───────────────────────────────────────────
export const getTransactions = async (userId, role, { page, limit, accountId, type, status, from, to }) => {

    // Build the base filter — must scope to user's own accounts unless admin
    const filter = {};

    if (role !== "admin") {
        // Find all account IDs owned by this user
        const userAccounts = await Account.find({ userId }).select("_id");
        const accountIds = userAccounts.map((a) => a._id);

        filter.$or = [
            { fromAccount: { $in: accountIds } },
            { toAccount: { $in: accountIds } },
        ];
    }

    if (accountId) {
        filter.$or = [{ fromAccount: accountId }, { toAccount: accountId }];
    }
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .populate("fromAccount", "accountNumber accountType nickname")
            .populate("toAccount", "accountNumber accountType nickname")
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

// ─── Get Single Transaction ────────────────────────────────────────────
export const getTransactionById = async (transactionId, userId, role) => {
    const transaction = await Transaction.findById(transactionId)
        .populate("fromAccount", "accountNumber accountType nickname userId")
        .populate("toAccount", "accountNumber accountType nickname userId");

    if (!transaction) {
        throw new AppError("Transaction not found", 404, "TRANSACTION_NOT_FOUND");
    }

    // Access check — user must own either the from or to account, or be admin
    if (role !== "admin") {
        const ownsFrom = transaction.fromAccount?.userId?.toString() === userId;
        const ownsTo = transaction.toAccount?.userId?.toString() === userId;

        if (!ownsFrom && !ownsTo) {
            throw new AppError("You do not have access to this transaction", 403, "FORBIDDEN");
        }
    }

    return transaction;
};
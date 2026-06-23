import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
    {
        // ─── Parties Involved ──────────────────────────────────────────
        // For a transfer: both are set
        // For a deposit: only toAccount is set
        // For a withdrawal: only fromAccount is set
        fromAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            default: null,
            index: true,
        },
        toAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Account",
            default: null,
            index: true,
        },

        // ─── Transaction Details ───────────────────────────────────────
        type: {
            type: String,
            enum: ["transfer", "deposit", "withdrawal"],
            required: [true, "Transaction type is required"],
        },
        amount: {
            type: Number,
            required: [true, "Amount is required"],
            min: [0.01, "Amount must be greater than 0"],
        },
        currency: {
            type: String,
            default: "INR",
            uppercase: true,
        },
        description: {
            type: String,
            trim: true,
            maxlength: [200, "Description cannot exceed 200 characters"],
            default: "",
        },

        // ─── Status Tracking ────────────────────────────────────────────
        // pending -> completed (success) or failed (rolled back)
        status: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "pending",
            index: true,
        },
        failureReason: {
            type: String,
            default: null,
        },

        // ─── Idempotency ────────────────────────────────────────────────
        // Client generates this UUID. If the same key is sent twice
        // (e.g. due to network retry), we return the original result
        // instead of processing the transfer again.
        idempotencyKey: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // ─── Reference & Audit ──────────────────────────────────────────
        reference: {
            type: String,
            unique: true,
        },
        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // ─── Balances after transaction (audit trail) ───────────────────
        // Storing post-transaction balances makes it easy to verify
        // statement integrity later without recalculating from scratch
        fromBalanceAfter: { type: Number, default: null },
        toBalanceAfter: { type: Number, default: null },
    },
    { timestamps: true }
);

// ─── Generate human-readable reference number before saving ──────────────
transactionSchema.pre("save", function () {
    if (!this.reference) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.reference = `TXN-${timestamp}-${random}`;
    }
});

// ─── Indexes for common queries ────────────────────────────────────────────
transactionSchema.index({ fromAccount: 1, createdAt: -1 });
transactionSchema.index({ toAccount: 1, createdAt: -1 });
transactionSchema.index({ initiatedBy: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
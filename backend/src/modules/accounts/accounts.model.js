import mongoose from "mongoose";

// ─── Account Number Generator ──────────────────────────────────────────────
// Generates a unique 10-digit account number
// Format: 2 digit year + 8 random digits e.g. 2612345678
const generateAccountNumber = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(10000000 + Math.random() * 90000000).toString();
    return `${year}${random}`;
};

const accountSchema = new mongoose.Schema(
    {
        // ─── Owner ─────────────────────────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User ID is required"],
          
        },

        // ─── Account Identity ──────────────────────────────────────────
        accountNumber: {
            type: String,
            unique: true,
            default: generateAccountNumber,

        },
        accountType: {
            type: String,
            enum: ["savings", "current", "fixed_deposit"],
            required: [true, "Account type is required"],
            default: "savings",
        },

        // ─── Balance ───────────────────────────────────────────────────
        // Store as Number — in a real system you'd use integers (paise/cents)
        // to avoid floating point issues. For this project, Number is fine.
        balance: {
            type: Number,
            default: 0,
            min: [0, "Balance cannot be negative"],
        },
        currency: {
            type: String,
            default: "INR",
            uppercase: true,
            trim: true,
        },

        // ─── Status ────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ["active", "frozen", "closed"],
            default: "active",
        },

        // ─── Limits ────────────────────────────────────────────────────
        // Daily transaction limit — can be customized per account
        dailyTransactionLimit: {
            type: Number,
            default: 100000, // ₹1,00,000 default
        },
        // Track how much has been transacted today (resets at midnight)
        dailyTransactionTotal: {
            type: Number,
            default: 0,
        },
        dailyLimitResetAt: {
            type: Date,
            default: null,
        },

        // ─── Metadata ──────────────────────────────────────────────────
        nickname: {
            type: String,
            trim: true,
            maxlength: [30, "Nickname cannot exceed 30 characters"],
        },
        closedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// ─── Virtual: is account operational? ─────────────────────────────────────
accountSchema.virtual("isOperational").get(function () {
    return this.status === "active";
});

// ─── Instance method: check daily limit ───────────────────────────────────
// Resets the daily counter if it's a new day, then checks if transaction fits
accountSchema.methods.checkDailyLimit = function (amount) {
    const now = new Date();
    const lastReset = this.dailyLimitResetAt;

    // If no reset recorded, or last reset was before today — reset the counter
    const isNewDay =
        !lastReset ||
        lastReset.toDateString() !== now.toDateString();

    if (isNewDay) {
        this.dailyTransactionTotal = 0;
        this.dailyLimitResetAt = now;
    }

    return (this.dailyTransactionTotal + amount) <= this.dailyTransactionLimit;
};

// ─── Indexes ───────────────────────────────────────────────────────────────
accountSchema.index({ userId: 1, status: 1 });
// accountSchema.index({ accountNumber: 1 });

const Account = mongoose.model("Account", accountSchema);

export default Account;
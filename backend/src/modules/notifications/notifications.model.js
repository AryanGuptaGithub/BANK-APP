import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User ID is required"],
            index: true,
        },

        // ─── Content ────────────────────────────────────────────────────
        type: {
            type: String,
            enum: [
                "transaction_credit",
                "transaction_debit",
                "account_created",
                "account_frozen",
                "security_alert",
                "general",
            ],
            required: true,
        },
        title: {
            type: String,
            required: [true, "Title is required"],
            maxlength: [100, "Title cannot exceed 100 characters"],
        },
        message: {
            type: String,
            required: [true, "Message is required"],
            maxlength: [300, "Message cannot exceed 300 characters"],
        },

        // ─── Related Entity (optional) ─────────────────────────────────
        // Lets the frontend deep-link, e.g. tapping a notification opens
        // the related transaction or account
        relatedEntity: {
            entityType: {
                type: String,
                enum: ["transaction", "account", null],
                default: null,
            },
            entityId: {
                type: mongoose.Schema.Types.ObjectId,
                default: null,
            },
        },

        // ─── Status ─────────────────────────────────────────────────────
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
            default: null,
        },

        // ─── Priority — used for filtering/highlighting in UI ──────────
        priority: {
            type: String,
            enum: ["low", "normal", "high"],
            default: "normal",
        },
    },
    { timestamps: true }
);

// ─── Compound index for the most common query: ─────────────────────────
// "get unread notifications for this user, newest first"
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
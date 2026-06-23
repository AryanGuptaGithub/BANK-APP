import Notification from "./notifications.model.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";

// ─── Internal Helper — called by OTHER modules ──────────────────────────
// e.g. transactions.service.js calls this after a successful transfer.
// This is NOT exposed as an API route — it's a function other services import.
export const createNotification = async ({
    userId,
    type,
    title,
    message,
    relatedEntity = null,
    priority = "normal",
}) => {
    try {
      
        const notification = await Notification.create({
            userId,
            type,
            title,
            message,
            relatedEntity,
            priority,
        });

        return notification;
    } catch (error) {
        logger.error("Failed to create notification", { userId, type, error: error.message });
        return null;
    }
};

// ─── Get Notifications (paginated, filterable) ──────────────────────────
export const getNotifications = async (userId, { page, limit, unreadOnly }) => {
    const filter = { userId };
    if (unreadOnly) filter.isRead = false;

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Notification.countDocuments(filter),
        Notification.countDocuments({ userId, isRead: false }),
    ]);

    return {
        notifications,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount,
    };
};

// ─── Mark Single Notification as Read ───────────────────────────────────
export const markAsRead = async (notificationId, userId) => {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
        throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
    }

    // IDOR protection — users can only mark their own notifications
    if (notification.userId.toString() !== userId) {
        throw new AppError("You do not have access to this notification", 403, "FORBIDDEN");
    }

    if (!notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();
    }

    return notification;
};

// ─── Mark All as Read ────────────────────────────────────────────────────
export const markAllAsRead = async (userId) => {
    const result = await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true, readAt: new Date() }
    );

    return { modifiedCount: result.modifiedCount };
};

// ─── Delete Notification ─────────────────────────────────────────────────
export const deleteNotification = async (notificationId, userId) => {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
        throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
    }

    if (notification.userId.toString() !== userId) {
        throw new AppError("You do not have access to this notification", 403, "FORBIDDEN");
    }

    await Notification.findByIdAndDelete(notificationId);
};
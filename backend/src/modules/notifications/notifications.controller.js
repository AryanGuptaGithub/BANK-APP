import * as notificationsService from "./notifications.service.js";
import catchAsync from "../../utils/catchAsync.js";
import { sendSuccess } from "../../utils/apiResponse.js";

// GET /api/v1/notifications
export const getNotifications = catchAsync(async (req, res) => {
    const result = await notificationsService.getNotifications(req.user.id, req.validatedQuery);
    return sendSuccess(res, {
        message: "Notifications retrieved successfully",
        data: result.notifications,
        meta: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
            unreadCount: result.unreadCount,
        },
    });
});

// PATCH /api/v1/notifications/:id/read
export const markAsRead = catchAsync(async (req, res) => {
    const notification = await notificationsService.markAsRead(req.params.id, req.user.id);
    return sendSuccess(res, {
        message: "Notification marked as read",
        data: notification,
    });
});

// PATCH /api/v1/notifications/read-all
export const markAllAsRead = catchAsync(async (req, res) => {
    const result = await notificationsService.markAllAsRead(req.user.id);
    return sendSuccess(res, {
        message: `${result.modifiedCount} notification(s) marked as read`,
        data: result,
    });
});

// DELETE /api/v1/notifications/:id
export const deleteNotification = catchAsync(async (req, res) => {
    await notificationsService.deleteNotification(req.params.id, req.user.id);
    return sendSuccess(res, { message: "Notification deleted successfully" });
});
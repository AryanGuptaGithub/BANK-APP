import { Router } from "express";
import * as notificationsController from "./notifications.controller.js";
import { validate, listQuerySchema } from "./notifications.validation.js";
import { authenticate } from "../../middlewares/authenticate.js";

// Factory pattern — consistent with your other modules
const createNotificationsRouter = () => {
    const router = Router();

    router.use(authenticate);

    router.get("/", validate(listQuerySchema, "query"), notificationsController.getNotifications);
    router.patch("/read-all", notificationsController.markAllAsRead);
    router.patch("/:id/read", notificationsController.markAsRead);
    router.delete("/:id", notificationsController.deleteNotification);

    return router;
};

export default createNotificationsRouter;
const express = require("express");
const router = express.Router();


const {
    getNotifications,
    getUnreadNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
} = require("../controller/notificationController");


const authMiddleware = require("../middleware/authMiddleware");


router.get(
    "/",
    authMiddleware,
    getNotifications
);


router.get(
    "/unread",
    authMiddleware,
    getUnreadNotifications
);


router.patch(
    "/:id/read",
    authMiddleware,
    markNotificationAsRead
);


router.patch(
    "/read-all",
    authMiddleware,
    markAllNotificationsAsRead
);


router.delete(
    "/:id",
    authMiddleware,
    deleteNotification
);


module.exports = router;

import API from "./api";

export const getNotifications = () => {
    return API.get("/notifications");
};

export const getUnreadNotifications = () => {
    return API.get("/notifications/unread");
};

export const markNotificationAsRead = (id) => {
    return API.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsAsRead = () => {
    return API.patch("/notifications/read-all");
};

export const deleteNotification = (id) => {
    return API.delete(`/notifications/${id}`);
};
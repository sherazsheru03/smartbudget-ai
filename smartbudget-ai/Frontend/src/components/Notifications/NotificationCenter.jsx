import { useState, useEffect } from "react";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../../services/notificationService";
import styles from "./NotificationCenter.module.css";

const ALERT_LABEL_MAP = {
  BUDGET_EXCEEDED: "Budget Exceeded",
  BUDGET_NEAR_LIMIT: "Near Limit",
  PROJECTED_OVER_BUDGET: "Projected Over Budget",
  BUDGET_EXHAUSTED: "Budget Exhausted",
};

const formatNotificationDate = (dateString) => {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingReadId, setMarkingReadId] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getNotifications();
        const data = response.data?.notifications;

        setNotifications(Array.isArray(data) ? data : []);
      } catch (err) {
        const message =
          err.response?.data?.message ||
          "Failed to load notifications. Please try again.";

        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter(
    (notification) => notification.is_read === false
  ).length;

  const handleMarkAsRead = async (id) => {
    if (markingReadId) {
      return;
    }

    setMarkingReadId(id);
    setError("");

    try {
      const response = await markNotificationAsRead(id);
      const updatedNotification = response.data?.notification;

      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) =>
          notification.id === id
            ? { ...notification, ...updatedNotification }
            : notification
        )
      );
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to mark notification as read. Please try again.";

      setError(message);
    } finally {
      setMarkingReadId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (markingAllRead) {
      return;
    }

    setMarkingAllRead(true);
    setError("");

    try {
      await markAllNotificationsAsRead();

      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to mark all notifications as read. Please try again.";

      setError(message);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleDelete = async (id) => {
    if (deletingId) {
      return;
    }

    setDeletingId(id);
    setError("");

    try {
      await deleteNotification(id);

      setNotifications((previousNotifications) =>
        previousNotifications.filter((notification) => notification.id !== id)
      );
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Failed to delete notification. Please try again.";

      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          {unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications"}
        </h2>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={markingAllRead}
            className={styles.markAllAsReadButton}
          >
            {markingAllRead ? "Marking..." : "Mark all as read"}
          </button>
        )}
      </div>

      {loading ? (
        <p className={styles.statusText}>Loading notifications...</p>
      ) : error ? (
        <p className={styles.statusTextError}>{error}</p>
      ) : notifications.length === 0 ? (
        <p className={styles.statusText}>
          You have no notifications yet.
        </p>
      ) : (
        <ul className={styles.notificationList}>
          {notifications.map((notification) => {
            const alertLabel =
              ALERT_LABEL_MAP[notification.alert_code] ||
              notification.alert_code;

            const itemClassName = notification.is_read
              ? styles.notificationItem
              : `${styles.notificationItem} ${styles.notificationItemUnread}`;

            return (
              <li key={notification.id} className={itemClassName}>
                <div className={styles.notificationItemHeader}>
                  <span className={styles.alertBadge}>{alertLabel}</span>

                  {!notification.is_read && (
                    <span className={styles.unreadDot} aria-label="Unread" />
                  )}
                </div>

                <p className={styles.notificationMessage}>
                  {notification.message}
                </p>

                <div className={styles.notificationFooter}>
                  <p className={styles.notificationMeta}>
                    {formatNotificationDate(notification.created_at)}
                  </p>

                  <div className={styles.notificationActions}>
                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={markingReadId === notification.id}
                        className={styles.markAsReadButton}
                      >
                        {markingReadId === notification.id
                          ? "Marking..."
                          : "Mark as read"}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(notification.id)}
                      disabled={deletingId === notification.id}
                      className={styles.deleteButton}
                    >
                      {deletingId === notification.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default NotificationCenter;

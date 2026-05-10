import { useCallback, useEffect, useState } from "react";
import { notificationApi } from "../../lib/api";

/**
 * NotificationPanel - Displays user notifications with actions
 * Features: List notifications, mark as read, delete, pagination
 * Styled with project theme for consistency across app pages
 */
export default function NotificationPanel() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");
  const [limit] = useState(10);
  const [skip, setSkip] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setStatus("");
      const response = await notificationApi.getNotifications({ limit, skip });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unreadCount || 0);
      setTotalCount(response.data.totalCount || 0);
    } catch (err) {
      setError(err.message || "Failed to load notifications");
      console.error("Notification fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [limit, skip]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      setStatus("Failed to mark as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date() })));
      setUnreadCount(0);
      setStatus("Marked all as read");
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      setStatus("Failed to mark all as read");
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await notificationApi.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
      setTotalCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to delete notification:", err);
      setStatus("Failed to delete notification");
    }
  };

  const getNotificationTypeLabel = (type) => {
    const labels = {
      POST_APPROVED: "Post Approved",
      POST_REJECTED: "Post Rejected",
      OBJECTION_RAISED: "Objection Raised",
      OBJECTION_RESOLVED: "Objection Resolved",
    };
    return labels[type] || "Notification";
  };

  const getNotificationTypeBadge = (type) => {
    const badges = {
      POST_APPROVED: "official",
      POST_REJECTED: "danger",
      OBJECTION_RAISED: "pending",
      OBJECTION_RESOLVED: "resolved",
    };
    return badges[type] || "pending";
  };

  return (
    <div className="page-list">
      {status ? <p className="status-text">{status}</p> : null}
      {error ? <p className="status-text">{error}</p> : null}

      {unreadCount > 0 && (
        <div className="notification-section">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <strong>{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</strong>
            </div>
            <button
              onClick={handleMarkAllAsRead}
              className="landing-link primary"
              style={{ margin: 0 }}
            >
              Mark all as read
            </button>
          </div>
        </div>
      )}

      {isLoading ? <p className="feed-muted">Loading notifications...</p> : null}

      {!isLoading && notifications.length === 0 && (
        <p className="feed-muted">No notifications yet. You'll see updates here when posts are reviewed or objections are raised.</p>
      )}

      <div className="page-list">
        {notifications.map((notification) => (
          <article
            key={notification._id}
            className={`notification-card ${!notification.isRead ? "unread" : ""}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h4>{notification.title}</h4>
                  <span className={`status-badge ${getNotificationTypeBadge(notification.type)}`}>
                    {getNotificationTypeLabel(notification.type)}
                  </span>
                </div>
                <p>{notification.message}</p>
              </div>
              {!notification.isRead && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--primary)",
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                />
              )}
            </div>

            <div className="action-row">
              {notification.actionUrl && (
                <a
                  href={notification.actionUrl}
                  className="action-btn"
                  style={{ textDecoration: "none" }}
                >
                  View Post
                </a>
              )}
              {!notification.isRead && (
                <button
                  onClick={() => handleMarkAsRead(notification._id)}
                  className="action-btn"
                >
                  Mark as read
                </button>
              )}
              <button
                onClick={() => handleDeleteNotification(notification._id)}
                className="action-btn danger"
              >
                Delete
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "6px 0 0" }}>
              {new Date(notification.createdAt).toLocaleString("en-IN")}
            </p>
          </article>
        ))}
      </div>

      {totalCount > limit && (
        <div className="pagination-controls">
          <button
            onClick={() => setSkip(Math.max(0, skip - limit))}
            disabled={skip === 0}
            className="pagination-button"
          >
            Previous
          </button>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>
            Page {Math.floor(skip / limit) + 1} of {Math.ceil(totalCount / limit)}
          </span>
          <button
            onClick={() => setSkip(skip + limit)}
            disabled={skip + limit >= totalCount}
            className="pagination-button"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

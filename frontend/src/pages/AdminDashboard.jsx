import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, userApi } from "../lib/api";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { useToast } from "../components/common/useToast";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const responseUser = await userApi.getMe();
        const user = responseUser.data?.data;
        setCurrentUser(user || null);
        if (!user || user.role !== "univ_admin") {
          navigate("/app", { replace: true });
          return;
        }

        const response = await adminApi.getStats();
        setStats(response.data);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError(err.message || "Failed to load stats");
        addToast("Failed to load dashboard stats", "error");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, addToast]);

  if (loading) {
    return (
      <main className="feed-shell">
        <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
        <div className="admin-dashboard-page">
        <div className="loading-spinner">Loading dashboard...</div>
        </div>
      </main>
    );
  }

  if (error || !stats) {
    return (
      <main className="feed-shell">
        <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
        <div className="admin-dashboard-page">
        <div className="error-message">{error || "Failed to load dashboard"}</div>
        </div>
      </main>
    );
  }

  const { data } = stats;

  return (
    <main className="feed-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
      <div className="admin-dashboard-page">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p className="page-subtitle">Campus Connect System Overview</p>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{data.summary.totalUsers}</div>
          <div className="stat-description">Active users in system</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Posts</div>
          <div className="stat-value">{data.summary.totalPosts}</div>
          <div className="stat-description">Posts created</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Discussions</div>
          <div className="stat-value">{data.summary.totalDiscussions}</div>
          <div className="stat-description">Discussions started</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Departments</div>
          <div className="stat-value">{data.summary.totalDepartments}</div>
          <div className="stat-description">Departments registered</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Unread Notifications</div>
          <div className="stat-value">{data.unreadNotifications}</div>
          <div className="stat-description">Pending notifications</div>
        </div>
      </div>

      {/* Weekly Activity */}
      <div className="dashboard-section">
        <h2>This Week's Activity</h2>
        <div className="activity-cards">
          <div className="activity-card">
            <span className="activity-label">Posts Created</span>
            <span className="activity-value">{data.weeklyActivity.postsLastWeek}</span>
          </div>
          <div className="activity-card">
            <span className="activity-label">Discussions Started</span>
            <span className="activity-value">{data.weeklyActivity.discussionsLastWeek}</span>
          </div>
        </div>
      </div>

      {/* Users by Role */}
      <div className="dashboard-section">
        <h2>Users by Role</h2>
        <div className="role-breakdown">
          {data.usersByRole && data.usersByRole.length > 0 ? (
            data.usersByRole.map((role) => (
              <div key={role._id} className="role-item">
                <span className="role-name">{role._id || "unknown"}</span>
                <div className="role-bar">
                  <div
                    className="role-fill"
                    style={{
                      width: `${(role.count / data.summary.totalUsers) * 100}%`,
                    }}
                  />
                </div>
                <span className="role-count">{role.count}</span>
              </div>
            ))
          ) : (
            <p>No role data available</p>
          )}
        </div>
      </div>

      {/* Top Departments by Posts */}
      <div className="dashboard-section">
        <h2>Top Departments by Posts</h2>
        <div className="department-list">
          {data.topDepartmentsByPosts && data.topDepartmentsByPosts.length > 0 ? (
            data.topDepartmentsByPosts.map((dept, idx) => (
              <div key={dept.departmentId} className="department-item">
                <span className="rank">{idx + 1}.</span>
                <span className="dept-name">{dept.departmentName}</span>
                <span className="post-count">{dept.postCount} posts</span>
              </div>
            ))
          ) : (
            <p>No department data available</p>
          )}
        </div>
      </div>

      {/* Top Departments by Discussions */}
      <div className="dashboard-section">
        <h2>Top Departments by Discussions</h2>
        <div className="department-list">
          {data.topDepartmentsByDiscussions && data.topDepartmentsByDiscussions.length > 0 ? (
            data.topDepartmentsByDiscussions.map((dept, idx) => (
              <div key={dept.departmentId} className="department-item">
                <span className="rank">{idx + 1}.</span>
                <span className="dept-name">{dept.departmentName}</span>
                <span className="discussion-count">{dept.discussionCount} discussions</span>
              </div>
            ))
          ) : (
            <p>No discussion data available</p>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="dashboard-section">
        <h2>Activity Timeline (Last 7 Days)</h2>
        <div className="timeline">
          {data.activityTimeline && data.activityTimeline.length > 0 ? (
            data.activityTimeline.map((day) => (
              <div key={day._id} className="timeline-item">
                <span className="timeline-date">{day._id}</span>
                <div className="timeline-bar">
                  <div className="timeline-fill" style={{ width: `${day.postCount * 10}px` }} />
                </div>
                <span className="timeline-count">{day.postCount} posts</span>
              </div>
            ))
          ) : (
            <p>No activity data available</p>
          )}
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="dashboard-section">
        <h2>Monthly Summary</h2>
        <div className="monthly-cards">
          <div className="monthly-card">
            <span className="monthly-label">Posts (Last 30 Days)</span>
            <span className="monthly-value">{data.monthlyActivity.postsLastMonth}</span>
          </div>
          <div className="monthly-card">
            <span className="monthly-label">Discussions (Last 30 Days)</span>
            <span className="monthly-value">{data.monthlyActivity.discussionsLastMonth}</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          <button
            className="action-btn"
            onClick={() => navigate("/admin/auditlogs")}
          >
            View Audit Logs
          </button>
          <button
            className="action-btn"
            onClick={() => navigate("/admin/objections")}
          >
            Manage Objections
          </button>
        </div>
      </div>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { adminApi, userApi } from "../lib/api";
import { formatDateTime } from "../lib/util";

function AdminAuditLogs() {
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({
    limit: 20,
    skip: 0,
    actorId: "",
    actionType: "",
    targetType: "",
    routeKey: "",
    requestMethod: "",
    requestId: "",
    actionSummary: "",
    hasTargetId: "",
    minStatus: "",
    maxStatus: "",
    createdAfter: "",
    createdBefore: "",
  });
  const [totalCount, setTotalCount] = useState(0);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await adminApi.getAuditLogs(filters);
      setAuditLogs(response.data?.data || []);
      setTotalCount(response.data?.totalCount || 0);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to fetch audit logs");
    } finally {
      setLoading(false);
    }
  }, [filters, navigate]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await userApi.getMe();
      setCurrentUser(response.data?.data || null);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to fetch user data");
    }
  }, [navigate]);

  useEffect(() => {
    fetchCurrentUser();
    fetchAuditLogs();
  }, [fetchCurrentUser, fetchAuditLogs]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      skip: 0,
    }));
  };

  const handlePageChange = (newSkip) => {
    setFilters((prev) => ({
      ...prev,
      skip: newSkip,
    }));
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    setStatus("");

    try {
      const response = await adminApi.exportAuditLogs(filters);
      const blob = response.blob;
      const fileName = `audit-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to export audit logs");
    } finally {
      setExporting(false);
    }
  }, [filters, navigate]);

  if (currentUser && !["univ_admin"].includes(currentUser.role)) {
    return (
      <main className="post-list-shell">
        <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
        <section className="post-list-content">
          <p className="status-text">Access Denied: You do not have permission to view this page.</p>
        </section>
      </main>
    );
  }

  const totalPages = Math.ceil(totalCount / filters.limit);
  const currentPage = filters.skip / filters.limit + 1;

  const renderPaginationButtons = () => {
    const buttons = [];
    for (let i = 1; i <= totalPages; i++) {
      buttons.push(
        <button
          key={i}
          className={`pagination-button ${currentPage === i ? "active" : ""}`}
          onClick={() => handlePageChange((i - 1) * filters.limit)}
          disabled={loading}
        >
          {i}
        </button>,
      );
    }
    return buttons;
  };

  return (
    <main className="post-list-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />

      <section className="post-list-content">
        <div className="page-headline">
          <h1>Audit Logs</h1>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        <div className="page-filter-row">
          <label>
            Actor:
            <input
              type="text"
              name="actorId"
              value={filters.actorId}
              onChange={handleFilterChange}
              placeholder="Search by user ID..."
            />
          </label>
          <label>
            Action:
            <select name="actionType" value={filters.actionType} onChange={handleFilterChange}>
              <option value="">All</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="ACCESS">ACCESS</option>
            </select>
          </label>
          <label>
            Target:
            <select name="targetType" value={filters.targetType} onChange={handleFilterChange}>
              <option value="">All</option>
              <option value="Post">Post</option>
              <option value="Comment">Comment</option>
              <option value="Discussion">Discussion</option>
              <option value="DiscussionReply">DiscussionReply</option>
              <option value="User">User</option>
              <option value="Department">Department</option>
              <option value="Subscription">Subscription</option>
              <option value="Unknown">Unknown</option>
            </select>
          </label>
          <label>
            Method:
            <select name="requestMethod" value={filters.requestMethod} onChange={handleFilterChange}>
              <option value="">All</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>
          <label>
            Has Target ID:
            <select name="hasTargetId" value={filters.hasTargetId} onChange={handleFilterChange}>
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label>
            Route Key:
            <input
              type="text"
              name="routeKey"
              value={filters.routeKey}
              onChange={handleFilterChange}
              placeholder="e.g. /posts/:id/comments"
            />
          </label>
          <label>
            Request ID:
            <input
              type="text"
              name="requestId"
              value={filters.requestId}
              onChange={handleFilterChange}
              placeholder="x-request-id"
            />
          </label>
          <label>
            Action Summary:
            <input
              type="text"
              name="actionSummary"
              value={filters.actionSummary}
              onChange={handleFilterChange}
              placeholder="contains text"
            />
          </label>
          <label>
            Min Status:
            <input
              type="number"
              name="minStatus"
              value={filters.minStatus}
              onChange={handleFilterChange}
              placeholder="200"
            />
          </label>
          <label>
            Max Status:
            <input
              type="number"
              name="maxStatus"
              value={filters.maxStatus}
              onChange={handleFilterChange}
              placeholder="599"
            />
          </label>
          <label>
            Created After:
            <input
              type="datetime-local"
              name="createdAfter"
              value={filters.createdAfter}
              onChange={handleFilterChange}
            />
          </label>
          <label>
            Created Before:
            <input
              type="datetime-local"
              name="createdBefore"
              value={filters.createdBefore}
              onChange={handleFilterChange}
            />
          </label>
          <label>
            Limit:
            <select name="limit" value={filters.limit} onChange={handleFilterChange}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button
            type="button"
            className="landing-link primary"
            onClick={() => fetchAuditLogs()}
            disabled={loading}
            style={{ margin: 0 }}
          >
            {loading ? "Loading..." : "Apply"}
          </button>
          <button
            type="button"
            className="landing-link secondary"
            onClick={handleExport}
            disabled={loading || exporting}
            style={{ margin: 0 }}
          >
            {exporting ? "Exporting..." : "Export JSON"}
          </button>
        </div>

        {loading ? (
          <p className="feed-muted">Loading audit logs...</p>
        ) : auditLogs.length === 0 ? (
          <p className="feed-muted">No audit logs found.</p>
        ) : (
          <div className="audit-log-list">
            {auditLogs.map((log) => (
              <div key={log._id} className="audit-log-item">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p>
                      <strong>Action:</strong> {log.actionType}
                    </p>
                    <p>
                      <strong>Action Summary:</strong> {log.actionSummary || "N/A"}
                    </p>
                    <p>
                      <strong>Target:</strong> {log.targetType} (ID: {log.targetId || "N/A"})
                    </p>
                    <p>
                      <strong>Actor:</strong> {log.actorId?.name || "Unknown"} ({log.actorRole || "N/A"})
                    </p>
                    <p>
                      <strong>Route:</strong> {log.routeKey || log.requestPath || "N/A"}
                    </p>
                    <p>
                      <strong>Method / Status:</strong> {log.requestMethod || "N/A"} / {log.statusCode || "N/A"}
                    </p>
                    <p>
                      <strong>Request ID:</strong> {log.requestId || "N/A"}
                    </p>
                    <p>
                      <strong>Actor Snapshot:</strong> {log.actorSnapshot?.name || "N/A"} ({log.actorSnapshot?.emailId || "N/A"})
                    </p>
                    <p>
                      <strong>Entity Preview:</strong> {log.entitySnapshot?.title || log.entitySnapshot?.bodyPreview || "N/A"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "12px", color: "var(--muted)" }}>
                    <p style={{ margin: 0 }}>{formatDateTime(log.createdAt || log.timestamp)}</p>
                    <p style={{ margin: "4px 0 0" }}>IP: {log.ipAddress || "N/A"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-button"
              onClick={() => handlePageChange(filters.skip - filters.limit)}
              disabled={loading || filters.skip === 0}
            >
              Previous
            </button>
            {renderPaginationButtons()}
            <button
              className="pagination-button"
              onClick={() => handlePageChange(filters.skip + filters.limit)}
              disabled={loading || filters.skip + filters.limit >= totalCount}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminAuditLogs;

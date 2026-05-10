import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { adminApi, postApi, userApi } from "../lib/api";
import { formatDateTime } from "../lib/util";

const statusLabel = (status) => String(status || "").replace(/_/g, " ");

function AdminObjectionManagement() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [flags, setFlags] = useState({ comments: [], discussions: [] });
  const [viewMode, setViewMode] = useState('objections');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState({
    limit: 20,
    skip: 0,
    status: "objected",
  });
  const [totalCount, setTotalCount] = useState(0);
  const [busyPostId, setBusyPostId] = useState("");

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

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await adminApi.getObjections(filters);
      setPosts(response.data?.data || []);
      setTotalCount(response.data?.totalCount || 0);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to fetch objection posts");
    } finally {
      setLoading(false);
    }
  }, [filters, navigate]);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await adminApi.getFlags({ limit: filters.limit, skip: filters.skip });
      setFlags(response.data?.data || { comments: [], discussions: [] });
      setTotalCount(response.data?.totalCount || 0);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to fetch flagged content");
    } finally {
      setLoading(false);
    }
  }, [filters, navigate]);

  useEffect(() => {
    fetchCurrentUser();
    fetchPosts();
    fetchFlags();
  }, [fetchCurrentUser, fetchPosts]);

  const canAdminister = useMemo(
    () => currentUser && ["dept_admin", "univ_admin"].includes(currentUser.role),
    [currentUser],
  );

  const handlePageChange = (newSkip) => {
    setFilters((prev) => ({
      ...prev,
      skip: newSkip,
    }));
  };

  const handleResolvePost = async (postId, objectionId = null) => {
    if (busyPostId) {
      return;
    }

    setBusyPostId(postId);
    setStatus("");

    try {
      const payload = objectionId ? { objectionId } : {};
      await postApi.resolveObjection(postId, payload);
      await fetchPosts();
      setStatus(objectionId ? "Objection resolved." : "All objections resolved.");
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to resolve objection right now");
    } finally {
      setBusyPostId("");
    }
  };

  const handleApproveFlag = async (type, id) => {
    setStatus("");
    try {
      await adminApi.approveFlag(type, id);
      await fetchFlags();
      setStatus('Item approved and restored');
    } catch (error) {
      setStatus(error.message || 'Unable to approve flag');
    }
  };

  const handleRejectFlag = async (type, id, hard = false) => {
    setStatus("");
    try {
      await adminApi.rejectFlag(type, id, { hard });
      await fetchFlags();
      setStatus('Item rejected');
    } catch (error) {
      setStatus(error.message || 'Unable to reject flag');
    }
  };

  const totalPages = Math.ceil(totalCount / filters.limit);
  const currentPage = filters.skip / filters.limit + 1;

  const renderContent =
    viewMode === 'objections'
      ? (loading ? (
          <p className="feed-muted">Loading objections...</p>
        ) : posts.length === 0 ? (
          <p className="feed-muted">No posts with unresolved objections.</p>
        ) : (
          <div className="audit-log-list">
            {posts.map((post) => {
              const unresolvedCount = (post.objections || []).filter((obj) => !obj.isResolved).length;
              return (
                <article key={post._id} className="audit-log-item">
                  <div style={{ marginBottom: 12 }}>
                    <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 600 }}>
                      {post.title}
                    </h3>
                    <p style={{ margin: "0 0 6px", fontSize: "13px", color: "var(--muted)" }}>
                      by {post.author?.name || "Unknown"} • {post.department?.deptName || "N/A"}
                    </p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="status-badge official">{statusLabel(post.status)}</span>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {unresolvedCount} unresolved objection{unresolvedCount === 1 ? "" : "s"} • {post.objections?.length || 0} total
                      </span>
                    </div>
                  </div>

                  {post.objections && post.objections.length > 0 && (
                    <div style={{ marginLeft: 12, borderLeft: "2px solid var(--border)", paddingLeft: 12, marginBottom: 12 }}>
                      {post.objections.map((objection) => (
                        <div
                          key={objection._id}
                          className="objection-section"
                          style={{ background: objection.isResolved ? "rgba(122, 112, 96, 0.06)" : "#fff" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: "0 0 4px", fontSize: "13px" }}>
                                <strong>{objection.raisedBy?.name || "User"}</strong> on {" "}
                                {formatDateTime(objection.raisedAt)}
                              </p>
                              <p style={{ margin: "0 0 6px", fontSize: "13px", color: "var(--text)" }}>
                                {objection.reason}
                              </p>
                              <span className={`status-badge ${objection.isResolved ? "resolved" : "pending"}`}>
                                {objection.isResolved ? "Resolved" : "Unresolved"}
                              </span>
                            </div>
                            {!objection.isResolved && (
                              <button
                                type="button"
                                className="landing-link secondary"
                                onClick={() => handleResolvePost(post._id, objection._id)}
                                disabled={busyPostId === post._id}
                                style={{ fontSize: "12px", padding: "6px 10px", height: "fit-content" }}
                              >
                                {busyPostId === post._id ? "..." : "Resolve"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="action-row">
                    <button type="button" className="landing-link secondary" onClick={() => navigate(`/app/posts/${post._id}`)}>
                      View Post
                    </button>
                    {unresolvedCount > 0 && (
                      <button
                        type="button"
                        className="landing-link primary"
                        onClick={() => handleResolvePost(post._id)}
                        disabled={busyPostId === post._id}
                      >
                        {busyPostId === post._id ? "Resolving..." : "Resolve All"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ))
      : (loading ? (
          <p className="feed-muted">Loading flagged content...</p>
        ) : ((flags.comments?.length || flags.discussions?.length) === 0 ? (
          <p className="feed-muted">No flagged content.</p>
        ) : (
          <div className="audit-log-list">
            {(flags.comments || []).map((c) => (
              <article key={`c-${c._id}`} className="audit-log-item">
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 14 }}><strong>Comment</strong> by {c.author?.name || 'Unknown'} • {formatDateTime(c.flaggedAt)}</p>
                  <p style={{ margin: '6px 0', color: 'var(--text)' }}>{(c.body || '').slice(0, 300)}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="status-badge">Flagged</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Score: {c.toxicityScore || 0}</span>
                  </div>
                </div>
                <div className="action-row">
                  <button type="button" className="landing-link secondary" onClick={() => navigate(`/app/posts/${c.post}`)}>View Post</button>
                  <button type="button" className="landing-link primary" onClick={() => handleApproveFlag('comment', c._id)}>Approve</button>
                  <button type="button" className="landing-link danger" onClick={() => handleRejectFlag('comment', c._id, false)}>Reject</button>
                </div>
              </article>
            ))}

            {(flags.discussions || []).map((d) => (
              <article key={`d-${d._id}`} className="audit-log-item">
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0, fontSize: 14 }}><strong>Discussion Reply</strong> by {d.author?.name || 'Unknown'} • {formatDateTime(d.flaggedAt)}</p>
                  <p style={{ margin: '6px 0', color: 'var(--text)' }}>{(d.body || '').slice(0, 300)}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className="status-badge">Flagged</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Score: {d.toxicityScore || 0}</span>
                  </div>
                </div>
                <div className="action-row">
                  <button type="button" className="landing-link secondary" onClick={() => navigate(`/app/discussions/${d.discussion}`)}>View Discussion</button>
                  <button type="button" className="landing-link primary" onClick={() => handleApproveFlag('discussion', d._id)}>Approve</button>
                  <button type="button" className="landing-link danger" onClick={() => handleRejectFlag('discussion', d._id, false)}>Reject</button>
                </div>
              </article>
            ))}
          </div>
        )))

  const renderPaginationButtons = () => {
    const buttons = [];
    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
      buttons.push(
        <button
          key={pageIndex}
          className={`pagination-button ${currentPage === pageIndex ? "active" : ""}`}
          onClick={() => handlePageChange((pageIndex - 1) * filters.limit)}
          disabled={loading}
        >
          {pageIndex}
        </button>,
      );
    }
    return buttons;
  };

  if (currentUser && !canAdminister) {
    return (
      <main className="post-list-shell">
        <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
        <section className="post-list-content">
          <p className="status-text">Access Denied: You do not have permission to view this page.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="post-list-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />

      <section className="post-list-content">
        <div className="page-headline">
          <h1>Objection Management</h1>
          <p>Review posts with unresolved objections and take action.</p>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        <div className="page-filter-row">
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`landing-link ${viewMode === 'objections' ? 'primary' : 'secondary'}`}
              onClick={() => setViewMode('objections')}
              disabled={loading}
            >
              Objections
            </button>
            <button
              type="button"
              className={`landing-link ${viewMode === 'flags' ? 'primary' : 'secondary'}`}
              onClick={() => setViewMode('flags')}
              disabled={loading}
            >
              Flagged Content
            </button>
            <button
              type="button"
              className="landing-link primary"
              onClick={() => { fetchPosts(); fetchFlags(); }}
              disabled={loading}
              style={{ margin: 0 }}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {renderContent}

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

export default AdminObjectionManagement;
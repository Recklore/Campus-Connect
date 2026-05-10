import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import avatarImage from "../assets/curaj.jpg";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { departmentApi, userApi, postApi } from "../lib/api";

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }

  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

function DepartmentProfileView() {
  const navigate = useNavigate();
  const { departmentId } = useParams();
  const [currentUser, setCurrentUser] = useState(null);
  const [department, setDepartment] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [togglingSubscription, setTogglingSubscription] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  const canLoadMore = Boolean(nextCursor);

  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const response = await departmentApi.getSubscriptions();
      const subscriptions = response.data?.data || [];
      const subscribed = subscriptions.some((sub) => sub._id === departmentId);
      setIsSubscribed(subscribed);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to fetch subscription status");
    }
  }, [departmentId, navigate]);

  const handleToggleSubscription = async () => {
    if (togglingSubscription) {
      return;
    }

    setTogglingSubscription(true);
    setStatus("");

    try {
      const action = isSubscribed ? "unsubscribe" : "subscribe";
      const response = await departmentApi.toggleSubscription(departmentId, action);
      setIsSubscribed(response.data?.subscribed || false);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to toggle subscription");
    } finally {
      setTogglingSubscription(false);
    }
  };

  const loadPosts = useCallback(
    async ({ reset = false, cursor } = {}) => {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setStatus("");

      try {
        const response = await postApi.getDepartmentPosts({
          departmentId,
          cursor,
        });

        const incoming = response.data?.data || [];
        setPosts((prev) => (reset ? incoming : [...prev, ...incoming]));
        setNextCursor(response.data?.nextCursor || null);
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        setStatus(error.message || "Unable to load department posts right now");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [departmentId, navigate],
  );

  const handleLoadMore = async () => {
    if (!canLoadMore || loadingMore) {
      return;
    }

    await loadPosts({ cursor: nextCursor });
  };

  useEffect(() => {
    const loadDepartment = async () => {
      try {
        const meResponse = await userApi.getMe();
        setCurrentUser(meResponse.data?.data || null);

        const deptResponse = await departmentApi.getById(departmentId);
        setDepartment(deptResponse.data?.data || null);
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        if (error.status === 404) {
          setStatus("Department not found");
        } else {
          setStatus(error.message || "Unable to load department profile");
        }
      } finally {
        setLoading(false);
      }
    };

    loadDepartment();
    fetchSubscriptionStatus();
    loadPosts({ reset: true });
  }, [departmentId, navigate, fetchSubscriptionStatus, loadPosts]);

  return (
    <main className="profile-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
      <section className="profile-content">
        <div className="profile-headline">
          <h1>Department Profile</h1>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        {loading && department === null ? (
          <p className="feed-muted">Loading department...</p>
        ) : department ? (
          <div className="profile-layout">
            <section className="profile-hero">
              <div className="profile-avatar-wrap">
                <img
                  src={department.displayImage || avatarImage}
                  alt={department.deptName}
                  className="profile-avatar"
                />
              </div>
              <div className="profile-hero-info">
                <div className="profile-hero-top">
                  <h2>{department.deptName}</h2>
                  <span className="profile-role-badge">{department.deptCode}</span>
                </div>
                <div className="profile-stats">
                  <div className="profile-stat">
                    <strong>{Number(department.subscriberCount || 0)}</strong>
                    <span>Subscribers</span>
                  </div>
                  <div className="profile-stat">
                    <strong>{posts.length || Number(department.postCount || 0)}</strong>
                    <span>Posts</span>
                  </div>
                </div>
                <div className="profile-meta-list">
                  <span>{department.school || "Campus School"}</span>
                </div>
                <div className="profile-dept-tag">
                  <span>{department.description || "Official department profile"}</span>
                </div>
                <button
                  type="button"
                  className="landing-link primary"
                  onClick={handleToggleSubscription}
                  disabled={togglingSubscription}
                >
                  {togglingSubscription
                    ? "Loading..."
                    : isSubscribed
                      ? "Unsubscribe"
                      : "Subscribe"}
                </button>
              </div>
            </section>

            <section className="profile-sections">
              <article className="profile-section">
                <div className="profile-section-head">
                  <h3>Posts</h3>
                </div>
                {posts.length === 0 && !loading ? (
                  <p className="feed-muted">No official posts published yet.</p>
                ) : (
                  <div className="post-list-grid">
                    {posts.map((post) => (
                      <article className="post-list-card" key={post._id}>
                        <div>
                          <p className="post-list-meta">
                            {post.createdAt ? formatDateTime(post.createdAt) : ""}
                          </p>
                          <h3>{post.title}</h3>
                          <span className="post-status">{post.status?.replace(/_/g, " ") || "official"}</span>
                        </div>
                        <div className="post-list-footer">
                          <span>
                            {post.likeCount || 0} likes · {post.commentCount || 0} comments
                          </span>
                          <button
                            type="button"
                            className="landing-link secondary"
                            onClick={() => navigate(`/app/posts/${post._id}`)}
                          >
                            View
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {canLoadMore ? (
                  <button
                    type="button"
                    className="landing-link secondary"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                ) : null}
              </article>
            </section>
          </div>
        ) : (
          <p className="feed-muted">Department data is unavailable.</p>
        )}
      </section>
    </main>
  );
}

export default DepartmentProfileView;

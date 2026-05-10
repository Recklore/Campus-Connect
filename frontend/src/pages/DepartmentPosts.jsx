import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { departmentApi, postApi, userApi } from "../lib/api";

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

function DepartmentPosts() {
  const navigate = useNavigate();
  const { departmentId } = useParams();
  const [posts, setPosts] = useState([]);
  const [department, setDepartment] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [togglingSubscription, setTogglingSubscription] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

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

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await userApi.getMe();
        setUserProfile(response.data?.data || null);
      } catch (error) {
        if (error.status !== 401) {
          console.error("Failed to load user profile", error);
        }
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const loadDepartment = async () => {
      try {
        const response = await departmentApi.getAll();
        const grouped = response.data?.data || {};
        const flattened = Object.values(grouped).flatMap((items) => items || []);
        const match = flattened.find((item) => item._id === departmentId);
        setDepartment(match || null);
      } catch {
        setDepartment(null);
      }
    };

    loadDepartment();
    fetchSubscriptionStatus();
    loadPosts({ reset: true });
  }, [departmentId, loadPosts, fetchSubscriptionStatus]);

  const handleLoadMore = async () => {
    if (!canLoadMore || loadingMore) {
      return;
    }

    await loadPosts({ cursor: nextCursor });
  };


  const headline = useMemo(() => {
    if (department?.deptName) {
      return department.deptName;
    }
    return "Department posts";
  }, [department]);

  return (
    <main className="post-list-shell">
      <AuthenticatedHeader userProfile={userProfile} hideOnScroll={false} />

      <section className="post-list-content">
        <div className="post-list-head">
          <h1>{headline}</h1>
          <p>{department?.school || "Campus updates and official announcements."}</p>
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

        {status ? <p className="status-text">{status}</p> : null}

        {loading && posts.length === 0 ? <p className="feed-muted">Loading posts...</p> : null}

        <div className="post-list-grid">
          {posts.map((post) => (
            <article className="post-list-card" key={post._id}>
              <div>
                <p className="post-list-meta">
                  {post.department?.deptName || department?.deptName || "Department"}
                  {post.createdAt ? ` • ${formatDateTime(post.createdAt)}` : ""}
                </p>
                <h3>{post.title}</h3>
                <span className="post-status">{post.status?.replace(/_/g, " ") || "official"}</span>
              </div>
              <div className="post-list-footer">
                <span>
                  {post.likeCount || 0} likes · {post.commentCount || 0} comments
                </span>
                <div style={{ marginLeft: "auto" }}>
                  <button
                    type="button"
                    className="landing-link secondary"
                    onClick={() => navigate(`/app/posts/${post._id}`)}
                  >
                    View
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {posts.length === 0 && !loading ? (
          <p className="feed-muted">No official posts published yet.</p>
        ) : null}

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
      </section>
    </main>
  );
}

export default DepartmentPosts;

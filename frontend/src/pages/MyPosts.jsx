import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { postApi, userApi } from "../lib/api";

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

const statusLabel = (status) => {
  if (!status) {
    return "Draft";
  }

  return status.replace(/_/g, " ");
};

function MyPosts() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");
  const [userProfile, setUserProfile] = useState(null);

  const hasPosts = posts.length > 0;
  const canLoadMore = Boolean(nextCursor);

  const loadPosts = useCallback(
    async ({ reset = false, cursor } = {}) => {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setStatus("");

      try {
        const response = await postApi.getMyPosts({ cursor });
        const incoming = response.data?.data || [];

        setPosts((prev) => (reset ? incoming : [...prev, ...incoming]));
        setNextCursor(response.data?.nextCursor || null);
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        if (error.status === 403) {
          setPosts([]);
          setNextCursor(null);
          setStatus("Only senior staff can view this page right now.");
          return;
        }
        setStatus(error.message || "Unable to load your posts right now");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [navigate],
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
    loadPosts({ reset: true });
  }, [loadPosts]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    await loadPosts({ cursor: nextCursor });
  };


  const emptyState = useMemo(() => {
    if (loading) {
      return "Loading your posts...";
    }
    return "No posts created yet.";
  }, [loading]);

  return (
    <main className="post-list-shell">
      <AuthenticatedHeader userProfile={userProfile} hideOnScroll={false} />

      <section className="post-list-content">
        <div className="post-list-head">
          <h1>My posts</h1>
          <p>Review your announcements and their status.</p>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        {!hasPosts ? <p className="feed-muted">{emptyState}</p> : null}

        <div className="post-list-grid">
          {posts.map((post) => (
            <article className="post-list-card" key={post._id}>
              <div>
                <p className="post-list-meta">
                  {post.department?.deptName || "Department"}
                  {post.createdAt ? ` • ${formatDateTime(post.createdAt)}` : ""}
                </p>
                <h3>{post.title}</h3>
                <span className={`post-status ${post.status || "draft"}`}>
                  {statusLabel(post.status)}
                </span>
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

export default MyPosts;

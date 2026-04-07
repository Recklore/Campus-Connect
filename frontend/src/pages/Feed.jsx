import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import avatarImage from "../assets/curaj.jpg";
import Brand from "../components/common/Brand";
import { postApi } from "../lib/api";
import { logoutSession } from "../lib/authSession";

const FEED_SCOPE = {
  GENERAL: "general",
  PERSONAL: "personal",
};

function LikeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="feed-action-icon">
      <path d="M12 20.25c-.39 0-.77-.14-1.08-.41l-6.4-5.62a4.5 4.5 0 0 1 6.36-6.36L12 8.96l1.12-1.1a4.5 4.5 0 0 1 6.36 6.36l-6.4 5.62c-.31.27-.69.41-1.08.41z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="feed-action-icon">
      <path d="M6 5.25h12A2.75 2.75 0 0 1 20.75 8v7A2.75 2.75 0 0 1 18 17.75H10.4l-4.43 3.14A.75.75 0 0 1 4.75 20v-2.46A2.75 2.75 0 0 1 3.25 15V8A2.75 2.75 0 0 1 6 5.25z" />
    </svg>
  );
}

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }

  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

const isImageAttachment = (attachment) =>
  String(attachment?.mimeType || "")
    .toLowerCase()
    .startsWith("image/");

const resolveAttachmentImage = (attachment) => {
  const storedName = String(attachment?.storedName || "").trim();
  if (/^https?:\/\//i.test(storedName)) {
    return storedName;
  }
  return avatarImage;
};

const normalizeFeedPosts = (payload) =>
  Array.isArray(payload?.data) ? payload.data : [];

function Feed() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [activeScope, setActiveScope] = useState(FEED_SCOPE.GENERAL);
  const [canSwitchScope, setCanSwitchScope] = useState(false);
  const [hasSubscriptions, setHasSubscriptions] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [attachmentIndexByPost, setAttachmentIndexByPost] = useState({});
  const [likedPostIds, setLikedPostIds] = useState({});
  const [commentTapByPost, setCommentTapByPost] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");
  const [hideTopUi, setHideTopUi] = useState(false);

  const loadFeed = useCallback(
    async ({ reset = false, scope, cursor } = {}) => {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setStatus("");

      try {
        const response = await postApi.getFeed({
          scope,
          cursor,
        });

        const payload = response.data || {};
        const incomingPosts = normalizeFeedPosts(payload);

        setPosts((prev) => (reset ? incomingPosts : [...prev, ...incomingPosts]));
        setNextCursor(payload.nextCursor || null);
        setActiveScope(payload.feedScope || FEED_SCOPE.GENERAL);
        setCanSwitchScope(Boolean(payload.canSwitchScope));
        setHasSubscriptions(payload.hasSubscriptions !== false);

        if (reset) {
          setAttachmentIndexByPost({});
          setLikedPostIds({});
          setCommentTapByPost({});
        }
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        setStatus(error.message || "Unable to load feed right now");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    loadFeed({ reset: true });
  }, [loadFeed]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 20) {
        setHideTopUi(false);
      } else if (currentScrollY > lastScrollY && currentScrollY > 96) {
        setHideTopUi(true);
      } else if (currentScrollY < lastScrollY) {
        setHideTopUi(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSwitchScope = async (scope) => {
    if (scope === activeScope || loading) {
      return;
    }

    await loadFeed({ reset: true, scope });
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    await loadFeed({ reset: false, scope: activeScope, cursor: nextCursor });
  };

  const handleLogout = async () => {
    await logoutSession();
    navigate("/auth/login", { replace: true });
  };

  const handleLikeToggle = (postId) => {
    setLikedPostIds((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const handleCommentTap = (postId) => {
    setCommentTapByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] || 0) + 1,
    }));
  };

  const shiftAttachment = (postId, direction, total) => {
    if (total <= 1) {
      return;
    }

    setAttachmentIndexByPost((prev) => {
      const current = prev[postId] || 0;
      const next = (current + direction + total) % total;
      return {
        ...prev,
        [postId]: next,
      };
    });
  };

  const emptyMessage = useMemo(() => {
    if (activeScope === FEED_SCOPE.PERSONAL && !hasSubscriptions) {
      return "You are not subscribed to any departments yet. Visit Departments to personalize your feed.";
    }

    return "No posts available right now.";
  }, [activeScope, hasSubscriptions]);

  return (
    <main className="feed-shell">
      <header className={`landing-topbar feed-page-topbar ${hideTopUi ? "is-hidden" : ""}`}>
        <div className="landing-topbar-inner">
          <Brand />
          <div className="landing-top-actions" aria-label="Feed actions">
            <button
              type="button"
              className="landing-link secondary feed-header-btn"
              onClick={() => navigate("/app/departments")}
            >
              Departments
            </button>
            <button
              type="button"
              className="landing-link feed-header-btn feed-header-logout"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {canSwitchScope ? (
        <div className={`feed-scope-rail ${hideTopUi ? "is-hidden" : ""}`}>
          <div className="feed-scope-switch" role="tablist" aria-label="Feed scope">
            <button
              type="button"
              className={`feed-scope-btn ${activeScope === FEED_SCOPE.PERSONAL ? "active" : ""}`}
              onClick={() => handleSwitchScope(FEED_SCOPE.PERSONAL)}
              disabled={loading}
            >
              Personal
            </button>
            <button
              type="button"
              className={`feed-scope-btn ${activeScope === FEED_SCOPE.GENERAL ? "active" : ""}`}
              onClick={() => handleSwitchScope(FEED_SCOPE.GENERAL)}
              disabled={loading}
            >
              General
            </button>
          </div>
        </div>
      ) : null}

      <section className="feed-content-wrap">
        {status ? <p className="status-text">{status}</p> : null}

        {loading ? <p className="feed-muted">Loading feed...</p> : null}

        {!loading && posts.length === 0 ? <p className="feed-muted">{emptyMessage}</p> : null}

        <div className="feed-list">
          {posts.map((post) => {
            const attachments = Array.isArray(post.attachment) ? post.attachment : [];
            const totalAttachments = attachments.length;
            const activeAttachmentIndex = Math.min(
              attachmentIndexByPost[post._id] || 0,
              Math.max(0, totalAttachments - 1),
            );
            const activeAttachment = attachments[activeAttachmentIndex] || null;
            const liked = Boolean(likedPostIds[post._id]);
            const baseLikeCount = Number(post.likeCount || 0);
            const likeCount = baseLikeCount + (liked ? 1 : 0);
            const commentCount = Number(post.commentCount || 0) + Number(commentTapByPost[post._id] || 0);

            return (
              <article className="feed-post-card" key={post._id}>
                <header className="feed-author-row">
                  <img src={avatarImage} alt="Author profile" className="feed-author-avatar" loading="lazy" />
                  <div>
                    <h3>{post.author?.name || "Campus Author"}</h3>
                    <p>
                      {[post.author?.role, post.author?.designation].filter(Boolean).join(" • ") ||
                        "Campus contributor"}
                    </p>
                  </div>
                </header>

                <div className="feed-post-meta">
                  <p>
                    {post.department?.deptName || "Department"}
                    {post.department?.school ? ` • ${post.department.school}` : ""}
                  </p>
                  <span>{formatDateTime(post.createdAt)}</span>
                </div>

                <h2>{post.title || "Official update"}</h2>
                <p className="feed-post-body">{post.body || "No details available."}</p>

                <section className="feed-attachment-box">
                  {activeAttachment ? (
                    isImageAttachment(activeAttachment) ? (
                      <img
                        src={resolveAttachmentImage(activeAttachment)}
                        alt={activeAttachment.originalName || "Post attachment"}
                        className="feed-attachment-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="feed-attachment-file" role="img" aria-label="Non-image attachment">
                        <p>Attachment</p>
                        <h4>{activeAttachment.originalName || "Document"}</h4>
                        <span>{activeAttachment.mimeType || "application/octet-stream"}</span>
                      </div>
                    )
                  ) : (
                    <div className="feed-attachment-file" role="img" aria-label="No attachment available">
                      <p>Attachment</p>
                      <h4>No attachment</h4>
                      <span>Not available for this post</span>
                    </div>
                  )}

                  {totalAttachments > 1 ? (
                    <div className="feed-attachment-controls">
                      <button
                        type="button"
                        className="feed-attachment-nav"
                        onClick={() => shiftAttachment(post._id, -1, totalAttachments)}
                      >
                        Prev
                      </button>
                      <div className="feed-attachment-dots" role="tablist" aria-label="Attachment slides">
                        {attachments.map((attachment, index) => (
                          <button
                            key={`${post._id}-${attachment.storedName || attachment.originalName || index}`}
                            type="button"
                            className={`feed-attachment-dot ${index === activeAttachmentIndex ? "active" : ""}`}
                            onClick={() =>
                              setAttachmentIndexByPost((prev) => ({
                                ...prev,
                                [post._id]: index,
                              }))
                            }
                            aria-label={`Show attachment ${index + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        className="feed-attachment-nav"
                        onClick={() => shiftAttachment(post._id, 1, totalAttachments)}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </section>

                <div className="feed-action-row">
                  <button
                    type="button"
                    className={`feed-action-btn ${liked ? "active" : ""}`}
                    onClick={() => handleLikeToggle(post._id)}
                  >
                    <span className="feed-action-main">
                      <LikeIcon />
                      <span>{liked ? "Liked" : "Like"}</span>
                    </span>
                    <span className="feed-action-count">{likeCount}</span>
                  </button>
                  <button
                    type="button"
                    className="feed-action-btn"
                    onClick={() => handleCommentTap(post._id)}
                  >
                    <span className="feed-action-main">
                      <CommentIcon />
                      <span>Comment</span>
                    </span>
                    <span className="feed-action-count">{commentCount}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && nextCursor ? (
          <button
            type="button"
            className="feed-load-more"
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

export default Feed;

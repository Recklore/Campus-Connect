import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import avatarImage from "../assets/curaj.jpg";
import { postApi, userApi } from "../lib/api";
import { logoutSession } from "../lib/authSession";
import CommentItem from "../components/common/CommentItem";
import { formatDateTime } from "../lib/util";

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

function PostDetail() {
  const navigate = useNavigate();
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentCursor, setCommentCursor] = useState(null);
  const [commentBody, setCommentBody] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [objectionReason, setObjectionReason] = useState("");
  const [raisingObjection, setRaisingObjection] = useState(false);
  const [resolvingObjection, setResolvingObjection] = useState(false);
  const [objectionReplies, setObjectionReplies] = useState({});
  const [loadingObjectionReplies, setLoadingObjectionReplies] = useState({});
  const [objectionReplyDrafts, setObjectionReplyDrafts] = useState({});
  const [postingObjectionReplyFor, setPostingObjectionReplyFor] = useState(null);
  const [timeLeftForReview, setTimeLeftForReview] = useState(null);
  const [status, setStatus] = useState("");

  const canEngageWithPost = post?.status === "official";
  const canLoadMoreComments = Boolean(commentCursor);

  const formatTimeLeft = (milliseconds) => {
    if (milliseconds <= 0) {
      return "00:00:00";
    }
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ].join(":");
  };

  const loadPost = useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const [postResponse, userResponse] = await Promise.all([
        postApi.getPost(postId),
        userApi.getMe(),
      ]);
      setPost(postResponse.data?.data || null);
      setCurrentUser(userResponse.data?.data || null);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to load this post right now");
    } finally {
      setLoading(false);
    }
  }, [navigate, postId]);

  const loadComments = useCallback(
    async ({ reset = false } = {}) => {
      if (loadingComments) {
        return;
      }

      setLoadingComments(true);
      setStatus("");

      try {
        const response = await postApi.getComments({
          postId,
          cursor: reset ? null : commentCursor,
        });

        const incoming = response.data?.data || [];
        const nextCursor = response.data?.nextCursor || null;

        setComments((prev) => (reset ? incoming : [...prev, ...incoming]));
        setCommentCursor(nextCursor);
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        setStatus(error.message || "Unable to load comments right now");
      } finally {
        setLoadingComments(false);
      }
    },
    [commentCursor, loadingComments, navigate, postId],
  );

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  useEffect(() => {
    if (!post || post.status !== "official") {
      setComments([]);
      setCommentCursor(null);
      return;
    }

    loadComments({ reset: true });
  }, [loadComments, post]);

  useEffect(() => {
    if (post?.status === "under_review" && post?.reviewExpiresAt) {
      const calculateTimeLeft = () => {
        const now = new Date();
        const expiry = new Date(post.reviewExpiresAt);
        const difference = expiry.getTime() - now.getTime();
        setTimeLeftForReview(difference > 0 ? difference : 0);
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);

      return () => clearInterval(timer);
    } else {
      setTimeLeftForReview(null);
    }
  }, [post]);

  const handleToggleLike = async () => {
    if (!post) {
      return;
    }

    try {
      const response = await postApi.toggleLike(post._id);
      const liked = Boolean(response.data?.liked);
      const likeCount = Number(response.data?.likeCount || 0);

      setPost((prev) =>
        prev
          ? {
              ...prev,
              likedByUser: liked,
              likeCount,
            }
          : prev,
      );
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to update like right now");
    }
  };

  const handleAddComment = async (event) => {
    event.preventDefault();

    if (!commentBody.trim()) {
      setStatus("Please add a comment first.");
      return;
    }

    setSavingComment(true);
    setStatus("");

    try {
      const response = await postApi.addComment(postId, {
        body: commentBody.trim(),
      });

      const newComment = response.data?.data;
      if (newComment) {
        setComments((prev) => [newComment, ...prev]);
        setPost((prev) =>
          prev
            ? {
                ...prev,
                commentCount: Number(prev.commentCount || 0) + 1,
              }
            : prev,
        );
      }
      setCommentBody("");
      setReplyingToCommentId(null);
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to add comment right now");
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await postApi.deleteComment(postId, commentId);
      setComments((prev) => prev.filter((comment) => comment._id !== commentId));
      setPost((prev) =>
        prev
          ? {
              ...prev,
              commentCount: Math.max(Number(prev.commentCount || 0) - 1, 0),
            }
          : prev,
      );
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to delete comment right now");
    }
  };

  const handleMarkCommentAsOfficial = async (commentId) => {
    try {
      const response = await postApi.markCommentAsOfficial(postId, commentId);
      const updatedComment = response.data?.data;
      if (updatedComment) {
        setComments((prev) =>
          prev.map((comment) =>
            comment._id === updatedComment._id ? updatedComment : comment,
          ),
        );
      }
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to update comment status right now");
    }
  };

  const handleToggleCommentVisibility = async (commentId) => {
    try {
      const response = await postApi.toggleCommentVisibility(postId, commentId);
      const updatedComment = response.data?.data;
      if (updatedComment) {
        setComments((prev) =>
          prev.map((comment) =>
            comment._id === updatedComment._id ? updatedComment : comment,
          ),
        );
      }
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to toggle comment visibility right now");
    }
  };


  const canDeleteComment = useCallback(
    (comment) => {
      if (!currentUser) {
        return false;
      }

      if (String(comment?.author?._id) === String(currentUser._id)) {
        return true;
      }

      return ["dept_admin", "univ_admin"].includes(currentUser.role);
    },
    [currentUser],
  );

  const handleRaiseObjection = async (event) => {
    event.preventDefault();

    if (!objectionReason.trim()) {
      setStatus("Please provide a reason for the objection.");
      return;
    }

    setRaisingObjection(true);
    setStatus("");

    try {
      const response = await postApi.raiseObjection(postId, { reason: objectionReason.trim() });
      setPost(response.data?.data || null);
      setObjectionReason("");
      setStatus("Objection raised successfully!");
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to raise objection right now");
    } finally {
      setRaisingObjection(false);
    }
  };

  const handleResolveObjection = async (objectionId = null) => {
    if (resolvingObjection) {
      return;
    }

    setResolvingObjection(true);
    setStatus("");

    try {
      const payload = objectionId ? { objectionId } : {};
      const response = await postApi.resolveObjection(postId, payload);
      setPost(response.data?.data || null);
      setStatus("Objection(s) resolved successfully!");
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to resolve objection(s) right now");
    } finally {
      setResolvingObjection(false);
    }
  };

  const canReplyToObjection = useCallback(
    (objection) => {
      if (!currentUser || !post || !objection) {
        return false;
      }

      const isPrivileged = ["senior_dept_admin", "univ_admin"].includes(currentUser.role);
      return isPrivileged && !objection.isResolved;
    },
    [currentUser, post],
  );

  const loadObjectionReplies = useCallback(
    async (objectionId) => {
      if (!objectionId) {
        return;
      }

      setLoadingObjectionReplies((prev) => ({ ...prev, [objectionId]: true }));
      try {
        const response = await postApi.getObjectionReplies(postId, objectionId);
        setObjectionReplies((prev) => ({
          ...prev,
          [objectionId]: response.data?.data || [],
        }));
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        setStatus(error.message || "Unable to load objection replies right now");
      } finally {
        setLoadingObjectionReplies((prev) => ({ ...prev, [objectionId]: false }));
      }
    },
    [navigate, postId],
  );

  const handleAddObjectionReply = async (objectionId) => {
    const draft = String(objectionReplyDrafts[objectionId] || "").trim();
    if (!draft) {
      setStatus("Please write a reply first.");
      return;
    }

    setPostingObjectionReplyFor(objectionId);
    setStatus("");

    try {
      const response = await postApi.addObjectionReply(postId, objectionId, { content: draft });
      const newReply = response.data?.data;
      if (newReply) {
        setObjectionReplies((prev) => ({
          ...prev,
          [objectionId]: [...(prev[objectionId] || []), newReply],
        }));
      }
      setObjectionReplyDrafts((prev) => ({ ...prev, [objectionId]: "" }));
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to add objection reply right now");
    } finally {
      setPostingObjectionReplyFor(null);
    }
  };

  const attachmentList = useMemo(() => post?.attachment || [], [post]);

  useEffect(() => {
    if (!post?.objections?.length) {
      setObjectionReplies({});
      setLoadingObjectionReplies({});
      setObjectionReplyDrafts({});
      return;
    }

    post.objections.forEach((objection) => {
      loadObjectionReplies(objection._id);
    });
  }, [loadObjectionReplies, post]);

  return (
    <main className="post-detail-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />

      <section className="post-detail-content">
        {status ? <p className="status-text">{status}</p> : null}

        {loading ? (
          <p className="feed-muted">Loading post...</p>
        ) : post ? (
          <article className="post-detail-card">
            <div className="post-detail-head">
              <p className="post-detail-meta">
                {post.department?.deptName || "Department"}
                {post.createdAt ? ` • ${formatDateTime(post.createdAt)}` : ""}
              </p>
              <h1>{post.title}</h1>
              <span className="post-status">{post.status?.replace(/_/g, " ") || "official"}</span>
              <p className="post-detail-author">
                {post.author?.name || "Faculty"}
                {post.author?.designation ? ` • ${post.author.designation}` : ""}
              </p>
            </div>

            <p className="post-detail-body">{post.body}</p>

            {attachmentList.length > 0 ? (
              <div className="post-detail-attachments">
                {attachmentList.map((attachment, index) => (
                  <article
                    key={`${attachment.originalName}-${index}`}
                    className="post-attachment-card"
                  >
                    {isImageAttachment(attachment) ? (
                      <img
                        src={resolveAttachmentImage(attachment)}
                        alt={attachment.originalName}
                      />
                    ) : (
                      <div className="post-attachment-file">
                        <p>Attachment</p>
                        <h4>{attachment.originalName}</h4>
                        <span>{attachment.mimeType}</span>
                      </div>
                    )}
                    {attachment.storedName ? (
                      <a
                        className="post-attachment-link"
                        href={attachment.storedName}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}

            <div className="post-detail-actions">
              <button type="button" className="feed-action" onClick={handleToggleLike}>
                {post.likedByUser ? "Liked" : "Like"} · {post.likeCount || 0}
              </button>
              <span>{post.commentCount || 0} comments</span>
            </div>

            {post.status === "under_review" &&
            currentUser &&
            ["senior", "dept_admin", "univ_admin"].includes(currentUser.role) ? (
              <div className="post-review-actions">
                <p className="post-review-timer">
                  Review ends in: {timeLeftForReview !== null ? formatTimeLeft(timeLeftForReview) : "--:--:--"}
                </p>
                <form className="post-objection-form" onSubmit={handleRaiseObjection}>
                  <textarea
                    rows={2}
                    value={objectionReason}
                    onChange={(event) => {
                      setObjectionReason(event.target.value);
                      setStatus(""); // Clear status when typing
                    }}
                    placeholder="Reason for objection (min 5 characters)"
                    maxLength={1000}
                    disabled={raisingObjection}
                  />
                  {objectionReason.length > 0 && objectionReason.trim().length < 5 && (
                    <p className="input-feedback error">Minimum 5 characters required.</p>
                  )}
                  <button
                    type="submit"
                    className="landing-link primary"
                    disabled={raisingObjection || objectionReason.trim().length < 5}
                  >
                    {raisingObjection ? "Submitting..." : "Raise Objection"}
                  </button>
                </form>
              </div>
            ) : null}

            {post.status === "objected" && post.objections.length > 0 ? (
              <div className="post-objections-display">
                <h3>Objections ({post.objections.filter(obj => !obj.isResolved).length} unresolved)</h3>
                {post.objections.map((obj) => (
                  <div key={obj._id} className="post-objection-item">
                    <p><strong>{obj.raisedBy?.name || "Admin"}</strong> on {formatDateTime(obj.raisedAt)}</p>
                    <p>{obj.reason}</p>
                    {obj.isResolved ? (
                      <span className="post-objection-resolved">Resolved</span>
                    ) : (
                      <span className="post-objection-unresolved">Unresolved</span>
                    )}
                    <div className="post-objection-replies">
                      <h4>Discussion</h4>
                      {loadingObjectionReplies[obj._id] ? (
                        <p className="feed-muted">Loading replies...</p>
                      ) : null}
                      {!loadingObjectionReplies[obj._id] &&
                      (objectionReplies[obj._id] || []).length === 0 ? (
                        <p className="feed-muted">No replies yet.</p>
                      ) : null}
                      {(objectionReplies[obj._id] || []).map((reply) => (
                        <div key={reply._id} className="post-objection-reply-item">
                          <p>
                            <strong>{reply.author?.name || "User"}</strong> on{" "}
                            {formatDateTime(reply.createdAt)}
                          </p>
                          <p>{reply.content}</p>
                        </div>
                      ))}
                      {canReplyToObjection(obj) ? (
                        <div className="post-objection-reply-form">
                          <textarea
                            rows={2}
                            value={objectionReplyDrafts[obj._id] || ""}
                            onChange={(event) =>
                              setObjectionReplyDrafts((prev) => ({
                                ...prev,
                                [obj._id]: event.target.value,
                              }))
                            }
                            placeholder="Reply to this objection..."
                            maxLength={1000}
                            disabled={postingObjectionReplyFor === obj._id}
                          />
                          <button
                            type="button"
                            className="landing-link secondary small"
                            onClick={() => handleAddObjectionReply(obj._id)}
                            disabled={
                              postingObjectionReplyFor === obj._id ||
                              !String(objectionReplyDrafts[obj._id] || "").trim()
                            }
                          >
                            {postingObjectionReplyFor === obj._id ? "Posting..." : "Reply"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {currentUser &&
                    ["dept_admin", "univ_admin"].includes(currentUser.role) &&
                    !obj.isResolved ? (
                      <button
                        type="button"
                        className="landing-link secondary small"
                        onClick={() => handleResolveObjection(obj._id)}
                        disabled={resolvingObjection}
                      >
                        {resolvingObjection ? "Resolving..." : "Resolve"}
                      </button>
                    ) : null}
                  </div>
                ))}
                {currentUser &&
                ["dept_admin", "univ_admin"].includes(currentUser.role) &&
                post.objections.some((obj) => !obj.isResolved) ? (
                  <button
                    type="button"
                    className="landing-link primary"
                    onClick={() => handleResolveObjection()}
                    disabled={resolvingObjection}
                  >
                    {resolvingObjection ? "Resolving All..." : "Resolve All Objections"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        ) : (
          <p className="feed-muted">Post not available.</p>
        )}

        <section className="post-comments">
          <h2>Comments</h2>

          {canEngageWithPost ? (
            <form className="post-comment-form" onSubmit={handleAddComment}>
              <textarea
                rows={3}
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder={replyingToCommentId ? "Replying to a comment..." : "Share a respectful comment..."}
                maxLength={2000}
              />
              <div className="comment-form-actions">
                {replyingToCommentId && (
                  <button type="button" className="landing-link secondary" onClick={() => setReplyingToCommentId(null)}>
                    Cancel Reply
                  </button>
                )}
                <button type="submit" className="landing-link" disabled={savingComment}>
                  {savingComment ? "Posting..." : replyingToCommentId ? "Post Reply" : "Post comment"}
                </button>
              </div>
            </form>
          ) : (
            <p className="feed-muted">Comments are available after this post becomes official.</p>
          )}

          {canEngageWithPost && comments.length === 0 && !loadingComments ? (
            <p className="feed-muted">No comments yet.</p>
          ) : null}

          {canEngageWithPost ? (
            <div className="post-comment-list">
              {comments.map((comment) => (
                <CommentItem
                  key={comment._id}
                  comment={comment}
                  currentUser={currentUser}
                  onDelete={handleDeleteComment}
                  onReply={setCommentBody}
                  onMarkOfficial={handleMarkCommentAsOfficial}
                  onToggleVisibility={handleToggleCommentVisibility}
                  postId={postId}
                  canDeleteComment={canDeleteComment}
                />
              ))}
            </div>
          ) : null}

          {canEngageWithPost && canLoadMoreComments ? (
            <button
              type="button"
              className="landing-link secondary"
              onClick={() => loadComments({ reset: false })}
              disabled={loadingComments}
            >
              {loadingComments ? "Loading..." : "Load more comments"}
            </button>
          ) : null}
        </section>
      </section>
    </main>
  );
}

export default PostDetail;

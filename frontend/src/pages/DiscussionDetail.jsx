import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { discussionApi, userApi } from "../lib/api";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import DiscussionReplyItem from "../components/common/DiscussionReplyItem";
import ReplyForm from "../components/common/ReplyForm";
import Toast from "../components/common/Toast";
import { useToast } from "../components/common/useToast";
import useDiscussionSocket from "../hooks/useDiscussionSocket";
import DOMPurify from "dompurify";

const addThoughtToTree = (nodes, thought, parentThoughtId = null) => {
  if (!parentThoughtId) return [thought, ...nodes];
  return nodes.map((node) => {
    if (node._id === parentThoughtId) {
      return { ...node, thoughtReplies: [...(node.thoughtReplies || []), thought] };
    }
    return {
      ...node,
      thoughtReplies: addThoughtToTree(node.thoughtReplies || [], thought, parentThoughtId),
    };
  });
};

const updateThoughtInTree = (nodes, thoughtId, updater) =>
  nodes.map((node) => {
    if (node._id === thoughtId) return updater(node);
    return {
      ...node,
      thoughtReplies: updateThoughtInTree(node.thoughtReplies || [], thoughtId, updater),
    };
  });

const removeThoughtFromTree = (nodes, thoughtId) =>
  nodes
    .filter((node) => node._id !== thoughtId)
    .map((node) => ({
      ...node,
      thoughtReplies: removeThoughtFromTree(node.thoughtReplies || [], thoughtId),
    }));

const hasThoughtInTree = (nodes, thoughtId) =>
  nodes.some((node) => node._id === thoughtId || hasThoughtInTree(node.thoughtReplies || [], thoughtId));

const DiscussionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  const [discussion, setDiscussion] = useState(null);
  const [thoughts, setThoughts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingDiscussion, setIsLoadingDiscussion] = useState(true);
  const [isLoadingThoughts, setIsLoadingThoughts] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmittingThought, setIsSubmittingThought] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMoreThoughts, setHasMoreThoughts] = useState(false);
  const [showThoughtForm, setShowThoughtForm] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data } = await userApi.getMe();
      setCurrentUser(data.data);
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  }, []);

  const fetchDiscussionDetail = useCallback(async () => {
    setIsLoadingDiscussion(true);
    setError(null);
    try {
      const { data } = await discussionApi.getDiscussionDetail({ id, limit: 20 });
      setDiscussion(data.data.discussion);
      setThoughts(data.data.thoughts || []);
      setNextCursor(data.data.pagination?.nextCursor || null);
      setHasMoreThoughts(data.data.pagination?.hasMore || false);
    } catch (err) {
      if (err.status === 404) {
        addToast("Discussion not found.", "error");
        navigate("/app/discussions", { replace: true });
        return;
      }
      const message = err.payload?.message || "Failed to fetch discussion";
      setError(message);
      addToast(message, "error");
    } finally {
      setIsLoadingDiscussion(false);
    }
  }, [id, addToast, navigate]);

  useEffect(() => {
    fetchCurrentUser();
    fetchDiscussionDetail();
  }, [fetchCurrentUser, fetchDiscussionDetail]);

  useDiscussionSocket(id, {
    onThoughtAdded: (data) => {
      if (data.discussionId === id && data.thought?._id) {
        setThoughts((prev) => {
          const exists = hasThoughtInTree(prev, data.thought._id);
          return exists ? prev : addThoughtToTree(prev, data.thought, data.parentThought || null);
        });
        setDiscussion((prev) => ({ ...prev, thoughtCount: data.thoughtCount ?? prev?.thoughtCount, replyCount: data.replyCount ?? prev?.replyCount }));
      }
    },
    onThoughtDeleted: (data) => {
      const deleteId = data.thoughtId || data.replyId;
      if (deleteId) {
        setThoughts((prev) => removeThoughtFromTree(prev, deleteId));
        setDiscussion((prev) => ({ ...prev, thoughtCount: data.thoughtCount ?? prev?.thoughtCount, replyCount: data.replyCount ?? prev?.replyCount }));
      }
    },
    onThoughtUpdated: (updatedThought) => {
      setThoughts((prev) => updateThoughtInTree(prev, updatedThought._id, () => ({ ...updatedThought })));
    },
    onDiscussionUpdated: (updatedDiscussion) => setDiscussion(updatedDiscussion),
  });

  const canModerateDeletion = useCallback(() => {
    if (!currentUser || !discussion) return false;
    if (discussion.author?._id === currentUser._id) return true;
    if (currentUser.role === "univ_admin") return true;
    return currentUser.role === "dept_admin" && currentUser.department && discussion.author?.department &&
      String(currentUser.department).trim().toLowerCase() === String(discussion.author.department).trim().toLowerCase();
  }, [currentUser, discussion]);

  const handleAddThought = async (body, parentThought = null) => {
    setIsSubmittingThought(true);
    try {
      const payload = parentThought ? { body, parentThought } : { body };
      const { data } = await discussionApi.addThought(id, payload);
      const newThought = data.data;

      if (newThought?.moderationStatus === "flagged") {
        addToast(
          "Thought submitted for review. It will appear once approved.",
          "info",
        );
        if (!parentThought) setShowThoughtForm(false);
        return;
      }

      setThoughts((prev) => (hasThoughtInTree(prev, newThought._id) ? prev : addThoughtToTree(prev, newThought, parentThought)));
      setDiscussion((prev) => ({
        ...prev,
        thoughtCount: data.thoughtCount ?? prev?.thoughtCount,
        replyCount: data.replyCount ?? prev?.replyCount,
      }));
      if (!parentThought) setShowThoughtForm(false);
      addToast("Thought posted successfully.", "success");
    } catch (err) {
      if (err.status === 401) {
        addToast("Session expired. Please log in again.", "error");
        setTimeout(() => navigate("/auth/login"), 600);
        return;
      }
      const message = err.payload?.message || "Failed to post thought";
      addToast(message, "error");
    } finally {
      setIsSubmittingThought(false);
    }
  };

  const handleEditThought = async (thoughtId, body) => {
    try {
      const { data } = await discussionApi.editThought(id, thoughtId, { body });
      setThoughts((prev) => updateThoughtInTree(prev, thoughtId, () => data.data));
      addToast("Thought updated successfully.", "success");
    } catch (err) {
      const message = err.payload?.message || "Failed to update thought";
      addToast(message, "error");
      throw err;
    }
  };

  const handleDeleteThought = async (thoughtId) => {
    try {
      await discussionApi.deleteThought(id, thoughtId);
      setThoughts((prev) => removeThoughtFromTree(prev, thoughtId));
      setDiscussion((prev) => ({
        ...prev,
        thoughtCount: Math.max(
          0,
          thoughts.some((t) => t._id === thoughtId)
            ? (prev?.thoughtCount || prev?.replyCount || 1) - 1
            : (prev?.thoughtCount || prev?.replyCount || 0),
        ),
        replyCount: Math.max(0, (prev?.replyCount || 1) - 1),
      }));
      addToast("Thought deleted successfully.", "success");
    } catch (err) {
      const message = err.payload?.message || "Failed to delete thought";
      addToast(message, "error");
    }
  };

  const handleDeleteDiscussion = async () => {
    if (!window.confirm("Are you sure you want to delete this discussion?")) return;
    try {
      await discussionApi.deleteDiscussion(id);
      addToast("Discussion deleted successfully.", "success");
      setTimeout(() => navigate("/app/discussions", { replace: true }), 500);
    } catch (err) {
      addToast(err.payload?.message || "Failed to delete discussion", "error");
    }
  };

  const handleLoadMoreThoughts = () => {
    if (nextCursor && !isLoadingThoughts) {
      setIsLoadingThoughts(true);
      discussionApi.getDiscussionDetail({ id, cursor: nextCursor, limit: 20 })
        .then(({ data }) => {
          setThoughts((prev) => [...prev, ...(data.data.thoughts || [])]);
          setNextCursor(data.data.pagination?.nextCursor || null);
          setHasMoreThoughts(data.data.pagination?.hasMore || false);
        })
        .catch(() => addToast("Failed to load more thoughts", "error"))
        .finally(() => setIsLoadingThoughts(false));
    }
  };

  const canParticipate = currentUser && ["senior_dept_admin", "univ_admin"].includes(currentUser.role);
  const canDelete = canModerateDeletion();
  const thoughtCount = thoughts.length;
  const formatDate = (date) =>
    new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));

  if (isLoadingDiscussion) return <main className="feed-shell"><AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} /><div className="discussion-detail-page"><div className="loading-container"><p>Loading discussion...</p></div></div></main>;
  if (error || !discussion) return <main className="feed-shell"><AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} /><div className="discussion-detail-page"><div className="error-container"><p className="error-message">{error || "Discussion not found"}</p><button onClick={() => navigate("/app/discussions")} className="btn btn-secondary">Back to Discussions</button></div></div></main>;

  return (
    <main className="feed-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
      <div className="discussion-detail-page">
        <div className="toasts-container">{toasts.map((toast) => <Toast key={toast.id} {...toast} onRemove={removeToast} />)}</div>
        <button onClick={() => navigate("/app/discussions")} className="btn-back">Back to Discussions</button>

        <div className="discussion-header">
          <div className="discussion-top-row">
            <span className="discussion-author">By <strong>{discussion.author?.name}</strong></span>
            {canDelete && <div className="discussion-delete-anchor"><button onClick={handleDeleteDiscussion} className="btn-action btn-delete" title="Delete discussion">Delete Discussion</button></div>}
          </div>
          <div className="discussion-title-section">
            <h1>{discussion.title}</h1>
            <div className="discussion-badges">{discussion.visibility === "department" && <span className="badge badge-dept">Department</span>}</div>
          </div>
          {discussion.description && <p className="discussion-description">{discussion.description}</p>}
          <div className="discussion-meta">
            {discussion.department && <span>in <strong>{discussion.department?.deptName}</strong></span>}
            <span>{formatDate(discussion.createdAt)}</span>
          </div>
        </div>

        <div className="discussion-body"><div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(discussion.body) }} /></div>

        <div className="replies-section">
          <h2 className="replies-heading">{thoughtCount} {thoughtCount === 1 ? "Thought" : "Thoughts"}</h2>
          {canParticipate && !discussion.isDeleted && discussion.status !== 'resolved' && (
            <>
              {showThoughtForm ? (
                <div className="reply-form-container">
                  <ReplyForm onSubmit={(body) => handleAddThought(body, null)} onCancel={() => setShowThoughtForm(false)} isSubmitting={isSubmittingThought} isLocked={false} />
                </div>
              ) : (
                <button onClick={() => setShowThoughtForm(true)} className="btn btn-primary btn-reply">Add Thought</button>
              )}
            </>
          )}

          <div className="replies-list">
            {thoughts.length === 0 ? (
              <div className="empty-replies">
                <p>
                  {thoughtCount > 0
                    ? "No visible thoughts right now. Some thoughts may be under moderation review."
                    : "No thoughts yet. Be the first to share one."}
                </p>
              </div>
            ) : (
              thoughts.map((thought) => (
                <DiscussionReplyItem
                  key={thought._id}
                  thought={thought}
                  onEdit={(body, targetId) => handleEditThought(targetId || thought._id, body)}
                  onDelete={(targetId) => handleDeleteThought(targetId || thought._id)}
                  onReply={(body, targetId) => handleAddThought(body, targetId || thought._id)}
                  canDelete={canDelete}
                  currentUserId={currentUser?._id}
                />
              ))
            )}
          </div>

          {hasMoreThoughts && (
            <div className="load-more-container">
              <button onClick={handleLoadMoreThoughts} disabled={isLoadingThoughts} className="btn btn-secondary">
                {isLoadingThoughts ? "Loading..." : "Load More Thoughts"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default DiscussionDetail;

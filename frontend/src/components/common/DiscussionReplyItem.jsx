import React, { useState } from "react";
import DOMPurify from "dompurify";

const DiscussionReplyItem = ({
  thought,
  onEdit,
  onDelete,
  onReply,
  canDelete,
  currentUserId,
  level = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(thought.body);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const children = thought.thoughtReplies || [];
  const isThoughtCreator = String(thought.author?._id || thought.author || "") === String(currentUserId || "");

  const formatDate = (date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));

  const handleSaveEdit = async () => {
    if (!editedBody.trim()) {
      setError("Thought cannot be empty");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onEdit(editedBody);
      setIsEditing(false);
    } catch (err) {
      setError(err.message || "Failed to update thought");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this thought?")) {
      Promise.resolve(onDelete()).catch((err) => {
        setError(err?.message || "Failed to delete thought");
      });
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    try {
      await onReply(replyBody.trim());
      setReplyBody("");
      setShowReplyForm(false);
    } catch (err) {
      setError(err?.message || "Failed to post thought reply");
    }
  };

  if (thought.isDeleted) {
    return (
      <div className="discussion-reply-item deleted-reply">
        <p className="reply-deleted-message">This thought has been deleted.</p>
      </div>
    );
  }

  return (
    <div className="discussion-reply-item" style={{ marginLeft: level > 0 ? 20 : 0 }}>
      <div className="reply-header">
        <div className="reply-author-info">
          <strong className="reply-author-name">{thought.author?.name}</strong>
          <span className="reply-author-role">{thought.author?.role}</span>
        </div>
        <span className="reply-timestamp">{formatDate(thought.createdAt)}</span>
        {thought.editedAt && (
          <span className="reply-edited">(edited {formatDate(thought.editedAt)})</span>
        )}
      </div>

      {isEditing ? (
        <div className="reply-edit-form">
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            className="reply-textarea"
            placeholder="Edit your thought..."
            maxLength={3000}
          />
          <div className="reply-form-actions">
            <button onClick={handleSaveEdit} disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedBody(thought.body);
                setError(null);
              }}
              disabled={isSubmitting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
          {error && <p className="error-text">{error}</p>}
        </div>
      ) : (
        <>
          <div
            className="reply-body"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(thought.body) }}
          />
          <div className="reply-actions">
            {level === 0 && (
              <button onClick={() => setShowReplyForm((v) => !v)} className="btn-action btn-edit">
                Reply
              </button>
            )}
            {isThoughtCreator && (
              <button onClick={() => setIsEditing(true)} className="btn-action btn-edit">
                Edit
              </button>
            )}
            {(isThoughtCreator || canDelete) && (
              <button onClick={handleDelete} className="btn-action btn-delete">
                Delete
              </button>
            )}
          </div>
        </>
      )}

      {level === 0 && showReplyForm && (
        <form className="reply-form" onSubmit={handleReplySubmit}>
          <div className="form-group">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Add a thought reply..."
              maxLength={3000}
              className="form-control"
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!replyBody.trim()}>
              Post Thought Reply
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowReplyForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {children.length > 0 && (
        <div className="replies-list">
          {children.map((child) => (
            <DiscussionReplyItem
              key={child._id}
              thought={child}
              onEdit={(body) => onEdit(body, child._id)}
              onDelete={() => onDelete(child._id)}
              onReply={(body) => onReply(body, child._id)}
              canDelete={canDelete}
              currentUserId={currentUserId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscussionReplyItem;

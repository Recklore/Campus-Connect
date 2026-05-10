import { useState } from "react";
import { formatDateTime } from "../../lib/util";
import { postApi } from "../../lib/api";

function CommentItem({
  comment,
  currentUser,
  onDelete,
  onReply,
  onMarkOfficial,
  onToggleVisibility,
  postId,
  canDeleteComment,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(comment.body);
  const [savingEdit, setSavingEdit] = useState(false);
  const [status, setStatus] = useState("");

  const canEdit = String(comment.author?._id) === String(currentUser?._id);
  const canModerate = currentUser && ["dept_admin", "univ_admin"].includes(currentUser.role);
  const isHidden = comment.isDeleted;
  const isOfficial = comment.isOfficial;

  const handleEdit = async () => {
    if (!editedBody.trim() || editedBody === comment.body) {
      setIsEditing(false);
      return;
    }
    setSavingEdit(true);
    setStatus("");
    try {
      const response = await postApi.editComment(postId, comment._id, { body: editedBody.trim() });
      setIsEditing(false);
      setStatus("");
      setEditedBody(response.data?.data?.body || editedBody);
    } catch (error) {
      setStatus(error.message || "Failed to edit comment.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <article className={`post-comment ${isHidden ? "post-comment-hidden" : ""} ${isOfficial ? "post-comment-official" : ""}`}>
      <div style={{ marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
          {comment.author?.name || "User"}
          {isOfficial && <span className="official-badge">Official</span>}
        </h4>
        <p className="post-comment-meta">
          {comment.author?.designation || comment.author?.role || "Member"}
          {comment.createdAt ? ` • ${formatDateTime(comment.createdAt)}` : ""}
          {isHidden && <span className="hidden-badge">Hidden</span>}
        </p>
      </div>

      {isEditing ? (
        <div className="comment-edit-form">
          <textarea
            rows={3}
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            maxLength={2000}
          />
          {status && <p style={{ margin: "0", fontSize: "12px", color: "var(--danger)" }}>{status}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={handleEdit} disabled={savingEdit || !editedBody.trim()} className="action-btn">
              {savingEdit ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} disabled={savingEdit} className="action-btn">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--text)", lineHeight: 1.45 }}>
          {comment.body}
        </p>
      )}

      {!isEditing && (
        <div className="comment-actions">
          {currentUser && (
            <button type="button" onClick={() => onReply(comment._id)} className="comment-action-btn">
              Reply
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setIsEditing(true)} className="comment-action-btn">
              Edit
            </button>
          )}
          {canModerate && (
            <>
              <button
                type="button"
                onClick={() => onMarkOfficial(comment._id)}
                className="comment-action-btn"
              >
                {isOfficial ? "Unmark Official" : "Mark Official"}
              </button>
              <button
                type="button"
                onClick={() => onToggleVisibility(comment._id)}
                className="comment-action-btn"
              >
                {isHidden ? "Unhide" : "Hide"}
              </button>
            </>
          )}
          {canDeleteComment && canDeleteComment(comment) && !isEditing && (
            <button type="button" onClick={() => onDelete(comment._id)} className="comment-action-btn danger">
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default CommentItem;

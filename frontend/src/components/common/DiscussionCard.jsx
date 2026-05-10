import React from 'react';
import DOMPurify from 'dompurify';

const DiscussionCard = ({ discussion, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(discussion._id);
    }
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <div className="discussion-card" onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className="discussion-card-header">
        <h3 className="discussion-title">{discussion.title}</h3>
        <div className="discussion-badges">
          {discussion.isPinned && <span className="badge badge-pinned">📌 Pinned</span>}
          {discussion.status === 'locked' && <span className="badge badge-locked">🔒 Locked</span>}
          {discussion.status === 'resolved' && <span className="badge badge-resolved">✅ Resolved</span>}
        </div>
      </div>

      {discussion.description && (
        <p className="discussion-description">{discussion.description}</p>
      )}

      <div className="discussion-meta">
        <span className="meta-item">
          By <strong>{discussion.author?.name}</strong>
        </span>
        {discussion.department && (
          <span className="meta-item">
            in <strong>{discussion.department?.deptName}</strong>
          </span>
        )}
        {discussion.visibility === 'department' && (
          <span className="meta-item badge-dept">🏢 Department</span>
        )}
        <span className="meta-item">
          💬 {(discussion.thoughtCount ?? discussion.replyCount ?? 0)} {(discussion.thoughtCount ?? discussion.replyCount ?? 0) === 1 ? 'thought' : 'thoughts'}
        </span>
        <span className="meta-item meta-time">{formatDate(discussion.createdAt)}</span>
      </div>
    </div>
  );
};

export default DiscussionCard;

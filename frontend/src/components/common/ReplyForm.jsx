import React, { useState } from 'react';

const ReplyForm = ({ onSubmit, onCancel, isSubmitting = false, isLocked = false }) => {
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);

  const validateReply = () => {
    if (!body.trim()) {
      setError('Thought cannot be empty');
      return false;
    }

    if (body.trim().length < 5) {
      setError('Thought must be at least 5 characters');
      return false;
    }

    if (body.trim().length > 3000) {
      setError('Thought must not exceed 3000 characters');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateReply()) {
      return;
    }

    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (err) {
      // The parent handler already shows a toast; keep local error minimal.
      setError(err?.message || 'Failed to post thought');
    }
  };

  if (isLocked) {
    return (
      <div className="reply-form-locked">
        <p className="locked-message">This discussion is locked and cannot accept new thoughts.</p>
      </div>
    );
  }

  return (
    <form className="reply-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="reply-body">Your Thought</label>
        <textarea
          id="reply-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Share your thoughts... (5-3000 characters)"
          maxLength={3000}
          disabled={isSubmitting}
          className={error ? 'form-control error' : 'form-control'}
          rows={4}
        />
        <div className="char-count">
          {body.length}/3000
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="form-actions">
        <button
          type="submit"
          disabled={isSubmitting || !body.trim()}
          className="btn btn-primary"
        >
          {isSubmitting ? 'Posting...' : 'Post Thought'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default ReplyForm;

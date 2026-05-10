import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

const DiscussionForm = ({ onSubmit, onCancel, departments = [], initialData = null, isSubmitting = false }) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [body, setBody] = useState(initialData?.body || '');
  const [visibility, setVisibility] = useState(initialData?.visibility || 'global');
  const [department, setDepartment] = useState(initialData?.department?._id || '');
  const [errors, setErrors] = useState({});
  const departmentList = Array.isArray(departments)
    ? departments
    : Object.values(departments || {}).flatMap((items) => (Array.isArray(items) ? items : []));

  const validateForm = () => {
    const newErrors = {};

    if (!title.trim() || title.trim().length < 5 || title.trim().length > 200) {
      newErrors.title = 'Title must be between 5 and 200 characters';
    }

    if (description && (description.trim().length > 500)) {
      newErrors.description = 'Description must not exceed 500 characters';
    }

    if (!body.trim() || body.trim().length < 10 || body.trim().length > 5000) {
      newErrors.body = 'Discussion must be between 10 and 5000 characters';
    }

    if (visibility === 'department' && !department) {
      newErrors.department = 'Please select a department';
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      body: body.trim(),
      visibility,
      ...(visibility === 'department' && department ? { department } : {}),
    };

    onSubmit(payload);
  };

  return (
    <form className="discussion-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="title">Discussion Title *</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors({ ...errors, title: null });
          }}
          placeholder="Enter discussion title (5-200 characters)"
          maxLength={200}
          disabled={isSubmitting}
          className={errors.title ? 'form-control error' : 'form-control'}
        />
        <div className="char-count">
          {title.length}/200
        </div>
        {errors.title && <p className="error-text">{errors.title}</p>}
      </div>

      <div className="form-group">
        <label htmlFor="description">Description (Optional)</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors({ ...errors, description: null });
          }}
          placeholder="Brief summary of your discussion (max 500 characters)"
          maxLength={500}
          disabled={isSubmitting}
          className={errors.description ? 'form-control error' : 'form-control'}
          rows={2}
        />
        <div className="char-count">
          {description.length}/500
        </div>
        {errors.description && <p className="error-text">{errors.description}</p>}
      </div>

      <div className="form-group">
        <label htmlFor="body">Discussion Content *</label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (errors.body) setErrors({ ...errors, body: null });
          }}
          placeholder="Share your thoughts and ideas (10-5000 characters)"
          maxLength={5000}
          disabled={isSubmitting}
          className={errors.body ? 'form-control error' : 'form-control'}
          rows={8}
        />
        <div className="char-count">
          {body.length}/5000
        </div>
        {errors.body && <p className="error-text">{errors.body}</p>}
      </div>

      <div className="form-group">
        <label htmlFor="visibility">Visibility *</label>
        <select
          id="visibility"
          value={visibility}
          onChange={(e) => {
            setVisibility(e.target.value);
            if (e.target.value === 'global') {
              setDepartment('');
            }
          }}
          disabled={isSubmitting}
          className="form-control"
        >
          <option value="global">Global (All users)</option>
          <option value="department">Department Only</option>
        </select>
      </div>

      {visibility === 'department' && (
        <div className="form-group">
          <label htmlFor="department">Department *</label>
          <select
            id="department"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              if (errors.department) setErrors({ ...errors, department: null });
            }}
            disabled={isSubmitting}
            className={errors.department ? 'form-control error' : 'form-control'}
          >
            <option value="">Select a department</option>
            {departmentList.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.deptName || dept.name}
              </option>
            ))}
          </select>
          {errors.department && <p className="error-text">{errors.department}</p>}
        </div>
      )}

      <div className="form-actions">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
        >
          {isSubmitting ? 'Publishing...' : 'Publish Discussion'}
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

export default DiscussionForm;

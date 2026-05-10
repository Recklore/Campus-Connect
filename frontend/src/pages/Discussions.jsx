import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { discussionApi, departmentApi, userApi } from '../lib/api';
import AuthenticatedHeader from '../components/common/AuthenticatedHeader';
import DiscussionCard from '../components/common/DiscussionCard';
import DiscussionForm from '../components/common/DiscussionForm';
import Toast from '../components/common/Toast';
import { useToast } from '../components/common/useToast';

const Discussions = () => {
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();

  // State
  const [discussions, setDiscussions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [visibility, setVisibility] = useState('global');
  const [sortBy, setSortBy] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // Fetch current user
  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data } = await userApi.getMe();
      setCurrentUser(data.data);
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  }, []);

  // Fetch departments
  const fetchDepartments = useCallback(async () => {
    try {
      const { data } = await departmentApi.getAll();
      setDepartments(data.data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  }, []);

  // Fetch discussions
  const fetchDiscussions = useCallback(
    async (cursor = null) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data } = await discussionApi.getDiscussions({
          visibility: visibility || undefined,
          sort: sortBy,
          limit: 20,
          cursor,
        });

        if (cursor) {
          // Append to existing discussions (pagination)
          setDiscussions((prev) => [...prev, ...data.data]);
        } else {
          // Replace discussions (new filter/sort)
          setDiscussions(data.data);
        }

        setNextCursor(data.pagination?.nextCursor || null);
        setHasMore(data.pagination?.hasMore || false);
      } catch (err) {
        const message = err.payload?.message || 'Failed to fetch discussions';
        setError(message);
        addToast(message, 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [visibility, sortBy, addToast]
  );

  // Initial load
  useEffect(() => {
    fetchCurrentUser();
    fetchDepartments();
  }, [fetchCurrentUser, fetchDepartments]);

  // Fetch discussions when filters change
  useEffect(() => {
    fetchDiscussions(null);
  }, [visibility, sortBy, fetchDiscussions]);

  // Handle create discussion
  const handleCreateDiscussion = async (formData) => {
    setIsSubmitting(true);

    try {
      const { data } = await discussionApi.createDiscussion(formData);

      addToast('Discussion created successfully.', 'success');
      setShowCreateForm(false);
      
      // Refresh discussions
      fetchDiscussions(null);

      // Navigate to new discussion
      setTimeout(() => {
        navigate(`/app/discussions/${data.data._id}`);
      }, 500);
    } catch (err) {
      const message = err.payload?.message || 'Failed to create discussion';
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle discussion card click
  const handleDiscussionClick = (id) => {
    navigate(`/app/discussions/${id}`);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (nextCursor && !isLoading) {
      fetchDiscussions(nextCursor);
    }
  };

  const canCreateDiscussion = currentUser && ['senior', 'dept_admin', 'univ_admin'].includes(currentUser.role);

  return (
    <main className="feed-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
      <div className="discussions-page">
      <div className="page-header">
        <h1>Discussions</h1>
        <p className="page-subtitle">Join campus conversations</p>
      </div>

      {/* Toast notifications */}
      <div className="toasts-container">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onRemove={removeToast} />
        ))}
      </div>

      {/* Create Discussion Button */}
      {canCreateDiscussion && (
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary btn-create"
        >
          {showCreateForm ? '✕ Close' : '✎ Create Discussion'}
        </button>
      )}

      {/* Create Discussion Form */}
      {showCreateForm && canCreateDiscussion && (
        <div className="discussion-form-container">
          <h2>Start a New Discussion</h2>
          <DiscussionForm
            onSubmit={handleCreateDiscussion}
            onCancel={() => setShowCreateForm(false)}
            departments={departments}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* Filters */}
      <div className="discussions-filters">
        <div className="filter-group">
          <label htmlFor="visibility-filter">Visibility:</label>
          <select
            id="visibility-filter"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="global">All Discussions</option>
            <option value="global">Global</option>
            <option value="department">Department</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sort-filter">Sort by:</label>
          <select
            id="sort-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="latest">Latest</option>
            <option value="pinned">Pinned First</option>
            <option value="replies">Most Thoughts</option>
          </select>
        </div>
      </div>

      {/* Discussions List */}
      {isLoading && discussions.length === 0 ? (
        <div className="loading-container">
          <p>Loading discussions...</p>
        </div>
      ) : error && discussions.length === 0 ? (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={() => fetchDiscussions(null)} className="btn btn-secondary">
            Try Again
          </button>
        </div>
      ) : discussions.length === 0 ? (
        <div className="empty-state">
          <p>No discussions yet.</p>
          {canCreateDiscussion && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary"
            >
              Create Discussion
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="discussions-list">
            {discussions.map((discussion) => (
              <DiscussionCard
                key={discussion._id}
                discussion={discussion}
                onClick={handleDiscussionClick}
              />
            ))}
          </div>

          {hasMore && (
            <div className="load-more-container">
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="btn btn-secondary"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </main>
  );
};

export default Discussions;

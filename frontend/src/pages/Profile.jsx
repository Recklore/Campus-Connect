import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Brand from "../components/common/Brand";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import avatarImage from "../assets/curaj.jpg";
import { departmentApi, postApi, userApi } from "../lib/api";

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Header State
  const [hideTopUi, setHideTopUi] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const userResponse = await userApi.getMe();
      const nextUser = userResponse.data?.data || null;
      setUser(nextUser);

      let nextPosts = [];
      if (nextUser && ["senior", "dept_admin", "univ_admin"].includes(nextUser.role)) {
        try {
          const postsResponse = await postApi.getMyPosts();
          nextPosts = postsResponse.data?.data || [];
        } catch (error) {
          if (error.status !== 403) {
            throw error;
          }
        }
      }
      setPosts(nextPosts);

      try {
        const subscriptionsResponse = await departmentApi.getSubscriptions();
        setSubscriptions(subscriptionsResponse.data?.data || []);
      } catch (error) {
        if (error.status === 403) {
          setSubscriptions([]);
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to load profile right now");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);



  const isSenior = useMemo(
    () => user && ["senior", "dept_admin", "univ_admin"].includes(user.role),
    [user],
  );

  const subscriptionCount = subscriptions.length;
  const subscriptionPeople = useMemo(
    () =>
      subscriptions.reduce(
        (total, department) => total + Number(department?.subscriberCount || 0),
        0,
      ),
    [subscriptions],
  );

  const peopleCount = isSenior
    ? Number(user?.departmentSubscriberCount || 0)
    : subscriptionPeople;

  return (
    <main className="profile-shell">
      <AuthenticatedHeader userProfile={user} hideOnScroll={true} />

      <section className="profile-content">
        <div className="profile-headline">
          <h1>Profile</h1>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        {loading ? (
          <p className="feed-muted">Loading profile...</p>
        ) : user ? (
          <div className="profile-layout">
            <section className="profile-hero">
              <div className="profile-avatar-wrap">
                <img src={avatarImage} alt="Profile" className="profile-avatar" />
              </div>
              <div className="profile-hero-info">
                <div className="profile-hero-top">
                  <h2>{user.name}</h2>
                  <span className="profile-role-badge">{user.designation || user.role}</span>
                </div>
                <div className="profile-stats">
                  {isSenior ? (
                    <div className="profile-stat">
                      <strong>{posts.length}</strong>
                      <span>Posts</span>
                    </div>
                  ) : null}
                  <div className="profile-stat">
                    <strong>{subscriptionCount}</strong>
                    <span>Departments</span>
                  </div>
                  <div className="profile-stat">
                    <strong>{peopleCount}</strong>
                    <span>People</span>
                  </div>
                </div>
                <div className="profile-meta-list">
                  {user.enrollmentNumber ? <span>{user.enrollmentNumber}</span> : null}
                  {user.employeeId ? <span>{user.employeeId}</span> : null}
                  {user.department ? <span>{user.department}</span> : null}
                </div>
                {user.departmentInfo ? (
                  <div className="profile-dept-tag">
                    <span>{user.departmentInfo.deptName}</span>
                    <span>{user.departmentInfo.school}</span>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="profile-sections">
              {isSenior ? (
                <article className="profile-section">
                  <div className="profile-section-head">
                    <h3>Posts</h3>
                    <button
                      type="button"
                      className="landing-link secondary"
                      onClick={() => navigate("/app/posts/me")}
                    >
                      View all
                    </button>
                  </div>
                  {posts.length === 0 ? (
                    <p className="feed-muted">No posts created yet.</p>
                  ) : (
                    <div className="profile-post-grid">
                      {posts.slice(0, 6).map((post) => (
                        <button
                          key={post._id}
                          type="button"
                          className="profile-post-card"
                          onClick={() => navigate(`/app/posts/${post._id}`)}
                        >
                          <h4>{post.title}</h4>
                          <span>{formatDate(post.createdAt)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ) : null}

              <article className="profile-section">
                <div className="profile-section-head">
                  <h3>Subscribed departments</h3>
                  <span className="profile-section-meta">
                    {subscriptionCount} total
                  </span>
                </div>
                {subscriptions.length === 0 ? (
                  <p className="feed-muted">No subscriptions yet.</p>
                ) : (
                  <div className="profile-sub-grid">
                    {subscriptions.map((department) => (
                      <button
                        key={department._id}
                        type="button"
                        className="profile-sub-card"
                        onClick={() =>
                          navigate(`/app/departments/${department._id}/posts`)
                        }
                      >
                        <img
                          src={department.displayImage || avatarImage}
                          alt={department.deptName}
                          className="profile-sub-image"
                        />
                        <div>
                          <h4>{department.deptName}</h4>
                          <p>{department.school || "Campus School"}</p>
                          <span>
                            {department.subscriberCount || 0} people
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </div>
        ) : (
          <p className="feed-muted">Profile data is unavailable.</p>
        )}
      </section>
    </main>
  );
}

export default Profile;
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import avatarImage from "../assets/curaj.jpg";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { adminApi, userApi, postApi } from "../lib/api";

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

function UserProfileView() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setStatus("");

      try {
        const [meResponse, profileResponse] = await Promise.all([
          userApi.getMe(),
          userApi.getUserProfileById(userId),
        ]);

        setCurrentUser(meResponse.data?.data || null);
        const nextProfile = profileResponse.data?.data || null;
        setProfile(nextProfile);

        // Load posts if the viewed user can create posts
        if (nextProfile && ["senior", "dept_admin", "univ_admin"].includes(nextProfile.role)) {
          try {
            const postsResponse = await postApi.getUserPosts(userId);
            setPosts(postsResponse.data?.data || []);
          } catch (error) {
            if (error.status !== 403) {
              throw error;
            }
            setPosts([]);
          }
        } else {
          setPosts([]);
        }
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        if (error.status === 404) {
          setStatus("User not found");
        } else {
          setStatus(error.message || "Unable to load profile right now");
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, userId]);

  const isSenior = useMemo(
    () => profile && ["senior", "dept_admin", "univ_admin"].includes(profile.role),
    [profile],
  );

  const normalizeDept = (value) => String(value || "").trim().toLowerCase();
  const viewedDepartmentId = profile?.departmentInfo?._id || profile?.departmentId || null;
  const currentAdminDepartment = currentUser?.department || "";

  const isSameDepartment = useMemo(() => {
    if (!currentUser || !profile) return false;
    const currentDept = normalizeDept(currentAdminDepartment);
    if (!currentDept) return false;

    return [
      profile.department,
      profile.departmentInfo?.deptName,
      profile.departmentInfo?.deptCode,
    ].some((value) => normalizeDept(value) === currentDept);
  }, [currentAdminDepartment, currentUser, profile]);

  const canManageViewedUser = useMemo(() => {
    if (!currentUser || !profile || currentUser._id === profile._id) return false;
    if (!["dept_admin", "univ_admin"].includes(currentUser.role)) return false;
    if (currentUser.role === "univ_admin") return true;
    return isSameDepartment;
  }, [currentUser, isSameDepartment, profile]);

  const adminActions = useMemo(() => {
    if (!canManageViewedUser || !profile || !currentUser) return [];

    const actions = [];
    const isDeptAdmin = currentUser.role === "dept_admin";
    const isUnivAdmin = currentUser.role === "univ_admin";
    const sameDepartment = isUnivAdmin || isSameDepartment;

    if (profile.role === "student" && sameDepartment) {
      actions.push({
        key: "promote-senior",
        label: "Promote to senior",
        payload: { targetRole: "senior" },
      });
    }

    if (profile.role === "senior" && sameDepartment && isDeptAdmin) {
      actions.push({
        key: "demote-student",
        label: "Demote to student",
        payload: { targetRole: "student" },
      });
    }

    if (isUnivAdmin && profile.role === "senior" && profile.employeeId && !profile.enrollmentNumber) {
      actions.push({
        key: "promote-dept-admin",
        label: "Promote to dept admin",
        payload: {
          targetRole: "dept_admin",
          departmentId: viewedDepartmentId,
          departmentName: profile.departmentInfo?.deptName || profile.department || "",
          departmentCode: profile.departmentInfo?.deptCode || "",
        },
      });
    }

    if (isUnivAdmin && profile.role === "dept_admin") {
      actions.push({
        key: "demote-senior",
        label: "Demote to senior",
        payload: {
          targetRole: "senior",
          departmentId: viewedDepartmentId,
          departmentName: profile.departmentInfo?.deptName || profile.department || "",
          departmentCode: profile.departmentInfo?.deptCode || "",
        },
      });
    }

    return actions;
  }, [canManageViewedUser, currentUser, isSameDepartment, profile, viewedDepartmentId]);

  const handleRoleAction = async (action) => {
    if (!profile || actionLoading) return;

    setActionLoading(action.key);
    setActionStatus("");

    try {
      if (action.key === "promote-senior" || action.key === "promote-dept-admin") {
        await adminApi.promoteUserRole(profile._id, action.payload);
      } else {
        await adminApi.demoteUserRole(profile._id, action.payload);
      }

      setActionStatus(`${action.label} completed successfully.`);
      const refreshedProfile = await userApi.getUserProfileById(userId);
      setProfile(refreshedProfile.data?.data || null);
    } catch (error) {
      setActionStatus(error.message || "Unable to update user role right now");
    } finally {
      setActionLoading("");
    }
  };

  const detailList = useMemo(() => {
    if (!profile) return [];

    return [
      profile.emailId ? `Email: ${profile.emailId}` : null,
      profile.enrollmentNumber ? `Enrollment: ${profile.enrollmentNumber}` : null,
      profile.employeeId ? `Employee ID: ${profile.employeeId}` : null,
      profile.department ? `Department: ${profile.department}` : null,
    ].filter(Boolean);
  }, [profile]);

  return (
    <main className="profile-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />

      <section className="profile-content">
        <div className="profile-headline">
          <h1>User Profile</h1>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        {loading ? (
          <p className="feed-muted">Loading profile...</p>
        ) : profile ? (
          <div className="profile-layout">
            <section className="profile-hero">
              <div className="profile-avatar-wrap">
                <img src={avatarImage} alt="User profile" className="profile-avatar" />
              </div>
              <div className="profile-hero-info">
                <div className="profile-hero-top">
                  <h2>{profile.name}</h2>
                  <span className="profile-role-badge">{profile.designation || profile.role}</span>
                </div>
                <div className="profile-stats">
                  {isSenior ? (
                    <div className="profile-stat">
                      <strong>{posts.length}</strong>
                      <span>Posts</span>
                    </div>
                  ) : null}
                  <div className="profile-stat">
                    <strong>{Number(profile.subscriptionCount || 0)}</strong>
                    <span>Departments</span>
                  </div>
                  <div className="profile-stat">
                    <strong>{Number(profile.departmentSubscriberCount || 0)}</strong>
                    <span>People</span>
                  </div>
                </div>
                <div className="profile-meta-list">
                  {detailList.map((text) => (
                    <span key={text}>{text}</span>
                  ))}
                </div>
                {profile.departmentInfo ? (
                  <div className="profile-dept-tag">
                    <span>{profile.departmentInfo.deptName}</span>
                    <span>{profile.departmentInfo.school}</span>
                  </div>
                ) : null}
                {adminActions.length > 0 ? (
                  <div className="profile-action-panel">
                    <h3>Admin actions</h3>
                    <div className="profile-action-row">
                      {adminActions.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          className="landing-link secondary"
                          onClick={() => handleRoleAction(action)}
                          disabled={Boolean(actionLoading)}
                        >
                          {actionLoading === action.key ? "Working..." : action.label}
                        </button>
                      ))}
                    </div>
                    {actionStatus ? <p className="status-text">{actionStatus}</p> : null}
                  </div>
                ) : null}
              </div>
            </section>

            {isSenior ? (
              <section className="profile-sections">
                <article className="profile-section">
                  <div className="profile-section-head">
                    <h3>Posts</h3>
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
              </section>
            ) : null}
          </div>
        ) : (
          <p className="feed-muted">Profile data is unavailable.</p>
        )}
      </section>
    </main>
  );
}

export default UserProfileView;

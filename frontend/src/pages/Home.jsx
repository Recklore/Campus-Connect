import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import deptFallbackImage from "../assets/curaj.jpg";
import Brand from "../components/common/Brand";
import { departmentApi } from "../lib/api";
import { logoutSession } from "../lib/authSession";

function Home() {
  const navigate = useNavigate();
  const [departmentsBySchool, setDepartmentsBySchool] = useState({});
  const [subscriptionIds, setSubscriptionIds] = useState([]);
  const [canManageSubscriptions, setCanManageSubscriptions] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyDepartmentId, setBusyDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [hideHeader, setHideHeader] = useState(false);

  const totalDepartments = useMemo(
    () => Object.values(departmentsBySchool).reduce((sum, items) => sum + items.length, 0),
    [departmentsBySchool],
  );

  const departments = useMemo(
    () =>
      Object.entries(departmentsBySchool).flatMap(([school, items]) =>
        items.map((department) => ({
          ...department,
          school: department.school || school,
        })),
      ),
    [departmentsBySchool],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setStatus("");

    try {
      const departmentsResponse = await departmentApi.getAll();
      setDepartmentsBySchool(departmentsResponse.data?.data || {});

      try {
        const subscriptionsResponse = await departmentApi.getSubscriptions();
        const nextSubscriptionIds = (subscriptionsResponse.data?.data || [])
          .map((department) => department?._id)
          .filter(Boolean);

        setSubscriptionIds(nextSubscriptionIds);
        setCanManageSubscriptions(true);
      } catch (error) {
        if (error.status === 403) {
          setSubscriptionIds([]);
          setCanManageSubscriptions(false);
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to load dashboard right now");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 20) {
        setHideHeader(false);
      } else if (currentScrollY > lastScrollY && currentScrollY > 96) {
        setHideHeader(true);
      } else if (currentScrollY < lastScrollY) {
        setHideHeader(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleToggleSubscription = async (departmentId) => {
    if (!canManageSubscriptions || busyDepartmentId) {
      return;
    }

    setBusyDepartmentId(departmentId);
    setStatus("");
    try {
      const response = await departmentApi.toggleSubscription(departmentId);
      const isSubscribed = Boolean(response.data?.subscribed);

      setSubscriptionIds((prev) => {
        const current = new Set(prev);
        if (isSubscribed) {
          current.add(departmentId);
        } else {
          current.delete(departmentId);
        }
        return Array.from(current);
      });

      setDepartmentsBySchool((prev) => {
        const next = {};
        for (const [school, departments] of Object.entries(prev)) {
          next[school] = departments.map((department) => {
            if (department._id !== departmentId) {
              return department;
            }

            const currentCount = Number(department.subscriberCount || 0);
            const nextCount = isSubscribed ? currentCount + 1 : Math.max(0, currentCount - 1);
            return { ...department, subscriberCount: nextCount };
          });
        }
        return next;
      });
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to update subscription right now");
    } finally {
      setBusyDepartmentId("");
    }
  };

  const handleLogout = async () => {
    await logoutSession();
    navigate("/auth/login", { replace: true });
  };

  return (
    <main className="home-shell">
      <header className={`landing-topbar feed-page-topbar ${hideHeader ? "is-hidden" : ""}`}>
        <div className="landing-topbar-inner">
          <Brand />
          <div className="landing-top-actions" aria-label="Department actions">
            <button
              type="button"
              className="landing-link secondary feed-header-btn"
              onClick={() => navigate("/app")}
            >
              Feed
            </button>
            <button
              type="button"
              className="landing-link feed-header-btn feed-header-logout"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <section className="home-content-wrap">
        <div className="home-headline">
          <h1>Departments</h1>
          <p className="home-meta">
            {loading
              ? "Loading departments..."
              : `${totalDepartments} department${totalDepartments === 1 ? "" : "s"} available`}
          </p>

          {!canManageSubscriptions ? (
            <p className="home-text">
              Guest sessions can browse all departments. Sign in with an account to subscribe.
            </p>
          ) : (
            <p className="home-text">
              You are subscribed to {subscriptionIds.length} department
              {subscriptionIds.length === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        <div className="dept-groups-wrap">
          {!loading && departments.length === 0 ? (
            <p className="home-text">No active departments found.</p>
          ) : null}

          <div className="dept-grid">
            {departments.map((department) => {
              const isSubscribed = subscriptionIds.includes(department._id);
              const isBusy = busyDepartmentId === department._id;
              const buttonDisabled = !canManageSubscriptions || isBusy;

              return (
                <article className="dept-card" key={department._id}>
                  <img
                    className="dept-image"
                    src={department.displayImage || deptFallbackImage}
                    alt={`${department.deptName} display`}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = deptFallbackImage;
                    }}
                  />

                  <div className="dept-body">
                    <p className="dept-code">{department.deptCode}</p>
                    <h3>{department.deptName}</h3>
                    <p className="dept-school">{department.school || "Campus School"}</p>
                    <p className="dept-description">
                      {department.description || "Official announcements and departmental updates."}
                    </p>

                    <div className="dept-actions">
                      <span>{department.subscriberCount || 0} subscribers</span>
                      <button
                        type="button"
                        className={isSubscribed ? "dept-toggle subscribed" : "dept-toggle"}
                        onClick={() => handleToggleSubscription(department._id)}
                        disabled={buttonDisabled}
                      >
                        {isBusy
                          ? "Updating..."
                          : !canManageSubscriptions
                            ? "Guest session"
                            : isSubscribed
                              ? "Subscribed"
                              : "Subscribe"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;

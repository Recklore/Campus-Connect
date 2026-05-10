import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { searchApi, userApi } from "../lib/api";

function Search() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await userApi.getMe();
        setCurrentUser(response.data?.data || null);
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        setStatus(error.message || "Unable to load user session");
      }
    };

    loadCurrentUser();
  }, [navigate]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setUsers([]);
      setDepartments([]);
      setPage(1);
      setHasMore(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setStatus("");

      try {
        const response = await searchApi.globalSearch({ q: trimmed, type, limit: 12, page: 1 });
        setUsers(response.data?.data?.users || []);
        setDepartments(response.data?.data?.departments || []);
        setPage(1);
        setHasMore(Boolean(response.data?.data?.hasMore));
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        setStatus(error.message || "Unable to search right now");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, type, navigate]);

  const showPrompt = query.trim().length < 2;
  const isEmpty = !loading && !showPrompt && users.length === 0 && departments.length === 0;

  const handleLoadMore = async () => {
    const trimmed = query.trim();
    if (!trimmed || !hasMore || loadingMore) return;

    setLoadingMore(true);
    setStatus("");
    try {
      const nextPage = page + 1;
      const response = await searchApi.globalSearch({ q: trimmed, type, limit: 12, page: nextPage });
      setUsers((prev) => [...prev, ...(response.data?.data?.users || [])]);
      setDepartments((prev) => [...prev, ...(response.data?.data?.departments || [])]);
      setPage(nextPage);
      setHasMore(Boolean(response.data?.data?.hasMore));
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to load more results");
    } finally {
      setLoadingMore(false);
    }
  };

  const resultSummary = useMemo(() => {
    const total = users.length + departments.length;
    return `${total} result${total === 1 ? "" : "s"}`;
  }, [users.length, departments.length]);

  return (
    <main className="home-shell">
      <AuthenticatedHeader userProfile={currentUser} hideOnScroll={false} />
      <section className="search-content-wrap">
        <div className="search-headline">
          <h1>Search</h1>
          <p className="home-text">Find users and departments from one place.</p>
        </div>

        <div className="search-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, email, enrollment, department..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="search-filter-row">
            {["all", "users", "departments"].map((filter) => (
              <button
                key={filter}
                type="button"
                className={`search-filter-btn ${type === filter ? "active" : ""}`}
                onClick={() => setType(filter)}
              >
                {filter[0].toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {status ? <p className="status-text">{status}</p> : null}
        {loading ? <p className="feed-muted">Searching...</p> : null}
        {!showPrompt ? <p className="feed-muted">{resultSummary}</p> : null}
        {showPrompt ? <p className="feed-muted">Type at least 2 characters to search.</p> : null}
        {isEmpty ? <p className="feed-muted">No results found.</p> : null}

        {users.length > 0 ? (
          <section className="search-section">
            <h3>Users</h3>
            <div className="search-grid">
              {users.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  className="search-result-card"
                  onClick={() => navigate(`/app/users/${user._id}/profile`)}
                >
                  <h4>{user.name}</h4>
                  <p>{user.designation || user.role}</p>
                  <span>{user.department || "No department"}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {departments.length > 0 ? (
          <section className="search-section">
            <h3>Departments</h3>
            <div className="search-grid">
              {departments.map((department) => (
                <button
                  key={department._id}
                  type="button"
                  className="search-result-card"
                  onClick={() => navigate(`/app/departments/${department._id}/profile`)}
                >
                  <h4>{department.deptName}</h4>
                  <p>{department.deptCode}</p>
                  <span>{department.school}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!showPrompt && !loading && hasMore ? (
          <button
            type="button"
            className="feed-load-more"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        ) : null}
      </section>
    </main>
  );
}

export default Search;

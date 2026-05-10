import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Brand from "./Brand";
import avatarImage from "../../assets/curaj.jpg";
import { logoutSession } from "../../lib/authSession";

function AuthenticatedHeader({ userProfile, hideOnScroll = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hideTopUi, setHideTopUi] = useState(false);
  const menuRef = useRef(null);

  // Scroll visibility logic
  useEffect(() => {
    if (!hideOnScroll) {
      return;
    }

    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 20) {
        setHideTopUi(false);
      } else if (currentScrollY > lastScrollY && currentScrollY > 96) {
        setHideTopUi(true);
      } else if (currentScrollY < lastScrollY) {
        setHideTopUi(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hideOnScroll]);

  // Outside click handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logoutSession();
    navigate("/auth/login", { replace: true });
  };

  const isSenior = useMemo(
    () => userProfile && ["senior", "dept_admin", "univ_admin"].includes(userProfile.role),
    [userProfile],
  );

  const canSearch = useMemo(
    () => userProfile && ["student", "senior", "dept_admin", "univ_admin"].includes(userProfile.role),
    [userProfile],
  );

  const isDeptAdmin = useMemo(
    () => userProfile && ["dept_admin", "univ_admin"].includes(userProfile.role),
    [userProfile],
  );

  const isUnivAdmin = useMemo(
    () => userProfile && userProfile.role === "univ_admin",
    [userProfile],
  );

  // Determine current page
  const getCurrentPage = useMemo(() => {
    const pathname = location.pathname;
    if (pathname === "/app") return "feed";
    if (pathname === "/app/departments") return "departments";
    if (pathname === "/app/profile") return "profile";
    if (pathname === "/app/posts/me") return "myPosts";
    if (pathname === "/app/posts/new") return "newPost";
    if (pathname.startsWith("/app/discussions")) return "discussions";
    if (pathname === "/app/admin/dashboard") return "dashboard";
    if (pathname === "/admin/auditlogs") return "auditLogs";
    if (pathname === "/admin/objections") return "objections";
    if (pathname === "/app/notifications") return "notifications";
    if (pathname === "/app/search") return "search";
    return null;
  }, [location.pathname]);

  // Build menu items array
  const menuItems = useMemo(() => {
    const items = [];

    // Common items
    items.push({ id: "feed", label: "Feed", route: "/app" });
    items.push({ id: "departments", label: "Departments", route: "/app/departments" });
    items.push({ id: "discussions", label: "Discussions", route: "/app/discussions" });
    items.push({ id: "notifications", label: "Notifications", route: "/app/notifications" });
    if (canSearch) {
      items.push({ id: "search", label: "Search", route: "/app/search" });
    }

    // Senior-specific items
    if (isSenior) {
      items.push({ id: "myPosts", label: "My Posts", route: "/app/posts/me" });
      items.push({ id: "newPost", label: "New Post", route: "/app/posts/new" });
    }

    // Admin-specific items
    if (isDeptAdmin) {
      items.push({ id: "auditLogs", label: "Audit Logs", route: "/admin/auditlogs" });
      items.push({ id: "objections", label: "Objection Review", route: "/admin/objections" });
    }

    if (isUnivAdmin) {
      items.push({ id: "dashboard", label: "Dashboard", route: "/app/admin/dashboard" });
    }

    // Remove duplicates by id and filter out current page item
    const uniqueItems = items.filter(
      (item, index, self) => self.findIndex((candidate) => candidate.id === item.id) === index,
    );
    const filteredItems = uniqueItems.filter((item) => item.id !== getCurrentPage);

    // Sort alphabetically (except Profile and Logout which are handled specially)
    filteredItems.sort((a, b) => a.label.localeCompare(b.label));

    return filteredItems;
  }, [isSenior, isDeptAdmin, isUnivAdmin, canSearch, getCurrentPage]);

  const headerClass = hideOnScroll ? `landing-topbar feed-page-topbar ${hideTopUi ? "is-hidden" : ""}` : "landing-topbar feed-page-topbar";

  return (
    <header className={headerClass}>
      <div className="landing-topbar-inner">
        <Brand />
        <div className="landing-top-actions" aria-label="Navigation">
          <div className="feed-menu" ref={menuRef}>
            <button
              type="button"
              className="feed-menu-button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={isMenuOpen}
            >
              <img
                src={avatarImage}
                alt="Profile"
                className="feed-menu-avatar"
              />
            </button>
            {isMenuOpen ? (
              <div className="feed-menu-dropdown" role="menu">
                {/* Profile - always first (unless current page) */}
                {getCurrentPage !== "profile" && (
                  <button
                    type="button"
                    className="feed-menu-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate("/app/profile");
                    }}
                    role="menuitem"
                  >
                    Profile
                  </button>
                )}

                {/* All other menu items - alphabetically sorted */}
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="feed-menu-item"
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate(item.route);
                    }}
                    role="menuitem"
                  >
                    {item.label}
                  </button>
                ))}

                {/* Logout - always last */}
                <button
                  type="button"
                  className="feed-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  role="menuitem"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export default AuthenticatedHeader;

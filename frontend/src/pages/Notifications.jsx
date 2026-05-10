import { useEffect, useState } from "react";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import NotificationPanel from "../components/common/NotificationPanel";
import { userApi } from "../lib/api";

/**
 * Notifications Page
 * Displays user's notifications with filtering and management options
 * Now uses authenticated shell for visual consistency with app pages
 */
export default function Notifications() {
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    document.title = "Notifications - Campus Connect";

    const loadProfile = async () => {
      try {
        const response = await userApi.getMe();
        setUserProfile(response.data?.data || null);
      } catch (error) {
        if (error.status !== 401) {
          console.error("Failed to load user profile", error);
        }
      }
    };

    loadProfile();
  }, []);

  return (
    <main className="post-list-shell">
      <AuthenticatedHeader userProfile={userProfile} hideOnScroll={false} />

      <section className="post-list-content">
        <div className="page-headline">
          <h1>Notifications</h1>
          <p>Stay updated on posts, objections, and system events.</p>
        </div>

        <NotificationPanel />
      </section>
    </main>
  );
}

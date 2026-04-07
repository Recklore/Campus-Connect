import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../components/common/Brand";
import buildingImage from "../assets/curaj_admin_building.png";
import logoImage from "../assets/curaj.jpg";
import { publicApi } from "../lib/api";

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

function Landing() {
  const [preview, setPreview] = useState({ departments: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [activeDeptIndex, setActiveDeptIndex] = useState(0);
  const [activePostIndex, setActivePostIndex] = useState(0);
  const previewRef = useRef(null);

  const isImageAttachment = (attachment) =>
    String(attachment?.mimeType || "")
      .toLowerCase()
      .startsWith("image/");

  const resolveAttachmentImage = (attachment) => {
    const storedName = String(attachment?.storedName || "").trim();
    if (/^https?:\/\//i.test(storedName)) {
      return storedName;
    }
    return logoImage;
  };

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const response = await publicApi.getLandingPreview();
        const data = response.data?.data || {};

        setPreview({
          departments: Array.isArray(data.departments) ? data.departments : [],
          posts: Array.isArray(data.posts) ? data.posts : [],
        });
        setActiveDeptIndex(0);
        setActivePostIndex(0);
      } catch (error) {
        setStatus(error.message || "Unable to load campus preview right now");
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, []);

  useEffect(() => {
    const element = previewRef.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPreviewVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (preview.departments.length <= 1) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setActiveDeptIndex((prev) => (prev + 1) % preview.departments.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [preview.departments]);

  useEffect(() => {
    if (preview.posts.length <= 1) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setActivePostIndex((prev) => (prev + 1) % preview.posts.length);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [preview.posts]);

  return (
    <main className="landing-shell">
      <section className="landing-hero" style={{ backgroundImage: `url(${buildingImage})` }}>
        <div className="landing-hero-overlay" />

        <header className="landing-topbar">
          <div className="landing-topbar-inner">
            <Brand />
            <nav className="landing-top-actions" aria-label="Primary actions">
              <Link className="landing-link secondary" to="/auth/login">
                Log in
              </Link>
              <Link className="landing-link" to="/auth/signup">
                Sign up
              </Link>
            </nav>
          </div>
        </header>

        <div className="landing-content-wrap">
          <section className="landing-hero-copy">
            <h1>Stay updated with official campus announcements in one place.</h1>
            <p>Discover department updates quickly and start your campus feed in seconds.</p>
            <div className="landing-cta-row">
              <Link className="landing-cta primary" to="/auth/signup">
                Get started
              </Link>
            </div>
          </section>
        </div>
      </section>

      <section
        ref={previewRef}
        className={`landing-preview reveal-on-scroll ${previewVisible ? "is-visible" : ""}`}
        aria-live="polite"
      >
        <div className="landing-preview-head">
          <h2>Campus Pulse</h2>
          <p>Live preview from active departments and official posts.</p>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        <div className="landing-preview-grid">
          <article className="landing-panel">
            <h3>Featured Departments</h3>
            {loading ? <p className="landing-muted">Loading departments...</p> : null}
            {!loading && preview.departments.length === 0 ? (
              <p className="landing-muted">No departments available right now.</p>
            ) : null}
            {preview.departments.length > 0 ? (
              <>
                <div className="landing-dept-slider" aria-live="polite">
                  <div
                    className="landing-dept-track"
                    style={{ transform: `translateX(-${activeDeptIndex * 100}%)` }}
                  >
                    {preview.departments.map((department) => (
                      <article className="landing-dept-slide" key={department._id || department.deptCode}>
                        {department.displayImage ? (
                          <img
                            className="landing-dept-image"
                            src={department.displayImage}
                            alt={`${department.deptName} display`}
                            loading="lazy"
                          />
                        ) : (
                          <div className="landing-dept-image landing-dept-image-fallback" aria-hidden="true" />
                        )}

                        <div className="landing-dept-meta">
                          <p className="landing-card-chip">{department.deptCode || "Dept"}</p>
                          <h4>{department.deptName || "Department"}</h4>
                          <span>{department.school || "Campus School"}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="landing-dept-dots" role="tablist" aria-label="Featured departments">
                  {preview.departments.map((department, index) => (
                    <button
                      key={department._id || `${department.deptCode}-${index}`}
                      type="button"
                      className={`landing-dept-dot ${index === activeDeptIndex ? "is-active" : ""}`}
                      onClick={() => setActiveDeptIndex(index)}
                      aria-label={`Show ${department.deptName}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </article>

          <article className="landing-panel">
            <h3>Featured Posts</h3>
            {loading ? <p className="landing-muted">Loading posts...</p> : null}
            {!loading && preview.posts.length === 0 ? (
              <p className="landing-muted">No official posts published yet.</p>
            ) : null}
            {preview.posts.length > 0 ? (
              <>
                <div className="landing-post-slider" aria-live="polite">
                  <div
                    className="landing-post-track"
                    style={{ transform: `translateX(-${activePostIndex * 100}%)` }}
                  >
                    {preview.posts.map((post) => {
                      const attachment = post.selectedAttachment;
                      const hasAttachment = Boolean(attachment?.originalName);
                      const hasImageAttachment = hasAttachment && isImageAttachment(attachment);

                      return (
                        <article className="landing-post-slide" key={post._id}>
                          {hasAttachment ? (
                            hasImageAttachment ? (
                              <img
                                className="landing-post-image"
                                src={resolveAttachmentImage(attachment)}
                                alt={`${post.title} attachment`}
                                loading="lazy"
                              />
                            ) : (
                              <div className="landing-post-file" role="img" aria-label="Non-image attachment">
                                <p>Attachment</p>
                                <h4>{attachment.originalName}</h4>
                                <span>{attachment.mimeType || "application/octet-stream"}</span>
                              </div>
                            )
                          ) : (
                            <div className="landing-post-file" role="img" aria-label="No attachment available">
                              <p>Attachment</p>
                              <h4>No attachment</h4>
                              <span>Not available for this post</span>
                            </div>
                          )}

                          <div className="landing-post-meta">
                            <p className="landing-card-chip">
                              {post.department?.deptName || "Department"}
                              {post.createdAt ? ` • ${formatDate(post.createdAt)}` : ""}
                            </p>
                            <h4>{post.title || "Official update"}</h4>
                            <span>{post.department?.school || "Campus School"}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="landing-post-dots" role="tablist" aria-label="Featured posts">
                  {preview.posts.map((post, index) => (
                    <button
                      key={post._id || `${post.title}-${index}`}
                      type="button"
                      className={`landing-post-dot ${index === activePostIndex ? "is-active" : ""}`}
                      onClick={() => setActivePostIndex(index)}
                      aria-label={`Show post ${index + 1}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </article>
        </div>
      </section>

      <footer className="landing-footer">
        <p>Campus Connect • Central University of Rajasthan</p>
      </footer>
    </main>
  );
}

export default Landing;

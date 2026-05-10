import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthenticatedHeader from "../components/common/AuthenticatedHeader";
import { departmentApi, postApi, userApi } from "../lib/api";

const ROLE_CAN_POST = new Set(["senior", "dept_admin", "univ_admin"]);

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageFile = (file) => file?.type?.startsWith("image/");

function PostCreate() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [canPost, setCanPost] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [userProfile, setUserProfile] = useState(null);

  const totalAttachments = attachments.length;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [userResponse, departmentResponse] = await Promise.all([
          userApi.getMe(),
          departmentApi.getAll(),
        ]);

        const role = userResponse.data?.data?.role || "guest";
        setCanPost(ROLE_CAN_POST.has(role));
        // store departments for other views if needed
        const grouped = departmentResponse.data?.data || {};
        const flattened = Object.values(grouped).flatMap((items) => items || []);
        setDepartments(flattened);

        // set user profile returned by API (includes departmentInfo when resolvable)
        setUserProfile(userResponse.data?.data || null);
      } catch (error) {
        if (error.status === 401) {
          navigate("/auth/login", { replace: true });
          return;
        }
        setStatus(error.message || "Unable to load departments");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  useEffect(() => {
    const nextPreviews = attachments.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      url: isImageFile(file) ? URL.createObjectURL(file) : "",
    }));

    setAttachmentPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((preview) => {
        if (preview.url) {
          URL.revokeObjectURL(preview.url);
        }
      });
    };
  }, [attachments]);

  const departmentOptions = useMemo(
    () => departments.sort((a, b) => (a.deptName || "").localeCompare(b.deptName || "")),
    [departments],
  );

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const merged = [...attachments, ...files].slice(0, 5);
    setAttachments(merged);
    event.target.value = "";
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    if (!canPost) {
      setStatus("Only senior staff can create posts right now.");
      return;
    }

    if (!title.trim() || title.trim().length < 5) {
      setStatus("Please enter a longer title.");
      return;
    }

    if (!body.trim() || body.trim().length < 20) {
      setStatus("Please enter a fuller announcement body.");
      return;
    }

    // department will be resolved on the server from the author's profile; no client selection needed

    if (attachments.length > 5) {
      setStatus("A post cannot have more than 5 attachments.");
      return;
    }

    setSaving(true);

    try {
      const response = await postApi.createPost({
        title: title.trim(),
        body: body.trim(),
        attachments,
      });

      const createdId = response.data?.data?._id;
      if (createdId) {
        navigate(`/app/posts/${createdId}`);
      } else {
        navigate("/app/posts/me");
      }
    } catch (error) {
      if (error.status === 401) {
        navigate("/auth/login", { replace: true });
        return;
      }
      setStatus(error.message || "Unable to create post right now");
    } finally {
      setSaving(false);
    }
  };


  return (
    <main className="post-create-shell">
      <AuthenticatedHeader userProfile={userProfile} hideOnScroll={false} />

      <section className="post-create-content">
        <div className="post-create-headline">
          <h1>Compose an official update</h1>
          <p>Share verified announcements with your department audience.</p>
        </div>

        {status ? <p className="status-text">{status}</p> : null}

        {loading ? (
          <p className="feed-muted">Loading departments...</p>
        ) : (
          <form className="post-create-form" onSubmit={handleSubmit}>
            {!canPost ? (
              <p className="feed-muted">
                Only senior staff can publish posts. You can still view departments and the feed.
              </p>
            ) : null}
            <label className="post-field">
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Semester results are now live"
                maxLength={150}
                required
              />
            </label>

            <label className="post-field">
              <span>Department</span>
              <div className="feed-muted">
                {userProfile?.departmentInfo
                  ? `${userProfile.departmentInfo.deptName} (${userProfile.departmentInfo.deptCode})`
                  : "(none)"}
              </div>
            </label>

            <label className="post-field">
              <span>Body</span>
              <textarea
                rows={8}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Provide the announcement details, timelines, and next steps."
                maxLength={10000}
                required
              />
            </label>

            <div className="post-field">
              <span>Attachments (max 5)</span>
              <div className="post-attachment-upload">
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleFileChange}
                />
                <p>{totalAttachments} file{totalAttachments === 1 ? "" : "s"} selected</p>
              </div>

              {attachmentPreviews.length > 0 ? (
                <div className="post-attachment-grid">
                  {attachmentPreviews.map((file, index) => (
                    <article className="post-attachment-card" key={`${file.name}-${index}`}>
                      {file.url ? (
                        <img src={file.url} alt={file.name} />
                      ) : (
                        <div className="post-attachment-file">
                          <p>Attachment</p>
                          <h4>{file.name}</h4>
                          <span>{formatFileSize(file.size)}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="post-attachment-remove"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="post-create-actions">
              <button
                type="button"
                className="landing-link secondary"
                onClick={() => navigate("/app/posts/me")}
              >
                View my posts
              </button>
              <button type="submit" className="landing-link" disabled={!canPost || saving}>
                {saving ? "Publishing..." : "Publish post"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default PostCreate;

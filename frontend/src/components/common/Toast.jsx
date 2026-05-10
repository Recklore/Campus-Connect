export default function Toast({ id, message, type = "info", onRemove }) {
  const label = {
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Info",
  }[type] || "Info";

  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="polite">
      <span className="toast-icon">{label}</span>
      <p className="toast-message">{message}</p>
      {typeof onRemove === "function" ? (
        <button
          type="button"
          onClick={() => onRemove(id)}
          className="toast-close"
          aria-label="Dismiss notification"
        >
          x
        </button>
      ) : null}
    </div>
  );
}

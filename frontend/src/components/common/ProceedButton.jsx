function ProceedButton({
  children = "Proceed ->",
  type = "submit",
  loading = false,
  disabled = false,
  onClick,
}) {
  return (
    <button type={type} className="proceed-button" disabled={disabled || loading} onClick={onClick}>
      {loading ? "Please wait..." : children}
    </button>
  );
}

export default ProceedButton;

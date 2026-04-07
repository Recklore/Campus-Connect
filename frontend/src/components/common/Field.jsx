import { useState } from "react";

function EyeIcon({ crossed = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="field-eye-icon">
      <path d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12z" />
      <circle cx="12" cy="12" r="3.25" />
      {crossed ? <path d="M4 20L20 4" /> : null}
    </svg>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  maxLength,
  autoComplete = "off",
  error,
}) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordField = type === "password";
  const inputType = isPasswordField
    ? (isPasswordVisible ? "text" : "password")
    : type;

  return (
    <div className="field-wrap">
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <div className="field-input-wrap">
        <input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          className={error ? "field-input field-input-error" : "field-input"}
        />
        {isPasswordField ? (
          <button
            type="button"
            className="field-visibility-toggle"
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
          >
            <EyeIcon crossed={!isPasswordVisible} />
          </button>
        ) : null}
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export default Field;

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Brand from "../components/common/Brand";
import Field from "../components/common/Field";
import FormPanel from "../components/common/FormPanel";
import ProceedButton from "../components/common/ProceedButton";
import AuthLayout from "../components/layouts/AuthLayout";
import { authApi } from "../lib/api";
import { isStrongPassword } from "../lib/authValidators";
import { footStyle, headingStyle, linkStyle, subtitleStyle } from "../styles/shared";

function ForgotPasswordVerify() {
  const navigate = useNavigate();
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const resetToken = useMemo(() => paramToken || searchParams.get("token") || "", [paramToken, searchParams]);
  const hasValidToken = /^[a-f0-9]{64}$/.test(resetToken.trim());

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetComplete, setIsResetComplete] = useState(false);

  const validateForm = () => {
    const nextErrors = {};

    if (!isStrongPassword(password)) {
      nextErrors.password = "Use 8-64 chars with uppercase, lowercase, number and symbol.";
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");
    setErrors({});

    if (!hasValidToken) {
      setStatus("Invalid or missing reset token. Please use the reset link from your email.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.forgotPasswordVerify(resetToken.trim(), { password });
      setStatus(response.data.message || "Password changed successfully");
      setIsResetComplete(true);
    } catch (error) {
      const message = error.message || "Invalid token";

      if (message.toLowerCase().includes("old password")) {
        setErrors({
          password: "New password must be different from your previous password.",
          confirmPassword: "New password must be different from your previous password.",
        });
        setStatus("");
      } else {
        setStatus(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout photoSide="right">
      <FormPanel barVariant="reverse">
        <Brand />

        <div className="form-header">
          <h1 style={headingStyle}>Set new password</h1>
          <p style={subtitleStyle}>Choose a strong new password to secure your account.</p>
        </div>

        {!hasValidToken ? <p className="status-text">Invalid or missing reset link. Please request a new one.</p> : null}

        {status ? <p className="status-text">{status}</p> : null}

        {hasValidToken && !isResetComplete ? (
          <form onSubmit={handleSubmit} noValidate>
            <Field
              label="New Password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
              placeholder="Min. 8 characters with symbols"
              autoComplete="new-password"
              error={errors.password}
            />

            <Field
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              error={errors.confirmPassword}
            />

            <ProceedButton loading={loading}>Proceed -&gt;</ProceedButton>
          </form>
        ) : null}

        {isResetComplete ? (
          <ProceedButton type="button" onClick={() => navigate("/auth/login")}>Proceed to login -&gt;</ProceedButton>
        ) : null}

        {!hasValidToken ? (
          <ProceedButton type="button" onClick={() => navigate("/auth/forgotPass/init")}>Request new reset link -&gt;</ProceedButton>
        ) : null}

        <p style={footStyle}>
          Back to sign in? <Link to="/auth/login" style={linkStyle}>Log in</Link>
        </p>
      </FormPanel>
    </AuthLayout>
  );
}

export default ForgotPasswordVerify;

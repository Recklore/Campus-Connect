import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/common/Brand";
import Field from "../components/common/Field";
import FormPanel from "../components/common/FormPanel";
import ProceedButton from "../components/common/ProceedButton";
import RoleTabs from "../components/common/RoleTabs";
import AuthLayout from "../components/layouts/AuthLayout";
import { authApi } from "../lib/api";
import {
  isStrongPassword,
  normalizeIdentifier,
  validateIdentifier,
} from "../lib/authValidators";
import { footStyle, headingStyle, linkStyle, subtitleStyle } from "../styles/shared";

function Signup() {
  const navigate = useNavigate();
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({
    enrollmentNumber: "",
    emailId: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignupSubmitted, setIsSignupSubmitted] = useState(false);
  const [signupPayload, setSignupPayload] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const identifierKey = role === "student" ? "enrollmentNumber" : "emailId";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!validateIdentifier(role, form[identifierKey])) {
      nextErrors[identifierKey] =
        role === "student"
          ? "Use valid enrollment number format (e.g. 2021CSEIT001)."
          : "Use your @curaj.ac.in email.";
    }

    if (!isStrongPassword(form.password)) {
      nextErrors.password = "Use 8-64 chars with uppercase, lowercase, number and symbol.";
    }

    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        role,
        [identifierKey]: normalizeIdentifier(role, form[identifierKey]),
        password: form.password,
      };

      const response = await authApi.signup(payload);
      setStatus(response.data.message || "Please check your email inbox for further instructions");
      setSignupPayload(payload);
      setIsSignupSubmitted(true);
      setResendCooldown(30);
    } catch (error) {
      setStatus(error.message || "Bad request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!signupPayload || resendCooldown > 0) {
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      const response = await authApi.signupResend(signupPayload);
      setStatus(response.data.message || "Verification email sent successfully");
      setResendCooldown(30);
    } catch (error) {
      setStatus(error.message || "Unable to resend verification link");
    } finally {
      setLoading(false);
    }
  };

  const handleSignupAgain = () => {
    setIsSignupSubmitted(false);
    setStatus("");
    setErrors({});
    setResendCooldown(0);
  };

  const handleGuestLogin = async () => {
    setStatus("");
    setErrors({});
    setLoading(true);
    try {
      const response = await authApi.guestLogin();
      if (response.data.success) {
        navigate("/app", { replace: true });
        return;
      }
      setStatus(response.data.message || "Logged in as guest");
    } catch (error) {
      setStatus(error.message || "Unable to continue as guest");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout photoSide="left">
      <FormPanel>
        <Brand />

        <div className="form-header">
          <h1 style={headingStyle}>Create your account</h1>
          <p style={subtitleStyle}>Join the campus network - it only takes a moment.</p>
        </div>

        {!isSignupSubmitted ? (
          <form onSubmit={handleSubmit} noValidate>
            <RoleTabs activeRole={role} onChange={setRole} />

            {role === "student" ? (
              <Field
                label="Enrollment Number"
                name="enrollmentNumber"
                value={form.enrollmentNumber}
                onChange={handleChange}
                placeholder="e.g. 2021CSEIT001"
                maxLength={14}
                error={errors.enrollmentNumber}
              />
            ) : (
              <Field
                label="University Email"
                name="emailId"
                type="email"
                value={form.emailId}
                onChange={handleChange}
                placeholder="yourname@curaj.ac.in"
                error={errors.emailId}
              />
            )}

            <Field
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Min. 8 characters with symbols"
              autoComplete="new-password"
              error={errors.password}
            />

            <Field
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              error={errors.confirmPassword}
            />

            {status ? <p className="status-text">{status}</p> : null}

            <ProceedButton loading={loading}>Proceed</ProceedButton>

            <p className="guest-access-row">
              Just browsing?{" "}
              <button
                type="button"
                className="guest-access-link"
                onClick={handleGuestLogin}
                disabled={loading}
              >
                Continue as guest
              </button>
            </p>
          </form>
        ) : (
          <div className="post-signup-wrap">
            {status ? <p className="status-text">{status}</p> : null}

            <ProceedButton type="button" onClick={() => navigate("/auth/login")}>Go to login</ProceedButton>

            <button
              type="button"
              className="secondary-text-action"
              onClick={handleSignupAgain}
            >
              Sign up with different details
            </button>

            <button
              type="button"
              className="secondary-text-action"
              onClick={handleResendVerification}
              disabled={loading || resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Resend verification link in ${resendCooldown}s`
                : "Resend verification link"}
            </button>
          </div>
        )}

        <p style={footStyle}>
          Already have an account? <Link to="/auth/login" style={linkStyle}>Log in</Link>
        </p>
      </FormPanel>
    </AuthLayout>
  );
}

export default Signup;

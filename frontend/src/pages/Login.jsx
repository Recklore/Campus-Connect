import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/common/Brand";
import Field from "../components/common/Field";
import FormPanel from "../components/common/FormPanel";
import ProceedButton from "../components/common/ProceedButton";
import RoleTabs from "../components/common/RoleTabs";
import AuthLayout from "../components/layouts/AuthLayout";
import { authApi } from "../lib/api";
import { normalizeIdentifier, validateIdentifier } from "../lib/authValidators";
import { footStyle, headingStyle, linkStyle, subtitleStyle } from "../styles/shared";

function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ enrollmentNumber: "", emailId: "", password: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const identifierKey = role === "student" ? "enrollmentNumber" : "emailId";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setErrors({});
    setStatus("");
  };

  const validateForm = () => {
    const nextErrors = {};
    const identifierValue = form[identifierKey];

    if (!validateIdentifier(role, identifierValue)) {
      nextErrors[identifierKey] =
        role === "student"
          ? "Use valid enrollment number format (e.g. 2021CSEIT001)."
          : "Use your @curaj.ac.in email.";
    }

    if (!form.password || form.password.length < 8 || form.password.length > 64) {
      nextErrors.password = "Password length must be between 8 and 64 characters.";
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

      const response = await authApi.login(payload);
      if (response.data.success) {
        navigate("/app", { replace: true });
        return;
      }
      setStatus(response.data.message || "Login successful");
      setErrors({});
    } catch (error) {
      setStatus(error.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
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
    <AuthLayout photoSide="right">
      <FormPanel barVariant="reverse">
        <Brand />

        <div className="form-header">
          <h1 style={headingStyle}>Welcome back</h1>
          <p style={subtitleStyle}>Sign in to access your campus account.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <RoleTabs activeRole={role} onChange={handleRoleChange} />

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
            placeholder="Enter your password"
            autoComplete="current-password"
            error={errors.password}
          />

          <div className="inline-link-row">
            <Link to="/auth/forgotPass/init" className="inline-link">
              Forgot password?
            </Link>
          </div>

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

        <p style={footStyle}>
          Don&apos;t have an account? <Link to="/auth/signup" style={linkStyle}>Sign up</Link>
        </p>
      </FormPanel>
    </AuthLayout>
  );
}

export default Login;

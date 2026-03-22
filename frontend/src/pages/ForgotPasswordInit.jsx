import { useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../components/common/Brand";
import Field from "../components/common/Field";
import FormPanel from "../components/common/FormPanel";
import ProceedButton from "../components/common/ProceedButton";
import RoleTabs from "../components/common/RoleTabs";
import AuthLayout from "../components/layouts/AuthLayout";
import { authApi } from "../lib/api";
import { normalizeIdentifier, validateIdentifier } from "../lib/authValidators";
import { footStyle, headingStyle, linkStyle, subtitleStyle } from "../styles/shared";

function ForgotPasswordInit() {
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ enrollmentNumber: "", emailId: "" });
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("");

    if (!validateIdentifier(role, form[identifierKey])) {
      setErrors({
        [identifierKey]:
          role === "student"
            ? "Use valid enrollment number format (e.g. 2021CSEIT001)."
            : "Use your @curaj.ac.in email.",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = { role, [identifierKey]: normalizeIdentifier(role, form[identifierKey]) };
      const response = await authApi.forgotPasswordInit(payload);
      setStatus(response.data.message || "Please check your email inbox for further instructions");
      setErrors({});
    } catch (error) {
      setStatus(error.message || "Bad request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout photoSide="right">
      <FormPanel barVariant="reverse">
        <Brand />

        <div className="form-header">
          <h1 style={headingStyle}>Reset your password</h1>
          <p style={subtitleStyle}>Enter your identifier and we will send reset instructions.</p>
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

          {status ? <p className="status-text">{status}</p> : null}

          <ProceedButton loading={loading}>Send reset link -&gt;</ProceedButton>
        </form>

        <p style={footStyle}>
          Remember your password? <Link to="/auth/login" style={linkStyle}>Log in</Link>
        </p>
      </FormPanel>
    </AuthLayout>
  );
}

export default ForgotPasswordInit;

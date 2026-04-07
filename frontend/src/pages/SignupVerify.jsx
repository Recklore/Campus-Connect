import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Brand from "../components/common/Brand";
import FormPanel from "../components/common/FormPanel";
import ProceedButton from "../components/common/ProceedButton";
import AuthLayout from "../components/layouts/AuthLayout";
import { authApi } from "../lib/api";
import { footStyle, headingStyle, linkStyle, subtitleStyle } from "../styles/shared";

function SignupVerify() {
  const navigate = useNavigate();
  const { token: paramToken } = useParams();
  const verifyToken = (paramToken || "").trim();

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const attemptVerification = async () => {
      if (!/^[a-f0-9]{64}$/.test(verifyToken)) {
        setError("Invalid or missing verification link. Please sign up again.");
        return;
      }

      setLoading(true);
      setStatus("");
      setError("");

      try {
        const response = await authApi.signupVerify(verifyToken);
        setStatus(response.data.message || "User registered successfully");
        setIsVerified(true);
      } catch (err) {
        setError(err.message || "Invalid token");
      } finally {
        setLoading(false);
      }
    };

    attemptVerification();
  }, [verifyToken]);

  const renderMessage = () => {
    if (loading) {
      return <p className="status-text">Verifying your account...</p>;
    }

    if (error) {
      return <p className="status-text">{error}</p>;
    }

    if (status) {
      return <p className="status-text">{status}</p>;
    }

    return null;
  };

  return (
    <AuthLayout photoSide="left">
      <FormPanel>
        <Brand />

        <div className="form-header">
          <h1 style={headingStyle}>Verify your account</h1>
          <p style={subtitleStyle}>We are verifying your account using the secure link from your email.</p>
        </div>

        {renderMessage()}

        {isVerified ? (
          <ProceedButton type="button" onClick={() => navigate("/auth/login")}>Proceed to login</ProceedButton>
        ) : null}

        {!loading && !isVerified ? (
          <ProceedButton type="button" onClick={() => navigate("/auth/signup")}>Sign up again</ProceedButton>
        ) : null}

        <p style={footStyle}>
          Back to sign in? <Link to="/auth/login" style={linkStyle}>Log in</Link>
        </p>
      </FormPanel>
    </AuthLayout>
  );
}

export default SignupVerify;

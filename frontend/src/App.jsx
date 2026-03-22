import { Navigate, Route, Routes } from "react-router-dom";
import ForgotPasswordInit from "./pages/ForgotPasswordInit";
import ForgotPasswordVerify from "./pages/ForgotPasswordVerify";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SignupVerify from "./pages/SignupVerify";

function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/signup" element={<Signup />} />

      <Route path="/auth/verify/:token" element={<SignupVerify />} />
      <Route path="/auth/verify" element={<SignupVerify />} />

      <Route path="/auth/forgotPass/init" element={<ForgotPasswordInit />} />
      <Route path="/auth/forgotPass/verify/:token" element={<ForgotPasswordVerify />} />
      <Route path="/auth/forgotPass/verify" element={<ForgotPasswordVerify />} />

      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
}

export default App;

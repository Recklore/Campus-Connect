import { Navigate, Route, Routes } from "react-router-dom";
import Feed from "./pages/Feed";
import ForgotPasswordInit from "./pages/ForgotPasswordInit";
import ForgotPasswordVerify from "./pages/ForgotPasswordVerify";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SignupVerify from "./pages/SignupVerify";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/signup" element={<Signup />} />
      <Route path="/auth/verify/:token" element={<SignupVerify />} />
      <Route path="/auth/forgotPass/init" element={<ForgotPasswordInit />} />
      <Route path="/auth/forgotPass/verify/:token" element={<ForgotPasswordVerify />} />
      <Route path="/app" element={<Feed />} />
      <Route path="/app/departments" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

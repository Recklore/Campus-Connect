import { Navigate, Route, Routes } from "react-router-dom";
import Feed from "./pages/Feed";
import ForgotPasswordInit from "./pages/ForgotPasswordInit";
import ForgotPasswordVerify from "./pages/ForgotPasswordVerify";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import DepartmentPosts from "./pages/DepartmentPosts";
import MyPosts from "./pages/MyPosts";
import PostCreate from "./pages/PostCreate";
import PostDetail from "./pages/PostDetail";
import Profile from "./pages/Profile";
import Signup from "./pages/Signup";
import SignupVerify from "./pages/SignupVerify";
import AdminAuditLogs from "./pages/AdminAuditLogs";
import Notifications from "./pages/Notifications";
import AdminObjectionManagement from "./pages/AdminObjectionManagement";
import AdminDashboard from "./pages/AdminDashboard";
import Discussions from "./pages/Discussions";
import DiscussionDetail from "./pages/DiscussionDetail";
import Search from "./pages/Search";
import UserProfileView from "./pages/UserProfileView";
import DepartmentProfileView from "./pages/DepartmentProfileView";

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
      <Route path="/app/profile" element={<Profile />} />
      <Route path="/app/departments" element={<Home />} />
      <Route path="/app/departments/:departmentId/posts" element={<DepartmentPosts />} />
      <Route path="/app/posts/new" element={<PostCreate />} />
      <Route path="/app/posts/me" element={<MyPosts />} />
      <Route path="/app/posts/:postId" element={<PostDetail />} />
      <Route path="/app/discussions" element={<Discussions />} />
      <Route path="/app/discussions/:id" element={<DiscussionDetail />} />
      <Route path="/app/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/auditlogs" element={<AdminAuditLogs />} />
      <Route path="/admin/objections" element={<AdminObjectionManagement />} />
      <Route path="/app/notifications" element={<Notifications />} />
      <Route path="/app/search" element={<Search />} />
      <Route path="/app/users/:userId/profile" element={<UserProfileView />} />
      <Route path="/app/departments/:departmentId/profile" element={<DepartmentProfileView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

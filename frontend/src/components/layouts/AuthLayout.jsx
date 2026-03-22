import PhotoPanel from "../common/PhotoPanel";

function AuthLayout({ photoSide = "right", children }) {
  const containerClass = photoSide === "left" ? "auth-layout auth-layout-photo-left" : "auth-layout";
  return (
    <div className={containerClass}>
      {photoSide === "left" ? <PhotoPanel /> : null}
      {children}
      {photoSide === "right" ? <PhotoPanel /> : null}
    </div>
  );
}

export default AuthLayout;

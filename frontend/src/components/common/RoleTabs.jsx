function RoleTabs({ activeRole, onChange }) {
  return (
    <div className="role-tabs" role="tablist" aria-label="Select role">
      <button
        type="button"
        role="tab"
        aria-selected={activeRole === "student"}
        className={activeRole === "student" ? "role-tab tab-active" : "role-tab"}
        onClick={() => onChange("student")}
      >
        Student
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeRole === "senior"}
        className={activeRole === "senior" ? "role-tab tab-active" : "role-tab"}
        onClick={() => onChange("senior")}
      >
        Senior / Faculty
      </button>
    </div>
  );
}

export default RoleTabs;

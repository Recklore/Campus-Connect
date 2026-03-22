function FormPanel({ children, barVariant = "default" }) {
  const formClass = barVariant === "reverse" ? "form-panel form-panel-reverse" : "form-panel";
  return <section className={formClass}>{children}</section>;
}

export default FormPanel;

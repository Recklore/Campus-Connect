const BRAND = {
  appName: "Campus Connect",
  colors: {
    primary: "#e39b4a",
    primaryDark: "#c8842e",
    surface: "#fdfcf5",
    canvas: "#f8f6e4",
    text: "#22180a",
    muted: "#7a7060",
    border: "#ddd8c4",
    dark: "#1c1309",
  },
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const appFooter = () => `
  <p style="margin:0;font-size:12px;color:${BRAND.colors.muted};text-align:center;">
    Copyright ${new Date().getFullYear()} ${BRAND.appName}
  </p>
`;

const renderEmailLayout = ({ title, intro, content, ctaLabel, ctaUrl, note }) => {
  const safeTitle = escapeHtml(title);
  const safeIntro = escapeHtml(intro);
  const safeNote = note ? escapeHtml(note) : "";

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
      <p style="margin:22px 0 18px;">
        <a href="${ctaUrl}" target="_blank" rel="noopener" style="
          display:inline-block;
          padding:12px 20px;
          border-radius:10px;
          background:${BRAND.colors.primary};
          border:1px solid ${BRAND.colors.primaryDark};
          color:${BRAND.colors.dark};
          text-decoration:none;
          font-size:14px;
          font-weight:700;
          letter-spacing:0.2px;
        ">
          ${escapeHtml(ctaLabel)}
        </a>
      </p>
    `
      : "";

  const linkBlock =
    ctaUrl
      ? `
      <p style="margin:0 0 14px;color:${BRAND.colors.muted};font-size:13px;line-height:1.5;">
        If the button does not work, open this link in your browser:
        <br />
        <a href="${ctaUrl}" target="_blank" rel="noopener" style="color:${BRAND.colors.primaryDark};word-break:break-all;">
          ${escapeHtml(ctaUrl)}
        </a>
      </p>
    `
      : "";

  const noteBlock =
    safeNote
      ? `<p style="margin:0;color:${BRAND.colors.muted};font-size:13px;line-height:1.5;">${safeNote}</p>`
      : "";

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
    </head>
    <body style="margin:0;background:${BRAND.colors.canvas};font-family:Segoe UI,Roboto,Arial,sans-serif;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center">
            <table width="580" cellpadding="0" cellspacing="0" role="presentation" style="
              background:${BRAND.colors.surface};
              border-radius:14px;
              overflow:hidden;
              border:1px solid ${BRAND.colors.border};
              box-shadow:0 8px 24px rgba(28,19,9,0.08);
            ">
              <tr>
                <td style="padding:0;background:${BRAND.colors.dark};height:6px;"></td>
              </tr>
              <tr>
                <td style="padding:28px 32px 24px;">
                  <h2 style="margin:0 0 10px;color:${BRAND.colors.text};font-size:24px;line-height:1.3;">
                    ${safeTitle}
                  </h2>

                  <p style="margin:0 0 14px;color:${BRAND.colors.muted};font-size:15px;line-height:1.55;">
                    ${safeIntro}
                  </p>

                  ${content}
                  ${ctaBlock}
                  ${linkBlock}
                  ${noteBlock}

                  <hr style="margin:22px 0 16px;border:none;border-top:1px solid ${BRAND.colors.border};" />
                  ${appFooter()}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};

const verifyEmailTemplate = (verifyUrl) => {
  const subject = "Verify your email to continue";
  const html = renderEmailLayout({
    title: "Verify your email",
    intro: "You are almost there. Confirm your email to activate your account and continue.",
    content: "",
    ctaLabel: "Verify Email",
    ctaUrl: verifyUrl,
    note: "If you did not request this, you can safely ignore this email.",
  });

  return { subject, html };
};

const alreadyRegisteredTemplate = (attemptedEmail, loginUrl) => {
  const subject = "Account already exists for this email";
  const html = renderEmailLayout({
    title: "This email is already registered",
    intro: "A signup attempt was made using the following email.",
    content: `
      <p style="margin:0 0 16px;color:${BRAND.colors.text};font-size:15px;line-height:1.55;">
        <strong>${escapeHtml(attemptedEmail)}</strong>
      </p>
      <p style="margin:0 0 12px;color:${BRAND.colors.muted};font-size:14px;line-height:1.55;">
        An account already exists for this address. You can proceed to login.
      </p>
    `,
    ctaLabel: "Go to Login",
    ctaUrl: loginUrl,
    note: "If this was not you, you can ignore this email.",
  });

  return { subject, html };
};

const notInRecordsTemplate = (attemptedEmail) => {
  const subject = "We could not verify this email";
  const html = renderEmailLayout({
    title: "Email not found in records",
    intro: "We received a signup attempt, but this email could not be matched with our records.",
    content: `
      <p style="margin:0 0 16px;color:${BRAND.colors.text};font-size:15px;line-height:1.55;">
        <strong>${escapeHtml(attemptedEmail)}</strong>
      </p>
      <p style="margin:0 0 8px;color:${BRAND.colors.muted};font-size:14px;line-height:1.55;">This can happen when:</p>
      <p style="margin:0 0 12px;color:${BRAND.colors.muted};font-size:14px;line-height:1.7;">
        - The email address was entered incorrectly<br />
        - A different university email should be used
      </p>
      <p style="margin:0 0 12px;color:${BRAND.colors.muted};font-size:14px;line-height:1.55;">
        If you believe this is a mistake, please contact your organization support team.
      </p>
    `,
    note: "If you did not attempt signup, you can ignore this email.",
  });

  return { subject, html };
};

const forgotPasswordNotRegisteredTemplate = (attemptedEmail) => {
  const subject = "Password reset request";
  const html = renderEmailLayout({
    title: "No account found for this email",
    intro: "We received a password reset request, but no registered account was found.",
    content: `
      <p style="margin:0 0 16px;color:${BRAND.colors.text};font-size:15px;line-height:1.55;">
        <strong>${escapeHtml(attemptedEmail)}</strong>
      </p>
      <p style="margin:0 0 8px;color:${BRAND.colors.muted};font-size:14px;line-height:1.55;">This can happen when:</p>
      <p style="margin:0 0 12px;color:${BRAND.colors.muted};font-size:14px;line-height:1.7;">
        - The email address was entered incorrectly<br />
        - You signed up with a different email<br />
        - The account has not been created yet
      </p>
      <p style="margin:0 0 12px;color:${BRAND.colors.muted};font-size:14px;line-height:1.55;">
        Please verify the email and try again.
      </p>
    `,
    note: "If you did not request password reset, you can ignore this email.",
  });

  return { subject, html };
};

const forgotPasswordResetLinkTemplate = (resetUrl) => {
  const subject = "Reset your password";
  const html = renderEmailLayout({
    title: "Reset your password",
    intro: "We received a request to reset your password. Use the button below to continue.",
    content: `
      <p style="margin:0 0 12px;color:${BRAND.colors.muted};font-size:14px;line-height:1.55;">
        This reset link can be used once and expires after a short time.
      </p>
    `,
    ctaLabel: "Reset Password",
    ctaUrl: resetUrl,
    note: "If you did not request password reset, you can ignore this email.",
  });

  return { subject, html };
};

module.exports = {
  verifyEmailTemplate,
  alreadyRegisteredTemplate,
  notInRecordsTemplate,
  forgotPasswordNotRegisteredTemplate,
  forgotPasswordResetLinkTemplate,
};

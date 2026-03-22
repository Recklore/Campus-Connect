const verifyEmailTemplate = (verifyUrl) => {
  const subject = "Verify your email to continue";

  const html = `
  <!doctype html>
  <html>
    <body style="margin:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px;">
      <table width="100%" align="center">
        <tr>
          <td align="center">
            <table width="580" style="background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.08);padding:28px 32px;">
              
              <tr>
                <td>
                  <h2 style="color:rgb(12,231,235);margin-bottom:10px;">
                    Verify your email
                  </h2>

                  <p style="color:#333;font-size:15px;">
                    You're almost there! Click the button below to verify your email and continue.
                  </p>

                  <p style="margin:20px 0;">
                    <a href="${verifyUrl}" style="
                      background:rgb(250,172,2);
                      color:#000;
                      padding:12px 20px;
                      border-radius:8px;
                      text-decoration:none;
                      font-weight:600;
                    ">
                      Verify Email
                    </a>
                  </p>

                  <p style="font-size:13px;color:#666;">
                    If the button doesn't work, use this link:
                    <br/>
                    <a href="${verifyUrl}" style="color:rgb(12,231,235);word-break:break-all;">
                      ${verifyUrl}
                    </a>
                  </p>

                  <p style="font-size:13px;color:#666;margin-top:15px;">
                    If you didn’t request this, you can safely ignore this email.
                  </p>

                  <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />

                  <p style="font-size:12px;color:#999;text-align:center;">
                    © ${new Date().getFullYear()} YourApp
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  return { subject, html };
};

const alreadyRegisteredTemplate = (attemptedEmail, loginUrl) => {
  const subject = "Account already exists for this email";

  const html = `
  <!doctype html>
  <html>
    <body style="margin:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px;">
      <table width="100%" align="center">
        <tr>
          <td align="center">
            <table width="580" style="background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.06);padding:28px 32px;">
              
              <tr>
                <td>
                  <h2 style="color:rgb(12,231,235);margin-bottom:10px;">
                    This email is already registered
                  </h2>

                  <p style="color:#333;font-size:15px;">
                    A signup attempt was made using:
                  </p>

                  <p style="font-weight:600;color:#111;">
                    ${attemptedEmail}
                  </p>

                  <p style="color:#333;font-size:15px;">
                    An account already exists with this email.
                  </p>

                  <p style="margin:20px 0;">
                    <a href="${loginUrl}" style="
                      border:2px solid rgb(250,172,2);
                      color:rgb(250,172,2);
                      padding:10px 18px;
                      border-radius:8px;
                      text-decoration:none;
                      font-weight:600;
                    ">
                      Go to Login
                    </a>
                  </p>

                  <p style="font-size:13px;color:#666;">
                    If this wasn’t you, you can safely ignore this email.
                  </p>

                  <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />

                  <p style="font-size:12px;color:#999;text-align:center;">
                    © ${new Date().getFullYear()} YourApp
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  return { subject, html };
};

const notInRecordsTemplate = (attemptedEmail) => {
  const subject = "We couldn’t verify this email";

  const html = `
  <!doctype html>
  <html>
    <body style="margin:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px;">
      <table width="100%" align="center">
        <tr>
          <td align="center">
            <table width="580" style="background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.08);padding:28px 32px;">
              
              <tr>
                <td>
                  <h2 style="color:rgb(12,231,235);margin-bottom:10px;">
                    Email not found in records
                  </h2>

                  <p style="color:#333;font-size:15px;">
                    We received a signup attempt using:
                  </p>

                  <p style="font-weight:600;color:#111;">
                    ${attemptedEmail}
                  </p>

                  <p style="color:#333;font-size:15px;">
                    But we couldn’t match this email with our records.
                  </p>

                  <p style="color:#666;font-size:14px;">
                    This may happen if:
                    <br/>• The email was entered incorrectly
                    <br/>• A different registered email should be used
                  </p>

                  <p style="color:#333;font-size:15px;margin-top:15px;">
                    If you believe this is a mistake, please contact your organization or support team.
                  </p>

                  <p style="font-size:13px;color:#666;margin-top:15px;">
                    If you didn’t attempt to sign up, you can safely ignore this email.
                  </p>

                  <hr style="margin:20px 0;border:none;border-top:1px solid #eee;" />

                  <p style="font-size:12px;color:#999;text-align:center;">
                    © ${new Date().getFullYear()} YourApp
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  return { subject, html };
};

const forgotPasswordNotRegisteredTemplate = (attemptedEmail) => {
  const subject = "Password reset request";

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
    </head>
    <body style="margin:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center">
            <table width="580" cellpadding="0" cellspacing="0" role="presentation"
              style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(13,20,30,0.08);">
              <tr>
                <td style="padding:28px 32px;">
                  <h2 style="margin:0 0 10px 0;color:rgb(12,231,235);">
                    We couldn’t find an account for this email
                  </h2>

                  <p style="margin:0 0 14px 0;color:#333;font-size:15px;line-height:1.5;">
                    We received a password reset request for:
                  </p>

                  <p style="margin:0 0 18px 0;font-weight:600;color:#111;font-size:15px;">
                    ${attemptedEmail}
                  </p>

                  <p style="margin:0 0 14px 0;color:#333;font-size:15px;line-height:1.5;">
                    However, we could not find a registered account with this email address.
                  </p>

                  <p style="margin:0 0 18px 0;color:#666;font-size:14px;line-height:1.5;">
                    This may happen if:
                    <br/>• The email was entered incorrectly
                    <br/>• You used a different email to sign up
                    <br/>• Your account has not been created yet
                  </p>

                  <p style="margin:0 0 18px 0;color:#333;font-size:15px;">
                    If you believe this is a mistake, please contact the support team or try again with the correct email.
                  </p>

                  <p style="margin:0;color:#666;font-size:13px;">
                    If you did not request a password reset, you can safely ignore this email.
                  </p>

                  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />

                  <p style="margin:0;color:#888;font-size:12px;text-align:center;">
                    © ${new Date().getFullYear()} YourApp
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  return { subject, html };
};

const forgotPasswordResetLinkTemplate = (resetUrl) => {
  const subject = "Reset your password";

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
    </head>
    <body style="margin:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="center">
            <table width="580" cellpadding="0" cellspacing="0" role="presentation"
              style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(13,20,30,0.08);">
              <tr>
                <td style="padding:28px 32px;">
                  <h2 style="margin:0 0 10px 0;color:rgb(12,231,235);">
                    Reset your password
                  </h2>

                  <p style="margin:0 0 14px 0;color:#333;font-size:15px;line-height:1.5;">
                    We received a request to reset your password. Click the button below to continue.
                  </p>

                  <p style="margin:18px 0;">
                    <a href="${resetUrl}" target="_blank" rel="noopener" style="
                      display:inline-block;
                      padding:12px 20px;
                      border-radius:8px;
                      background: rgb(250,172,2);
                      color:#0b0b0b;
                      text-decoration:none;
                      font-weight:600;
                      box-shadow: 0 4px 12px rgba(250,172,2,0.18);
                    ">
                      Reset Password
                    </a>
                  </p>

                  <p style="margin:14px 0 0 0;color:#666;font-size:13px;line-height:1.45;">
                    If the button doesn't work, copy and paste this link into your browser:
                    <br/>
                    <a href="${resetUrl}" target="_blank" rel="noopener" style="color:rgb(12,231,235);word-break:break-all;">${resetUrl}</a>
                  </p>

                  <p style="margin:18px 0 0 0;color:#666;font-size:13px;">
                    This link should be used only once and will expire after a short time.
                  </p>

                  <p style="margin:14px 0 0 0;color:#666;font-size:13px;">
                    If you did not request a password reset, you can safely ignore this email.
                  </p>

                  <hr style="margin:22px 0;border:none;border-top:1px solid #eef0f6;" />

                  <p style="margin:0;color:#777;font-size:13px;line-height:1.4;">
                    If you need help, contact support at <a href="mailto:support@yourapp.com" style="color:rgb(12,231,235);">support@yourapp.com</a>.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#fafafa;padding:12px 32px;text-align:center;color:#9aa0a6;font-size:12px;">
                  © ${new Date().getFullYear()} YourApp
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;

  return { subject, html };
};

module.exports = {
  verifyEmailTemplate,
  alreadyRegisteredTemplate,
  notInRecordsTemplate,
  forgotPasswordNotRegisteredTemplate,
  forgotPasswordResetLinkTemplate,
};

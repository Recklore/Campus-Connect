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

module.exports = { verifyEmailTemplate, alreadyRegisteredTemplate, notInRecordsTemplate };

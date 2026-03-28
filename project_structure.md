# Project Structure

This project is organized as a full-stack monorepo with separate backend and frontend applications.

## Directory Tree

SE/
- backend/ - Express.js API for authentication, email flows, validation, and token management.
  - config/ - Runtime service configuration modules.
    - db.js - Database connection setup.
    - mail.js - Outbound email sending utilities.
    - redis.js - Redis client setup and connection helper.
  - controller/ - Request handlers for auth business logic.
    - authController.js - Login, signup, verification, forgot-password, and guest auth handlers.
  - middleware/ - Request validation and sanitization middleware.
    - authValidation.js - Validation rules for auth and verification routes.
  - models/ - Database models and schema definitions.
    - user.js - User schema/model for students and seniors.
  - routes/ - Express route declarations.
    - authRouter.js - Auth route wiring to validators and controllers.
  - services/ - Reusable backend service helpers.
    - verificationToken.js - Token generation, hashing, Redis storage, and consume-on-verify logic.
  - tamplates/ - Email template builders.
    - mailTemplates.js - HTML/email content for signup and password reset flows.
  - index.js - Backend app bootstrap and server startup entry point.
  - university_data.json - Local university reference data used during signup eligibility checks.
  - package.json - Backend scripts and dependencies.
  - .env - Backend environment variables.
- frontend/ - React (Vite) client for authentication UI and flow handling.
  - public/ - Static files served as-is.
    - curaj.jpg - Branding image used by the app.
  - src/ - Frontend source code.
    - assets/ - Bundled images and visual assets for auth pages.
    - components/ - Reusable UI building blocks.
      - common/ - Shared controls like fields, tabs, brand header, and action button.
      - layouts/ - Page layout wrappers for auth screens.
    - pages/ - Route-level auth screens.
      - Login.jsx - User login page with role-based identifier handling.
      - Signup.jsx - Signup form and post-submit resend flow.
      - SignupVerify.jsx - Signup verification page that consumes token from URL.
      - ForgotPasswordInit.jsx - Forgot-password initiation form.
      - ForgotPasswordVerify.jsx - Password reset page that verifies token and updates password.
    - lib/ - API and validation helpers.
      - api.js - HTTP client wrapper and auth API methods.
      - authValidators.js - Frontend input normalization and validation utilities.
    - styles/ - Shared style configuration.
      - shared.js - Shared inline style tokens and helpers.
    - App.jsx - Frontend route container and app shell.
    - main.jsx - React app mount entry point.
    - index.css - Global styles for auth UI.
  - index.html - Vite HTML template.
  - vite.config.js - Vite build/dev server configuration.
  - package.json - Frontend scripts and dependencies.
  - .env - Frontend environment variables.
- .git/ - Git repository metadata.

## Notes

- node_modules/ and dist/ directories are build/dependency artifacts and are intentionally not documented in detail.
- The core auth workflow spans backend/routes/authRouter.js, backend/controller/authController.js, and frontend/src/pages/*.jsx.

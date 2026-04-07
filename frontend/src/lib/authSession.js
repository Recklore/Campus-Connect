import { authApi } from "./api";

export const logoutSession = async () => {
  try {
    await authApi.logout();
  } catch {
    // Ignore logout network errors so the UI can still redirect to login.
  }
};

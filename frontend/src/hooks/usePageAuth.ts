import { useAuthStore } from "../store/authStore";
import type { User } from "@toolshare/shared";

export function usePageAuth(propCurrentUser?: User, propToken?: string | null) {
  const storeUser = useAuthStore((state) => state.currentUser);
  const storeToken = useAuthStore((state) => state.token);
  
  return {
    currentUser: propCurrentUser !== undefined ? propCurrentUser : storeUser,
    token: propToken !== undefined ? propToken : storeToken
  };
}

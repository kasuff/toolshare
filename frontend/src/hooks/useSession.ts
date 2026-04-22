import { useMemo, useState } from "react";
import { api } from "../services/mockApi";
import type { User } from "../types/domain";

const STORAGE_KEY = "toolshare_mvp_user";

export function useSession() {
  const users = api.getUsers();
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || users[0]?.id || "";
  });

  const currentUser = useMemo<User | undefined>(
    () => users.find((u) => u.id === currentUserId),
    [users, currentUserId],
  );

  const switchUser = (userId: string) => {
    localStorage.setItem(STORAGE_KEY, userId);
    setCurrentUserId(userId);
  };

  return { users, currentUser, switchUser };
}

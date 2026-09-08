import { useEffect } from "react";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { startCloudPersist, stopCloudPersist } from "@/lib/supabase/persist";

/**
 * Mount once in the app shell: binds the store to Supabase for the signed-in
 * user (load on sign-in, write-through on change). No-op when auth is off.
 */
export function useCloudPersist() {
  const { user, isPending } = useCurrentUserState();
  const userId = user && !user.isDevFallback ? user.id : null;
  useEffect(() => {
    if (isPending) return;
    if (!authEnabled || !userId) {
      stopCloudPersist();
      return;
    }
    void startCloudPersist(userId);
  }, [userId, isPending]);
}

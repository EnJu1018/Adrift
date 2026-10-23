import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/client.js";

export default function useNotifications(userId, open) {
  const [state, setState] = useState({
    items: [],
    unreadCount: 0,
    nextCursor: null,
    loading: false,
    error: "",
  });
  const request = useRef(null);
  const load = useCallback(
    async (cursor = "") => {
      if (!userId) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setState((current) => ({ ...current, loading: true, error: "" }));
      try {
        const { data } = await api.getNotifications(cursor, controller.signal);
        if (!controller.signal.aborted)
          setState((current) => ({
            ...data,
            loading: false,
            error: "",
            items: cursor
              ? [
                  ...current.items,
                  ...data.items.filter(
                    (row) =>
                      !current.items.some((item) => item._id === row._id),
                  ),
                ]
              : data.items,
          }));
      } catch (error) {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            loading: false,
            error: error.message,
          }));
      }
    },
    [userId],
  );
  useEffect(() => {
    setState({
      items: [],
      unreadCount: 0,
      nextCursor: null,
      loading: false,
      error: "",
    });
    const refresh = () => {
      if (document.visibilityState !== "hidden") load();
    };
    refresh();
    window.addEventListener("adrift:notifications-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      request.current?.abort();
      clearInterval(timer);
      window.removeEventListener("adrift:notifications-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);
  async function markRead(id) {
    const result = await (id
      ? api.readNotification(id)
      : api.readAllNotifications());
    setState((current) => ({
      ...current,
      items: current.items.map((item) =>
        !id || item._id === id
          ? { ...item, readAt: result.data?.readAt || new Date().toISOString() }
          : item,
      ),
      unreadCount: id
        ? Math.max(
            0,
            current.unreadCount -
              (current.items.some((item) => item._id === id && !item.readAt)
                ? 1
                : 0),
          )
        : 0,
    }));
  }
  return { ...state, load, markRead };
}

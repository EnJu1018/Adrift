import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import UserAvatar from "../UserAvatar.jsx";
import { formatDiaryTime } from "../../utils/diaryTime.js";
import { api } from "../../api/client.js";
import "./notifications.css";

const messages = {
  friend_request: "想加你為好友",
  friend_accepted: "接受了你的好友邀請",
  diary_reaction: "對你的記憶留下了共鳴",
};
export default function NotificationList({ notifications, onOpen }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function act(id) {
    if (busy) return;
    setBusy(id || "all");
    setError("");
    try {
      if (id) {
        const { data } = await api.getNotificationTarget(id);
        await notifications.markRead(id);
        await onOpen(data);
      } else await notifications.markRead();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <header className="notice-header">
        <div>
          <strong>通知</strong>
          <small>
            {notifications.unreadCount
              ? `${notifications.unreadCount} 則未讀`
              : "你的互動都在這裡"}
          </small>
        </div>
        <button
          type="button"
          aria-label="全部標記已讀"
          disabled={!!busy || !notifications.unreadCount}
          onClick={() => act()}
        >
          <CheckCheck size={18} />
        </button>
      </header>
      {(error || notifications.error) && (
        <div className="notice-error" role="alert">
          <p>{error || notifications.error}</p>
          <button
            onClick={() => {
              setError("");
              notifications.load();
            }}
          >
            <RefreshCw size={15} />
            重新載入
          </button>
        </div>
      )}
      <div className="notice-scroll" aria-busy={notifications.loading}>
        {notifications.items.map((item) => (
          <button
            type="button"
            className="notice-item"
            data-unread={!item.readAt}
            key={item._id}
            disabled={!!busy}
            onClick={() => act(item._id)}
          >
            <UserAvatar user={item.actor} size="sm" />
            <span>
              <strong>{item.actor?.name || "已離開的使用者"}</strong>
              <span>{messages[item.type]}</span>
              <small>{formatDiaryTime(item.createdAt, Date.now())}</small>
            </span>
            {!item.readAt && <i aria-label="未讀" />}
          </button>
        ))}
        {!notifications.items.length && !notifications.error && (
          <div className="notice-empty" role="status">
            {notifications.loading ? (
              <span className="button-spinner" />
            ) : (
              <Bell size={23} />
            )}
            <strong>
              {notifications.loading ? "正在讀取通知" : "目前沒有通知"}
            </strong>
            <p>好友邀請、回應與記憶共鳴會出現在這裡。</p>
          </div>
        )}
        {notifications.nextCursor && (
          <button
            className="notice-more"
            disabled={notifications.loading}
            onClick={() => notifications.load(notifications.nextCursor)}
          >
            載入較早通知
          </button>
        )}
      </div>
    </>
  );
}

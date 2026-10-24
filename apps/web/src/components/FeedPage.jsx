import { AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Heart,
  HandHeart,
  MapPin,
  Plus,
  RefreshCw,
  Users,
  Waves,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { MOOD_LABELS } from "../constants/app.js";
import { formatDiaryTime } from "../utils/diaryTime.js";
import DiaryImage from "./DiaryImage.jsx";
import UserAvatar from "./UserAvatar.jsx";
import AnimatedNumber from "./ui/AnimatedNumber.jsx";
import Modal from "./ui/Modal.jsx";
import "./feed.css";

const filters = [
  ["all", "全部"],
  ["friends", "好友"],
  ["public", "公開"],
];
const reactions = [
  ["understand", "我懂", Heart],
  ["hug", "抱抱", HandHeart],
  ["relate", "有同感", Waves],
];

export default function FeedPage({
  diaries = [],
  user,
  onOpenDiary,
  onNewDiary,
  onOpenPerson,
  onReact,
}) {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]),
    [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState("loading"),
    [error, setError] = useState("");
  const [image, setImage] = useState(null),
    [pending, setPending] = useState({});
  const request = useRef(null),
    busy = useRef(new Set()),
    mounted = useRef(false);
  const load = useCallback(
    async (next = "") => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setStatus("loading");
      setError("");
      try {
        const { data } = await api.getFeed(filter, next, controller.signal);
        if (controller.signal.aborted) return;
        setItems((current) =>
          next
            ? [
                ...current,
                ...data.diaries.filter(
                  (diary) => !current.some((item) => item._id === diary._id),
                ),
              ]
            : data.diaries,
        );
        setCursor(data.nextCursor);
        setStatus("ready");
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
          setStatus("error");
        }
      }
    },
    [filter],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    load();
    return () => request.current?.abort();
  }, [load, user?._id, user?.id]);
  useEffect(() => {
    setItems((current) =>
      current
        .map((item) => {
          const next = diaries.find((diary) => diary._id === item._id);
          return next ? { ...item, ...next } : item;
        })
        .filter(
          (item) =>
            item.visibility !== "private" &&
            (filter !== "public" || item.visibility === "public"),
        ),
    );
  }, [diaries, filter]);
  useEffect(() => {
    function update(event) {
      if (event.detail?.diaryId)
        setItems((current) =>
          current.filter((item) => item._id !== event.detail.diaryId),
        );
      else if (event.detail?.diary)
        setItems((current) =>
          current.map((item) =>
            item._id === event.detail.diary._id
              ? { ...item, ...event.detail.diary }
              : item,
          ),
        );
      else load();
    }
    window.addEventListener("adrift:feed-changed", update);
    return () => window.removeEventListener("adrift:feed-changed", update);
  }, [load]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "hidden") load();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load]);
  async function react(diary, type) {
    if (busy.current.has(diary._id)) return;
    busy.current.add(diary._id);
    setPending((current) => ({ ...current, [diary._id]: true }));
    setError("");
    const counts = { ...diary.reactions };
    if (diary.userReaction)
      counts[diary.userReaction] = Math.max(
        0,
        (counts[diary.userReaction] || 0) - 1,
      );
    const nextType = diary.userReaction === type ? null : type;
    if (nextType) counts[nextType] = (counts[nextType] || 0) + 1;
    const draft = { ...diary, reactions: counts, userReaction: nextType };
    setItems((current) =>
      current.map((item) => (item._id === diary._id ? draft : item)),
    );
    try {
      const payload = await (onReact
        ? onReact(diary._id, type, draft)
        : api.reactToDiary(diary._id, type));
      if (mounted.current)
        setItems((current) =>
          current.map((item) =>
            item._id === diary._id ? { ...item, ...payload.data } : item,
          ),
        );
    } catch (error) {
      if (mounted.current) {
        setItems((current) =>
          current.map((item) => (item._id === diary._id ? diary : item)),
        );
        setError(error.message);
      }
    } finally {
      busy.current.delete(diary._id);
      if (mounted.current)
        setPending((current) => ({ ...current, [diary._id]: false }));
    }
  }
  async function open(diary) {
    try {
      await onOpenDiary?.(diary);
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <section className="memory-feed">
      <header className="mf-header">
        <div>
          <p className="eyebrow">City memories</p>
          <h1>動態牆</h1>
          <p>看看你與朋友，最近在城市留下了什麼記憶。</p>
        </div>
        <button
          className="primary-button compact motion-soft-press"
          onClick={onNewDiary}
        >
          <Plus size={18} />
          留下記憶
        </button>
      </header>
      <div className="mf-toolbar">
        <nav
          className="mf-tabs"
          aria-label="動態篩選"
          style={{ "--tab-index": filters.findIndex(([id]) => id === filter) }}
        >
          <span aria-hidden="true" />
          {filters.map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className="mf-icon"
          aria-label="重新整理動態"
          disabled={status === "loading"}
          onClick={() => load()}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      {error && (
        <div className="mf-error" role="alert">
          <span>{error}</span>
          <button onClick={() => load()}>再試一次</button>
        </div>
      )}
      <div className="mf-list" aria-busy={status === "loading"}>
        {status === "loading" && items.length > 0 && (
          <span className="visually-hidden" role="status">
            正在更新動態，原有記憶已保留
          </span>
        )}
        {items.map((diary) => {
          const author =
            diary.author ||
            (typeof diary.user === "object" ? diary.user : null);
          const own =
            String(author?._id || diary.user) === String(user?._id || user?.id);
          const display = own ? user : author;
          return (
            <article className={`mf-card${diary.imageUrl ? " has-photo" : ""}`} key={diary._id}>
              <header>
                <button
                  className="mf-author"
                  disabled={!author?._id || !onOpenPerson}
                  onClick={() => onOpenPerson(display)}
                >
                  <UserAvatar user={display} size="sm" />
                  <span>
                    <strong>{display?.name || "使用者"}</strong>
                    <small>@{display?.userCode || "unknown"}</small>
                  </span>
                </button>
                <span className="mf-time">
                  <time dateTime={diary.createdAt}>
                    {formatDiaryTime(diary.createdAt, Date.now())}
                  </time>
                  <span>
                    {diary.visibility === "friends" ? (
                      <Users size={13} />
                    ) : (
                      <Waves size={13} />
                    )}
                    {diary.visibility === "friends" ? "好友" : "公開"}
                  </span>
                </span>
              </header>
              <button className="mf-story" onClick={() => open(diary)}>
                <h2>{diary.title || "未命名記憶"}</h2>
                <p>{diary.text || diary.content || ""}</p>
              </button>
              {diary.imageUrl && (
                <button
                  className="mf-photo"
                  aria-label={`放大照片：${diary.title}`}
                  onClick={() =>
                    setImage({ src: diary.imageUrl, title: diary.title })
                  }
                >
                  <DiaryImage
                    src={diary.imageUrl}
                    alt={diary.title || "日記照片"}
                  />
                </button>
              )}
              <div className="mf-context">
                <button onClick={() => open(diary)}>
                  <MapPin size={15} />
                  <span>{diary.location?.placeName || "記憶座標"}</span>
                </button>
                <span>
                  {MOOD_LABELS[diary.mood?.type] || "生活片段"} ·{" "}
                  {diary.mood?.intensity || "–"}
                </span>
              </div>
              <footer>
                <div className="mf-reactions">
                  {reactions.map(([type, label, Icon]) => (
                    <button
                      key={type}
                      aria-label={label}
                      aria-pressed={diary.userReaction === type}
                      disabled={pending[diary._id]}
                      onClick={() => react(diary, type)}
                    >
                      <Icon size={16} />
                      <span>{label}</span>
                      <AnimatedNumber
                        value={diary.reactions?.[type] || 0}
                        digits={3}
                        variant="reaction"
                      />
                    </button>
                  ))}
                </div>
                <button
                  className="mf-open"
                  onClick={() => open(diary)}
                  aria-label={`查看記憶：${diary.title}`}
                >
                  <ArrowUpRight size={18} />
                </button>
              </footer>
            </article>
          );
        })}
        {status === "loading" && !items.length && (
          <div className="mf-loading" role="status" aria-label="正在讀取動態">
            {[0, 1].map(index => <div className="mf-skeleton" key={index} aria-hidden="true"><span /><span /><span /></div>)}
          </div>
        )}
        {status === "ready" && !items.length && (
          <div className="mf-empty">
            <Waves size={28} />
            <h2>
              {filter === "friends"
                ? "朋友的記憶，會在這裡相遇"
                : "附近還很安靜"}
            </h2>
            <p>
              先把這裡變成你的記憶地圖。即使只有自己可見，也能在未來回顧今天。
            </p>
            <button className="secondary-button" onClick={onNewDiary}>
              <Plus size={16} />
              留下第一篇日記
            </button>
          </div>
        )}
        {cursor && (
          <button
            className="mf-more"
            disabled={status === "loading"}
            onClick={() => load(cursor)}
          >
            {status === "loading" ? "正在讀取…" : "載入更多記憶"}
          </button>
        )}
      </div>
      <AnimatePresence>
        {image && (
          <Modal
            label="日記照片"
            className="mf-viewer"
            onClose={() => setImage(null)}
          >
            <header>
              <strong>{image.title}</strong>
              <button
                className="mf-icon"
                aria-label="關閉照片"
                onClick={() => setImage(null)}
              >
                <X size={22} />
              </button>
            </header>
            <DiaryImage src={image.src} alt={image.title} />
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function ButtonFeedback({ busy, label, busyLabel = label, icon }) {
  return <span className="button-feedback" data-busy={Boolean(busy)}>
    <span className="button-feedback-idle" aria-hidden={busy || undefined}>
      <span className="button-feedback-icon" aria-hidden="true">{icon}</span>{label}
    </span>
    <span className="button-feedback-busy" aria-hidden={!busy || undefined}>
      <span className="button-feedback-icon" aria-hidden="true"><span className="button-spinner" /></span>{busyLabel}
    </span>
  </span>;
}

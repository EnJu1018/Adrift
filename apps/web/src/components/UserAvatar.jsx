import { getImageUrl } from '../api/client.js';

export function getInitial(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return 'A';
  return trimmed.slice(0, 1).toUpperCase();
}

export default function UserAvatar({ user, src = '', name = '', size = 'md', className = '' }) {
  const displayName = name || user?.name || '';
  const avatarSrc = src || user?.avatar || user?.avatarUrl || '';
  const resolvedSrc = getImageUrl(avatarSrc);

  return (
    <span className={`user-avatar ${size ? `user-avatar-${size}` : ''} ${className}`.trim()} aria-hidden="true">
      {resolvedSrc ? (
        <img src={resolvedSrc} alt="" loading="lazy" />
      ) : (
        <span>{getInitial(displayName)}</span>
      )}
    </span>
  );
}

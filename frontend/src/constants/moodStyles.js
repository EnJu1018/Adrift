const DEFAULT_MARKER_STYLE = {
  icon: '\u2726',
  color: '#7dd3fc',
  glow: 'rgba(125, 211, 252, 0.62)',
  glass: 'rgba(56, 189, 248, 0.58)',
  core: '#e0f7ff'
};

export const MOOD_MARKER_STYLES = {
  calm: {
    icon: '\u273F',
    color: '#34d399',
    glow: 'rgba(52, 211, 153, 0.62)',
    glass: 'rgba(52, 211, 153, 0.58)',
    core: '#d1fae5'
  },
  joy: {
    icon: '\u25CF',
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.64)',
    glass: 'rgba(251, 191, 36, 0.58)',
    core: '#fff3bf'
  },
  happy: {
    icon: '\u25CF',
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.64)',
    glass: 'rgba(251, 191, 36, 0.58)',
    core: '#fff3bf'
  },
  sad: {
    icon: '\u25C6',
    color: '#60a5fa',
    glow: 'rgba(96, 165, 250, 0.62)',
    glass: 'rgba(96, 165, 250, 0.58)',
    core: '#dbeafe'
  },
  anxious: {
    icon: '\u25CC',
    color: '#a78bfa',
    glow: 'rgba(167, 139, 250, 0.62)',
    glass: 'rgba(167, 139, 250, 0.58)',
    core: '#ede9fe'
  },
  angry: {
    icon: '\u25B2',
    color: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.62)',
    glass: 'rgba(251, 113, 133, 0.58)',
    core: '#ffe4e6'
  },
  excited: {
    icon: '\u2726',
    color: '#fef08a',
    glow: 'rgba(254, 240, 138, 0.64)',
    glass: 'rgba(254, 240, 138, 0.58)',
    core: '#fffde1'
  },
  wonder: {
    icon: '\u2726',
    color: '#fef08a',
    glow: 'rgba(254, 240, 138, 0.62)',
    glass: 'rgba(254, 240, 138, 0.54)',
    core: '#fffde1'
  },
  nostalgic: {
    icon: '\u25CF',
    color: '#d8b98b',
    glow: 'rgba(216, 185, 139, 0.56)',
    glass: 'rgba(216, 185, 139, 0.52)',
    core: '#f7ead8'
  },
  other: DEFAULT_MARKER_STYLE
};

export function getMoodMarkerStyle(moodType, options = {}) {
  const style = MOOD_MARKER_STYLES[moodType] || DEFAULT_MARKER_STYLE;

  if (!options.explore) return style;

  return {
    ...style,
    color: '#c4b5fd',
    glow: 'rgba(196, 181, 253, 0.62)',
    glass: 'rgba(196, 181, 253, 0.56)',
    core: '#ede9fe'
  };
}

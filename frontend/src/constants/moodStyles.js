const DEFAULT_MARKER_STYLE = {
  icon: '✦',
  color: '#bfefff',
  glow: 'rgba(191, 239, 255, 0.34)',
  glass: 'rgba(10, 24, 38, 0.74)',
  core: 'rgba(191, 239, 255, 0.2)'
};

export const MOOD_MARKER_STYLES = {
  calm: {
    icon: '🌿',
    color: '#78f3dc',
    glow: 'rgba(121, 241, 220, 0.36)',
    glass: 'rgba(8, 30, 39, 0.76)',
    core: 'rgba(121, 241, 220, 0.22)'
  },
  joy: {
    icon: '😊',
    color: '#ffd27a',
    glow: 'rgba(255, 202, 117, 0.38)',
    glass: 'rgba(38, 27, 11, 0.76)',
    core: 'rgba(255, 210, 122, 0.24)'
  },
  happy: {
    icon: '😊',
    color: '#ffd27a',
    glow: 'rgba(255, 202, 117, 0.38)',
    glass: 'rgba(38, 27, 11, 0.76)',
    core: 'rgba(255, 210, 122, 0.24)'
  },
  sad: {
    icon: '🌧',
    color: '#9bc2ff',
    glow: 'rgba(122, 172, 239, 0.34)',
    glass: 'rgba(12, 22, 38, 0.78)',
    core: 'rgba(155, 194, 255, 0.2)'
  },
  anxious: {
    icon: '◌',
    color: '#c2a2ff',
    glow: 'rgba(178, 138, 255, 0.36)',
    glass: 'rgba(26, 17, 43, 0.78)',
    core: 'rgba(194, 162, 255, 0.22)'
  },
  angry: {
    icon: '🔥',
    color: '#ff9b6a',
    glow: 'rgba(255, 123, 79, 0.34)',
    glass: 'rgba(42, 18, 12, 0.76)',
    core: 'rgba(255, 155, 106, 0.22)'
  },
  excited: {
    icon: '✨',
    color: '#f6f0a8',
    glow: 'rgba(246, 240, 168, 0.36)',
    glass: 'rgba(36, 33, 15, 0.76)',
    core: 'rgba(246, 240, 168, 0.22)'
  },
  wonder: {
    icon: '✨',
    color: '#f6f0a8',
    glow: 'rgba(246, 240, 168, 0.36)',
    glass: 'rgba(25, 28, 42, 0.76)',
    core: 'rgba(246, 240, 168, 0.2)'
  },
  nostalgic: {
    icon: '◐',
    color: '#d8b98b',
    glow: 'rgba(216, 185, 139, 0.3)',
    glass: 'rgba(34, 25, 18, 0.76)',
    core: 'rgba(216, 185, 139, 0.2)'
  },
  other: DEFAULT_MARKER_STYLE
};

export function getMoodMarkerStyle(moodType, options = {}) {
  const style = MOOD_MARKER_STYLES[moodType] || DEFAULT_MARKER_STYLE;

  if (!options.explore) return style;

  return {
    ...style,
    color: style.color,
    glow: 'rgba(170, 154, 255, 0.34)',
    glass: 'rgba(18, 18, 42, 0.76)',
    core: 'rgba(170, 154, 255, 0.2)'
  };
}

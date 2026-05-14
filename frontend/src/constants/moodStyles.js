const DEFAULT_MARKER_STYLE = {
  icon: '\u2726',
  color: '#7dd3fc',
  rgb: '125, 211, 252',
  glow: 'rgba(125, 211, 252, 0.38)',
  glass: 'rgba(8, 18, 32, 0.78)',
  core: '#e0f7ff'
};

export const MOOD_MARKER_STYLES = {
  calm: {
    icon: '\u25CF',
    color: '#70e6d2',
    rgb: '112, 230, 210',
    glow: 'rgba(112, 230, 210, 0.34)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#d8faf4'
  },
  joy: {
    icon: '\u25CF',
    color: '#f4d278',
    rgb: '244, 210, 120',
    glow: 'rgba(244, 210, 120, 0.34)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#fff3c7'
  },
  happy: {
    icon: '\u25CF',
    color: '#f4d278',
    rgb: '244, 210, 120',
    glow: 'rgba(244, 210, 120, 0.34)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#fff3c7'
  },
  sad: {
    icon: '\u25CF',
    color: '#78aae6',
    rgb: '120, 170, 230',
    glow: 'rgba(120, 170, 230, 0.34)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#dbeafe'
  },
  anxious: {
    icon: '\u25CF',
    color: '#aa8cf0',
    rgb: '170, 140, 240',
    glow: 'rgba(170, 140, 240, 0.34)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#ede9fe'
  },
  angry: {
    icon: '\u25CF',
    color: '#f08278',
    rgb: '240, 130, 120',
    glow: 'rgba(240, 130, 120, 0.34)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#ffe4e6'
  },
  excited: {
    icon: '\u25CF',
    color: '#dcbcff',
    rgb: '220, 190, 255',
    glow: 'rgba(220, 190, 255, 0.34)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#f1e7ff'
  },
  wonder: {
    icon: '\u25CF',
    color: '#dcbcff',
    rgb: '220, 190, 255',
    glow: 'rgba(220, 190, 255, 0.32)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#f1e7ff'
  },
  nostalgic: {
    icon: '\u25CF',
    color: '#c9ad84',
    rgb: '201, 173, 132',
    glow: 'rgba(201, 173, 132, 0.3)',
    glass: 'rgba(8, 18, 32, 0.78)',
    core: '#f7ead8'
  },
  other: DEFAULT_MARKER_STYLE
};

export function getMoodMarkerStyle(moodType, options = {}) {
  const style = MOOD_MARKER_STYLES[moodType] || DEFAULT_MARKER_STYLE;

  if (!options.explore) return style;

  return {
    ...style,
    color: '#b8a8ee',
    rgb: '184, 168, 238',
    glow: 'rgba(184, 168, 238, 0.34)',
    core: '#ede9fe'
  };
}

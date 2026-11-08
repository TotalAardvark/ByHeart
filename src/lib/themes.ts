export type ThemeId =
  | 'ocean'
  | 'citrus'
  | 'sunset'
  | 'velvet'
  | 'sorbet'
  | 'canyon';

export interface ThemePalette {
  id: ThemeId;
  name: string;
  tagline: string;
  mode: 'dark' | 'light';
  /** Exact 4 color stripes from the palette reference card (top to bottom) */
  swatches: [string, string, string, string];
  /** Dedicated styling for the By Heart logo badge & Heart icon */
  logo: {
    badgeBackground: string;
    badgeBorder: string;
    badgeShadow: string;
    heartFill: string;
    heartStroke: string;
  };
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: 'ocean',
    name: 'Ocean Depth',
    tagline: 'Deep navy & arctic cyan',
    mode: 'dark',
    swatches: ['#1a365d', '#015a9c', '#60c1e5', '#a1e0ef'],
    logo: {
      badgeBackground: 'linear-gradient(135deg, #015a9c 0%, #1a365d 100%)',
      badgeBorder: 'rgba(96, 193, 229, 0.5)',
      badgeShadow: '0 8px 20px -4px rgba(1, 90, 156, 0.55)',
      heartFill: '#60c1e5',
      heartStroke: '#a1e0ef',
    },
  },
  {
    id: 'citrus',
    name: 'Crimson Citrus',
    tagline: 'Crimson, warm peach & cream',
    mode: 'light',
    swatches: ['#e00201', '#ffa97b', '#ffeccb', '#9fed72'],
    logo: {
      badgeBackground: 'linear-gradient(135deg, #ffeccb 0%, #ffa97b 100%)',
      badgeBorder: 'rgba(224, 2, 1, 0.35)',
      badgeShadow: '0 8px 20px -4px rgba(224, 2, 1, 0.25)',
      heartFill: '#e00201',
      heartStroke: '#b50000',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Dusk',
    tagline: 'Deep plum, berry & solar gold',
    mode: 'dark',
    swatches: ['#421454', '#802c62', '#ff5c42', '#ffd649'],
    logo: {
      badgeBackground: 'linear-gradient(135deg, #802c62 0%, #421454 100%)',
      badgeBorder: 'rgba(255, 92, 66, 0.55)',
      badgeShadow: '0 8px 20px -4px rgba(255, 92, 66, 0.35)',
      heartFill: '#ffd649',
      heartStroke: '#ff5c42',
    },
  },
  {
    id: 'velvet',
    name: 'Midnight Velvet',
    tagline: 'Royal violet, orchid & champagne',
    mode: 'dark',
    swatches: ['#290044', '#500071', '#8a2a78', '#eee3b1'],
    logo: {
      badgeBackground: 'linear-gradient(135deg, #8a2a78 0%, #500071 100%)',
      badgeBorder: 'rgba(238, 227, 177, 0.45)',
      badgeShadow: '0 8px 20px -4px rgba(138, 42, 120, 0.5)',
      heartFill: '#eee3b1',
      heartStroke: '#faf5de',
    },
  },
  {
    id: 'sorbet',
    name: 'Pastel Sorbet',
    tagline: 'Periwinkle, sage mint & coral',
    mode: 'light',
    swatches: ['#9fa0ff', '#d6e8e6', '#fff3e3', '#ff7071'],
    logo: {
      badgeBackground: 'linear-gradient(135deg, #9fa0ff 0%, #d6e8e6 100%)',
      badgeBorder: 'rgba(159, 160, 255, 0.65)',
      badgeShadow: '0 8px 20px -4px rgba(159, 160, 255, 0.35)',
      heartFill: '#ff7071',
      heartStroke: '#d9383a',
    },
  },
  {
    id: 'canyon',
    name: 'Terracotta Canyon',
    tagline: 'Warm sand, seafoam & terracotta',
    mode: 'light',
    swatches: ['#feead3', '#bfe7ea', '#e89b5b', '#d46743'],
    logo: {
      badgeBackground: 'linear-gradient(135deg, #bfe7ea 0%, #feead3 55%, #e89b5b 100%)',
      badgeBorder: 'rgba(212, 103, 67, 0.4)',
      badgeShadow: '0 8px 20px -4px rgba(212, 103, 67, 0.28)',
      heartFill: '#d46743',
      heartStroke: '#9e3616',
    },
  },
];

const THEME_STORAGE_KEY = 'by_heart_theme_v1';

export function getThemePalette(id: ThemeId): ThemePalette {
  return THEME_PALETTES.find((t) => t.id === id) || THEME_PALETTES[0];
}

export function loadThemeId(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved && THEME_PALETTES.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'ocean';
}

export function saveThemeId(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // ignore storage errors
  }
}

const FAVICON_GRADIENT_STOPS: Record<
  ThemeId,
  Array<{ offset: string; color: string }>
> = {
  ocean: [
    { offset: '0%', color: '#015a9c' },
    { offset: '100%', color: '#1a365d' },
  ],
  citrus: [
    { offset: '0%', color: '#ffeccb' },
    { offset: '100%', color: '#ffa97b' },
  ],
  sunset: [
    { offset: '0%', color: '#802c62' },
    { offset: '100%', color: '#421454' },
  ],
  velvet: [
    { offset: '0%', color: '#8a2a78' },
    { offset: '100%', color: '#500071' },
  ],
  sorbet: [
    { offset: '0%', color: '#9fa0ff' },
    { offset: '100%', color: '#d6e8e6' },
  ],
  canyon: [
    { offset: '0%', color: '#bfe7ea' },
    { offset: '55%', color: '#feead3' },
    { offset: '100%', color: '#e89b5b' },
  ],
};

export function buildThemeFaviconDataUrl(id: ThemeId): string {
  const palette = getThemePalette(id);
  const stops = FAVICON_GRADIENT_STOPS[palette.id] || FAVICON_GRADIENT_STOPS.ocean;
  const stopsXml = stops
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`)
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><defs><linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">${stopsXml}</linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="16" fill="url(#bg)" stroke="${palette.logo.badgeBorder}" stroke-width="3"/><g transform="translate(12, 12.5) scale(1.6667)"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="${palette.logo.heartFill}" stroke="${palette.logo.heartStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function applyThemeToDocument(id: ThemeId): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', id);
    let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.href = buildThemeFaviconDataUrl(id);

    const themeColorMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    if (themeColorMeta) {
      const bgColors: Record<ThemeId, string> = {
        ocean: '#0f223d',
        citrus: '#fff6e6',
        sunset: '#2a0b36',
        velvet: '#170029',
        sorbet: '#f5f6ff',
        canyon: '#fff4e8',
      };
      themeColorMeta.content = bgColors[id] || '#0f223d';
    }
  }
}

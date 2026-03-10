export type TenantTheme = {
  bgMain: string;
  bgSecondary: string;
  textMain: string;
  textSecondary: string;
  borderColor: string;
  accent: string;
  buttonPrimary: string;
  buttonPrimaryHover: string;
  buttonText: string;
  cardBg: string;
};

export type TenantBranding = {
  theme: TenantTheme;
  logoUrl: string | null;
  nodeRadius: number;
};

export const DEFAULT_TENANT_THEME: TenantTheme = {
  bgMain: '#000000',
  bgSecondary: '#111111',
  textMain: '#ffffff',
  textSecondary: '#a1a1aa',
  borderColor: '#2a2a2a',
  accent: '#f97316',
  buttonPrimary: '#f97316',
  buttonPrimaryHover: '#ea580c',
  buttonText: '#000000',
  cardBg: '#18181b'
};

export const DEFAULT_TENANT_NODE_RADIUS = 24;
export const MIN_TENANT_NODE_RADIUS = 8;
export const MAX_TENANT_NODE_RADIUS = 36;

export const TENANT_THEME_FIELDS: Array<{
  key: keyof TenantTheme;
  label: string;
  hint: string;
}> = [
  { key: 'bgMain', label: 'Main background', hint: 'Page canvas and main content areas.' },
  { key: 'bgSecondary', label: 'Sidebar and header', hint: 'Navigation rail and sticky top bar.' },
  { key: 'textMain', label: 'Primary text', hint: 'Headlines and main body text.' },
  { key: 'textSecondary', label: 'Muted text and icons', hint: 'Secondary labels, icons, and helper copy.' },
  { key: 'borderColor', label: 'Borders', hint: 'Outlines, dividers, and input strokes.' },
  { key: 'accent', label: 'Brand accent', hint: 'Logo badge and highlighted brand moments.' },
  { key: 'buttonPrimary', label: 'Primary button', hint: 'Active chips, CTAs, and action buttons.' },
  { key: 'buttonPrimaryHover', label: 'Button hover', hint: 'Hover state for interactive buttons and pills.' },
  { key: 'buttonText', label: 'Button text', hint: 'Text and icons that sit on accent surfaces.' },
  { key: 'cardBg', label: 'Cards and chips', hint: 'Secondary surfaces behind filters and cards.' }
];

function resolveThemeColor(
  theme: Record<string, unknown> | undefined,
  key: keyof TenantTheme
) {
  const value = theme?.[key];
  if (typeof value === 'string' && value.trim().length >= 4) {
    return value;
  }
  return DEFAULT_TENANT_THEME[key];
}

function readSettingsRecord(settings: unknown) {
  return settings && typeof settings === 'object'
    ? (settings as Record<string, unknown>)
    : undefined;
}

function resolveNodeRadius(settingsRecord: Record<string, unknown> | undefined) {
  const value = Number(settingsRecord?.nodeRadius ?? DEFAULT_TENANT_NODE_RADIUS);
  if (!Number.isFinite(value)) return DEFAULT_TENANT_NODE_RADIUS;
  return Math.max(
    MIN_TENANT_NODE_RADIUS,
    Math.min(MAX_TENANT_NODE_RADIUS, Math.round(value))
  );
}

export function readTenantLogoUrl(settings: unknown) {
  const settingsRecord = readSettingsRecord(settings);
  const value = settingsRecord?.logoUrl;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function readTenantNodeRadius(settings: unknown) {
  return resolveNodeRadius(readSettingsRecord(settings));
}

export function readTenantTheme(settings: unknown): TenantTheme {
  const settingsRecord = readSettingsRecord(settings);
  const theme =
    settingsRecord?.theme && typeof settingsRecord.theme === 'object'
      ? (settingsRecord.theme as Record<string, unknown>)
      : undefined;

  return {
    bgMain: resolveThemeColor(theme, 'bgMain'),
    bgSecondary: resolveThemeColor(theme, 'bgSecondary'),
    textMain: resolveThemeColor(theme, 'textMain'),
    textSecondary: resolveThemeColor(theme, 'textSecondary'),
    borderColor: resolveThemeColor(theme, 'borderColor'),
    accent: resolveThemeColor(theme, 'accent'),
    buttonPrimary: resolveThemeColor(theme, 'buttonPrimary'),
    buttonPrimaryHover: resolveThemeColor(theme, 'buttonPrimaryHover'),
    buttonText: resolveThemeColor(theme, 'buttonText'),
    cardBg: resolveThemeColor(theme, 'cardBg')
  };
}

export function readTenantBranding(settings: unknown): TenantBranding {
  return {
    theme: readTenantTheme(settings),
    logoUrl: readTenantLogoUrl(settings),
    nodeRadius: readTenantNodeRadius(settings)
  };
}

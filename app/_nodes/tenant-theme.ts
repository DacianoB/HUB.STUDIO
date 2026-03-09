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

export const TENANT_THEME_FIELDS: Array<{
  key: keyof TenantTheme;
  label: string;
}> = [
  { key: 'bgMain', label: 'bg main' },
  { key: 'bgSecondary', label: 'bg secondary' },
  { key: 'textMain', label: 'text main' },
  { key: 'textSecondary', label: 'text secondary' },
  { key: 'borderColor', label: 'border' },
  { key: 'accent', label: 'accent' },
  { key: 'buttonPrimary', label: 'button primary' },
  { key: 'buttonPrimaryHover', label: 'button hover' },
  { key: 'buttonText', label: 'button text' },
  { key: 'cardBg', label: 'card bg' }
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

export function readTenantTheme(settings: unknown): TenantTheme {
  const settingsRecord =
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>)
      : undefined;
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

import { ThemePreset } from '../../shared/types';

const themeTokens: Record<ThemePreset, Record<string, string>> = {
  'azul-clinico': {
    '--atlas-paper': '#FBFEFF',
    '--atlas-mist': '#EEF8FF',
    '--atlas-line': '#D8EAF6',
    '--atlas-soft': '#CFE5F5',
    '--atlas-blue': '#8EC5EE',
    '--atlas-steel': '#5F9FCE',
    '--atlas-ink': '#18324B',
    '--atlas-body': '#375468',
    '--atlas-surface': 'rgba(255,255,255,0.88)',
  },
  'neutro-claro': {
    '--atlas-paper': '#FCFDFD',
    '--atlas-mist': '#F5F8FA',
    '--atlas-line': '#E0E7EC',
    '--atlas-soft': '#D6E0E7',
    '--atlas-blue': '#A8BECB',
    '--atlas-steel': '#6F8A9B',
    '--atlas-ink': '#213442',
    '--atlas-body': '#445A68',
    '--atlas-surface': 'rgba(255,255,255,0.9)',
  },
  'atlas-profundo': {
    '--atlas-paper': '#F7FBFF',
    '--atlas-mist': '#E8F3FC',
    '--atlas-line': '#CAE0F0',
    '--atlas-soft': '#BFD5E7',
    '--atlas-blue': '#7BB0DA',
    '--atlas-steel': '#457EAA',
    '--atlas-ink': '#132A40',
    '--atlas-body': '#2F4E63',
    '--atlas-surface': 'rgba(255,255,255,0.86)',
  },
};

export function applyThemePreset(preset: ThemePreset) {
  const root = document.documentElement;
  const tokens = themeTokens[preset] ?? themeTokens['azul-clinico'];
  root.dataset.theme = preset;
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

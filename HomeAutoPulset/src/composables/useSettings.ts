import { ref, watch } from 'vue';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';
import i18n from '@/i18n';

export interface AppSettings {
  appearance: {
    theme: string;
    accentColor: string;
    animations: boolean;
    compactMode: boolean;
    showFPS: boolean;
  };
  system: {
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
  };
}

const STORAGE_KEY = 'homeautopulse-settings';

const colorMap: Record<string, string> = {
  purple: '#7C4DFF',
  cyan: '#00E5FF',
  green: '#00C853',
  orange: '#FF6B35',
};

const langMap: Record<string, string> = {
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  'en-US': 'en',
  'ja-JP': 'ja',
};

const defaultSettings: AppSettings = {
  appearance: {
    theme: 'dark',
    accentColor: 'purple',
    animations: true,
    compactMode: false,
    showFPS: false,
  },
  system: {
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
  },
};

const settings = ref<AppSettings>(loadSettings());

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        appearance: { ...defaultSettings.appearance, ...parsed.appearance },
        system: { ...defaultSettings.system, ...parsed.system },
      };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { ...defaultSettings };
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '124, 77, 255';
}

function applyThemeColor(color: string) {
  const root = document.documentElement;
  const hexColor = colorMap[color] || colorMap.purple;
  root.style.setProperty('--accent-color', hexColor);
  root.style.setProperty('--accent-color-rgb', hexToRgb(hexColor));
}

function applyLanguage(lang: string) {
  const dayjsLang = langMap[lang] || 'zh-cn';
  dayjs.locale(dayjsLang);
  document.documentElement.lang = lang;
  if (i18n && i18n.global) {
    i18n.global.locale.value = lang as typeof i18n.global.locale.value;
  }
}

export function useSettings() {
  const initSettings = () => {
    applyThemeColor(settings.value.appearance.accentColor);
    applyLanguage(settings.value.system.language);
  };

  const updateAccentColor = (color: string) => {
    settings.value.appearance.accentColor = color;
    applyThemeColor(color);
    saveSettings();
  };

  const updateLanguage = (lang: string) => {
    settings.value.system.language = lang;
    applyLanguage(lang);
    saveSettings();
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    if (newSettings.appearance) {
      settings.value.appearance = { ...settings.value.appearance, ...newSettings.appearance };
      if (newSettings.appearance.accentColor) {
        applyThemeColor(newSettings.appearance.accentColor);
      }
    }
    if (newSettings.system) {
      settings.value.system = { ...settings.value.system, ...newSettings.system };
      if (newSettings.system.language) {
        applyLanguage(newSettings.system.language);
      }
    }
    saveSettings();
  };

  watch(
    () => settings.value.appearance.accentColor,
    (newColor) => {
      applyThemeColor(newColor);
      saveSettings();
    }
  );

  watch(
    () => settings.value.system.language,
    (newLang) => {
      applyLanguage(newLang);
      saveSettings();
    }
  );

  return {
    settings,
    initSettings,
    updateAccentColor,
    updateLanguage,
    updateSettings,
    colorMap,
    langMap,
  };
}

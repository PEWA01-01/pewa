export interface CustomChatSettings {
  theme: 'classic' | 'midnight' | 'emerald' | 'sunset' | 'crimson';
  wallpaper: 'doodle' | 'dark_solid' | 'gradient' | 'glow' | 'flat';
  fontSize: 'small' | 'medium' | 'large';
  bubbleStyle: 'rounded' | 'sharp' | 'pill' | 'whatsapp';
  cornerRadius: 'small' | 'medium' | 'curved';
  readReceipts: boolean;
  typingIndicators: boolean;
  autoDownloadMedia: boolean;
  autoPlayVoiceNotes: boolean;
  hdAudio: boolean;
}

const DEFAULT_SETTINGS: CustomChatSettings = {
  theme: 'classic',
  wallpaper: 'dark_solid',
  fontSize: 'medium',
  bubbleStyle: 'whatsapp',
  cornerRadius: 'medium',
  readReceipts: true,
  typingIndicators: true,
  autoDownloadMedia: true,
  autoPlayVoiceNotes: true,
  hdAudio: true
};

const CHAT_SETTINGS_KEY = 'pewa_chat_customizations';

export class ChatSettingsService {
  static getSettings(): CustomChatSettings {
    try {
      const saved = localStorage.getItem(CHAT_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to parse chat settings:', e);
    }
    return DEFAULT_SETTINGS;
  }

  static saveSettings(settings: Partial<CustomChatSettings>): CustomChatSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('pewa_chat_settings_changed', { detail: updated }));
    return updated;
  }
}

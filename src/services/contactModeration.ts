// Off-Platform Contact & Social Media Exchange Moderation Service for PEWA

export interface ModerationResult {
  isBlocked: boolean;
  reason?: string;
  detectedType?: 'phone' | 'email' | 'social' | 'intent';
}

export function checkOffPlatformContact(text: string): ModerationResult {
  if (!text) return { isBlocked: false };
  const lower = text.toLowerCase().trim();

  // 1. Email pattern detection
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  if (emailRegex.test(text)) {
    return {
      isBlocked: true,
      reason: 'Sharing email addresses is restricted for unverified accounts.',
      detectedType: 'email'
    };
  }

  // 2. Phone numbers & digit sequence detection
  // International & local numbers (e.g., +260..., 097..., 096..., 077..., 095..., +1..., etc.)
  const phonePattern = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/;
  
  // Extract pure digits to catch spaced out numbers like 0 9 7 1 2 3 4 5 6 7
  const digitsOnly = text.replace(/[^\d]/g, '');
  
  // Check if text has 8 or more digits in total (likely a phone number or contact ID)
  // unless it's just a 4-digit PIN or numeric code explicitly
  if (digitsOnly.length >= 8 && !/^\d{1,5}$/.test(text.trim())) {
    return {
      isBlocked: true,
      reason: 'Sharing phone numbers or digit sequences is restricted for unverified accounts.',
      detectedType: 'phone'
    };
  }

  if (phonePattern.test(text) && (text.includes('+') || /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text))) {
    return {
      isBlocked: true,
      reason: 'Sharing phone numbers is restricted for unverified accounts.',
      detectedType: 'phone'
    };
  }

  // 3. Social Media URLs or keywords
  const socialDomains = [
    'wa.me', 'wa.link', 'whatsapp', 'watsapp', 'watsap', 'whatsap',
    'facebook.com', 'fb.me', 'fb.com', 'facebook',
    'instagram.com', 'instagram', 'insta',
    'snapchat.com', 'snapchat', 'snap:',
    't.me', 'telegram.me', 'telegram', 'tg:',
    'tiktok.com', 'tiktok',
    'twitter.com', 'x.com', 'twitter',
    'm.me', 'messenger',
    'discord.gg', 'discord.com', 'discord'
  ];

  for (const domain of socialDomains) {
    if (lower.includes(domain)) {
      return {
        isBlocked: true,
        reason: `Sharing external handles or links (${domain}) is restricted for unverified accounts.`,
        detectedType: 'social'
      };
    }
  }

  // 4. Handle prefix patterns (e.g. "ig: username", "snap: username", "tg: handle")
  if (/\b(ig|snap|tg|tt|sc|fb)\s*:\s*[\w.]+/i.test(text)) {
    return {
      isBlocked: true,
      reason: 'Sharing social media handles is restricted for unverified accounts.',
      detectedType: 'social'
    };
  }

  // 5. Common intent & request phrases to move conversations off-platform
  const intentPhrases = [
    'send me your number', 'send your number', 'give me your number', 'what is your number', 'whats your number',
    'what\'s your number', 'share your number', 'text me on', 'call me on', 'my number is',
    'whats your whatsapp', 'what\'s your whatsapp', 'send your whatsapp', 'add me on whatsapp', 'hit me on whatsapp',
    'text me on facebook', 'find me on facebook', 'pm me on fb', 'inbox me on fb', 'inbox me on facebook',
    'give me your instagram', 'what\'s your ig', 'whats your ig', 'follow me on ig', 'drop your ig', 'drop your instagram',
    'let\'s chat on telegram', 'lets chat on telegram', 'message me on telegram', 'add my telegram',
    'add me on snapchat', 'what\'s your snap', 'whats your snap',
    'hit me up on discord', 'add my discord',
    'email me at', 'send me an email', 'drop your email',
    'chat off app', 'take this off pewa', 'leave pewa', 'off platform'
  ];

  for (const phrase of intentPhrases) {
    if (lower.includes(phrase)) {
      return {
        isBlocked: true,
        reason: 'Exchanging off-platform contact details or requesting to move off-app is restricted for unverified accounts.',
        detectedType: 'intent'
      };
    }
  }

  return { isBlocked: false };
}

// ═══════════════════════════════════════
// Input validation helpers
// ═══════════════════════════════════════

export function validateEmail(email) {
  if (!email) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone) {
  if (!phone) return true; // optional
  // Allow Brazilian formats: (11) 99999-9999, 11999999999, +5511999999999
  return /^[\d\s()+.-]{8,20}$/.test(phone);
}

export function validateCNPJ(cnpj) {
  if (!cnpj) return true; // optional
  const digits = cnpj.replace(/\D/g, '');
  return digits.length === 14;
}

export function validateUrl(url) {
  if (!url) return true; // optional
  try {
    new URL(url.startsWith('http') ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
}

export function clampNumber(value, min, max, fallback = 0) {
  const num = parseFloat(value);
  if (isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function sanitizeString(str, maxLength = 1000) {
  if (!str) return null;
  return String(str).trim().slice(0, maxLength) || null;
}

/**
 * Validate request body fields. Returns error string or null.
 * rules: { fieldName: { required?: bool, type?: string, email?: bool, phone?: bool, url?: bool, min?: num, max?: num, maxLength?: num } }
 */
export function validateBody(body, rules) {
  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      return `Campo "${field}" é obrigatório`;
    }

    if (value === undefined || value === null || value === '') continue;

    if (rule.email && !validateEmail(value)) {
      return `E-mail "${value}" é inválido`;
    }

    if (rule.phone && !validatePhone(value)) {
      return `Telefone "${value}" é inválido`;
    }

    if (rule.url && !validateUrl(value)) {
      return `URL "${value}" é inválida`;
    }

    if (rule.cnpj && !validateCNPJ(value)) {
      return `CNPJ "${value}" é inválido`;
    }

    if (rule.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) return `Campo "${field}" deve ser um número`;
      if (rule.min !== undefined && num < rule.min) return `Campo "${field}" deve ser no mínimo ${rule.min}`;
      if (rule.max !== undefined && num > rule.max) return `Campo "${field}" deve ser no máximo ${rule.max}`;
    }

    if (rule.maxLength && String(value).length > rule.maxLength) {
      return `Campo "${field}" excede ${rule.maxLength} caracteres`;
    }
  }
  return null;
}

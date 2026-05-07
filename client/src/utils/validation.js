import { z } from 'zod';

const emailSchema = z.string().trim().email('Некоректний формат email');
const phoneSchema = z.string().trim().regex(/^\+?\d{10,15}$/, 'Некоректний номер телефону');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().trim().min(1, 'Вкажіть пароль'),
});

export const registerSchema = z.object({
  email: emailSchema,
  first_name: z.string().trim().min(1, "Вкажіть ім'я"),
  last_name: z.string().trim().min(1, 'Вкажіть прізвище'),
  phone: z.string().trim().optional().or(z.literal('')).refine((value) => !value || /^\+?\d{10,15}$/.test(value.replace(/[\s()-]/g, '')), {
    message: 'Некоректний номер телефону',
  }),
  password: z.string().trim()
    .min(12, 'Пароль має містити щонайменше 12 символів')
    .regex(/[A-Z]/, 'Пароль має містити хоча б одну велику літеру')
    .regex(/[a-z]/, 'Пароль має містити хоча б одну малу літеру')
    .regex(/\d/, 'Пароль має містити хоча б одну цифру')
    .regex(/[^A-Za-z0-9]/, 'Пароль має містити хоча б один спецсимвол'),
});

export const profileSchema = z.object({
  phone: z.string().trim().optional().or(z.literal('')).refine((value) => !value || /^\+?\d{10,15}$/.test(value), {
    message: 'Телефон має бути у форматі +380XXXXXXXXX',
  }),
});

export const checkoutSchema = z.object({
  contact_name: z.string().trim().min(2, "Вкажіть коректне ім'я отримувача"),
  contact_phone: phoneSchema,
  contact_email: z.string().trim().optional().or(z.literal('')).refine((value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), {
    message: 'Email має некоректний формат',
  }),
  delivery_city: z.string().trim().min(1, 'Вкажіть місто доставки'),
  delivery_address: z.string().trim().min(1, 'Вкажіть адресу доставки'),
  delivery_method: z.enum(['nova_poshta', 'ukrposhta', 'courier', 'pickup']),
  payment_method: z.enum(['card', 'cash', 'bank_transfer']),
  promo_code: z.string().trim().max(50, 'Промокод занадто довгий').optional().or(z.literal('')).refine((value) => !value || /^[A-Za-z0-9_-]+$/.test(value), {
    message: 'Промокод може містити лише літери, цифри, дефіс або підкреслення',
  }),
});

export const productFilterSchema = z.object({
  category_id: z.string().optional().or(z.literal('')),
  search: z.string().max(255, 'Пошуковий запит занадто довгий').optional().or(z.literal('')),
  min_price: z.string().optional().or(z.literal('')).refine((value) => !value || Number(value) >= 0, {
    message: 'Мінімальна ціна має бути невідʼємною',
  }),
  max_price: z.string().optional().or(z.literal('')).refine((value) => !value || Number(value) >= 0, {
    message: 'Максимальна ціна має бути невідʼємною',
  }),
  brand_ids: z.string().optional().or(z.literal('')),
  sort_by: z.enum(['name', 'price', 'created_at']).catch('name'),
  sort_order: z.enum(['asc', 'desc']).catch('asc'),
}).refine((data) => {
  if (!data.min_price || !data.max_price) return true;
  return Number(data.max_price) >= Number(data.min_price);
}, {
  path: ['max_price'],
  message: 'Максимальна ціна має бути більшою за мінімальну',
});

export function mapZodErrors(error) {
  const fieldErrors = {};
  for (const issue of error?.issues || []) {
    const field = issue.path?.[0];
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

export function normalizePhoneInput(value) {
  let cleaned = String(value || '').trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
  if (!cleaned.startsWith('+') && cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = `+38${cleaned}`;
  }
  return cleaned;
}

export const SLUG_REGEX = /^[a-z0-9-]+$/;
export const SKU_REGEX = /^[A-Za-z0-9._/-]{3,100}$/;

export function isValidEmail(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function isValidPhone(value) {
  const normalized = normalizePhoneInput(value).replace(/[^\d+]/g, '');
  if (!normalized) return false;
  return /^\+?\d{10,15}$/.test(normalized);
}

export function isValidSlug(value) {
  return SLUG_REGEX.test(String(value || '').trim());
}

export function isValidSku(value) {
  return SKU_REGEX.test(String(value || '').trim());
}

export function isValidUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}


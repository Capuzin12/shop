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
  password: z.string().trim().min(6, 'Пароль має містити щонайменше 6 символів'),
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


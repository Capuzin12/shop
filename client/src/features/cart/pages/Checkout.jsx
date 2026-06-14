import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../../auth/hooks/useAuth';
import api from '../../../api';
import { clientEnv } from '../../../shared/config/env';
import { checkoutSchema, mapZodErrors, normalizePhoneInput } from '../../../shared/utils/validation';
import { formatPrice } from '../../../shared/utils/format';

const GUEST_CHECKOUT_KEY = 'buildshop-checkout-draft';

const DELIVERY_OPTIONS = [
  { id: 'nova_poshta', label: 'Нова пошта', description: 'Відділення або поштомат.', baseCost: 90, freeFrom: 4000, addressLabel: 'Відділення або поштомат' },
  { id: 'ukrposhta', label: 'Укрпошта', description: 'Відділення Укрпошти.', baseCost: 60, freeFrom: 3000, addressLabel: 'Відділення Укрпошти' },
  { id: 'courier', label: 'Курʼєр', description: 'Доставка до дверей.', baseCost: 250, freeFrom: 6000, addressLabel: 'Повна адреса доставки' },
  { id: 'pickup', label: 'Самовивіз', description: 'Безкоштовно зі складу в Києві.', baseCost: 0, freeFrom: 0, addressLabel: 'Точка самовивозу' },
];

const PAYMENT_OPTIONS = [
  { id: 'card', label: 'Карткою при отриманні' },
  { id: 'card_online', label: 'Онлайн-оплата карткою' },
  { id: 'cash', label: 'Готівкою при отриманні' },
  { id: 'bank_transfer', label: 'Безготівковий переказ' },
];

const PICKUP_CITY = 'Київ';
const PICKUP_ADDRESS = 'Головний склад BuildShop, вул. Промислова, 12';

const PAYMENT_COMPATIBILITY = {
  nova_poshta: ['card', 'card_online', 'cash', 'bank_transfer'],
  ukrposhta: ['card', 'card_online', 'bank_transfer'],
  courier: ['card', 'card_online', 'cash', 'bank_transfer'],
  pickup: ['card', 'card_online', 'cash'],
};

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return url;
  return `/${url}`;
};

const readDraft = () => {
  try { const raw = localStorage.getItem(GUEST_CHECKOUT_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};

const getStockQuantity = (item) => {
  if (typeof item?.stock_quantity === 'number') return item.stock_quantity;
  if (typeof item?.in_stock === 'boolean') return item.in_stock ? item.quantity || 0 : 0;
  return null;
};

const normalizePhone = (value) => normalizePhoneInput(value);
const trimValue = (value) => String(value || '').trim();

const getDeliveryOption = (dm) => DELIVERY_OPTIONS.find((o) => o.id === dm) || DELIVERY_OPTIONS[0];

const getAvailablePaymentOptions = (dm) => {
  const allowed = PAYMENT_COMPATIBILITY[dm] || PAYMENT_COMPATIBILITY.nova_poshta;
  return PAYMENT_OPTIONS.filter((o) => allowed.includes(o.id));
};

const mapOrderError = (errorPayload, fallbackMessage) => {
  const detail = errorPayload?.detail;
  if (typeof detail === 'string') return { message: detail };
  if (detail?.code === 'INSUFFICIENT_STOCK') return { message: `Товар "${detail.product_name}" недоступний. Потрібно: ${detail.requested}, доступно: ${detail.available}.` };
  if (detail?.field && detail?.message) return { message: detail.message, fieldErrors: { [detail.field]: detail.message } };
  if (detail?.code === 'PROMO_INVALID') return { message: detail.message || 'Промокод недійсний.', fieldErrors: { promo_code: detail.message || 'Промокод недійсний.' } };
  return { message: detail?.message || fallbackMessage };
};

const parsePhoton = (data) => {
  const props = data?.features?.[0]?.properties || {};
  const city = props.city || props.town || props.village || props.county || '';
  const street = [props.street, props.housenumber].filter(Boolean).join(' ').trim();
  return { city, address: [street, props.district || ''].filter(Boolean).join(', ') || props.name || '' };
};

const parseNominatim = (data) => {
  const a = data?.address || {};
  const city = a.city || a.town || a.village || a.municipality || a.county || '';
  const street = [a.road, a.house_number].filter(Boolean).join(' ').trim();
  return { city, address: [street, a.suburb || ''].filter(Boolean).join(', ') || data?.display_name || '' };
};

const parseBigDataCloud = (data) => ({ city: data?.city || data?.locality || '', address: data?.locality || data?.countryName || '' });

const parseOpenMeteo = (data) => { const r = data?.results?.[0] || {}; return { city: r.name || r.admin2 || '', address: [r.name, r.admin2, r.admin1].filter(Boolean).join(', ') }; };

const reverseGeocodeWithFallback = async (lat, lon) => {
  const providers = [
    { url: `${clientEnv.geocodePhotonUrl}?lat=${lat}&lon=${lon}`, parse: parsePhoton },
    { url: `${clientEnv.geocodeNominatimUrl}?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=uk`, parse: parseNominatim },
    { url: `${clientEnv.geocodeBigDataCloudUrl}?latitude=${lat}&longitude=${lon}&localityLanguage=uk`, parse: parseBigDataCloud },
    { url: `${clientEnv.geocodeOpenMeteoUrl}?latitude=${lat}&longitude=${lon}&language=uk`, parse: parseOpenMeteo },
  ];

  for (const provider of providers) {
    try {
      const res = await fetch(provider.url);
      if (!res.ok) continue;
      const parsed = provider.parse(await res.json());
      if (parsed.city || parsed.address) return parsed;
    } catch { /* try next */ }
  }
  throw new Error('Не вдалося визначити адресу за геолокацією.');
};

export default function Checkout() {
  const { cart, clearCart, getTotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(() => readDraft() || { contact_name: '', contact_phone: '', contact_email: '', delivery_city: '', delivery_address: '', comment: '', promo_code: '', delivery_method: 'nova_poshta', payment_method: 'card' });
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [promoValidation, setPromoValidation] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const orderSubtotal = getTotal();
  const selectedDelivery = getDeliveryOption(formData.delivery_method);
  const allowedPayments = getAvailablePaymentOptions(formData.delivery_method);
  const estimatedDeliveryCost = orderSubtotal >= selectedDelivery.freeFrom ? 0 : selectedDelivery.baseCost;
  const promoDiscountPreview = promoValidation?.valid ? Number(promoValidation.discount || 0) : 0;
  const estimatedTotal = Math.max(orderSubtotal + estimatedDeliveryCost - promoDiscountPreview, 0);

  useEffect(() => { localStorage.setItem(GUEST_CHECKOUT_KEY, JSON.stringify(formData)); }, [formData]);

  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      contact_name: trimValue(prev.contact_name) || [user.first_name, user.last_name].filter(Boolean).join(' ').trim(),
      contact_phone: trimValue(prev.contact_phone) || trimValue(user.phone),
      contact_email: trimValue(prev.contact_email) || trimValue(user.email),
    }));
  }, [user]);

  const updateField = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'delivery_method') {
        const allowed = PAYMENT_COMPATIBILITY[value] || PAYMENT_COMPATIBILITY.nova_poshta;
        if (!allowed.includes(next.payment_method)) next.payment_method = allowed[0];
        if (value === 'pickup') { next.delivery_city = PICKUP_CITY; next.delivery_address = PICKUP_ADDRESS; }
      }
      return next;
    });
    if (field === 'promo_code') setPromoValidation(null);
    setFieldErrors((prev) => { if (!prev[field]) return prev; const { [field]: _, ...rest } = prev; return rest; });
  };

  const applyPromoCode = async () => {
    const promoCode = trimValue(formData.promo_code);
    if (!promoCode) { setPromoValidation(null); return; }
    try {
      setPromoLoading(true);
      const res = await api.post('/api/promo-codes/validate', { code: promoCode, order_amount: orderSubtotal });
      const result = res.data || {};
      setPromoValidation({ valid: Boolean(result.valid), message: result.message || '', discount: Number(result.discount || 0), promo: result.promo || null });
    } catch (error) {
      setPromoValidation({ valid: false, message: error?.response?.data?.detail?.message || 'Не вдалося перевірити промокод.', discount: 0, promo: null });
    } finally { setPromoLoading(false); }
  };

  const autofillAddressFromLocation = async () => {
    if (!locationConsent) { setLocationMessage('Спочатку підтвердіть дозвіл на геолокацію.'); return; }
    if (!navigator.geolocation) { setLocationMessage('Браузер не підтримує геолокацію.'); return; }
    setLocationLoading(true);
    setLocationMessage('Запитуємо геолокацію...');

    navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const geocoded = await reverseGeocodeWithFallback(latitude, longitude);
            setFormData((prev) => ({ ...prev, delivery_city: prev.delivery_city || geocoded.city || '', delivery_address: prev.delivery_address || geocoded.address || '' }));
            setLocationMessage('Адреса заповнена. Відредагуйте за потреби.');
          } catch (error) { setLocationMessage(error?.message || 'Не вдалося визначити адресу.'); }
          finally { setLocationLoading(false); }
        },
        (error) => {
          const map = { 1: 'Доступ відхилено.', 2: 'Не вдалося отримати координати.', 3: 'Час очікування вичерпано.' };
          setLocationMessage(map[error.code] || 'Помилка геолокації.');
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setMessage('');

    if (!user) { setMessage('Увійдіть, щоб завершити оформлення.'); navigate('/login'); return; }

    const payload = { ...formData, contact_name: trimValue(formData.contact_name), contact_phone: normalizePhone(formData.contact_phone), contact_email: trimValue(formData.contact_email), delivery_city: trimValue(formData.delivery_city), delivery_address: trimValue(formData.delivery_address), comment: trimValue(formData.comment), promo_code: trimValue(formData.promo_code), items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })) };
    if (payload.delivery_method === 'pickup') { payload.delivery_city = PICKUP_CITY; payload.delivery_address = payload.delivery_address || PICKUP_ADDRESS; }

    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) { setFieldErrors(mapZodErrors(parsed.error)); setMessage('Перевірте заповнення полів форми.'); return; }

    const outOfStock = cart.find((item) => { const a = getStockQuantity(item); return typeof a === 'number' && a >= 0 && a < item.quantity; });
    if (outOfStock) { setMessage(`Товару "${outOfStock.name}" недостатньо на складі.`); return; }

    try {
      setSubmitting(true);
      await api.post('/api/orders', payload);
      clearCart();
      localStorage.removeItem(GUEST_CHECKOUT_KEY);
      window.dispatchEvent(new Event('buildshop:notifications-refresh'));
      navigate('/profile');
    } catch (error) {
      const p = mapOrderError(error?.response?.data, 'Не вдалося оформити замовлення');
      if (p.fieldErrors) setFieldErrors(p.fieldErrors);
      setMessage(p.message || 'Не вдалося оформити замовлення');
    } finally { setSubmitting(false); }
  };

  useEffect(() => { if (cart.length === 0) navigate('/cart'); }, [cart.length, navigate]);
  if (cart.length === 0) return null;

  const getInputClass = (field) => `form-input ${fieldErrors[field] ? 'form-input-error' : ''}`;

  return (
      <div className="page-shell">
        <div className="mb-6 rounded-2xl border border-white/50 bg-white/75 px-5 py-4 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">Замовлення</p>
          <h1 className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white">Оформлення замовлення</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,360px] lg:items-start">
          <form noValidate onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl border border-white/50 bg-white/75 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Контактні дані</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Ім'я отримувача *</label>
                  <input value={formData.contact_name} onChange={(e) => updateField('contact_name', e.target.value)} className={getInputClass('contact_name')} required />
                  {fieldErrors.contact_name && <p className="form-error-text">{fieldErrors.contact_name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Телефон *</label>
                  <input value={formData.contact_phone} onChange={(e) => updateField('contact_phone', e.target.value)} className={getInputClass('contact_phone')} required />
                  {fieldErrors.contact_phone && <p className="form-error-text">{fieldErrors.contact_phone}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">Email</label>
                  <input value={formData.contact_email} onChange={(e) => updateField('contact_email', e.target.value)} className={getInputClass('contact_email')} />
                  {fieldErrors.contact_email && <p className="form-error-text">{fieldErrors.contact_email}</p>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/50 bg-white/75 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Спосіб доставки</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {DELIVERY_OPTIONS.map((option) => {
                  const active = formData.delivery_method === option.id;
                  const free = option.freeFrom > 0 && orderSubtotal >= option.freeFrom;
                  return (
                      <button key={option.id} type="button" onClick={() => updateField('delivery_method', option.id)}
                              className={`rounded-xl border px-4 py-3 text-left transition ${active ? 'border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/30 dark:hover:bg-white/5'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{option.label}</span>
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">{free ? 'Безкоштовно' : formatPrice(option.baseCost)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{option.description}</p>
                      </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/50 bg-white/75 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Адреса доставки</p>
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-500/20 dark:bg-blue-500/10">
                <input type="checkbox" checked={locationConsent} onChange={(e) => setLocationConsent(e.target.checked)} className="h-4 w-4" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Дозволити геолокацію для автозаповнення</span>
                <button type="button" onClick={autofillAddressFromLocation} disabled={!locationConsent || locationLoading}
                        className="ml-auto rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 disabled:opacity-50 dark:border-blue-500/30 dark:bg-slate-950/40 dark:text-blue-300">
                  {locationLoading ? 'Визначаємо...' : 'Автозаповнити'}
                </button>
              </div>
              {locationMessage && <p className="mb-2 text-xs text-blue-600 dark:text-blue-300">{locationMessage}</p>}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Місто *</label>
                  <input value={formData.delivery_city} onChange={(e) => updateField('delivery_city', e.target.value)} className={getInputClass('delivery_city')} required disabled={formData.delivery_method === 'pickup'} />
                  {fieldErrors.delivery_city && <p className="form-error-text">{fieldErrors.delivery_city}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{selectedDelivery.addressLabel} *</label>
                  <input value={formData.delivery_address} onChange={(e) => updateField('delivery_address', e.target.value)} className={getInputClass('delivery_address')} required disabled={formData.delivery_method === 'pickup'} placeholder={formData.delivery_method === 'pickup' ? PICKUP_ADDRESS : ''} />
                  {fieldErrors.delivery_address && <p className="form-error-text">{fieldErrors.delivery_address}</p>}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/50 bg-white/75 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Спосіб оплати</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {allowedPayments.map((option) => {
                  const active = formData.payment_method === option.id;
                  return (
                      <button key={option.id} type="button" onClick={() => updateField('payment_method', option.id)}
                              className={`rounded-xl border px-4 py-2.5 text-left transition ${active ? 'border-amber-300 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-400/10' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/30 dark:hover:bg-white/5'}`}>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{option.label}</span>
                      </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/50 bg-white/75 p-5 backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Коментар та промокод</p>
              <div className="space-y-3">
                <textarea value={formData.comment} onChange={(e) => updateField('comment', e.target.value)} rows={2} placeholder="Коментар до замовлення" className={getInputClass('comment')} />
                <div className="flex gap-2">
                  <input value={formData.promo_code || ''} onChange={(e) => updateField('promo_code', e.target.value.toUpperCase())} placeholder="Промокод" className={`${getInputClass('promo_code')} flex-1`} />
                  <button type="button" onClick={applyPromoCode} disabled={promoLoading}
                          className="rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
                    {promoLoading ? '...' : 'OK'}
                  </button>
                </div>
                {promoValidation && (
                    <p className={`text-xs ${promoValidation.valid ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-500 dark:text-rose-300'}`}>
                      {promoValidation.message}{promoValidation.valid && promoValidation.discount > 0 ? ` Знижка: ${formatPrice(promoValidation.discount)}.` : ''}
                    </p>
                )}
              </div>
            </div>

            {message && (
                <p className={Object.keys(fieldErrors).length ? 'form-error-banner' : 'rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}>
                  {message}
                </p>
            )}

            <div className="flex justify-center">
              <button disabled={submitting} type="submit"
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-8 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
                {submitting ? 'Оформлення...' : user ? 'Підтвердити замовлення' : 'Увійти та оформити'}
              </button>
            </div>
          </form>

          <div className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-white/50 bg-white/75 p-5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Ваше замовлення</p>
              <div className="space-y-3">
                {cart.map((item) => {
                  const available = getStockQuantity(item);
                  const isOut = typeof available === 'number' && available >= 0 && available < item.quantity;
                  return (
                      <div key={item.id} className="flex items-center gap-3">
                        {item.image_url ? (
                            <div className="h-10 w-10 flex-none overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                              <img src={getImageUrl(item.image_url)} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                            </div>
                        ) : <div className="h-10 w-10 flex-none rounded-lg bg-slate-100 dark:bg-slate-800" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.quantity} шт{isOut ? ' · недостатньо' : ''}</p>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{formatPrice(item.price * item.quantity)}</p>
                      </div>
                  );
                })}
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm text-slate-900 dark:text-white">
                    <span>Товари</span>
                    <span className="font-medium">{formatPrice(orderSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-900 dark:text-white">
                    <span>Доставка</span>
                    <span className="font-medium">{estimatedDeliveryCost > 0 ? formatPrice(estimatedDeliveryCost) : 'Безкоштовно'}</span>
                  </div>
                  {promoDiscountPreview > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                        <span>Знижка</span>
                        <span className="font-medium">-{formatPrice(promoDiscountPreview)}</span>
                      </div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 dark:border-white/10">
                    <span className="text-base font-black text-slate-900 dark:text-white">Разом</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">{formatPrice(estimatedTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { checkoutSchema, mapZodErrors, normalizePhoneInput } from '../utils/validation';

const GUEST_CHECKOUT_KEY = 'buildshop-checkout-draft';

const formatPrice = (price) => new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
}).format(price || 0);

const readDraft = () => {
  try {
    const raw = localStorage.getItem(GUEST_CHECKOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStockQuantity = (item) => {
  if (typeof item?.stock_quantity === 'number') return item.stock_quantity;
  if (typeof item?.in_stock === 'boolean') return item.in_stock ? item.quantity || 0 : 0;
  return null;
};

const trimValue = (value) => String(value || '').trim();

const normalizePhone = (value) => {
  return normalizePhoneInput(value);
};

const mapOrderError = (errorPayload, fallbackMessage) => {
  const detail = errorPayload?.detail;
  if (typeof detail === 'string') {
    return { message: detail };
  }

  if (detail?.code === 'INSUFFICIENT_STOCK') {
    return {
      message: `Товар "${detail.product_name}" недоступний у потрібній кількості. Потрібно: ${detail.requested}, доступно: ${detail.available}.`,
    };
  }

  if (detail?.field && detail?.message) {
    return {
      message: detail.message,
      fieldErrors: { [detail.field]: detail.message },
    };
  }

  return { message: detail?.message || fallbackMessage };
};

const composeAddress = (street, district, fallback) => {
  return [street, district].filter(Boolean).join(', ').trim() || fallback || '';
};

const parsePhoton = (data) => {
  const props = data?.features?.[0]?.properties || {};
  const city = props.city || props.town || props.village || props.county || '';
  const street = [props.street, props.housenumber].filter(Boolean).join(' ').trim();
  const district = props.district || props.suburb || '';
  const address = composeAddress(street, district, props.name || props.state || '');
  return { city, address };
};

const parseNominatim = (data) => {
  const addressData = data?.address || {};
  const city = addressData.city || addressData.town || addressData.village || addressData.municipality || addressData.county || '';
  const street = [addressData.road, addressData.house_number].filter(Boolean).join(' ').trim();
  const district = addressData.suburb || addressData.neighbourhood || '';
  const address = composeAddress(street, district, data?.display_name || '');
  return { city, address };
};

const parseBigDataCloud = (data) => {
  const city = data?.city || data?.locality || data?.principalSubdivision || '';
  const district = data?.localityInfo?.administrative?.[2]?.name || data?.localityInfo?.informative?.[0]?.name || '';
  const street = [data?.locality, data?.principalSubdivision].filter(Boolean).join(', ');
  const address = composeAddress(street, district, data?.locality || data?.countryName || '');
  return { city, address };
};

const parseOpenMeteo = (data) => {
  const result = data?.results?.[0] || {};
  const city = result.name || result.admin2 || result.admin1 || '';
  const address = [result.name, result.admin2, result.admin1].filter(Boolean).join(', ');
  return { city, address };
};

const reverseGeocodeWithFallback = async (latitude, longitude) => {
  const providers = [
    {
      name: 'Photon',
      url: `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`,
      parse: parsePhoton,
    },
    {
      name: 'Nominatim',
      url: `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=uk`,
      parse: parseNominatim,
    },
    {
      name: 'BigDataCloud',
      url: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=uk`,
      parse: parseBigDataCloud,
    },
    {
      name: 'Open-Meteo',
      url: `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=uk`,
      parse: parseOpenMeteo,
    },
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url);
      if (!response.ok) continue;
      const data = await response.json();
      const parsed = provider.parse(data);
      if (parsed.city || parsed.address) {
        return { ...parsed, provider: provider.name };
      }
    } catch {
      // Try next provider silently.
    }
  }

  throw new Error('Не вдалося визначити адресу за геолокацією через жоден сервіс.');
};

export default function Checkout() {
  const { cart, clearCart, getTotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(() => readDraft() || {
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    delivery_city: '',
    delivery_address: '',
    comment: '',
    delivery_method: 'nova_poshta',
    payment_method: 'card',
  });
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  const getInputClass = (field) => `form-input ${fieldErrors[field] ? 'form-input-error' : ''}`;

  useEffect(() => {
    localStorage.setItem(GUEST_CHECKOUT_KEY, JSON.stringify(formData));
  }, [formData]);

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
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const autofillAddressFromLocation = async () => {
    if (!locationConsent) {
      setLocationMessage('Спочатку підтвердіть дозвіл на використання геолокації.');
      return;
    }
    if (!navigator.geolocation) {
      setLocationMessage('Ваш браузер не підтримує геолокацію.');
      return;
    }

    setLocationLoading(true);
    setLocationMessage('Запитуємо геолокацію...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const geocoded = await reverseGeocodeWithFallback(latitude, longitude);

          setFormData((prev) => ({
            ...prev,
            delivery_city: prev.delivery_city || geocoded.city || '',
            delivery_address: prev.delivery_address || geocoded.address || '',
          }));

          setLocationMessage(`Місто та адреса заповнені за геолокацією (${geocoded.provider}). За потреби відредагуйте вручну.`);
        } catch (error) {
          setLocationMessage(error?.message || 'Не вдалося визначити адресу.');
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        const map = {
          1: 'Доступ до геолокації відхилено. Дозвольте доступ у браузері.',
          2: 'Не вдалося отримати координати. Перевірте сигнал геолокації.',
          3: 'Час очікування геолокації вичерпано.',
        };
        setLocationMessage(map[error.code] || 'Помилка отримання геолокації.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const getAvailableQuantity = (item) => {
    return getStockQuantity(item);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setMessage('');

    if (!user) {
      setMessage('Чернетку збережено локально. Увійдіть, щоб завершити оформлення замовлення.');
      navigate('/login');
      return;
    }

    const payload = {
      ...formData,
      contact_name: trimValue(formData.contact_name),
      contact_phone: normalizePhone(formData.contact_phone),
      contact_email: trimValue(formData.contact_email),
      delivery_city: trimValue(formData.delivery_city),
      delivery_address: trimValue(formData.delivery_address),
      comment: trimValue(formData.comment),
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      })),
    };

    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed.error));
      setMessage('Перевірте заповнення полів форми.');
      return;
    }

    const outOfStock = cart.find((item) => {
      const available = getAvailableQuantity(item);
      return typeof available === 'number' && available >= 0 && available < item.quantity;
    });
    if (outOfStock) {
      const available = getAvailableQuantity(outOfStock);
      setMessage(`Товару "${outOfStock.name}" недостатньо на складі. Доступно: ${available}`);
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const parsed = mapOrderError(errorPayload, 'Не вдалося оформити замовлення');
        if (parsed.fieldErrors) setFieldErrors(parsed.fieldErrors);
        throw new Error(parsed.message);
      }

      clearCart();
      localStorage.removeItem(GUEST_CHECKOUT_KEY);
      navigate('/profile');
    } catch (error) {
      console.error('Error creating order:', error);
      const errorMsg = error?.message || 'Не вдалося оформити замовлення';
      setMessage(`Не вдалося оформити замовлення. Помилка: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">Checkout Draft</p>
        <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">Оформлення замовлення</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Дані форми зберігаються локально, тому навіть без входу ви не втратите введену інформацію.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.05fr,0.95fr]">
        <form noValidate onSubmit={handleSubmit} className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
              <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={locationConsent}
                  onChange={(e) => setLocationConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>Дозволяю використати мою геолокацію для автозаповнення міста та адреси.</span>
              </label>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={autofillAddressFromLocation}
                  disabled={!locationConsent || locationLoading}
                  className="rounded-2xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/30 dark:bg-slate-950/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                >
                  {locationLoading ? 'Визначаємо місцезнаходження...' : 'Автозаповнити адресу'}
                </button>
                {locationMessage ? <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">{locationMessage}</p> : null}
              </div>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Ім'я<span className="required-mark">*</span></span>
              <input value={formData.contact_name} onChange={(e) => updateField('contact_name', e.target.value)} className={getInputClass('contact_name')} required />
              {fieldErrors.contact_name ? <p className="form-error-text">{fieldErrors.contact_name}</p> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Телефон<span className="required-mark">*</span></span>
              <input value={formData.contact_phone} onChange={(e) => updateField('contact_phone', e.target.value)} className={getInputClass('contact_phone')} required />
              {fieldErrors.contact_phone ? <p className="form-error-text">{fieldErrors.contact_phone}</p> : null}
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Email</span>
              <input value={formData.contact_email} onChange={(e) => updateField('contact_email', e.target.value)} className={getInputClass('contact_email')} />
              {fieldErrors.contact_email ? <p className="form-error-text">{fieldErrors.contact_email}</p> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Місто<span className="required-mark">*</span></span>
              <input value={formData.delivery_city} onChange={(e) => updateField('delivery_city', e.target.value)} className={getInputClass('delivery_city')} required />
              {fieldErrors.delivery_city ? <p className="form-error-text">{fieldErrors.delivery_city}</p> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Адреса<span className="required-mark">*</span></span>
              <input value={formData.delivery_address} onChange={(e) => updateField('delivery_address', e.target.value)} className={getInputClass('delivery_address')} required />
              {fieldErrors.delivery_address ? <p className="form-error-text">{fieldErrors.delivery_address}</p> : null}
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Коментар</span>
              <textarea value={formData.comment} onChange={(e) => updateField('comment', e.target.value)} rows="4" className={getInputClass('comment')} />
            </label>
          </div>

          {message ? (
            <p className={Object.keys(fieldErrors).length ? 'form-error-banner' : 'mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}>
              {message}
            </p>
          ) : null}

          <button disabled={submitting} className="mt-6 w-full rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300" type="submit">
            {submitting ? 'Оформлення...' : user ? 'Підтвердити замовлення' : 'Зберегти чернетку і перейти до входу'}
          </button>
        </form>

        <div className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-xl shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Ваше замовлення</h2>
          <div className="mt-5 space-y-3">
            {cart.map((item) => {
              const available = getAvailableQuantity(item);
              const isOutOfStock = typeof available === 'number' && available >= 0 && available < item.quantity;
              return (
                <div key={item.id} className={`flex items-center justify-between rounded-2xl border px-4 py-3 dark:border-white/10 dark:bg-white/5 ${isOutOfStock ? 'border-rose-300 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10' : 'border-slate-200 bg-slate-50'}`}>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {item.quantity} x {formatPrice(item.price)}
                      {typeof available === 'number' && available > 0 && available < item.quantity && (
                        <span className="ml-2 text-rose-500"> (в наявності: {available})</span>
                      )}
                      {available === 0 && (
                        <span className="ml-2 text-rose-500"> (немає в наявності)</span>
                      )}
                      {available === null && (
                        <span className="ml-2 text-slate-400"> (склад оновлюється)</span>
                      )}
                    </p>
                    {item.description ? <p className="mt-1 max-w-[360px] text-xs text-slate-400 dark:text-slate-500">{item.description}</p> : null}
                  </div>
                  <p className="font-bold text-amber-600 dark:text-amber-300">{formatPrice(item.price * item.quantity)}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[1.75rem] bg-slate-950 p-5 text-white dark:bg-amber-400 dark:text-slate-950">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70 dark:text-slate-800/70">Разом</p>
            <p className="mt-2 text-3xl font-black">{formatPrice(getTotal())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

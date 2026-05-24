import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { mapZodErrors } from '../utils/validation';
import { z } from 'zod';

const resetSchema = z.object({
  new_password: z.string().trim()
      .min(12, 'Пароль має містити щонайменше 12 символів')
      .regex(/[A-Z]/, 'Пароль має містити хоча б одну велику літеру')
      .regex(/[a-z]/, 'Пароль має містити хоча б одну малу літеру')
      .regex(/\d/, 'Пароль має містити хоча б одну цифру')
      .regex(/[^A-Za-z0-9]/, 'Пароль має містити хоча б один спецсимвол'),
  confirm_password: z.string().trim().min(1, 'Підтвердіть пароль'),
}).refine((data) => data.new_password === data.confirm_password, {
  path: ['confirm_password'],
  message: 'Паролі не збігаються',
});

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(null); // null=checking, true, false

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    api.get(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
        .then((res) => setTokenValid(Boolean(res.data?.valid)))
        .catch(() => setTokenValid(false));
  }, [token]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = resetSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed.error));
      setFormError('Перевірте поля форми.');
      return;
    }
    setFormError('');
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, new_password: parsed.data.new_password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setFormError(detail?.message || detail || 'Не вдалося змінити пароль. Спробуйте надіслати новий запит.');
      setTokenValid(false);
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (tokenValid === null) {
    return (
        <div className="page-shell-comfy">
          <div className="mx-auto max-w-md rounded-[2rem] border border-white/50 bg-white/75 p-10 text-center shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-600 dark:text-amber-300" />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Перевірка посилання...</p>
          </div>
        </div>
    );
  }

  // Invalid token
  if (tokenValid === false) {
    return (
        <div className="page-shell-comfy">
          <div className="mx-auto max-w-md rounded-[2rem] border border-rose-200 bg-white/75 p-10 shadow-xl backdrop-blur dark:border-rose-500/30 dark:bg-slate-900/60">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Посилання недійсне</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Посилання для скидання пароля вже використане або його термін дії (30 хвилин) вичерпано.
            </p>
            <Link
                to="/forgot-password"
                className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
            >
              Запросити нове посилання
            </Link>
          </div>
        </div>
    );
  }

  // Success state
  if (success) {
    return (
        <div className="page-shell-comfy">
          <div className="mx-auto max-w-md rounded-[2rem] border border-white/50 bg-white/75 p-10 text-center shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Пароль змінено!</h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Тепер ви можете увійти з новим паролем. Перенаправлення до сторінки входу...
            </p>
            <Link
                to="/login"
                className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
            >
              Увійти зараз
            </Link>
          </div>
        </div>
    );
  }

  // Main form
  return (
      <div className="page-shell-comfy">
        <div className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-5xl font-black text-slate-950 dark:text-white">Новий пароль</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Введіть новий надійний пароль. Він має містити щонайменше 12 символів,
              велику і малу літери, цифру та спецсимвол.
            </p>
          </div>

          <form noValidate onSubmit={handleSubmit} className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Змінити пароль</h2>

            {formError ? <p className="form-error-banner mt-4">{formError}</p> : null}

            <div className="mt-6 space-y-4">
              <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Новий пароль<span className="required-mark">*</span>
              </span>
                <input
                    type="password"
                    value={form.new_password}
                    onChange={(e) => updateField('new_password', e.target.value)}
                    required
                    className={`form-input ${fieldErrors.new_password ? 'form-input-error' : ''}`}
                />
                {fieldErrors.new_password ? (
                    <p className="form-error-text">{fieldErrors.new_password}</p>
                ) : null}
              </label>

              <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Підтвердити пароль<span className="required-mark">*</span>
              </span>
                <input
                    type="password"
                    value={form.confirm_password}
                    onChange={(e) => updateField('confirm_password', e.target.value)}
                    required
                    className={`form-input ${fieldErrors.confirm_password ? 'form-input-error' : ''}`}
                />
                {fieldErrors.confirm_password ? (
                    <p className="form-error-text">{fieldErrors.confirm_password}</p>
                ) : null}
              </label>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
            >
              {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Збереження...
                  </>
              ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Встановити новий пароль
                  </>
              )}
            </button>
          </form>
        </div>
      </div>
  );
}
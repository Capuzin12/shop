import { KeyRound, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Вкажіть email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Некоректний формат email');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: trimmedEmail });
      setSubmitted(true);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail?.message || detail || 'Не вдалося відправити лист. Спробуйте пізніше.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell-comfy">
      <div className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-5xl font-black text-slate-950 dark:text-white">Забули пароль?</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Введіть свій email — ми надішлемо посилання для скидання пароля.
            Посилання діє {' '}
            <span className="font-semibold text-slate-900 dark:text-white">30 хвилин</span>.
          </p>
        </div>

        <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          {submitted ? (
            <div className="flex h-full flex-col items-start justify-center gap-5">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Mail className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Лист надіслано</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Якщо акаунт з адресою <strong className="text-slate-900 dark:text-white">{email}</strong> існує,
                  ви отримаєте email із посиланням для скидання пароля протягом кількох хвилин.
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Перевірте також папку «Спам».
                </p>
              </div>
              <Link
                to="/login"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
              >
                Повернутися до входу
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Скидання пароля</h2>

              {error ? <p className="form-error-banner mt-4">{error}</p> : null}

              <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
                    Email<span className="required-mark">*</span>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="your@email.com"
                    required
                    className={`form-input ${error ? 'form-input-error' : ''}`}
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Надсилання...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Надіслати посилання
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Згадали пароль?{' '}
                <Link to="/login" className="font-semibold text-amber-700 hover:underline dark:text-amber-300">
                  Увійти
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

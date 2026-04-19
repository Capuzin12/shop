import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLandingPath } from '../utils/roles';
import { loginSchema, mapZodErrors } from '../utils/validation';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const parsed = loginSchema.safeParse(formData);
    if (!parsed.success) {
      setFieldErrors(mapZodErrors(parsed.error));
      setError('Перевірте обовʼязкові поля.');
      return;
    }

    setError('');
    try {
      const userData = await login(parsed.data.email, parsed.data.password);
      const from = location.state?.from?.pathname;
      navigate(from || getRoleLandingPath(userData?.role), { replace: true });
    } catch {
      setError('Невірний email або пароль');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600 dark:text-amber-300">BuildShop ID</p>
          <h1 className="mt-4 text-5xl font-black text-slate-950 dark:text-white">Вхід до акаунта</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Після входу синхронізуються вподобайки, кошик і сповіщення про замовлення та низький запас.
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Увійти</h2>
          {error ? (
            <p className="form-error-banner">
              {error}
            </p>
          ) : null}

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Email<span className="required-mark">*</span></span>
              <input type="email" name="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} required className={`form-input ${fieldErrors.email ? 'form-input-error' : ''}`} />
              {fieldErrors.email ? <p className="form-error-text">{fieldErrors.email}</p> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Пароль<span className="required-mark">*</span></span>
              <input type="password" name="password" value={formData.password} onChange={(e) => updateField('password', e.target.value)} required className={`form-input ${fieldErrors.password ? 'form-input-error' : ''}`} />
              {fieldErrors.password ? <p className="form-error-text">{fieldErrors.password}</p> : null}
            </label>
          </div>

          <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300" type="submit">
            <LogIn className="h-4 w-4" />
            Увійти
          </button>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Ще не маєте акаунта? <Link to="/register" className="font-semibold text-amber-700 hover:underline dark:text-amber-300">Зареєструватися</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

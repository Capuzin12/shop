import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

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
    const nextErrors = {};

    const email = String(formData.email || '').trim();
    const password = String(formData.password || '').trim();
    const firstName = String(formData.first_name || '').trim();
    const lastName = String(formData.last_name || '').trim();
    const phone = String(formData.phone || '').trim();

    if (!email) nextErrors.email = 'Вкажіть email';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) nextErrors.email = 'Некоректний формат email';
    if (!firstName) nextErrors.first_name = "Вкажіть ім'я";
    if (!lastName) nextErrors.last_name = 'Вкажіть прізвище';
    if (!password) nextErrors.password = 'Вкажіть пароль';
    else if (password.length < 6) nextErrors.password = 'Пароль має містити щонайменше 6 символів';
    if (phone && !/^\+?\d{10,15}$/.test(phone.replace(/[\s()-]/g, ''))) nextErrors.phone = 'Некоректний номер телефону';

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError('Перевірте обовʼязкові поля.');
      return;
    }

    setError('');
    try {
      await api.post('/api/users', { ...formData, email, password, first_name: firstName, last_name: lastName, phone });
      navigate('/login');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail?.message || detail || 'Помилка реєстрації');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600 dark:text-amber-300">Новий акаунт</p>
          <h1 className="mt-4 text-5xl font-black text-slate-950 dark:text-white">Реєстрація</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Після створення профілю ви зможете керувати замовленнями, отримувати сповіщення і синхронізувати локально збережені дані.
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Створити акаунт</h2>
          {error ? (
            <p className="form-error-banner">
              {error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Email<span className="required-mark">*</span></span>
              <input type="email" name="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} required className={`form-input ${fieldErrors.email ? 'form-input-error' : ''}`} />
              {fieldErrors.email ? <p className="form-error-text">{fieldErrors.email}</p> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Ім’я<span className="required-mark">*</span></span>
              <input type="text" name="first_name" value={formData.first_name} onChange={(e) => updateField('first_name', e.target.value)} required className={`form-input ${fieldErrors.first_name ? 'form-input-error' : ''}`} />
              {fieldErrors.first_name ? <p className="form-error-text">{fieldErrors.first_name}</p> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Прізвище<span className="required-mark">*</span></span>
              <input type="text" name="last_name" value={formData.last_name} onChange={(e) => updateField('last_name', e.target.value)} required className={`form-input ${fieldErrors.last_name ? 'form-input-error' : ''}`} />
              {fieldErrors.last_name ? <p className="form-error-text">{fieldErrors.last_name}</p> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Телефон</span>
              <input type="tel" name="phone" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className={`form-input ${fieldErrors.phone ? 'form-input-error' : ''}`} />
              {fieldErrors.phone ? <p className="form-error-text">{fieldErrors.phone}</p> : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Пароль<span className="required-mark">*</span></span>
              <input type="password" name="password" value={formData.password} onChange={(e) => updateField('password', e.target.value)} required className={`form-input ${fieldErrors.password ? 'form-input-error' : ''}`} />
              {fieldErrors.password ? <p className="form-error-text">{fieldErrors.password}</p> : null}
            </label>
          </div>

          <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300" type="submit">
            <UserPlus className="h-4 w-4" />
            Зареєструватися
          </button>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Уже маєте акаунт? <Link to="/login" className="font-semibold text-amber-700 hover:underline dark:text-amber-300">Увійти</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

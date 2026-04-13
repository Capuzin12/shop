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
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/users', formData);
      navigate('/login');
    } catch {
      setError('Помилка реєстрації');
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

        <form onSubmit={handleSubmit} className="rounded-[2.5rem] border border-white/50 bg-white/75 p-8 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Створити акаунт</h2>
          {error ? (
            <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Email</span>
              <input type="email" name="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Ім’я</span>
              <input type="text" name="first_name" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Прізвище</span>
              <input type="text" name="last_name" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Телефон</span>
              <input type="tel" name="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Пароль</span>
              <input type="password" name="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100" />
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

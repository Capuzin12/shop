import { ArrowRight, Bell, Heart, MoonStar, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: Heart,
    title: 'Вподобайки без входу',
    text: 'Збереження обраних товарів у локальному сховищі та автоматичне перенесення в акаунт після входу.',
  },
  {
    icon: Bell,
    title: 'Живі сповіщення',
    text: 'Лічильник дзвіночка оновлюється відразу, а алерти про низький запас мають окремий візуальний акцент.',
  },
  {
    icon: ShoppingCart,
    title: 'Стійкий кошик',
    text: 'Гостьовий кошик не губиться між сесіями та синхронізується з сервером після авторизації.',
  },
  {
    icon: MoonStar,
    title: 'Дві теми',
    text: 'Світлий та темний режими працюють на всіх оновлених екранах у спільній візуальній системі.',
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/50 bg-white/75 px-6 py-12 shadow-2xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none sm:px-10 lg:px-14">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.18),_transparent_60%)] lg:block dark:bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.12),_transparent_60%)]" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-600 dark:text-amber-300">Build smarter</p>
          <h1 className="mt-4 text-5xl font-black leading-none text-slate-950 dark:text-white sm:text-6xl">
            Матеріали, склад і сповіщення в одному чистому інтерфейсі.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            BuildShop тепер виглядає цілісно: теплі світлі поверхні, глибокий темний режим, реактивні лічильники та збереження гостьових даних без втрат.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/catalog" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300">
              Переглянути каталог
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/wishlist" className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              Відкрити вподобайки
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => {
          const FeatureIcon = feature.icon;
          return (
          <div key={feature.title} className="rounded-[2rem] border border-white/50 bg-white/70 p-6 shadow-lg shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <FeatureIcon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.text}</p>
          </div>
        )})}
      </section>
    </div>
  );
}

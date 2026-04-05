import { useState } from 'react'

const API_URL = 'http://localhost:8000/'

export default function App() {
  const [status, setStatus] = useState('idle')
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)

  async function checkApi() {
    setStatus('loading')
    setPayload(null)
    setError(null)
    try {
      const res = await fetch(API_URL)
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
      if (!res.ok) {
        setError(`Помилка ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
        setStatus('error')
        return
      }
      setPayload(data)
      setStatus('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50 px-6 py-16 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950/40 dark:text-slate-100">
      <div className="w-full max-w-lg text-center">
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-violet-600/90 dark:text-violet-400">
          BuildShop
        </p>
        <h1 className="mb-10 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Вітаю у BuildShop
        </h1>
        <button
          type="button"
          onClick={checkApi}
          disabled={status === 'loading'}
          className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-violet-500 dark:hover:bg-violet-400 dark:shadow-violet-500/20"
        >
          {status === 'loading' ? 'Перевірка…' : "Перевірити з'єднання з API"}
        </button>

        {status === 'success' && payload != null && (
          <div
            className="mt-8 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 p-5 text-left shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/50"
            role="status"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Відповідь API
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm text-emerald-900 dark:text-emerald-100">
              {typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}

        {status === 'error' && error != null && (
          <div
            className="mt-8 rounded-2xl border border-red-200/80 bg-red-50/90 p-5 text-left shadow-sm dark:border-red-900/50 dark:bg-red-950/40"
            role="alert"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
              Помилка
            </p>
            <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
            <p className="mt-3 text-xs text-red-800/80 dark:text-red-300/90">
              Переконайтеся, що сервер запущено: <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono dark:bg-red-900/50">uvicorn</code> на порту 8000.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

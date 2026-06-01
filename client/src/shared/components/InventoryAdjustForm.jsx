import React, { useState } from 'react';
import { useAdjustInventory } from '../hooks/useInventoryAdjust';

export default function InventoryAdjustForm({ item, onSuccess, onCancel, compact = false }) {
  const [mode, setMode] = useState('receipt');
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const adjust = useAdjustInventory();

  const MOVEMENT_OPTIONS = [
    { value: 'receipt',    label: 'Прийом товару',     sign: '+', tone: 'emerald' },
    { value: 'return',     label: 'Повернення',         sign: '+', tone: 'blue'    },
    { value: 'adjustment', label: 'Коригування',        sign: '±', tone: 'amber'   },
    { value: 'write_off',  label: 'Списання',           sign: '-', tone: 'rose'    },
  ];

  const selectedOption = MOVEMENT_OPTIONS.find(o => o.value === mode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedDelta = parseInt(delta, 10);
    if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
      setError('Вкажіть кількість (ненульове ціле число)');
      return;
    }

    const finalDelta = mode === 'write_off' ? -Math.abs(parsedDelta) : parsedDelta;

    setError('');
    try {
      await adjust.mutateAsync({ inventoryId: item.id, delta: finalDelta, movementType: mode, note: note.trim() || null });
      setDelta('');
      setNote('');
      onSuccess?.();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail?.message || detail || 'Не вдалося зберегти зміну');
    }
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/60 ${compact ? '' : 'space-y-4'}`}>
      {!compact && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Коригування запасу</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
            {item.product_name}
            <span className="ml-2 text-sm font-normal text-slate-400">SKU: {item.product_sku}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Поточний залишок: <span className="font-bold text-slate-900 dark:text-white">{item.quantity}</span> од.
          </p>
        </div>
      )}

      <div className={`grid gap-2 ${compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {MOVEMENT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMode(opt.value)}
            className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition text-center ${
              mode === opt.value
                ? opt.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300'
                : opt.tone === 'blue'    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-300'
                : opt.tone === 'amber'   ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300'
                :                         'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300'
            }`}
          >
            <span className="block text-base">{opt.sign}</span>
            {opt.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className={compact ? 'flex items-start gap-2 mt-2' : 'space-y-3'}>
        <div className={compact ? 'w-28' : ''}>
          {!compact && (
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Кількість {selectedOption?.sign !== '±' ? `(${selectedOption?.sign})` : '(+ або -)'}
              <span className="text-rose-500 ml-1">*</span>
            </label>
          )}
          <input
            type="number"
            value={delta}
            onChange={(e) => { setDelta(e.target.value); setError(''); }}
            placeholder={mode === 'adjustment' ? '±10' : '10'}
            min={mode === 'write_off' ? 1 : mode === 'adjustment' ? undefined : 1}
            className={`form-input text-sm ${error ? 'form-input-error' : ''} ${compact ? 'w-full' : ''}`}
            required
          />
        </div>

        {!compact && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Коментар / підстава</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Наприклад: Накладна №1234, повернення від клієнта..." maxLength={500} className="form-input text-sm" />
          </div>
        )}

        {error && (
          <p className={`text-xs text-rose-600 dark:text-rose-300 ${compact ? 'mt-1' : ''}`}>{error}</p>
        )}

        {delta && Number.isFinite(parseInt(delta, 10)) && parseInt(delta, 10) !== 0 && !compact && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-white/5">
            <span className="text-slate-500 dark:text-slate-400">Після збереження: </span>
            <span className={`font-bold ${(item.quantity + (mode === 'write_off' ? -Math.abs(parseInt(delta,10)) : parseInt(delta,10))) < (item.min_quantity || 0) ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
              {item.quantity + (mode === 'write_off' ? -Math.abs(parseInt(delta,10)) : parseInt(delta,10))} од.
            </span>
            {(item.quantity + (mode === 'write_off' ? -Math.abs(parseInt(delta,10)) : parseInt(delta,10))) < (item.min_quantity || 0) && (
              <span className="ml-2 text-rose-500 dark:text-rose-300">⚠ нижче мінімального порогу</span>
            )}
          </div>
        )}

        <div className={`flex gap-2 ${compact ? '' : 'pt-1'}`}>
          <button type="submit" disabled={adjust.isPending} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950">
            {adjust.isPending ? 'Збереження...' : 'Зберегти'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">Скасувати</button>
          )}
        </div>
      </form>
    </div>
  );
}


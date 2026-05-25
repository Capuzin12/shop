import { formatPrice } from '../../../shared/utils/format';

const ORDER_STATUS_LABELS = {
  new: 'Нове',
  processing: 'В обробці',
  shipped: 'Відправлено',
  delivered: 'Доставлено',
  picked_up: 'Забрано',
  cancelled: 'Скасовано',
  refunded: 'Повернено',
};

export { ORDER_STATUS_LABELS };

export default function OrderCard({
  order,
  openedOrderId,
  onCancel,
  onToggleChat,
  cancelling,
  canCancelOrder,
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Замовлення</p>
          <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">#{order.id}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {ORDER_STATUS_LABELS[order.status] || order.status}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span>{order.created_at ? new Date(order.created_at).toLocaleDateString('uk-UA') : '-'}</span>
        <span className="font-semibold text-slate-900 dark:text-white">{formatPrice(order.total)}</span>
      </div>

      <div className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-white/5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Склад замовлення</p>
        {(order.items || []).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Позиції замовлення недоступні.</p>
        ) : (
          <div className="space-y-2">
            {(order.items || []).map((item) => (
              <div key={`${order.id}-${item.id || item.product_id}-${item.product_name}`} className="flex items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="truncate">{item.product_name} x {item.quantity}</span>
                <span className="shrink-0 font-semibold text-slate-900 dark:text-white">{formatPrice((item.unit_price || 0) * (item.quantity || 0))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onToggleChat(order.id)}
          className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
        >
          {openedOrderId === order.id ? 'Закрити чат' : 'Відкрити чат'}
        </button>
        {canCancelOrder(order.status) ? (
          <button
            type="button"
            onClick={() => onCancel(order.id)}
            disabled={cancelling}
            className="rounded-2xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            {cancelling ? 'Скасування...' : 'Скасувати замовлення'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

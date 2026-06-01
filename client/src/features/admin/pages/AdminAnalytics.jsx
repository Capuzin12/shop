import React, { useMemo, useState } from 'react';
import { useAnalyticsOverview, useRevenueChart, useTopProducts, useInventoryHealth, useCustomerAnalytics, useInventoryMovementsAnalytics } from '../hooks/useAnalytics';
import { StatCard, LoadingState, EmptyState, DataTable, Panel } from '../components/BackofficeUI';

const moneyFormatter = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('uk-UA', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function MiniLineChart({ data = [] }) {
  const width = 900;
  const height = 320;
  const padding = 24;

  if (!data.length) {
    return <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">Немає даних за обраний період</div>;
  }

  const values = data.map((d) => Number(d.revenue || 0));
  const max = Math.max(...values, 1);
  const stepX = (width - padding * 2) / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => {
    const x = padding + stepX * i;
    const y = height - padding - ((Number(d.revenue || 0) / max) * (height - padding * 2));
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] w-full bg-white dark:bg-slate-950/40">
        {[0, 1, 2, 3, 4].map((idx) => {
          const y = padding + ((height - padding * 2) / 4) * idx;
          return <line key={idx} x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />;
        })}
        <polyline fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points} />
        {data.map((d, i) => {
          const x = padding + stepX * i;
          const y = height - padding - ((Number(d.revenue || 0) / max) * (height - padding * 2));
          return (
            <g key={`${d.date}-${i}`}>
              <circle cx={x} cy={y} r="4" fill="#f59e0b" />
              {i % Math.ceil(data.length / 8 || 1) === 0 ? (
                <text x={x} y={height - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">{String(d.date).slice(5)}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MiniBarChart({ data = [] }) {
  const width = 900;
  const height = 260;
  const padding = 28;

  if (!data.length) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">Немає даних за обраний період</div>;
  }

  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  const barHeight = (height - padding * 2) / data.length - 10;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full bg-white dark:bg-slate-950/40">
        {data.map((item, i) => {
          const y = padding + i * ((height - padding * 2) / data.length);
          const barWidth = ((Number(item.value || 0) / max) * (width - padding * 2));
          return (
            <g key={item.label}>
              <text x={padding} y={y + 14} fill="#64748b" fontSize="11">{item.label}</text>
              <rect x={padding + 120} y={y} width={Math.max(barWidth - 120, 0)} height={Math.max(barHeight, 16)} rx="8" fill={item.color || '#f59e0b'} />
              <text x={padding + 130 + Math.max(barWidth - 120, 0)} y={y + 14} fill="#0f172a" fontSize="11" fontWeight="700">
                {numberFormatter.format(Number(item.value || 0))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ inStock = 0, lowStock = 0, outOfStock = 0 }) {
  const total = Math.max(inStock + lowStock + outOfStock, 1);
  const size = 240;
  const stroke = 24;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const segments = [
    { value: inStock, color: '#4ade80' },
    { value: lowStock, color: '#f59e0b' },
    { value: outOfStock, color: '#ef4444' },
  ];
  let offset = 0;

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((seg, idx) => {
            const dash = (seg.value / total) * c;
            const circle = (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += dash;
            return circle;
          })}
        </g>
        <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 - 2} fill="white" opacity="0.92" />
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="700">{total}</text>
        <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="#94a3b8" fontSize="11">SKU</text>
      </svg>
    </div>
  );
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('30d');
  const overviewQ = useAnalyticsOverview();
  const revenueQ = useRevenueChart(period);
  const topProductsQ = useTopProducts(10, period);
  const inventoryQ = useInventoryHealth();
  const customersQ = useCustomerAnalytics(period);
  const inventoryMovementsQ = useInventoryMovementsAnalytics(period, 12);

  const revenueData = useMemo(
    () => (revenueQ.data?.labels || []).map((label, i) => ({
      date: label,
      revenue: revenueQ.data?.revenue?.[i] || 0,
      orders: revenueQ.data?.orders_count?.[i] || 0,
    })),
    [revenueQ.data],
  );
  const movementTypeData = useMemo(() => {
    const typeLabels = {
      receipt: { label: 'Прийом', color: '#4ade80' },
      sale: { label: 'Продаж', color: '#ef4444' },
      return: { label: 'Повернення', color: '#3b82f6' },
      adjustment: { label: 'Коригування', color: '#f59e0b' },
      write_off: { label: 'Списання', color: '#f43f5e' },
    };
    return Object.entries(inventoryMovementsQ.data?.by_type || {}).map(([type, item]) => ({
      label: typeLabels[type]?.label || type,
      value: item.total_movements || 0,
      color: typeLabels[type]?.color || '#94a3b8',
    }));
  }, [inventoryMovementsQ.data]);

  if (overviewQ.isLoading || revenueQ.isLoading) return <LoadingState />;
  if (overviewQ.isError) return <EmptyState title="Помилка завантаження аналітики" />;

  const overview = overviewQ.data || {};
  const comparison = overview.comparison || {};
  const revenueTotal = Number(overview.revenue?.total || 0);
  const revenueThisMonth = Number(overview.revenue?.this_month || 0);
  const ordersTotal = Number(overview.orders?.total || 0);
  const ordersThisMonth = Number(overview.orders?.this_month || 0);
  const newUsersThisMonth = Number(overview.users?.new_this_month || 0);
  const growthPercent = Number(overview.users?.growth_percent || 0);
  const lowStockCount = Number(overview.products?.low_stock_count || 0);
  const movementSummary = inventoryMovementsQ.data || {};
  const comparisonCurrent = comparison.current_month || {};
  const comparisonPrevious = comparison.previous_month || {};

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Загальний виторг" value={moneyFormatter.format(revenueTotal)} tone="amber" hint={`За місяць: ${moneyFormatter.format(revenueThisMonth)}`} />
        <StatCard label="Всього замовлень" value={numberFormatter.format(ordersTotal)} tone="blue" hint={`За місяць: ${numberFormatter.format(ordersThisMonth)}`} />
        <StatCard label="Нові користувачі" value={numberFormatter.format(newUsersThisMonth)} tone="emerald" hint={`Зростання: ${percentFormatter.format(growthPercent)}%`} />
        <StatCard label="Товарів з низьким запасом" value={numberFormatter.format(lowStockCount)} tone="rose" hint={lowStockCount > 0 ? 'Потрібна увага' : 'Критичних позицій немає'} />
      </div>

      <Panel title="Порівняння місяців" subtitle="Цей місяць проти попереднього">
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/60">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Метрика</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">{comparisonCurrent.label || 'Поточний'}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">{comparisonPrevious.label || 'Попередній'}</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Зміна</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white/50 dark:bg-transparent">
              {[
                ['Виторг', moneyFormatter.format(comparisonCurrent.revenue || 0), moneyFormatter.format(comparisonPrevious.revenue || 0), `${Number(comparisonCurrent.revenue || 0) - Number(comparisonPrevious.revenue || 0) >= 0 ? '+' : ''}${percentFormatter.format(comparisonPrevious.revenue ? ((comparisonCurrent.revenue - comparisonPrevious.revenue) / comparisonPrevious.revenue) * 100 : 0)}%`],
                ['Замовлення', numberFormatter.format(comparisonCurrent.orders || 0), numberFormatter.format(comparisonPrevious.orders || 0), `${Number(comparisonCurrent.orders || 0) - Number(comparisonPrevious.orders || 0) >= 0 ? '+' : ''}${percentFormatter.format(comparisonPrevious.orders ? ((comparisonCurrent.orders - comparisonPrevious.orders) / comparisonPrevious.orders) * 100 : 0)}%`],
                ['Виконані', numberFormatter.format(comparisonCurrent.fulfilled_orders || 0), numberFormatter.format(comparisonPrevious.fulfilled_orders || 0), `${Number(comparisonCurrent.fulfilled_orders || 0) - Number(comparisonPrevious.fulfilled_orders || 0) >= 0 ? '+' : ''}${percentFormatter.format(comparisonPrevious.fulfilled_orders ? ((comparisonCurrent.fulfilled_orders - comparisonPrevious.fulfilled_orders) / comparisonPrevious.fulfilled_orders) * 100 : 0)}%`],
                ['Середній чек', moneyFormatter.format(comparisonCurrent.avg_order_value || 0), moneyFormatter.format(comparisonPrevious.avg_order_value || 0), `${Number(comparisonCurrent.avg_order_value || 0) - Number(comparisonPrevious.avg_order_value || 0) >= 0 ? '+' : ''}${percentFormatter.format(comparisonPrevious.avg_order_value ? ((comparisonCurrent.avg_order_value - comparisonPrevious.avg_order_value) / comparisonPrevious.avg_order_value) * 100 : 0)}%`],
                ['Конверсія', `${percentFormatter.format(comparisonCurrent.conversion_rate || 0)}%`, `${percentFormatter.format(comparisonPrevious.conversion_rate || 0)}%`, `${Number(comparisonCurrent.conversion_rate || 0) - Number(comparisonPrevious.conversion_rate || 0) >= 0 ? '+' : ''}${percentFormatter.format(comparisonPrevious.conversion_rate ? ((comparisonCurrent.conversion_rate - comparisonPrevious.conversion_rate) / comparisonPrevious.conversion_rate) * 100 : 0)}%`],
                ['Нові користувачі', numberFormatter.format(comparisonCurrent.new_users || 0), numberFormatter.format(comparisonPrevious.new_users || 0), `${Number(comparisonCurrent.new_users || 0) - Number(comparisonPrevious.new_users || 0) >= 0 ? '+' : ''}${percentFormatter.format(comparisonPrevious.new_users ? ((comparisonCurrent.new_users - comparisonPrevious.new_users) / comparisonPrevious.new_users) * 100 : 0)}%`],
              ].map(([label, current, previous, delta]) => (
                <tr key={label} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{label}</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{current}</td>
                  <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{previous}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

       <Panel title="Динаміка виторгу" subtitle="Графік за обраний період">
         <div className="flex items-center justify-between mb-2">
           <h3 className="text-lg font-medium">Динаміка виторгу</h3>
           <div className="flex gap-2">
             {['7d','30d','90d','365d'].map(p => (
               <button key={p} className={`px-3 py-1 rounded font-medium transition ${period===p ? 'bg-blue-500 text-white': 'bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600'}`} onClick={()=>setPeriod(p)}>{p}</button>
             ))}
           </div>
         </div>
         <MiniLineChart data={revenueData} />
       </Panel>

      <Panel title="Рух складу" subtitle="Усі зміни залишків: прийом, продажі, повернення та ручні коригування">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <StatCard label="Усього рухів" value={numberFormatter.format(movementSummary.total_movements || 0)} tone="blue" />
          <StatCard label="Надходження" value={numberFormatter.format(movementSummary.incoming_quantity || 0)} tone="emerald" />
          <StatCard label="Списано / видано" value={numberFormatter.format(movementSummary.outgoing_quantity || 0)} tone="rose" />
          <StatCard label="Чистий рух" value={numberFormatter.format(movementSummary.net_change || 0)} tone="amber" />
        </div>
        <MiniBarChart data={movementTypeData} />

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
          {inventoryMovementsQ.isLoading ? (
            <LoadingState />
          ) : (movementSummary.items || []).length ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Дата</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Товар</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Джерело</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Тип</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Зміна</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Стало</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white/50 dark:bg-transparent">
                {movementSummary.items.map((movement) => {
                  const typeLabels = {
                    receipt: 'Прийом',
                    sale: 'Продаж',
                    return: 'Повернення',
                    adjustment: 'Коригування',
                    write_off: 'Списання',
                  };
                  const isPositive = movement.quantity > 0;
                  return (
                    <tr key={movement.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {movement.created_at ? new Date(movement.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{movement.product_name}</div>
                        <div className="text-xs text-slate-400">{movement.product_sku}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{movement.source || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{typeLabels[movement.type] || movement.type}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                        {isPositive ? '+' : ''}{numberFormatter.format(movement.quantity || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {numberFormatter.format(movement.quantity_after || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">За обраний період рухів ще немає.</div>
          )}
        </div>
      </Panel>

      <Panel title="Топ-товари" subtitle="За виторгом">
        <h3 className="text-lg font-medium mb-2">Топ-товари</h3>
        <DataTable columns={['Товар','SKU','Продано (шт)','Виторг','Замовлень']} >
          {(topProductsQ.data?.items || []).map(item => (
            <tr key={item.product_id}>
              <td className="px-4 py-3">{item.product_name}</td>
              <td className="px-4 py-3">{item.sku}</td>
              <td className="px-4 py-3">{item.total_sold_qty}</td>
              <td className="px-4 py-3">{item.total_revenue}</td>
              <td className="px-4 py-3">{item.orders_count}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Стан складу" subtitle="Кругова діаграма без сторонніх runtime-залежностей">
          <h3 className="text-lg">Стан складу</h3>
          <DonutChart inStock={inventoryQ.data?.in_stock || 0} lowStock={inventoryQ.data?.low_stock || 0} outOfStock={inventoryQ.data?.out_of_stock || 0} />
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">В наявності: {inventoryQ.data?.in_stock || 0}</div>
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Низький запас: {inventoryQ.data?.low_stock || 0}</div>
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">Немає: {inventoryQ.data?.out_of_stock || 0}</div>
          </div>
         </Panel>
         <Panel title="Критичні залишки" subtitle="Позиції, які потребують уваги">
           <h3 className="text-lg font-medium mb-4">Критичні залишки</h3>
           <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
             <table className="w-full text-sm">
               <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/10">
                 <tr>
                   <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Товар</th>
                   <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">SKU</th>
                   <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Кількість</th>
                   <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Поріг</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white/50 dark:bg-transparent">
                 {(inventoryQ.data?.critical_items || []).map(i => (
                   <tr key={i.product_id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                     <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{i.name}</td>
                     <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{i.sku}</td>
                     <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100 font-medium">{i.quantity}</td>
                     <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400 font-medium">{i.threshold}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </Panel>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Проблемні товари" subtitle="Часто опиняються в низькому запасі">
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Товар</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Спрацювань</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Найнижче</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white/50 dark:bg-transparent">
                {(inventoryQ.data?.problematic_items || []).map((item) => (
                  <tr key={item.product_id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{item.name}</div>
                      <div className="text-xs text-slate-400">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-300">{item.low_stock_hits}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{item.lowest_quantity_after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Аномалії складу" subtitle="Коригування, списання та великі стрибки">
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Товар</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Аномалій</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Списань</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white/50 dark:bg-transparent">
                {(inventoryQ.data?.anomaly_items || []).map((item) => (
                  <tr key={item.product_id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{item.name}</div>
                      <div className="text-xs text-slate-400">{item.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-300">{item.anomaly_count}</td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{item.write_off_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

       <Panel title="Клієнти" subtitle="Покупці та повторні покупки">
         <h3 className="text-lg font-medium mb-4">Клієнти</h3>
         <div className="grid grid-cols-4 gap-4 mb-6">
           <StatCard label="Клієнтів всього" value={customersQ.data?.total || 0} />
           <StatCard label="Нові за період" value={customersQ.data?.new_this_period || 0} />
           <StatCard label="Повторних (%)" value={(customersQ.data?.returning_rate_percent || 0).toFixed(1)} />
           <StatCard label="Середньо замовлень" value={(customersQ.data?.avg_orders_per_customer || 0).toFixed(1)} />
         </div>
         <DataTable columns={["Імʼя", "Замовлень", "Витрачено"]}>
           {(customersQ.data?.top_customers || []).map(c => (
             <tr key={c.user_id}>
               <td className="px-4 py-3">{c.name}</td>
               <td className="px-4 py-3">{c.orders_count}</td>
               <td className="px-4 py-3">{c.total_spent.toFixed(2)} ₴</td>
             </tr>
           ))}
         </DataTable>
       </Panel>
    </div>
  );
}



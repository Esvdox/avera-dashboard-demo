'use strict';

tabs.splice(1, 0, ['comparison', 'Сравнение', 'Сравнение', '']);
window.avNavIcons.comparison = 'trend';

let comparisonView = 'table';

function comparisonData() {
  const metrics = window.AVERA_METRICS;
  const baseline = window.AVERA_SKU_BASELINE;
  const revenue = [2, 3].map((column, index) => {
    const value = metrics.value(window.AVERA_ACCOUNTING.incomeNine, '2110', column);
    return {date: `${2025 + index}-09-30`, value: Number.isFinite(value) ? value / 1000 : null};
  });
  const turnover = window.AVERA_HR_TURNOVER.rows.slice(0, 2).map(row => ({
    date: row[0].slice(0, 4) + '-12-31', value: row[1]
  }));
  const start = baseline.asOf.split('.').reverse().join('-');
  return [
    {name: 'Выручка', unit: 'млн ₽', before: revenue[1].value, period: '9 мес. 2026', points: revenue},
    {name: 'Текучесть', unit: '%', before: turnover[1]?.value, period: '2025', points: turnover},
    {name: 'Аттракционы', unit: 'SKU', before: baseline.items.length, period: baseline.asOf, points: [{date: start, value: baseline.items.length}]},
    {name: 'Прочие продукты', unit: 'SKU', points: []},
    {name: 'Сделки', unit: 'шт.', points: []},
    {name: 'Маржа сделок', unit: '%', points: []}
  ];
}

function comparisonGraph(metric, todayDate) {
  const points = metric.points.filter(point => Number.isFinite(point.value));
  const start = Date.parse('2024-01-01');
  const arrival = Date.parse('2026-11-01');
  const today = Date.parse(todayDate);
  const end = Math.max(today, arrival);
  const x = date => 10 + (date - start) / (end - start) * 300;
  const maximum = Math.max(1, ...points.map(point => point.value));
  const y = value => 87 - value / maximum * 59;
  const locations = points.map(point => [x(Date.parse(point.date)), y(point.value)]);
  const labels = points.map((point, index) => {
    const [px, py] = locations[index];
    return `<circle cx="${px}" cy="${py}" r="3.5" fill="var(--accent)"><title>${point.date} · ${fmt(point.value)}</title></circle>
      <text x="${px}" y="${py - 7}" text-anchor="middle" fill="var(--text)">${fmt(point.value)}</text>`;
  }).join('');
  const trace = locations.length > 1 ? `<polyline points="${locations.map(pair => pair.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="4 3"/>` : '';
  const accessibleData = points.map(point => point.date + ' — ' + fmt(point.value)).join('. ');
  return `<svg class="cmp-graph" viewBox="0 0 320 102" role="img" aria-label="${safe(metric.name + ', ' + metric.unit + '. ' + (accessibleData || 'НД'))}">
    <path d="M10 30H310 M10 58H310 M10 87H310" stroke="var(--line)" fill="none"/>
    <line x1="${x(arrival)}" x2="${x(arrival)}" y1="12" y2="87" stroke="var(--accent)" stroke-width="2"/>
    <line x1="${x(today)}" x2="${x(today)}" y1="12" y2="87" stroke="currentColor" stroke-dasharray="3 3"/>
    ${trace}${labels}${points.length ? '' : '<text x="160" y="55" text-anchor="middle" fill="currentColor">НД</text>'}
    <text x="10" y="100" fill="currentColor">2024</text>
    <text x="310" y="100" fill="currentColor" text-anchor="end">${todayDate.slice(0, 4)}</text>
  </svg>`;
}

function renderComparison() {
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const chart = comparisonView === 'chart';
  const switcher = `<div class="cmp-switch" role="group" aria-label="Вид сравнения">
    <button type="button" data-comparison-view="table" aria-pressed="${!chart}">Было / стало</button>
    <button type="button" data-comparison-view="chart" aria-pressed="${chart}">Графики</button></div>`;
  const legend = chart ? `<div class="cmp-legend"><span><i></i>Приход · 01.11.26</span><span><i></i>Сегодня · ${today.split('-').reverse().join('.')}</span></div>` : '';
  const cards = comparisonData().map(metric => `<section class="panel cmp-card"><h2>${metric.name}, <span>${metric.unit}</span></h2>
    ${chart ? comparisonGraph(metric, today) : `<dl class="cmp-values">
      <div><dt>Исходный</dt><dd>${Number.isFinite(metric.before) ? fmt(metric.before) : 'НД'}</dd>${metric.period ? `<dd class="cmp-period">${metric.period}</dd>` : ''}</div>
      <div><dt>Текущий</dt><dd>${Number.isFinite(metric.current) ? fmt(metric.current) : 'НД'}</dd></div>
    </dl>`}</section>`).join('');
  return switcher + legend + '<div class="cmp-list">' + cards + '</div>'
    + `<details class="panel cmp-details"><summary>Источники и методика</summary>
      <p>Выручка на графиках — январь–сентябрь, ОФР. Текучесть — годовые данные 1С. Срез SKU аттракционов — 02.11.2026. Шкала начинается с 2024 года, первого года доступной отчётности. НД — нет данных.</p>
      <p>Сделки считаются по дате подписания. Маржа — сумма маржи / сумма выручки без НДС. Плановая и фактическая маржа учитываются отдельно.</p></details>
      <details class="panel cmp-details"><summary>Решения и результат</summary>
      <p>Дата решения, ответственный, срок, показатель и подтверждённый эффект.</p>
      <p>Дополнительные показатели: допуск SKU к производству, заказы в срок, операционный денежный поток, сумма подписанных заказов.</p></details>`;
}

renderers.comparison = renderComparison;
$('#content').addEventListener('click', event => {
  const button = event.target.closest('[data-comparison-view]');
  if (current !== 'comparison' || !button) return;
  comparisonView = button.dataset.comparisonView;
  render();
  $(`[data-comparison-view="${comparisonView}"]`).focus();
});
const applyComparisonLabels = window.applyActualLabels;
window.applyActualLabels = function () {
  applyComparisonLabels();
  $('main').classList.toggle('cmp-page', current === 'comparison');
  if (current !== 'comparison') return;
  $('main > .notice').textContent = 'НД — нет данных';
  $('.asof').innerHTML = '<strong>01.11.2026</strong><span>Дата прихода</span>';
};
render();

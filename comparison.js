'use strict';

tabs.splice(1, 0, ['comparison', 'Сравнение', 'Сравнение', '']);
window.avNavIcons.comparison = 'trend';

let comparisonView = new URLSearchParams(location.search).get('view') === 'charts' ? 'chart' : 'table';
let comparisonChartView = 'periods';
const comparisonDates = {from: '2025-09-30', to: '2026-09-30'};

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

function periodGraph(metric, index) {
  const periods = [
    {letter: 'А', point: metric.points.at(-1), className: 'cmp-series-a', x: 320},
    {letter: 'Б', point: metric.points.length > 1 ? metric.points.at(-2) : null, className: 'cmp-series-b', x: 56}
  ].filter(series => Number.isFinite(series.point?.value));
  const maximum = Math.max(1, ...periods.map(series => series.point.value));
  const stepSize = 10 ** Math.floor(Math.log10(maximum / 3));
  const step = Math.ceil(maximum / (3 * stepSize)) * stepSize;
  const bottom = 176;
  const y = value => bottom - (value / (step * 4)) * 156;
  const grid = [0, 1, 2, 3, 4].map(tick => {
    const value = tick * step;
    return `<path d="M56 ${y(value)}H320"/><text x="49" y="${y(value) + 3}" text-anchor="end">${fmt(value)}</text>`;
  }).join('');
  const ordered = [...periods].reverse();
  const coordinates = ordered.map(series => [series.x, y(series.point.value)]);
  const comparisonLine = coordinates.map(pair => pair.join(',')).join(' ');
  const first = coordinates[0];
  const last = coordinates.at(-1);
  const fillId = `cmp-period-fill-${index}`;
  const trace = coordinates.length > 1
    ? `<defs><linearGradient id="${fillId}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${Math.min(first[1], last[1])}" y2="${bottom}">
         <stop offset="0" stop-color="var(--accent)" stop-opacity=".34"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
       </linearGradient></defs>
       <polygon class="cmp-period-fill" fill="url(#${fillId})" points="${first[0]},${bottom} ${comparisonLine} ${last[0]},${bottom}"/>
       <polyline class="cmp-period-trace" points="${comparisonLine}"/>`
    : '';
  const marks = periods.map(series => {
    const py = y(series.point.value);
    const x = series.x;
    return `<g class="${series.className}"><circle cx="${x}" cy="${py}" r="3"/><text x="${x}" y="${py - 9}" text-anchor="middle">${fmt(series.point.value)}</text>
      <text class="cmp-axis-date" x="${x}" y="194" text-anchor="middle">${series.point.date.slice(0, 4)}</text></g>`;
  }).join('');
  const label = date => {
    const year = date.slice(0, 4);
    if (index === 0) return 'янв.–сен. ' + year;
    if (index === 1) return year + ' год';
    return date.split('-').reverse().join('.');
  };
  const legend = ordered.map(series => `<li class="${series.className}"><i aria-hidden="true"></i>Период ${series.letter} · ${label(series.point.date)}</li>`).join('');
  const accessible = periods.map(series => `Период ${series.letter}, ${label(series.point.date)}, ${fmt(series.point.value)}`).join('. ');
  return periods.length
    ? `<svg class="cmp-period-graph" viewBox="0 0 346 202" role="img" aria-label="${safe(metric.name + ', ' + metric.unit + '. ' + accessible)}">
        <g class="cmp-plot-grid">${grid}</g><path class="cmp-plot-axis" d="M56 20V176H320"/>${trace}${marks}
      </svg><ul class="cmp-series-legend">${legend}</ul>`
    : '<div class="cmp-period-empty">НД</div>';
}

function comparisonTableData(metrics) {
  const accounting = window.AVERA_ACCOUNTING;
  const expenses = [2, 3].map(column => {
    const value = window.AVERA_METRICS.value(accounting.incomeNine, '2120', column);
    return Number.isFinite(value) ? Math.abs(value) / 1000 : null;
  });
  const rows = [
    ...metrics.map((metric, index) => ({
      ...metric,
      direction: index === 1 ? 'lower' : index === 0 || index >= 4 ? 'higher' : null,
      comparableSnapshots: index === 0 || index === 1,
      icon: ['wallet', 'people', 'products', 'products', 'sales', 'trend'][index],
      shortName: index === 3 ? 'Прочие SKU' : metric.name
    })),
    {name: 'Расходы', unit: 'млн ₽', direction: 'lower', icon: 'wallet', comparableSnapshots: true,
      points: expenses.map((value, index) => ({value, date: `${2025 + index}-09-30`}))}
  ];
  return rows.map(metric => {
    const {from, to} = comparisonDates;
    if (!from || !to || from >= to) return {...metric, before: null, current: null};
    const before = metric.points.find(point => point.date === from);
    const current = metric.points.find(point => point.date === to);
    return {...metric, before: before?.value, current: current?.value, comparable: Boolean(metric.comparableSnapshots && before && current)};
  });
}

function comparisonTiles(metric) {
  const comparable = metric.comparable && Number.isFinite(metric.before) && Number.isFinite(metric.current) && metric.before !== 0;
  const change = comparable ? (metric.current - metric.before) / Math.abs(metric.before) * 100 : null;
  const favorable = metric.direction === 'lower' ? change < 0 : change > 0;
  const tone = change === 0 || !metric.direction ? 'neutral' : favorable ? 'good' : 'bad';
  const trend = change === null ? '' : change === 0
    ? '<span class="cmp-trend cmp-trend-neutral" title="Без изменений" aria-label="Без изменений">—</span>'
    : `<span class="cmp-trend cmp-trend-${tone}" aria-label="${tone === 'good' ? 'Улучшение' : tone === 'bad' ? 'Ухудшение' : 'Изменение'}, ${fmt(change)}%"><span aria-hidden="true">${change > 0 ? '↗' : '↘'}</span> ${change > 0 ? '+' : ''}${fmt(change)}%</span>`;
  const tile = (label, value, note) => `<div class="panel cmp-tile" role="group" aria-label="${label} · ${safe(metric.name)}"><dt title="${safe(metric.name)}">${window.avIcon(metric.icon)}<span>${safe(metric.shortName || metric.name)}</span></dt>
    <dd>${Number.isFinite(value) ? `${fmt(value)} <span class="cmp-unit">${safe(metric.unit)}</span>` : 'НД'}</dd>
    <dd class="cmp-period">${note}</dd></div>`;
  return `<dl class="cmp-values">
    ${tile('База', metric.before, '')}
    ${tile('Сейчас', metric.current, trend)}
  </dl>`;
}

function renderComparison() {
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const chart = comparisonView === 'chart';
  const switcher = `<div class="cmp-switch" role="group" aria-label="Вид сравнения">
    <button type="button" data-comparison-view="table" aria-pressed="${!chart}">Было / стало</button>
    <button type="button" data-comparison-view="chart" aria-pressed="${chart}">Графики</button></div>`;
  const periodView = chart && comparisonChartView === 'periods';
  const chartSwitcher = chart ? `<div class="cmp-switch cmp-chart-switch" role="group" aria-label="Вид графиков">
    <button type="button" data-chart-view="periods" aria-pressed="${periodView}">Периоды</button>
    <button type="button" data-chart-view="timeline" aria-pressed="${!periodView}">Хронология</button></div>` : '';
  const legend = chart && !periodView ? `<div class="cmp-legend"><span><i></i>Приход · 01.11.26</span><span><i></i>Сегодня · ${today.split('-').reverse().join('.')}</span></div>` : '';
  const metrics = comparisonData();
  const cards = (chart ? metrics : comparisonTableData(metrics)).map((metric, index) => `<section class="${chart ? 'panel cmp-card' : 'cmp-pair'}${periodView ? ' cmp-period-card' : ''}" aria-label="${safe(metric.name)}">${chart ? `<h2>${metric.name}, <span>${metric.unit}</span></h2>` : ''}
    ${chart ? (periodView ? periodGraph(metric, index) : comparisonGraph(metric, today)) : comparisonTiles(metric)}</section>`).join('');
  const datesValid = comparisonDates.from && comparisonDates.to && comparisonDates.from < comparisonDates.to;
  const dates = `<div class="cmp-dates">
    <label for="cmp-date-from">От<input id="cmp-date-from" type="date" value="${safe(comparisonDates.from)}"></label>
    <label for="cmp-date-to">До<input id="cmp-date-to" type="date" value="${safe(comparisonDates.to)}"></label>
  </div>`;
  const periodNote = !datesValid
    ? 'Укажите две даты. Дата «До» должна быть позже даты «От».'
    : 'НД — нет среза на выбранную дату.';
  const context = chart ? legend : `${dates}<div class="cmp-context" role="status"><span>${periodNote}</span></div>`;
  return '<section class="panel cmp-controls" aria-label="Настройки сравнения">' + switcher + context + '</section>'
    + (chart ? '<h2 class="cmp-section-title">Динамика и сравнение показателей</h2>' + chartSwitcher : '')
    + (chart ? '' : '<div class="cmp-column-head"><span>База</span><span>Сейчас</span></div>')
    + '<div class="cmp-list">' + cards + '</div>'
    + `<details class="panel cmp-details"><summary>Источники и методика</summary>
      <p>Выручка на графиках — январь–сентябрь, ОФР. Текучесть — годовые данные 1С. Срез SKU аттракционов — 02.11.2026. Шкала начинается с 2024 года, первого года доступной отчётности. НД — нет данных.</p>
      <p>Сделки считаются по дате подписания. Маржа — сумма маржи / сумма выручки без НДС. Плановая и фактическая маржа учитываются отдельно.</p></details>
      <details class="panel cmp-details"><summary>Решения и результат</summary>
      <p>Дата решения, ответственный, срок, показатель и подтверждённый эффект.</p>
      <p>Дополнительные показатели: допуск SKU к производству, заказы в срок, операционный денежный поток, сумма подписанных заказов.</p></details>`;
}

renderers.comparison = renderComparison;
$('#content').addEventListener('change', event => {
  if (current !== 'comparison') return;
  const {id, value} = event.target;
  if (id === 'cmp-date-from') comparisonDates.from = value;
  else if (id === 'cmp-date-to') comparisonDates.to = value;
  else return;
  render();
  $(`#${id}`).focus();
});
$('#content').addEventListener('click', event => {
  const button = event.target.closest('[data-comparison-view], [data-chart-view]');
  if (current !== 'comparison' || !button) return;
  const {comparisonView: view, chartView} = button.dataset;
  if (view) comparisonView = view;
  if (chartView) comparisonChartView = chartView;
  render();
  $(view ? `[data-comparison-view="${view}"]` : `[data-chart-view="${chartView}"]`).focus();
});
const applyComparisonLabels = window.applyActualLabels;
window.applyActualLabels = function () {
  applyComparisonLabels();
  $('main').classList.toggle('cmp-page', current === 'comparison');
  if (current !== 'comparison') return;
  $('.asof').innerHTML = '<strong>01.11.2026</strong><span>Дата прихода</span>';
};
render();

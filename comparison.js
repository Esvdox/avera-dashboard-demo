'use strict';

tabs.splice(1, 0, ['comparison', 'Сравнение', 'Сравнение', '']);
window.avNavIcons.comparison = 'trend';

let comparisonView = new URLSearchParams(location.search).get('view') === 'charts' ? 'chart' : 'table';
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
    {name: 'Аттракционы', unit: 'SKU', startBaseline: baseline.items.length, points: [{date: start, value: baseline.items.length}]},
    {name: 'Прочие продукты', unit: 'SKU', points: [{date: '2026-11-01', value: 0, label: 'Старт'}]},
    {name: 'Сделки', unit: 'шт.', points: []},
    {name: 'Маржа сделок', unit: '%', points: []}
  ];
}

const comparisonDay = 86400000;

function comparisonAxis(width, from, to) {
  const selectedStart = Date.parse(from);
  const selectedEnd = Date.parse(to);
  const duration = selectedEnd - selectedStart;
  const paddingRatio = duration <= 90 * comparisonDay ? .25 : .08;
  const padding = Math.max(comparisonDay, Math.round(duration / comparisonDay * paddingRatio) * comparisonDay);
  const start = selectedStart - padding;
  const end = selectedEnd + padding;
  const left = 56;
  const right = width - 26;
  const x = date => left + (date - start) / (end - start) * (right - left);
  const maxTicks = Math.max(3, Math.floor((right - left) / 72));
  const days = (end - start) / comparisonDay;
  const unit = days <= 45 ? 'day' : days <= 730 ? 'month' : 'year';
  const step = Math.max(1, Math.ceil(days / (maxTicks * {day: 1, month: 30, year: 365}[unit])));
  const cursor = new Date(start);
  if (unit !== 'day') cursor.setUTCDate(1);
  if (unit === 'year') cursor.setUTCMonth(0);
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC', ...(unit === 'day' ? {day: '2-digit', month: '2-digit'} : unit === 'month' ? {month: 'short', year: '2-digit'} : {year: 'numeric'})
  });
  const ticks = [];
  while (+cursor <= end) {
    if (+cursor >= start) ticks.push({x: x(+cursor), label: formatter.format(cursor)});
    if (unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + step);
    else if (unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + step);
    else cursor.setUTCFullYear(cursor.getUTCFullYear() + step);
  }
  return {left, right, x, start, end, selectedStart, selectedEnd, ticks};
}

function periodGraph(metric, index, axis, width) {
  const {left, right, x: dateX, start, end, selectedStart, selectedEnd, ticks} = axis;
  const observations = metric.points.filter(point => Number.isFinite(point.value) && Date.parse(point.date) >= start && Date.parse(point.date) <= end);
  const selected = observations.filter(point => Date.parse(point.date) >= selectedStart && Date.parse(point.date) <= selectedEnd)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const periods = selected.map((point, i) => ({point, x: dateX(Date.parse(point.date)),
    className: i === 0 && selected.length > 1 ? 'cmp-series-b' : 'cmp-series-a'}));
  const maximum = Math.max(1, metric.startBaseline ?? 0, ...observations.map(point => point.value));
  const stepSize = 10 ** Math.floor(Math.log10(maximum / 3));
  const step = Math.ceil(maximum / (3 * stepSize)) * stepSize;
  const bottom = 176;
  const y = value => bottom - (value / (step * 4)) * 156;
  const grid = [0, 1, 2, 3, 4].map(tick => {
    const value = tick * step;
    return `<path d="M${left} ${y(value)}H${right}"/><text x="${left - 7}" y="${y(value) + 3}" text-anchor="end">${fmt(value)}</text>`;
  }).join('');
  const ordered = periods;
  const coordinates = ordered.map(series => [series.x, y(series.point.value)]);
  const comparisonLine = coordinates.map(pair => pair.join(',')).join(' ');
  const first = coordinates[0];
  const last = coordinates.at(-1);
  const fillId = `cmp-period-fill-${index}`;
  const trace = coordinates.length > 1
    ? `<defs><linearGradient id="${fillId}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${Math.min(...coordinates.map(pair => pair[1]))}" y2="${bottom}">
         <stop offset="0" stop-color="var(--accent)" stop-opacity=".34"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
       </linearGradient></defs>
       <polygon class="cmp-period-fill" fill="url(#${fillId})" points="${first[0]},${bottom} ${comparisonLine} ${last[0]},${bottom}"/>
       <polyline class="cmp-period-trace" points="${comparisonLine}"/>`
    : '';
  const marks = periods.map(series => {
    const py = y(series.point.value);
    const x = series.x;
    const alignLeft = x < (left + right) / 2;
    const labelX = x + (alignLeft ? 7 : -7);
    return `<g class="${series.className}"><circle cx="${x}" cy="${py}" r="3"/><text class="cmp-point-label" x="${labelX}" y="${py - 9}" text-anchor="${alignLeft ? 'start' : 'end'}">${fmt(series.point.value)}</text></g>`;
  }).join('');
  const label = date => {
    const year = date.slice(0, 4);
    if (index === 0) return 'янв.–сен. ' + year;
    if (index === 1) return year + ' год';
    return date.split('-').reverse().join('.');
  };
  const startLegend = Number.isFinite(metric.startBaseline)
    ? `<li class="cmp-series-b"><i aria-hidden="true"></i>Старт · ${fmt(metric.startBaseline)} SKU</li>`
    : '';
  const baseline = startLegend
    ? `<path class="cmp-start-baseline" d="M${left} ${y(metric.startBaseline)}H${right}"/>`
    : '';
  const seriesLabel = series => series.point.label || 'Срез';
  const legend = startLegend + (ordered.length > 1
    ? `<li class="cmp-series-a cmp-series-range"><i aria-hidden="true"></i>Период · ${label(ordered[0].point.date)} → ${label(ordered.at(-1).point.date)}</li>`
    : ordered.map(series => `<li class="${series.className}"><i aria-hidden="true"></i>${seriesLabel(series)} · ${label(series.point.date)}</li>`).join(''));
  const accessible = periods.map(series => `${seriesLabel(series)}, ${label(series.point.date)}, ${fmt(series.point.value)}`).join('. ');
  const contextPoints = observations.filter(point => !selected.includes(point)).map(point =>
    `<circle class="cmp-context-point" cx="${dateX(Date.parse(point.date))}" cy="${y(point.value)}" r="3"><title>${safe(point.date)} · ${fmt(point.value)}</title></circle>`).join('');
  const tickLabels = ticks.map(tick =>
    `<text class="cmp-axis-date" x="${tick.x}" y="194" text-anchor="middle">${safe(tick.label)}</text>`).join('');
  const rangeX = dateX(selectedStart);
  const rangeWidth = dateX(selectedEnd) - rangeX;
  return `<svg class="cmp-period-graph" viewBox="0 0 ${width} 202" role="img" aria-label="${safe(metric.name + ', ' + metric.unit + '. ' + (accessible || 'НД в выбранном диапазоне'))}">
      <rect class="cmp-selected-range" x="${rangeX}" y="20" width="${rangeWidth}" height="156"/>
      <g class="cmp-plot-grid">${grid}</g><path class="cmp-plot-axis" d="M${left} 20V176H${right}"/>
      ${baseline}${trace}${contextPoints}${marks}${tickLabels}
      ${periods.length ? '' : `<text class="cmp-axis-date" x="${rangeX + rangeWidth / 2}" y="94" text-anchor="middle">НД в выбранном диапазоне</text>`}
    </svg>${legend ? `<ul class="cmp-series-legend">${legend}</ul>` : ''}`;
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
      comparableSnapshots: index <= 3,
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
  const chart = comparisonView === 'chart';
  const switcher = `<div class="cmp-switch" role="group" aria-label="Вид сравнения">
    <button type="button" data-comparison-view="table" aria-pressed="${!chart}">Было / стало</button>
    <button type="button" data-comparison-view="chart" aria-pressed="${chart}">Графики</button></div>`;
  const metrics = comparisonData();
  const {from, to} = comparisonDates;
  const datesValid = from && to && from < to;
  const plotWidth = Math.max(240, $('#content').clientWidth - 30);
  const axis = chart && datesValid ? comparisonAxis(plotWidth, from, to) : null;
  const visibleMetrics = chart ? metrics : comparisonTableData(metrics);
  const cards = visibleMetrics.map((metric, index) => `<section class="${chart ? 'panel cmp-card cmp-period-card' : 'cmp-pair'}" aria-label="${safe(metric.name)}">${chart ? `<h2>${metric.name}, <span>${metric.unit}</span></h2>` : ''}
    ${chart ? (axis ? periodGraph(metric, index, axis, plotWidth) : '<div class="cmp-period-empty">НД</div>') : comparisonTiles(metric)}</section>`).join('');

  const snapshotDates = [...new Set(metrics.flatMap(metric => metric.points.filter(point => Number.isFinite(point.value)).map(point => point.date)))].sort();
  const dateField = (key, label) => {
    const selected = comparisonDates[key];
    const options = snapshotDates.map(date => `<option value="${date}"${date === selected ? ' selected' : ''}>${date.split('-').reverse().join('.')}</option>`).join('');
    return `<div class="cmp-date-field">
      <label for="cmp-snapshot-${key}">${label}</label>
      <select id="cmp-snapshot-${key}" aria-label="Доступные срезы: ${label}">
        <option value="" disabled${snapshotDates.includes(selected) ? '' : ' selected'}>Выбрать срез</option>${options}
      </select>
    </div>`;
  };
  const dates = `<div class="cmp-dates">
    ${dateField('from', 'От')}
    ${dateField('to', 'До')}
  </div>`;
  const periodNote = !datesValid
    ? 'Укажите две даты. Дата «До» должна быть позже даты «От».'
    : chart ? 'Голубая зона — выбранный диапазон. Точки — доступные срезы.' : 'НД — нет среза на выбранную дату.';
  const context = `${dates}<div class="cmp-context" role="status"><span>${periodNote}</span></div>`;
  return '<section class="panel cmp-controls" aria-label="Настройки сравнения">' + switcher + context + '</section>'
    + (chart ? '<h2 class="cmp-section-title">Динамика и сравнение показателей</h2>' : '')
    + (chart ? '' : '<div class="cmp-column-head"><span>База</span><span>Сейчас</span></div>')
    + '<div class="cmp-list">' + cards + '</div>'
    + `<details class="panel cmp-details"><summary>Источники и методика</summary>
      <p>Выручка на графиках — январь–сентябрь, ОФР. Текучесть — годовые данные 1С. Срез SKU аттракционов — 02.11.2026. Графики показывают срезы между датами «От» и «До». НД — нет данных.</p>
      <p>Сделки считаются по дате подписания. Маржа — сумма маржи / сумма выручки без НДС. Плановая и фактическая маржа учитываются отдельно.</p></details>
      <details class="panel cmp-details"><summary>Решения и результат</summary>
      <p>Дата решения, ответственный, срок, показатель и подтверждённый эффект.</p>
      <p>Дополнительные показатели: допуск SKU к производству, заказы в срок, операционный денежный поток, сумма подписанных заказов.</p></details>`;
}

renderers.comparison = renderComparison;
$('#content').addEventListener('change', event => {
  if (current !== 'comparison') return;
  const {id, value} = event.target;
  if (id === 'cmp-snapshot-from') comparisonDates.from = value;
  else if (id === 'cmp-snapshot-to') comparisonDates.to = value;
  else return;
  render();
  $(`#${id}`).focus();
});
$('#content').addEventListener('click', event => {
  const button = event.target.closest('[data-comparison-view]');
  if (current !== 'comparison' || !button) return;
  const {comparisonView: view} = button.dataset;
  comparisonView = view;
  render();
  $(`[data-comparison-view="${view}"]`).focus();
});
const applyComparisonLabels = window.applyActualLabels;
window.applyActualLabels = function () {
  applyComparisonLabels();
  $('main').classList.toggle('cmp-page', current === 'comparison');
  if (current !== 'comparison') return;
  $('.asof').innerHTML = '<strong>01.11.2026</strong><span>Дата прихода</span>';
};
let comparisonContentWidth = $('#content').clientWidth;
new ResizeObserver(() => {
  const width = $('#content').clientWidth;
  if (width === comparisonContentWidth) return;
  comparisonContentWidth = width;
  if (current === 'comparison' && comparisonView === 'chart') render();
}).observe($('#content'));
render();

'use strict';

tabs.splice(1, 0, ['comparison', 'Сравнение', 'Сравнение', '']);
window.avNavIcons.comparison = 'trend';

let comparisonView = new URLSearchParams(location.search).get('view') === 'charts' ? 'chart' : 'table';
const comparisonDates = {from: '2024-01-01', to: comparisonToday()};

function comparisonData() {
  const metrics = window.AVERA_METRICS;
  const baseline = window.AVERA_SKU_BASELINE;
  const revenue = [2, 3].map((column, index) => {
    const value = metrics.value(window.AVERA_ACCOUNTING.incomeNine, '2110', column);
    return {date: `${2025 + index}-09-30`, value: Number.isFinite(value) ? value / 1000 : null};
  });
  const annualRevenue = [2, 3].map((column, index) => {
    const value = metrics.value(window.AVERA_ACCOUNTING.incomeAnnual, '2110', column);
    return {date: `${2024 + index}-12-31`, value: Number.isFinite(value) ? value / 1000 : null};
  });
  const turnover = window.AVERA_HR_TURNOVER.rows.map(row => ({
    date: row[0].slice(0, 4) + (row[0].includes('ноябрь') ? '-11-01' : '-12-31'),
    value: row[1], periodLabel: row[0], partial: row[0].includes('ноябрь')
  }));
  const start = baseline.asOf.split('.').reverse().join('-');
  const staffing = metrics.staffing();
  const loans = metrics.loanSeries().map(r=>({...r,value:Number.isFinite(r.value)?r.value/1000:null}));
  const profitSeries = (rows, year, suffix) => [2,3].map((column,index)=>{
    const value=metrics.value(rows,'2400',column);
    return {date:`${year+index}-${suffix}`,value:Number.isFinite(value)?value/1000:null};
  });
  const staffingMetrics = [
    ['Предусмотрено','planned'], ['Занято','occupied'], ['Вакантно','vacant']
  ].map(([name,key]) => ({name: name + ' по ШР', unit: 'ставки', icon: 'people',
    comparableSnapshots: true, discrete: true,
    points: staffing.map(row=>({date:row.date,value:row[key]}))
  }));
  return [
    {name: 'Выручка', unit: 'млн ₽', before: revenue[1].value, period: '9 мес. 2026', points: revenue},
    {name: 'Текучесть', unit: '%', before: turnover[1]?.value, period: '2025', points: turnover},
    {name: 'Аттракционы', unit: 'SKU', startBaseline: baseline.items.length, points: [{date: start, value: baseline.items.length}]},
    {name: 'Прочие продукты', unit: 'SKU', points: [{date: '2026-11-01', value: 0, label: 'Старт'}]},
    {name: 'Сделки', unit: 'шт.', points: []},
    {name: 'Маржа сделок', unit: '%', points: []},
    {name: 'Выручка за год', unit: 'млн ₽', icon: 'wallet', comparable: true, points: annualRevenue},
    {name: 'Чистая прибыль · 9 месяцев', unit: 'млн ₽', icon: 'trend', comparable: true, points: profitSeries(window.AVERA_ACCOUNTING.incomeNine,2025,'09-30')},
    {name: 'Чистая прибыль за год', unit: 'млн ₽', icon: 'trend', comparable: true, points: profitSeries(window.AVERA_ACCOUNTING.incomeAnnual,2024,'12-31')},
    {name: 'Кредиторская задолженность', unit: 'млн ₽', icon: 'wallet', direction: 'lower', comparableSnapshots: true,
      points: metrics.balanceSeries('1520').map(r=>({...r,value:Number.isFinite(r.value)?r.value/1000:null}))},
    {name: 'Остаток займов по балансу', unit: 'млн ₽', icon: 'wallet', comparableSnapshots: true, discrete: true, points: loans},
    ...staffingMetrics
  ];
}

const comparisonDay = 86400000;
const arrivalDate = '2026-10-26';

function comparisonToday() {
  return new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Moscow'}).format(new Date());
}

function comparisonAxis(width, from, to) {
  const selectedStart = Date.parse(from);
  const selectedEnd = Date.parse(to);
  const duration = selectedEnd - selectedStart;
  const paddingRatio = duration <= 90 * comparisonDay ? .25 : .08;
  const padding = Math.max(duration > 90 * comparisonDay ? 32 * comparisonDay : comparisonDay,
    Math.round(duration / comparisonDay * paddingRatio) * comparisonDay);
  const arrival = Date.parse(arrivalDate);
  const today = Date.parse(comparisonToday());
  const markerMargin = Math.max(comparisonDay, Math.round(duration * .02 / comparisonDay) * comparisonDay);
  const start = Math.min(selectedStart - padding, arrival - markerMargin, today - markerMargin);
  const end = Math.max(selectedEnd + padding, arrival + markerMargin, today + markerMargin);
  const left = 56;
  const right = width - 26;
  const x = date => left + (date - start) / (end - start) * (right - left);
  const maxTicks = Math.max(3, Math.floor((right - left) / 72));
  const ticks = window.avTimeTicks(start,end,maxTicks).map(tick=>({x:x(tick.date),label:tick.label}));
  return {left, right, x, start, end, selectedStart, selectedEnd, ticks, arrival, today};
}

function periodGraph(metric, index, axis, width) {
  const {left, right, x: dateX, start, end, selectedStart, selectedEnd, ticks} = axis;
  const observations = metric.points.filter(point => Number.isFinite(point.value) && Date.parse(point.date) >= start && Date.parse(point.date) <= end);
  const selected = observations.filter(point => Date.parse(point.date) >= selectedStart && Date.parse(point.date) <= selectedEnd)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const periods = selected.map((point, i) => ({point, x: dateX(Date.parse(point.date)),
    className: i === 0 && selected.length > 1 ? 'cmp-series-b' : 'cmp-series-a'}));
  const maximum = Math.max(1, metric.startBaseline ?? 0, ...observations.map(point => point.value));
  const targetStep = maximum * 1.1 / 5;
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const step = Math.max(['SKU', 'шт.'].includes(metric.unit) ? 1 : 0,
    [1, 2, 2.5, 5, 10].find(value => value * magnitude >= targetStep) * magnitude);
  const topTick = Math.ceil(maximum * 1.1 / step);
  const bottom = 176;
  const y = value => bottom - (value / (step * topTick)) * 156;
  const grid = Array.from({length: topTick + 1}, (_, tick) => {
    const value = tick * step;
    return `<path d="M${left} ${y(value)}H${right}"/><text x="${left - 14}" y="${y(value) + 3}" text-anchor="end">${fmt(value)}${metric.unit === '%' ? '%' : ''}</text>`;
  }).join('');
  const ordered = periods.filter(series => !series.point.partial);
  const coordinates = ordered.map(series => [series.x, y(series.point.value)]);
  const curve = coordinates.map(([x, py], i) => {
    if (!i) return 'M' + x + ' ' + py;
    const [previousX, previousY] = coordinates[i - 1];
    const third = (x - previousX) / 3;
    return 'C' + (previousX + third) + ' ' + previousY + ' ' + (x - third) + ' ' + py + ' ' + x + ' ' + py;
  }).join(' ');
  const first = coordinates[0];
  const last = coordinates.at(-1);
  const area = first && last ? curve + ' V' + bottom + ' H' + first[0] + ' Z' : '';
  const arrivalX = dateX(axis.arrival);
  const crossing = coordinates.findIndex(([x], i) => i > 0 && coordinates[i-1][0] <= arrivalX && x >= arrivalX);
  let arrivalY = Number.isFinite(metric.startBaseline) ? y(metric.startBaseline) : null;
  if (crossing > 0 && !metric.discrete) {
    const [x0,y0] = coordinates[crossing-1];
    const [x1,y1] = coordinates[crossing];
    const t = (arrivalX-x0)/(x1-x0);
    arrivalY = y0+(y1-y0)*t*t*(3-2*t);
  }
  const arrivalFillId = 'cmp-arrival-fill-' + index;
  const arrivalClipId = 'cmp-arrival-clip-' + index;
  const arrivalFill = '<defs><linearGradient id="' + arrivalFillId + '">' +
    '<stop stop-color="var(--cmp-arrival-color)" stop-opacity=".38"/><stop offset="1" stop-color="var(--cmp-arrival-color)" stop-opacity=".10"/>' +
    '</linearGradient><clipPath id="' + arrivalClipId + '"><rect x="' + arrivalX + '" y="20" width="' + (right-arrivalX) + '" height="156"/></clipPath></defs>';
  const arrivalArea = !metric.discrete && coordinates.length > 1 && last[0] > arrivalX
    ? '<path d="' + area + '" fill="url(#' + arrivalFillId + ')" clip-path="url(#' + arrivalClipId + ')"/>'
    : Number.isFinite(metric.startBaseline)
      ? '<rect x="' + arrivalX + '" y="' + arrivalY + '" width="' + (right-arrivalX) + '" height="' + (bottom-arrivalY) + '" fill="url(#' + arrivalFillId + ')"/>'
      : '';
  const arrivalLine = '<path class="cmp-after-arrival' + (arrivalY === null ? ' cmp-arrival-context' : '') +
    '" d="M' + arrivalX + ' ' + bottom + 'V' + (arrivalY ?? 20) + '"><title>Приход · 26.10.2026</title></path>';
  const fillId = `cmp-period-fill-${index}`;
  const trace = !metric.discrete && coordinates.length > 1
    ? `<defs><linearGradient id="${fillId}" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${Math.min(...coordinates.map(pair => pair[1]))}" y2="${bottom}">
         <stop offset="0" stop-color="var(--accent)" stop-opacity=".34"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
       </linearGradient></defs>
       <path class="cmp-period-fill" fill="url(#${fillId})" d="${area}"/>${arrivalArea}
       <path class="cmp-period-trace" d="${curve}"/>`
    : '';
  const marks = periods.map((series, i) => {
    const py = y(series.point.value);
    const x = series.x;
    const alignLeft = x < (left + right) / 2;
    const labelX = x + (alignLeft ? 14 : -14);
    const previous = periods[i - 1];
    const close = previous && x - previous.x < 65 && Math.abs(py - y(previous.point.value)) < 24;
    const labelY = close && i % 2
      ? (py < y(previous.point.value) ? Math.max(12, py - 32) : Math.min(175, py + 15))
      : py - 18;
    return `<g class="${series.className}"><circle cx="${x}" cy="${py}" r="3"/><text class="cmp-point-label ${series.point.value < 0 ? 'cmp-point-negative' : ''}" x="${labelX}" y="${labelY}" text-anchor="${alignLeft ? 'start' : 'end'}">${fmt(series.point.value)}${metric.unit === '%' ? '%' : ''}</text></g>`;
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
  const baselineY = y(metric.startBaseline);
  const baselineFillId = `cmp-baseline-fill-${index}`;
  const baseline = startLegend
    ? `<defs><linearGradient id="${baselineFillId}" x2="0" y2="100%">
        <stop stop-color="var(--accent)" stop-opacity=".40"/>
        <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient></defs>
      <rect x="${left}" y="${baselineY}" width="${right - left}" height="${bottom - baselineY}" fill="url(#${baselineFillId})"/>
      <path class="cmp-start-baseline" d="M${left} ${baselineY}H${right}"/>`
    : '';
  const seriesLabel = series => series.point.label || 'Срез';
  const legend = startLegend + (ordered.length > 1
    ? `<li class="cmp-series-a cmp-series-range"><i aria-hidden="true"></i>Период · ${label(ordered[0].point.date)} → ${label(ordered.at(-1).point.date)}</li>`
    : ordered.map(series => `<li class="${series.className}"><i aria-hidden="true"></i>${seriesLabel(series)} · ${label(series.point.date)}</li>`).join(''))
    + observations.filter(point => point.partial).map(point => `<li>${safe(point.periodLabel)} · ${fmt(point.value)}%</li>`).join('');
  const accessible = periods.map(series => `${seriesLabel(series)}, ${series.point.periodLabel || label(series.point.date)}, ${fmt(series.point.value)}`).join('. ');
  const contextPoints = observations.filter(point => !selected.includes(point)).map(point =>
    `<circle class="cmp-context-point" cx="${dateX(Date.parse(point.date))}" cy="${y(point.value)}" r="3"><title>${safe(point.periodLabel || point.date)} · ${fmt(point.value)} ${safe(metric.unit)}</title></circle>`).join('');
  const tickLabels = ticks.map(tick =>
    `<text class="cmp-axis-date" x="${tick.x}" y="194" text-anchor="middle">${safe(tick.label)}</text>`).join('');
  const halfDay = selectedStart === selectedEnd ? comparisonDay / 2 : 0;
  const rangeX = dateX(selectedStart - halfDay);
  const rangeWidth = dateX(selectedEnd + halfDay) - rangeX;
  return `<svg class="cmp-period-graph" viewBox="0 0 ${width} 202" role="img" aria-label="${safe(metric.name + ', ' + metric.unit + '. ' + (accessible || 'НД в выбранном диапазоне'))}">
      <rect class="cmp-selected-range" x="${rangeX}" y="20" width="${rangeWidth}" height="156"/>
      <g class="cmp-plot-grid">${grid}</g><path class="cmp-plot-axis" d="M${left} 20V176H${right}"/>
      ${arrivalFill}${baseline}${trace}${coordinates.length < 2 || last[0] <= arrivalX ? arrivalArea : ''}${arrivalLine}
      <path class="cmp-today-line" d="M${dateX(axis.today)} 20V176"/>
      ${contextPoints}${marks}${tickLabels}
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
      direction: metric.direction || (metric.discrete ? null : index === 1 ? 'lower' : index === 0 || index >= 4 ? 'higher' : null),
      comparableSnapshots: metric.comparableSnapshots || index <= 3 || metric.comparable,
      icon: metric.icon || ['wallet', 'people', 'products', 'products', 'sales', 'trend'][index],
      shortName: index === 3 ? 'Прочие SKU' : metric.name
    })),
    {name: 'Расходы', unit: 'млн ₽', direction: 'lower', icon: 'wallet', comparableSnapshots: true,
      points: expenses.map((value, index) => ({value, date: `${2025 + index}-09-30`}))}
  ];
  return rows.map(metric => {
    const {from, to} = comparisonDates;
    if (!from || !to || from > to) return {...metric, before: null, current: null};
    const before = metric.points.find(point => point.date === from);
    const current = metric.points.find(point => point.date === to);
    return {...metric, before: before?.value, current: current?.value, comparable: Boolean(metric.comparableSnapshots && before && current && !before.partial && !current.partial)};
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
  const datesValid = from && to && from <= to;
  const plotWidth = Math.max(240, $('#content').clientWidth - 30);
  const axis = chart && datesValid ? comparisonAxis(plotWidth, from, to) : null;
  const visibleMetrics = chart ? metrics : comparisonTableData(metrics);
  const cards = visibleMetrics.map((metric, index) => `<section class="${chart ? 'panel cmp-card cmp-period-card' : 'cmp-pair'}" aria-label="${safe(metric.name)}">${chart ? `<h2>${metric.name}, <span>${metric.unit}</span></h2>` : ''}
    ${chart ? (axis ? periodGraph(metric, index, axis, plotWidth) : '<div class="cmp-period-empty">НД</div>') : comparisonTiles(metric)}</section>`).join('');

  const dateField = (key, label) => `<div class="cmp-date-field">
      <label for="cmp-snapshot-${key}">${label}</label>
      <input type="date" id="cmp-snapshot-${key}" value="${safe(comparisonDates[key])}" required>
    </div>`;
  const dates = `<div class="cmp-dates">
    ${dateField('from', 'От')}
    ${dateField('to', 'До')}
  </div>`;
  const periodNote = !datesValid
    ? 'Укажите две даты. Дата «До» должна быть не раньше даты «От».'
    : chart ? '' : 'НД — нет среза на выбранную дату.';
  const staffingDates=window.AVERA_METRICS.staffing();
  const staffingShortcut=staffingDates.length ? '<button type="button" class="secondary" data-staffing-dates>Срезы штатных ставок: '+staffingDates[0].date.split('-').reverse().join('.')+' → '+staffingDates.at(-1).date.split('-').reverse().join('.')+'</button>' : '';
  const debtShortcut='<button type="button" class="secondary" data-debt-dates>Баланс: 31.12.2024 → 30.09.2026</button>';
  const context = `${dates}${staffingShortcut}${debtShortcut}${periodNote ? `<div class="cmp-context" role="status"><span>${periodNote}</span></div>` : ''}`;
  return '<section class="panel cmp-controls" aria-label="Настройки сравнения">' + switcher + context + '</section>'
    + (chart ? `<h2 class="cmp-section-title">Динамика и сравнение показателей</h2>` : '')
    + (chart ? '' : '<div class="cmp-column-head"><span>База</span><span>Сейчас</span></div>')
    + '<div class="cmp-list">' + cards + '</div>'
    + `<details class="panel cmp-details"><summary>Источники и методика</summary>
      <p>Выручка за январь–сентябрь и за полный год показана отдельно по ОФР. Текучесть 1С — увольнения за период / средняя численность × 100%; значение может превышать 100%. Январь–ноябрь 2026 отмечен отдельно на ноябре: точный день отчёта не указан. Срез SKU аттракционов — 02.11.2026. Штатные ставки: план, занято и вакантно из общего набора штатной расстановки 1С; это не люди. Значения доступны только на даты срезов, без переноса на соседние даты. НД — нет данных.</p>
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
  if(event.target.closest('[data-debt-dates]') && current==='comparison'){
    comparisonDates.from='2024-12-31';comparisonDates.to='2026-09-30';render();
    return;
  }
  if(event.target.closest('[data-staffing-dates]') && current==='comparison'){
    const rows=window.AVERA_METRICS.staffing();
    if(rows.length){comparisonDates.from=rows[0].date;comparisonDates.to=rows.at(-1).date;render();}
    return;
  }
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
  $('.asof').replaceChildren();
};
let comparisonContentWidth = $('#content').clientWidth;
new ResizeObserver(() => {
  const width = $('#content').clientWidth;
  if (width === comparisonContentWidth) return;
  comparisonContentWidth = width;
  if (current === 'overview' || (current === 'comparison' && comparisonView === 'chart')) render();
}).observe($('#content'));
render();


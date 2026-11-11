'use strict';
// Фактические данные. Публикация разрешена Сергеем 02.11.2026.
(()=>{
function card(icon, label, value, note, route, chart, change, controls) {
  return `<article class="av-metric">
    <a class="av-label av-kpi-link" href="#${route}">${window.avIcon(icon)}${safe(label)}</a>
    <div class="av-number av-kpi-values"><span>${safe(value)}</span>${change}</div>${note === null ? '' : `<div class="av-muted">${safe(note)}</div>`}
    ${controls}<div class="av-kpi-chart">${chart}</div>
  </article>`;
}

const overviewRange = {from: '2024-01-01', to: new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow'}).format(new Date())};
const arrivalDay = '2026-10-26';
const arrivalDate = Date.parse(arrivalDay);
const arrivalDateLabel = arrivalDay.split('-').reverse().join('.');
const arrivalLabel = 'Начало периода управления · ' + arrivalDateLabel;
const missing = '<p class="av-muted">Нет данных за выбранный период</p>';

function overviewTimeTicks(start, end, count) {
  const day = 86400000;
  const days = (end - start) / day;
  const unit = days <= 21 ? 'day' : days <= 140 ? 'week' : days <= 730 ? 'month' : 'year';
  const step = Math.max(1, Math.ceil(days / (count * {day:1, week:7, month:31, year:366}[unit])));
  const cursor = new Date(start);
  if (unit === 'week') cursor.setUTCDate(cursor.getUTCDate() - (cursor.getUTCDay() + 6) % 7);
  if (unit === 'month' || unit === 'year') cursor.setUTCDate(1);
  if (unit === 'year') cursor.setUTCMonth(0);
  const format = new Intl.DateTimeFormat('ru-RU', {timeZone:'UTC',
    ...(unit === 'year' ? {year:'numeric'} : unit === 'month' ? {month:'short',year:'2-digit'} : {day:'2-digit',month:unit==='week'?'short':'2-digit'})
  });
  const ticks = [];
  while (+cursor <= end) {
    if (+cursor >= start) ticks.push({date:+cursor,label:format.format(cursor)});
    if (unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth()+step);
    else if (unit === 'year') cursor.setUTCFullYear(cursor.getUTCFullYear()+step);
    else cursor.setUTCDate(cursor.getUTCDate()+step*(unit==='week'?7:1));
  }
  return ticks;
}

function overviewChart(id, points, unit, format = fmt, secondary = [], options = {}) {
  if (!points.length && !secondary.length && !options.contractDates?.length) return missing;
  const start = options.ordinal ? 1 : Date.parse(overviewRange.from);
  const end = options.ordinal ? points.length : Date.parse(overviewRange.to);
  const coordinate = key => options.ordinal ? key : Date.parse(key);
  const width = $('#content').clientWidth - 34;
  const left = 56, right = width - (options.rightAxis ? 52 : 26);
  const x = day => end === start ? (left + right) / 2 : left + 28 + (right - left - 56) * (day - start) / (end - start);
  const ordinalStep = Math.max(1, Math.ceil((end - start) / Math.max(1, Math.floor((right - left - 56) / 49))));
  const ticksX = options.ordinal ? points
    .filter(([, , position]) => position === end || ((position - 1) % ordinalStep === 0 && (position === 1 || end - position >= ordinalStep)))
    .map(([, , position]) => ({date:position, label:'№' + position}))
    : options.quarterTicks ? points.map(([label,,day])=>({date:Date.parse(day),label}))
    .filter((tick, i, ticks) => i === ticks.length - 1 || (i === 0 && x(ticks.at(-1).date) - x(tick.date) >= 56) ||
      (i > 0 && x(tick.date) - x(ticks[i-1].date) >= 56 && x(ticks.at(-1).date) - x(tick.date) >= 56))
    : overviewTimeTicks(start,end,Math.max(2,Math.floor((right-left)/85)));
  const values = (options.rightAxis ? points : [...points, ...secondary]).map(([, value]) => value);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = maximum - minimum || 1;
  const step = 10 ** Math.floor(Math.log10(span / 4));
  const tickStep = Math.max(options.integerAxis ? 1 : 0, Math.ceil(span / (4 * step)) * step);
  const low = Math.floor(minimum / tickStep) * tickStep;
  const high = Math.max(tickStep, Math.ceil(maximum / tickStep) * tickStep);
  const y = value => 28 + (high - value) / (high - low) * 148;
  const zero = y(0);
  const color = value => value < 0 ? 'var(--av-profit-loss)' : 'var(--accent)';
  const marks = points.map(([label, value, day, partial]) => ({
    label, value, partial, x: x(coordinate(day)), y: y(value)
  }));
  const curveMarks = marks.filter(mark => !mark.partial);
  const first = curveMarks[0];
  marks.forEach((mark, i) => {
    const previous = marks[i - 1];
    const above = mark.y - 16;
    mark.labelY = previous && mark.x - previous.x < 85 && Math.abs(above - previous.labelY) < 15
      ? Math.min(175, mark.y + 22) : above;
  });
  const last = curveMarks.at(-1);
  const curve = smoothCurve(curveMarks);
  const area = first ? curve + ' V' + zero + ' H' + first.x + ' Z' : '';
  const ticks = Array.from({length: Math.round((high - low) / tickStep) + 1}, (_, i) => (low + i * tickStep));
  const clip = side => 'av-kpi-' + id + '-' + side;
  const traces = curveMarks.length < 2 ? '' : ['up', 'down'].map((side, i) => {
    const key = clip(side);
    const shade = color(i ? -1 : 1);
    const edge = i ? 176 : 28;
    return '<defs><clipPath id="' + key + '"><rect y="' + (i ? zero : 0) + '" width="' + width +
      '" height="' + (i ? 202 - zero : zero) + '"/></clipPath><linearGradient id="' + key +
      '-fill" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="' + edge + '" y2="' + zero +
      '"><stop stop-color="' + shade + '" stop-opacity=".52"/><stop offset="1" stop-color="' + shade +
      '" stop-opacity="0"/></linearGradient></defs><g clip-path="url(#' + key + ')"><path d="' +
      area + '" fill="url(#' + key + '-fill)"/><path d="' + curve + '" fill="none" stroke="' + shade + '" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g>';
  }).join('');
  const showArrival = !options.ordinal && dateInRange(arrivalDay);
  let management = '';
  if (showArrival) {
    const arrivalX = x(arrivalDate);
    const exact = marks.find(mark => mark.x === arrivalX);
    const after = curveMarks.findIndex(mark => mark.x > arrivalX);
    let arrivalY = exact?.y;
    if (arrivalY === undefined && after > 0) {
      const previous = marks[after - 1];
      const next = marks[after];
      const t = (arrivalX - previous.x) / (next.x - previous.x);
      arrivalY = previous.y + (next.y - previous.y) * t * t * (3 - 2 * t);
    }
    if (curveMarks.length > 1 && last.x > arrivalX) {
      const key = clip('management');
      management += `<defs><clipPath id="${key}-clip"><rect x="${arrivalX}" y="28" width="${right - arrivalX}" height="148"/></clipPath><linearGradient id="${key}-fill" x2="0" y2="100%"><stop stop-color="var(--av-management)" stop-opacity=".38"/><stop offset="1" stop-color="var(--av-management)" stop-opacity=".12"/></linearGradient></defs><path d="${area}" fill="url(#${key}-fill)" clip-path="url(#${key}-clip)"/>`;
    }
    // The zero-to-curve segment can be only a few pixels for a series near zero.
    if (options.arrivalGuide && arrivalY !== undefined) {
      management += `<path class="av-management-guide" d="M${arrivalX} 28V176" fill="none" stroke="var(--av-management)" stroke-width="1.5" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"><title>${arrivalLabel}</title></path>`;
    }
    const marker = arrivalY === undefined ? `M${arrivalX} 28V176` : `M${arrivalX} ${zero}V${arrivalY}`;
    const dash = arrivalY === undefined ? ' stroke-dasharray="3 4"' : '';
    management += `<path class="av-management-marker" d="${marker}" fill="none" stroke="var(--av-management)" stroke-width="1.5" vector-effect="non-scaling-stroke"${dash}><title>${arrivalLabel}</title></path>`;
  }
  const secondaryValues = secondary.map(([, value]) => value);
  const rateLow = Math.min(0, Math.floor(Math.min(...secondaryValues) / 4) * 4);
  const rateHigh = Math.max(4, Math.ceil(Math.max(...secondaryValues) / 4) * 4);
  const secondaryY = options.rightAxis ? value => 28 + (rateHigh - value) / (rateHigh - rateLow) * 148 : y;
  const secondMarks = secondary.map(([label, value, day]) => ({label, value, x:x(coordinate(day)), y:secondaryY(value)}));
  const compactSecondary = options.compactSecondary;
  const secondaryColor = options.secondaryColor ?? (options.rightAxis ? 'var(--av-management)' : 'var(--muted)');
  const rightTicks = options.rightAxis && secondMarks.length ? Array.from({length:5}, (_, i) => rateLow + (rateHigh-rateLow)*i/4)
    .map(value => `<text x="${right + 5}" y="${secondaryY(value) + 4}" fill="${secondaryColor}">${safe(fmt(value))}%</text>`).join('') : '';
  const branch = options.branch && secondMarks.length ? marks.find(mark => mark.x === secondMarks[0].x) : null;
  const secondPath = smoothCurve(branch ? [branch, ...secondMarks] : secondMarks);
  const secondaryLine = secondMarks.length ? `<path class="av-secondary-line" d="${secondPath}" fill="none" stroke="${secondaryColor}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>` +
    secondMarks.map((mark, i) => {
      const value = fmt(mark.value) + (options.rightAxis ? '%' : '');
      const dot = `<circle class="av-secondary-point" r="${compactSecondary ? 2 : 3}" fill="${secondaryColor}" cx="${mark.x}" cy="${mark.y}"><title>${safe(mark.label + ': ' + value)}</title></circle>`;
      if (options.rightAxis && width < 600) return dot;
      if ((compactSecondary || options.ordinal) && i !== secondMarks.length - 1) return dot;
      const labelOnRight = !compactSecondary && i % 2;
      const labelX = mark.x + (labelOnRight ? 7 : -7);
      const labelY = Math.min(175, mark.y + (compactSecondary ? -10 : 17));
      return dot + `<text class="av-kpi-point-label" x="${labelX}" y="${labelY}" text-anchor="${labelOnRight ? 'start' : 'end'}" fill="${secondaryColor}">${safe(value)}</text>`;
    }).join('') : '';
  const coverage = (options.contractDates || []).map(([label,count,day]) => `<path class="contract-coverage-tick" d="M${x(Date.parse(day))} 177v6" stroke="var(--muted)" stroke-width="1.5"><title>${safe(label + ' · договоров: ' + count)}</title></path>`).join('');
  const balanceDescription = compactSecondary && secondMarks.length
    ? '. Остаток на конец месяца: ' + secondMarks.map(mark => mark.label + ': ' + fmt(mark.value)).join('. ') : '';
  return '<svg class="av-profit-chart" viewBox="0 0 ' + width + ' 202" role="img" aria-label="' +
    safe(unit + '. ' + marks.map(mark => mark.label + ': ' + format(mark.value)).join('. ') + (options.ordinal ? '. Рентабельность: ' + secondMarks.map(mark => mark.label + ': ' + fmt(mark.value) + '%').join('. ') : '') + balanceDescription + (showArrival ? '. ' + arrivalLabel : '')) + '">' +
    ticks.map(value => '<path d="M' + left + ' ' + y(value) + 'H' + right + '" class="av-kpi-gridline"/><text class="' + (Math.abs(Math.round(value/tickStep))%2 ? 'av-kpi-minor-tick' : '') + '" x="42" y="' +
      (y(value) + 4) + '" text-anchor="end">' + safe(fmt(value)) + '</text>').join('') + traces + management +
    '<path d="M' + left + ' 28V176 M' + left + ' ' + zero + 'H' + right + '" class="av-profit-axis"/>' + secondaryLine + rightTicks + coverage +
    marks.map((mark, i) => (options.markerDays && !options.markerDays.has(points[i][2]) ? '' : '<circle cx="' + mark.x + '" cy="' + mark.y + '" r="3" stroke="' + color(mark.value) + '" fill="' + (i===0 && marks.length>1 ? 'var(--surface)' : color(mark.value)) +
      '"><title>' + safe(mark.label + ': ' + format(mark.value)) + '</title></circle>') + (marks.length > 8 && i > 0 && i < marks.length - 1 ? '' : '<text class="av-kpi-point-label" x="' + mark.x + '" y="' + mark.labelY + '" fill="' + color(mark.value) + '" text-anchor="middle">' +
      safe(format(mark.value)) + '</text>')).join('') +
    ticksX.map(tick=>'<text x="'+x(tick.date)+'" y="194" text-anchor="middle">'+safe(tick.label)+'</text>').join('') +
    '</svg>';
}

function smoothCurve(marks) {
  return marks.map((mark, i) => {
    if (!i) return `M${mark.x} ${mark.y}`;
    const previous = marks[i - 1];
    const third = (mark.x - previous.x) / 3;
    return `C${previous.x + third} ${previous.y} ${mark.x - third} ${mark.y} ${mark.x} ${mark.y}`;
  }).join(' ');
}

function spaceOverviewLabels() {
  for (const chart of document.querySelectorAll('.av-owner-kpis .av-profit-chart')) {
    const labels = [...chart.querySelectorAll('.av-kpi-point-label')];
    const taken = [...chart.querySelectorAll('text:not(.av-kpi-point-label), circle')]
      .filter(node => getComputedStyle(node).display !== 'none').map(node => node.getBBox());
    const width = chart.viewBox.baseVal.width;
    for (const label of labels) {
      const x = Number(label.getAttribute('x'));
      const y = Number(label.getAttribute('y'));
      let placed = false;
      for (const [dx, dy] of [[0,0],[-18,0],[18,0],[0,-15],[0,15],[-25,-15],[25,-15],[-25,15],[25,15]]) {
        label.setAttribute('x', x + dx);
        label.setAttribute('y', y + dy);
        const box = label.getBBox();
        if (box.x < 2 || box.x + box.width > width - 2 || box.y < 0 || box.y + box.height > 185) continue;
        if (taken.some(other => box.x < other.x + other.width + 2 && box.x + box.width + 2 > other.x &&
          box.y < other.y + other.height + 2 && box.y + box.height + 2 > other.y)) continue;
        taken.push(box);
        placed = true;
        break;
      }
      if (!placed) label.style.display = 'none';
    }
  }
}

const cashUnit = 'млн ₽';
const dateInRange = day => day >= overviewRange.from && day <= overviewRange.to;

function seriesPoints(key, unit) {
  const scale = unit === cashUnit ? 1 / 1e6 : unit === '%' ? 100 : 1;
  return (window.AVERA_OVERVIEW_SERIES[key] || [])
    .filter(([day]) => dateInRange(day))
    .map(([day, value, label, , partial]) => [label, value * scale, day, partial]);
}

function summaryCard({id, icon, label, route, unit, points, note = '', value, secondary = [], options, change = ''}) {
  const last = points.at(-1);
  const displayed = value ?? (last ? fmt(last[1]) + ' ' + unit : 'НД');
  const description = note === null ? null : note || (last ? last[0] : 'Нет среза в выбранном периоде');
  return card(icon, label, displayed, description, route,
    overviewChart(id, points, label + ', ' + unit, fmt, secondary, options), change, '');
}

function statusCard(icon, label, value, note, route) {
  return `<article class="av-metric av-status-card">
    <a class="av-label av-kpi-link" href="#${route}">${window.avIcon(icon)}${safe(label)}</a>
    <div class="av-number">${safe(value)}</div><div class="av-muted">${safe(note)}</div>
  </article>`;
}

function cashDelta(points, subject, periodLabel) {
  if (points.length < 2) return '';
  const first = points[0], last = points.at(-1);
  const delta = last[1] - first[1];
  const amount = fmt(Math.abs(delta));
  const period = periodLabel(first) + ' → ' + periodLabel(last);
  if (amount === '0') {
    return '<span class="av-kpi-delta" title="' + safe(period) + '">0 млн ₽ · без изменений</span>';
  }
  const increased = delta > 0;
  const tone = increased ? 'good' : 'bad';
  const change = (increased ? '+' : '−') + amount + ' ' + cashUnit +
    (increased ? ' · ' + subject + ' вырос' : '');
  return '<span class="av-kpi-delta av-kpi-delta-' + tone + '" title="' + safe(period) + '">' +
    safe(change) + '</span>';
}

function cashMovementCard() {
  const points = seriesPoints('netCashFlow', cashUnit);
  const balances = seriesPoints('cash', cashUnit);
  const last = points.at(-1), balance = balances.at(-1);
  const change = cashDelta(points, 'поток', ([period]) => period);
  const balanceChange = cashDelta(balances, 'остаток', ([,,day]) => day.split('-').reverse().join('.'));
  const balanceKpi = balance ? `<div class="av-cash-balance-kpi">
    <div class="av-label">Остаток на конец месяца</div>
    <div class="av-number av-kpi-values"><span>${safe(fmt(balance[1]) + ' ' + cashUnit)}</span>${balanceChange}</div>
  </div>` : '';
  const legend = last || balance ? '<div class="av-cash-legend av-chart-legend">' +
    (last ? '<span><i aria-hidden="true"></i>Чистый денежный поток</span>' : '') +
    (balance ? '<span><i class="av-cash-dash" aria-hidden="true"></i>Остаток на конец месяца</span>' : '') +
    (dateInRange(arrivalDay) ? '<span><i class="av-arrival-key" aria-hidden="true"></i>' + arrivalLabel + '</span>' : '') +
    '</div>' : '';
  const label = 'Чистый денежный поток и остатки на счетах';
  return card('wallet', label, last ? fmt(last[1]) + ' ' + cashUnit : 'НД', null, 'finance',
    overviewChart('netCashFlow', points, label + ', ' + cashUnit, fmt, balances,
      {compactSecondary:true, secondaryColor:'var(--av-cash-balance)', arrivalGuide:true}) + legend, change, balanceKpi);
}

function financeCard(id, label, icon) {
  const points = seriesPoints(id, cashUnit);
  return summaryCard({id, icon, label, route:'finance', unit:cashUnit, points, note:null});
}

function quarterOf(day) {
  const date = new Date(day);
  return date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3);
}

function salesCard(contracts) {
  const quarterly = new Map();
  let count = 0;
  for (const [,value,day] of contracts) {
    const quarter = quarterOf(day);
    quarterly.set(quarter, (quarterly.get(quarter) || 0) + value);
    count += value;
  }
  const source = window.AVERA_OVERVIEW_SERIES.contractDates;
  const points = [], completeQuarters = [];
  if (source.length) {
    const first = Math.max(quarterOf(source[0][0]), quarterOf(overviewRange.from));
    const last = Math.min(quarterOf(source.at(-1)[0]), quarterOf(overviewRange.to));
    for (let q = first; q <= last; q++) {
      const year = Math.floor(q / 4), index = q % 4;
      const start = new Date(Date.UTC(year, index * 3, 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(year, (index + 1) * 3, 0)).toISOString().slice(0, 10);
      const label = ['I','II','III','IV'][index] + ' кв. ' + String(year).slice(-2);
      const point = [label, quarterly.get(q) || 0, end < overviewRange.to ? end : overviewRange.to];
      points.push(point);
      if (dateInRange(start) && dateInRange(end)) completeQuarters.push(point);
    }
  }
  let change = '';
  if (completeQuarters.length >= 2) {
    const [firstLabel, firstCount] = completeQuarters[0];
    const [lastLabel, lastCount] = completeQuarters.at(-1);
    const delta = lastCount - firstCount;
    const tone = delta === 0 ? '' : ' av-kpi-delta-' + (delta > 0 ? 'good' : 'bad');
    const sign = delta === 0 ? '' : delta > 0 ? '+' : '−';
    const amount = sign + fmt(Math.abs(delta)) + ' шт.';
    const comparison = delta === 0 ? 'без изменений' : fmt(firstCount) + ' → ' + fmt(lastCount) + ' за квартал';
    change = `<span class="av-kpi-delta${tone}" title="${safe(firstLabel + ' → ' + lastLabel)}">${safe(amount + ' · ' + comparison)}</span>`;
  }
  return summaryCard({id:'contracts', icon:'sales', label:'Договоры по кварталам', route:'sales', unit:'шт.',
    points, value:points.length ? fmt(count) + ' шт.' : 'НД', change,
    note:null, options:{quarterTicks:true, integerAxis:true}});
}

function marginChange(snapshot) {
  const baseline = dateInRange(snapshot.asOf) &&
    seriesPoints('weightedMargin', '%').find(point => point[2] < snapshot.asOf);
  if (!baseline) {
    return '<span class="av-kpi-delta" title="Нет второго сопоставимого среза в выбранном периоде">Динамика НД</span>';
  }
  const delta = snapshot.weightedRate * 100 - baseline[1];
  const amount = fmt(Math.abs(delta));
  const tone = amount === '0' ? '' : ' av-kpi-delta-' + (delta > 0 ? 'good' : 'bad');
  const sign = amount === '0' ? '' : delta > 0 ? '+' : '−';
  return `<span class="av-kpi-delta${tone}">${safe(sign + amount + ' п. п.')}</span>`;
}

function marginCard() {
  const snapshot = window.AVERA_OVERVIEW_SERIES.contractAnalysisSnapshot;
  const rows = snapshot?.positions || [];
  const points = rows.map(([price], i) => ['Позиция №' + (i + 1), price / 1e6, i + 1]);
  const secondary = rows.map(([, rate], i) => ['Позиция №' + (i + 1), rate * 100, i + 1]);
  const label = 'Стоимость и рентабельность договоров';
  const value = 'Взвешенная рентабельность — ' + (rows.length ? fmt(snapshot.weightedRate * 100) + '%' : 'НД');
  const arrivalSnapshot = snapshot?.asOf === arrivalDay
    ? `<span><i class="av-arrival-key" aria-hidden="true"></i>Срез на дату прихода · ${arrivalDateLabel}</span>`
    : '';
  const legend = rows.length ? `<div class="av-chart-legend av-margin-legend">
    <span><i aria-hidden="true"></i>Стоимость с НДС, млн ₽</span>
    <span><i class="av-margin-dash" aria-hidden="true"></i>Рентабельность, %</span>
    ${arrivalSnapshot}
  </div>` : '';
  return card('sales', label, value, null, 'sales',
    overviewChart('deal-margin', points, label + ', ' + cashUnit, fmt, secondary,
      {rightAxis:true, ordinal:true}) + legend, rows.length ? marginChange(snapshot) : '', '');
}

function balanceCard() {
  const points = seriesPoints('payables', cashUnit);
  const secondary = seriesPoints('receivables', cashUnit);
  const latest = points.at(-1);
  const receive = latest && secondary.find(point => point[2] === latest[2]);
  return summaryCard({id:'balances', icon:'wallet', label:'Кредиторская и дебиторская задолженность', route:'finance',
    unit:cashUnit, points, secondary, value:latest && receive ? fmt(latest[1]) + ' / ' + fmt(receive[1]) + ' ' + cashUnit : undefined,
    note:latest ? 'На ' + latest[0] + ' · сплошная — кредиторка, пунктир — дебиторка' : ''});
}

function loanCard() {
  const points = seriesPoints('loanCash', cashUnit);
  const receipts = seriesPoints('loanReceipts', cashUnit);
  return summaryCard({id:'loan-cash', icon:'wallet', label:'Займы · накопленное движение по ДДС', route:'finance',
    unit:cashUnit, points, options:{markerDays:new Set(receipts.map(point=>point[2]))},
    note:points.length ? 'Получено минус погашено · точки — месяцы с поступлениями (' + receipts.length + ')' : ''});
}

function productsCard() {
  const current = seriesPoints('attractions', 'SKU');
  const points = dateInRange('2024-01-01') ? [['Условный старт',0,'2024-01-01'], ...current] : current;
  const secondary = [['Начало периода управления',0,'2026-10-26'],['Текущий срез',0,'2026-11-09']]
    .filter(point=>dateInRange(point[2]));
  return summaryCard({id:'product-pair', icon:'products', label:'Продуктовый портфель', route:'products', unit:'SKU',
    points, secondary, value:current.length ? fmt(current.at(-1)[1]) + (secondary.length ? ' / 0 SKU' : ' SKU') : 'НД',
    note:'Сплошная — аттракционы, стартовый ноль условный. Пунктир — неаттракционы с 26.10.2026.'});
}

function teamCard() {
  const planned = seriesPoints('planned', 'ставки');
  const occupied = seriesPoints('occupied', 'ставки');
  const history = seriesPoints('headcount', 'чел.');
  if (dateInRange('2024-01-01')) history.unshift(['Условный старт',0,'2024-01-01']);
  const latest = planned.at(-1);
  const actual = latest && occupied.find(point => point[2] === latest[2]);
  const first = actual && occupied.find(point => point[2] < actual[2]);
  const delta = first ? actual[1] - first[1] : 0;
  const tone = delta > 0 ? 'good' : 'bad';
  const change = delta === 0 ? '' : '<span class="av-team-delta av-kpi-delta av-kpi-delta-' + tone + '">' +
    safe((delta > 0 ? '+' : '−') + fmt(Math.abs(delta)) + ' занятых ставок') + '</span>';
  return summaryCard({id:'team-history', icon:'people', label:'Команда', route:'people', unit:'ставки',
    points:[...history,...planned], secondary:occupied, options:{branch:true}, change,
    value:actual ? fmt(latest[1]) + ' / ' + fmt(actual[1]) + ' ставки' : history.length ? fmt(history.at(-1)[1]) + ' чел.' : 'НД',
    note:'2024–2025 — средняя численность. С 16.10.2026 сплошная — всего ставок, пунктир — занято.'});
}

window.ownerOverview = function () {
  const {from, to} = overviewRange;
  const controls = '<div class="panel cmp-controls" aria-label="Единый период обзора"><div class="cmp-dates">' +
    [['from','От'],['to','До']].map(([key,label]) => {
      const value = overviewRange[key];
      const shortDate = value ? value.split('-').reverse().join('.') : 'дд.мм.гггг';
      return `<div class="cmp-date-field">
        <label for="av-overview-${key}">${label}</label>
        <div class="cmp-date-input">
          <span class="cmp-date-value" aria-hidden="true">${safe(shortDate)}</span>
          <input type="date" id="av-overview-${key}" data-overview-date="${key}" value="${safe(value)}">
        </div>
      </div>`;
    }).join('') + '</div></div>';
  if (!from || !to || from > to) return controls + '<p class="av-muted">Укажите корректный диапазон дат.</p>';
  const contracts = seriesPoints('contractDates', 'шт.');
  const statusVisible = dateInRange('2026-11-09');
  const sections = [
    ['Финансовый результат',[financeCard('revenue','Выручка','wallet'),financeCard('profit','Чистая прибыль','trend'),
      cashMovementCard()]],
    ['Продажи',[salesCard(contracts),statusCard('sales','На подписании',statusVisible ? '1 договор · 3 крупных продукта' : 'НД',
      statusVisible ? 'Оперативный срез на 09.11.2026 · сумма и дата подписания уточняются' : 'Нет среза в выбранном периоде','sales')]],
    ['Исполнение заказа',[statusCard('sales','Заказ в работе',statusVisible ? '1 крупный заказ' : 'НД',
      statusVisible ? 'Оперативный срез на 09.11.2026 · ближайшая отгрузка и готовность КД уточняются' : 'Нет среза в выбранном периоде','production')]],
    ['Маржа',[marginCard()]],
    ['Деньги и обязательства',[balanceCard(),loanCard()]],
    ['Продуктовый портфель',[productsCard()]],
    ['Команда',[teamCard()]]
  ];
  return controls + '<section class="av-grid av-owner-kpis" aria-label="Показатели компании">' +
    sections.map(([name, cards], i) => '<h2 class="av-overview-section">' + (i+1) + '. ' + safe(name) + '</h2>' + cards.join('')).join('') + '</section>';
};
$('#content').addEventListener('change', event=>{
  const key = event.target.dataset.overviewDate;
  if (!key || current !== 'overview') return;
  overviewRange[key] = event.target.value;
  render();
  $('#av-overview-'+key).focus();
});
let overviewContentWidth = $('#content').clientWidth;
new ResizeObserver(() => {
  const width = $('#content').clientWidth;
  if (width === overviewContentWidth) return;
  overviewContentWidth = width;
  if (current === 'overview') render();
}).observe($('#content'));
function date(v){const m=String(v||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;}
window.renderRealProduction=function(){const d=window.AVERA_PRODUCTION_SNAPSHOT,s=window.AVERA_METRICS.production();const risky=s.risky;return summary([['Именованных строк',s.named,'Весь прочитанный лист; разный тип записей'],['Отмечено выполненными',s.completed,'По отметке F; без подтверждения приёмки'],['Прошёл плановый срок',s.openPastPlan,'Без отметки завершения'],['Нет плановой даты',s.openMissingPlanDate,'Среди открытых записей']])+panel('Записи с прошедшим плановым сроком',table(['Строка','Наименование','План','Отметка КД','Исполнитель'],risky.map(r=>[`<a href="https://docs.google.com/spreadsheets/d/${d.spreadsheetId}/edit#gid=142048530&range=A${r.row}:L${r.row}" target="_blank" rel="noopener noreferrer">${r.row}</a>`,safe(r.name),safe(r.end),safe(r.kd||'Не заполнено'),safe(r.executor||'Не заполнено')]))+'<p class="hint">Это календарный контроль исходного графика. Перенос срока, причина и нарушение договорной поставки отдельно не подтверждены.</p>')+panel('Противоречия факта',table(['Строка','Наименование','Фактическая дата'],s.actualWithNotDone.map(r=>[r.row,safe(r.name),safe(r.actual)])))+panel('Охват и ограничения',`<p>Прочитан диапазон A1:L1667 листа «${safe(d.sheet)}» 02.11.2026. ${s.named} именованных строк, ${s.completed} с отметкой TRUE, ${s.open} без неё. В листе смешаны операции, закупки, сводные и другие записи. Номер строки — адрес источника, а не постоянный ID. Выпуск, загрузка мощностей и процент физической готовности не рассчитаны.</p><p class="hint">Сводный лист использует иной отбор: 432 задачи и 72 выполненные. Эти итоги не заменяют полный прочитанный лист без объяснения отбора.</p>`);};
renderers.production=window.renderRealProduction;
renderers.sales=()=>panel('Продажи · нет подтверждённого актуального среза','<p>НД. Битрикс24 не подключён к регулярной загрузке. Демо-сделки и демосуммы скрыты в реальной версии.</p><p class="hint">Нужен полный разрешённый срез воронок с ID сделок, стадиями, валютой, ответственными и датой извлечения. Договоры, оплаты и выручка требуют собственных оснований.</p>');
renderers.products=()=>panel('Продукты и КБ · нет подтверждённого реестра','<p>НД. Реестр моделей, инициатив, ревизий и разрешений не подключён. Цель 20 SKU относится к аттракционам; фактический состав и процент достижения не подтверждены.</p><p class="hint">Отметки КД в производственном графике не подтверждают готовность полного комплекта модели.</p>');
function labels(){document.querySelector("main").classList.toggle("av-overview-type",current==="overview");const message={overview:'Фактические источники с отдельными датами. Автоматическое получение новых данных не настроено.',finance:'Фактическая бухгалтерская отчётность. Загрузка PDF вручную; карточки и таблицы используют один набор. Прямого подключения к 1С нет.',assets:'Фактическая ведомость ОС. Итоги пересчитываются из строк, расхождения со строкой «Итого» источника показаны отдельно. Автоимпорта нет.',people:'Фактические снимки кадровых отчётов 1С. События, текучесть и средняя численность — отдельные показатели. Автоимпорта нет.',production:'Сохранённый срез «Гант Завод». Показатели рассчитаны из записей; регулярное чтение источника пока не настроено.',sales:'Актуальный срез Битрикс24 не загружен. Демонстрационные суммы в реальной версии скрыты.',products:'Подтверждённый реестр продуктов и КД не загружен. Демонстрационные статусы и количества скрыты.'};document.querySelector('main > .notice').textContent=message[current]||'Нет данных';if(['overview','production'].includes(current))document.querySelector('.asof').innerHTML='<strong>2 ноября 2026</strong><span>Периоды указаны у каждого показателя</span>';if(['sales','products'].includes(current))document.querySelector('.asof').innerHTML='<strong>Нет подтверждённого среза</strong><span>НД — не ноль</span>';if(current==='production'){$('#subtitle').textContent='Фактический срез «Гант Завод» · календарные сигналы и качество данных';}}
window.applyActualLabels=function(){
  labels();
  if(current==='overview'){
    $('#title').textContent='Сводка по компании';
    $('#subtitle').textContent='';
    document.querySelector('main > .notice').textContent='';
    document.querySelector('.asof').textContent='Даты срезов указаны в карточках';
    spaceOverviewLabels();
  }
};render();
})();

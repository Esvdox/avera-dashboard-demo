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

const fullRange = {from: '2024-01-01', to: new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow'}).format(new Date())};
const overviewRange = {...fullRange};
const periods = [
  {label:'За все время', ...fullRange},
  {label:'2025', from:'2025-01-01', to:'2025-12-31'},
  {label:'2026', from:'2026-01-01', to:fullRange.to < '2026-12-31' ? fullRange.to : '2026-12-31'}
];
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
  const primarySeries = options.history || points;
  const secondarySeries = options.secondaryHistory || secondary;
  if (!primarySeries.length && !secondarySeries.length && !options.contractDates?.length) return missing;
  const start = options.contractDatesAxis ? Math.min(...points.map(point => Date.parse(point[2]))) : options.ordinal ? 1 : Date.parse(overviewRange.from);
  const end = options.contractDatesAxis ? Math.max(...points.map(point => Date.parse(point[2]))) : options.ordinal ? points.length : Date.parse(overviewRange.to);
  const coordinate = key => options.ordinal ? key : Date.parse(key);
  const width = $('#content').clientWidth - 34;
  const left = 56, right = width - (options.rightAxis ? 52 : 26);
  const padding = options.history ? 0 : 28;
  const x = day => end === start ? (left + right) / 2 : left + padding + (right - left - 2 * padding) * (day - start) / (end - start);
  // A single selected date has no horizontal interval to interpolate.
  const geometry = series => options.history && start === end ? series.filter(point => coordinate(point[2]) === start) : series;
  const ordinalStep = Math.max(1, Math.ceil((end - start) / Math.max(1, Math.floor((right - left - 56) / 49))));
  const observedDates = options.contractDatesAxis ? [...new Set(points.map(point => point[2]))] : [];
  const dateTicks = observedDates.reduce((ticks, day, index) => {
    const stamp = Date.parse(day);
    if (index === observedDates.length - 1 || !ticks.length ||
        (x(stamp) - x(ticks.at(-1).date) >= 70 && x(end) - x(stamp) >= 70)) {
      ticks.push({date:stamp,label:day.slice(8,10)+'.'+day.slice(5,7)+'.'+day.slice(2,4)});
    }
    return ticks;
  }, []);
  const ticksX = options.contractDatesAxis ? dateTicks : options.ordinal ? points
    .filter(([, , position]) => position === end || ((position - 1) % ordinalStep === 0 && (position === 1 || end - position >= ordinalStep)))
    .map(([, , position]) => ({date:position, label:'№' + position}))
    : options.quarterTicks ? points.map(([label,,day])=>({date:Date.parse(day),label}))
    .filter((tick, i, ticks) => i === ticks.length - 1 || (i === 0 && x(ticks.at(-1).date) - x(tick.date) >= 56) ||
      (i > 0 && x(tick.date) - x(ticks[i-1].date) >= 56 && x(ticks.at(-1).date) - x(tick.date) >= 56))
    : overviewTimeTicks(start,end,Math.max(2,Math.floor((right-left)/85)));
  const values = (options.rightAxis ? primarySeries : [...primarySeries, ...secondarySeries]).map(([, value]) => value);
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
  const toMark = ([label, value, day, partial]) => ({
    label, value, partial, x: x(coordinate(day)), y: y(value)
  });
  const marks = points.map(toMark);
  const fullMarks = options.history ? geometry(primarySeries).map(toMark) : marks;
  const curveMarks = options.connectPartialPeriods ? fullMarks : fullMarks.filter(mark => !mark.partial);
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
  const showArrival = !options.ordinal && arrivalDate >= start && arrivalDate <= end && dateInRange(arrivalDay);
  let management = '';
  if (showArrival) {
    const arrivalX = x(arrivalDate);
    const exact = marks.find(mark => mark.x === arrivalX);
    const after = curveMarks.findIndex(mark => mark.x > arrivalX);
    let arrivalY = exact?.y;
    if (arrivalY === undefined && after > 0) {
      const previous = curveMarks[after - 1];
      const next = curveMarks[after];
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
  const toSecondaryMark = ([label, value, day]) => ({label, value, x:x(coordinate(day)), y:secondaryY(value)});
  const secondMarks = secondary.map(toSecondaryMark);
  const secondaryCurve = options.secondaryHistory ? geometry(secondarySeries).map(toSecondaryMark) : secondMarks;
  const compactSecondary = options.compactSecondary;
  const secondaryColor = options.secondaryColor ?? (options.rightAxis ? 'var(--av-management)' : 'var(--muted)');
  const rightTicks = options.rightAxis && secondMarks.length ? Array.from({length:5}, (_, i) => rateLow + (rateHigh-rateLow)*i/4)
    .map(value => `<text x="${right + 5}" y="${secondaryY(value) + 4}" fill="${secondaryColor}">${safe(fmt(value))}%</text>`).join('') : '';
  const branch = options.branch && secondMarks.length ? marks.find(mark => mark.x === secondMarks[0].x) : null;
  const secondPath = smoothCurve(branch ? [branch, ...secondaryCurve] : secondaryCurve);
  const secondaryLine = secondaryCurve.length ? `<path class="av-secondary-line" d="${secondPath}" fill="none" stroke="${secondaryColor}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>` +
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
  // The scale and curves use the full series. Only the selected window is painted.
  const windowId = clip('window');
  const windowDef = options.history ? `<defs><clipPath id="${windowId}"><rect x="${left}" y="0" width="${right-left}" height="183"/></clipPath></defs>` : '';
  const inWindow = svg => options.history ? `<g clip-path="url(#${windowId})">${svg}</g>` : svg;
  const coverage = (options.contractDates || []).map(([label,count,day]) => `<path class="contract-coverage-tick" d="M${x(Date.parse(day))} 177v6" stroke="var(--muted)" stroke-width="1.5"><title>${safe(label + ' · договоров: ' + count)}</title></path>`).join('');
  const balanceDescription = compactSecondary && secondMarks.length
    ? '. Остаток на отчётную дату: ' + secondMarks.map(mark => mark.label + ': ' + fmt(mark.value)).join('. ') : '';
  return '<svg class="av-profit-chart" viewBox="0 0 ' + width + ' 202" role="img" aria-label="' +
    safe(unit + '. ' + marks.map(mark => mark.label + ': ' + format(mark.value)).join('. ') + (options.ordinal ? '. Рентабельность: ' + secondMarks.map(mark => mark.label + ': ' + fmt(mark.value) + '%').join('. ') : '') + balanceDescription + (showArrival ? '. ' + arrivalLabel : '')) + '">' +
    ticks.map(value => '<path d="M' + left + ' ' + y(value) + 'H' + right + '" class="av-kpi-gridline"/><text class="' + (Math.abs(Math.round(value/tickStep))%2 ? 'av-kpi-minor-tick' : '') + '" x="42" y="' +
      (y(value) + 4) + '" text-anchor="end">' + safe(fmt(value)) + '</text>').join('') + windowDef + inWindow(traces + management) +
    '<path d="M' + left + ' 28V176 M' + left + ' ' + zero + 'H' + right + '" class="av-profit-axis"/>' + inWindow(secondaryLine) + rightTicks + coverage +
    marks.map((mark, i) => (options.markerDays && !options.markerDays.has(points[i][2]) ? '' : '<circle cx="' + mark.x + '" cy="' + mark.y + '" r="3" stroke="' + color(mark.value) + '" fill="' + (i===0 && marks.length>1 ? 'var(--surface)' : color(mark.value)) +
      '"><title>' + safe(mark.label + ': ' + format(mark.value) + (options.showMissingMargins && !secondary.some(item => item[0] === mark.label) ? ' · Маржинальность: НД' : '')) + '</title></circle>') + (marks.length > 8 && i > 0 && i < marks.length - 1 ? '' : '<text class="av-kpi-point-label" x="' + mark.x + '" y="' + mark.labelY + '" fill="' + color(mark.value) + '" text-anchor="middle">' +
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

function seriesPoints(key, unit, fullHistory = false) {
  const scale = unit === cashUnit ? 1 / 1e6 : unit === '%' ? 100 : 1;
  return (window.AVERA_OVERVIEW_SERIES[key] || [])
    .filter(([day]) => fullHistory || dateInRange(day))
    .map(([day, value, label, basis, partial]) => [label, value * scale, day, partial, basis]);
}

function summaryCard({id, icon, label, route, unit, points, note = '', value, secondary = [], options, change = '', lineLabels}) {
  const last = points.at(-1);
  const displayed = value ?? (last ? fmt(last[1]) + ' ' + unit : 'НД');
  const description = note === null ? null : note || (last ? last[0] : 'Нет среза в выбранном периоде');
  const legend = lineLabels && (points.length || secondary.length) ? '<div class="av-chart-legend">' +
    (points.length ? '<span><i aria-hidden="true"></i>Сплошная — ' + safe(lineLabels[0]) + '</span>' : '') +
    (secondary.length ? '<span><i class="av-series-dash" aria-hidden="true"></i>Пунктир — ' + safe(lineLabels[1]) + '</span>' : '') +
    '</div>' : '';
  return card(icon, label, displayed, description, route,
    overviewChart(id, points, label + ', ' + unit, fmt, secondary, options) + legend, change, '');
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
  const history = seriesPoints('netCashFlow', cashUnit, true);
  const secondaryHistory = seriesPoints('cash', cashUnit, true);
  const points = history.filter(point => dateInRange(point[2]));
  const balances = secondaryHistory.filter(point => dateInRange(point[2]));
  const last = points.at(-1), balance = balances.at(-1);
  const change = cashDelta(points, 'поток', ([period]) => period);
  const balanceChange = cashDelta(balances, 'остаток', ([,,day]) => day.split('-').reverse().join('.'));
  const balanceKpi = balance ? `<div class="av-cash-balance-kpi">
    <div class="av-label">Остаток на отчётную дату</div>
    <div class="av-number av-kpi-values"><span>${safe(fmt(balance[1]) + ' ' + cashUnit)}</span>${balanceChange}</div>
  </div>` : '';
  const legend = history.length || secondaryHistory.length ? '<div class="av-cash-legend av-chart-legend">' +
    (history.length ? '<span><i aria-hidden="true"></i>Чистый денежный поток за период</span>' : '') +
    (secondaryHistory.length ? '<span><i class="av-cash-dash" aria-hidden="true"></i>Остаток на отчётную дату</span>' : '') +
    (dateInRange(arrivalDay) ? '<span><i class="av-arrival-key" aria-hidden="true"></i>' + arrivalLabel + '</span>' : '') +
    '</div>' : '';
  const label = 'Чистый денежный поток и остатки на счетах';
  return card('wallet', label, last ? fmt(last[1]) + ' ' + cashUnit : 'НД', null, 'finance',
    overviewChart('netCashFlow', points, label + ', ' + cashUnit, fmt, balances,
      {history, secondaryHistory, connectPartialPeriods:true, compactSecondary:true, secondaryColor:'var(--av-cash-balance)', arrivalGuide:true}) + legend, change, balanceKpi);
}

function financeCard(id, label, icon) {
  const history = seriesPoints(id, cashUnit, true);
  const points = history.filter(point => dateInRange(point[2]));
  const last = points.at(-1);
  const first = last?.[4] && points.find(point => point[2] < last[2] && point[4] === last[4]);
  let change = '';
  if (first) {
    const delta = last[1] - first[1];
    const amount = fmt(Math.abs(delta));
    const sign = amount === '0' ? '' : delta > 0 ? '+' : '−';
    const tone = amount === '0' ? '' : ' av-kpi-delta-' + (delta > 0 ? 'good' : 'bad');
    const result = id === 'profit' && first[1] < 0 && last[1] > 0 ? ' · выход в прибыль' : '';
    const period = first[0] + ' → ' + last[0];
    change = `<span class="av-kpi-delta${tone}" title="${safe(period)}">${safe(sign + amount + ' ' + cashUnit + result)}</span>`;
  }
  return summaryCard({id, icon, label, route:'finance', unit:cashUnit, points, change, options:{history}, note:null});
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
    const amount = sign + fmt(Math.abs(delta));
    change = `<span class="av-kpi-delta${tone}" title="${safe(firstLabel + ' → ' + lastLabel)}">${safe(amount)}</span>`;
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
  const source = window.AVERA_OVERVIEW_SERIES.contractMarginRegistry;
  const rows = (source?.records || []).filter(row => dateInRange(row.date)).sort((a,b) => a.date.localeCompare(b.date));
  const known = rows.filter(row => row.rate !== null);
  const weightedRate = known.length ? known.reduce((sum,row) => sum + row.margin,0) / known.reduce((sum,row) => sum + row.netPrice,0) : null;
  const labelFor = row => 'Договор: ' + (row.number === 'б/н' ? row.number : '№ ' + row.number) + '\nЗаказчик: ' + row.customer + '\nДата договора: ' + row.date.split('-').reverse().join('.') + '\n' + row.label;
  const points = rows.map(row => [labelFor(row),row.price/1e6,row.date]);
  const secondary = rows.flatMap(row => row.rate === null ? [] : [[labelFor(row),row.rate*100,row.date]]);
  const legend = '<div class="av-chart-legend av-margin-legend">' +
    '<span><i aria-hidden="true"></i>Цена договора с НДС, млн ₽</span>' +
    '<span><i class="av-margin-dash" aria-hidden="true"></i>Маржинальность, %</span></div>';
  return card('sales','Стоимость и маржинальность договоров',
    'Взвешенная маржинальность — ' + (weightedRate === null ? 'НД' : fmt(weightedRate*100) + '%'),null,'sales',
    overviewChart('deal-margin',points,'Цена договора с НДС, млн ₽',fmt,secondary,
      {rightAxis:true,contractDatesAxis:true,showMissingMargins:true}) + legend,'','');
}

function balanceCard() {
  const points = seriesPoints('payables', cashUnit);
  const secondary = seriesPoints('receivables', cashUnit);
  const latest = points.at(-1);
  const receive = latest && secondary.find(point => point[2] === latest[2]);
  return summaryCard({id:'balances', icon:'wallet', label:'Кредиторская и дебиторская задолженность', route:'finance',
    unit:cashUnit, points, secondary, value:latest && receive ? fmt(latest[1]) + ' / ' + fmt(receive[1]) + ' ' + cashUnit : undefined,
    note:null, lineLabels:['кредиторская задолженность','дебиторская задолженность']});
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
    points, secondary,
    value:'Аттракционы — ' + (current.length ? fmt(current.at(-1)[1]) : 'НД') +
      ' · Смежные продукты — ' + (secondary.length ? fmt(secondary.at(-1)[1]) : 'НД'),
    note:null, lineLabels:['аттракционы','смежные продукты']});
}

function teamCard() {
  const planned = seriesPoints('planned', 'ставки');
  const occupied = seriesPoints('occupied', 'ставки');
  const history = seriesPoints('headcount', 'чел.');
  if (dateInRange('2024-01-01')) history.unshift(['Условный старт',0,'2024-01-01']);
  const latest = planned.at(-1);
  const actual = latest && occupied.find(point => point[2] === latest[2]);
  const first = actual && planned.find(point => point[2] < latest[2] && occupied.some(item => item[2] === point[2]));
  const firstActual = first && occupied.find(point => point[2] === first[2]);
  const change = firstActual ? [
    [latest[1] - first[1], 'штатных ставок', false],
    [actual[1] - firstActual[1], 'занятых ставок', true]
  ].map(([delta, label, colored]) => {
    const tone = colored && delta !== 0 ? ' av-kpi-delta-' + (delta > 0 ? 'good' : 'bad') : '';
    const value = (delta > 0 ? '+' : delta < 0 ? '−' : '') + fmt(Math.abs(delta));
    return '<span class="av-team-delta av-kpi-delta' + tone + '" title="' + safe(first[0] + ' → ' + latest[0]) + '">' +
      safe(value + ' ' + label) + '</span>';
  }).join('') : '';
  return summaryCard({id:'team-history', icon:'people', label:'Команда', route:'people', unit:'ставки',
    points:[...history,...planned], secondary:occupied, options:{branch:true}, change,
    lineLabels:['средняя численность за 2024–2025, с 16.10.2026 — всего ставок','занятые ставки'],
    value:actual ? fmt(latest[1]) + ' / ' + fmt(actual[1]) + ' ставки' : history.length ? fmt(history.at(-1)[1]) + ' чел.' : 'НД',
    note:null});
}

window.renderStaffingSnapshot = function () {
  const snapshots = window.AVERA_OVERVIEW_SERIES.staffingSnapshots || [];
  const latest = snapshots.at(-1);
  if (!latest) return '';
  const previous = snapshots.at(-2);
  const stamp = value => value.split('-').reverse().join('.');
  const signed = value => (value > 0 ? '+' : value < 0 ? '−' : '') + fmt(Math.abs(value));
  const delta = key => previous ? signed(latest[key] - previous[key]) + ' к ' + stamp(previous.date) : 'Первый срез';
  const money = value => Number.isFinite(value) ? fmt(value / 1000000) + ' млн ₽' : 'НД';
  const prior = new Map((previous?.departments || []).map(row => [row.name, row]));
  return panel('Штатная расстановка · ' + stamp(latest.date),
    summary([
      ['Всего ставок',fmt(latest.planned),delta('planned')],
      ['Занято ставок',fmt(latest.occupied),delta('occupied')],
      ['Свободно ставок',fmt(latest.vacant),delta('vacant')],
      ['Плановый ФОТ',money(latest.scheduledPayroll),previous ? signed((latest.scheduledPayroll - previous.scheduledPayroll) / 1000000) + ' млн ₽ к ' + stamp(previous.date) : 'Первый срез']
    ]) + '<p class="hint">Ставки учитывают доли занятости; это не число сотрудников. Плановый ФОТ — сумма из штатной расстановки, не фактические начисления. ФОТ занятых ставок: ' + money(latest.occupiedPayroll) + '; свободных: ' + money(latest.vacantPayroll) + '.</p>') +
    panel('История штатной расстановки',table(['Дата','Всего ставок','Занято','Свободно','Плановый ФОТ, млн ₽'],
      snapshots.map(row => [stamp(row.date),fmt(row.planned),fmt(row.occupied),fmt(row.vacant),fmt(row.scheduledPayroll / 1000000)]))) +
    panel('Занятость по подразделениям · ' + stamp(latest.date),table(['Подразделение','Всего ставок','Занято','Свободно','Изменение занятых к ' + (previous ? stamp(previous.date) : 'первому срезу')],
      latest.departments.map(row => [safe(row.name),fmt(row.planned),fmt(row.occupied),fmt(row.vacant),prior.has(row.name) ? signed(row.occupied - prior.get(row.name).occupied) : 'НД']))) +
    '<p class="hint">Источник: ' + safe(latest.source) + '. Итоги ставок и планового ФОТ сверены с итоговой строкой отчёта.</p>';
};

window.ownerOverview = function () {
  const {from, to} = overviewRange;
  const controls = '<div class="panel cmp-controls av-range-bar" aria-label="Единый период обзора"><div class="cmp-dates">' +
    [['from','От'],['to','До']].map(([key,label]) => {
      const value = overviewRange[key];
      const shortDate = value ? value.split('-').reverse().join('.') : 'дд.мм.гггг';
      return `<div class="cmp-date-field">
        <label for="av-overview-${key}">${label}</label>
        <button type="button" class="av-range-date" id="av-overview-${key}" data-overview-date="${key}" aria-haspopup="dialog" aria-label="${label} · ${safe(shortDate)}">
          ${safe(shortDate)}<svg aria-hidden="true" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5 1v4m6-4v4"/></svg>
        </button>
      </div>`;
    }).join('') + '</div><div class="av-range-presets" role="group" aria-label="Быстрый выбор периода">' +
    periods.map((p,i) => `<button type="button" data-period-index="${i}" aria-pressed="${from === p.from && to === p.to}">${p.label}</button>`).join('') +
    '</div></div>';
  if (!from || !to || from > to) return controls + '<p class="av-muted">Укажите корректный диапазон дат.</p>';
  const contracts = seriesPoints('contractDates', 'шт.');
  const statusVisible = dateInRange('2026-11-09');
  const sections = [
    ['Финансовый результат',[financeCard('revenue','Выручка','wallet'),financeCard('profit','Чистая прибыль','trend'),
      cashMovementCard()]],
    ['Продажи',[salesCard(contracts),statusCard('sales','На подписании',statusVisible ? '1 договор · 3 крупных продукта' : 'НД',
      statusVisible ? 'Оперативный срез на 09.11.2026 · сумма и дата подписания уточняются' : 'Нет среза в выбранном периоде','sales')]],
    ['Исполнение заказа',[window.renderOrderExecution(dateInRange)]],
    ['Маржа',[marginCard()]],
    ['Деньги и обязательства',[balanceCard(),loanCard()]],
    ['Продуктовый портфель',[productsCard()]],
    ['Команда',[teamCard()]]
  ];
  return controls + '<section class="av-grid av-owner-kpis" aria-label="Показатели компании">' +
    sections.map(([name, cards], i) => '<h2 class="av-overview-section">' + (i+1) + '. ' + safe(name) + '</h2>' + cards.join('')).join('') + '</section>';
};
$('#content').addEventListener('click', event => {
  const button = event.target.closest('[data-period-index]');
  if (!button || current !== 'overview') return;
  const preset = periods[Number(button.dataset.periodIndex)];
  overviewRange.from = preset.from;
  overviewRange.to = preset.to;
  render();
  $('#content').querySelector(`[data-period-index="${button.dataset.periodIndex}"]`).focus({preventScroll:true});
});

function openRangeCalendar(key) {
  const dialog = document.createElement('dialog');
  dialog.className = 'av-range-calendar';
  dialog.setAttribute('aria-labelledby','av-calendar-title');
  const label = key === 'from' ? 'Дата начала' : 'Дата окончания';
  const today = fullRange.to;
  let draft = overviewRange[key];
  let month = Number(draft.slice(5,7)) - 1;
  let year = Number(draft.slice(0,4));
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  dialog.innerHTML = `<h2 id="av-calendar-title">${label}</h2>
    <div class="av-calendar-nav">
      <button type="button" data-shift="-1" aria-label="Предыдущий месяц">‹</button>
      <select aria-label="Месяц">${months.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select>
      <input type="number" min="1000" max="9999" aria-label="Год">
      <button type="button" data-shift="1" aria-label="Следующий месяц">›</button>
    </div>
    <div class="av-calendar-grid av-weekdays" aria-hidden="true">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>'<span>'+d+'</span>').join('')}</div>
    <div class="av-calendar-grid av-days" role="group" aria-label="День месяца"></div>
    <div class="av-calendar-actions"><button type="button" data-today>Сегодня</button><button type="button" data-cancel>Отмена</button><button type="button" data-ok>ОК</button></div>`;
  document.body.append(dialog);
  const grid = dialog.querySelector('.av-days');
  const monthField = dialog.querySelector('select');
  const yearField = dialog.querySelector('input');
  function draw() {
    monthField.value = month;
    yearField.value = year;
    const offset = (new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
    const count = new Date(Date.UTC(year,month+1,0)).getUTCDate();
    grid.innerHTML = Array.from({length:count},(_,i)=>{
      const iso = new Date(Date.UTC(year,month,i+1)).toISOString().slice(0,10);
      const outOfRange = key === 'from' ? iso > overviewRange.to : iso < overviewRange.from;
      return `<button type="button" data-day="${iso}" aria-label="${iso.split('-').reverse().join('.')}" aria-pressed="${iso===draft}"
        ${outOfRange?'disabled':''} ${i===0?'style="grid-column-start:'+(offset+1)+'"':''}>${i+1}</button>`;
    }).join('');
    dialog.querySelector('[data-today]').disabled = key==='from' ? today>overviewRange.to : today<overviewRange.from;
    dialog.querySelector('[data-ok]').disabled = !draft;
  }
  function browse(nextYear,nextMonth) {
    if(nextYear<1000 || nextYear>9999) return;
    year=nextYear; month=nextMonth;
    if(!draft.startsWith(String(year)+'-'+String(month+1).padStart(2,'0')+'-')) draft='';
    draw();
  }
  monthField.onchange = ()=>browse(year,Number(monthField.value));
  yearField.oninput = ()=>{
    const value=yearField.valueAsNumber;
    if(Number.isInteger(value) && value>=1000 && value<=9999) browse(value,month);
    else { draft=''; dialog.querySelector('[data-ok]').disabled=true; }
  };
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button || button.disabled)return;
    if(button.hasAttribute('data-shift')){
      const next=new Date(Date.UTC(year,month+Number(button.dataset.shift),1));
      browse(next.getUTCFullYear(),next.getUTCMonth());
    }else if(button.dataset.day || button.hasAttribute('data-today')){
      draft=button.dataset.day || today;
      year=Number(draft.slice(0,4)); month=Number(draft.slice(5,7))-1;
      draw();
      grid.querySelector('[aria-pressed="true"]')?.focus();
    }else if(button.hasAttribute('data-ok') && draft){
      overviewRange[key]=draft;
      dialog.close(); render();
    }else if(button.hasAttribute('data-cancel'))dialog.close();
  });
  dialog.addEventListener('close',()=>{
    dialog.remove();
    document.getElementById('av-overview-'+key)?.focus({preventScroll:true});
  },{once:true});
  draw(); dialog.showModal();
  grid.querySelector('[aria-pressed="true"]')?.focus();
}

$('#content').addEventListener('click',event=>{
  const field=event.target.closest('[data-overview-date]');
  if(field && current==='overview')openRangeCalendar(field.dataset.overviewDate);
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
  if(current==='people'){
    $('#title').textContent='Люди и ФОТ';
    $('#subtitle').textContent='Штатная расстановка и ретроспектива кадровых событий';
    const latest = window.AVERA_OVERVIEW_SERIES.staffingSnapshots?.at(-1);
    if(latest) document.querySelector('.asof').innerHTML='<strong>Штат · ' + safe(latest.date.split('-').reverse().join('.')) + '</strong><span>Кадровые события · по 02.11.2026</span>';
  }
  if(current==='overview'){
    $('#title').textContent='Сводка по компании';
    $('#subtitle').textContent='';
    document.querySelector('main > .notice').textContent='';
    document.querySelector('.asof').replaceChildren();
    spaceOverviewLabels();
  }
};render();
})();

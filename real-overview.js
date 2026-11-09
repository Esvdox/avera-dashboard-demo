'use strict';
// Фактические данные. Публикация разрешена Сергеем 02.11.2026.
(()=>{
function card(icon, label, value, note, route, chart, change, controls) {
  return `<article class="av-metric">
    <a class="av-label av-kpi-link" href="#${route}">${window.avIcon(icon)}${safe(label)}</a>
    <div class="av-number av-kpi-values"><span>${safe(value)}</span>${change}</div><div class="av-muted">${safe(note)}</div>
    ${controls}<div class="av-kpi-chart">${chart}</div>
  </article>`;
}

const overviewRange = {from: '2024-01-01', to: new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow'}).format(new Date())};
const arrivalDate = Date.parse('2026-10-26');
const arrivalLabel = 'Начало периода управления · 26.10.2026';
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

function overviewChart(id, points, unit, format = fmt, secondary = []) {
  if (!points.length) return missing;
  const start = Date.parse(overviewRange.from), end = Date.parse(overviewRange.to);
  const width = $('#content').clientWidth - 34;
  const left = 56, right = width - 26;
  const x = day => end === start ? (left + right) / 2 : left + 28 + (right - left - 56) * (day - start) / (end - start);
  const ticksX = overviewTimeTicks(start,end,Math.max(2,Math.floor((right-left)/85)));
  const values = [...points, ...secondary].map(([, value]) => value);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = maximum - minimum || 1;
  const step = 10 ** Math.floor(Math.log10(span / 4));
  const tickStep = Math.ceil(span / (4 * step)) * step;
  const low = Math.floor(minimum / tickStep) * tickStep;
  const high = Math.max(tickStep, Math.ceil(maximum / tickStep) * tickStep);
  const y = value => 28 + (high - value) / (high - low) * 148;
  const zero = y(0);
  const color = value => value < 0 ? 'var(--av-profit-loss)' : 'var(--accent)';
  const marks = points.map(([label, value, day, partial]) => ({
    label, value, partial, x: x(Date.parse(day)), y: y(value)
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
  let curve = first ? 'M' + first.x + ' ' + first.y : '';
  curveMarks.slice(1).forEach((mark, i) => {
    const previous = curveMarks[i];
    const third = (mark.x - previous.x) / 3;
    curve += ` C${previous.x + third} ${previous.y} ${mark.x - third} ${mark.y} ${mark.x} ${mark.y}`;
  });
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
  const showArrival = start <= arrivalDate && arrivalDate <= end;
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
    const marker = arrivalY === undefined ? `M${arrivalX} 28V176` : `M${arrivalX} ${zero}V${arrivalY}`;
    const dash = arrivalY === undefined ? ' stroke-dasharray="3 4"' : '';
    management += `<path class="av-management-marker" d="${marker}" fill="none" stroke="var(--av-management)" stroke-width="1.5" vector-effect="non-scaling-stroke"${dash}><title>${arrivalLabel}</title></path>`;
  }
  const staffLine = secondary.length ? '<polyline fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" points="' +
    secondary.map(([, value, day]) => x(Date.parse(day)) + ',' + y(value)).join(' ') + '"/>' +
    secondary.map(([label, value, day]) => '<circle r="3" fill="var(--muted)" cx="' + x(Date.parse(day)) + '" cy="' + y(value) + '"><title>' + safe(label + ': ' + format(value)) + '</title></circle>').join('') : '';
  return '<svg class="av-profit-chart" viewBox="0 0 ' + width + ' 202" role="img" aria-label="' +
    safe(unit + '. ' + marks.map(mark => mark.label + ': ' + format(mark.value)).join('. ') + (showArrival ? '. ' + arrivalLabel : '')) + '">' +
    ticks.map(value => '<path d="M' + left + ' ' + y(value) + 'H' + right + '" class="av-kpi-gridline"/><text class="' + (Math.abs(Math.round(value/tickStep))%2 ? 'av-kpi-minor-tick' : '') + '" x="42" y="' +
      (y(value) + 4) + '" text-anchor="end">' + safe(fmt(value)) + '</text>').join('') + traces + management + staffLine +
    '<path d="M' + left + ' 28V176 M' + left + ' ' + zero + 'H' + right + '" class="av-profit-axis"/>' +
    marks.map((mark, i) => '<circle cx="' + mark.x + '" cy="' + mark.y + '" r="3" stroke="' + color(mark.value) + '" fill="' + (i===0 && marks.length>1 ? 'var(--surface)' : color(mark.value)) +
      '"><title>' + safe(mark.label + ': ' + format(mark.value)) + '</title></circle>' + (marks.length > 8 && i > 0 && i < marks.length - 1 ? '' : '<text class="av-kpi-point-label" x="' + mark.x + '" y="' + mark.labelY + '" fill="' + color(mark.value) + '" text-anchor="middle">' +
      safe(format(mark.value)) + '</text>')).join('') +
    ticksX.map(tick=>'<text x="'+x(tick.date)+'" y="194" text-anchor="middle">'+safe(tick.label)+'</text>').join('') +
    '</svg>';
}

const selectedSeries = Object.create(null);
const cashUnit = 'млн ₽';
const groups = [
  {id:'revenue', icon:'wallet', name:'Выручка', route:'finance', options:[
    ['revenue','9 месяцев',cashUnit,'nine'], ['revenue','Полный год',cashUnit,'annual']]},
  {id:'profit', icon:'trend', name:'Чистая прибыль', route:'finance', options:[
    ['profit','9 месяцев',cashUnit,'nine'], ['profit','Полный год',cashUnit,'annual']]},
  {id:'margin', icon:'sales', name:'Средняя рентабельность сделок', route:'sales', options:[
    ['margin','Средняя по позициям','%'], ['weightedMargin','Взвешенная по цене','%']]},
  {id:'payables', icon:'wallet', name:'Кредиторская задолженность', route:'finance', direction:-1, options:[
    ['payables','Остаток на дату',cashUnit]]},
  {id:'loans', icon:'wallet', name:'Займы', route:'finance', direction:-1, options:[
    ['loans','Остаток на дату',cashUnit], ['loansReceived','Получено за месяц',cashUnit], ['loansRepaid','Погашено за месяц',cashUnit]]},
  {id:'contracts', icon:'sales', name:'Сделки и стоимость', route:'sales', options:[
    ['contracts','Число договоров','шт.'], ['contractPrices','Полная цена по месяцам',cashUnit],
    ['contractAnalysis','Стоимость по анализу',cashUnit], ['salesByContract','Оборот «Продано»',cashUnit]]},
  {id:'products', icon:'products', name:'Продукты', route:'products', options:[
    ['attractions','Аттракционы','SKU'], ['otherProducts','Неаттракционы','SKU']]},
  {id:'team', icon:'people', name:'Команда', route:'people', options:[
    ['planned','Ставки: всего и занято','ставки'], ['turnover','Текучесть','%']]},
];
const notes = {
  margin:'Простое среднее по позициям с рассчитанной рентабельностью',
  weightedMargin:'Прибыль / суммарная цена без НДС',
  contracts:'По датам подписания в выгрузке покупателей',
  contractPrices:'НД · полная цена не подтверждена по всем договорам',
  contractAnalysis:'Срез анализа, цена с НДС',
  salesByContract:'Оборот по договорам месяца за весь период выгрузки',
  attractions:'Номенклатура по срезу КБ',
  otherProducts:'НД · нет подтверждённого перечня',
  loansReceived:'ДДС, поступление за месяц',
  loansRepaid:'ДДС, погашение за месяц',
  planned:'Сплошная линия — всего, пунктир — занято',
  turnover:'Январь–ноябрь 2026 отмечен отдельной точкой',
};
const noDelta = new Set(['contracts','contractPrices','contractAnalysis','salesByContract','loansReceived','loansRepaid','turnover']);

function seriesPoints(key, unit, basis) {
  const scale = unit === cashUnit ? 1 / 1e6 : unit === '%' ? 100 : 1;
  return (window.AVERA_OVERVIEW_SERIES[key] || [])
    .filter(([day, , , kind]) => day >= overviewRange.from && day <= overviewRange.to && (!basis || basis === kind))
    .map(([day, value, label, , partial]) => [label, value * scale, day, partial]);
}

function overviewCard(group) {
  const index = Number(selectedSeries[group.id] || 0);
  const [key, label, unit, basis] = group.options[index];
  const points = seriesPoints(key, unit, basis);
  const secondary = key === 'planned' ? seriesPoints('occupied', unit) : [];
  const latest = points.at(-1);
  const value = key === 'contracts' || key === 'salesByContract'
    ? points.reduce((total, point) => total + point[1], 0) : latest?.[1];
  const displayed = secondary.length && latest
    ? fmt(latest[1]) + ' / ' + fmt(secondary.at(-1)[1]) + ' ставки'
    : latest ? fmt(value) + ' ' + unit : 'НД';
  const period = points.length > 1 ? points[0][0] + ' → ' + latest[0] : latest?.[0];
  const note = [period, notes[key]].filter(Boolean).join(' · ') || 'Нет среза в выбранном периоде';
  const diff = points.length > 1 && !noDelta.has(key) ? latest[1] - points[0][1] : null;
  const direction = group.direction ?? (key === 'planned' ? 0 : 1);
  const tone = !diff || !direction ? 'neutral' : diff * direction > 0 ? 'good' : 'bad';
  const delta = diff === null ? '' : '<span class="av-kpi-delta av-kpi-delta-' + tone + '">' +
    safe((diff > 0 ? '+' : '') + fmt(diff) + ' ' + (unit === '%' ? 'п.п.' : unit)) + '</span>';
  const controls = group.options.length < 2 ? '' : '<select class="av-overview-series" aria-label="' +
    safe(group.name + ': ряд') + '" data-overview-series="' + group.id + '">' +
    group.options.map((option, i) => '<option value="' + i + '"' + (i === index ? ' selected' : '') + '>' +
      safe(option[1]) + '</option>').join('') + '</select>';
  const chart = overviewChart(group.id, points, label + ', ' + unit, fmt, secondary);
  return card(group.icon, group.name, displayed, note, group.route, chart, delta, controls);
}

window.ownerOverview = function () {
  const {from, to} = overviewRange;
  const controls = '<div class="panel cmp-controls" aria-label="Единый период обзора"><div class="cmp-dates">' +
    [['from','От'],['to','До']].map(([key,label])=>'<div class="cmp-date-field"><label for="av-overview-'+key+'">'+label+
      '</label><input type="date" id="av-overview-'+key+'" data-overview-date="'+key+'" value="'+safe(overviewRange[key])+'"></div>').join('') +
    '</div>' + (from && to && from<=to ? '' : '<p class="av-muted">Укажите корректный диапазон дат.</p>') + '</div>';
  return controls + '<section class="av-grid av-owner-kpis" aria-label="Показатели компании">' +
    groups.map(overviewCard).join('') + '</section>';
};
$('#content').addEventListener('change', event=>{
  const seriesKey = event.target.dataset.overviewSeries;
  if (seriesKey && current === 'overview') {
    selectedSeries[seriesKey] = event.target.value;
    render();
    $(`[data-overview-series="${seriesKey}"]`)?.focus();
    return;
  }
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
    $('#subtitle').textContent='';
    document.querySelector('main > .notice').textContent='';
    document.querySelector('.asof').textContent='Даты срезов указаны в карточках';
  }
};render();
})();

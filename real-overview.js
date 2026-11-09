'use strict';
// Фактические данные. Публикация разрешена Сергеем 02.11.2026.
(()=>{
const money=v=>window.AVERA_METRICS.million(v);
function card(icon, label, value, note, route, chart, change = '') {
  return `<a class="av-metric" href="#${route}">
    <div class="av-label">${window.avIcon(icon)}${safe(label)}</div>
    <div class="av-number av-kpi-values"><span>${safe(value)}</span>${change}</div><div class="av-muted">${safe(note)}</div>
    <div class="av-kpi-chart">${chart}</div>
  </a>`;
}

const overviewRange = {from: '2024-01-01', to: new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Moscow'}).format(new Date())};
const missing = '<p class="av-muted">Нет данных за выбранный период</p>';

window.avTimeTicks = function (start, end, count) {
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
};

function overviewChart(id, points, unit, format = fmt, ceiling = 0) {
  if (!points.length) return missing;
  const start = Date.parse(overviewRange.from), end = Date.parse(overviewRange.to);
  const width = Math.max(240, $('#content').clientWidth - 34);
  const left = 56, right = width - 26;
  const x = day => end === start ? (left + right) / 2 : left + 28 + (right - left - 56) * (day - start) / (end - start);
  const ticksX = window.avTimeTicks(start,end,Math.max(2,Math.floor((right-left)/85)));
  const values = points.map(([, value]) => value);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(ceiling, 0, ...values);
  const span = maximum - minimum || 1;
  const step = 10 ** Math.floor(Math.log10(span / 4));
  const tickStep = Math.ceil(span / (4 * step)) * step;
  const low = Math.floor(minimum / tickStep) * tickStep;
  const high = Math.max(tickStep, Math.ceil(maximum / tickStep) * tickStep);
  const y = value => 28 + (high - value) / (high - low) * 148;
  const zero = y(0);
  const color = value => value < 0 ? 'var(--av-profit-loss)' : 'var(--accent)';
  const marks = points.map(([label, value, day]) => ({
    label, value, x: x(Date.parse(day)), y: y(value)
  }));
  const first = marks[0];
  const last = marks.at(-1);
  let curve = 'M' + first.x + ' ' + first.y;
  marks.slice(1).forEach((mark, i) => {
    const previous = marks[i];
    const middle = (previous.x + mark.x) / 2;
    curve += ' C' + middle + ' ' + previous.y + ' ' + middle + ' ' + mark.y + ' ' + mark.x + ' ' + mark.y;
  });
  const area = curve + ' V' + zero + ' H' + first.x + ' Z';
  const ticks = Array.from({length: Math.round((high - low) / tickStep) + 1}, (_, i) => (low + i * tickStep));
  const clip = side => 'av-kpi-' + id + '-' + side;
  const traces = marks.length < 2 || id === 'staffing' ? '' : ['up', 'down'].map((side, i) => {
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
  return '<svg class="av-profit-chart" viewBox="0 0 ' + width + ' 202" role="img" aria-label="' +
    safe(unit + '. ' + marks.map(mark => mark.label + ': ' + format(mark.value)).join('. ')) + '">' +
    ticks.map(value => '<path d="M' + left + ' ' + y(value) + 'H' + right + '" class="av-kpi-gridline"/><text class="' + (Math.abs(Math.round(value/tickStep))%2 ? 'av-kpi-minor-tick' : '') + '" x="42" y="' +
      (y(value) + 4) + '" text-anchor="end">' + safe(fmt(value)) + '</text>').join('') + traces +
    '<path d="M' + left + ' 28V176 M' + left + ' ' + zero + 'H' + right + '" class="av-profit-axis"/>' +
    marks.map((mark, i) => '<circle cx="' + mark.x + '" cy="' + mark.y + '" r="3" stroke="' + color(mark.value) + '" fill="' + (i===0 && marks.length>1 ? 'var(--surface)' : color(mark.value)) +
      '"/><text x="' + mark.x + '" y="' + (i % 2 && mark.x - marks[i-1].x < 90 ? mark.y + 22 : mark.y - 16) + '" fill="' + color(mark.value) + '" text-anchor="middle">' +
      safe(format(mark.value)) + '</text>').join('') +
    ticksX.map(tick=>'<text x="'+x(tick.date)+'" y="194" text-anchor="middle">'+safe(tick.label)+'</text>').join('') +
    '</svg>';
}

window.ownerOverview = function () {
  const {from, to} = overviewRange;
  const inRange = day => Boolean(from && to && day && day >= from && day <= to);
  const staffingHistory = window.AVERA_METRICS.staffing(from,to);
  const staffing = staffingHistory.at(-1);
  const staffingNumber = value => Number.isFinite(value) ? fmt(value) : 'НД';
  const kdDate = window.AVERA_KD?.asOf;
  const products = inRange(date(kdDate)) && typeof window.AVERA_METRICS.products === 'function' ? window.AVERA_METRICS.products() : null;
  const finance = window.AVERA_ACCOUNTING;
  const read = window.AVERA_METRICS.value;
  const points = (dates, labels, rows, code) => dates.flatMap((day,i)=>{
    const value = read(rows,code,i+2);
    return inRange(day) && Number.isFinite(value) ? [[labels[i],value,day]] : [];
  });
  const nineMonths = code => points(['2025-09-30','2026-09-30'],['9 мес. 2025','9 мес. 2026'],finance.incomeNine,code);
  const revenue = nineMonths('2110');
  const profit = nineMonths('2400');
  const debt = window.AVERA_METRICS.balanceSeries('1520').filter(r=>inRange(r.date)&&Number.isFinite(r.value)).map(r=>[r.date.split('-').reverse().join('.')+(r.date==='2024-12-31'?'²':''),r.value,r.date]);
  const changeLabel = (series, direction, format, unit, context = '') => {
    if (series.length < 2) return '';
    const delta = series.at(-1)[1] - series[0][1];
    const tone = delta === 0 || direction === 0 ? 'neutral' : delta * direction > 0 ? 'good' : 'bad';
    return '<span class="av-kpi-delta av-kpi-delta-' + tone + '" title="Изменение за выбранный период">' +
      safe((delta > 0 ? '+' : '') + format(delta) + ' ' + unit + context) + '</span>';
  };
  const financeCard = (icon,label,series,chart,direction,context) => card(icon,label,series.length ? money(series.at(-1)[1])+' млн ₽':'НД',
    series.length ? series.map(([period])=>period).join(' → ')+' · млн ₽' : 'Нет среза в выбранном периоде','finance',chart,
    changeLabel(series,direction,money,'млн ₽',context));
  const staffingSeries = staffingHistory.filter(row=>Number.isFinite(row.occupied)).map(row=>[row.date.split('-').reverse().join('.'),row.occupied,row.date]);
  const financialChart = (id, series) => overviewChart(id, series.map(([label, value, day]) => [label, value / 1000, day]), 'млн ₽', value => money(value * 1000));
  const controls = '<div class="panel cmp-controls" aria-label="Единый период обзора"><div class="cmp-dates">' +
    [['from','От'],['to','До']].map(([key,label])=>'<div class="cmp-date-field"><label for="av-overview-'+key+'">'+label+
      '</label><input type="date" id="av-overview-'+key+'" data-overview-date="'+key+'" value="'+safe(overviewRange[key])+'"></div>').join('') +
    '</div>' + (from && to && from<=to ? '' : '<p class="av-muted">Укажите корректный диапазон дат.</p>') + '</div>';
  return controls + '<section class="av-grid av-owner-kpis" aria-label="Показатели компании">' + [
    financeCard('wallet','Выручка',revenue,financialChart('revenue',revenue),1),
    financeCard('trend','Чистая прибыль',profit,financialChart('profit',profit),1,profit.length > 1 && profit[0][1]<0 && profit.at(-1)[1]>0 ? ' · выход в прибыль' : ''),
    card('sales','Средняя маржинальность сделок','НД','Нет подтверждённого среза CRM','sales',missing),
    financeCard('wallet','Кредиторская задолженность',debt,financialChart('debt',debt)+(debt.some(r=>r[2]==='2024-12-31')?'<p class="av-muted">² 2024: сравнительная колонка поздней отчётности. Исходная версия отличается; см. «Финансы».</p>':''),-1),
    card('people','Штатные ставки',staffing?staffingNumber(staffing.planned)+' / '+staffingNumber(staffing.occupied):'НД',
      'План / занято'+(staffing?' · вакантно '+staffingNumber(staffing.vacant)+' · '+staffing.date.split('-').reverse().join('.') : ' · нет среза в периоде'),'people',
      overviewChart('staffing',staffingSeries,'Занятые ставки',fmt,Math.max(0,...staffingHistory.map(row=>row.planned))),changeLabel(staffingSeries,0,fmt,'занятых ставок')),
    card('products','Готовность КД',products?products.complete+' из '+products.count+' SKU':'НД',
      products?'КД на 100% · '+kdDate:'Нет среза в выбранном периоде','products',
      products && products.count ? overviewChart('kd',[[kdDate,products.complete/products.count*100,date(kdDate)]],'Доля SKU с КД на 100%', value => fmt(value)+'%',100) : missing)
  ].join('') + '</section>';
};
$('#content').addEventListener('change', event=>{
  const key = event.target.dataset.overviewDate;
  if (!key || current !== 'overview') return;
  overviewRange[key] = event.target.value;
  render();
  $('#av-overview-'+key).focus();
});
function date(v){const m=String(v||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;}
window.renderRealProduction=function(){const d=window.AVERA_PRODUCTION_SNAPSHOT,s=window.AVERA_METRICS.production();const risky=s.risky;return summary([['Именованных строк',s.named,'Весь прочитанный лист; разный тип записей'],['Отмечено выполненными',s.completed,'По отметке F; без подтверждения приёмки'],['Прошёл плановый срок',s.openPastPlan,'Без отметки завершения'],['Нет плановой даты',s.openMissingPlanDate,'Среди открытых записей']])+panel('Записи с прошедшим плановым сроком',table(['Строка','Наименование','План','Отметка КД','Исполнитель'],risky.map(r=>[`<a href="https://docs.google.com/spreadsheets/d/${d.spreadsheetId}/edit#gid=142048530&range=A${r.row}:L${r.row}" target="_blank" rel="noopener noreferrer">${r.row}</a>`,safe(r.name),safe(r.end),safe(r.kd||'Не заполнено'),safe(r.executor||'Не заполнено')]))+'<p class="hint">Это календарный контроль исходного графика. Перенос срока, причина и нарушение договорной поставки отдельно не подтверждены.</p>')+panel('Противоречия факта',table(['Строка','Наименование','Фактическая дата'],s.actualWithNotDone.map(r=>[r.row,safe(r.name),safe(r.actual)])))+panel('Охват и ограничения',`<p>Прочитан диапазон A1:L1667 листа «${safe(d.sheet)}» 02.11.2026. ${s.named} именованных строк, ${s.completed} с отметкой TRUE, ${s.open} без неё. В листе смешаны операции, закупки, сводные и другие записи. Номер строки — адрес источника, а не постоянный ID. Выпуск, загрузка мощностей и процент физической готовности не рассчитаны.</p><p class="hint">Сводный лист использует иной отбор: 432 задачи и 72 выполненные. Эти итоги не заменяют полный прочитанный лист без объяснения отбора.</p>`);};
renderers.production=window.renderRealProduction;
renderers.sales=()=>panel('Продажи · нет подтверждённого актуального среза','<p>НД. Битрикс24 не подключён к регулярной загрузке. Демо-сделки и демосуммы скрыты в реальной версии.</p><p class="hint">Нужен полный разрешённый срез воронок с ID сделок, стадиями, валютой, ответственными и датой извлечения. Договоры, оплаты и выручка требуют собственных оснований.</p>');
renderers.products=()=>panel('Продукты и КБ · нет подтверждённого реестра','<p>НД. Реестр моделей, инициатив, ревизий и разрешений не подключён. Цель 20 SKU относится к аттракционам; фактический состав и процент достижения не подтверждены.</p><p class="hint">Отметки КД в производственном графике не подтверждают готовность полного комплекта модели.</p>');
function labels(){document.querySelector("main").classList.toggle("av-overview-type",current==="overview");const message={overview:'Фактические источники с отдельными датами. Автоматическое получение новых данных не настроено.',finance:'Фактическая бухгалтерская отчётность. Загрузка PDF вручную; карточки и таблицы используют один набор. Прямого подключения к 1С нет.',assets:'Фактическая ведомость ОС. Итоги пересчитываются из строк, расхождения со строкой «Итого» источника показаны отдельно. Автоимпорта нет.',people:'Фактические снимки кадровых отчётов 1С. События, текучесть и средняя численность — отдельные показатели. Автоимпорта нет.',production:'Сохранённый срез «Гант Завод». Показатели рассчитаны из записей; регулярное чтение источника пока не настроено.',sales:'Актуальный срез Битрикс24 не загружен. Демонстрационные суммы в реальной версии скрыты.',products:'Подтверждённый реестр продуктов и КД не загружен. Демонстрационные статусы и количества скрыты.'};document.querySelector('main > .notice').textContent=message[current]||'Нет данных';if(['overview','production'].includes(current))document.querySelector('.asof').innerHTML='<strong>Даты срезов различаются</strong><span>Периоды указаны у каждого показателя</span>';if(['sales','products'].includes(current))document.querySelector('.asof').innerHTML='<strong>Нет подтверждённого среза</strong><span>НД — не ноль</span>';if(current==='production'){$('#subtitle').textContent='Фактический срез «Гант Завод» · календарные сигналы и качество данных';}}
window.applyActualLabels=function(){
  labels();
  if(current==='overview'){
    $('#subtitle').textContent='';
    document.querySelector('main > .notice').textContent='';
    document.querySelector('.asof span')?.remove();
  }
};render();
})();


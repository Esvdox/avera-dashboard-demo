'use strict';
// Фактические данные. Публикация разрешена Сергеем 02.11.2026.
(()=>{
const money=v=>window.AVERA_METRICS.million(v);
function card(icon, label, value, note, route, chart) {
  return `<a class="av-metric" href="#${route}">
    <div class="av-label">${window.avIcon(icon)}${safe(label)}</div>
    <div class="av-number">${safe(value)}</div><div class="av-muted">${safe(note)}</div>
    <div class="av-kpi-chart">${chart}</div>
  </a>`;
}

function reportBars(points) {
  const values = points.filter(([, value]) => Number.isFinite(value));
  if (!values.length) return '<p class="av-muted">Нет отчётных значений</p>';
  const min = Math.min(0, ...values.map(([, value]) => value));
  const max = Math.max(0, ...values.map(([, value]) => value));
  const scale = max - min || 1;
  const zero = -min / scale * 100;
  return `<ul class="av-kpi-bars">${values.map(([label, value]) => {
    const left = (Math.min(0, value) - min) / scale * 100;
    return `<li><span>${safe(label)}</span><div class="av-kpi-track" aria-hidden="true">
      <i class="${value < 0 ? 'av-kpi-negative' : ''}" style="left:${left}%;width:${Math.abs(value) / scale * 100}%"></i>
      ${min < 0 && max > 0 ? `<b style="left:${zero}%"></b>` : ''}
      </div><strong>${safe(money(value))}</strong></li>`;
  }).join('')}</ul>`;
}

function shareBar(value, total, label) {
  if (!total) return '<p class="av-muted">Нет данных для расчёта доли</p>';
  return `<progress class="av-kpi-progress" value="${value}" max="${total}" aria-label="${safe(label)}"></progress>
    <p class="av-muted">${safe(label)} · ${fmt(value / total * 100)}%</p>`;
}
function result(code){return window.AVERA_METRICS.value(window.AVERA_ACCOUNTING.incomeNine,code,3);}
function balance(code){return window.AVERA_METRICS.value(window.AVERA_ACCOUNTING.balance,code,4);}
window.ownerOverview = function () {
  const staffing = window.AVERA_STAFFING;
  const products = window.AVERA_METRICS.products();
  const finance = window.AVERA_ACCOUNTING;
  const read = window.AVERA_METRICS.value;
  const nineMonths = code => reportBars([['9 мес. 2025', read(finance.incomeNine, code, 2)], ['9 мес. 2026', result(code)]]);
  return '<section class="av-grid av-owner-kpis" aria-label="Показатели компании">' + [
    card('wallet', 'Выручка', money(result('2110')) + ' млн ₽', '9 месяцев 2026', 'finance', nineMonths('2110')),
    card('trend', 'Чистая прибыль', money(result('2400')) + ' млн ₽', '9 месяцев 2026', 'finance', nineMonths('2400')),
    card('sales', 'Средняя маржинальность сделок', 'НД', 'Нет подтверждённого среза CRM', 'sales',
      '<p class="av-muted">Для графика нужны данные о выручке и марже по сделкам.</p>'),
    card('wallet', 'Кредиторская задолженность', money(balance('1520')) + ' млн ₽', 'На 30.09.2026', 'finance',
      reportBars(['31.12.2024', '31.12.2025', '30.09.2026'].map((label, i) => [label, read(finance.balance, '1520', i + 2)]))),
    card('people', 'Численность сотрудников', staffing ? fmt(staffing.planned) + ' / ' + fmt(staffing.planned - staffing.vacant) : 'НД',
      'Ставок всего / занято' + (staffing ? ' · ' + staffing.asOf : ''), 'people',
      staffing ? shareBar(staffing.planned - staffing.vacant, staffing.planned, 'Доля занятых ставок') :
        '<p class="av-muted">Данные ШР доступны во внутренней версии.</p>'),
    card('products', 'Готовность КД', products.complete + ' из ' + products.count + ' SKU', 'КД на 100% · ' + window.AVERA_KD.asOf, 'products',
      shareBar(products.complete, products.count, 'Доля SKU с КД на 100%'))
  ].join('') + '</section>';
};
function date(v){const m=String(v||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;}
window.renderRealProduction=function(){const d=window.AVERA_PRODUCTION_SNAPSHOT,s=window.AVERA_METRICS.production();const risky=s.risky;return summary([['Именованных строк',s.named,'Весь прочитанный лист; разный тип записей'],['Отмечено выполненными',s.completed,'По отметке F; без подтверждения приёмки'],['Прошёл плановый срок',s.openPastPlan,'Без отметки завершения'],['Нет плановой даты',s.openMissingPlanDate,'Среди открытых записей']])+panel('Записи с прошедшим плановым сроком',table(['Строка','Наименование','План','Отметка КД','Исполнитель'],risky.map(r=>[`<a href="https://docs.google.com/spreadsheets/d/${d.spreadsheetId}/edit#gid=142048530&range=A${r.row}:L${r.row}" target="_blank" rel="noopener noreferrer">${r.row}</a>`,safe(r.name),safe(r.end),safe(r.kd||'Не заполнено'),safe(r.executor||'Не заполнено')]))+'<p class="hint">Это календарный контроль исходного графика. Перенос срока, причина и нарушение договорной поставки отдельно не подтверждены.</p>')+panel('Противоречия факта',table(['Строка','Наименование','Фактическая дата'],s.actualWithNotDone.map(r=>[r.row,safe(r.name),safe(r.actual)])))+panel('Охват и ограничения',`<p>Прочитан диапазон A1:L1667 листа «${safe(d.sheet)}» 02.11.2026. ${s.named} именованных строк, ${s.completed} с отметкой TRUE, ${s.open} без неё. В листе смешаны операции, закупки, сводные и другие записи. Номер строки — адрес источника, а не постоянный ID. Выпуск, загрузка мощностей и процент физической готовности не рассчитаны.</p><p class="hint">Сводный лист использует иной отбор: 432 задачи и 72 выполненные. Эти итоги не заменяют полный прочитанный лист без объяснения отбора.</p>`);};
renderers.production=window.renderRealProduction;
renderers.sales=()=>panel('Продажи · нет подтверждённого актуального среза','<p>НД. Битрикс24 не подключён к регулярной загрузке. Демо-сделки и демосуммы скрыты в реальной версии.</p><p class="hint">Нужен полный разрешённый срез воронок с ID сделок, стадиями, валютой, ответственными и датой извлечения. Договоры, оплаты и выручка требуют собственных оснований.</p>');
renderers.products=()=>panel('Продукты и КБ · нет подтверждённого реестра','<p>НД. Реестр моделей, инициатив, ревизий и разрешений не подключён. Цель 20 SKU относится к аттракционам; фактический состав и процент достижения не подтверждены.</p><p class="hint">Отметки КД в производственном графике не подтверждают готовность полного комплекта модели.</p>');
function labels(){const message={overview:'Фактические источники с отдельными датами. Автоматическое получение новых данных не настроено.',finance:'Фактическая бухгалтерская отчётность. Загрузка PDF вручную; карточки и таблицы используют один набор. Прямого подключения к 1С нет.',assets:'Фактическая ведомость ОС. Итоги пересчитываются из строк, расхождения со строкой «Итого» источника показаны отдельно. Автоимпорта нет.',people:'Фактические снимки кадровых отчётов 1С. События, текучесть и средняя численность — отдельные показатели. Автоимпорта нет.',production:'Сохранённый срез «Гант Завод». Показатели рассчитаны из записей; регулярное чтение источника пока не настроено.',sales:'Актуальный срез Битрикс24 не загружен. Демонстрационные суммы в реальной версии скрыты.',products:'Подтверждённый реестр продуктов и КД не загружен. Демонстрационные статусы и количества скрыты.'};document.querySelector('main > .notice').textContent=message[current]||'Нет данных';if(['overview','production'].includes(current))document.querySelector('.asof').innerHTML='<strong>2 ноября 2026</strong><span>Периоды указаны у каждого показателя</span>';if(['sales','products'].includes(current))document.querySelector('.asof').innerHTML='<strong>Нет подтверждённого среза</strong><span>НД — не ноль</span>';if(current==='production'){$('#subtitle').textContent='Фактический срез «Гант Завод» · календарные сигналы и качество данных';}}
window.applyActualLabels=labels;render();
})();

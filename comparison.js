'use strict';

tabs.splice(1, 0, ['comparison', 'Сравнение', 'Сравнение с исходным состоянием', 'История до ноября 2026 года и результаты с 1 ноября.']);
window.avNavIcons.comparison = 'trend';

let comparisonView = 'table';
let comparisonMetric = 'revenue';

function comparisonChart(metrics, accounting, baseline) {
  const nineMonths = code => [2, 3].map((column, index) => ({
    date: `${2025 + index}-09-30`, value: metrics.value(accounting.incomeNine, code, column)
  })).filter(point => Number.isFinite(point.value)).map(point => ({...point, value: point.value / 1000}));
  const turnover = window.AVERA_HR_TURNOVER.rows.slice(0, 2).map(row => ({date: row[0].slice(0, 4) + '-12-31', value: row[1]}));
  const series = {
    revenue: ['Выручка', 'млн ₽', nineMonths('2110'), 'Сопоставимые суммы за январь–сентябрь каждого года.'],
    people: ['Текучесть', '%', turnover, 'Годовые показатели 1С за 2024 и 2025 годы.'],
    rides: ['SKU аттракционов', 'SKU', [{date: baseline.asOf.split('.').reverse().join('-'), value: baseline.items.length}], 'Подтверждённый стартовый срез.'],
    other: ['SKU прочих продуктов', 'SKU', [], 'Подтверждённых срезов пока нет.'],
    deals: ['Подписанные сделки', 'шт.', [], 'Подтверждённых срезов пока нет.'],
    margin: ['Маржинальность сделок', '%', [], 'Подтверждённых срезов пока нет.']
  };
  const [name, unit, points, description] = series[comparisonMetric];
  const start = Date.parse('2024-01-01');
  const arrival = Date.parse('2026-11-01');
  const todayDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const today = Date.parse(todayDate);
  const end = Math.max(today, arrival, ...points.map(point => Date.parse(point.date)));
  const x = date => 57 + (date - start) / (end - start) * 535;
  const max = Math.max(1, ...points.map(point => point.value)) * 1.2;
  const y = value => 185 - value / max * 145;
  const dots = points.map(point => `<circle cx="${x(Date.parse(point.date))}" cy="${y(point.value)}" r="5" fill="var(--accent)"><title>${safe(point.date)} · ${fmt(point.value)} ${unit}</title></circle>`).join('');
  const trace = points.length > 1 ? `<polyline points="${points.map(point => `${x(Date.parse(point.date))},${y(point.value)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4"/>` : '';
  return panel('Динамика', `<label for="comparison-metric">Показатель</label> <select id="comparison-metric">${Object.entries(series).map(([id, data]) => `<option value="${id}"${id === comparisonMetric ? ' selected' : ''}>${data[0]}</option>`).join('')}</select>
    <p class="hint">${description}</p><svg viewBox="0 0 620 218" role="img" aria-label="${name}. Дата прихода 1 ноября 2026. Сегодня ${todayDate}." style="display:block;width:100%;max-width:850px;color:var(--muted)">
      ${[0, max / 2, max].map(value => `<line x1="57" x2="592" y1="${y(value)}" y2="${y(value)}" stroke="var(--line)"/><text x="50" y="${y(value) + 4}" fill="currentColor" text-anchor="end" font-size="14">${fmt(value)}</text>`).join('')}
      <line x1="${x(arrival)}" x2="${x(arrival)}" y1="22" y2="185" stroke="var(--accent)" stroke-width="2.5"/>
      <line x1="${x(today)}" x2="${x(today)}" y1="22" y2="185" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3"/>
      ${trace}${dots}<text x="57" y="207" fill="currentColor" font-size="14">2024</text>
      <text x="592" y="207" fill="currentColor" text-anchor="end" font-size="14">${todayDate.slice(0, 4)}</text>
    </svg><p><strong>Сплошная отметка</strong> — приход, 01.11.2026. <strong>Тонкая пунктирная</strong> — сегодня, ${todayDate.split('-').reverse().join('.')}.</p>
    <p class="hint">Шкала начинается с 2024 года, первого года доступной отчётности. Дата основания компании пока не подтверждена. Точки обозначают фактические срезы.</p>
    ${points.length ? table(['Дата среза', name], points.map(point => [safe(point.date), fmt(point.value) + ' ' + unit])) : ''}`);
}

function renderComparison() {
  const metrics = window.AVERA_METRICS;
  const accounting = window.AVERA_ACCOUNTING;
  const baseline = window.AVERA_SKU_BASELINE;
  const amount = (rows, code, column) => metrics.million(metrics.value(rows, code, column)) + ' млн ₽';
  const baselineCount = baseline.items.length;
  const baselineComplete = baseline.items.filter(item => item.sourcePercent === 100).length;
  const turnover2025 = window.AVERA_HR_TURNOVER.rows.find(row => row[0].startsWith('2025'))?.[1];
  const turnoverHistory = Number.isFinite(turnover2025) ? fmt(turnover2025) + '% · 2025 год' : 'НД';
  const rows = [
    ['1. Выручка', amount(accounting.incomeNine, '2110', 3) + ' · янв.–сен. 2026', 'НД', 'ОФР / 1С. После закрытия ноября: ноябрь 2025, октябрь и ноябрь 2026. Далее — одинаковые месяцы год к году.'],
    ['2. Люди: текучесть', turnoverHistory, 'НД', 'Увольнения за период / средняя численность за тот же период. Для первого сравнения нужны месячные данные за октябрь и ноябрь.'],
    ['3.1. SKU аттракционов', 'НД на 31.10.2026', 'Старт: ' + baselineCount + ' SKU на ' + safe(baseline.asOf) + '. Новый срез — НД', 'Считать уникальные модели аттракционов. Отдельно показывать SKU с подтверждённым допуском к производству.'],
    ['3.2. SKU прочих продуктов', 'НД на 31.10.2026', 'НД', 'Считать самостоятельные продукты по подтверждённому перечню. Комплектующие учитывать в составе изделий.'],
    ['4. Количество сделок', 'НД', 'НД', 'Битрикс24 и реестр договоров. Считать уникальные подписанные сделки по дате подписания за одинаковые периоды.'],
    ['5. Маржинальность сделок', 'НД', 'НД', 'Сумма маржи / сумма выручки без НДС по одному набору сделок. Плановую маржу подписанных сделок и фактическую маржу исполненных показывать отдельно.']
  ];
  const historical = [
    ['Выручка', amount(accounting.incomeNine, '2110', 2), amount(accounting.incomeNine, '2110', 3)],
    ['Чистая прибыль / убыток', amount(accounting.incomeNine, '2400', 2), amount(accounting.incomeNine, '2400', 3)]
  ];
  const switcher = `<div role="group" aria-label="Вид сравнения" style="display:flex;gap:8px;margin-bottom:12px">
    <button type="button" data-comparison-view="table" aria-pressed="${comparisonView === 'table'}" class="${comparisonView === 'table' ? 'primary' : ''}">Было / стало</button>
    <button type="button" data-comparison-view="chart" aria-pressed="${comparisonView === 'chart'}" class="${comparisonView === 'chart' ? 'primary' : ''}">График</button></div>`;
  if (comparisonView === 'chart') return switcher + comparisonChart(metrics, accounting, baseline);
  return switcher + panel('Было → стало', table(['Показатель', 'История / исходная точка', 'С ноября 2026', 'Как сравниваем'], rows) + '<p class="hint">НД — данных пока нет. Исторические значения с разными периодами служат контекстом. Изменение считаем после загрузки сопоставимой пары.</p>')
    + panel('Финансовая динамика до ноября', table(['Показатель', 'Янв.–сен. 2025', 'Янв.–сен. 2026'], historical) + '<p class="hint">Источник: ОФР. Оба периода предшествуют началу управленческого сравнения.</p>')
    + panel('Что ещё показать собственникам', table(['Показатель', 'Зачем', 'Как измерять'], [
      ['Аттракционы с КД 100% и с допуском', 'Показывает результат работы КБ до появления выручки', 'На старте КД 100% у ' + baselineComplete + ' из ' + baselineCount + ' SKU аттракционов. Допуск учитывается по утверждённому статусу.'],
      ['Заказы в срок', 'Показывает предсказуемость производства', 'Доля заказов, принятых в договорный срок, среди заказов со сроком в периоде.'],
      ['Чистый операционный денежный поток', 'Показывает, приносит ли основная деятельность деньги', 'Поступления минус операционные выплаты за месяц по банковским данным.'],
      ['Сумма подписанных заказов', 'Дополняет количество сделок и показывает объём будущей работы', 'Подписанная стоимость без НДС за период. Выделять унаследованные сделки и сделки, начатые с ноября.']
    ]))
    + panel('Решения и результат', '<p>Фиксировать дату решения, исходное значение, целевой показатель, срок и измеренный эффект. Для сделок сохранять дату открытия и дату подписания. Так собственники увидят, какие результаты появились после конкретных действий и где сработал портфель, собранный ранее.</p>');
}

renderers.comparison = renderComparison;
$('#content').addEventListener('click', event => {
  const button = event.target.closest('[data-comparison-view]');
  if (current !== 'comparison' || !button) return;
  comparisonView = button.dataset.comparisonView;
  render();
  $(`[data-comparison-view="${comparisonView}"]`).focus();
});
$('#content').addEventListener('change', event => {
  if (current !== 'comparison' || event.target.id !== 'comparison-metric') return;
  comparisonMetric = event.target.value;
  render();
  $('#comparison-metric').focus();
});
const applyComparisonLabels = window.applyActualLabels;
window.applyActualLabels = function () {
  applyComparisonLabels();
  if (current !== 'comparison') return;
  $('main > .notice').textContent = 'Граница сравнения — 1 ноября 2026 года. Подтверждённые результаты за завершённый период после этой даты ещё не загружены.';
  $('.asof').innerHTML = '<strong>1 ноября 2026</strong><span>Начало сравнения</span>';
};
render();

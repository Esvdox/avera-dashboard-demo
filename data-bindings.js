'use strict';
// Derived values only. Source snapshots remain unchanged and retain their totals.
window.AVERA_METRICS={
 balanceSeries(code){
  const dates=['2024-12-31','2025-12-31','2026-09-30'];
  return dates.map((date,index)=>({date,value:this.value(window.AVERA_ACCOUNTING?.balance,code,index+2),
   version:index===0?'Сравнительная колонка поздней отчётности':'Отчётный баланс'}));
 },
 staffing(from='',to='9999-12-31'){
  return (window.AVERA_STAFFING_SOURCE?.snapshots||[])
   .filter(r=>r.date>=from&&r.date<=to)
   .map(r=>({date:r.date,planned:Number.isFinite(r.planned)?r.planned:null,
    occupied:Number.isFinite(r.occupied)?r.occupied:null,vacant:Number.isFinite(r.vacant)?r.vacant:null}))
   .sort((a,b)=>a.date.localeCompare(b.date));
 },
 staffingPanel(){
  const rows=this.staffing(),latest=rows.at(-1),number=v=>Number.isFinite(v)?fmt(v):'НД';
  return panel('Штатные ставки',summary([
   ['Предусмотрено',number(latest?.planned),'Ставки по штатной расстановке'],
   ['Занято',number(latest?.occupied),'Ставки, не количество людей'],
   ['Вакантно',number(latest?.vacant),'Ставки, не количество вакансий'],
   ['ФОТ','НД','Подтверждённый публичный показатель не подключён']
  ])+table(['Дата среза','Предусмотрено, ставок','Занято, ставок','Вакантно, ставок'],
   rows.map(r=>[r.date.split('-').reverse().join('.'),number(r.planned),number(r.occupied),number(r.vacant)]))+
   '<p class="hint">Источник: кадровые выгрузки 1С, штатная расстановка. Ставки не равны числу людей. Фактическая численность людей на дату: НД. Между срезами данные отсутствуют: интерполяция и перенос на другие даты не выполняются. Обзор и сравнение используют тот же набор. Автоматического обновления из 1С нет.</p>',
   latest?'Последний подтверждённый срез: '+latest.date.split('-').reverse().join('.'):'НД');
 },
 value(rows,code,column){const row=rows?.find(r=>r[1]===code);return Number.isFinite(row?.[column])?row[column]:null;},
 finance(){const d=window.AVERA_ACCOUNTING,m=this;const revenue=m.value(d?.incomeNine,'2110',3),previousRevenue=m.value(d?.incomeNine,'2110',2),profit=m.value(d?.incomeNine,'2400',3),expense=m.value(d?.incomeNine,'2120',3);return{revenue,previousRevenue,profit,cash:m.value(d?.balance,'1250',4),capital:m.value(d?.balance,'1300',4),creditors:m.value(d?.balance,'1520',4),growth:revenue!==null&&previousRevenue?100*(revenue/previousRevenue-1):null,margin:profit!==null&&revenue?100*profit/revenue:null,ordinaryResult:revenue!==null&&expense!==null?revenue+expense:null};},
 date(v){const m=String(v||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(!m||+m[3]<2000)return null;const iso=`${m[3]}-${m[2]}-${m[1]}`,d=new Date(iso+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===iso?iso:null;},
 done(v){return v===true||String(v).toUpperCase()==='TRUE';},
 production(){const d=window.AVERA_PRODUCTION_SNAPSHOT,rows=d?.rows||[],open=rows.filter(r=>!this.done(r.done)),completed=rows.filter(r=>this.done(r.done)),dated=open.filter(r=>this.date(r.end));const risky=dated.filter(r=>this.date(r.end)<d.asOf);return{named:rows.length,completed:completed.length,open:open.length,openWithPlanDate:dated.length,openMissingPlanDate:open.length-dated.length,openPastPlan:risky.length,risky,actualWithNotDone:open.filter(r=>this.date(r.actual)),doneWithoutActual:completed.filter(r=>!this.date(r.actual)).length};},
 assets(){const d=window.AVERA_FIXED_ASSETS,items=d?.items||[];function sum(field){let total=0;for(const r of items){let v=r[field];if(v===null&&field==='residual'&&r.cost===r.depreciation)v=0;if(v===null&&field==='depreciation'&&r.cost===r.residual)v=0;if(!Number.isFinite(v))return null;total+=v;}return total;}const totals={cost:sum('cost'),depreciation:sum('depreciation'),residual:sum('residual')};return{...totals,count:items.length,sourceTotals:d?.totals,discrepancies:Object.keys(totals).filter(k=>totals[k]!==null&&totals[k]!==d?.totals?.[k])};},
 hr(year=2026){const d=typeof hrData==='undefined'?null:hrData[year];if(!d)return{hires:null,leavers:null,moves:null,balance:null,departments:[]};const hires=d.events['Прием']||0,leavers=d.events['Увольнение']||0;return{hires,leavers,moves:d.events['Перемещение']||0,balance:hires-leavers,departments:d.departments||[]};},
 hrInsight(year){const d=this.hr(year);return `<p>Выбранный год: ${year}. Приёмы: ${d.hires}; увольнения: ${d.leavers}; баланс событий: ${d.balance}. Это события, а не изменение текущей численности.</p><p>Для оценки причин и риска нужны основания увольнений, средняя численность подразделений и связи с производственными заданиями. Само количество увольнений не доказывает причину задержки заказа.</p>`;},
 financeChecks(){const d=window.AVERA_ACCOUNTING,v=(rows,code,c)=>this.value(rows,code,c);const sum=(rows,codes,c)=>{const a=codes.map(code=>v(rows,code,c));return a.every(Number.isFinite)?a.reduce((s,n)=>s+n,0):null;};return{incomeCalculated:sum(d.incomeNine,['2110','2120','2330','2340','2350','2410'],3),incomeReported:v(d.incomeNine,'2400',3),assetsCalculated:sum(d.balance,['1150','1170','1210','1250','1240'],4),assetsReported:v(d.balance,'1600',4),liabilitiesCalculated:sum(d.balance,['1300','1410','1510','1520'],4),liabilitiesReported:v(d.balance,'1700',4)};},
 financeCheckRows(){const labels={incomeCalculated:'Чистый результат по расчёту',incomeReported:'Чистый результат по ОФР',assetsCalculated:'Активы по сумме строк',assetsReported:'Активы по итогу баланса',liabilitiesCalculated:'Пассивы по сумме строк',liabilitiesReported:'Пассивы по итогу баланса'};return Object.entries(this.financeChecks()).map(([k,v])=>[labels[k],v]);},
 million(v,scale=1000){return Number.isFinite(v)?(v/scale).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}):'НД';},
 percent(v){return Number.isFinite(v)?v.toLocaleString('ru-RU',{maximumFractionDigits:2})+'%':'Не рассчитывается';}
};
window.AVERA_SOURCE_STATUS=()=>[
 ['Бухгалтерия',window.AVERA_ACCOUNTING?.asof||'НД',window.AVERA_ACCOUNTING?.updated||'НД','Ручной снимок PDF; автоимпорта нет'],
 ['Основные средства',window.AVERA_FIXED_ASSETS?.asOf||'НД','02.11.2026','Ручной снимок ведомости; автоимпорта нет'],
 ['Штатные ставки',window.AVERA_METRICS.staffing().map(r=>r.date).join(' / '),window.AVERA_STAFFING_SOURCE?.updated||'НД','Ручные срезы расстановки 1С; только агрегаты ставок'],
 ['Кадры', '2024–2026; события по 02.11.2026',window.AVERA_HR_TURNOVER?.updated||'НД','Снимки отчётов 1С; прямого подключения нет'],
 ['Гант Завод',window.AVERA_PRODUCTION_SNAPSHOT?.asOf||'НД',window.AVERA_PRODUCTION_SNAPSHOT?.asOf||'НД','Сохранённый срез; регулярное чтение не настроено'],
 ['Битрикс24','НД','НД','Актуальный срез не загружен'],
 ['Продукты и КБ','НД','НД','Подтверждённый реестр не загружен']
];


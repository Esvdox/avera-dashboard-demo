'use strict';
// Approved five-block summary. Only existing public source aggregates are used.
(()=>{
  const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date());
  const state={from:'2024-01-01',to:today(),view:'charts',compare:true,finance:'profit',basis:'nine',orders:'flow',team:'staffing',products:'count'};
  const inRange=p=>p.date>=state.from&&p.date<=state.to;
  const displayDate=d=>d.split('-').reverse().join('.');
  const m=window.AVERA_METRICS;
  const n=v=>Number.isFinite(v)?fmt(v):null;
  const sourceMissing='Данные не загружены';
  function delta(points,direction=1,unit=''){
    if(!state.compare||points.length<2||points.some(p=>p.partial))return '';
    const value=points.at(-1).value-points[0].value;
    if(!Number.isFinite(value))return '';
    const tone=!direction||!value?'neutral':value*direction>0?'good':'bad';
    return `<span class="cs-delta cs-${tone}" title="Последний сопоставимый срез минус первый">${value>0?'+':''}${fmt(value)} ${unit}</span>`;
  }
  function stat(label,points,unit='',direction=1,reason=sourceMissing){
    const rows=points.filter(inRange).filter(p=>Number.isFinite(p.value));
    const last=rows.at(-1);
    return `<div class="cs-stat"><div class="cs-label">${safe(label)}</div><div class="cs-value-row">${last?`<strong>${fmt(last.value)}${unit?' '+unit:''}</strong>${delta(rows,direction,unit==='%'?'п.п.':unit)}`:`<span class="cs-missing">${safe(points.length?'Нет среза в выбранном периоде':reason)}</span>`}</div>${last?`<div class="cs-date">${safe(last.periodLabel||displayDate(last.date))}</div>`:''}</div>`;
  }
  function switches(group,items){return `<div class="cs-tabs" role="group" aria-label="${safe(group)}">${items.map(([value,label])=>`<button type="button" data-cs-group="${group}" data-cs-value="${value}" aria-pressed="${state[group]===value}">${label}</button>`).join('')}</div>`;}
  function empty(text){return `<div class="cs-empty">${safe(text)}</div>`;}
  function graph(name,points,unit,id,secondary=null,legend=null){
    const rows=points.filter(inRange), other=secondary?.filter(inRange);
    if(!rows.some(p=>Number.isFinite(p.value))&&!other?.some(p=>Number.isFinite(p.value)))return empty('Нет подтверждённых наблюдений за выбранный период');
    if(state.view==='numbers')return `<div class="cs-data"><table><thead><tr><th>Период</th><th>${safe(legend?.[0]||name)}, ${unit}</th>${secondary?`<th>${safe(legend?.[1]||'Второй ряд')}, ${unit}</th>`:''}</tr></thead><tbody>${rows.map(p=>`<tr><td>${safe(p.periodLabel||displayDate(p.date))}</td><td>${n(p.value)??sourceMissing}</td>${secondary?`<td>${n(other.find(q=>q.date===p.date)?.value)??sourceMissing}</td>`:''}</tr>`).join('')}</tbody></table></div>`;
    const width=Math.max(240,$('#content').clientWidth-34);
    const metric={name,unit,points:rows,...(secondary?{secondaryPoints:other}: {})};
    let result=periodGraph(metric,id,comparisonAxis(width,state.from,state.to),width);
    if(legend)result=result.replace(/<ul class="cmp-series-legend">[\s\S]*?<\/ul>/,`<ul class="cmp-series-legend cs-legend"><li><i></i>${safe(legend[0])}</li><li><i class="cs-dashed"></i>${safe(legend[1])}</li></ul>`);
    return result;
  }
  function financial(code){
    const annual=state.basis==='annual', years=annual?[2024,2025]:[2025,2026];
    return years.map((year,i)=>({date:`${year}-${annual?'12-31':'09-30'}`,value:(m.value(window.AVERA_ACCOUNTING[annual?'incomeAnnual':'incomeNine'],code,i+2)??NaN)/1000,periodLabel:annual?`${year} год`:`9 мес. ${year}`}));
  }
  function balance(code){return m.balanceSeries(code).map(p=>({...p,value:Number.isFinite(p.value)?p.value/1000:null}));}
  function block(id,title,stats,controls,body){return `<section class="panel cs-block" data-company-block="${id}"><h2>${safe(title)}</h2><div class="cs-stats">${stats}</div>${controls}${body}</section>`;}
  function controls(){return `<section class="panel cs-controls"><div class="cs-toolbar">${[['all','Вся история'],['year','Год'],['quarter','Квартал'],['month','Месяц']].map(([v,l])=>`<button type="button" data-cs-range="${v}">${l}</button>`).join('')}<span class="cs-date">Доступные источники — с 2024 года</span></div><div class="cs-toolbar"><label>От <input aria-label="От" type="date" data-cs-date="from" value="${state.from}"></label><label>До <input aria-label="До" type="date" data-cs-date="to" value="${state.to}"></label><label class="cs-compare"><input type="checkbox" data-cs-compare ${state.compare?'checked':''}> Изменение между срезами</label>${switches('view',[['numbers','Цифры'],['charts','Графики']])}</div></section>`;}
  function summary(){
    if(!state.from||!state.to||state.from>state.to)return controls()+empty('Укажите корректный диапазон дат');
    const revenue=financial('2110'), profit=financial('2400');
    const financeStats=stat('Выручка',revenue,'млн ₽')+stat('Маржинальность',[],'%',1,'Нет данных о маржинальном доходе')+stat('Чистая прибыль',profit,'млн ₽');
    const financeControls=switches('finance',[['revenue','Выручка'],['margin','Маржинальность'],['profit','Чистая прибыль']])+switches('basis',[['nine','9 месяцев'],['annual','Год']]);
    const financeBody=state.finance==='margin'?empty('Для маржинальности нужны выручка и переменные затраты по сопоставимым продажам'):graph(state.finance==='profit'?'Чистая прибыль':'Выручка',state.finance==='profit'?profit:revenue,'млн ₽',201);
    const orderStats=['Договоры · количество и сумма','Выполнено','К исполнению','Просрочено'].map(label=>stat(label,[],'',0,'Нет реестра договоров и исполнения')).join('');
    const moneyStats=stat('Деньги',balance('1250'),'млн ₽',0)+stat('Займы',m.loanSeries().map(p=>({...p,value:p.value===null?null:p.value/1000})),'млн ₽',-1)+stat('Дебиторская',balance('расшифровка'),'млн ₽',-1)+stat('Кредиторская',balance('1520'),'млн ₽',-1);
    const staffing=m.staffing(),planned=staffing.map(p=>({date:p.date,value:p.planned})),occupied=staffing.map(p=>({date:p.date,value:p.occupied}));
    const turnover=window.AVERA_HR_TURNOVER.rows.map(r=>({date:r[0].slice(0,4)+(r[0].includes('ноябрь')?'-11-01':'-12-31'),value:r[1],partial:r[0].includes('ноябрь'),periodLabel:r[0]}));
    const teamStats=stat('Предусмотрено',planned,'ставок',0)+stat('Занято',occupied,'ставки',0)+stat('Текучесть',turnover,'%',-1);
    const baseline=window.AVERA_SKU_BASELINE;
    const attractions=[{date:baseline.asOf.split('.').reverse().join('-'),value:baseline.items.length,periodLabel:'Реестр · '+baseline.asOf}];
    const productStats=stat('Всего продуктов',[],'',0,'Нет полного реестра')+stat('Аттракционы',attractions,'',0)+stat('Прочие продукты',[],'',0,'Нет подтверждённого реестра');
    return `<div class="company-summary">${controls()}${
      block('finance','Финансовый результат',financeStats,financeControls,financeBody)+
      block('orders','Заказы и исполнение',orderStats,switches('orders',[['flow','Поступление и выполнение'],['backlog','Остаток заказов']]),empty(state.orders==='flow'?'Нужны даты и суммы заключённых договоров и подтверждённого исполнения':'Нужны остатки обязательств по договорам на отчётные даты'))+
      block('money','Деньги и обязательства',moneyStats,'','')+
      block('team','Команда',teamStats,switches('team',[['staffing','Штатное расписание'],['turnover','Текучесть']]),state.team==='staffing'?graph('Штатное расписание',planned,'ставки',202,occupied,['Предусмотрено','Занято']):graph('Текучесть',turnover,'%',203))+
      block('products','Продуктовый портфель',productStats,switches('products',[['count','Количество'],['revenue','Выручка'],['margin','Маржинальность']]),state.products==='count'?graph('Продуктовый портфель',attractions,'шт.',204,[],['Аттракционы','Прочие продукты · данные не загружены']):empty('Нет подтверждённой разбивки продаж и затрат по направлениям'))
    }</div>`;
  }
  const overview=tabs.find(t=>t[0]==='overview');overview[1]='Компания';overview[2]='Сводка по компании';overview[3]='';
  const oldComparison=tabs.findIndex(t=>t[0]==='comparison');if(oldComparison>=0)tabs.splice(oldComparison,1);
  delete renderers.comparison;
  window.ownerOverview=summary;renderers.overview=summary;
  const previousLabels=window.applyActualLabels;
  window.applyActualLabels=function(){previousLabels?.();document.querySelector('main').classList.toggle('cs-page',current==='overview');if(current==='overview'){document.querySelector('.asof').hidden=true;$('#title').textContent='Сводка по компании';}else document.querySelector('.asof').hidden=false;};
  $('#content').addEventListener('click',e=>{
    const tab=e.target.closest('[data-cs-group]'),range=e.target.closest('[data-cs-range]');
    if(tab){state[tab.dataset.csGroup]=tab.dataset.csValue;render();}
    if(range){const end=today(),year=+end.slice(0,4),month=+end.slice(5,7);state.to=end;state.from=range.dataset.csRange==='all'?'2024-01-01':range.dataset.csRange==='year'?`${year}-01-01`:range.dataset.csRange==='quarter'?`${year}-${String(Math.floor((month-1)/3)*3+1).padStart(2,'0')}-01`:`${year}-${String(month).padStart(2,'0')}-01`;render();}
  });
  $('#content').addEventListener('change',e=>{if(e.target.dataset.csDate){state[e.target.dataset.csDate]=e.target.value;render();}else if(e.target.hasAttribute('data-cs-compare')){state.compare=e.target.checked;render();}});
  if(location.hash==='#comparison')history.replaceState(null,'',location.pathname+location.search+'#overview');
  render();
})();

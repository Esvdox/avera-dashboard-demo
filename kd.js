'use strict';
(() => {
  const {groups, stages, products, evidence} = window.AVERA_KB_STAGES;
  const states = {y: ['✓', 'Есть'], p: ['◐', 'Частично / в работе'], n: ['×', 'Нет']};
  const percent = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 1});

  // Этот показатель относится к историческому срезу XLSX.
  window.AVERA_METRICS.products = function () {
    const all = window.AVERA_KD.items;
    const rides = all.filter(item => item.kind === 'ride');
    const values = rides.map(item => item.sourcePercent).filter(Number.isFinite);
    return {all, rides, count: rides.length, complete: values.filter(v => v === 100).length,
      incomplete: values.filter(v => v < 100).length,
      mean: values.length && values.length === rides.length ? values.reduce((a,b) => a+b, 0) / values.length : null};
  };

  function mark(status) {
    return `<span aria-hidden="true" class="kb-mark kb-${status}">${states[status][0]}</span>`;
  }

  function cell(product, stage) {
    const [status, reason] = product.stages[stage];
    const label = safe(`${product.name} · ${stages[stage][1]} · ${states[status][1]}. ${evidence[reason]}`);
    return `<td><span class="kb-cell" role="img" aria-label="${label}" title="${label}">${mark(status)}</span></td>`;
  }

  function readiness(product, records) {
    const entry = records.get(product.sourceId);
    if (!Number.isFinite(entry?.sourcePercent)) return '<span role="img" aria-label="Нет оценки по узлам" title="Нет оценки по узлам">'+mark('n')+'</span>';
    const needsCheck = ['KD-11', 'KD-12'].includes(product.sourceId);
    return percent.format(entry.sourcePercent) + (needsCheck ? '<sup title="Формула требует сверки">*</sup>' : '');
  }

  function desktop(records) {
    const headers = stages.map(([short, title]) => `<th scope="col" title="${safe(title)}">${safe(short)}</th>`).join('');
    const rows = products.map(p => `<tr><th scope="row">${safe(p.name)}</th><td class="kb-pct">${readiness(p, records)}</td>${stages.map((_, j) => cell(p,j)).join('')}</tr>`).join('');
    return `<table class="kb-desktop" aria-label="Стадии по изделиям"><colgroup><col class="kb-name"><col class="kb-percent"><col span="14"></colgroup><thead><tr class="kb-groups"><th colspan="2">Реестр изделий</th>${groups.map(([n,t])=>`<th scope="colgroup" colspan="${n}">${safe(t)}</th>`).join('')}</tr><tr><th scope="col">Изделие / исполнение</th><th scope="col">Узлы, %</th>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function mobile(records) {
    const headers = products.map(p=>`<th scope="col" aria-label="${safe(p.name)}"><span>${safe(p.short)}</span></th>`).join('');
    const totals = products.map(p=>`<td class="kb-pct">${readiness(p,records)}</td>`).join('');
    let stage = 0;
    const rows = groups.map(([size,group]) => {
      const start = stage;
      stage += size;
      return `<tbody><tr class="kb-band"><th colspan="${products.length+1}" scope="rowgroup">${safe(group)}</th></tr>` +
        stages.slice(start,stage).map(([title],i)=>`<tr><th scope="row">${safe(title)}</th>${products.map(p=>cell(p,start+i)).join('')}</tr>`).join('')+'</tbody>';
    }).join('');
    return `<table class="kb-mobile" aria-label="Изделия по стадиям"><thead><tr><th scope="col">Стадия</th>${headers}</tr></thead><tbody><tr><th scope="row">Узлы, %</th>${totals}</tr></tbody>${rows}</table>`;
  }

  renderers.products = function () {
    const records = new Map(window.AVERA_KD.items.map(item=>[item.id,item]));
    const legend = Object.entries(states).map(([s,[,label]])=>`<span>${mark(s)}${label}</span>`).join('');
    const other = window.AVERA_KD.items.filter(item=>item.kind!=='ride');
    return `<section class="kb-section" aria-label="Изделия и стадии КД">
      <div class="kb-head"><h2>Изделия и стадии КД</h2><div class="kb-key" aria-label="Обозначения">${legend}</div></div>
      <div class="kb-matrix">${desktop(records)}${mobile(records)}</div>
      <p class="kb-note">Узлы, % — готовность КД по ведомости на 02.11.2026. * У КО-41 и катальных гор формула требует сверки.</p>
      <details class="kb-details"><summary>Источники и состав реестра</summary>
        <p>Статусы стадий уточнены 26 ноября 2026 года. У «Детского джета» в работе ТЗ. Для всех восьми изделий испытания опытного образца и выпуск КД для повторного изготовления отмечены как незавершённые.</p>
        <p>Ведомость «${safe(window.AVERA_KD.source)}», лист «${safe(window.AVERA_KD.sheet)}», содержит оценки по семи аттракционам. У КО-39 оценены все 36 узлов, при этом общая 3D-модель отсутствует. Отметка × у «Детского джета» в строке или столбце процентов означает, что оценки по узлам нет.</p>
        <p>КО-41 — в формуле J131 значения 11 узлов делятся на 10. Катальные горы — в формуле J143 заполнены две из шести строк. В матрице показаны исходные значения.</p>
        <details><summary>Павильон и отдельные узлы из ведомости · ${other.length}</summary>${table(['Позиция','КД по узлам'],other.map(r=>[safe(r.name),percent.format(r.sourcePercent)+'%']))}</details>
      </details></section>`;
  };

  const previousStatus = window.AVERA_SOURCE_STATUS;
  window.AVERA_SOURCE_STATUS = () => previousStatus().map(r => r[0] === 'Продукты и КБ' ?
    ['Продукты и КБ','26.11.2026','26.11.2026','Статусы стадий · 26.11, ведомость по узлам · 02.11'] : r);
  const previousLabels = window.applyActualLabels;
  window.applyActualLabels = function () {
    previousLabels();
    if (current !== 'products') return;
    document.querySelector('#title').textContent = 'Продукты и КБ';
    document.querySelector('#subtitle').innerHTML = products.length + ' изделий и исполнений<span class="kb-mobile-date"> · статусы на 26.11.2026</span>';
    document.querySelector('main > .notice').textContent = '';
    document.querySelector('.asof').innerHTML = '<strong>Статусы на 26.11.2026</strong>';
  };
  render();
})();

'use strict';
(() => {
  const { asOf, projects } = window.AVERA_ORDER_SNAPSHOT;
  const money = rubles => (rubles / 1e6).toLocaleString('ru-RU', {maximumFractionDigits: 3});
  const percent = (amount, cost) => (amount / cost).toLocaleString('ru-RU', {style:'percent', maximumFractionDigits:1});
  const date = asOf.split('-').reverse().join('.');
  let selection = '';

  function progress(amount, cost, paid = false) {
    if (amount === null) return '<span class="order-missing">Работы не начаты</span>';
    const label = paid ? 'Оплачено' : 'Выполнено';
    return `<div class="order-line ${paid ? 'order-paid' : ''}" aria-label="${label}: ${percent(amount, cost)}">
      <span class="order-track"><i style="width:${100 * amount / cost}%"></i></span>
      <b>${percent(amount, cost)}</b></div>`;
  }

  function projectDetails(project) {
    const {cost, done, paid, left} = project;
    return `<p class="order-status">${safe(project.status)}<br>
      Договор ${money(cost)} млн ₽ · Выполнено ${money(done)} млн ₽ · Оплачено ${money(paid)} млн ₽ · Остаток оплаты ${money(left)} млн ₽</p>`;
  }

  function chart() {
    const selected = selection === '' ? null : projects[Number(selection)];
    const rows = selected ? selected.items.map(([name,cost,done]) =>
      `<div class="order-row"><div>${safe(name)}<small>${done === null ? 'Стоимость ' : money(done) + ' из '}${money(cost)} млн ₽</small></div>
      <div>${progress(done,cost)}</div></div>`
    ) : projects.map((p,i) =>
      `<div class="order-row"><button type="button" data-order-index="${i}">${safe(p.title)}<small>${safe(p.city)}</small></button>
      <div>${progress(p.done,p.cost)}${progress(p.paid,p.cost,true)}</div></div>`
    );
    return `<h3>${selected ? 'Выполнение по составу договора' : 'Выполнение и оплата по проектам'}</h3>
      ${selected ? projectDetails(selected) : ''}
      <div class="order-key"><span>Выполнено</span>${selected ? '' : '<span>Оплачено</span>'}</div>
      ${rows.join('')}`;
  }

  function summary() {
    const sum = key => projects.reduce((value,p) => value + p[key],0);
    const cost = sum('cost');
    return [['Стоимость договоров',cost,'С НДС'],['Выполнено работ',sum('done'),percent(sum('done'),cost)+' стоимости'],
      ['Оплачено',sum('paid'),percent(sum('paid'),cost)+' стоимости'],['Остаток оплаты',sum('left'),'По всем договорам']]
      .map(([name,value,detail]) => `<div><small>${name}</small><strong>${money(value)} <em>млн ₽</em></strong><small>${detail}</small></div>`).join('');
  }

  window.renderOrderExecution = inRange => {
    if (!inRange(asOf)) return `<article class="av-metric">Нет справки по договорам в выбранном периоде. Дата среза — ${date}.</article>`;
    const options = projects.map((p,i) => `<option value="${i}" ${String(i) === selection ? 'selected' : ''}>${safe([p.title,p.city].filter(Boolean).join(' · '))}</option>`).join('');
    return `<article class="av-metric order-card"><header><h3>Сводка по ${projects.length} договорам</h3><time datetime="${asOf}">${date}</time></header>
      <div class="order-summary">${summary()}</div><label>Проект <select data-order-select><option value="">Все проекты</option>${options}</select></label>
      <div data-order-chart aria-live="polite">${chart()}</div></article>`;
  };
  const content = document.getElementById('content');
  function selectProject(value) {
    selection = value;
    content.querySelector('[data-order-select]').value = value;
    content.querySelector('[data-order-chart]').innerHTML = chart();
  }
  content.addEventListener('change', event => {
    if (event.target.matches('[data-order-select]')) selectProject(event.target.value);
  });
  content.addEventListener('click', event => {
    const button = event.target.closest('[data-order-index]');
    if (!button) return;
    selectProject(button.dataset.orderIndex);
    content.querySelector('[data-order-select]').focus();
  });
})();

const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const base=process.env.AVERA_URL||pathToFileURL(path.join(__dirname,'index.html')).href;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [320,390,1280]){
   const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   for(const theme of ['light','dark']){
    await page.goto(base+'?theme='+theme+'#overview');
    await page.locator('.company-summary').waitFor();
    assert.equal(await page.locator('[data-company-block]').count(),5);
    assert.equal(await page.locator('.cs-value-row strong').first().evaluate(e=>getComputedStyle(e).fontSize),'18px');
    assert.equal(await page.locator('nav a[href="#comparison"]').count(),0);
    assert.match(await page.locator('[data-company-block="finance"]').innerText(),/281,16 млн ₽/);
    assert.match(await page.locator('[data-company-block="money"]').innerText(),/256,65 млн ₽/);
    assert.match(await page.locator('[data-company-block="orders"]').innerText(),/Нет реестра договоров/);
    assert.equal(await page.locator('[data-company-block="team"] .cmp-occupied-series path').count(),1);
    for(const svg of await page.locator('.company-summary svg.cmp-period-graph').all()){
      assert(await svg.locator('circle').evaluateAll(es=>es.every(e=>+e.getAttribute('cy')>=20&&+e.getAttribute('cy')<=176)));
      const overlaps=await svg.evaluate(svg=>{const labels=[...svg.querySelectorAll('text')];return labels.flatMap((a,i)=>labels.slice(i+1).filter(b=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return x.width&&y.width&&x.left<y.right&&x.right>y.left&&x.top<y.bottom&&x.bottom>y.top;}).map(b=>[a.textContent,b.textContent]));});
      assert.deepEqual(overlaps,[],'chart labels overlap');
    }
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
    await page.screenshot({path:path.join(__dirname,`company-${width}-${theme}.png`),fullPage:true});
    for(const [group,values] of Object.entries({finance:['revenue','margin','profit'],basis:['annual','nine'],orders:['backlog','flow'],team:['turnover','staffing'],products:['revenue','margin','count'],view:['numbers','charts']})){
      for(const value of values){await page.locator(`[data-cs-group="${group}"][data-cs-value="${value}"]`).click();assert.equal(await page.locator('[data-company-block]').count(),5);}
    }
    await page.locator('[data-cs-compare]').uncheck();assert.equal(await page.locator('.cs-delta').count(),0);
    await page.locator('[data-cs-compare]').check();assert(await page.locator('.cs-delta').count()>0);
    await page.locator('[data-cs-range="month"]').click();assert(!(await page.locator('[data-company-block="finance"] .cs-value-row').allTextContents()).join('').includes('281,16'));
    await page.locator('[data-cs-range="all"]').click();
    await page.locator('[data-cs-date="from"]').fill('2027-01-01');await page.locator('[data-cs-date="from"]').dispatchEvent('change');
    assert.match(await page.locator('#content').innerText(),/Укажите корректный диапазон/);
    await page.locator('[data-cs-range="all"]').click();
   }
   await page.goto(base+'#comparison');assert.equal(await page.locator('[data-company-block]').count(),5);
   for(const tab of ['finance','people','products','overview']){await page.evaluate(t=>location.hash=t,tab);await page.waitForFunction(t=>location.hash==='#'+t,tab);await page.waitForTimeout(50);}
   assert.equal(await page.locator('[data-company-block]').count(),5);
   await page.reload();assert.equal(await page.locator('[data-company-block]').count(),5);
   assert.deepEqual(errors,[]);
   console.log('PASS five blocks, source values, tabs, filters, legacy route, themes and layout: '+width);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

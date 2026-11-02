const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('assert/strict');
const {pathToFileURL}=require('url');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href+'#finance');
  await page.getByRole('heading',{name:'Финансы: бухгалтерская отчетность',exact:true}).waitFor();
  const content=await page.locator('#content').innerText();
  for(const value of ['281,160','4,318','−135,349','168,494','160,069','9 мес. 2025','9 мес. 2026'])
   assert.ok(content.replaceAll('-','−').includes(value),value);
  assert.ok(!content.includes('42 млн'),'No demo financial figures');
  assert.equal(await page.locator('#content table').count(),4);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const checks=await page.evaluate(()=>{
   const d=window.AVERA_ACCOUNTING,b=Object.fromEntries(d.balance.map(r=>[r[1],r.slice(2)]));
   return {assets:b['1600'][2],liabilities:b['1300'][2]+b['1410'][2]+b['1510'][2]+b['1520'][2],income:d.incomeNine[0][3]+d.incomeNine[1][3]+d.incomeNine[3][3]+d.incomeNine[4][3]+d.incomeNine[5][3]+d.incomeNine[6][3]};
  });
  assert.equal(checks.assets,checks.liabilities);assert.equal(checks.income,4318);
  await page.getByRole('button',{name:'Включить тёмную тему',exact:true}).click();
  await page.reload();assert.ok(await page.locator('body').evaluate(e=>e.classList.contains('dark')));
  await page.screenshot({path:path.join(__dirname,`qa-accounting-${width}.png`),fullPage:true});
  await page.evaluate(()=>location.hash='people');await page.getByRole('heading',{name:'Люди: движение и удержание',exact:true}).waitFor();
  await page.goBack();await page.getByRole('heading',{name:'Финансы: бухгалтерская отчетность',exact:true}).waitFor();
  await page.evaluate(()=>location.hash='overview');await page.getByRole('heading',{name:'Компания за минуту',exact:true}).waitFor();
  assert.match(await page.locator('main > .notice').innerText(),/Фактические источники/);
  assert.deepEqual(errors,[]);console.log('PASS accounting, reconciliation, theme, navigation, mobile '+width);await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

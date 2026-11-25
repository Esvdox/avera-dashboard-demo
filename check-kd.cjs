const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const expected = [
  'nnnnnynnnnnnnn', 'nnnnppnnnpnnnn', 'nnnnpynnnyyyyy', 'nnnnyynnnyyyyy',
  'nnnnyynnnyyynn', 'nnnnyynnnpnnnn', 'nnnnppnnnpnnnn', 'pnnnnnnnnnnnnn'
];
async function run() {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH});
  try {
    for (const width of [320,390,1024,1440]) {
      const page = await browser.newPage({viewport:{width,height:width < 600 ? 844 : 900},hasTouch:width < 600});
      const activate = locator => width < 600 ? locator.tap() : locator.click();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.AVERA_URL || pathToFileURL(path.join(__dirname,'index.html')).href);
      const menu = page.getByRole('button',{name:'Открыть меню',exact:true});
      if (await menu.isVisible()) await menu.click();
      await page.getByRole('navigation').getByRole('link',{name:'Продукты и КБ',exact:true}).click();
      const matrix = page.locator('.kb-matrix table:visible');
      await matrix.waitFor();
      for (const theme of ['light','dark']) {
        if (await page.locator('body').evaluate(b=>b.classList.contains('dark')) !== (theme==='dark')) await page.locator('#theme').click();
        const cols = await matrix.locator('.kb-cell .kb-mark').evaluateAll(marks=>marks.map(m=>m.className.slice(-1)));
        const isDesktop = await matrix.evaluate(t=>t.classList.contains('kb-desktop'));
        assert.ok(await matrix.getByText("Цепочная карусель 46,6 м", {exact:true}).isVisible());
        assert.equal(await page.locator('.kb-section > p').count(),0);
        assert.equal(isDesktop,width > 760);
        assert.ok(await matrix.getByText(/Узлы, %/).innerText().then(t=>t.includes('02.11')));
        assert.equal(cols.length,112);
        expected.forEach((row,i)=>[...row].forEach((s,j)=>assert.equal(cols[isDesktop?14*i+j:8*j+i],s)));
        assert.deepEqual(await matrix.locator('.kb-pct').allTextContents(),isDesktop ? ['100%','94,5%*','100%','99,8%','99,2%','85%','17,5%*','×'] : ['100','94,5*','100','99,8','99,2','85','17,5*','×']);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
        if(process.env.KB_PREVIEW && [390,1440].includes(width)) await page.screenshot({path:path.join(process.env.KB_PREVIEW,'kb-'+width+'-'+theme+'.png'),fullPage:true});
      }
      await activate(matrix.getByRole('button',{name:/Колесо 39 м · Общая 3D-модель/}));
      const dialog = page.getByRole('dialog',{name:/Колесо 39 м/});
      assert.ok(await dialog.getByText(/модели отдельных узлов/).isVisible());
      await activate(dialog.getByRole('button',{name:'Закрыть'}));
      assert.equal(await page.locator('.kb-register .kb-record').count(),13);
      assert.equal(await page.locator('.kb-nodes li').count(),129);
      const card = page.locator('[data-record="KD-06"]');
      await activate(card.locator(':scope > summary'));
      await activate(card.locator('.kb-nodes summary'));
      assert.equal(await card.locator('li:visible').count(),36);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
      if (process.env.KB_PREVIEW && [390,1440].includes(width)) {
        await card.locator(':scope > summary').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(process.env.KB_PREVIEW,'kb-detail-'+width+'.png')});
      }
      await activate(card.locator(':scope > summary'));
      await activate(page.locator('.kb-section > .kb-record > summary'));
      assert.equal(await page.locator('.kb-section > .kb-record tbody tr:visible').count(),7);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
      await page.locator('.kb-details > summary').click();
      assert.ok(await page.getByText(/в формуле J131/).isVisible());
      await page.reload();
      await matrix.waitFor();
      await page.goBack();
      await page.getByRole('heading',{name:'Сводка по компании',exact:true}).waitFor();
      await page.goForward();
      await matrix.waitFor();
      assert.deepEqual(errors,[]);
      await page.close();
      console.log('PASS',width);
    }
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});

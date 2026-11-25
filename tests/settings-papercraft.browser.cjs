const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/YOUTH259/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('settings.html');
const html = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, script => script.includes('data-settings-view') ? script : '')
  .replace(/<link\b[^>]*href="([^"?]+)(?:\?[^\"]*)?"[^>]*>/g, (_, file) => `<style>${read(file)}</style>`)
  .replace(' inert', '');
const moduleText = text => text.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '')
  .replaceAll('import.meta.url', '"https://offline.test/js/exam-preview.js"');
const script = source.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    for (const view of ['teacher','admin','accounts']) {
      const page = await browser.newPage({viewport:{width:1440,height:1000}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().isNavigationRequest()
        ? route.fulfill({contentType:'text/html',body:html}) : route.abort());
      await page.goto(`https://offline.test/settings.html${view==='accounts'?'?view=accounts':''}`);
      assert.equal(await page.locator('body').evaluate(el=>el.classList.contains(location.search.includes('accounts')?'accounts-redesign-page':'settings-redesign-page')),true);
      assert.equal(await page.locator('.topbar').count(),0, 'old title markup is removed before initialization');
      await page.addScriptTag({content:read('js/icons.js')+'\n'+read('js/core.js')+'\n'+read('js/avatar.js')+'\n'+moduleText(read('js/exam-preview.js'))+`
        const testUser={uid:'test',role:${JSON.stringify(view==='teacher'?'teacher':'admin')},displayName:'離線測試',email:'test@example.test',school:'測試學校'};
        const preferences={header:{titleText:'預設表頭'},appearance:{font:'system',fontSize:16,lineHeight:1.3}};
        window.DataService={getCurrentUser:()=>testUser,isAdmin:()=>testUser.role==='admin',isPrimaryAdmin:()=>testUser.role==='admin',
          getExamPreferences:()=>preferences,updateExamPreferences:async patch=>Object.assign(preferences,patch),
          getSubjects:async()=>[{id:'a',code:'A',name:'測試科目'}],getBooks:async()=>[{code:'B1',name:'第一冊'},{code:'B2',name:'第二冊'}],getVisibleCatalog:()=>null,
          getTextbankMode:()=> 'static',isTextbankStatusVisible:()=>false,getUsers:async()=>[testUser,{id:'teacher',uid:'teacher',role:'teacher',displayName:'測試教師',email:'teacher@example.test',school:'測試學校'}],getExamCountForUser:async()=>3,
          preserveExamAppearances:async()=>{},preserveExamHeaders:async()=>{}};
        const guardPage=async()=>testUser;
        const confirmAction=async()=>false,confirmDeletion=async()=>false;
        const DOWNLOAD_TYPES=[];
        window.AppShell={refreshAccount(){}};
        (async()=>{${moduleText(script)}\nwindow.settingsReady=true;})().catch(error=>window.settingsBootError=error.message);
      `});
      await page.waitForFunction(()=>window.settingsReady || window.settingsBootError);
      assert.equal(await page.evaluate(()=>window.settingsBootError),undefined);
      if (view==='accounts') {
        assert.equal(await page.locator('body.settings-redesign-page').count(),0);
        assert.equal(await page.locator('.paper-corner').count(),2);
        assert(await page.locator('#spanel-accounts').isVisible());
        await page.waitForFunction(()=>document.getElementById('userCount')?.textContent.includes('2'));
        const infoButton=page.locator('#userTbody .btn-ghost').first();
        await infoButton.hover();
        assert.equal(await infoButton.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(246, 241, 231)');
        await page.locator('#userTbody tr').first().locator('td').first().hover();
        assert.equal(await infoButton.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(246, 241, 231)');
        assert(await page.locator('#userTbody tr').filter({hasText:'主要管理員'}).getByRole('button',{name:'刪除',exact:true}).isDisabled());
        assert.equal(await page.locator('.accounts-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(246, 241, 231)');
        await page.locator('#searchInput').fill('測試教師');
        assert.equal(await page.locator('#userTbody tr').count(),1);
        await page.locator('#searchInput').fill('');
        await page.locator('#roleFilter').selectOption('teacher');
        assert.equal(await page.locator('#userTbody tr').count(),1);
        await page.locator('#userTbody').getByRole('button',{name:'資訊',exact:true}).click();
        await page.waitForFunction(()=>document.getElementById('accountInfoCurrent').textContent==='3');
        assert.equal(await page.locator('#accountInfoUid').innerText(),'teacher');
        await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedUid=text;}}}));
        await page.locator('#copyAccountUid').click();
        await page.getByText('已複製UID',{exact:true}).waitFor({state:'visible'});
        assert.equal(await page.evaluate(()=>window.copiedUid),'teacher');
        assert.equal(await page.locator('#accountInfoModal .modal-close').evaluate(el=>getComputedStyle(el).width),'30px');
        await page.locator('#accountInfoModal .modal-close').click();
        await page.locator('#addUserBtn').click();
        assert(await page.locator('#userModal').isVisible());
        assert.equal(await page.locator('#userModal .modal').evaluate(el=>getComputedStyle(el).overflow),'visible');
        await page.locator('#userModal .modal-close').click();
        for(const width of [1440,768,390]){
          await page.setViewportSize({width,height:1000});
          assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`${width}px accounts page overflow`);
        }
      } else {
        await page.waitForFunction(()=>document.getElementById('catalogChoices')?.getAttribute('aria-busy')==='false');
        assert.equal(await page.locator('.paper-corner').count(),2);
        const tabs=view==='admin'?['profile','subjects','appearance','textbank']:['profile','subjects','appearance'];
        assert.equal(await page.locator('.settings-tab').count(),tabs.length);
        for (const tab of tabs) {
          await page.locator('#stab-'+tab).click();
          assert(await page.locator('#spanel-'+tab).isVisible());
          await page.waitForFunction(id=>getComputedStyle(document.getElementById(id)).backgroundColor==='rgba(0, 0, 0, 0)','stab-'+tab);
          assert.equal(await page.locator('#stab-'+tab).evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
          assert.equal(await page.locator('.settings-tabs').evaluate(el=>getComputedStyle(el).borderBottomWidth),'0px');
          assert.equal(await page.locator('#spanel-'+tab+' .card').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(246, 241, 231)');
          for (const width of [1440,768,390]) {
            await page.setViewportSize({width,height:1000});
            assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`${view} ${tab} ${width}px overflow`);
            if (process.env.SAVE_SETTINGS_SCREENSHOTS && view==='admin' && width===1440) {
              const file=path.join(process.env.TEMP,`settings-paper-${tab}.png`);
              await page.screenshot({path:file,fullPage:true});console.log(file);
            }
          }
        }
        await page.locator('#stab-subjects').click();
        await page.locator('#stab-appearance').click();
        for (const [field,actions] of [['#defaultExamLineHeight','#appearanceSave'],['#examMargin-right','#examMarginsSave']]) {
          const gap=await page.evaluate(({field,actions})=>document.querySelector(actions).parentElement.getBoundingClientRect().top-document.querySelector(field).getBoundingClientRect().bottom,{field,actions});
          assert.equal(gap,16,'form controls and actions have a single consistent gap');
        }
        if(view==='admin') assert.equal(await page.locator('#textbankModeStatus').evaluate(el=>getComputedStyle(el).marginTop),'0px');
        await page.locator('#stab-subjects').click();
        await page.locator('#catalogClearAll').click();
        assert.equal(await page.locator('.catalog-book-check:checked').count(),0);
        await page.locator('#catalogSelectAll').click();
        assert.equal(await page.locator('.catalog-book-check:checked').count(),2);
        await page.locator('#stab-profile').click();
        await page.locator('#currentPassword').fill('example-password');
        await page.locator('[data-toggle="currentPassword"]').click();
        assert.equal(await page.locator('#currentPassword').getAttribute('type'),'text');
        for (const [button,modal] of [['editProfileBtn','profileModal'],['editAvatarBtn','avatarModal']]) {
          await page.locator('#'+button).click();
          assert(await page.locator('#'+modal).isVisible());
          assert.equal(await page.locator('#'+modal+' .modal').evaluate(el=>getComputedStyle(el).overflow),'visible');
          assert.equal(await page.locator('#'+modal+' .modal-close').evaluate(el=>getComputedStyle(el).width),'30px');
          await page.locator('#'+modal+' .modal-close').click();
        }
      }
      assert.deepEqual(errors,[],`${view}: browser errors`);
      console.log(`PASS ${view}: tabs, paper styling, responsive layout and scoped changes`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exit(1);});

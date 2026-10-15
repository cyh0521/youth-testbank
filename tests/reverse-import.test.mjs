import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const source = readFileSync(new URL('../js/reverse-import.js', import.meta.url), 'utf8');
const zipSource = readFileSync(new URL('../vendor/jszip.min.js', import.meta.url), 'utf8');

test('舊版題本的另列答案分離至答案欄，保留空格、解析與選擇題答案', async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: zipSource });
    const result = await page.evaluate(async source => {
      const { readBooklet } = await import('data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(source))));
      const paragraphs = [
        '三、填空題', '編碼：00473 難易度：簡易題 來源：課本',
        ' 1.國防政策並非局限於____________。【P.92】', '【答案】軍事事務。',
        '編碼：00474 難易度：簡易題 來源：課本',
        '２．填入______與______。', '【答案】第一項', '第二項', '【解析】解析內容。',
        '編碼：00475 難易度：簡易題 來源：課本', '3.缺少答案______。',
        '四、配合題', '編碼：00483 難易度：較難題 來源：課本',
        '1.請填入適當選項：（ ）（1）敘述', '【答案】（1）D',
        '五、選擇題', '編碼：00484 難易度：簡易題 來源：課本',
        '（A）1.選出答案。(A)甲(B)乙。',
        '編碼：00764 難易度：簡易題 來源：課本',
        '（Ａ）3. (A)災害防救法 (B)全民防衛動員準備法 (C)民防法 (D)國防法 的主旨是為了健全災害防救體制，強化災害防救功能，確保人民生命、財產與國土安全。【P.32】',
        '六、問答題', '編碼：00485 難易度：簡易題 來源：課本',
        '1.請說明國防政策。【P.100】', '【答案】（1）第一項。', '（2）第二項。',
        '【解析】補充說明。'
      ];
      const zip = new JSZip();
      zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs.map(text => '<w:p><w:r><w:t>' + text + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>');
      zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
      const result = await readBooklet(await zip.generateAsync({ type: 'uint8array' }));
      const optionFirst = result.questions.find(q => q._id === '00764');
      const fields = ['題型','題目','選項1','選項2','選項3','選項4','結尾','簡答/答案'];
      const cell = value => '<w:tc><w:p><w:r><w:t>' + value + '</w:t></w:r></w:p></w:tc>';
      zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr>' + fields.map(cell).join('') + '</w:tr><w:tr>' + fields.map(field => cell(optionFirst[field])).join('') + '</w:tr></w:tbl></w:body></w:document>');
      result.tableRoundtrip = (await readBooklet(await zip.generateAsync({type:'uint8array'}))).questions[0];
      return result;
    }, source);
    const [blank, multiline, missing, matching, choice, optionFirst, essay] = result.questions;
    assert.equal(blank['簡答/答案'], '軍事事務。');
    assert.equal(blank['題目'], '國防政策並非局限於____________。');
    assert.equal(blank['頁數/出處'], 'P.92');
    assert.equal(multiline['簡答/答案'], '第一項\u2029第二項');
    assert.equal(multiline['題目'], '填入______與______。');
    assert.equal(multiline['詳答/解析'], '解析內容。');
    assert.equal(missing['簡答/答案'], '');
    assert.deepEqual(result.warnings, ['編碼 00475 缺少答案，請補填']);
    assert.equal(matching['簡答/答案'], '（1）D');
    assert(!matching['題目'].includes('【答案】'));
    assert.equal(choice['簡答/答案'], 'Ａ');
    assert.equal(choice['選項1'], '甲');
    assert.equal(optionFirst['題目'], '');
    assert.equal(optionFirst['結尾'], '的主旨是為了健全災害防救體制，強化災害防救功能，確保人民生命、財產與國土安全。');
    assert.equal(optionFirst['選項4'], '國防法');
    assert.equal(optionFirst['簡答/答案'], 'Ａ');
    assert.equal(optionFirst['頁數/出處'], 'P.32');
    assert.equal(result.tableRoundtrip['題目'], '');
    assert.equal(result.tableRoundtrip['結尾'], optionFirst['結尾']);
    assert.equal(result.tableRoundtrip['選項4'], '國防法');
    assert.equal(essay['題型'], 'T6');
    assert.equal(essay['題目'], '請說明國防政策。');
    assert.equal(essay['簡答/答案'], '（1）第一項。\u2029（2）第二項。');
    assert.equal(essay['詳答/解析'], '補充說明。');
    assert.equal(essay['頁數/出處'], 'P.100');
  } finally {
    await browser.close();
  }
});

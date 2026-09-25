// 將試卷預覽 DOM 轉為真正的 OOXML Word 文件。
const mmToTwips = mm => Math.round(Number(mm) * 1440 / 25.4);
const pxToTwips = px => Math.round(Number(px) * 15);
const HEADER_LINE_HEIGHT = 1.6;

function wordFont(fontId) {
  if (fontId === 'serif') return 'Noto Serif TC';
  if (fontId === 'kaiti') return '標楷體';
  if (fontId === 'sans') return 'Noto Sans TC';
  return 'Microsoft JhengHei';
}

async function nodeRuns(node, docx, base) {
  if (node.nodeType === 3) return node.textContent ? [new docx.TextRun({ text:node.textContent, ...base })] : [];
  if (node.nodeType !== 1) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return [new docx.TextRun({ break:1 })];
  if (tag === 'img') {
    try {
      const response = await fetch(node.currentSrc || node.src);
      if (!response.ok) throw new Error('圖片無法下載');
      const mime = response.headers.get('content-type') || '';
      const type = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('gif') ? 'gif' : null;
      if (!type) throw new Error('不支援的圖片格式');
      const width = Math.min(Number(node.getAttribute('width')) || node.naturalWidth || 240, 500);
      const naturalWidth = Number(node.getAttribute('width')) || node.naturalWidth || width;
      const naturalHeight = Number(node.getAttribute('height')) || node.naturalHeight || 120;
      const height = Math.max(1, Math.round(width * naturalHeight / naturalWidth));
      return [new docx.ImageRun({ data:new Uint8Array(await response.arrayBuffer()), type, transformation:{ width, height } })];
    } catch { return [new docx.TextRun({ text:node.alt || '［圖片］', ...base })]; }
  }
  const style = { ...base };
  if (tag === 'b' || tag === 'strong') style.bold = true;
  if (tag === 'i' || tag === 'em') style.italics = true;
  if (tag === 'u') style.underline = {};
  const runs = [];
  for (const child of node.childNodes) runs.push(...await nodeRuns(child, docx, style));
  return runs;
}

async function runsFromNodes(nodes, docx, base) {
  const runs = [];
  for (const node of nodes) runs.push(...await nodeRuns(node, docx, base));
  return runs;
}

export async function createDocxBlob({ docx, content, title, appearance, margins, paperSize, columns }) {
  const font = wordFont(appearance.font);
  const fontSize = Math.round(appearance.fontSize * 1.5); // px → half-points
  const line = pxToTwips(appearance.fontSize * appearance.lineHeight);
  const baseRun = { font:{ ascii:font, hAnsi:font, eastAsia:font }, size:fontSize, snapToGrid:false };
  const spacing = { line, lineRule:docx.LineRuleType.EXACT, after:pxToTwips(8) };
  const paragraph = (runs, options = {}) => new docx.Paragraph({ children:runs.length ? runs : [new docx.TextRun('')], spacing, ...options });
  const header = [];
  const rows = [...content.querySelectorAll('.ep-exam-header .ep-header-row')];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const isTitle = rows[rowIndex].classList.contains('title-row');
    const headerFontSize = appearance.fontSize * .94 * (isTitle ? 1.05 : 1);
    const headerRun = { ...baseRun, size:Math.round(headerFontSize * 1.5), bold:isTitle };
    const spans = [...rows[rowIndex].querySelectorAll(':scope > span')];
    const runs = [];
    for (let index = 0; index < spans.length; index++) {
      if (index) runs.push(new docx.TextRun({ text:isTitle ? '\u2002' : '\u3000', ...headerRun }));
      runs.push(...await runsFromNodes(spans[index].childNodes, docx, headerRun));
    }
    header.push(paragraph(runs, {
      spacing:{ ...spacing, line:pxToTwips(headerFontSize * HEADER_LINE_HEIGHT), after:rowIndex === rows.length - 1 ? pxToTwips(14) : pxToTwips(6) },
      ...(rowIndex === rows.length - 1 ? { border:{ bottom:{ style:docx.BorderStyle.SINGLE, color:'333333', size:12, space:8 } } } : {}),
    }));
  }
  if (!header.length) header.push(paragraph([]));

  const questions = [];
  const questionArea = content.querySelector('.ep-question-columns');
  for (const item of questionArea?.children || []) {
    if (item.classList.contains('ep-section-head')) {
      questions.push(paragraph(await runsFromNodes(item.childNodes, docx, { ...baseRun, bold:true }), {
        spacing:{ ...spacing, before:pxToTwips(14), after:pxToTwips(8) },
      }));
      continue;
    }
    if (!item.classList.contains('ep-q') && !item.classList.contains('ep-word-question')) continue;
    if (item.classList.contains('ep-word-question')) {
      const indent = pxToTwips(parseFloat(item.style.marginLeft) || appearance.fontSize * 4.8);
      questions.push(paragraph(await runsFromNodes(item.childNodes, docx, baseRun), {
        alignment:docx.AlignmentType.JUSTIFIED,
        indent:{ left:indent, hanging:indent },
      }));
      continue;
    }
    const inlineNodes = [...item.childNodes].filter(node => node.nodeType !== 1 || node.tagName !== 'DIV');
    questions.push(paragraph(await runsFromNodes(inlineNodes, docx, baseRun), {
      alignment:docx.AlignmentType.JUSTIFIED,
    }));
    for (const child of item.children) {
      if (child.tagName === 'DIV') questions.push(paragraph(await runsFromNodes(child.childNodes, docx, baseRun), {
        indent:{ left:pxToTwips(appearance.fontSize * 1.5) },
      }));
    }
  }
  if (!questions.length) questions.push(paragraph([]));

  const answers = [];
  const answerArea = content.querySelector('.ep-answers');
  if (answerArea) {
    for (const [index, child] of [...answerArea.children].entries()) {
      const isHeading = index === 0;
      answers.push(paragraph(await runsFromNodes(child.childNodes, docx, { ...baseRun, bold:isHeading }), isHeading ? {
        spacing:{ ...spacing, before:pxToTwips(20), after:pxToTwips(8) },
        border:{ top:{ style:docx.BorderStyle.DASHED, color:'AAAAAA', size:12, space:9 } },
      } : {}));
    }
  }

  const page = {
    size:{ width:mmToTwips(paperSize.width), height:mmToTwips(paperSize.height) },
    margin:Object.fromEntries(['top','right','bottom','left'].map(side => [side, mmToTwips(margins[side])])),
  };
  const sections = columns === 2
    ? [
        { properties:{ page }, children:header },
        { properties:{ page, type:docx.SectionType.CONTINUOUS, column:{ count:2, space:mmToTwips(5) } }, children:questions },
        ...(answers.length ? [{ properties:{ page, type:docx.SectionType.CONTINUOUS }, children:answers }] : []),
      ]
    : [{ properties:{ page }, children:[...header, ...questions, ...answers] }];
  return docx.Packer.toBlob(new docx.Document({ title, sections }));
}

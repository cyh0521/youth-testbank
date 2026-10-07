// 將試卷預覽 DOM 轉為真正的 OOXML Word 文件。
const mmToTwips = mm => Math.round(Number(mm) * 1440 / 25.4);
const pxToTwips = px => Math.round(Number(px) * 15);
const HEADER_LINE_HEIGHT = 1.6;
const QUESTION_PARAGRAPH_BREAK = Symbol('questionParagraphBreak');
const QUESTION_ANALYSIS_BREAK = Symbol('questionAnalysisBreak');
const QUESTION_ANSWER_BREAK = Symbol('questionAnswerBreak');

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
  if (node.classList?.contains('question-paragraph-break')) return [QUESTION_PARAGRAPH_BREAK];
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
  if (node.classList?.contains('ep-answer-value') || node.classList?.contains('ep-answer-label')) style.color = 'B4232C';
  if (node.classList?.contains('ep-q-analysis')) style.color = '245FA5';
  if (node.classList?.contains('ep-q-source')) style.color = '27734C';
  if (node.classList?.contains('ep-q-difficulty')) {
    style.size = Math.round(base.size * .75);
    style.bold = true;
    const hard = node.classList.contains('is-hard');
    const easy = node.classList.contains('is-easy');
    style.color = hard ? 'A34D17' : easy ? '237553' : '526780';
    style.shading = {fill:hard ? 'FFF0E5' : easy ? 'E3F3EC' : 'EDF1F6'};
  }
  if (tag === 'b' || tag === 'strong') style.bold = true;
  if (tag === 'i' || tag === 'em') style.italics = true;
  if (tag === 'u') style.underline = {};
  const runs = [];
  if (node.classList?.contains('ep-q-analysis')) runs.push(QUESTION_ANALYSIS_BREAK);
  else if (node.classList?.contains('ep-answer-blank') || node.classList?.contains('ep-essay-blank')) runs.push(QUESTION_ANSWER_BREAK);
  for (const child of node.childNodes) runs.push(...await nodeRuns(child, docx, style));
  return runs;
}

async function runsFromNodes(nodes, docx, base) {
  const runs = [];
  for (const node of nodes) runs.push(...await nodeRuns(node, docx, base));
  return runs;
}

function splitQuestionParagraphs(runs) {
  const parts = [[]];
  for (const run of runs) {
    if (run === QUESTION_ANALYSIS_BREAK) {
      const analysis = [];
      analysis.isAnalysis = true;
      parts.push(analysis);
    }
    else if (run === QUESTION_ANSWER_BREAK) {
      const answer = [];
      answer.isAnswer = true;
      parts.push(answer);
    }
    else if (run === QUESTION_PARAGRAPH_BREAK) parts.push([]);
    else parts.at(-1).push(run);
  }
  return parts;
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

  const questions = [];
  const questionArea = content.querySelector('.ep-question-columns');
  for (const item of questionArea?.children || []) {
    if (item.classList.contains('ep-response-grid')) {
      const count = Number(item.dataset.columns) || 1;
      const rowLines = Number(item.dataset.rowLines) === 4 ? 4 : 1.5;
      const verticalAlign = item.dataset.verticalAlign === 'top' ? docx.VerticalAlign.TOP : docx.VerticalAlign.CENTER;
      const numberWidth = Number(item.dataset.numberWidth) || 4;
      const centerAnswers = item.dataset.answerAlign === 'center';
      const border = {style:docx.BorderStyle.SINGLE, color:'555555', size:6};
      const rows = [];
      for (const row of item.rows) {
        const cells = [];
        for (const cell of row.cells) {
          const isNumber = cell.classList.contains('ep-response-number');
          const children = [];
          for (const lineNode of cell.children) {
            children.push(paragraph(await runsFromNodes(lineNode.childNodes, docx, baseRun), {
              spacing:{...spacing, before:0, after:0},
              alignment:isNumber || centerAnswers ? docx.AlignmentType.CENTER : docx.AlignmentType.LEFT,
            }));
          }
          cells.push(new docx.TableCell({
            width:{size:isNumber ? numberWidth : 100 / count - numberWidth,type:docx.WidthType.PERCENTAGE},
            verticalAlign:isNumber ? docx.VerticalAlign.CENTER : verticalAlign,
            margins:{top:pxToTwips(2),bottom:pxToTwips(2),left:pxToTwips(2),right:pxToTwips(2)},
            borders:{top:border,bottom:border,left:border,right:border},
            children:children.length ? children : [paragraph([],{spacing:{...spacing,after:0}})],
          }));
        }
        rows.push(new docx.TableRow({children:cells,cantSplit:true,height:{value:line * rowLines + pxToTwips(4),rule:docx.HeightRule.ATLEAST}}));
      }
      const contentWidth = (paperSize.width - Number(margins.left) - Number(margins.right) - (columns === 2 ? 10 : 0)) / (columns === 2 ? 2 : 1);
      const columnWidths = Array.from({length:count}, () => [mmToTwips(contentWidth * numberWidth / 100), mmToTwips(contentWidth * (1 / count - numberWidth / 100))]).flat();
      questions.push(new docx.Table({rows,columnWidths,width:{size:100,type:docx.WidthType.PERCENTAGE},layout:docx.TableLayoutType.FIXED}));
      continue;
    }
    if (item.classList.contains('ep-booklet-chapter-spacer')) {
      questions.push(paragraph([], { spacing:{ ...spacing, before:0, after:0 } }));
      continue;
    }
    if (item.classList.contains('ep-word-meta')) {
      questions.push(paragraph(await runsFromNodes(item.childNodes, docx, { ...baseRun, color:'000000' }), {
        spacing:{ ...spacing, after:pxToTwips(6) },
      }));
      continue;
    }
    if (item.classList.contains('ep-section-head')) {
      const chapterLine = item.classList.contains('ep-booklet-chapter-line');
      const chapterEnd = item.classList.contains('ep-booklet-chapter-end');
      questions.push(paragraph(await runsFromNodes(item.childNodes, docx, { ...baseRun, bold:true, size:fontSize }), {
        spacing:{ ...spacing, line, before:pxToTwips(chapterLine ? 0 : 14), after:pxToTwips(chapterEnd ? 22 : chapterLine ? 6 : 8) },
        ...(chapterEnd ? { border:{ bottom:{ style:docx.BorderStyle.SINGLE, color:'000000', size:6, space:12 } } } : {}),
      }));
      continue;
    }
    if (!item.classList.contains('ep-q') && !item.classList.contains('ep-word-question')) continue;
    if (item.classList.contains('ep-word-question')) {
      const indent = pxToTwips(parseFloat(item.style.marginLeft) || appearance.fontSize * 4.8);
      const questionGap = parseFloat(item.style.marginBottom) || 8;
      const parts = splitQuestionParagraphs(await runsFromNodes(item.childNodes, docx, baseRun));
      const analysisIndent = Number(item.dataset?.analysisIndent);
      const analysisOffset = Number(item.dataset?.analysisOffset) || 0;
      const analysisGap = Number(item.dataset?.analysisGap ?? 6);
      const answerIndent = Number(item.dataset?.answerIndent);
      parts.forEach((runs, index) => questions.push(paragraph(runs, {
        alignment:docx.AlignmentType.LEFT,
        indent:runs.isAnalysis && Number.isFinite(analysisIndent) ? { left:pxToTwips(analysisOffset + analysisIndent), hanging:pxToTwips(analysisIndent) } : runs.isAnswer && Number.isFinite(answerIndent) ? {left:indent + pxToTwips(answerIndent), hanging:pxToTwips(answerIndent)} : index ? { left:indent } : { left:indent, hanging:indent },
        spacing:{ ...spacing, before:runs.isAnalysis ? pxToTwips(Number.isFinite(analysisIndent) ? analysisGap : 2) : runs.isAnswer ? pxToTwips(4) : index ? pxToTwips(appearance.fontSize * .45) : 0, after:index === parts.length - 1 ? pxToTwips(questionGap) : 0 },
      })));
      continue;
    }
    const inlineNodes = [...item.childNodes].filter(node => node.nodeType !== 1 || node.tagName !== 'DIV');
    const parts = splitQuestionParagraphs(await runsFromNodes(inlineNodes, docx, baseRun));
    parts.forEach((runs, index) => questions.push(paragraph(runs, {
      alignment:docx.AlignmentType.LEFT,
      spacing:{ ...spacing, before:index ? pxToTwips(appearance.fontSize * .45) : 0, after:index === parts.length - 1 ? pxToTwips(8) : 0 },
    })));
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
        ...(header.length ? [{ properties:{ page }, children:header }] : []),
        { properties:{ page, type:docx.SectionType.CONTINUOUS, column:{ count:2, space:mmToTwips(10) } }, children:questions },
        ...(answers.length ? [{ properties:{ page, type:docx.SectionType.CONTINUOUS }, children:answers }] : []),
      ]
    : [{ properties:{ page }, children:[...header, ...questions, ...answers] }];
  return docx.Packer.toBlob(new docx.Document({ title, sections }));
}

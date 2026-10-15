// 正式編號取得後才重新命名；同一題重複引用的圖片共用同一個檔名。
export function prepareImportImages(question, questionNumber, sources) {
  const entries = new Map();
  const paths = new Map();
  const replace = value => String(value ?? '').replace(
    /\[\[圖片:([^|\]\r\n]+)\|(\d{1,4})\|([^\]\r\n]*)\]\]/g,
    (marker, path, width, alt) => {
      if (!sources.has(path)) return marker;
      if (!paths.has(path)) {
        const extension = path.match(/\.(png|jpe?g)$/i)?.[1].toLowerCase();
        if (!extension) throw new Error(`不支援的入題圖片：${path}`);
        const renamed = `images/${questionNumber}-${paths.size + 1}.${extension}`;
        paths.set(path, renamed);
        entries.set(renamed, sources.get(path));
      }
      return `[[圖片:${paths.get(path)}|${width}|${alt}]]`;
    }
  );
  const prepared = {...question};
  for (const key of ['text', 'tail', 'answer', 'analysis']) {
    if (typeof prepared[key] === 'string') prepared[key] = replace(prepared[key]);
  }
  if (Array.isArray(prepared.options)) prepared.options = prepared.options.map(replace);
  return {question:prepared, entries};
}

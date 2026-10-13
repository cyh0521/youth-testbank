// 流程切換只淡入，不移動版面；尊重使用者的減少動態效果設定。
(() => {
  const panels = document.querySelectorAll('.manual-panel,.coded-panel,#bookletPanel1,#bookletPanel2');
  const observer = new MutationObserver(records => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const panel of new Set(records.map(record => record.target))) {
      if (panel.hidden) continue;
      for (const animation of panel.getAnimations()) animation.cancel();
      panel.animate([{opacity:0},{opacity:1}], {duration:180,easing:'ease-out'});
    }
  });
  for (const panel of panels) observer.observe(panel, {attributes:true,attributeFilter:['hidden']});
  const manualLayout = document.querySelector('#manualPanel2 .selection-layout');
  if (manualLayout) {
    const headers = [...manualLayout.querySelectorAll(':scope>.card>.card-header')];
    let previousWidth = -1;
    new ResizeObserver(() => {
      const width = manualLayout.clientWidth;
      if (!width || width === previousWidth) return;
      previousWidth = width;
      headers.forEach(header => header.style.removeProperty('min-height'));
      if (window.matchMedia('(min-width:1101px)').matches) {
        const height = Math.max(...headers.map(header => header.getBoundingClientRect().height));
        headers.forEach(header => header.style.minHeight = `${height}px`);
      }
    }).observe(manualLayout);
  }
})();

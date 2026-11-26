// Shared Escape behavior. Use each dialog's close action rather than hiding it directly.
(() => {
  const selector = '.modal-overlay:not(.compose-inline-preview):not(.ep-management-preview),.gc-overlay';
  const states = new Map();
  let sequence = 0, confirming = false;
  const visible = element => !element.hidden && !element.classList.contains('hidden') && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
  const values = dialog => JSON.stringify([...dialog.querySelectorAll('input,textarea,select')].filter(e => !e.disabled && !['hidden','button','submit'].includes(e.type)).map(e => [e.id,e.name,e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value]));
  const sync = () => {
    for (const [element] of states) if (!element.isConnected || !visible(element)) states.delete(element);
    document.querySelectorAll(selector).forEach(element => {
      if (visible(element) && !states.has(element)) states.set(element, {order:++sequence, initial:null});
    });
  };
  // Capture the form before its first user edit, after asynchronous initialization.
  document.addEventListener('focusin', event => {
    sync();
    const dialog = event.target.closest(selector), state = states.get(dialog);
    if (state && state.initial === null) state.initial = values(dialog);
  }, true);
  document.addEventListener('keydown', async event => {
    if (event.key !== 'Escape' || event.isComposing) return;
    sync();
    const dialogs = [...states].sort(([a,sa],[b,sb]) => (Number.parseInt(getComputedStyle(b).zIndex) || 0) - (Number.parseInt(getComputedStyle(a).zIndex) || 0) || sb.order - sa.order);
    const [dialog,state] = dialogs[0] || [];
    if (!dialog) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if ((confirming && dialog.getAttribute('aria-labelledby') !== 'deleteExamDialogTitle') || dialog.matches('[aria-busy="true"]') || dialog.querySelector('[aria-busy="true"]')) return;
    const close = dialog.querySelector('.modal-close,.gc-close,[data-choice="cancel"]');
    if (!close || close.disabled || close.getAttribute('aria-disabled') === 'true') return;
    const edited = state.initial !== null && state.initial !== values(dialog);
    // Dialogs that contain a save action may discard local edits on closing.
    const saves = [...dialog.querySelectorAll('button')].some(button => /儲存|新增帳號|確認修改/.test(button.textContent));
    if (edited && saves) {
      confirming = true;
      try {
        const {confirmAction} = await import('./confirm-exam-deletion.js');
        const discard = await confirmAction({title:'尚有未儲存的變更',message:'關閉後將放棄這次尚未儲存的修改，確定要關閉嗎？',actionLabel:'放棄修改'});
        if (!discard || !visible(dialog) || close.disabled) return;
      } finally { confirming = false; }
    }
    close.click();
  }, true);
  new MutationObserver(sync).observe(document.documentElement, {subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
  sync();
})();

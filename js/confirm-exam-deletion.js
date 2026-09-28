// Shared in-page confirmation for deleting a saved exam.
export function confirmExamDeletion(title) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'deleteExamDialogTitle');
    overlay.setAttribute('aria-describedby', 'deleteExamDialogMessage');
    overlay.innerHTML = `<div class="modal" style="max-width:440px">
      <div class="modal-header"><h3 id="deleteExamDialogTitle">刪除試卷</h3><button class="modal-close" type="button" data-choice="cancel" aria-label="關閉">✕</button></div>
      <div class="modal-body"><p id="deleteExamDialogMessage"></p><p style="margin-top:10px;color:var(--danger);font-size:.82rem">刪除後無法復原。</p></div>
      <div class="modal-footer"><button class="btn btn-ghost" type="button" data-choice="cancel">取消</button><button class="btn btn-danger" type="button" data-choice="delete">刪除試卷</button></div>
    </div>`;
    overlay.querySelector('#deleteExamDialogMessage').textContent = `確定要刪除試卷「${title}」？`;
    const finish = confirmed => {
      overlay.removeEventListener('keydown', onKeydown);
      overlay.remove();
      previousFocus?.focus?.();
      resolve(confirmed);
    };
    const onKeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      if (event.key === 'Tab') {
        const focusable = [...overlay.querySelectorAll('button')];
        const next = event.shiftKey ? focusable.at(-1) : focusable[0];
        if ((event.shiftKey && document.activeElement === focusable[0]) || (!event.shiftKey && document.activeElement === focusable.at(-1))) {
          event.preventDefault(); next.focus();
        }
      }
    };
    overlay.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', event => {
      const choice = event.target.closest('[data-choice]')?.dataset.choice;
      if (choice) finish(choice === 'delete');
      else if (event.target === overlay) finish(false);
    });
    document.body.appendChild(overlay);
    overlay.querySelector('[data-choice="cancel"]').focus();
  });
}

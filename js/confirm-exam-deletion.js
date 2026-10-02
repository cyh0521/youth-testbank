// Shared in-page confirmation for actions and deletions.
export function confirmAction({ title, message, actionLabel, destructive = false }) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'deleteExamDialogTitle');
    overlay.setAttribute('aria-describedby', 'deleteExamDialogMessage');
    overlay.innerHTML = `<div class="modal" style="max-width:440px">
      <div class="modal-header"><h3 id="deleteExamDialogTitle"></h3><button class="modal-close" type="button" data-choice="cancel" aria-label="關閉">✕</button></div>
      <div class="modal-body"><p id="deleteExamDialogMessage"></p>${destructive ? '<p style="margin-top:10px;color:var(--danger);font-size:.88rem">刪除後無法復原。</p>' : ''}</div>
      <div class="modal-footer"><button class="btn btn-ghost" type="button" data-choice="cancel">取消</button><button class="btn ${destructive ? 'btn-danger' : 'btn-primary'}" type="button" data-choice="confirm"></button></div>
    </div>`;
    overlay.querySelector('#deleteExamDialogTitle').textContent = title;
    overlay.querySelector('#deleteExamDialogMessage').textContent = message;
    overlay.querySelector('[data-choice="confirm"]').textContent = actionLabel;
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
      if (choice) finish(choice === 'confirm');
      else if (event.target === overlay) finish(false);
    });
    document.body.appendChild(overlay);
    overlay.querySelector('[data-choice="cancel"]').focus();
  });
}

export function confirmDeletion(options) {
  return confirmAction({ ...options, destructive:true });
}

export function confirmExamDeletion(title) {
  return confirmDeletion({
    title: '刪除試卷',
    message: `確定要刪除試卷「${title}」？`,
    actionLabel: '刪除試卷'
  });
}

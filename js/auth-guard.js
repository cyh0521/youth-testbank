/** 每頁驗證登入及角色；shell.js 只負責提前顯示導覽外觀。 */
import './firebase.js';

export async function guardPage(allowedRoles) {
  await window._dsReady;
  const user = DataService.getCurrentUser();
  if (!user) {
    window.AppShell.clear();
    window.location.replace('index.html');
    return null;
  }
  if (!['admin', 'teacher'].includes(user.role)) {
    window.AppShell.clear();
    await DataService.logout();
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.AppShell.clear();
    window.location.replace('dashboard.html');
    return null;
  }
  window.AppShell.confirmUser(user, window._activeNav || '');
  return user;
}

export function renderSidebar(el, active) {
  const user = DataService.getCurrentUser();
  if (el && user) window.AppShell.confirmUser(user, active);
}

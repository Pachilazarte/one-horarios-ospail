/* auth.js — OSPAIL */
const ADMIN_CREDS = { user: 'admin', pass: 'ospail2024' };
const SUPER_CREDS = { user: 'superadmin', pass: 'SuperAdmin2024!' };
const SESSION_KEY = 'adminSesion';
const LIDER_KEY   = 'liderSesion';
const SUPER_KEY   = 'superSesion';

const Auth = {
  loginAdmin(u, p) {
    if (ADMIN_CREDS.user === u && ADMIN_CREDS.pass === p) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ empresaId:'ospail', rol:'admin', ts:Date.now() }));
      return true;
    }
    return false;
  },
  isAdmin()     { try { return !!JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return false; } },
  getAdmin()    { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } },
  requireAdmin(){ if (!Auth.isAdmin()) window.location.href='index.html'; },
  logoutAdmin() { sessionStorage.removeItem(SESSION_KEY); },

  setLider(data) { sessionStorage.setItem(LIDER_KEY, JSON.stringify(data)); },
  getLider()     { try { return JSON.parse(sessionStorage.getItem(LIDER_KEY)); } catch { return null; } },
  isLider()      { return !!Auth.getLider(); },
  requireLider() { if (!Auth.isLider()) window.location.href='index.html'; },
  logoutLider()  { sessionStorage.removeItem(LIDER_KEY); },

  loginSuper(u, p) {
    if (SUPER_CREDS.user === u && SUPER_CREDS.pass === p) {
      sessionStorage.setItem(SUPER_KEY, JSON.stringify({ rol:'superadmin', ts:Date.now() }));
      return true;
    }
    return false;
  },
  isSuper()      { try { return !!JSON.parse(sessionStorage.getItem(SUPER_KEY)); } catch { return false; } },
  requireSuper() { if (!Auth.isSuper()) window.location.href='index.html'; },
  logoutSuper()  { sessionStorage.removeItem(SUPER_KEY); },

  logout() {
    [SESSION_KEY, LIDER_KEY, SUPER_KEY].forEach(k => sessionStorage.removeItem(k));
  },
};

// js/auth.js
// Sessão, cadastro, login, logout, perfil, guardas de rota.

let currentUser    = null;  // { id, email }
let currentProfile = null;  // { id, full_name, phone, is_admin }

async function loadSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadProfile();
  } else {
    currentUser = null;
    currentProfile = null;
  }
  updateHeaderAuth();
}

async function loadProfile() {
  if (!currentUser) { currentProfile = null; return; }
  const { data, error } = await db
    .from('profiles')
    .select('id, full_name, phone, is_admin')
    .eq('id', currentUser.id)
    .single();
  if (error) {
    console.error('loadProfile', error);
    currentProfile = null;
    return;
  }
  currentProfile = data;
}

function updateHeaderAuth() {
  const isLogged = !!currentUser;
  const isAdmin  = !!currentProfile?.is_admin;

  $('#btn-login').hidden  = isLogged;
  $('#btn-logout').hidden = !isLogged;
  $('.app-nav a[data-nav="meus"]').hidden  = !isLogged;
  $('.app-nav a[data-nav="admin"]').hidden = !isAdmin;
}

/* ---------- Cadastro ---------- */
// Usa Supabase Auth com email fake derivado do celular para permitir login por celular.
// email = `${phone}@apostador.local`
function phoneToEmail(phone) {
  return `${normalizePhone(phone)}@apostador.com`;
}

async function checkPhoneExists(phone) {
  const p = normalizePhone(phone);
  const { data, error } = await db
    .from('profiles')
    .select('id')
    .eq('phone', p)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function signUp({ fullName, phone, password }) {
  if (!fullName?.trim()) throw new Error('Informe seu nome completo.');
  if (!isValidPhone(phone)) throw new Error('Celular inválido. Use DDD + 9 dígitos.');
  if (!password || password.length < 6) throw new Error('Senha deve ter ao menos 6 caracteres.');

  const normalizedPhone = normalizePhone(phone);

  const exists = await checkPhoneExists(normalizedPhone);
  if (exists) throw new Error('Este celular já está cadastrado. Faça login.');

  const email = phoneToEmail(normalizedPhone);
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName.trim(), phone: normalizedPhone } },
  });
  if (error) throw error;

  // Sem confirmação de email -> signUp já devolve sessão; garantimos login
  if (!data.session) {
    const { error: signInErr } = await db.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  }

  await loadSession();
  return currentProfile;
}

/* ---------- Login ---------- */
async function signIn({ phone, password }) {
  if (!isValidPhone(phone)) throw new Error('Celular inválido.');
  if (!password) throw new Error('Informe a senha.');

  const email = phoneToEmail(phone);
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login/i.test(error.message)) throw new Error('Celular ou senha incorretos.');
    throw error;
  }
  await loadSession();
  return currentProfile;
}

/* ---------- Logout ---------- */
async function signOut() {
  await db.auth.signOut();
  currentUser = null;
  currentProfile = null;
  updateHeaderAuth();
  toast('Você saiu.', 'info');
  navigate('/');
}

/* ---------- Guardas ---------- */
function requireAuth() {
  if (!currentUser) {
    toast('Faça login para continuar.', 'error');
    navigate('/login');
    return false;
  }
  return true;
}
function requireAdmin() {
  if (!requireAuth()) return false;
  if (!currentProfile?.is_admin) {
    toast('Acesso restrito ao administrador.', 'error');
    navigate('/');
    return false;
  }
  return true;
}

/* ---------- Realtime: sessão ---------- */
function initAuthListener() {
  db.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      updateHeaderAuth();
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      const { data: { session } } = await db.auth.getSession();
      if (session?.user) {
        currentUser = session.user;
        await loadProfile();
        updateHeaderAuth();
      }
    }
  });
}

/* ---------- Bootstrap auth ---------- */
async function initAuth() {
  initAuthListener();
  await loadSession();

  $('#btn-logout')?.addEventListener('click', signOut);
}
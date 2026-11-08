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

  // Nav desktop
  $$('.app-nav a[data-nav="meus"]').forEach(a => a.hidden  = !isLogged);
  $$('.app-nav a[data-nav="admin"]').forEach(a => a.hidden = !isAdmin);

  // Nav mobile (drawer)
  $$('.mobile-drawer-panel a[data-nav="meus"]').forEach(a => a.hidden  = !isLogged);
  $$('.mobile-drawer-panel a[data-nav="admin"]').forEach(a => a.hidden = !isAdmin);
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


/* ---------- Login ou cadastro em uma única chamada ---------- */
// Regra:
//  1) Tenta login primeiro (só precisa celular + senha).
//  2) Se falhar porque o usuário NÃO existe no Auth -> exige nome e cria.
//  3) Se falhar porque a senha está errada -> mensagem clara.
//  4) Após criar ou logar, garante que o profile exista (recria se o
//     trigger falhou em cadastros antigos).
async function signInOrSignUp({ fullName, phone, password }) {
  if (!isValidPhone(phone)) throw new Error('Celular inválido. Use DDD + 9 dígitos.');
  if (!password || password.length < 6) throw new Error('A senha deve ter ao menos 6 caracteres.');

  const normalizedPhone = normalizePhone(phone);
  const email = phoneToEmail(normalizedPhone);

  // ---- 1) Tenta login primeiro ----
  const { error: loginErr } = await db.auth.signInWithPassword({ email, password });

  if (!loginErr) {
    // Login OK: garante profile (nome só usado se o profile estiver faltando)
    await ensureProfile({
      fullName: (fullName || '').trim() || 'Participante',
      phone: normalizedPhone,
    });
    await loadSession();
    return { mode: 'login', profile: currentProfile };
  }

  const isInvalidLogin = /invalid login/i.test(loginErr.message);

  // ---- 2) Não existe no Auth -> exige nome e cria ----
  if (isInvalidLogin) {
    if (!fullName || !fullName.trim()) {
      throw new Error('Informe seu nome completo para criar a conta.');
    }

    const { data, error: signupErr } = await db.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim(), phone: normalizedPhone } },
    });

    if (signupErr) {
      // Corrida: alguém criou o mesmo celular entre o login e o signup
      if (/already registered|user already exists/i.test(signupErr.message)) {
        throw new Error('Este celular acabou de ser cadastrado. Tente entrar novamente.');
      }
      throw signupErr;
    }

    if (!data.session) {
      const { error: signInErr } = await db.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
    }

    await ensureProfile({ fullName: fullName.trim(), phone: normalizedPhone });
    await loadSession();
    return { mode: 'signup', profile: currentProfile };
  }

  // ---- 3) Outro erro (senha errada, rede, etc.) ----
  throw new Error('Senha incorreta para este celular. Tente novamente.');
}

/* ---------- Garante que o profile existe para o usuário logado ---------- */
async function ensureProfile({ fullName, phone }) {
  const { data: { session } } = await db.auth.getSession();
  if (!session?.user) return;

  const { data: existing } = await db
    .from('profiles')
    .select('id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (existing) return;

  const { error } = await db.from('profiles').insert({
    id: session.user.id,
    full_name: fullName,
    phone: normalizePhone(phone),
    is_admin: false,
  });

  if (error) {
    if (!/duplicate key/i.test(error.message)) {
      console.error('ensureProfile', error);
    }
  }
}

/* ---------- Garante que o profile existe para o usuário logado ---------- */
async function ensureProfile({ fullName, phone }) {
  const { data: { session } } = await db.auth.getSession();
  if (!session?.user) return;

  const { data: existing } = await db
    .from('profiles')
    .select('id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (existing) return;

  // Cria o profile manualmente (contorna trigger ausente)
  const { error } = await db.from('profiles').insert({
    id: session.user.id,
    full_name: fullName,
    phone: normalizePhone(phone),
    is_admin: false,
  });

  if (error) {
    // Corrida: trigger criou ao mesmo tempo. Ignora "duplicate key".
    if (!/duplicate key/i.test(error.message)) {
      console.error('ensureProfile', error);
    }
  }
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
function requireAuth(nextPath) {
  if (!currentUser) {
    toast('Faça login para continuar.', 'error');
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
    navigate('/acesso' + next);
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
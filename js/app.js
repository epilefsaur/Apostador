// js/app.js
// Bootstrap: registra rotas e inicializa tema/auth/router.

/* ---------- Rotas do usuário ---------- */
registerRoute('/',                    pageHome);
registerRoute('/sorteio/:id',         pageSorteio);
registerRoute('/pagamento/:id',       pagePagamento);
registerRoute('/meus',                pageMeus);

/* ---------- Rotas de auth ---------- */
registerRoute('/login',               pageLogin);
registerRoute('/cadastro',            pageCadastro);

/* ---------- Rotas do admin ---------- */
registerRoute('/admin',               pageAdmin);
registerRoute('/admin/novo',          pageAdminNovo);
registerRoute('/admin/sorteio/:id',   pageAdminSorteio);
registerRoute('/admin/sorteio/:id/editar', pageAdminEditar);

/* ============================================================
   Páginas de autenticação (inline — pequenas, ficam aqui)
   ============================================================ */
function pageLogin({ next } = {}) {
  const wrap = el('div');
  const form = el('form', { class: 'card auth-card' });

  form.appendChild(el('h1', { class: 'auth-title page-title', style: 'justify-content:center;' }, 'Entrar'));
  form.appendChild(el('p', { class: 'auth-sub' }, 'Use seu celular e senha.'));

  const inputPhone = el('input', {
    class: 'input', type: 'tel', inputmode: 'numeric',
    placeholder: '(11) 98765-4321', autocomplete: 'tel',
  });
  inputPhone.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
  });

  const inputPass = el('input', {
    class: 'input', type: 'password', placeholder: 'Sua senha',
    autocomplete: 'current-password',
  });

  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Celular'),
    inputPhone,
  ]));
  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Senha'),
    inputPass,
  ]));

  const btn = el('button', { type: 'submit', class: 'btn btn-primary btn-block btn-lg' }, 'Entrar');
  form.appendChild(btn);

  form.appendChild(el('p', { class: 'auth-switch' }, [
    'Não tem conta? ',
    el('a', { href: '#/cadastro' + (next ? `?next=${encodeURIComponent(next)}` : '') }, 'Cadastre-se'),
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Entrando...';
    try {
      await signIn({ phone: inputPhone.value, password: inputPass.value });
      toast('Bem-vindo!', 'success');
      navigate(next || '/');
    } catch (err) {
      toast(err.message || 'Falha no login.', 'error');
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });

  wrap.appendChild(form);
  return wrap;
}

function pageCadastro({ next } = {}) {
  const wrap = el('div');
  const form = el('form', { class: 'card auth-card' });

  form.appendChild(el('h1', { class: 'auth-title page-title', style: 'justify-content:center;' }, 'Criar conta'));
  form.appendChild(el('p', { class: 'auth-sub' }, 'Cadastro rápido para participar.'));

  const inputName = el('input', {
    class: 'input', placeholder: 'Nome completo', autocomplete: 'name',
  });
  const inputPhone = el('input', {
    class: 'input', type: 'tel', inputmode: 'numeric',
    placeholder: '(11) 98765-4321', autocomplete: 'tel',
  });
  inputPhone.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
  });
  const inputPass = el('input', {
    class: 'input', type: 'password', placeholder: 'Mín. 6 caracteres',
    autocomplete: 'new-password',
  });

  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Nome completo *'),
    inputName,
  ]));
  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Celular *'),
    inputPhone,
    el('div', { class: 'form-hint' }, 'DDD + 9 dígitos'),
  ]));
  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Senha *'),
    inputPass,
  ]));

  const btn = el('button', { type: 'submit', class: 'btn btn-primary btn-block btn-lg' }, 'Criar conta');
  form.appendChild(btn);

  form.appendChild(el('p', { class: 'auth-switch' }, [
    'Já tem conta? ',
    el('a', { href: '#/login' + (next ? `?next=${encodeURIComponent(next)}` : '') }, 'Entrar'),
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Criando...';
    try {
      await signUp({
        fullName: inputName.value,
        phone: inputPhone.value,
        password: inputPass.value,
      });
      toast('Conta criada!', 'success');
      navigate(next || '/');
    } catch (err) {
      toast(err.message || 'Falha no cadastro.', 'error');
      btn.disabled = false;
      btn.textContent = 'Criar conta';
    }
  });

  wrap.appendChild(form);
  return wrap;
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
(async function bootstrap() {
  initTheme();
  initMobileMenu();
  await initAuth();
  initRouter();
})();
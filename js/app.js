// js/app.js
// Bootstrap: registra rotas e inicializa tema/auth/router.

/* ---------- Rotas do usuário ---------- */
registerRoute('/',                    pageHome);
registerRoute('/sorteio/:id',         pageSorteio);
registerRoute('/pagamento/:id',       pagePagamento);
registerRoute('/meus',                pageMeus);

/* ---------- Rotas de auth ---------- */
// Uma única tela "acesso" que faz login OU cadastro automaticamente.
registerRoute('/acesso',  pageAcesso);

// Aliases para não quebrar links antigos
registerRoute('/login',    (p) => pageAcesso(p));
registerRoute('/cadastro', (p) => pageAcesso(p));

/* ---------- Rotas do admin ---------- */
registerRoute('/admin',                    pageAdmin);
registerRoute('/admin/novo',               pageAdminNovo);
registerRoute('/admin/sorteio/:id',        pageAdminSorteio);
registerRoute('/admin/sorteio/:id/editar', pageAdminEditar);

/* ============================================================
   Página unificada: entrar ou criar conta
   ============================================================ */
function pageAcesso({ next } = {}) {
  const wrap = el('div');
  const form = el('form', { class: 'card auth-card' });

  form.appendChild(el('h1', { class: 'auth-title page-title', style: 'justify-content:center;' }, 'Acessar'));
  form.appendChild(el('p', { class: 'auth-sub' },
    'Se já tem conta, use seu celular e senha. Se é novo, informe seu nome — a conta é criada na hora.'));

  // Campos
  const inputName = el('input', {
    class: 'input', placeholder: 'Nome completo (apenas se for novo)',
    autocomplete: 'name',
  });

  const inputPhone = el('input', {
    class: 'input', type: 'tel', inputmode: 'numeric',
    placeholder: '(11) 98765-4321', autocomplete: 'tel',
  });
  inputPhone.addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
  });

  const inputPass = el('input', {
    class: 'input', type: 'password', placeholder: 'Sua senha (mín. 6 caracteres)',
    autocomplete: 'current-password',
  });

  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Nome completo'),
    inputName,
    el('div', { class: 'form-hint' }, 'Só é usado se você ainda não tem conta.'),
  ]));
  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Celular *'),
    inputPhone,
  ]));
  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Senha *'),
    inputPass,
  ]));

  const btn = el('button', { type: 'submit', class: 'btn btn-primary btn-block btn-lg' },
    'Entrar / Criar conta');
  form.appendChild(btn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Verificando...';
    try {
      const { mode } = await signInOrSignUp({
        fullName: inputName.value,
        phone: inputPhone.value,
        password: inputPass.value,
      });
      toast(mode === 'signup' ? 'Conta criada! Bem-vindo.' : 'Bem-vindo de volta!', 'success');
      navigate(next || '/');
    } catch (err) {
      toast(err.message || 'Não foi possível acessar.', 'error', 4000);
      btn.disabled = false;
      btn.textContent = 'Entrar / Criar conta';
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
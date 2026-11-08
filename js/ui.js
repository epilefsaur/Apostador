// js/ui.js
// Helpers de UI: toasts, modal, formatação, copiar, tema, helpers DOM.

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- DOM ---------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c))
      : c);
  }
  return node;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Toasts ---------- */
function toast(message, type = 'info', ms = 3200) {
  const root = $('#toasts');
  if (!root) return;
  const t = el('div', { class: `toast ${type}` }, message);
  root.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .2s';
    setTimeout(() => t.remove(), 200);
  }, ms);
}

/* ---------- Modal ---------- */
function modal({ title, body, actions = [], onClose }) {
  const root = $('#modal-root');
  if (!root) return;

  const close = () => {
    root.hidden = true;
    root.innerHTML = '';
    document.body.style.overflow = '';
    onClose?.();
  };

  const actionsEl = el('div', { class: 'modal-actions' },
    actions.map(a => el('button', {
      class: `btn ${a.class || 'btn-secondary'}`,
      type: 'button',
      onClick: async () => {
        if (a.onClick) {
          const res = await a.onClick();
          if (res === false) return; // mantém aberto
        }
        close();
      },
    }, a.label))
  );

  const bodyEl = typeof body === 'string'
    ? el('div', { html: body })
    : body;

  root.innerHTML = '';
  root.appendChild(el('div', { class: 'modal' }, [
    el('h3', {}, title || ''),
    bodyEl,
    actionsEl,
  ]));
  root.hidden = false;
  document.body.style.overflow = 'hidden';

  root.onclick = (e) => { if (e.target === root) close(); };
}

function confirmDialog(title, message, confirmLabel = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    modal({
      title,
      body: el('p', { class: 'text-muted' }, message),
      actions: [
        { label: 'Cancelar', class: 'btn-secondary', onClick: () => resolve(false) },
        { label: confirmLabel, class: danger ? 'btn-danger' : 'btn-primary', onClick: () => resolve(true) },
      ],
      onClose: () => resolve(false),
    });
  });
}

/* ---------- Formatação ---------- */
const fmtBRL = (v) => {
  const n = Number(v ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('pt-BR');
}

function relativeFromNow(iso) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  let txt;
  if (abs < min) txt = 'agora';
  else if (abs < hr) txt = `${Math.round(abs / min)} min`;
  else if (abs < day) txt = `${Math.round(abs / hr)} h`;
  else txt = `${Math.round(abs / day)} d`;
  return diff >= 0 ? `em ${txt}` : `há ${txt}`;
}

/* ---------- Celular ---------- */
// Aceita "11987654321" ou "(11) 98765-4321" -> armazena "11987654321"
function normalizePhone(raw) {
  return String(raw || '').replace(/\D/g, '');
}
function isValidPhone(raw) {
  const p = normalizePhone(raw);
  return /^\d{11}$/.test(p); // DD + 9 dígitos
}
function maskPhone(raw) {
  const p = normalizePhone(raw).slice(0, 11);
  if (p.length <= 2) return p;
  if (p.length <= 7) return `(${p.slice(0,2)}) ${p.slice(2)}`;
  return `(${p.slice(0,2)}) ${p.slice(2,7)}-${p.slice(7)}`;
}

/* ---------- Copiar ---------- */
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = el('textarea', { style: 'position:fixed;opacity:0;' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/* ---------- Status do sorteio (derivado) ---------- */
// Regra: se status salvo = 'aberto' mas prazo venceu -> trata como 'em_andamento'
function effectiveStatus(sorteio) {
  if (!sorteio) return 'aberto';
  if (sorteio.status === 'aberto' && sorteio.prazo_participacao) {
    if (new Date(sorteio.prazo_participacao).getTime() < Date.now()) {
      return 'em_andamento';
    }
  }
  return sorteio.status;
}

function statusLabel(status) {
  return ({
    aberto: 'Aberto',
    em_andamento: 'Em andamento',
    finalizado: 'Finalizado',
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    recusado: 'Recusado',
  })[status] || status;
}

function initMobileMenu() {
  const toggle = $('#menu-toggle');
  const drawer = $('#mobile-drawer');
  if (!toggle || !drawer) return;

  const open  = () => { drawer.hidden = false; document.body.style.overflow = 'hidden'; };
  const close = () => { drawer.hidden = true;  document.body.style.overflow = ''; };

  toggle.addEventListener('click', () => {
    drawer.hidden ? open() : close();
  });
  drawer.querySelector('[data-close]')?.addEventListener('click', close);
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

  // Fecha ao navegar por hash (caso o usuário use o histórico)
  window.addEventListener('hashchange', close);
}

/* ---------- Tema ---------- */
/* ---------- Tema ---------- */
function initTheme() {
  const saved = localStorage.getItem('apostador-theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);

  $('#btn-theme')?.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme;
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('apostador-theme', theme);
  const btn = $('#btn-theme');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ---------- Menu mobile ---------- */
function initMobileMenu() {
  const toggle = $('#menu-toggle');
  const drawer = $('#mobile-drawer');
  if (!toggle || !drawer) return;

  const open  = () => { drawer.hidden = false; document.body.style.overflow = 'hidden'; };
  const close = () => { drawer.hidden = true;  document.body.style.overflow = ''; };

  toggle.addEventListener('click', () => {
    drawer.hidden ? open() : close();
  });
  drawer.querySelector('[data-close]')?.addEventListener('click', close);
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', close));

  // Fecha ao navegar por hash
  window.addEventListener('hashchange', close);
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('apostador-theme', theme);
  const btn = $('#btn-theme');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ---------- Loading ---------- */
function loading() {
  return el('div', { class: 'loading-screen' }, el('div', { class: 'spinner' }));
}

/* ---------- Empty state ---------- */
function emptyState(emoji, title, subtitle) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'emoji' }, emoji),
    el('div', { style: 'font-weight:600;color:var(--text);' }, title),
    subtitle ? el('div', { class: 'text-sm text-muted mt-1' }, subtitle) : null,
  ]);
}
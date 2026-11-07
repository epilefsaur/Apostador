// js/router.js
// Roteador SPA baseado em hash. Cada rota é registrada por quem a usa.

const routes = new Map();

function registerRoute(pattern, handler) {
  routes.set(pattern, handler);
}

function parseHash() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query] = hash.split('?');
  const params = {};
  if (query) {
    for (const [k, v] of new URLSearchParams(query)) params[k] = v;
  }
  return { path: path || '/', params };
}

function matchRoute(path) {
  // Suporta padrões com :param
  for (const [pattern, handler] of routes) {
    const pParts = pattern.split('/').filter(Boolean);
    const aParts = path.split('/').filter(Boolean);
    if (pParts.length !== aParts.length) continue;

    const params = {};
    let ok = true;
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(':')) {
        params[pParts[i].slice(1)] = decodeURIComponent(aParts[i]);
      } else if (pParts[i] !== aParts[i]) {
        ok = false; break;
      }
    }
    if (ok) return { handler, params };
  }
  return null;
}

async function renderRoute() {
  const { path, params: qp } = parseHash();
  const match = matchRoute(path);
  const app = $('#app');

  // Atualiza nav ativo
  $$('.app-nav a').forEach(a => a.classList.remove('active'));
  const navKey = path.startsWith('/admin') ? 'admin'
    : path.startsWith('/meus') ? 'meus'
    : path === '/' ? 'home' : null;
  if (navKey) $(`.app-nav a[data-nav="${navKey}"]`)?.classList.add('active');

  if (!match) {
    app.innerHTML = '';
    app.appendChild(emptyState('🤔', 'Página não encontrada', 'Volte para a página inicial.'));
    return;
  }

  try {
    app.innerHTML = '';
    app.appendChild(loading());
    const content = await match.handler({ ...qp, ...match.params });
    app.innerHTML = '';
    if (content) app.appendChild(content);
  } catch (err) {
    console.error(err);
    app.innerHTML = '';
    app.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'emoji' }, '⚠️'),
      el('div', { style: 'font-weight:600;color:var(--text);' }, 'Erro ao carregar'),
      el('div', { class: 'text-sm text-muted mt-1' }, err.message || 'Tente novamente.'),
    ]));
  }
}

function navigate(path) {
  if (location.hash === '#' + path) renderRoute();
  else location.hash = path;
}

function initRouter() {
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('DOMContentLoaded', renderRoute);
  if (document.readyState !== 'loading') renderRoute();
}
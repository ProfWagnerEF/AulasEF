function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR');
}

function mostrarToast(mensagem, tipo = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + tipo;
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function mostrarAlerta(mensagem, tipo = 'info') {
  const container = $('#alert-container') || (() => {
    const div = document.createElement('div');
    div.id = 'alert-container';
    const main = $('main') || document.body;
    main.prepend(div);
    return div;
  })();

  const alert = document.createElement('div');
  alert.className = 'alert alert-' + tipo;
  alert.textContent = mensagem;
  container.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}

function toggleLoading(show) {
  const existing = document.querySelector('.loading-global');
  if (show) {
    if (existing) return;
    const div = document.createElement('div');
    div.className = 'loading loading-global';
    div.style.position = 'fixed';
    div.style.top = '0'; div.style.left = '0'; div.style.right = '0'; div.style.bottom = '0';
    div.style.background = 'rgba(0,0,0,0.3)';
    div.style.zIndex = '9999';
    div.style.color = '#fff';
    div.style.fontSize = '1.2rem';
    div.innerHTML = 'Carregando...';
    document.body.appendChild(div);
  } else {
    if (existing) existing.remove();
  }
}

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const novo = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', novo);
  localStorage.setItem('theme', novo);
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = novo === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function initHeader() {
  var usuario = API.getUsuario();
  var auth = API.isAutenticado();
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  function navHtml() {
    var h = '';
    if (auth) {
      h += '<a href="' + relPath('pages/admin-dashboard.html') + '">Dashboard</a>';
      h += '<a href="' + relPath('pages/admin-torneios.html') + '">Torneios</a>';
      h += '<a href="' + relPath('pages/admin-jogadores.html') + '">Jogadores</a>';
      h += '<a href="' + relPath('pages/admin-turmas.html') + '">Turmas</a>';
      if (usuario.perfil === 'admin') h += '<a href="' + relPath('pages/admin-usuarios.html') + '">Usuarios</a>';
      h += '<a href="' + relPath('pages/painel-publico.html') + '">Painel</a>';
      h += '<button onclick="handleLogout()">Sair (' + escapeHTML(usuario.nome) + ')</button>';
    } else {
      h += '<a href="' + relPath('index.html') + '">Inicio</a>';
      h += '<a href="' + relPath('pages/painel-publico.html') + '">Painel Publico</a>';
      h += '<a href="' + relPath('login.html') + '">Entrar</a>';
    }
    h += '<button class="theme-toggle" onclick="toggleTheme()">' + (isDark ? '☀️' : '🌙') + '</button>';
    return h;
  }

  var header = document.getElementById('mainHeader');
  if (header) {
    header.innerHTML = '<div class="container"><div class="header-logo"><span class="icon">♟</span><span>Xadrez Escolar</span></div><nav class="header-nav">' + navHtml() + '</nav></div>';
    header.className = 'header';
    return;
  }

  var nav = document.querySelector('.header-nav');
  if (nav) { nav.innerHTML = navHtml(); }

  var div = document.getElementById('header');
  if (div) {
    div.innerHTML = '<div class="container"><div class="header-logo"><span class="icon">♟</span><span>Xadrez Escolar</span></div><nav class="header-nav">' + navHtml() + '</nav></div>';
    div.className = 'header';
  }
}

function relPath(p) {
  var path = window.location.pathname;
  var base = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
  if (path.indexOf('/pages/') !== -1) { base = base.substring(0, base.lastIndexOf('/')); }
  return base + '/' + p;
}

async function handleLogout() {
  await API.logout();
  mostrarToast('Logout realizado');
  window.location.href = relPath('login.html');
}

function verificarAuth(perfilNecessario) {
  var token = localStorage.getItem('xadrez_token');
  var usuario = (function() { try { return JSON.parse(localStorage.getItem('xadrez_usuario')); } catch(e) { return null; } })();
  if (!token || !usuario) {
    window.location.href = relPath('login.html') + '?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return false;
  }
  if (perfilNecessario === 'admin' && usuario.perfil !== 'admin') {
    mostrarToast('Acesso restrito a administradores', 'error');
    window.location.href = relPath('pages/admin-dashboard.html');
    return false;
  }
  return true;
}

function renderBadge(tipo, valor) {
  const classes = {
    'admin': 'badge-admin', 'moderador': 'badge-moderador', 'visitante': 'badge-visitante',
    'ativo': 'badge-ativo', 'inativo': 'badge-inativo',
    'classificatorio': 'badge-classificatorio', 'final': 'badge-final',
    '1-0': 'badge-1-0', '0-1': 'badge-0-1', '0.5-0.5': 'badge-0\\.5-0\\.5', 'bye': 'badge-bye'
  };
  const cls = classes[valor] || '';
  return `<span class="badge ${cls}">${escapeHTML(valor)}</span>`;
}

function renderPosicao(pos) {
  if (pos === 1) return '<span class="pos-1">🥇 1º</span>';
  if (pos === 2) return '<span class="pos-2">🥈 2º</span>';
  if (pos === 3) return '<span class="pos-3">🥉 3º</span>';
  return `${pos}º`;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function initFullscreenBtn() {
}

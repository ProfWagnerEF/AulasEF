var API = {
  baseUrl: '',
  token: localStorage.getItem('xadrez_token'),
  request: function(method, path, data) { return apiRequest(method, '/api' + path, data); },
  get: function(path) { return this.request('GET', path); },
  post: function(path, data) { return this.request('POST', path, data); },
  put: function(path, data) { return this.request('PUT', path, data); },
  del: function(path) { return this.request('DELETE', path); },
  login: function(email, senha) {
    var self = this;
    return apiPost('/api/auth/login', { email: email, senha: senha }).then(function(data) {
      self.token = data.token;
      localStorage.setItem('xadrez_token', data.token);
      localStorage.setItem('xadrez_usuario', JSON.stringify(data.usuario));
      return data;
    });
  },
  logout: function() {
    this.token = null;
    localStorage.removeItem('xadrez_token');
    localStorage.removeItem('xadrez_usuario');
  },
  getUsuario: function() {
    try { return JSON.parse(localStorage.getItem('xadrez_usuario')); } catch(e) { return null; }
  },
  isAutenticado: function() { return !!localStorage.getItem('xadrez_token'); },
  isAdmin: function() { var u = this.getUsuario(); return u && u.perfil === 'admin'; },
  isModerador: function() { var u = this.getUsuario(); return u && (u.perfil === 'admin' || u.perfil === 'moderador'); }
};

function apiRequest(method, path, body) {
  return new Promise(function(resolve, reject) {
    try {
      var result = apiLocal(method, path, body);
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else {
        resolve(result);
      }
    } catch (e) {
      reject(e);
    }
  });
}

function apiGet(path) { return apiRequest('GET', path); }
function apiPost(path, body) { return apiRequest('POST', path, body); }
function apiPut(path, body) { return apiRequest('PUT', path, body); }
function apiDelete(path) { return apiRequest('DELETE', path); }

function resolveRedirect(r) {
  if (r.indexOf('../') === 0 || r.indexOf('http') === 0) return r;
  var path = window.location.pathname.replace(/\\/g, '/');
  var inPages = path.indexOf('/pages/') !== -1;
  if (inPages) r = r.replace(/^pages\//, '');
  return r;
}

document.addEventListener('submit', function(e) {
  var form = e.target;
  var action = form.getAttribute('action') || '';
  if (!action.match(/^\/api\//)) return;
  e.preventDefault();
  var data = {};
  var fd = new FormData(form);
  var seen = {};
  fd.forEach(function(v, k) {
    if (seen[k]) {
      if (!Array.isArray(data[k])) data[k] = [data[k]];
      data[k].push(v);
    } else {
      data[k] = v;
      seen[k] = true;
    }
  });
  var btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  apiPost(action, data).then(function(r) {
    if (r && r.redirect) { window.location.href = resolveRedirect(r.redirect); }
    else { window.location.href = resolveRedirect('pages/admin-dashboard.html?msg=ok'); }
  }).catch(function(err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    var msgEl = document.getElementById('msg');
    if (msgEl) msgEl.innerHTML = '<div class="alert alert-error">' + (err.message || 'Erro') + '</div>';
    else alert(err.message || 'Erro ao salvar');
  });
});

function apiLocal(method, path, body) {
  var p = path.replace(/^\/api\//, '');
  var parts = p.split('/');
  var D = window.Data;
  if (!D) return { erro: 'Data layer nao carregado' };
  var user = D.getUsuarioLogado && D.getUsuarioLogado();

  function check() { if (!user) throw new Error('Nao autenticado'); }

  try {
    if (p === 'dashboard' && method === 'GET') {
      var todosTorneios = D.torneios.listar();
      var ativos = todosTorneios.filter(function(t) { return t.status === 'ativo'; });
      var allParts = (function() { try { return JSON.parse(localStorage.getItem('xadrez_partidas')) || []; } catch(e) { return []; } })();
      var jogs = D.jogadores.listar({ ativo: 1 });
      var turmas = D.turmas.listar();
      var porTurma = turmas.map(function(t) { return { nome: t.nome, total: jogs.filter(function(j) { return j.turma_id === t.id; }).length }; }).filter(function(t) { return t.total > 0; });
      return {
        total_usuarios: (function() { try { return JSON.parse(localStorage.getItem('xadrez_usuarios')) || []; } catch(e) { return []; } })().length,
        total_turmas: turmas.length, total_jogadores: jogs.length,
        total_torneios_ativos: ativos.length, total_torneios: todosTorneios.length,
        total_partidas: allParts.length, torneios_recentes: todosTorneios.slice(-5).reverse(),
        ultimas_partidas: [], jogadores_por_turma: porTurma
      };
    }
    if (p === 'auth/login' && method === 'POST') return D.login(body.email, body.senha);
    if (p === 'auth/logout' && method === 'POST') { D.logout(); return { mensagem: 'ok' }; }
    if (p === 'auth/me' && method === 'GET') { return user || { erro: 'Nao autenticado' }; }

    if (p === 'turmas' && method === 'GET') return D.turmas.listarComTotal();
    if (p.match(/^turmas\/?\d*$/) && method === 'GET') {
      var id = parseInt(parts[1]); return id ? D.turmas.obter(id) : D.turmas.listar();
    }
    if (p === 'turmas' && method === 'POST') { check(); return D.turmas.criar(body); }
    if (p.match(/^turmas\/\d+$/) && method === 'PUT') { check(); return D.turmas.atualizar(parseInt(parts[1]), body); }
    if (p.match(/^turmas\/\d+$/) && method === 'DELETE') { check(); D.turmas.remover(parseInt(parts[1])); return { mensagem: 'ok' }; }
    if (p === 'turmas/form' && method === 'POST') {
      check();
      if (body.id) { D.turmas.atualizar(parseInt(body.id), body); } else { D.turmas.criar(body); }
      return { redirect: 'pages/admin-turmas.html?msg=ok' };
    }

    if (p.match(/^jogadores/) && method === 'GET') {
      var q = {};
      var qs = p.split('?')[1];
      if (qs) {
        var sp = new URLSearchParams(qs);
        if (sp.get('turma_id')) q.turma_id = parseInt(sp.get('turma_id'));
        if (sp.get('turmas')) q.turmas = sp.get('turmas');
        if (sp.get('search')) q.search = sp.get('search');
        if (sp.get('ativo')) q.ativo = parseInt(sp.get('ativo'));
      }
      if (parts[0] === 'jogadores' && !parts[1]) return D.jogadores.listar(q);
    }
    if (p.match(/^jogadores\/\d+$/) && method === 'GET') return D.jogadores.obter(parseInt(parts[1]));
    if (p === 'jogadores' && method === 'POST') { check(); return D.jogadores.criar(body); }
    if (p.match(/^jogadores\/\d+$/) && method === 'PUT') { check(); return D.jogadores.atualizar(parseInt(parts[1]), body); }
    if (p.match(/^jogadores\/\d+$/) && method === 'DELETE') { check(); D.jogadores.remover(parseInt(parts[1])); return { mensagem: 'ok' }; }
    if (p === 'jogadores/form' && method === 'POST') {
      check();
      if (body.id) { D.jogadores.atualizar(parseInt(body.id), body); } else { D.jogadores.criar(body); }
      return { redirect: 'pages/admin-jogadores.html?msg=ok' };
    }

    if (p === 'torneios' && method === 'GET') return D.torneios.listar();
    if (p === 'torneios/form' && method === 'POST') {
      check();
      if (body.id) { D.torneios.atualizar(parseInt(body.id), body); }
      else { D.torneios.criar(body); }
      return { redirect: 'pages/admin-torneios.html?msg=ok' };
    }
    if (p === 'torneios/publico' && method === 'GET') return D.torneios.listarPublico();
    if (p.match(/^torneios\/publico\/\d+$/) && method === 'GET') {
      var pubId = parseInt(parts[2]);
      var full = D.torneios.obter(pubId);
      if (!full || !full.torneio) throw new Error('Torneio nao encontrado');
      return { torneio: full.torneio, classificacao: full.classificacao, rodadas: full.rodadas };
    }

    var torneioMatch = p.match(/^torneios\/(\d+)/);
    if (torneioMatch) {
      var tid = parseInt(torneioMatch[1]);
      var sub = parts.slice(2).join('/');

      if (!sub && method === 'GET') return D.torneios.obter(tid);
      if (!sub && method === 'PUT') { check(); return D.torneios.atualizar(tid, body); }
      if (!sub && method === 'DELETE') { check(); D.torneios.arquivar(tid); return { mensagem: 'ok' }; }

      if (sub === 'participantes' && method === 'GET') return D.torneios.participantes(tid);
      if (sub === 'participantes' && method === 'POST') { check(); return { mensagem: D.torneios.adicionarParticipantes(tid, body.jogadores_ids) + ' participantes adicionados' }; }
      if (sub.match(/^participantes\/\d+$/) && method === 'DELETE') { check(); D.torneios.removerParticipante(tid, parseInt(parts[3])); return { mensagem: 'ok' }; }
      if (sub === 'classificacao' && method === 'GET') return D.torneios.classificacao(tid);
      if (sub === 'rodadas' && method === 'GET') return { rodadas: D.torneios.rodadas(tid) };
      if (sub === 'classificados' && method === 'GET') return D.torneios.classificados(tid);
      if (sub === 'gerar-rodada' && method === 'POST') { check(); return D.torneios.gerarRodada(tid); }
      if (sub === 'gerar-todas-rodadas' && method === 'POST') { check(); var r = D.torneios.gerarTodasRodadas(tid); return { mensagem: r.length + ' rodada(s) gerada(s)', rodadas: r }; }
      if (sub === 'finalizar' && method === 'POST') { check(); D.torneios.finalizar(tid); return { mensagem: 'ok' }; }
    }

    var rodadaMatch = p.match(/^torneios\/rodadas\/(\d+)\/(resultado|reabrir)/);
    if (rodadaMatch) {
      var rid = parseInt(rodadaMatch[1]);
      var acao = rodadaMatch[2];
      if (acao === 'resultado' && method === 'PUT') {
        D.torneios.registrarResultado(body.partida_id, body.resultado);
        return { mensagem: 'Resultado registrado' };
      }
      if (acao === 'reabrir' && method === 'POST') { D.torneios.reabrirRodada(rid); return { mensagem: 'ok' }; }
    }

    var rodadaFechar = p.match(/^torneios\/rodadas\/(\d+)\/fechar/);
    if (rodadaFechar && method === 'POST') { D.torneios.fecharRodada(parseInt(rodadaFechar[1])); return { mensagem: 'ok' }; }

    var partidaPut = p.match(/^torneios\/partidas\/(\d+)$/);
    if (partidaPut && method === 'PUT') { return { mensagem: 'ok' }; }

    if (p === 'usuarios' && method === 'GET') { check(); var us = JSON.parse(localStorage.getItem('xadrez_usuarios') || '[]'); return us; }
    if (p.match(/^usuarios\/\d+$/) && method === 'PUT') {
      check(); var uid = parseInt(parts[1]);
      var us = JSON.parse(localStorage.getItem('xadrez_usuarios') || '[]');
      var idx = us.findIndex(function(u) { return u.id === uid; });
      if (idx === -1) throw new Error('Usuario nao encontrado');
      if (body.senha) body.senha = btoa(body.senha);
      us[idx] = Object.assign(us[idx], body);
      localStorage.setItem('xadrez_usuarios', JSON.stringify(us));
      return { mensagem: 'ok' };
    }
    if (p === 'usuarios' && method === 'POST') {
      check();
      var us = JSON.parse(localStorage.getItem('xadrez_usuarios') || '[]');
      body.id = Date.now();
      body.senha = btoa(body.senha);
      body.criado_em = new Date().toISOString();
      us.push(body);
      localStorage.setItem('xadrez_usuarios', JSON.stringify(us));
      return { mensagem: 'ok' };
    }
    if (p.match(/^usuarios\/\d+$/) && method === 'DELETE') {
      check(); var uid = parseInt(parts[1]);
      var us = JSON.parse(localStorage.getItem('xadrez_usuarios') || '[]');
      var idx = us.findIndex(function(u) { return u.id === uid; });
      if (idx === -1) throw new Error('Usuario nao encontrado');
      us.splice(idx, 1);
      localStorage.setItem('xadrez_usuarios', JSON.stringify(us));
      return { mensagem: 'ok' };
    }

    throw new Error('Rota nao encontrada: ' + path);
  } catch (e) {
    throw new Error(e.message || 'Erro');
  }
}

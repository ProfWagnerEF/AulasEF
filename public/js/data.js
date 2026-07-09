(function() {
  const ADMIN = { id: 1, nome: 'Admin', email: 'admin@escola.com', senha: 'admin123', perfil: 'admin' };

  function genId() { return Date.now() + Math.floor(Math.random() * 1000); }

  function save(key, data) { localStorage.setItem('xadrez_' + key, JSON.stringify(data)); }
  function load(key) { try { return JSON.parse(localStorage.getItem('xadrez_' + key)) || []; } catch(e) { return []; } }

  function init() {
    if (!localStorage.getItem('xadrez_usuarios')) {
      save('usuarios', [ADMIN]);
      save('configuracoes', [
        { id: 1, chave: 'escola_nome', valor: 'Escola Municipal' },
        { id: 2, chave: 'rodadas_padrao', valor: '5' },
        { id: 3, chave: 'classificados_padrao', valor: '2' },
      ]);
    }
    var existing = load('turmas');
    var nomesExistentes = existing.map(function(t) { return t.nome; });
    var desejadas = ['Turma 101', 'Turma 102', 'Turma 103', 'Turma 104', 'Turma 105', 'Turma 201', 'Turma 202', 'Turma 204', 'Turma 211', 'Turma 301', 'Turma 302', 'Turma 303', 'Turma 311', 'Turma 312'];
    desejadas.forEach(function(nome) {
      if (nomesExistentes.indexOf(nome) === -1) {
        var num = parseInt(nome.split(' ')[1]);
        existing.push({ id: num, nome: nome, ano_escolar: String(num).slice(0, 1), turno: 'manha', professor: '', ativo: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
    });
    save('turmas', existing);

    var jogs = load('jogadores');
    var nomesSeed = ['Ana Silva', 'Bruno Santos', 'Carla Oliveira', 'Daniel Souza', 'Eduarda Lima', 'Felipe Costa', 'Gabriela Pereira', 'Henrique Martins', 'Isabela Rocha', 'João Almeida', 'Karina Barbosa', 'Lucas Fernandes', 'Mariana Ribeiro', 'Nicolas Carvalho', 'Olivia Gomes', 'Pedro Teixeira', 'Quitéria Dias', 'Rafael Moreira', 'Sofia Campos', 'Thiago Nunes', 'Valentina Azevedo', 'Wagner Correia', 'Yasmin Farias', 'Arthur Monteiro', 'Beatriz Cardoso'];
    var turmas = load('turmas');
    turmas.forEach(function(t) {
      var existentes = jogs.filter(function(j) { return Number(j.turma_id) === Number(t.id); }).length;
      for (var i = existentes; i < 20; i++) {
        var nome = nomesSeed[i % nomesSeed.length];
        if (i >= nomesSeed.length) nome += ' ' + t.id + String.fromCharCode(65 + (i - nomesSeed.length));
        jogs.push({ id: genId(), nome_completo: nome, turma_id: t.id, ano_nascimento: '', sexo: '', ativo: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
    });
    save('jogadores', jogs);
  }

  function getUsuarioLogado() {
    try { return JSON.parse(localStorage.getItem('xadrez_usuario_logado')); } catch(e) { return null; }
  }

  function setUsuarioLogado(u) {
    if (u) localStorage.setItem('xadrez_usuario_logado', JSON.stringify(u));
    else localStorage.removeItem('xadrez_usuario_logado');
  }

  function login(email, senha) {
    const usuarios = load('usuarios');
    const u = usuarios.find(x => x.email === email && x.senha === senha);
    if (!u) throw new Error('Email ou senha invalidos');
    setUsuarioLogado({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil });
    return { token: 'static-token', usuario: { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil } };
  }

  function logout() { setUsuarioLogado(null); }

  function turmas() {
    return {
      listar() { return load('turmas').filter(t => t.ativo !== 0); },
      obter(id) { return load('turmas').find(t => t.id === id) || null; },
      criar(d) {
        const lista = load('turmas');
        const item = { id: genId(), nome: d.nome, ano_escolar: d.ano_escolar || '', turno: d.turno || '', professor: d.professor || '', ativo: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        lista.push(item); save('turmas', lista); return item;
      },
      atualizar(id, d) {
        const lista = load('turmas'); const idx = lista.findIndex(t => t.id === id); if (idx === -1) return null;
        Object.assign(lista[idx], { nome: d.nome ?? lista[idx].nome, ano_escolar: d.ano_escolar ?? lista[idx].ano_escolar, turno: d.turno ?? lista[idx].turno, professor: d.professor ?? lista[idx].professor, updated_at: new Date().toISOString() });
        save('turmas', lista); return lista[idx];
      },
      remover(id) {
        const lista = load('turmas'); const idx = lista.findIndex(t => t.id === id); if (idx === -1) return;
        lista[idx].ativo = 0; lista[idx].updated_at = new Date().toISOString(); save('turmas', lista);
      },
      contarJogadores(id) { return load('jogadores').filter(j => Number(j.turma_id) === Number(id) && j.ativo !== 0).length; },
      listarComTotal() {
        return this.listar().map(t => ({ ...t, total_jogadores: this.contarJogadores(t.id) }));
      }
    };
  }

  function jogadores() {
    function build(d) {
      return { id: d.id || genId(), nome_completo: d.nome_completo || d.nome || '', turma_id: d.turma_id ? parseInt(d.turma_id) : null, ano_nascimento: d.ano_nascimento || null, sexo: d.sexo || '', ativo: d.ativo !== undefined ? d.ativo : 1, created_at: d.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
    }
    return {
      listar(filtros) {
        let lista = load('jogadores');
        if (filtros) {
          if (filtros.ativo !== undefined) lista = lista.filter(j => j.ativo === filtros.ativo);
          if (filtros.turma_id) lista = lista.filter(j => Number(j.turma_id) === Number(filtros.turma_id));
          if (filtros.turmas) { const ids = filtros.turmas.split(',').map(Number); lista = lista.filter(j => ids.includes(Number(j.turma_id))); }
          if (filtros.search) { const s = filtros.search.toLowerCase(); lista = lista.filter(j => j.nome_completo.toLowerCase().includes(s)); }
        }
        const turmas = load('turmas');
        return lista.map(j => ({ ...j, turma_nome: (turmas.find(function(t) { return Number(t.id) === Number(j.turma_id); }) || {}).nome || '' }));
      },
      obter(id) {
        const j = load('jogadores').find(x => x.id === id); if (!j) return null;
        const turmas = load('turmas');
        return { ...j, turma_nome: (turmas.find(function(t) { return Number(t.id) === Number(j.turma_id); }) || {}).nome || '' };
      },
      criar(d) { const lista = load('jogadores'); const item = build(d); lista.push(item); save('jogadores', lista); return item; },
      atualizar(id, d) {
        const lista = load('jogadores'); const idx = lista.findIndex(x => x.id === id); if (idx === -1) return null;
        const item = lista[idx];
        if (d.nome_completo !== undefined) item.nome_completo = d.nome_completo;
        if (d.turma_id !== undefined) item.turma_id = parseInt(d.turma_id);
        if (d.ano_nascimento !== undefined) item.ano_nascimento = d.ano_nascimento;
        if (d.sexo !== undefined) item.sexo = d.sexo;
        if (d.ativo !== undefined) item.ativo = d.ativo;
        item.updated_at = new Date().toISOString();
        save('jogadores', lista); return item;
      },
      remover(id) {
        const lista = load('jogadores'); const idx = lista.findIndex(x => x.id === id); if (idx === -1) return;
        lista[idx].ativo = 0; lista[idx].updated_at = new Date().toISOString();
        save('jogadores', lista);
        const parts = load('torneio_participantes').filter(p => p.jogador_id === id);
        parts.forEach(p => { p.ativo = 0; });
        save('torneio_participantes', parts);
      }
    };
  }

  function torneios() {
    return {
      listar() {
        return load('torneios').filter(t => t.status !== 'arquivado').map(t => ({
          ...t, total_participantes: load('torneio_participantes').filter(p => p.torneio_id === t.id).length,
          total_rodadas: load('rodadas').filter(r => r.torneio_id === t.id).length
        }));
      },
      listarPublico() {
        return load('torneios').filter(t => t.status === 'ativo').map(t => {
          const classificacao = calcularClassificacao(t.id);
          const rodadas = load('rodadas').filter(r => r.torneio_id === t.id);
          const rodadaAberta = rodadas.find(r => r.status === 'aberta');
          return { ...t, classificacao: classificacao.slice(0, 10), rodada_atual: rodadaAberta || null,
            total_rodadas: rodadas.length, total_partidas: load('partidas').filter(p => rodadas.some(r => r.id === p.rodada_id)).length };
        });
      },
      obter(id) {
        const t = load('torneios').find(x => x.id === id); if (!t) return null;
        let turmas_ids = []; try { turmas_ids = JSON.parse(t.turmas_ids || '[]'); } catch(e) {}
        const turmas = turmas_ids.length ? load('turmas').filter(tm => turmas_ids.includes(tm.id)).map(tm => ({ id: tm.id, nome: tm.nome })) : [];
        const participantes = load('torneio_participantes').filter(p => p.torneio_id === id && p.ativo !== 0);
        const jogs = load('jogadores'); const ts = load('turmas');
        const partDetalhes = participantes.map(p => {
          const j = jogs.find(x => x.id === p.jogador_id) || {};
          return { ...p, nome_completo: j.nome_completo || '', turma_id: j.turma_id, ano_nascimento: j.ano_nascimento, turma_nome: (ts.find(function(tm) { return Number(tm.id) === Number(j.turma_id); }) || {}).nome || '' };
        });
        const classif = calcularClassificacao(id);
        const rodadas = load('rodadas').filter(r => r.torneio_id === id).map(r => ({
          ...r, partidas: load('partidas').filter(p => p.rodada_id === r.id).map(p => {
            const jb = jogs.find(x => x.id === p.jogador_brancas_id) || {}; const jp = jogs.find(x => x.id === p.jogador_pretas_id) || {};
            return { ...p, brancas_nome: jb.nome_completo || 'BYE', pretas_nome: jp.nome_completo || 'BYE', nome_brancas: jb.nome_completo || 'BYE', nome_pretas: jp.nome_completo || 'BYE' };
          })
        }));
        const totalPartidas = rodadas.reduce((acc, r) => acc + r.partidas.length, 0);
        return { torneio: { ...t, turmas }, classificacao: classif, participantes: partDetalhes, rodadas,
          estatisticas: { total_participantes: participantes.length, total_rodadas: rodadas.length, total_partidas: totalPartidas,
            media_pontuacao: classif.length ? classif.reduce((s, p) => s + p.pontuacao, 0) / classif.length : 0,
            maior_pontuacao: classif.length ? classif[0].pontuacao : 0 }
        };
      },
      criar(d) {
        const lista = load('torneios');
        const turmas_ids = d.turmas_ids ? (Array.isArray(d.turmas_ids) ? d.turmas_ids : [d.turmas_ids].filter(Boolean).map(Number)) : [];
        const item = { id: genId(), nome: d.nome, data: d.data || '', categoria: d.categoria || '', tipo: d.tipo || 'classificatorio', status: 'ativo', num_rodadas: parseInt(d.num_rodadas) || 5, classificados_por_turma: parseInt(d.classificados_por_turma) || 2, local: d.local || '', observacoes: d.observacoes || '', turmas_ids: JSON.stringify(turmas_ids), criterios_desempate: '["pontuacao","buchholz","buchholz_mediano","sonneborn","vitorias","confronto_direto","ano_nascimento"]', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        lista.push(item); save('torneios', lista);
        this._autoAddAlunos(item.id, turmas_ids);
        return item;
      },
      _autoAddAlunos(torneioId, turmas_ids) {
        if (!turmas_ids.length) return;
        const alunos = load('jogadores').filter(j => turmas_ids.some(function(tid) { return Number(tid) === Number(j.turma_id); }) && j.ativo !== 0);
        const parts = load('torneio_participantes');
        alunos.forEach(a => { if (!parts.some(p => p.torneio_id === torneioId && p.jogador_id === a.id)) { parts.push({ id: genId(), torneio_id: torneioId, jogador_id: a.id, pontuacao: 0, bye_count: 0, cor_brancas_count: 0, cor_pretas_count: 0, vitorias: 0, empates: 0, derrotas: 0, vitorias_brancas: 0, vitorias_pretas: 0, sequencia_vitorias: 0, sequencia_invicto: 0, max_sequencia_vitorias: 0, max_sequencia_invicto: 0, desistiu: 0, ativo: 1, created_at: new Date().toISOString() }); } });
        save('torneio_participantes', parts);
      },
      atualizar(id, d) {
        const lista = load('torneios'); const idx = lista.findIndex(t => t.id === id); if (idx === -1) return null;
        const item = lista[idx];
        ['nome','data','categoria','tipo','status','num_rodadas','classificados_por_turma','local','observacoes'].forEach(k => { if (d[k] !== undefined) item[k] = d[k]; });
        if (d.criterios_desempate) item.criterios_desempate = JSON.stringify(d.criterios_desempate);
        item.updated_at = new Date().toISOString();
        save('torneios', lista); return item;
      },
      finalizar(id) {
        const lista = load('torneios'); const t = lista.find(x => x.id === id); if (!t) return;
        t.status = 'finalizado'; t.updated_at = new Date().toISOString(); save('torneios', lista);
        const rods = load('rodadas').filter(r => r.torneio_id === id && r.status === 'aberta');
        rods.forEach(r => r.status = 'fechada'); save('rodadas', load('rodadas'));
      },
      arquivar(id) {
        const lista = load('torneios'); const t = lista.find(x => x.id === id); if (!t) return;
        t.status = 'arquivado'; t.updated_at = new Date().toISOString(); save('torneios', lista);
      },
      adicionarParticipantes(torneioId, jogadores_ids) {
        if (!jogadores_ids || !jogadores_ids.length) return 0;
        const parts = load('torneio_participantes'); let count = 0;
        jogadores_ids.forEach(jid => {
          if (!parts.some(p => p.torneio_id === torneioId && p.jogador_id === jid)) {
            parts.push({ id: genId(), torneio_id: torneioId, jogador_id: jid, pontuacao: 0, bye_count: 0, cor_brancas_count: 0, cor_pretas_count: 0, vitorias: 0, empates: 0, derrotas: 0, vitorias_brancas: 0, vitorias_pretas: 0, sequencia_vitorias: 0, sequencia_invicto: 0, max_sequencia_vitorias: 0, max_sequencia_invicto: 0, desistiu: 0, ativo: 1, created_at: new Date().toISOString() }); count++;
          }
        });
        save('torneio_participantes', parts); return count;
      },
      removerParticipante(torneioId, jogadorId) {
        const parts = load('torneio_participantes');
        save('torneio_participantes', parts.filter(p => !(p.torneio_id === torneioId && p.jogador_id === jogadorId)));
      },
      participantes(torneioId) {
        const parts = load('torneio_participantes').filter(p => p.torneio_id === torneioId && p.ativo !== 0);
        const jogs = load('jogadores'); const ts = load('turmas');
        return parts.map(p => {
          const j = jogs.find(x => x.id === p.jogador_id) || {};
          return { ...p, nome_completo: j.nome_completo || '', nome: j.nome_completo || '', turma_id: j.turma_id, turma: (ts.find(function(t) { return Number(t.id) === Number(j.turma_id); }) || {}).nome || '', turma_nome: (ts.find(function(t) { return Number(t.id) === Number(j.turma_id); }) || {}).nome || '' };
        });
      },
      classificacao(torneioId) { return calcularClassificacao(torneioId); },
      classificados(torneioId) {
        const t = load('torneios').find(x => x.id === torneioId); if (!t) return [];
        const classif = calcularClassificacao(torneioId);
        const vagas = t.classificados_por_turma || 2;
        const porTurma = {};
        classif.forEach(p => { if (!porTurma[p.turma_nome]) porTurma[p.turma_nome] = []; porTurma[p.turma_nome].push(p); });
        const result = [];
        Object.values(porTurma).forEach(jogs => result.push(...jogs.slice(0, vagas)));
        return result;
      },
      gerarRodada(torneioId) {
        const t = load('torneios').find(x => x.id === torneioId); if (!t || t.status !== 'ativo') throw new Error('Torneio nao esta ativo');
        if (load('rodadas').some(r => r.torneio_id === torneioId && r.status === 'aberta')) throw new Error('Ja existe uma rodada aberta');
        const participantes = load('torneio_participantes').filter(p => p.torneio_id === torneioId && p.ativo !== 0);
        if (participantes.length < 2) throw new Error('Sao necessarios pelo menos 2 participantes');
        const rods = load('rodadas').filter(r => r.torneio_id === torneioId);
        const numRodada = rods.length + 1;
        if (numRodada > (t.num_rodadas || 5)) throw new Error('Numero maximo de rodadas ja atingido');
        const rodada = { id: genId(), torneio_id: torneioId, numero: numRodada, status: 'aberta', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        rods.push(rodada); save('rodadas', rods);
        const pares = gerarEmparelhamentoBrowser(torneioId);
        const parts = load('partidas');
        pares.forEach(par => {
          parts.push({ id: genId(), rodada_id: rodada.id, mesa: par.mesa, jogador_brancas_id: par.jogador_brancas_id, jogador_pretas_id: par.jogador_pretas_id, resultado: par.resultado || '*', vencedor_id: null, bye: par.bye || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        });
        save('partidas', parts);
        return { rodada_id: rodada.id, numero: numRodada };
      },
      gerarTodasRodadas(torneioId) {
        const t = load('torneios').find(x => x.id === torneioId); if (!t || t.status !== 'ativo') throw new Error('Torneio nao esta ativo');
        if (load('rodadas').some(r => r.torneio_id === torneioId && r.status === 'aberta')) throw new Error('Feche a rodada aberta antes');
        const participantes = load('torneio_participantes').filter(p => p.torneio_id === torneioId && p.ativo !== 0);
        if (participantes.length < 2) throw new Error('Minimo 2 participantes');
        const existentes = load('rodadas').filter(r => r.torneio_id === torneioId).length;
        const criadas = [];
        for (let i = existentes + 1; i <= (t.num_rodadas || 5); i++) {
          const rodada = { id: genId(), torneio_id: torneioId, numero: i, status: 'aberta', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          const rods = load('rodadas'); rods.push(rodada); save('rodadas', rods);
          const pares = gerarEmparelhamentoBrowser(torneioId);
          const parts = load('partidas');
          pares.forEach(par => {
            parts.push({ id: genId(), rodada_id: rodada.id, mesa: par.mesa, jogador_brancas_id: par.jogador_brancas_id, jogador_pretas_id: par.jogador_pretas_id, resultado: par.resultado || '*', vencedor_id: null, bye: par.bye || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
          });
          save('partidas', parts);
          criadas.push({ rodada_id: rodada.id, numero: i });
        }
        return criadas;
      },
      rodadas(torneioId) {
        const jogs = load('jogadores');
        return load('rodadas').filter(r => r.torneio_id === torneioId).map(r => ({
          ...r, partidas: load('partidas').filter(p => p.rodada_id === r.id).map(p => {
            const jb = jogs.find(x => x.id === p.jogador_brancas_id) || {}; const jp = jogs.find(x => x.id === p.jogador_pretas_id) || {};
            return { ...p, brancas_nome: jb.nome_completo || 'BYE', pretas_nome: jp.nome_completo || 'BYE' };
          })
        }));
      },
      registrarResultado(partidaId, resultado) {
        const parts = load('partidas'); const p = parts.find(x => x.id === partidaId); if (!p) throw new Error('Partida nao encontrada');
        if (resultado === 'bye') { p.resultado = 'bye'; p.bye = 1; p.vencedor_id = p.jogador_brancas_id; }
        else { p.resultado = resultado; p.bye = 0;
          if (resultado === '1-0') p.vencedor_id = p.jogador_brancas_id;
          else if (resultado === '0-1') p.vencedor_id = p.jogador_pretas_id;
          else p.vencedor_id = null;
        }
        p.updated_at = new Date().toISOString(); save('partidas', parts);
        const rodada = load('rodadas').find(r => r.id === p.rodada_id);
        if (rodada) {
          const jogs = [p.jogador_brancas_id, p.jogador_pretas_id].filter(Boolean);
          jogs.forEach(jid => atualizarPontuacaoJogador(rodada.torneio_id, jid));
        }
      },
      fecharRodada(rodadaId) {
        const rods = load('rodadas'); const r = rods.find(x => x.id === rodadaId); if (!r) return;
        const pendentes = load('partidas').filter(p => p.rodada_id === rodadaId && p.resultado === '*' && p.bye === 0);
        if (pendentes.length) throw new Error(pendentes.length + ' partida(s) sem resultado');
        r.status = 'fechada'; r.updated_at = new Date().toISOString(); save('rodadas', rods);
      },
      reabrirRodada(rodadaId) {
        const rods = load('rodadas'); const r = rods.find(x => x.id === rodadaId); if (!r) return;
        r.status = 'aberta'; r.updated_at = new Date().toISOString(); save('rodadas', rods);
      }
    };
  }

  function gerarEmparelhamentoBrowser(torneioId) {
    const participantes = load('torneio_participantes').filter(p => p.torneio_id === torneioId && p.ativo !== 0);
    const partidas = load('partidas');
    const rodadas = load('rodadas').filter(r => r.torneio_id === torneioId);
    const rodadaIds = rodadas.map(r => r.id);

    const historico = {};
    const cores = {};
    const jaTeveBye = new Set();

    partidas.filter(p => rodadaIds.includes(p.rodada_id)).forEach(p => {
      if (p.jogador_brancas_id && p.jogador_pretas_id) {
        if (!historico[p.jogador_brancas_id]) historico[p.jogador_brancas_id] = new Set();
        if (!historico[p.jogador_pretas_id]) historico[p.jogador_pretas_id] = new Set();
        historico[p.jogador_brancas_id].add(p.jogador_pretas_id);
        historico[p.jogador_pretas_id].add(p.jogador_brancas_id);
      }
      if (p.jogador_brancas_id) cores[p.jogador_brancas_id] = (cores[p.jogador_brancas_id] || 0) + 1;
      if (p.jogador_pretas_id) cores[p.jogador_pretas_id] = (cores[p.jogador_pretas_id] || 0) - 1;
      if (p.bye && p.jogador_brancas_id) jaTeveBye.add(p.jogador_brancas_id);
      if (p.bye && p.jogador_pretas_id) jaTeveBye.add(p.jogador_pretas_id);
    });

    const jogadores = participantes.map(p => ({
      ...p, corBalance: cores[p.jogador_id] || 0, historico: historico[p.jogador_id] || new Set(),
      jaTeveBye: jaTeveBye.has(p.jogador_id)
    }));

    const shuffled = [...jogadores];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const sorted = shuffled.sort((a, b) => b.pontuacao - a.pontuacao);

    const pares = [];
    const usados = new Set();
    const naoEmparelhados = [];

    for (const jog of sorted) {
      if (usados.has(jog.jogador_id)) continue;
      let adversario = null;
      for (const outro of sorted) {
        if (outro.jogador_id === jog.jogador_id || usados.has(outro.jogador_id)) continue;
        if (jog.historico.has(outro.jogador_id)) continue;
        if (Math.abs(jog.pontuacao - outro.pontuacao) <= 1) { adversario = outro; break; }
      }
      if (!adversario) {
        for (const outro of sorted) {
          if (outro.jogador_id === jog.jogador_id || usados.has(outro.jogador_id)) continue;
          if (jog.historico.has(outro.jogador_id)) continue;
          adversario = outro; break;
        }
      }
      if (adversario) {
        usados.add(jog.jogador_id); usados.add(adversario.jogador_id);
        const corBrancas = (jog.corBalance || 0) <= (adversario.corBalance || 0) ? jog.jogador_id : adversario.jogador_id;
        const corPretas = corBrancas === jog.jogador_id ? adversario.jogador_id : jog.jogador_id;
        pares.push({ brancas_id: corBrancas, pretas_id: corPretas, brancas: jog, pretas: adversario });
      } else {
        naoEmparelhados.push(jog);
      }
    }

    if (naoEmparelhados.length > 0) {
      const candidatosBye = naoEmparelhados.filter(j => !j.jaTeveBye).sort((a, b) => b.pontuacao - a.pontuacao);
      if (candidatosBye.length > 0) {
        const byeJogador = candidatosBye[0];
        usados.add(byeJogador.jogador_id);
        pares.push({ brancas_id: byeJogador.jogador_id, pretas_id: null, bye: true, isBye: true, brancas: byeJogador, pretas: null });
      } else if (naoEmparelhados.length >= 2) {
        for (let i = 0; i < naoEmparelhados.length - 1; i += 2) {
          const j1 = naoEmparelhados[i]; const j2 = naoEmparelhados[i + 1];
          pares.push({ brancas_id: j1.jogador_id, pretas_id: j2.jogador_id, brancas: j1, pretas: j2 });
        }
        if (naoEmparelhados.length % 2 !== 0) {
          const last = naoEmparelhados[naoEmparelhados.length - 1];
          pares.push({ brancas_id: last.jogador_id, pretas_id: null, bye: true, isBye: true, brancas: last, pretas: null });
        }
      } else {
        const last = naoEmparelhados[0];
        pares.push({ brancas_id: last.jogador_id, pretas_id: null, bye: true, isBye: true, brancas: last, pretas: null });
      }
    }

    const numMesas = 1 + Math.floor(jogadores.length / 2);
    const jogs = load('jogadores');
    return pares.map((par, idx) => ({
      mesa: Math.floor(numMesas - idx),
      jogador_brancas_id: par.brancas_id,
      jogador_pretas_id: par.pretas_id,
      jogador_brancas_nome: par.brancas ? (jogs.find(j => j.id === par.brancas_id) || {}).nome_completo || 'BYE' : 'BYE',
      jogador_pretas_nome: par.pretas ? (jogs.find(j => j.id === par.pretas_id) || {}).nome_completo || 'BYE' : 'BYE',
      resultado: par.isBye ? 'bye' : '*',
      bye: par.isBye ? 1 : 0
    }));
  }

  function calcularClassificacao(torneioId) {
    const t = load('torneios').find(x => x.id === torneioId);
    if (!t) return [];
    const criterios = (() => { try { return JSON.parse(t.criterios_desempate); } catch(e) { return ['pontuacao','buchholz','sonneborn','vitorias']; } })();
    const participantes = load('torneio_participantes').filter(p => p.torneio_id === torneioId);
    const partidas = load('partidas');
    const rodadas = load('rodadas').filter(r => r.torneio_id === torneioId);
    const rodadaIds = rodadas.map(r => r.id);
    const partidasTorneio = partidas.filter(p => rodadaIds.includes(p.rodada_id));
    const jogs = load('jogadores');
    const ts = load('turmas');

    function calcBuchholz(jogadorId) {
      let total = 0;
      partidasTorneio.filter(p => (p.jogador_brancas_id === jogadorId || p.jogador_pretas_id === jogadorId) && p.resultado !== '*' && !p.bye).forEach(p => {
        const advId = p.jogador_brancas_id === jogadorId ? p.jogador_pretas_id : p.jogador_brancas_id;
        if (advId) { const adv = participantes.find(x => x.jogador_id === advId); if (adv) total += adv.pontuacao; }
      });
      return total;
    }

    function calcBuchholzMediano(jogadorId) {
      const pontos = [];
      partidasTorneio.filter(p => (p.jogador_brancas_id === jogadorId || p.jogador_pretas_id === jogadorId) && p.resultado !== '*' && !p.bye).forEach(p => {
        const advId = p.jogador_brancas_id === jogadorId ? p.jogador_pretas_id : p.jogador_brancas_id;
        if (advId) { const adv = participantes.find(x => x.jogador_id === advId); if (adv) pontos.push(adv.pontuacao); }
      });
      if (pontos.length <= 2) return pontos.reduce((s, v) => s + v, 0);
      pontos.sort((a, b) => a - b);
      return pontos.slice(1, -1).reduce((s, v) => s + v, 0);
    }

    function calcSonneborn(jogadorId) {
      let total = 0;
      partidasTorneio.filter(p => (p.jogador_brancas_id === jogadorId || p.jogador_pretas_id === jogadorId) && p.resultado !== '*' && !p.bye).forEach(p => {
        const advId = p.jogador_brancas_id === jogadorId ? p.jogador_pretas_id : p.jogador_brancas_id;
        if (!advId) return;
        const adv = participantes.find(x => x.jogador_id === advId);
        if (!adv) return;
        const venceu = p.vencedor_id === jogadorId;
        const empatou = p.resultado === '0.5-0.5';
        if (venceu) total += adv.pontuacao;
        else if (empatou) total += adv.pontuacao / 2;
      });
      return total;
    }

    function calcVitorias(jogadorId) {
      return partidasTorneio.filter(p => p.vencedor_id === jogadorId).length;
    }

    function calcPontuacaoReal(jogadorId) {
      let pts = 0;
      partidasTorneio.filter(p => (p.jogador_brancas_id === jogadorId || p.jogador_pretas_id === jogadorId)).forEach(p => {
        if (p.resultado === '*') return;
        if (p.bye) { pts += 1; return; }
        if (p.vencedor_id === jogadorId) pts += 1;
        else if (p.resultado === '0.5-0.5') pts += 0.5;
      });
      return pts;
    }

    participantes.forEach(p => {
      const real = calcPontuacaoReal(p.jogador_id);
      p.pontuacao = real;
    });
    save('torneio_participantes', load('torneio_participantes'));

    const enriched = participantes.map(p => {
      const j = jogs.find(x => x.id === p.jogador_id) || {};
      const tm = ts.find(function(x) { return Number(x.id) === Number(j.turma_id); }) || {};
      return { ...p, nome_completo: j.nome_completo || '', turma_id: j.turma_id, ano_nascimento: j.ano_nascimento, turma_nome: tm.nome || '' };
    });

    const vals = {};
    enriched.forEach(p => {
      v = vals[p.jogador_id] = {};
      v.pontuacao = p.pontuacao;
      v.buchholz = calcBuchholz(p.jogador_id);
      v.buchholz_mediano = calcBuchholzMediano(p.jogador_id);
      v.sonneborn = calcSonneborn(p.jogador_id);
      v.vitorias = calcVitorias(p.jogador_id);
      v.ano_nascimento = -(p.ano_nascimento || 0);
    });

    enriched.sort((a, b) => {
      for (const crit of criterios) {
        let va = vals[a.jogador_id][crit] ?? 0;
        let vb = vals[b.jogador_id][crit] ?? 0;
        if (vb !== va) return vb - va;
      }
      return 0;
    });

    return enriched.map((p, idx) => ({
      posicao: idx + 1, ...p, buchholz: vals[p.jogador_id].buchholz, sonneborn: vals[p.jogador_id].sonneborn,
      criterios_usados: criterios
    }));
  }

  function atualizarEstatisticasJogador(torneioId, jogadorId) {
    const partidas = load('partidas');
    const rodadas = load('rodadas').filter(r => r.torneio_id === torneioId);
    const rodadaIds = rodadas.map(r => r.id);
    const minhas = partidas.filter(p => rodadaIds.includes(p.rodada_id) && (p.jogador_brancas_id === jogadorId || p.jogador_pretas_id === jogadorId) && p.resultado !== '*');

    let vitorias = 0, empates = 0, derrotas = 0, vitorias_brancas = 0, vitorias_pretas = 0;
    let cor_brancas_count = 0, cor_pretas_count = 0;
    let seqVitorias = 0, seqInvicto = 0, maxSeqVitorias = 0, maxSeqInvicto = 0;

    minhas.sort((a, b) => a.id - b.id).forEach(p => {
      const ehBrancas = p.jogador_brancas_id === jogadorId;
      if (ehBrancas || p.jogador_pretas_id === jogadorId) {
        if (ehBrancas) cor_brancas_count++; else cor_pretas_count++;
      }
      if (p.bye) return;
      if (p.vencedor_id === jogadorId) {
        vitorias++; if (ehBrancas) vitorias_brancas++; else vitorias_pretas++;
        seqVitorias++; seqInvicto++;
      } else if (p.resultado === '0.5-0.5') {
        empates++; seqVitorias = 0; seqInvicto++;
      } else {
        derrotas++; seqVitorias = 0; seqInvicto = 0;
      }
      maxSeqVitorias = Math.max(maxSeqVitorias, seqVitorias);
      maxSeqInvicto = Math.max(maxSeqInvicto, seqInvicto);
    });

    const parts = load('torneio_participantes');
    const tp = parts.find(x => x.torneio_id === torneioId && x.jogador_id === jogadorId);
    if (tp) {
      Object.assign(tp, { vitorias, empates, derrotas, vitorias_brancas, vitorias_pretas, cor_brancas_count, cor_pretas_count, sequencia_vitorias: seqVitorias, sequencia_invicto: seqInvicto, max_sequencia_vitorias: maxSeqVitorias, max_sequencia_invicto: maxSeqInvicto });
      save('torneio_participantes', parts);
    }
  }

  function atualizarPontuacaoJogador(torneioId, jogadorId) {
    const partidas = load('partidas');
    const rodadas = load('rodadas').filter(r => r.torneio_id === torneioId);
    const rodadaIds = rodadas.map(r => r.id);
    const minhas = partidas.filter(p => rodadaIds.includes(p.rodada_id) && (p.jogador_brancas_id === jogadorId || p.jogador_pretas_id === jogadorId) && p.resultado !== '*');
    let pts = 0, byes = 0;
    minhas.forEach(p => {
      if (p.bye) { pts += 1; byes++; return; }
      if (p.vencedor_id === jogadorId) pts += 1;
      else if (p.resultado === '0.5-0.5') pts += 0.5;
    });
    const parts = load('torneio_participantes');
    const tp = parts.find(x => x.torneio_id === torneioId && x.jogador_id === jogadorId);
    if (tp) { tp.pontuacao = pts; tp.bye_count = byes; save('torneio_participantes', parts); }
    atualizarEstatisticasJogador(torneioId, jogadorId);
  }

  window.Data = { init, login, logout, getUsuarioLogado, turmas: turmas(), jogadores: jogadores(), torneios: torneios() };
  init();
})();

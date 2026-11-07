// js/sorteios.js
// Telas do usuário comum: home, detalhe do sorteio, pagamento, meus bolões.

/* ============================================================
   HOME — lista de sorteios (abertos, em andamento, finalizados)
   ============================================================ */
async function pageHome() {
  const { data, error } = await db
    .from('sorteios')
    .select('id, titulo, tipo_jogo, data_sorteio, prazo_participacao, valor_cota, imagem_capa_url, status, premio_total')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const lista = data || [];
  const abertos = lista.filter(s => effectiveStatus(s) === 'aberto');
  const andamento = lista.filter(s => effectiveStatus(s) === 'em_andamento');
  const finalizados = lista.filter(s => effectiveStatus(s) === 'finalizado');

  const container = el('div');

  // Cabeçalho / boas-vindas
  if (currentProfile) {
    container.appendChild(el('h1', { class: 'page-title' }, [
      `Olá, ${currentProfile.full_name.split(' ')[0]} 👋`,
    ]));
  } else {
    container.appendChild(el('h1', { class: 'page-title' }, 'Bolões disponíveis 🎲'));
  }

  if (!lista.length) {
    container.appendChild(emptyState('🎯', 'Nenhum bolão criado ainda', 'Aguarde o administrador criar o primeiro.'));
    return container;
  }

  container.appendChild(sectionSorteios('Abertos para participação', abertos));
  container.appendChild(sectionSorteios('Em andamento', andamento));
  container.appendChild(sectionSorteios('Finalizados', finalizados));

  return container;
}

function sectionSorteios(title, items) {
  const wrap = el('section');
  wrap.appendChild(el('h2', { class: 'section-title' }, `${title} (${items.length})`));

  if (!items.length) {
    wrap.appendChild(el('div', { class: 'text-sm text-soft', style: 'padding:.5rem 0;' }, 'Nada por aqui.'));
    return wrap;
  }

  const grid = el('div', { class: 'sorteio-grid' });
  for (const s of items) grid.appendChild(sorteioCard(s));
  wrap.appendChild(grid);
  return wrap;
}

function sorteioCard(s) {
  const st = effectiveStatus(s);
  const cover = s.imagem_capa_url
    ? el('img', { src: s.imagem_capa_url, alt: '' })
    : document.createTextNode('🎰');

  return el('a', { href: `#/sorteio/${s.id}`, class: 'sorteio-card' }, [
    el('div', { class: 'sorteio-cover' }, cover),
    el('div', { class: 'sorteio-body' }, [
      el('div', { class: 'row-between' }, [
        el('div', { class: 'sorteio-title' }, s.titulo),
        el('span', { class: `badge badge-${st}` }, statusLabel(st)),
      ]),
      el('div', { class: 'sorteio-meta' }, [
        el('span', {}, `🎯 ${s.tipo_jogo}`),
        el('span', {}, `📅 ${fmtDateTime(s.data_sorteio || s.prazo_participacao)}`),
      ]),
      el('div', { class: 'sorteio-price' }, `${fmtBRL(s.valor_cota)} / cota`),
    ]),
  ]);
}

/* ============================================================
   DETALHE DO SORTEIO
   ============================================================ */
async function pageSorteio({ id }) {
  const { data: sorteio, error } = await db
    .from('sorteios')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;

  const st = effectiveStatus(sorteio);

  // Participações aprovadas (para contagem e lista, se autorizado pela RLS)
  const { data: aprovadas } = await db
    .from('participacoes')
    .select('id, user_id, valor_cota, status, declarado_em, profiles(full_name, phone)')
    .eq('sorteio_id', id)
    .eq('status', 'aprovado');

  const listaAprovadas = aprovadas || [];
  const totalCotas = listaAprovadas.length;
  const totalArrecadado = listaAprovadas.reduce((acc, p) => acc + Number(p.valor_cota), 0);

  // Minhas participações neste sorteio
  let minhas = [];
  if (currentUser) {
    const { data } = await db
      .from('participacoes')
      .select('id, status, valor_cota, declarado_em')
      .eq('sorteio_id', id)
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    minhas = data || [];
  }
  const minhasAprovadas = minhas.filter(p => p.status === 'aprovado');
  const minhasPendentes = minhas.filter(p => p.status === 'pendente');
  const tenhoAprovada = minhasAprovadas.length > 0;

  const container = el('div');

  // Hero
  container.appendChild(el('div', { class: 'sorteio-hero' },
    sorteio.imagem_capa_url
      ? el('img', { src: sorteio.imagem_capa_url, alt: '' })
      : el('div', { class: 'placeholder' }, '🎰')
  ));

  // Título + status
  container.appendChild(el('div', { class: 'row-between mb-2' }, [
    el('h1', { class: 'page-title', style: 'margin:0;' }, sorteio.titulo),
    el('span', { class: `badge badge-${st}` }, statusLabel(st)),
  ]));

  // Informações
  container.appendChild(el('div', { class: 'card card-pad mb-2' }, [
    el('div', { class: 'info-list' }, [
      infoRow('Jogo', sorteio.tipo_jogo),
      sorteio.codigo_sorteio && infoRow('Código', sorteio.codigo_sorteio),
      infoRow('Data do sorteio', fmtDateTime(sorteio.data_sorteio)),
      infoRow('Prazo para participar', fmtDateTime(sorteio.prazo_participacao)),
      infoRow('Valor da cota', fmtBRL(sorteio.valor_cota)),
    ]),
  ]));

  // Descrição
  if (sorteio.descricao) {
    container.appendChild(el('div', { class: 'card card-pad mb-2' }, [
      el('h3', { style: 'font-size:.95rem;margin-bottom:.4rem;' }, 'Como funciona'),
      el('p', { class: 'text-sm text-muted', style: 'white-space:pre-wrap;margin:0;' }, sorteio.descricao),
    ]));
  }

  // Stats (visíveis para aprovados ou admin)
  if (tenhoAprovada || currentProfile?.is_admin) {
    container.appendChild(statsSorteio({
      totalCotas, totalArrecadado, minhasAprovadas, sorteio,
    }));
  }

  // Ações principais
  container.appendChild(acoesSorteio({
    sorteio, st, minhasPendentes, tenhoAprovada,
  }));

  // Minhas participações (se houver)
  if (minhas.length) {
    container.appendChild(blocoMinhasParticipacoes(minhas));
  }

  // Lista de participantes aprovados (para aprovados e admin)
  if (tenhoAprovada || currentProfile?.is_admin) {
    container.appendChild(blocoParticipantes(listaAprovadas, sorteio));
    container.appendChild(await blocoJogosRealizados(sorteio, tenhoAprovada || currentProfile?.is_admin));
  }

  // Resultado final
  if (st === 'finalizado') {
    container.appendChild(blocoResultado(sorteio, listaAprovadas, tenhoAprovada));
  }

  return container;
}

function infoRow(label, value) {
  return el('div', { class: 'info-row' }, [
    el('span', { class: 'label' }, label),
    el('span', { class: 'value' }, value || '—'),
  ]);
}

function statsSorteio({ totalCotas, totalArrecadado, minhasAprovadas, sorteio }) {
  const minhasCotas = minhasAprovadas.length;
  const minhaFracao = totalCotas ? minhasCotas / totalCotas : 0;
  const premioPorCota = sorteio.premio_total && totalCotas
    ? Number(sorteio.premio_total) / totalCotas : null;
  const meuPremio = premioPorCota != null ? premioPorCota * minhasCotas : null;

  return el('div', { class: 'card card-pad mb-2' }, [
    el('h3', { style: 'font-size:.95rem;margin-bottom:.6rem;' }, '📊 Números do bolão'),
    el('div', { class: 'stats-grid' }, [
      stat('Total arrecadado', fmtBRL(totalArrecadado)),
      stat('Cotas vendidas', String(totalCotas)),
      stat('Minhas cotas', String(minhasCotas), true),
      stat('Minha fração', `${(minhaFracao * 100).toFixed(1)}%`, true),
    ]),
    premioPorCota != null
      ? el('div', { class: 'mt-2 text-sm' }, [
          el('div', { class: 'row-between' }, [
            el('span', { class: 'text-muted' }, 'Prêmio total'),
            el('strong', {}, fmtBRL(sorteio.premio_total)),
          ]),
          el('div', { class: 'row-between' }, [
            el('span', { class: 'text-muted' }, 'Prêmio por cota'),
            el('strong', {}, fmtBRL(premioPorCota)),
          ]),
          el('div', { class: 'row-between', style: 'color:var(--primary);font-weight:700;' }, [
            el('span', {}, 'Seu prêmio estimado'),
            el('span', {}, fmtBRL(meuPremio)),
          ]),
        ])
      : el('div', { class: 'mt-2 text-sm text-soft' },
          'Prêmio a definir — o administrador lançará o valor após o sorteio.'),
  ]);
}

function stat(label, value, primary = false) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat-label' }, label),
    el('div', { class: `stat-value ${primary ? 'primary' : ''}` }, value),
  ]);
}

function acoesSorteio({ sorteio, st, minhasPendentes, tenhoAprovada }) {
  const wrap = el('div', { class: 'card card-pad mb-2' });

  // Aviso de cotas
  wrap.appendChild(el('div', { class: 'text-sm text-muted mb-2' },
    `Cada participação = 1 cota de ${fmtBRL(sorteio.valor_cota)}. Para mais cotas, refaça o processo.`));

  // Pendentes
  if (minhasPendentes.length) {
    wrap.appendChild(el('div', {
      class: 'card card-pad',
      style: 'background:var(--warning-soft);border-color:var(--warning);margin-bottom:.6rem;',
    }, [
      el('div', { class: 'text-sm', style: 'font-weight:600;color:var(--warning);' },
        `⏳ Você tem ${minhasPendentes.length} cota(s) aguardando aprovação.`),
      el('div', { class: 'text-sm text-muted mt-1' }, 'Aguarde o administrador confirmar o pagamento.'),
    ]));
  }

  if (st === 'aberto') {
    if (!currentUser) {
      wrap.appendChild(el('button', {
        class: 'btn btn-primary btn-block btn-lg',
        onClick: () => navigate(`/login?next=${encodeURIComponent('/sorteio/' + sorteio.id)}`),
      }, 'Entrar para participar'));
    } else {
      const label = tenhoAprovada ? 'Adicionar + 1 cota' : 'Participar';
      wrap.appendChild(el('button', {
        class: 'btn btn-primary btn-block btn-lg',
        onClick: () => navigate(`/pagamento/${sorteio.id}`),
      }, label));
    }
  } else if (st === 'em_andamento') {
    wrap.appendChild(el('div', { class: 'text-sm text-muted' },
      'Participações encerradas. Acompanhe abaixo os jogos e o resultado.'));
  } else if (st === 'finalizado') {
    wrap.appendChild(el('div', { class: 'text-sm text-muted' },
      'Sorteio finalizado. Veja o resultado abaixo.'));
  }

  return wrap;
}

function blocoMinhasParticipacoes(minhas) {
  return el('div', { class: 'card card-pad mb-2' }, [
    el('h3', { style: 'font-size:.95rem;margin-bottom:.6rem;' }, '🎟️ Minhas participações'),
    el('div', { class: 'list' }, minhas.map(p =>
      el('div', { class: 'list-item' }, [
        el('div', { class: 'info' }, [
          el('div', { class: 'name' }, fmtBRL(p.valor_cota)),
          el('div', { class: 'sub' }, `Declarado em ${fmtDateTime(p.declarado_em)}`),
        ]),
        el('span', { class: `badge badge-${p.status}` }, statusLabel(p.status)),
      ])
    )),
  ]);
}

function blocoParticipantes(participantes, sorteio) {
  const total = participantes.length;
  return el('div', { class: 'card card-pad mb-2' }, [
    el('h3', { style: 'font-size:.95rem;margin-bottom:.6rem;' },
      `👥 Participantes confirmados (${total})`),
    total === 0
      ? el('div', { class: 'text-sm text-soft' }, 'Nenhum participante confirmado ainda.')
      : el('div', { class: 'list' }, participantes.map(p => {
          const nome = p.profiles?.full_name || 'Participante';
          const iniciais = nome.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
          return el('div', { class: 'list-item' }, [
            el('div', { class: 'avatar' }, iniciais),
            el('div', { class: 'info' }, [
              el('div', { class: 'name' }, nome),
              el('div', { class: 'sub' }, fmtBRL(p.valor_cota)),
            ]),
          ]);
        })),
  ]);
}

async function blocoJogosRealizados(sorteio, podeVer) {
  if (!podeVer) return el('div');
  const { data, error } = await db
    .from('jogos_realizados')
    .select('id, numeros, observacao, created_at')
    .eq('sorteio_id', sorteio.id)
    .order('created_at', { ascending: true });
  if (error) { console.error(error); return el('div'); }

  const jogos = data || [];
  if (!jogos.length) return el('div');

  const sorteados = new Set((sorteio.numeros_sorteados || []).map(String));

  return el('div', { class: 'card card-pad mb-2' }, [
    el('h3', { style: 'font-size:.95rem;margin-bottom:.6rem;' }, '🎯 Jogos realizados'),
    el('div', { class: 'list' }, jogos.map(j => {
      const dezenas = el('div', { class: 'dezenas' },
        (j.numeros || []).map(n => {
          const hit = sorteados.has(String(n));
          return el('span', { class: `dezena ${hit ? 'hit' : ''}` }, String(n).padStart(2, '0'));
        })
      );
      return el('div', { class: 'card card-pad' }, [
        j.observacao ? el('div', { class: 'text-sm text-muted mb-1' }, j.observacao) : null,
        dezenas,
      ]);
    })),
  ]);
}

function blocoResultado(sorteio, participantes, tenhoAprovada) {
  const numeros = sorteio.numeros_sorteados || [];
  const totalCotas = participantes.length;
  const premioTotal = Number(sorteio.premio_total || 0);
  const premioPorCota = totalCotas && premioTotal ? premioTotal / totalCotas : 0;

  const wrap = el('div', { class: 'card card-pad mb-2' }, [
    el('h3', { style: 'font-size:.95rem;margin-bottom:.6rem;' }, '🏁 Resultado oficial'),
  ]);

  if (numeros.length) {
    wrap.appendChild(el('div', { class: 'text-sm text-muted mb-1' }, 'Dezenas sorteadas:'));
    wrap.appendChild(el('div', { class: 'dezenas mb-2' },
      numeros.map(n => el('span', { class: 'dezena' }, String(n).padStart(2, '0')))
    ));
  }

  wrap.appendChild(el('div', { class: 'row-between mb-1' }, [
    el('span', { class: 'text-muted text-sm' }, 'Resultado do bolão'),
    el('span', {
      class: `badge ${sorteio.ganhamos ? 'badge-aprovado' : 'badge-recusado'}`,
    }, sorteio.ganhamos ? '🏆 Ganhamos!' : 'Não foi dessa vez'),
  ]));

  if (premioTotal > 0) {
    wrap.appendChild(el('div', { class: 'row-between text-sm' }, [
      el('span', { class: 'text-muted' }, 'Prêmio total'),
      el('strong', {}, fmtBRL(premioTotal)),
    ]));
    wrap.appendChild(el('div', { class: 'row-between text-sm' }, [
      el('span', { class: 'text-muted' }, 'Prêmio por cota'),
      el('strong', {}, fmtBRL(premioPorCota)),
    ]));

    if (tenhoAprovada) {
      // contar minhas cotas aprovadas
      const minhas = participantes.filter(p => p.user_id === currentUser.id).length;
      wrap.appendChild(el('div', {
        class: 'row-between mt-1',
        style: 'color:var(--primary);font-weight:700;',
      }, [
        el('span', {}, `Seu prêmio (${minhas} cota${minhas > 1 ? 's' : ''})`),
        el('span', {}, fmtBRL(premioPorCota * minhas)),
      ]));
    }
  } else {
    wrap.appendChild(el('div', { class: 'text-sm text-soft' },
      'Valor do prêmio não informado.'));
  }

  return wrap;
}

/* ============================================================
   PAGAMENTO — tela com PIX e botão "Já efetuei o pagamento"
   AQUI é o único lugar que CRIA a participação (pendente).
   ============================================================ */
async function pagePagamento({ id }) {
  if (!requireAuth()) return el('div');

  const { data: sorteio, error } = await db
    .from('sorteios')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;

  if (effectiveStatus(sorteio) !== 'aberto') {
    toast('Este sorteio não está mais aceitando participações.', 'error');
    navigate(`/sorteio/${id}`);
    return el('div');
  }

  const wrap = el('div');

  wrap.appendChild(el('h1', { class: 'page-title' }, '💳 Pagamento da cota'));
  wrap.appendChild(el('p', { class: 'text-muted text-sm mb-2' },
    `Você está participando de: ${sorteio.titulo}`));

  wrap.appendChild(el('div', { class: 'card card-pad mb-2' }, [
    el('div', { class: 'info-list' }, [
      infoRow('Valor da cota', fmtBRL(sorteio.valor_cota)),
      infoRow('Jogo', sorteio.tipo_jogo),
      infoRow('Prazo para pagar', fmtDateTime(sorteio.prazo_participacao)),
    ]),
  ]));

  // PIX
  const pixCard = el('div', { class: 'card card-pad mb-2' });
  pixCard.appendChild(el('h3', { style: 'font-size:.95rem;margin-bottom:.5rem;' }, '🔑 PIX Copia e Cola'));
  pixCard.appendChild(el('div', { class: 'pix-box', id: 'pix-text' }, sorteio.pix_chave));

  const btnCopy = el('button', {
    class: 'btn btn-secondary btn-block mb-2',
    onClick: async () => {
      const ok = await copyText(sorteio.pix_chave);
      toast(ok ? 'PIX copiado!' : 'Não foi possível copiar.', ok ? 'success' : 'error');
    },
  }, '📋 Copiar PIX');

  pixCard.appendChild(btnCopy);

  const btnPago = el('button', {
    class: 'btn btn-success btn-block btn-lg',
    onClick: async () => {
      btnPago.disabled = true;
      btnPago.textContent = 'Registrando...';
      try {
        const { error: insErr } = await db.from('participacoes').insert({
          sorteio_id: sorteio.id,
          user_id: currentUser.id,
          valor_cota: sorteio.valor_cota,
          status: 'pendente',
          declarado_em: new Date().toISOString(),
        });
        if (insErr) throw insErr;
        toast('Pagamento registrado! Aguarde a aprovação do administrador.', 'success', 4000);
        navigate(`/sorteio/${sorteio.id}`);
      } catch (e) {
        console.error(e);
        toast('Erro ao registrar. Tente novamente.', 'error');
        btnPago.disabled = false;
        btnPago.textContent = '✅ Já efetuei o pagamento';
      }
    },
  }, '✅ Já efetuei o pagamento');

  wrap.appendChild(pixCard);
  wrap.appendChild(btnPago);

  wrap.appendChild(el('div', { class: 'text-sm text-soft text-center mt-2' },
    'Após clicar no botão, o administrador será notificado para conferir o pagamento.'));

  return wrap;
}

/* ============================================================
   MEUS BOLÕES
   ============================================================ */
async function pageMeus() {
  if (!requireAuth()) return el('div');

  const { data, error } = await db
    .from('participacoes')
    .select('id, status, valor_cota, declarado_em, sorteio_id, sorteios(id, titulo, tipo_jogo, status, imagem_capa_url, valor_cota, prazo_participacao, data_sorteio)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const items = data || [];
  const wrap = el('div');
  wrap.appendChild(el('h1', { class: 'page-title' }, '🎟️ Meus bolões'));

  if (!items.length) {
    wrap.appendChild(emptyState('🎯', 'Você ainda não participou de nenhum bolão', 'Escolha um na página inicial.'));
    return wrap;
  }

  // Agrupar por sorteio
  const porSorteio = new Map();
  for (const p of items) {
    if (!porSorteio.has(p.sorteio_id)) porSorteio.set(p.sorteio_id, { sorteio: p.sorteios, parts: [] });
    porSorteio.get(p.sorteio_id).parts.push(p);
  }

  const list = el('div', { class: 'list' });
  for (const { sorteio, parts } of porSorteio.values()) {
    if (!sorteio) continue;
    const st = effectiveStatus(sorteio);
    const aprovadas = parts.filter(p => p.status === 'aprovado').length;
    const pendentes = parts.filter(p => p.status === 'pendente').length;
    const recusadas = parts.filter(p => p.status === 'recusado').length;

    list.appendChild(el('a', {
      href: `#/sorteio/${sorteio.id}`, class: 'list-item', style: 'text-decoration:none;color:inherit;',
    }, [
      el('div', { class: 'avatar' }, sorteio.titulo.slice(0, 2).toUpperCase()),
      el('div', { class: 'info' }, [
        el('div', { class: 'name' }, sorteio.titulo),
        el('div', { class: 'sub' },
          `${aprovadas} aprovada(s)${pendentes ? ` • ${pendentes} pendente(s)` : ''}${recusadas ? ` • ${recusadas} recusada(s)` : ''}`),
      ]),
      el('span', { class: `badge badge-${st}` }, statusLabel(st)),
    ]));
  }
  wrap.appendChild(list);
  return wrap;
}
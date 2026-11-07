// js/admin.js
// Painel do administrador: lista de sorteios, criar/editar, aprovar/recusar,
// jogos realizados, lançar resultado e finalizar.

/* ============================================================
   PAINEL — lista de sorteios
   ============================================================ */
async function pageAdmin() {
  if (!requireAdmin()) return el('div');

  const { data, error } = await db
    .from('sorteios')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const lista = data || [];
  const wrap = el('div');

  wrap.appendChild(el('div', { class: 'row-between mb-2' }, [
    el('h1', { class: 'page-title', style: 'margin:0;' }, '🛠️ Painel do administrador'),
    el('a', { href: '#/admin/novo', class: 'btn btn-primary btn-sm' }, '+ Novo sorteio'),
  ]));

  if (!lista.length) {
    wrap.appendChild(emptyState('📋', 'Nenhum sorteio criado', 'Clique em "Novo sorteio" para começar.'));
    return wrap;
  }

  // Contadores por status
  const cont = { aberto: 0, em_andamento: 0, finalizado: 0 };
  lista.forEach(s => cont[effectiveStatus(s)]++);

  wrap.appendChild(el('div', { class: 'stats-grid mb-2' }, [
    stat('Abertos', String(cont.aberto)),
    stat('Em andamento', String(cont.em_andamento)),
    stat('Finalizados', String(cont.finalizado)),
  ]));

  const list = el('div', { class: 'list' });
  for (const s of lista) {
    const st = effectiveStatus(s);
    list.appendChild(el('a', {
      href: `#/admin/sorteio/${s.id}`,
      class: 'list-item',
      style: 'text-decoration:none;color:inherit;',
    }, [
      el('div', { class: 'avatar' }, s.titulo.slice(0, 2).toUpperCase()),
      el('div', { class: 'info' }, [
        el('div', { class: 'name' }, s.titulo),
        el('div', { class: 'sub' }, `${s.tipo_jogo} • ${fmtBRL(s.valor_cota)} / cota`),
      ]),
      el('span', { class: `badge badge-${st}` }, statusLabel(st)),
    ]));
  }
  wrap.appendChild(list);

  return wrap;
}

/* ============================================================
   CRIAR / EDITAR SORTEIO
   ============================================================ */
async function pageAdminNovo() {
  if (!requireAdmin()) return el('div');
  return formSorteio(null);
}

async function pageAdminEditar({ id }) {
  if (!requireAdmin()) return el('div');
  const { data, error } = await db.from('sorteios').select('*').eq('id', id).single();
  if (error) throw error;
  return formSorteio(data);
}

function formSorteio(sorteio) {
  const isEdit = !!sorteio;
  let uploadedUrl = sorteio?.imagem_capa_url || null;

  const wrap = el('div');
  wrap.appendChild(el('h1', { class: 'page-title' },
    isEdit ? '✏️ Editar sorteio' : '➕ Novo sorteio'));

  const form = el('form', { class: 'card card-pad' });

  // Campos
  const inputTitulo = input({ label: 'Título do sorteio', name: 'titulo', value: sorteio?.titulo || '', required: true, placeholder: 'Ex.: Mega da Virada 2026' });
  const inputTipo   = input({ label: 'Tipo de jogo', name: 'tipo_jogo', value: sorteio?.tipo_jogo || '', required: true, placeholder: 'Mega-Sena, Lotofácil, Loteria Federal...' });
  const inputCodigo = input({ label: 'Código do sorteio (opcional)', name: 'codigo_sorteio', value: sorteio?.codigo_sorteio || '', placeholder: 'Ex.: 2720' });
  const inputData   = input({ label: 'Data e hora do sorteio', name: 'data_sorteio', type: 'datetime-local', value: toLocalInput(sorteio?.data_sorteio), required: true });
  const inputPrazo  = input({ label: 'Prazo para participar', name: 'prazo_participacao', type: 'datetime-local', value: toLocalInput(sorteio?.prazo_participacao), required: true });
  const inputValor  = input({ label: 'Valor da cota (R$)', name: 'valor_cota', type: 'number', step: '0.01', min: '0.01', value: sorteio?.valor_cota || '', required: true });
  const inputPix    = input({ label: 'PIX copia e cola / chave', name: 'pix_chave', value: sorteio?.pix_chave || '', required: true, placeholder: 'Cole o código PIX ou a chave' });

  const textareaDesc = el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Descrição / como funciona'),
    el('textarea', {
      class: 'textarea', name: 'descricao', placeholder: 'Explique como o bolão funciona...',
    }, sorteio?.descricao || ''),
  ]);

  form.appendChild(inputTitulo);
  form.appendChild(inputTipo);
  form.appendChild(inputCodigo);
  form.appendChild(el('div', { class: 'row wrap', style: 'gap:.75rem;' }, [
    el('div', { class: 'grow', style: 'min-width:200px;' }, inputData),
    el('div', { class: 'grow', style: 'min-width:200px;' }, inputPrazo),
  ]));
  form.appendChild(inputValor);
  form.appendChild(inputPix);
  form.appendChild(textareaDesc);

  // Upload de capa
  const preview = el('img', {
    class: 'upload-preview', hidden: !uploadedUrl,
    src: uploadedUrl || '',
    alt: '',
  });
  const fileInput = el('input', { type: 'file', accept: 'image/*', hidden: true });
  const uploadBox = el('div', { class: 'upload-box', onClick: () => fileInput.click() }, [
    preview,
    el('div', { class: 'text-sm text-muted' },
      uploadedUrl ? 'Clique para trocar a imagem' : 'Clique para enviar a imagem de capa'),
    el('div', { class: 'text-sm text-soft mt-1', style: 'font-size:.75rem;' },
      'JPG, PNG ou WebP • até 2 MB'),
  ]);
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Imagem muito grande (máx 2 MB).', 'error');
      return;
    }
    uploadBox.querySelector('.text-sm').textContent = 'Enviando...';
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await db.storage.from('capas').upload(path, file, {
        cacheControl: '3600', upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = db.storage.from('capas').getPublicUrl(path);
      uploadedUrl = pub.publicUrl;
      preview.src = uploadedUrl;
      preview.hidden = false;
      uploadBox.querySelector('.text-sm').textContent = 'Clique para trocar a imagem';
      toast('Imagem enviada.', 'success');
    } catch (e) {
      console.error(e);
      toast('Falha ao enviar a imagem.', 'error');
      uploadBox.querySelector('.text-sm').textContent = 'Clique para enviar a imagem de capa';
    }
  });

  form.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Imagem de capa'),
    uploadBox,
    fileInput,
  ]));

  // Ações
  const btnSalvar = el('button', {
    type: 'submit', class: 'btn btn-primary btn-block btn-lg',
  }, isEdit ? 'Salvar alterações' : 'Criar sorteio');
  form.appendChild(btnSalvar);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSalvar.disabled = true;
    btnSalvar.textContent = 'Salvando...';
    try {
      const fd = new FormData(form);
      const payload = {
        titulo: fd.get('titulo')?.toString().trim(),
        tipo_jogo: fd.get('tipo_jogo')?.toString().trim(),
        codigo_sorteio: fd.get('codigo_sorteio')?.toString().trim() || null,
        descricao: fd.get('descricao')?.toString().trim() || null,
        data_sorteio: fd.get('data_sorteio') ? new Date(fd.get('data_sorteio')).toISOString() : null,
        prazo_participacao: new Date(fd.get('prazo_participacao')).toISOString(),
        valor_cota: Number(fd.get('valor_cota')),
        pix_chave: fd.get('pix_chave')?.toString().trim(),
        imagem_capa_url: uploadedUrl,
      };

      if (!payload.titulo || !payload.tipo_jogo || !payload.prazo_participacao
          || !payload.valor_cota || !payload.pix_chave) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }

      if (isEdit) {
        const { error } = await db.from('sorteios').update(payload).eq('id', sorteio.id);
        if (error) throw error;
        toast('Sorteio atualizado.', 'success');
      } else {
        payload.created_by = currentUser.id;
        const { data, error } = await db.from('sorteios').insert(payload).select('id').single();
        if (error) throw error;
        toast('Sorteio criado.', 'success');
        navigate(`/admin/sorteio/${data.id}`);
        return;
      }
      navigate(`/admin/sorteio/${sorteio.id}`);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Erro ao salvar.', 'error');
      btnSalvar.disabled = false;
      btnSalvar.textContent = isEdit ? 'Salvar alterações' : 'Criar sorteio';
    }
  });

  wrap.appendChild(form);
  return wrap;
}

function input({ label, name, type = 'text', value = '', required = false, placeholder = '', step, min }) {
  const attrs = {
    class: 'input', name, type, value, placeholder,
    required: required ? 'required' : null,
  };
  if (step) attrs.step = step;
  if (min) attrs.min = min;
  return el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, label + (required ? ' *' : '')),
    el('input', attrs),
  ]);
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ============================================================
   GERENCIAR SORTEIO — pendentes, aprovados, jogos, resultado
   ============================================================ */
async function pageAdminSorteio({ id }) {
  if (!requireAdmin()) return el('div');

  const { data: sorteio, error } = await db.from('sorteios').select('*').eq('id', id).single();
  if (error) throw error;

  const { data: parts } = await db
    .from('participacoes')
    .select('id, status, valor_cota, declarado_em, aprovado_em, user_id, profiles(full_name, phone)')
    .eq('sorteio_id', id)
    .order('created_at', { ascending: false });

  const { data: jogos } = await db
    .from('jogos_realizados')
    .select('*')
    .eq('sorteio_id', id)
    .order('created_at');

  const todas = parts || [];
  const pendentes = todas.filter(p => p.status === 'pendente');
  const aprovadas = todas.filter(p => p.status === 'aprovado');
  const recusadas = todas.filter(p => p.status === 'recusado');
  const listaJogos = jogos || [];
  const st = effectiveStatus(sorteio);
  const totalArrecadado = aprovadas.reduce((a, p) => a + Number(p.valor_cota), 0);

  const wrap = el('div');

  // Cabeçalho
  wrap.appendChild(el('a', { href: '#/admin', class: 'text-sm text-muted' }, '← Voltar ao painel'));
  wrap.appendChild(el('div', { class: 'row-between mt-1 mb-2 wrap' }, [
    el('h1', { class: 'page-title', style: 'margin:0;' }, sorteio.titulo),
    el('span', { class: `badge badge-${st}` }, statusLabel(st)),
  ]));

  // Ações de status
  const acoes = el('div', { class: 'row wrap mb-2', style: 'gap:.5rem;' });
  acoes.appendChild(el('a', {
    href: `#/admin/sorteio/${id}/editar`,
    class: 'btn btn-secondary btn-sm',
  }, '✏️ Editar'));
  if (st === 'aberto') {
    acoes.appendChild(el('button', {
      class: 'btn btn-secondary btn-sm',
      onClick: async () => {
        const ok = await confirmDialog('Encerrar participação agora?',
          'Novos usuários não poderão mais entrar no bolão.', 'Encerrar');
        if (!ok) return;
        const { error } = await db.from('sorteios').update({ status: 'em_andamento' }).eq('id', id);
        if (error) return toast('Erro ao encerrar.', 'error');
        toast('Participação encerrada.', 'success');
        navigate(`/admin/sorteio/${id}`);
        renderRoute();
      },
    }, '⏹ Encerrar participação'));
  }
  acoes.appendChild(el('a', {
    href: `#/sorteio/${id}`, class: 'btn btn-secondary btn-sm',
  }, '👁 Ver como usuário'));
  wrap.appendChild(acoes);

  // Estatísticas
  wrap.appendChild(el('div', { class: 'stats-grid mb-2' }, [
    stat('Total arrecadado', fmtBRL(totalArrecadado)),
    stat('Cotas aprovadas', String(aprovadas.length), true),
    stat('Pendentes', String(pendentes.length)),
    stat('Recusadas', String(recusadas.length)),
  ]));

  // ============ PENDENTES ============
  wrap.appendChild(el('h3', { class: 'section-title' }, `⏳ Pagamentos pendentes (${pendentes.length})`));
  if (!pendentes.length) {
    wrap.appendChild(el('div', { class: 'text-sm text-soft', style: 'padding:.5rem 0;' }, 'Nenhum pagamento pendente.'));
  } else {
    const list = el('div', { class: 'list mb-2' });
    for (const p of pendentes) {
      list.appendChild(el('div', { class: 'list-item' }, [
        el('div', { class: 'avatar' }, iniciais(p.profiles?.full_name)),
        el('div', { class: 'info' }, [
          el('div', { class: 'name' }, p.profiles?.full_name || 'Participante'),
          el('div', { class: 'sub' },
            `${p.profiles?.phone || ''} • ${fmtBRL(p.valor_cota)} • ${fmtDateTime(p.declarado_em)}`),
        ]),
        el('div', { class: 'actions' }, [
          el('button', {
            class: 'btn btn-success btn-sm',
            onClick: () => aprovarPagamento(p.id, id),
          }, '✓'),
          el('button', {
            class: 'btn btn-danger btn-sm',
            onClick: () => recusarPagamento(p.id, id),
          }, '✕'),
        ]),
      ]));
    }
    wrap.appendChild(list);
  }

  // ============ APROVADOS ============
  wrap.appendChild(el('h3', { class: 'section-title' }, `✅ Participantes confirmados (${aprovadas.length})`));
  if (!aprovadas.length) {
    wrap.appendChild(el('div', { class: 'text-sm text-soft', style: 'padding:.5rem 0;' }, 'Ninguém confirmado ainda.'));
  } else {
    const list = el('div', { class: 'list mb-2' });
    for (const p of aprovadas) {
      list.appendChild(el('div', { class: 'list-item' }, [
        el('div', { class: 'avatar' }, iniciais(p.profiles?.full_name)),
        el('div', { class: 'info' }, [
          el('div', { class: 'name' }, p.profiles?.full_name || 'Participante'),
          el('div', { class: 'sub' },
            `${p.profiles?.phone || ''} • ${fmtBRL(p.valor_cota)} • aprovado em ${fmtDateTime(p.aprovado_em)}`),
        ]),
      ]));
    }
    wrap.appendChild(list);
  }

  // ============ JOGOS REALIZADOS ============
  wrap.appendChild(await blocoAdminJogos(sorteio, listaJogos));

  // ============ RESULTADO ============
  wrap.appendChild(blocoAdminResultado(sorteio, aprovadas, st));

  return wrap;
}

function iniciais(nome) {
  return (nome || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
}

async function aprovarPagamento(partId, sorteioId) {
  const ok = await confirmDialog('Aprovar pagamento?',
    'O usuário passará a ver os jogos e os demais participantes.', 'Aprovar');
  if (!ok) return;
  const { error } = await db.from('participacoes').update({
    status: 'aprovado',
    aprovado_em: new Date().toISOString(),
    aprovado_por: currentUser.id,
  }).eq('id', partId);
  if (error) return toast('Erro ao aprovar.', 'error');
  toast('Pagamento aprovado.', 'success');
  renderRoute();
}

async function recusarPagamento(partId, sorteioId) {
  const ok = await confirmDialog('Recusar pagamento?',
    'O usuário poderá tentar novamente depois.', 'Recusar', true);
  if (!ok) return;
  const { error } = await db.from('participacoes').update({
    status: 'recusado',
    aprovado_em: new Date().toISOString(),
    aprovado_por: currentUser.id,
  }).eq('id', partId);
  if (error) return toast('Erro ao recusar.', 'error');
  toast('Pagamento recusado.', 'info');
  renderRoute();
}

/* ---------- Jogos realizados (admin) ---------- */
async function blocoAdminJogos(sorteio, jogos) {
  const wrap = el('div', { class: 'card card-pad mb-2' }, [
    el('div', { class: 'row-between mb-2' }, [
      el('h3', { style: 'font-size:.95rem;margin:0;' }, '🎯 Jogos realizados'),
      el('button', {
        class: 'btn btn-primary btn-sm',
        onClick: () => abrirFormJogo(sorteio.id),
      }, '+ Adicionar jogo'),
    ]),
  ]);

  if (!jogos.length) {
    wrap.appendChild(el('div', { class: 'text-sm text-soft' }, 'Nenhum jogo cadastrado ainda.'));
    return wrap;
  }

  const list = el('div', { class: 'list' });
  for (const j of jogos) {
    list.appendChild(el('div', { class: 'card card-pad' }, [
      el('div', { class: 'row-between mb-1' }, [
        j.observacao
          ? el('div', { class: 'text-sm text-muted' }, j.observacao)
          : el('div', { class: 'text-sm text-soft' }, 'Jogo'),
        el('button', {
          class: 'btn btn-ghost btn-sm',
          onClick: async () => {
            const ok = await confirmDialog('Remover jogo?', 'Essa ação não pode ser desfeita.', 'Remover', true);
            if (!ok) return;
            await db.from('jogos_realizados').delete().eq('id', j.id);
            toast('Jogo removido.', 'info');
            renderRoute();
          },
        }, '🗑'),
      ]),
      el('div', { class: 'dezenas' },
        (j.numeros || []).map(n => el('span', { class: 'dezena' }, String(n).padStart(2, '0')))),
    ]));
  }
  wrap.appendChild(list);
  return wrap;
}

function abrirFormJogo(sorteioId) {
  const inputObs = el('input', { class: 'input', placeholder: 'Ex.: Jogo 1, surpresinha...' });
  const inputNums = el('input', { class: 'input', placeholder: 'Ex.: 01 05 12 23 34 56' });

  const body = el('div', {}, [
    el('div', { class: 'form-group' }, [
      el('label', { class: 'form-label' }, 'Observação (opcional)'),
      inputObs,
    ]),
    el('div', { class: 'form-group' }, [
      el('label', { class: 'form-label' }, 'Dezenas *'),
      inputNums,
      el('div', { class: 'form-hint' }, 'Separe por espaço, vírgula ou traço.'),
    ]),
  ]);

  modal({
    title: 'Adicionar jogo',
    body,
    actions: [
      { label: 'Cancelar', class: 'btn-secondary' },
      {
        label: 'Salvar', class: 'btn-primary',
        onClick: async () => {
          const numeros = inputNums.value.split(/[\s,\-]+/).map(s => s.trim()).filter(Boolean);
          if (!numeros.length) { toast('Informe as dezenas.', 'error'); return false; }
          const { error } = await db.from('jogos_realizados').insert({
            sorteio_id: sorteioId,
            numeros,
            observacao: inputObs.value.trim() || null,
          });
          if (error) { toast('Erro ao salvar.', 'error'); return false; }
          toast('Jogo adicionado.', 'success');
          renderRoute();
        },
      },
    ],
  });
}

/* ---------- Resultado (admin) ---------- */
function blocoAdminResultado(sorteio, aprovadas, st) {
  const wrap = el('div', { class: 'card card-pad mb-2' });
  wrap.appendChild(el('h3', { style: 'font-size:.95rem;margin-bottom:.6rem;' }, '🏁 Resultado oficial'));

  if (st === 'finalizado') {
    wrap.appendChild(el('div', { class: 'text-sm text-muted mb-1' }, 'Dezenas sorteadas:'));
    wrap.appendChild(el('div', { class: 'dezenas mb-2' },
      (sorteio.numeros_sorteados || []).map(n => el('span', { class: 'dezena' }, String(n).padStart(2, '0')))));
    wrap.appendChild(el('div', { class: 'row-between' }, [
      el('span', { class: 'text-muted text-sm' }, 'Ganhamos?'),
      el('strong', {}, sorteio.ganhamos ? '🏆 Sim' : '❌ Não'),
    ]));
    wrap.appendChild(el('div', { class: 'row-between' }, [
      el('span', { class: 'text-muted text-sm' }, 'Prêmio total'),
      el('strong', {}, fmtBRL(sorteio.premio_total || 0)),
    ]));
    return wrap;
  }

  // Form de lançamento
  const inputNums = el('input', {
    class: 'input',
    placeholder: 'Ex.: 03 12 25 34 41 56',
    value: (sorteio.numeros_sorteados || []).join(' '),
  });
  const inputPremio = el('input', {
    class: 'input', type: 'number', step: '0.01', min: '0',
    placeholder: '0,00',
    value: sorteio.premio_total || '',
  });
  const selectGanhamos = el('select', { class: 'select' }, [
    el('option', { value: '' }, 'Ainda não sei'),
    el('option', { value: 'sim' }, 'Sim — ganhamos'),
    el('option', { value: 'nao' }, 'Não — não ganhamos'),
  ]);
  if (sorteio.ganhamos === true) selectGanhamos.value = 'sim';
  else if (sorteio.ganhamos === false) selectGanhamos.value = 'nao';

  wrap.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Dezenas sorteadas'),
    inputNums,
    el('div', { class: 'form-hint' }, 'Separe por espaço, vírgula ou traço.'),
  ]));
  wrap.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Prêmio total recebido (R$)'),
    inputPremio,
  ]));
  wrap.appendChild(el('div', { class: 'form-group' }, [
    el('label', { class: 'form-label' }, 'Ganhamos?'),
    selectGanhamos,
  ]));

  wrap.appendChild(el('button', {
    class: 'btn btn-primary btn-block',
    onClick: async () => {
      const numeros = inputNums.value.split(/[\s,\-]+/).map(s => s.trim()).filter(Boolean);
      const premio = inputPremio.value ? Number(inputPremio.value) : null;
      const ganhamos = selectGanhamos.value === 'sim' ? true
        : selectGanhamos.value === 'nao' ? false : null;
      if (!numeros.length) { toast('Informe as dezenas sorteadas.', 'error'); return; }
      const { error } = await db.from('sorteios').update({
        numeros_sorteados: numeros,
        premio_total: premio,
        ganhamos,
      }).eq('id', sorteio.id);
      if (error) { toast('Erro ao salvar resultado.', 'error'); return; }
      toast('Resultado salvo.', 'success');
      renderRoute();
    },
  }, '💾 Salvar resultado'));

  wrap.appendChild(el('div', { class: 'divider' }));

  wrap.appendChild(el('button', {
    class: 'btn btn-success btn-block',
    onClick: async () => {
      if (!sorteio.numeros_sorteados?.length) {
        toast('Salve as dezenas sorteadas antes de finalizar.', 'error');
        return;
      }
      const ok = await confirmDialog('Finalizar sorteio?',
        'Após finalizar, o resultado ficará visível para todos os participantes.', 'Finalizar');
      if (!ok) return;
      const { error } = await db.from('sorteios').update({
        status: 'finalizado',
        finalizado_em: new Date().toISOString(),
      }).eq('id', sorteio.id);
      if (error) { toast('Erro ao finalizar.', 'error'); return; }
      toast('Sorteio finalizado!', 'success');
      renderRoute();
    },
  }, '🏁 Finalizar sorteio'));

  wrap.appendChild(el('div', { class: 'text-sm text-soft text-center mt-1' },
    'Ao finalizar, o resultado não poderá ser editado pelo app.'));
  return wrap;
}
import { useRef, useState } from 'react';
import { brl, precoServico, useDados } from '../data/store';
import type { Papel, Perfil, Servico } from '../data/types';
import { Campo, Icone, Janela, Segmento, iniciais, useAviso } from '../ui';

const papelNome: Record<Papel, string> = { dona: 'Dona (vê tudo)', socio: 'Sócio (tudo menos estoque e detalhe das vendas)', profissional: 'Profissional (só o painel dele)' };
type Aba = 'usuarios' | 'servicos' | 'backup' | 'lixeira' | 'atividade';

export default function Ajustes() {
  const { eu } = useDados();
  const [aba, setAba] = useState<Aba>('usuarios');
  const dona = eu?.papel === 'dona';
  const abas: { v: Aba; t: string }[] = [
    { v: 'usuarios', t: 'Usuários' }, { v: 'servicos', t: 'Serviços' },
    ...(dona ? [{ v: 'backup' as Aba, t: 'Backup' }, { v: 'lixeira' as Aba, t: 'Lixeira' }, { v: 'atividade' as Aba, t: 'Atividade' }] : []),
  ];
  return (
    <>
      <div className="topo">
        <div className="coluna" style={{ gap: 2 }}><span className="sub">Ajustes</span><h1>Configurações do salão</h1></div>
      </div>
      <div style={{ overflowX: 'auto' }}><Segmento rotulo="Seção" valor={aba} mudar={setAba} opcoes={abas} /></div>
      {aba === 'usuarios' && <Usuarios />}
      {aba === 'servicos' && <Servicos />}
      {aba === 'backup' && dona && <Backup />}
      {aba === 'lixeira' && dona && <Lixeira />}
      {aba === 'atividade' && dona && <Atividade />}
    </>
  );
}

function Usuarios() {
  const { db } = useDados();
  const [editar, setEditar] = useState<Perfil | 'novo' | null>(null);
  return (
    <section className="neu card">
      <div className="linha entre"><h2>Quem usa o sistema</h2><button className="btn primario mini" onClick={() => setEditar('novo')}><Icone nome="mais" tam={16} /> Novo usuário</button></div>
      <div className="lista">
        {db.perfis.map((p) => (
          <div key={p.id} className="item-lista neu-in" data-tema={p.tema}>
            <span className="avatar">{iniciais(p.nome)}</span>
            <div className="coluna cresce" style={{ gap: 2 }}>
              <strong>{p.nome} {!p.ativo && <span className="etiqueta alerta">Desativado</span>}</strong>
              <span className="pequeno">{papelNome[p.papel]}, tela {p.tema}{p.papel === 'profissional' ? `, comissão ${p.comissaoMaoObra}% mão de obra e ${p.comissaoQuimica}% química` : ''}</span>
              {(p.usuario || p.email) && <span className="pequeno">Entra com {p.usuario ? `usuário "${p.usuario}" e PIN` : p.email}{p.temLogin === false ? ' (login ainda não criado)' : ''}</span>}
            </div>
            <button className="btn btn-icone mini" aria-label={`Editar ${p.nome}`} onClick={() => setEditar(p)}><Icone nome="editar" tam={16} /></button>
          </div>
        ))}
      </div>
      <Janela titulo={editar === 'novo' ? 'Novo usuário' : 'Editar usuário'} aberta={!!editar} fechar={() => setEditar(null)}>
        {editar && <FormUsuario p={editar === 'novo' ? null : editar} fechar={() => setEditar(null)} />}
      </Janela>
    </section>
  );
}

function FormUsuario({ p, fechar }: { p: Perfil | null; fechar: () => void }) {
  const { salvarPerfil, eu } = useDados();
  const avisar = useAviso();
  const [nome, setNome] = useState(p?.nome ?? '');
  const [papel, setPapel] = useState<Papel>(p?.papel ?? 'profissional');
  const [tema, setTema] = useState<'rosa' | 'azul'>(p?.tema ?? 'azul');
  const [mo, setMo] = useState(String(p?.comissaoMaoObra ?? 0));
  const [qu, setQu] = useState(String(p?.comissaoQuimica ?? 0));
  const [ativo, setAtivo] = useState(p?.ativo ?? true);
  const [email, setEmail] = useState(p?.email && !p?.usuario ? p.email : '');
  const [usuario, setUsuario] = useState(p?.usuario ?? '');
  const [pin, setPin] = useState('');
  const [msgPin, setMsgPin] = useState('');
  const souEu = p?.id === eu?.id;
  const { demo, redefinirPin } = useDados();
  return (
    <form className="coluna" onSubmit={(e) => {
      e.preventDefault();
      if (!nome.trim()) return;
      const u = usuario.trim().toLowerCase();
      salvarPerfil({ id: p?.id, nome: nome.trim(), papel, tema, comissaoMaoObra: Number(mo) || 0, comissaoQuimica: Number(qu) || 0, ativo,
        usuario: u || null, email: u ? `${u}@alvorada.app` : email.trim().toLowerCase() || null });
      avisar('Usuário salvo');
      fechar();
    }}>
      <Campo rotulo="Nome">{(id) => <input id={id} className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />}</Campo>
      <Campo rotulo="O que pode fazer">{(id) => (
        <select id={id} className="entrada" value={papel} onChange={(e) => setPapel(e.target.value as Papel)} disabled={souEu}>
          {(Object.keys(papelNome) as Papel[]).filter((k) => k !== 'dona' || eu?.papel === 'dona').map((k) => <option key={k} value={k}>{papelNome[k]}</option>)}
        </select>
      )}</Campo>
      <Segmento rotulo="Cor da tela" valor={tema} mudar={setTema} opcoes={[{ v: 'rosa', t: 'Rosa' }, { v: 'azul', t: 'Azul' }]} />
      {papel === 'profissional' && (
        <div className="grade-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Campo rotulo="Comissão mão de obra (%)">{(id) => <input id={id} className="entrada" inputMode="numeric" value={mo} onChange={(e) => setMo(e.target.value)} />}</Campo>
          <Campo rotulo="Comissão química (%)">{(id) => <input id={id} className="entrada" inputMode="numeric" value={qu} onChange={(e) => setQu(e.target.value)} />}</Campo>
        </div>
      )}
      {!demo && (
        <div className="grade-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Campo rotulo="E-mail de login">{(id) => <input id={id} className="entrada" type="email" value={email} disabled={!!usuario.trim()} onChange={(e) => setEmail(e.target.value)} placeholder="quem tem e-mail" />}</Campo>
          <Campo rotulo="Ou usuário (entra com PIN)">{(id) => <input id={id} className="entrada" autoCapitalize="none" value={usuario} onChange={(e) => setUsuario(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))} placeholder="ex.: roberto" />}</Campo>
        </div>
      )}
      {!demo && !p && <p className="pequeno">Depois de salvar, o login é criado no painel do Supabase (Authentication, Add user) com esse mesmo e-mail{usuario.trim() ? ` (${usuario.trim().toLowerCase()}@alvorada.app)` : ''}. Ele se liga a este perfil sozinho.</p>}
      {!souEu && p && (
        <label className="linha" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ width: 22, height: 22 }} />
          Pode entrar no sistema
        </label>
      )}
      <button className="btn primario" type="submit" disabled={!nome.trim()}>Salvar</button>
      {!demo && p?.usuario && !souEu && (
        <div className="neu-in card">
          <strong>Trocar o PIN de {p.nome.split(' ')[0]}</strong>
          <div className="linha">
            <input className="entrada cresce" aria-label="Novo PIN" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="6 números" style={{ width: 'auto' }} />
            <button type="button" className="btn" disabled={pin.length !== 6} onClick={async () => {
              const r = await redefinirPin(p.usuario!, pin);
              setMsgPin(r ?? `PIN novo: ${pin}. Avise o ${p.nome.split(' ')[0]}.`);
              if (!r) setPin('');
            }}>Trocar PIN</button>
          </div>
          {msgPin && <p className="pequeno" role="status">{msgPin}</p>}
        </div>
      )}
    </form>
  );
}

function Servicos() {
  const { db, perfil } = useDados();
  const [editar, setEditar] = useState<Servico | 'novo' | null>(null);
  return (
    <section className="neu card">
      <div className="linha entre"><h2>Serviços e preços</h2><button className="btn primario mini" onClick={() => setEditar('novo')}><Icone nome="mais" tam={16} /> Novo serviço</button></div>
      <div className="tabela-caixa">
        <table>
          <thead><tr><th>Serviço</th><th>Duração</th><th>Preço</th><th>Tipo</th><th>Quem faz</th><th /></tr></thead>
          <tbody>
            {db.servicos.map((s) => (
              <tr key={s.id} style={{ opacity: s.ativo ? 1 : .5 }}>
                <td><strong>{s.nome}</strong></td>
                <td>{s.duracaoMin >= 60 ? `${s.duracaoMin / 60}h` : `${s.duracaoMin} min`}</td>
                <td>{precoServico(s)}</td>
                <td>{s.categoria === 'quimica' ? 'Química' : 'Mão de obra'}</td>
                <td>{s.soPerfil ? `Só ${perfil(s.soPerfil)?.nome.split(' ')[0]}` : 'Todos'}</td>
                <td><button className="btn btn-icone mini" aria-label={`Editar ${s.nome}`} onClick={() => setEditar(s)}><Icone nome="editar" tam={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Janela titulo={editar === 'novo' ? 'Novo serviço' : 'Editar serviço'} aberta={!!editar} fechar={() => setEditar(null)}>
        {editar && <FormServico s={editar === 'novo' ? null : editar} fechar={() => setEditar(null)} />}
      </Janela>
    </section>
  );
}

function FormServico({ s, fechar }: { s: Servico | null; fechar: () => void }) {
  const { db, salvarServico } = useDados();
  const avisar = useAviso();
  const [nome, setNome] = useState(s?.nome ?? '');
  const [dur, setDur] = useState(String(s?.duracaoMin ?? 60));
  const [tipo, setTipo] = useState<Servico['tipoPreco']>(s?.tipoPreco ?? 'fixo');
  const [preco, setPreco] = useState(s?.preco != null ? String(s.preco).replace('.', ',') : '');
  const [cat, setCat] = useState<Servico['categoria']>(s?.categoria ?? 'mao_obra');
  const [so, setSo] = useState(s?.soPerfil ?? '');
  const [ativo, setAtivo] = useState(s?.ativo ?? true);
  const v = Number(preco.replace(/\./g, '').replace(',', '.'));
  return (
    <form className="coluna" onSubmit={(e) => {
      e.preventDefault();
      if (!nome.trim()) return;
      salvarServico({ id: s?.id, nome: nome.trim(), duracaoMin: Number(dur) || 60, tipoPreco: tipo, preco: tipo === 'combinar' ? null : v || 0, categoria: cat, soPerfil: so || null, ativo });
      avisar('Serviço salvo');
      fechar();
    }}>
      <Campo rotulo="Nome">{(id) => <input id={id} className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />}</Campo>
      <Campo rotulo="Duração">{(id) => (
        <select id={id} className="entrada" value={dur} onChange={(e) => setDur(e.target.value)}>
          {[30, 60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60}h` : `${m} min`}</option>)}
        </select>
      )}</Campo>
      <Segmento rotulo="Tipo de preço" valor={tipo} mudar={setTipo} opcoes={[{ v: 'fixo', t: 'Fixo' }, { v: 'a_partir', t: 'A partir de' }, { v: 'combinar', t: 'A combinar' }]} />
      {tipo !== 'combinar' && <Campo rotulo="Preço (R$)">{(id) => <input id={id} className="entrada" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />}</Campo>}
      <Segmento rotulo="Comissão" valor={cat} mudar={setCat} opcoes={[{ v: 'mao_obra', t: 'Mão de obra' }, { v: 'quimica', t: 'Química' }]} />
      <Campo rotulo="Quem faz">{(id) => (
        <select id={id} className="entrada" value={so} onChange={(e) => setSo(e.target.value)}>
          <option value="">Todos</option>
          {db.perfis.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>Só {p.nome.split(' ')[0]}</option>)}
        </select>
      )}</Campo>
      {s && (
        <label className="linha" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ width: 22, height: 22 }} /> Serviço ativo
        </label>
      )}
      <button className="btn primario" type="submit" disabled={!nome.trim()}>Salvar</button>
    </form>
  );
}

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csv = (linhas: (string | number | null)[][]) =>
  '﻿' + linhas.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');

function Backup() {
  const { db, exportarJSON, importarJSON, saldo, perfil, demo } = useDados();
  const avisar = useAviso();
  const arquivo = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState('');
  const hoje = new Date().toISOString().slice(0, 10);

  const planilha = () => {
    baixar(`alvorada-clientes-${hoje}.csv`, csv([['Nome', 'Telefone', 'Endereço', 'Aniversário', 'Observações'], ...db.clientes.filter((c) => !c.deletedAt).map((c) => [c.nome, c.telefone, c.endereco, c.aniversario, c.observacoes])]), 'text/csv');
    baixar(`alvorada-estoque-${hoje}.csv`, csv([['Produto', 'Marca', 'Preço', 'Custo', 'Quantidade'], ...db.produtos.filter((p) => !p.deletedAt).map((p) => [p.nome, p.marca, p.precoVenda, p.custo, saldo(p.id)])]), 'text/csv');
    baixar(`alvorada-vendas-${hoje}.csv`, csv([['Data', 'Origem', 'Descrição', 'Total', 'Pagamento', 'Lançado por'], ...db.vendas.filter((v) => !v.deletedAt).map((v) => [new Date(v.criadoEm).toLocaleString('pt-BR'), v.origem, v.descricao || v.itens.map((i) => `${i.quantidade}x ${db.produtos.find((p) => p.id === i.produtoId)?.nome}`).join(', '), v.total, v.formaPagamento, perfil(v.criadoPor)?.nome ?? ''])]), 'text/csv');
    baixar(`alvorada-atendimentos-${hoje}.csv`, csv([['Data', 'Cliente', 'Serviço', 'Profissional', 'Valor', 'Pagamento', 'Comissão'], ...db.agendamentos.filter((a) => a.tipo === 'salao' && a.status === 'concluido' && !a.deletedAt).map((a) => [new Date(a.inicio).toLocaleString('pt-BR'), db.clientes.find((c) => c.id === a.clienteId)?.nome ?? '', db.servicos.find((s) => s.id === a.servicoId)?.nome ?? '', perfil(a.profissionalId)?.nome ?? '', a.valor, a.formaPagamento, a.comissaoValor])]), 'text/csv');
    avisar('Planilhas baixadas');
  };

  return (
    <div className="grade-2">
      <section className="neu card">
        <h2>Baixar meus dados</h2>
        <p className="pequeno">Gera planilhas (abrem no Excel) com clientes, estoque, vendas e atendimentos.</p>
        <button className="btn primario" onClick={planilha}><Icone nome="baixar" /> Baixar planilhas</button>
      </section>
      <section className="neu card">
        <h2>Cópia de segurança completa</h2>
        <p className="pequeno">Um arquivo com tudo, para restaurar o sistema se precisar. Na versão final essa cópia é feita sozinha todo dia no Google Drive.</p>
        <div className="linha">
          <button className="btn" onClick={() => { baixar(`alvorada-backup-${hoje}.json`, exportarJSON(), 'application/json'); avisar('Cópia de segurança baixada'); }}><Icone nome="baixar" /> Baixar cópia</button>
          {demo && <button className="btn" onClick={() => arquivo.current?.click()}>Restaurar de um arquivo</button>}
        </div>
        <input ref={arquivo} type="file" accept="application/json" hidden aria-label="Arquivo de backup" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { importarJSON(await f.text()); setErro(''); avisar('Dados restaurados'); } catch (er) { setErro((er as Error).message); }
          e.target.value = '';
        }} />
        {erro && <p role="alert" className="etiqueta alerta">{erro}</p>}
      </section>
    </div>
  );
}

function Lixeira() {
  const { db, lixeiraCliente, lixeiraProduto, lixeiraVenda } = useDados();
  const avisar = useAviso();
  const itens = [
    ...db.clientes.filter((c) => c.deletedAt).map((c) => ({ id: c.id, t: `Cliente: ${c.nome}`, quando: c.deletedAt!, restaurar: () => lixeiraCliente(c.id, true) })),
    ...db.produtos.filter((p) => p.deletedAt).map((p) => ({ id: p.id, t: `Produto: ${p.nome}`, quando: p.deletedAt!, restaurar: () => lixeiraProduto(p.id, true) })),
    ...db.vendas.filter((v) => v.deletedAt).map((v) => ({ id: v.id, t: `Venda de ${brl(v.total)}`, quando: v.deletedAt!, restaurar: () => lixeiraVenda(v.id, true) })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));
  return (
    <section className="neu card">
      <h2>Lixeira</h2>
      <p className="pequeno">Nada é apagado de verdade. O que foi para a lixeira pode voltar.</p>
      {itens.length === 0 && <p className="pequeno">A lixeira está vazia.</p>}
      <div className="lista">
        {itens.map((i) => (
          <div key={i.id} className="item-lista neu-in">
            <div className="coluna cresce" style={{ gap: 2 }}><strong>{i.t}</strong><span className="pequeno">{new Date(i.quando).toLocaleString('pt-BR')}</span></div>
            <button className="btn mini" onClick={() => { i.restaurar(); avisar('Restaurado'); }}>Restaurar</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Atividade() {
  const { db, perfil } = useDados();
  return (
    <section className="neu card">
      <h2>Quem fez o quê</h2>
      <div className="tabela-caixa">
        <table>
          <thead><tr><th>Quando</th><th>Quem</th><th>O que fez</th></tr></thead>
          <tbody>
            {db.auditoria.slice(0, 100).map((a) => (
              <tr key={a.id}><td>{new Date(a.criadoEm).toLocaleString('pt-BR')}</td><td>{perfil(a.usuario)?.nome.split(' ')[0] ?? '—'}</td><td>{a.acao}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {db.auditoria.length === 0 && <p className="pequeno">Nenhuma atividade ainda.</p>}
    </section>
  );
}

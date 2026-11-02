import { useState } from 'react';
import { brl, useDados } from '../data/store';
import type { Cliente } from '../data/types';
import { Campo, Icone, Janela, iniciais, useAviso } from '../ui';

const dataBR = (iso: string) => (iso ? new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) : '');

export default function Clientes() {
  const { db } = useDados();
  const [busca, setBusca] = useState('');
  const [editar, setEditar] = useState<Cliente | 'novo' | null>(null);
  const [ver, setVer] = useState<Cliente | null>(null);

  const termo = busca.toLowerCase();
  const lista = db.clientes
    .filter((c) => !c.deletedAt && (c.nome.toLowerCase().includes(termo) || c.telefone.includes(busca)))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <>
      <div className="topo">
        <div className="coluna" style={{ gap: 2 }}>
          <span className="sub">Clientes</span>
          <h1>{lista.length} {lista.length === 1 ? 'cliente' : 'clientes'}</h1>
        </div>
        <button className="btn primario" onClick={() => setEditar('novo')}><Icone nome="mais" /> Nova cliente</button>
      </div>
      <input className="entrada" style={{ maxWidth: 420 }} aria-label="Procurar cliente" placeholder="Procurar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />

      <section className="neu card">
        {lista.length === 0 && <div className="vazio"><Icone nome="clientes" tam={34} /><p>Nenhuma cliente encontrada.</p></div>}
        <div className="lista">
          {lista.map((c) => (
            <button key={c.id} className="item-lista neu-in" style={{ border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }} onClick={() => setVer(c)}>
              <span className="avatar">{iniciais(c.nome)}</span>
              <span className="coluna cresce" style={{ gap: 2 }}>
                <strong>{c.nome}</strong>
                <span className="pequeno">{[c.telefone, c.aniversario && `aniversário ${dataBR(c.aniversario.slice(0, 10))}`].filter(Boolean).join(', ')}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <Janela titulo={editar === 'novo' ? 'Nova cliente' : 'Editar cliente'} aberta={!!editar} fechar={() => setEditar(null)}>
        {editar && <FormCliente c={editar === 'novo' ? null : editar} fechar={() => setEditar(null)} />}
      </Janela>
      <Janela titulo={ver?.nome ?? ''} aberta={!!ver} fechar={() => setVer(null)}>
        {ver && <Ficha c={ver} editar={() => { setEditar(ver); setVer(null); }} />}
      </Janela>
    </>
  );
}

function FormCliente({ c, fechar }: { c: Cliente | null; fechar: () => void }) {
  const { salvarCliente, lixeiraCliente, ehAdmin } = useDados();
  const avisar = useAviso();
  const [nome, setNome] = useState(c?.nome ?? '');
  const [telefone, setTelefone] = useState(c?.telefone ?? '');
  const [endereco, setEndereco] = useState(c?.endereco ?? '');
  const [aniversario, setAniversario] = useState(c?.aniversario ?? '');
  const [observacoes, setObservacoes] = useState(c?.observacoes ?? '');
  return (
    <form className="coluna" onSubmit={(e) => {
      e.preventDefault();
      if (!nome.trim()) return;
      salvarCliente({ id: c?.id, nome: nome.trim(), telefone, endereco, aniversario, observacoes });
      avisar(c ? 'Cliente atualizada' : 'Cliente cadastrada');
      fechar();
    }}>
      <Campo rotulo="Nome">{(id) => <input id={id} className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />}</Campo>
      <div className="grade-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Campo rotulo="Telefone (WhatsApp)">{(id) => <input id={id} className="entrada" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 90000-0000" />}</Campo>
        <Campo rotulo="Data de aniversário">{(id) => <input id={id} type="date" className="entrada" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />}</Campo>
      </div>
      <Campo rotulo="Endereço">{(id) => <input id={id} className="entrada" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />}</Campo>
      <Campo rotulo="Observações">{(id) => <textarea id={id} className="entrada" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: alergia, tom da tinta, preferências" />}</Campo>
      <button className="btn primario" type="submit" disabled={!nome.trim()}>{c ? 'Salvar' : 'Cadastrar'}</button>
      {c && ehAdmin && <button type="button" className="btn perigo" onClick={() => { lixeiraCliente(c.id); avisar('Cliente foi para a lixeira'); fechar(); }}><Icone nome="lixo" tam={18} /> Mandar para a lixeira</button>}
    </form>
  );
}

function Ficha({ c, editar }: { c: Cliente; editar: () => void }) {
  const { db, eu, servico, perfil } = useDados();
  const atend = db.agendamentos.filter((a) => a.clienteId === c.id && !a.deletedAt && a.status === 'concluido')
    .filter((a) => eu?.papel !== 'profissional' || a.profissionalId === eu.id)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  const compras = eu?.papel === 'dona' ? db.vendas.filter((v) => v.clienteId === c.id && !v.deletedAt) : [];
  const num = c.telefone.replace(/\D/g, '');
  return (
    <div className="coluna">
      <div className="neu-in card" style={{ gap: 6 }}>
        {c.telefone && <span><strong>Telefone:</strong> {c.telefone}</span>}
        {c.aniversario && <span><strong>Aniversário:</strong> {dataBR(c.aniversario)}</span>}
        {c.endereco && <span><strong>Endereço:</strong> {c.endereco}</span>}
        {c.observacoes && <span><strong>Obs.:</strong> {c.observacoes}</span>}
        {!c.telefone && !c.aniversario && !c.endereco && <span className="pequeno">Sem dados extras ainda.</span>}
      </div>
      <div className="linha">
        <button className="btn" onClick={editar}><Icone nome="editar" tam={18} /> Editar</button>
        {num && <a className="btn" target="_blank" rel="noreferrer" href={`https://wa.me/${num.length <= 11 ? '55' + num : num}`}><Icone nome="whats" tam={18} /> WhatsApp</a>}
      </div>
      <h3>Atendimentos</h3>
      {atend.length === 0 && <p className="pequeno">Nenhum atendimento concluído.</p>}
      {atend.slice(0, 10).map((a) => (
        <div key={a.id} className="linha entre">
          <span>{new Date(a.inicio).toLocaleDateString('pt-BR')}, {servico(a.servicoId)?.nome} com {perfil(a.profissionalId)?.nome.split(' ')[0]}</span>
          <strong>{brl(a.valor)}</strong>
        </div>
      ))}
      {eu?.papel === 'dona' && (
        <>
          <h3>Compras</h3>
          {compras.length === 0 && <p className="pequeno">Nenhuma compra registrada.</p>}
          {compras.map((v) => (
            <div key={v.id} className="linha entre">
              <span>{new Date(v.criadoEm).toLocaleDateString('pt-BR')}, {v.itens.reduce((s, i) => s + i.quantidade, 0)} item(ns)</span>
              <strong>{brl(v.total)}</strong>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

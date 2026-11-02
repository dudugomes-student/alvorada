import { useState } from 'react';
import { brl, mesmoDia, nomeForma, precoServico, useDados } from '../data/store';
import type { Agendamento, FormaPgto } from '../data/types';
import { Campo, Icone, Janela, Segmento, dataExtenso, useAviso } from '../ui';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ABRE = 9, FECHA = 18;

const statusNome: Record<Agendamento['status'], string> = { marcado: 'Marcado', concluido: 'Concluído', cancelado: 'Cancelado', faltou: 'Faltou' };

function linkWhats(tel: string, texto: string) {
  const num = tel.replace(/\D/g, '');
  return `https://wa.me/${num.length <= 11 ? '55' + num : num}?text=${encodeURIComponent(texto)}`;
}

export default function Agenda() {
  const { db, eu, ehAdmin, cliente, servico, perfil, salvarAgendamento, concluirAtendimento, mudarStatus, salvarCliente } = useDados();
  const avisar = useAviso();
  const [dia, setDia] = useState(() => new Date());
  const [filtro, setFiltro] = useState<string>('todos');
  const [novo, setNovo] = useState<null | 'salao' | 'pessoal'>(null);
  const [concluir, setConcluir] = useState<Agendamento | null>(null);
  if (!eu) return null;

  const profissionais = db.perfis.filter((p) => p.ativo);
  const domingo = dia.getDay() === 0;

  const eventos = db.agendamentos
    .filter((a) => !a.deletedAt && mesmoDia(a.inicio, dia))
    .filter((a) => {
      if (a.tipo === 'pessoal') return a.criadoPor === eu.id;
      if (!ehAdmin) return a.profissionalId === eu.id;
      return filtro === 'todos' || a.profissionalId === filtro;
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const mover = (n: number) => { const d = new Date(dia); d.setDate(d.getDate() + n); setDia(d); };

  return (
    <>
      <div className="topo">
        <div className="coluna" style={{ gap: 2 }}>
          <span className="sub">Agenda</span>
          <h1>{dataExtenso(dia)}</h1>
        </div>
        <div className="linha">
          <button className="btn" onClick={() => setNovo('pessoal')}><Icone nome="mais" /> Compromisso pessoal</button>
          {ehAdmin && <button className="btn primario" onClick={() => setNovo('salao')}><Icone nome="mais" /> Marcar horário</button>}
        </div>
      </div>

      <div className="linha entre">
        <div className="linha">
          <button className="btn btn-icone" onClick={() => mover(-1)} aria-label="Dia anterior">‹</button>
          <button className="btn" onClick={() => setDia(new Date())}>Hoje</button>
          <button className="btn btn-icone" onClick={() => mover(1)} aria-label="Próximo dia">›</button>
          <input type="date" className="entrada" style={{ width: 180 }} aria-label="Escolher dia" value={isoDia(dia)}
            onChange={(e) => e.target.value && setDia(new Date(e.target.value + 'T12:00'))} />
        </div>
        {ehAdmin && (
          <Segmento rotulo="Profissional" valor={filtro} mudar={setFiltro}
            opcoes={[{ v: 'todos', t: 'Todos' }, ...profissionais.map((p) => ({ v: p.id, t: p.nome.split(' ')[0] }))]} />
        )}
      </div>

      {domingo && <p className="faixa-demo">Domingo o salão está fechado. Dá para marcar só compromissos pessoais.</p>}

      <section className="neu card">
        {eventos.length === 0 && <div className="vazio"><Icone nome="agenda" tam={34} /><p>Nada marcado neste dia.</p></div>}
        <div className="lista">
          {eventos.map((a) => {
            const cli = cliente(a.clienteId);
            const serv = servico(a.servicoId);
            const prof = perfil(a.profissionalId);
            const podeMexer = ehAdmin || a.profissionalId === eu.id || a.criadoPor === eu.id;
            return (
              <div key={a.id} className="slot">
                <span className="hora">{hora(a.inicio)}</span>
                <div className={`evento neu-in ${a.tipo === 'pessoal' ? 'pessoal' : ''} ${a.status !== 'marcado' ? 'concluido' : ''}`}>
                  <div className="linha entre">
                    <strong>{a.tipo === 'pessoal' ? a.titulo : cli?.nome ?? 'Cliente'}</strong>
                    <span className={`etiqueta ${a.status === 'concluido' ? 'ok' : a.status === 'marcado' ? 'neutra' : 'alerta'}`}>
                      {a.tipo === 'pessoal' ? 'Pessoal' : statusNome[a.status]}
                    </span>
                  </div>
                  <span className="pequeno">
                    {hora(a.inicio)} às {hora(a.fim)}
                    {a.tipo === 'salao' && `, ${serv?.nome ?? ''} com ${prof?.nome.split(' ')[0] ?? ''}`}
                    {a.status === 'concluido' && `, ${brl(a.valor)} no ${nomeForma[a.formaPagamento!]}`}
                  </span>
                  {a.tipo === 'salao' && a.status === 'marcado' && podeMexer && (
                    <div className="linha" style={{ marginTop: 6 }}>
                      <button className="btn mini primario" onClick={() => setConcluir(a)}><Icone nome="check" tam={18} /> Concluir</button>
                      {cli?.telefone && (
                        <a className="btn mini" target="_blank" rel="noreferrer"
                          href={linkWhats(cli.telefone, `Oi ${cli.nome.split(' ')[0]}! Confirmando seu horário no Salão Alvorada: ${new Date(a.inicio).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric' })}, às ${hora(a.inicio)} (${serv?.nome ?? ''}). Até lá!`)}>
                          <Icone nome="whats" tam={18} /> Confirmar no WhatsApp
                        </a>
                      )}
                      <button className="btn mini" onClick={() => { mudarStatus(a.id, 'faltou'); avisar('Marcado como falta'); }}>Faltou</button>
                      <button className="btn mini perigo" onClick={() => { mudarStatus(a.id, 'cancelado'); avisar('Horário cancelado'); }}>Cancelar</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {novo && <NovoHorario key={novo + isoDia(dia)} tipo={novo} fechar={() => setNovo(null)} diaInicial={dia}
        salvar={(a) => { const erro = salvarAgendamento(a); if (erro) return erro; avisar(a.tipo === 'pessoal' ? 'Compromisso salvo' : 'Horário marcado'); setNovo(null); return null; }}
        criarCliente={(nome, telefone) => salvarCliente({ nome, telefone, endereco: '', aniversario: '', observacoes: '' })} />}

      <Janela titulo="Concluir atendimento" aberta={!!concluir} fechar={() => setConcluir(null)}>
        {concluir && <Concluir a={concluir} ok={(v, f) => { concluirAtendimento(concluir.id, v, f); setConcluir(null); avisar(`Atendimento lançado: ${brl(v)}`); }} />}
      </Janela>
    </>
  );
}

function Concluir({ a, ok }: { a: Agendamento; ok: (valor: number, forma: FormaPgto) => void }) {
  const { servico, perfil } = useDados();
  const serv = servico(a.servicoId);
  const [valor, setValor] = useState(serv?.preco != null ? String(serv.preco).replace('.', ',') : '');
  const [forma, setForma] = useState<FormaPgto>('pix');
  const v = Number(valor.replace(/\./g, '').replace(',', '.'));
  const prof = perfil(a.profissionalId);
  const pct = serv?.categoria === 'quimica' ? prof?.comissaoQuimica ?? 0 : prof?.comissaoMaoObra ?? 0;
  return (
    <form className="coluna" onSubmit={(e) => { e.preventDefault(); if (v > 0) ok(v, forma); }}>
      <p className="pequeno">{serv?.nome}, {serv ? precoServico(serv) : ''}</p>
      <Campo rotulo="Valor cobrado (R$)">{(id) => <input id={id} className="entrada" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus />}</Campo>
      <Segmento rotulo="Forma de pagamento" valor={forma} mudar={setForma} opcoes={[{ v: 'pix', t: 'Pix' }, { v: 'dinheiro', t: 'Dinheiro' }, { v: 'cartao', t: 'Cartão' }]} />
      {pct > 0 && v > 0 && <p className="pequeno">Comissão de {prof?.nome.split(' ')[0]}: {brl(Math.round(v * pct) / 100)} ({pct}%)</p>}
      <button className="btn primario" type="submit" disabled={!(v > 0)}>Lançar {v > 0 ? brl(v) : ''}</button>
    </form>
  );
}

function NovoHorario({ tipo, fechar, diaInicial, salvar, criarCliente }: {
  tipo: null | 'salao' | 'pessoal'; fechar: () => void; diaInicial: Date;
  salvar: (a: Omit<Agendamento, 'id' | 'criadoPor' | 'deletedAt' | 'comissaoValor' | 'status' | 'valor' | 'formaPagamento'>) => string | null;
  criarCliente: (nome: string, telefone: string) => string;
}) {
  const { db, eu } = useDados();
  const [data, setData] = useState(isoDia(diaInicial));
  const [inicio, setInicio] = useState('09:00');
  const [fimPessoal, setFimPessoal] = useState('10:00');
  const [titulo, setTitulo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [novoCliente, setNovoCliente] = useState('');
  const [telNovo, setTelNovo] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [profId, setProfId] = useState('');
  const [erro, setErro] = useState('');

  const servicos = db.servicos.filter((s) => s.ativo);
  const serv = servicos.find((s) => s.id === servicoId);
  const profs = db.perfis.filter((p) => p.ativo && (!serv?.soPerfil || serv.soPerfil === p.id));

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    const ini = new Date(`${data}T${inicio}`);
    if (tipo === 'pessoal') {
      const fim = new Date(`${data}T${fimPessoal}`);
      if (!titulo.trim()) return setErro('Escreva o que é o compromisso.');
      if (fim <= ini) return setErro('O fim precisa ser depois do início.');
      const r = salvar({ tipo: 'pessoal', titulo: titulo.trim(), clienteId: null, profissionalId: eu?.id ?? null, servicoId: null, inicio: ini.toISOString(), fim: fim.toISOString() });
      if (r) setErro(r);
      return;
    }
    if (!serv) return setErro('Escolha o serviço.');
    if (!profId) return setErro('Escolha quem vai atender.');
    if (ini.getDay() === 0) return setErro('Domingo o salão está fechado.');
    const fim = new Date(ini.getTime() + serv.duracaoMin * 60000);
    const limite = new Date(ini); limite.setHours(FECHA, 0, 0, 0);
    if (ini.getHours() < ABRE || fim > limite) return setErro(`Fora do horário (9h às 18h). ${serv.nome} leva ${serv.duracaoMin / 60}h.`);
    let cid = clienteId;
    if (!cid && novoCliente.trim()) cid = criarCliente(novoCliente.trim(), telNovo);
    if (!cid) return setErro('Escolha ou cadastre a cliente.');
    const r = salvar({ tipo: 'salao', titulo: '', clienteId: cid, profissionalId: profId, servicoId: serv.id, inicio: ini.toISOString(), fim: fim.toISOString() });
    if (r) setErro(r);
  };

  return (
    <Janela titulo={tipo === 'pessoal' ? 'Compromisso pessoal' : 'Marcar horário'} aberta={!!tipo} fechar={fechar}>
      <form className="coluna" onSubmit={enviar}>
        {tipo === 'pessoal' ? (
          <Campo rotulo="O que é?">{(id) => <input id={id} className="entrada" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: dentista, banco, buscar neto" />}</Campo>
        ) : (
          <>
            <Campo rotulo="Cliente">{(id) => (
              <select id={id} className="entrada" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Cliente nova (preencher abaixo)</option>
                {db.clientes.filter((c) => !c.deletedAt).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}</Campo>
            {!clienteId && (
              <div className="grade-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <Campo rotulo="Nome da cliente nova">{(id) => <input id={id} className="entrada" value={novoCliente} onChange={(e) => setNovoCliente(e.target.value)} />}</Campo>
                <Campo rotulo="Telefone">{(id) => <input id={id} className="entrada" inputMode="tel" value={telNovo} onChange={(e) => setTelNovo(e.target.value)} />}</Campo>
              </div>
            )}
            <Campo rotulo="Serviço">{(id) => (
              <select id={id} className="entrada" value={servicoId} onChange={(e) => { setServicoId(e.target.value); setProfId(''); }}>
                <option value="">Escolha</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} ({s.duracaoMin >= 60 ? `${s.duracaoMin / 60}h` : `${s.duracaoMin}min`}, {precoServico(s)})</option>)}
              </select>
            )}</Campo>
            <Segmento rotulo="Quem atende" valor={profId} mudar={setProfId} opcoes={profs.map((p) => ({ v: p.id, t: p.nome.split(' ')[0] }))} />
          </>
        )}
        <div className="grade-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <Campo rotulo="Dia">{(id) => <input id={id} type="date" className="entrada" value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
          <Campo rotulo="Início">{(id) => <input id={id} type="time" step={1800} className="entrada" value={inicio} onChange={(e) => setInicio(e.target.value)} />}</Campo>
          {tipo === 'pessoal' && <Campo rotulo="Fim">{(id) => <input id={id} type="time" step={1800} className="entrada" value={fimPessoal} onChange={(e) => setFimPessoal(e.target.value)} />}</Campo>}
        </div>
        {erro && <p role="alert" className="etiqueta alerta" style={{ alignSelf: 'flex-start' }}>{erro}</p>}
        <button className="btn primario" type="submit">{tipo === 'pessoal' ? 'Salvar compromisso' : 'Marcar horário'}</button>
      </form>
    </Janela>
  );
}

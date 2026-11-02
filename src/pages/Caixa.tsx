import { useMemo, useState } from 'react';
import { brl, mesmoDia, mesmoMes, nomeForma, useDados } from '../data/store';
import type { FormaPgto, VendaItem } from '../data/types';
import { Campo, Icone, Janela, Numero, Segmento, useAviso } from '../ui';

const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formas: FormaPgto[] = ['pix', 'dinheiro', 'cartao'];

export default function Caixa() {
  const { eu, ehAdmin } = useDados();
  const [aba, setAba] = useState<'salao' | 'vendas'>('salao');
  const [vender, setVender] = useState(false);
  const [bazar, setBazar] = useState(false);
  if (!eu) return null;
  const dona = eu.papel === 'dona';

  return (
    <>
      <div className="topo">
        <div className="coluna" style={{ gap: 2 }}>
          <span className="sub">{ehAdmin ? 'Caixa' : 'Balcão'}</span>
          <h1>{ehAdmin ? 'Entradas do salão e das vendas' : 'Registrar venda de produto'}</h1>
        </div>
        <div className="linha">
          {dona && <button className="btn" onClick={() => setBazar(true)}><Icone nome="sacola" /> Venda do bazar</button>}
          <button className="btn primario" onClick={() => setVender(true)}><Icone nome="mais" /> Venda de produto</button>
        </div>
      </div>

      {ehAdmin && (
        <Segmento rotulo="Qual caixa" valor={aba} mudar={setAba}
          opcoes={[{ v: 'salao', t: 'Salão' }, { v: 'vendas', t: dona ? 'Minhas vendas' : 'Vendas (total)' }]} />
      )}

      {ehAdmin && aba === 'salao' && <CaixaSalao />}
      {ehAdmin && aba === 'vendas' && (dona ? <MinhasVendas /> : <VendasTotal />)}
      {!ehAdmin && (
        <section className="neu card">
          <p>Vendeu um produto Eudora ou Boticário? Toque em <strong>Venda de produto</strong>. A venda vai direto para a Evinha.</p>
        </section>
      )}

      <Janela titulo="Venda de produto" aberta={vender} fechar={() => setVender(false)}>
        <NovaVenda fechar={() => setVender(false)} />
      </Janela>
      <Janela titulo="Venda do bazar" aberta={bazar} fechar={() => setBazar(false)}>
        <NovaBazar fechar={() => setBazar(false)} />
      </Janela>
    </>
  );
}

function PorForma({ valores }: { valores: Record<FormaPgto, number> }) {
  return (
    <div className="grade">
      {formas.map((f) => <Numero key={f} rotulo={nomeForma[f]} valor={brl(valores[f])} />)}
    </div>
  );
}

function CaixaSalao() {
  const { db, cliente, servico, perfil } = useDados();
  const [dia, setDia] = useState(() => new Date());
  const itens = db.agendamentos
    .filter((a) => !a.deletedAt && a.tipo === 'salao' && a.status === 'concluido' && mesmoDia(a.inicio, dia))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const porForma = { pix: 0, dinheiro: 0, cartao: 0 } as Record<FormaPgto, number>;
  itens.forEach((a) => { if (a.formaPagamento) porForma[a.formaPagamento] += a.valor ?? 0; });
  const total = itens.reduce((s, a) => s + (a.valor ?? 0), 0);
  const comissoes = itens.reduce((s, a) => s + (a.comissaoValor ?? 0), 0);

  return (
    <>
      <div className="linha entre">
        <Campo rotulo="Dia">{(id) => <input id={id} type="date" className="entrada" style={{ width: 190 }} value={isoDia(dia)} onChange={(e) => e.target.value && setDia(new Date(e.target.value + 'T12:00'))} />}</Campo>
        <div className="coluna" style={{ gap: 0, alignItems: 'flex-end' }}>
          <span className="rotulo">Total do dia</span>
          <span className="numero acento">{brl(total)}</span>
        </div>
      </div>
      <PorForma valores={porForma} />
      <section className="neu card">
        <h2>Atendimentos concluídos</h2>
        {itens.length === 0 ? <p className="pequeno">Nenhum atendimento concluído neste dia. Conclua pela Agenda.</p> : (
          <div className="tabela-caixa">
            <table>
              <thead><tr><th>Hora</th><th>Cliente</th><th>Serviço</th><th>Quem</th><th>Pagamento</th><th className="num">Valor</th><th className="num">Comissão</th></tr></thead>
              <tbody>
                {itens.map((a) => (
                  <tr key={a.id}>
                    <td>{hora(a.inicio)}</td>
                    <td>{cliente(a.clienteId)?.nome}</td>
                    <td>{servico(a.servicoId)?.nome}</td>
                    <td>{perfil(a.profissionalId)?.nome.split(' ')[0]}</td>
                    <td>{a.formaPagamento ? nomeForma[a.formaPagamento] : '—'}</td>
                    <td className="num">{brl(a.valor)}</td>
                    <td className="num">{a.comissaoValor ? brl(a.comissaoValor) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {comissoes > 0 && <p className="pequeno">Comissões do dia: {brl(comissoes)}. Fica para o salão: {brl(total - comissoes)}.</p>}
      </section>
    </>
  );
}

function VendasTotal() {
  const { db } = useDados();
  const hoje = new Date();
  const vendas = db.vendas.filter((v) => !v.deletedAt);
  return (
    <div className="grade">
      <Numero rotulo="Vendas hoje" valor={brl(vendas.filter((v) => mesmoDia(v.criadoEm, hoje)).reduce((s, v) => s + v.total, 0))} acento />
      <Numero rotulo="Vendas no mês" valor={brl(vendas.filter((v) => mesmoMes(v.criadoEm, hoje)).reduce((s, v) => s + v.total, 0))} extra="Só o total. O detalhe fica com a Evinha." />
    </div>
  );
}

function MinhasVendas() {
  const { db, perfil, cliente, lixeiraVenda } = useDados();
  const avisar = useAviso();
  const [periodo, setPeriodo] = useState<'hoje' | 'mes'>('hoje');
  const hoje = new Date();
  const lista = db.vendas
    .filter((v) => !v.deletedAt && (periodo === 'hoje' ? mesmoDia(v.criadoEm, hoje) : mesmoMes(v.criadoEm, hoje)))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  const porForma = { pix: 0, dinheiro: 0, cartao: 0 } as Record<FormaPgto, number>;
  lista.forEach((v) => { porForma[v.formaPagamento] += v.total; });
  const nomeProduto = (id: string) => db.produtos.find((p) => p.id === id)?.nome ?? 'Produto';
  const lucro = lista.reduce((s, v) => s + v.itens.reduce((t, i) => {
    const custo = db.produtos.find((p) => p.id === i.produtoId)?.custo;
    return t + (custo != null ? (i.precoUnit - custo) * i.quantidade : 0);
  }, 0), 0);

  return (
    <>
      <div className="linha entre">
        <Segmento rotulo="Período" valor={periodo} mudar={setPeriodo} opcoes={[{ v: 'hoje', t: 'Hoje' }, { v: 'mes', t: 'Este mês' }]} />
        <div className="coluna" style={{ gap: 0, alignItems: 'flex-end' }}>
          <span className="rotulo">Total</span>
          <span className="numero acento">{brl(lista.reduce((s, v) => s + v.total, 0))}</span>
          {lucro > 0 && <span className="pequeno">Lucro nos produtos: {brl(lucro)}</span>}
        </div>
      </div>
      <PorForma valores={porForma} />
      <section className="neu card">
        <h2>Vendas</h2>
        {lista.length === 0 && <p className="pequeno">Nenhuma venda no período.</p>}
        <div className="lista">
          {lista.map((v) => (
            <div key={v.id} className="item-lista neu-in">
              <div className="coluna cresce" style={{ gap: 2 }}>
                <strong>{v.origem === 'bazar' ? `Bazar: ${v.descricao}` : v.itens.map((i) => `${i.quantidade}× ${nomeProduto(i.produtoId)}`).join(', ')}</strong>
                <span className="pequeno">
                  {hora(v.criadoEm)}, {nomeForma[v.formaPagamento]}, lançado por {perfil(v.criadoPor)?.nome.split(' ')[0]}
                  {v.clienteId && `, cliente ${cliente(v.clienteId)?.nome}`}
                </span>
              </div>
              <strong>{brl(v.total)}</strong>
              <button className="btn btn-icone mini" aria-label="Cancelar venda" title="Cancelar venda (vai para a lixeira)"
                onClick={() => { lixeiraVenda(v.id); avisar('Venda cancelada e produtos devolvidos ao estoque'); }}>
                <Icone nome="lixo" tam={18} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function NovaVenda({ fechar }: { fechar: () => void }) {
  const { db, podeEstoque, saldo, registrarVenda } = useDados();
  const avisar = useAviso();
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState<VendaItem[]>([]);
  const [forma, setForma] = useState<FormaPgto>('pix');
  const [clienteId, setClienteId] = useState('');

  const produtos = useMemo(() => db.produtos
    .filter((p) => !p.deletedAt && p.nome.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome)), [db.produtos, busca]);

  const qtd = (id: string) => carrinho.find((i) => i.produtoId === id)?.quantidade ?? 0;
  const mudar = (id: string, preco: number, delta: number) => setCarrinho((c) => {
    const atual = c.find((i) => i.produtoId === id);
    if (!atual) return delta > 0 ? [...c, { produtoId: id, quantidade: 1, precoUnit: preco }] : c;
    const n = atual.quantidade + delta;
    return n <= 0 ? c.filter((i) => i.produtoId !== id) : c.map((i) => (i.produtoId === id ? { ...i, quantidade: n } : i));
  });
  const total = carrinho.reduce((s, i) => s + i.quantidade * i.precoUnit, 0);

  return (
    <div className="coluna">
      <Campo rotulo="Procurar produto">{(id) => <input id={id} className="entrada" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: shampoo" autoFocus />}</Campo>
      <div className="lista" style={{ maxHeight: 300, overflow: 'auto', padding: 4 }}>
        {produtos.length === 0 && <p className="pequeno">Nenhum produto encontrado.</p>}
        {produtos.map((p) => {
          const s = saldo(p.id);
          return (
            <div key={p.id} className="item-lista neu-in">
              <div className="coluna cresce" style={{ gap: 2 }}>
                <strong>{p.nome}</strong>
                <span className="pequeno">{p.marca}, {brl(p.precoVenda)}{podeEstoque ? `, ${s} no estoque` : s > 0 ? ', disponível' : ', em falta'}</span>
              </div>
              <button className="btn btn-icone mini" aria-label={`Tirar ${p.nome}`} onClick={() => mudar(p.id, p.precoVenda, -1)} disabled={!qtd(p.id)}><Icone nome="menos" tam={18} /></button>
              <span className="numero pop" key={qtd(p.id)} style={{ fontSize: 20, minWidth: 24, textAlign: 'center' }}>{qtd(p.id)}</span>
              <button className="btn btn-icone mini" aria-label={`Adicionar ${p.nome}`} onClick={() => mudar(p.id, p.precoVenda, 1)}><Icone nome="mais" tam={18} /></button>
            </div>
          );
        })}
      </div>
      <Segmento rotulo="Forma de pagamento" valor={forma} mudar={setForma} opcoes={formas.map((f) => ({ v: f, t: nomeForma[f] }))} />
      <Campo rotulo="Cliente (opcional)">{(id) => (
        <select id={id} className="entrada" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Sem cliente</option>
          {db.clientes.filter((c) => !c.deletedAt).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      )}</Campo>
      <button className="btn primario" disabled={!carrinho.length}
        onClick={() => { registrarVenda(carrinho, forma, clienteId || null); avisar(`Venda registrada: ${brl(total)} no ${nomeForma[forma]}`); fechar(); }}>
        Confirmar venda {total > 0 ? brl(total) : ''}
      </button>
    </div>
  );
}

function NovaBazar({ fechar }: { fechar: () => void }) {
  const { registrarBazar } = useDados();
  const avisar = useAviso();
  const [desc, setDesc] = useState('');
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState<FormaPgto>('pix');
  const v = Number(valor.replace(/\./g, '').replace(',', '.'));
  return (
    <form className="coluna" onSubmit={(e) => { e.preventDefault(); if (!desc.trim() || !(v > 0)) return; registrarBazar(desc.trim(), v, forma); avisar(`Bazar: ${brl(v)} registrado`); fechar(); }}>
      <Campo rotulo="O que vendeu?">{(id) => <input id={id} className="entrada" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: blusa azul" autoFocus />}</Campo>
      <Campo rotulo="Valor (R$)">{(id) => <input id={id} className="entrada" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />}</Campo>
      <Segmento rotulo="Forma de pagamento" valor={forma} mudar={setForma} opcoes={formas.map((f) => ({ v: f, t: nomeForma[f] }))} />
      <button className="btn primario" type="submit" disabled={!desc.trim() || !(v > 0)}>Registrar {v > 0 ? brl(v) : ''}</button>
    </form>
  );
}

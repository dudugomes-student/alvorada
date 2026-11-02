import { useState } from 'react';
import { brl, useDados } from '../data/store';
import { MARCAS, type Produto, type TipoMov } from '../data/types';
import { Campo, Icone, Janela, Numero, Segmento, useAviso } from '../ui';

const nomeMov: Record<TipoMov, string> = { entrada: 'Entrada', venda: 'Venda', uso: 'Uso', perda: 'Perda', ajuste: 'Ajuste' };
const num = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'));

export default function Estoque() {
  const { db, saldo } = useDados();
  const [busca, setBusca] = useState('');
  const [marca, setMarca] = useState('todas');
  const [editar, setEditar] = useState<Produto | 'novo' | null>(null);
  const [mov, setMov] = useState<{ p: Produto; tipo: 'entrada' | 'saida' } | null>(null);
  const [hist, setHist] = useState<Produto | null>(null);

  const ativos = db.produtos.filter((p) => !p.deletedAt);
  const lista = ativos
    .filter((p) => (marca === 'todas' || p.marca === marca) && p.nome.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const valorEstoque = ativos.reduce((s, p) => s + Math.max(0, saldo(p.id)) * (p.custo ?? 0), 0);
  const unidades = ativos.reduce((s, p) => s + Math.max(0, saldo(p.id)), 0);
  const baixos = ativos.filter((p) => saldo(p.id) <= p.estoqueMinimo).length;

  return (
    <>
      <div className="topo">
        <div className="coluna" style={{ gap: 2 }}>
          <span className="sub">Estoque</span>
          <h1>Produtos para venda</h1>
        </div>
        <button className="btn primario" onClick={() => setEditar('novo')}><Icone nome="mais" /> Novo produto</button>
      </div>

      <div className="grade">
        <Numero rotulo="Unidades em estoque" valor={String(unidades)} />
        <Numero rotulo="Valor investido (custo)" valor={brl(valorEstoque)} acento />
        <Numero rotulo="Acabando" valor={String(baixos)} extra="no mínimo ou abaixo" />
      </div>

      <div className="linha entre">
        <input className="entrada" style={{ maxWidth: 320 }} aria-label="Procurar produto" placeholder="Procurar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Segmento rotulo="Marca" valor={marca} mudar={setMarca} opcoes={[{ v: 'todas', t: 'Todas' }, ...MARCAS.map((m) => ({ v: m, t: m }))]} />
      </div>

      <section className="neu card">
        {lista.length === 0 && <div className="vazio"><Icone nome="estoque" tam={34} /><p>Nenhum produto. Cadastre o primeiro.</p></div>}
        <div className="lista">
          {lista.map((p) => {
            const s = saldo(p.id);
            return (
              <div key={p.id} className="item-lista neu-in" style={{ flexWrap: 'wrap' }}>
                <div className="coluna cresce" style={{ gap: 2, minWidth: 180 }}>
                  <strong>{p.nome}</strong>
                  <span className="pequeno">{p.marca}, venda {brl(p.precoVenda)}{p.custo != null ? `, custo ${brl(p.custo)}` : ''}</span>
                </div>
                <span className={`etiqueta ${s <= 0 ? 'alerta' : s <= p.estoqueMinimo ? '' : 'ok'}`}>{s <= 0 ? 'Acabou' : `${s} un.`}</span>
                <div className="linha" style={{ gap: 8 }}>
                  <button className="btn mini primario" onClick={() => setMov({ p, tipo: 'entrada' })}><Icone nome="mais" tam={16} /> Entrada</button>
                  <button className="btn mini" onClick={() => setMov({ p, tipo: 'saida' })}><Icone nome="menos" tam={16} /> Saída</button>
                  <button className="btn mini" onClick={() => setHist(p)}>Histórico</button>
                  <button className="btn btn-icone mini" aria-label={`Editar ${p.nome}`} onClick={() => setEditar(p)}><Icone nome="editar" tam={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Janela titulo={editar === 'novo' ? 'Novo produto' : 'Editar produto'} aberta={!!editar} fechar={() => setEditar(null)}>
        {editar && <FormProduto p={editar === 'novo' ? null : editar} fechar={() => setEditar(null)} />}
      </Janela>
      <Janela titulo={mov?.tipo === 'entrada' ? 'Entrada no estoque' : 'Saída do estoque'} aberta={!!mov} fechar={() => setMov(null)}>
        {mov && <FormMov p={mov.p} tipo={mov.tipo} fechar={() => setMov(null)} />}
      </Janela>
      <Janela titulo={`Histórico: ${hist?.nome ?? ''}`} aberta={!!hist} fechar={() => setHist(null)}>
        {hist && <Historico p={hist} />}
      </Janela>
    </>
  );
}

function FormProduto({ p, fechar }: { p: Produto | null; fechar: () => void }) {
  const { salvarProduto, lixeiraProduto, movimentar } = useDados();
  const avisar = useAviso();
  const [nome, setNome] = useState(p?.nome ?? '');
  const [marca, setMarca] = useState(p?.marca ?? '');
  const [preco, setPreco] = useState(p ? String(p.precoVenda).replace('.', ',') : '');
  const [custo, setCusto] = useState(p?.custo != null ? String(p.custo).replace('.', ',') : '');
  const [minimo, setMinimo] = useState(String(p?.estoqueMinimo ?? 2));
  const [inicial, setInicial] = useState('');

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !marca || !(num(preco) > 0)) return;
    const id = salvarProduto({ id: p?.id, nome: nome.trim(), marca, precoVenda: num(preco), custo: custo ? num(custo) : null, estoqueMinimo: Number(minimo) || 0 });
    if (!p && Number(inicial) > 0) movimentar(id, 'entrada', Number(inicial), 'Estoque inicial', custo ? num(custo) : null);
    avisar(p ? 'Produto atualizado' : 'Produto cadastrado');
    fechar();
  };

  return (
    <form className="coluna" onSubmit={enviar}>
      <Campo rotulo="Nome do produto">{(id) => <input id={id} className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />}</Campo>
      <EscolherMarca valor={marca} mudar={setMarca} />
      <div className="grade-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Campo rotulo="Preço de venda (R$)">{(id) => <input id={id} className="entrada" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />}</Campo>
        <Campo rotulo="Custo (R$, opcional)">{(id) => <input id={id} className="entrada" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} />}</Campo>
        <Campo rotulo="Avisar quando ficar com">{(id) => <input id={id} className="entrada" inputMode="numeric" value={minimo} onChange={(e) => setMinimo(e.target.value)} />}</Campo>
        {!p && <Campo rotulo="Quantidade que tem agora">{(id) => <input id={id} className="entrada" inputMode="numeric" value={inicial} onChange={(e) => setInicial(e.target.value)} />}</Campo>}
      </div>
      <button className="btn primario" type="submit" disabled={!nome.trim() || !marca || !(num(preco) > 0)}>{!marca ? 'Escolha a marca' : p ? 'Salvar' : 'Cadastrar produto'}</button>
      {p && <button type="button" className="btn perigo" onClick={() => { lixeiraProduto(p.id); avisar('Produto foi para a lixeira'); fechar(); }}><Icone nome="lixo" tam={18} /> Mandar para a lixeira</button>}
    </form>
  );
}

function FormMov({ p, tipo, fechar }: { p: Produto; tipo: 'entrada' | 'saida'; fechar: () => void }) {
  const { movimentar, saldo } = useDados();
  const avisar = useAviso();
  const [qtd, setQtd] = useState('1');
  const [motivo, setMotivo] = useState<'uso' | 'perda'>('perda');
  const [custo, setCusto] = useState(p.custo != null ? String(p.custo).replace('.', ',') : '');
  const [obs, setObs] = useState('');
  const q = Number(qtd);
  return (
    <form className="coluna" onSubmit={(e) => {
      e.preventDefault();
      if (!(q > 0)) return;
      if (tipo === 'entrada') movimentar(p.id, 'entrada', q, obs, custo ? num(custo) : null);
      else movimentar(p.id, motivo, q, obs);
      avisar(`${p.nome}: agora são ${saldo(p.id) + (tipo === 'entrada' ? q : -q)} un.`);
      fechar();
    }}>
      <p className="pequeno">{p.nome}, hoje com {saldo(p.id)} un.</p>
      <Campo rotulo="Quantidade">{(id) => <input id={id} className="entrada" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)} autoFocus />}</Campo>
      {tipo === 'entrada'
        ? <Campo rotulo="Custo de cada (R$, opcional)">{(id) => <input id={id} className="entrada" inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} />}</Campo>
        : <Segmento rotulo="Motivo" valor={motivo} mudar={setMotivo} opcoes={[{ v: 'perda', t: 'Perda ou vencido' }, { v: 'uso', t: 'Uso próprio ou brinde' }]} />}
      <Campo rotulo="Observação (opcional)">{(id) => <input id={id} className="entrada" value={obs} onChange={(e) => setObs(e.target.value)} placeholder={tipo === 'entrada' ? 'Ex.: pedido Eudora de novembro' : ''} />}</Campo>
      <p className="pequeno">Vendas saem do estoque sozinhas pelo Caixa.</p>
      <button className="btn primario" type="submit" disabled={!(q > 0)}>{tipo === 'entrada' ? `Dar entrada de ${q || 0}` : `Tirar ${q || 0}`}</button>
    </form>
  );
}

function Historico({ p }: { p: Produto }) {
  const { db, perfil } = useDados();
  const movs = db.movimentos.filter((m) => m.produtoId === p.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return (
    <div className="tabela-caixa">
      <table>
        <thead><tr><th>Data</th><th>Tipo</th><th className="num">Qtd.</th><th>Quem</th><th>Obs.</th></tr></thead>
        <tbody>
          {movs.map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.criadoEm).toLocaleDateString('pt-BR')}</td>
              <td>{nomeMov[m.tipo]}</td>
              <td className="num" style={{ color: m.quantidade > 0 ? 'var(--ok)' : 'var(--perigo)', fontWeight: 700 }}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
              <td>{perfil(m.criadoPor)?.nome.split(' ')[0] ?? ''}</td>
              <td>{m.observacao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Quatro botões grandes, um por marca: um toque e pronto. */
export function EscolherMarca({ valor, mudar }: { valor: string; mudar: (m: string) => void }) {
  return (
    <fieldset className="marcas">
      <legend>Marca</legend>
      {MARCAS.map((m) => (
        <button key={m} type="button" aria-pressed={valor === m} className={valor === m ? 'neu-in' : 'neu'} onClick={() => mudar(m)}>{m}</button>
      ))}
    </fieldset>
  );
}

import { Link } from 'react-router-dom';
import { brl, mesmoDia, mesmoMes, useDados } from '../data/store';
import { Icone, Numero, dataExtenso, iniciais } from '../ui';

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function Inicio() {
  const { db, eu, podeEstoque, saldo, cliente, servico, perfil, totaisVendas, demo } = useDados();
  if (!eu) return null;
  const hoje = new Date();
  const h = hoje.getHours();
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const dataLonga = dataExtenso(hoje);

  const ags = db.agendamentos.filter((a) => !a.deletedAt && a.tipo === 'salao');
  const concluidos = ags.filter((a) => a.status === 'concluido');
  const vendas = db.vendas.filter((v) => !v.deletedAt);

  const salaoHoje = concluidos.filter((a) => mesmoDia(a.inicio, hoje)).reduce((s, a) => s + (a.valor ?? 0), 0);
  const salaoMes = concluidos.filter((a) => mesmoMes(a.inicio, hoje)).reduce((s, a) => s + (a.valor ?? 0), 0);
  const vendasHoje = vendas.filter((v) => mesmoDia(v.criadoEm, hoje)).reduce((s, v) => s + v.total, 0);
  const vendasMes = vendas.filter((v) => mesmoMes(v.criadoEm, hoje)).reduce((s, v) => s + v.total, 0);

  const proximos = db.agendamentos
    .filter((a) => !a.deletedAt && a.status === 'marcado' && mesmoDia(a.inicio, hoje))
    .filter((a) => (eu.papel === 'profissional' ? a.profissionalId === eu.id : a.tipo === 'salao' || a.criadoPor === eu.id))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const baixos = podeEstoque ? db.produtos.filter((p) => !p.deletedAt && saldo(p.id) <= p.estoqueMinimo) : [];
  const aniversariantes = db.clientes.filter((c) => !c.deletedAt && c.aniversario && Number(c.aniversario.slice(5, 7)) === hoje.getMonth() + 1);

  const meus = concluidos.filter((a) => a.profissionalId === eu.id && mesmoMes(a.inicio, hoje));
  const comissaoMes = meus.reduce((s, a) => s + (a.comissaoValor ?? 0), 0);
  const meusHoje = ags.filter((a) => a.profissionalId === eu.id && mesmoDia(a.inicio, hoje) && a.status !== 'cancelado');

  return (
    <>
      <div className="topo">
        <div className="coluna" style={{ gap: 2 }}>
          <span className="sub">{dataLonga}</span>
          <h1>{saudacao}, {eu.nome.split(' ')[0]}!</h1>
        </div>
        <Link to="/caixa" className="btn primario"><Icone nome="mais" /> {eu.papel === 'profissional' ? 'Registrar venda' : 'Lançar no caixa'}</Link>
      </div>

      {eu.papel === 'dona' && (
        <div className="grade">
          <Numero rotulo="Salão hoje" valor={brl(salaoHoje)} acento />
          <Numero rotulo="Minhas vendas hoje" valor={brl(vendasHoje)} extra="Produtos e bazar" />
          <Numero rotulo="Total do mês" valor={brl(salaoMes + vendasMes)} extra={`Salão ${brl(salaoMes)}, vendas ${brl(vendasMes)}`} />
        </div>
      )}
      {eu.papel === 'socio' && (
        <div className="grade">
          <Numero rotulo="Salão hoje" valor={brl(salaoHoje)} acento />
          <Numero rotulo="Faturamento do mês" valor={brl(salaoMes + (demo ? vendasMes : totaisVendas.mes))} extra="Salão e vendas somados" />
          <Numero rotulo="Meus atendimentos no mês" valor={String(meus.length)} />
        </div>
      )}
      {eu.papel === 'profissional' && (
        <div className="grade">
          <Numero rotulo="A receber este mês" valor={brl(comissaoMes)} acento extra={`${eu.comissaoMaoObra}% mão de obra, ${eu.comissaoQuimica}% química`} />
          <Numero rotulo="Atendimentos no mês" valor={String(meus.length)} />
          <Numero rotulo="Hoje" valor={String(meusHoje.length)} extra="horários na sua agenda" />
        </div>
      )}

      <div className="grade-2">
        <section className="neu card" aria-labelledby="t-prox">
          <div className="linha entre">
            <h2 id="t-prox">{eu.papel === 'profissional' ? 'Sua agenda hoje' : 'Próximos de hoje'}</h2>
            <Link to="/agenda" className="pequeno">Ver agenda</Link>
          </div>
          {proximos.length === 0 && <p className="pequeno">Nenhum horário pendente hoje.</p>}
          <div className="lista">
            {proximos.slice(0, 6).map((a) => {
              const cli = cliente(a.clienteId);
              return (
                <div key={a.id} className="item-lista neu-in">
                  <span className="numero" style={{ fontSize: 20, width: 60 }}>{hora(a.inicio)}</span>
                  <div className="coluna cresce" style={{ gap: 2 }}>
                    <strong>{a.tipo === 'pessoal' ? a.titulo : cli?.nome ?? 'Cliente'}</strong>
                    <span className="pequeno">
                      {a.tipo === 'pessoal' ? 'Compromisso pessoal' : `${servico(a.servicoId)?.nome ?? ''}${eu.papel !== 'profissional' ? `, com ${perfil(a.profissionalId)?.nome.split(' ')[0] ?? ''}` : ''}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="coluna" style={{ gap: 18 }}>
          {baixos.length > 0 && (
            <section className="neu card" aria-labelledby="t-baixo">
              <h2 id="t-baixo" className="linha"><Icone nome="alerta" cor="var(--acento)" /> Estoque baixo</h2>
              {baixos.map((p) => (
                <div key={p.id} className="linha entre">
                  <span>{p.nome}</span>
                  <span className={`etiqueta ${saldo(p.id) <= 0 ? 'alerta' : ''}`}>{saldo(p.id) <= 0 ? 'Acabou' : `Só ${saldo(p.id)}`}</span>
                </div>
              ))}
              <Link to="/estoque" className="pequeno">Dar entrada no estoque</Link>
            </section>
          )}
          <section className="neu card" aria-labelledby="t-aniv">
            <h2 id="t-aniv" className="linha"><Icone nome="bolo" cor="var(--acento)" /> Aniversariantes do mês</h2>
            {aniversariantes.length === 0 && <p className="pequeno">Ninguém faz aniversário este mês.</p>}
            {aniversariantes.map((c) => (
              <div key={c.id} className="linha">
                <span className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{iniciais(c.nome)}</span>
                <span className="cresce">{c.nome}</span>
                <span className="etiqueta">dia {Number(c.aniversario.slice(8, 10))}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

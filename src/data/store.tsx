import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Agendamento, Banco, Cliente, FormaPgto, Movimento, Perfil, Produto, Servico, TipoMov, Venda, VendaItem,
} from './types';

/*
 * Camada de dados.
 * Nesta versão os dados ficam salvos no próprio aparelho (modo demonstração).
 * Quando a conta do Supabase existir, este arquivo passa a ler/gravar lá,
 * com as mesmas funções — as telas não mudam.
 */

const CHAVE = 'alvorada:banco:v1';
const CHAVE_SESSAO = 'alvorada:sessao';

export const uid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const agora = () => new Date().toISOString();

function hojeAs(h: number, m = 0, diasAFrente = 0) {
  const d = new Date();
  d.setDate(d.getDate() + diasAFrente);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1); // domingo fecha: exemplos vão para segunda
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function semente(): Banco {
  const evinha: Perfil = { id: 'evinha', nome: 'Evinha Barbosa', papel: 'dona', tema: 'rosa', comissaoMaoObra: 0, comissaoQuimica: 0, ativo: true };
  const idelson: Perfil = { id: 'idelson', nome: 'Idelson Barbosa', papel: 'socio', tema: 'azul', comissaoMaoObra: 0, comissaoQuimica: 0, ativo: true };
  const roberto: Perfil = { id: 'roberto', nome: 'Roberto Ferreira da Silva', papel: 'profissional', tema: 'azul', comissaoMaoObra: 60, comissaoQuimica: 40, ativo: true };

  const s = (nome: string, duracaoMin: number, preco: number | null, tipoPreco: Servico['tipoPreco'], categoria: Servico['categoria'], soPerfil: string | null = null): Servico =>
    ({ id: uid(), nome, duracaoMin, preco, tipoPreco, categoria, soPerfil, ativo: true });

  const servicos = [
    s('Corte masculino', 60, 40, 'fixo', 'mao_obra'),
    s('Corte feminino', 60, 60, 'fixo', 'mao_obra'),
    s('Escova', 60, 40, 'a_partir', 'mao_obra'),
    s('Aplicação de coloração', 60, 70, 'fixo', 'mao_obra'),
    s('Coloração', 120, 90, 'a_partir', 'quimica'),
    s('Matização', 60, 80, 'fixo', 'quimica'),
    s('Luzes femininas', 180, 250, 'a_partir', 'quimica'),
    s('Progressiva', 120, null, 'combinar', 'quimica'),
    s('Selagem', 120, null, 'combinar', 'quimica'),
    s('Botox capilar', 120, null, 'combinar', 'quimica'),
    s('Maquiagem', 60, 200, 'fixo', 'mao_obra', 'evinha'),
    s('Penteado', 90, 180, 'a_partir', 'mao_obra', 'evinha'),
  ];

  const c = (nome: string, telefone: string, aniversario: string): Cliente =>
    ({ id: uid(), nome, telefone, endereco: '', aniversario, observacoes: '', criadoEm: agora(), deletedAt: null });
  const mes = String(new Date().getMonth() + 1).padStart(2, '0');
  const clientes = [
    c('Carla (exemplo)', '(11) 90000-0001', `1990-${mes}-12`),
    c('Mariana (exemplo)', '(11) 90000-0002', '1985-03-02'),
    c('João (exemplo)', '(11) 90000-0003', ''),
  ];

  const p = (nome: string, marca: string, precoVenda: number, custo: number): Produto =>
    ({ id: uid(), nome, marca, precoVenda, custo, estoqueMinimo: 2, deletedAt: null });
  const produtos = [
    p('Shampoo Frutas Vermelhas (exemplo)', 'Eudora', 74.9, 45),
    p('Hidratante Pêssego (exemplo)', 'Eudora', 59.9, 32),
    p('Perfume (exemplo)', 'Boticário', 149.9, 90),
  ];
  const movimentos: Movimento[] = produtos.map((pr, i) => ({
    id: uid(), produtoId: pr.id, tipo: 'entrada', quantidade: [8, 2, 5][i], custoUnit: pr.custo,
    vendaId: null, observacao: 'Estoque inicial', criadoPor: 'evinha', criadoEm: agora(),
  }));

  const ag = (cli: Cliente, prof: string, serv: Servico, h: number): Agendamento => ({
    id: uid(), tipo: 'salao', titulo: '', clienteId: cli.id, profissionalId: prof, servicoId: serv.id,
    inicio: hojeAs(h), fim: new Date(new Date(hojeAs(h)).getTime() + serv.duracaoMin * 60000).toISOString(),
    status: 'marcado', valor: null, formaPagamento: null, comissaoValor: null, criadoPor: 'evinha', deletedAt: null,
  });
  const agendamentos = [
    ag(clientes[0], 'evinha', servicos[2], 15),
    ag(clientes[2], 'roberto', servicos[0], 10),
    ag(clientes[1], 'idelson', servicos[4], 14),
  ];

  return { versao: 1, perfis: [evinha, idelson, roberto], servicos, clientes, agendamentos, produtos, movimentos, vendas: [], auditoria: [] };
}

function carregar(): Banco {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return JSON.parse(bruto) as Banco;
  } catch { /* sem armazenamento: usa a semente */ }
  return semente();
}

// ---------- utilidades de formatação ----------
export const brl = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const nomeForma: Record<FormaPgto, string> = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'Pix' };

export const precoServico = (s: Servico) =>
  s.tipoPreco === 'combinar' ? 'A combinar' : s.tipoPreco === 'a_partir' ? `A partir de ${brl(s.preco)}` : brl(s.preco);

export const mesmoDia = (iso: string, d: Date) => {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
};
export const mesmoMes = (iso: string, d: Date) => {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
};

// ---------- contexto ----------
interface Acoes {
  db: Banco;
  eu: Perfil | null;
  entrar: (id: string) => void;
  sair: () => void;
  // permissões
  podeEstoque: boolean;     // só a dona
  ehAdmin: boolean;         // dona ou sócio
  // consultas
  saldo: (produtoId: string) => number;
  perfil: (id: string | null) => Perfil | undefined;
  cliente: (id: string | null) => Cliente | undefined;
  servico: (id: string | null) => Servico | undefined;
  // clientes
  salvarCliente: (c: Omit<Cliente, 'id' | 'criadoEm' | 'deletedAt'> & { id?: string }) => string;
  lixeiraCliente: (id: string, restaurar?: boolean) => void;
  // agenda
  salvarAgendamento: (a: Omit<Agendamento, 'id' | 'criadoPor' | 'deletedAt' | 'comissaoValor' | 'status' | 'valor' | 'formaPagamento'> & { id?: string }) => string | null;
  concluirAtendimento: (id: string, valor: number, forma: FormaPgto) => void;
  mudarStatus: (id: string, status: Agendamento['status']) => void;
  // estoque
  salvarProduto: (p: Omit<Produto, 'id' | 'deletedAt'> & { id?: string }) => string;
  lixeiraProduto: (id: string, restaurar?: boolean) => void;
  movimentar: (produtoId: string, tipo: TipoMov, quantidade: number, observacao?: string, custoUnit?: number | null) => void;
  // vendas
  registrarVenda: (itens: VendaItem[], forma: FormaPgto, clienteId: string | null) => void;
  registrarBazar: (descricao: string, total: number, forma: FormaPgto) => void;
  lixeiraVenda: (id: string, restaurar?: boolean) => void;
  // usuários e serviços
  salvarPerfil: (p: Omit<Perfil, 'id'> & { id?: string }) => void;
  salvarServico: (s: Omit<Servico, 'id'> & { id?: string }) => void;
  // backup
  exportarJSON: () => string;
  importarJSON: (texto: string) => void;
}

const Ctx = createContext<Acoes | null>(null);

export function DadosProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Banco>(carregar);
  const [euId, setEuId] = useState<string | null>(() => {
    try { return localStorage.getItem(CHAVE_SESSAO); } catch { return null; }
  });

  useEffect(() => {
    try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch { /* ignora */ }
  }, [db]);

  const eu = db.perfis.find((p) => p.id === euId && p.ativo) ?? null;

  const mudar = useCallback((acao: string, fn: (d: Banco) => Banco) => {
    setDb((d) => {
      const novo = fn(structuredClone(d));
      novo.auditoria = [{ id: uid(), usuario: euId ?? '?', acao, criadoEm: agora() }, ...novo.auditoria].slice(0, 500);
      return novo;
    });
  }, [euId]);

  const saldo = useCallback((produtoId: string) =>
    db.movimentos.filter((m) => m.produtoId === produtoId).reduce((s, m) => s + m.quantidade, 0), [db.movimentos]);

  const valor = useMemo<Acoes>(() => ({
    db, eu,
    entrar: (id) => { window.location.hash = '#/'; setEuId(id); try { localStorage.setItem(CHAVE_SESSAO, id); } catch { /* */ } },
    sair: () => { window.location.hash = '#/'; setEuId(null); try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* */ } },
    podeEstoque: eu?.papel === 'dona',
    ehAdmin: eu?.papel === 'dona' || eu?.papel === 'socio',
    saldo,
    perfil: (id) => db.perfis.find((p) => p.id === id),
    cliente: (id) => db.clientes.find((c) => c.id === id),
    servico: (id) => db.servicos.find((s) => s.id === id),

    salvarCliente: (c) => {
      const id = c.id ?? uid();
      mudar(c.id ? `Editou cliente ${c.nome}` : `Cadastrou cliente ${c.nome}`, (d) => {
        if (c.id) d.clientes = d.clientes.map((x) => (x.id === c.id ? { ...x, ...c } as Cliente : x));
        else d.clientes.push({ ...c, id, criadoEm: agora(), deletedAt: null } as Cliente);
        return d;
      });
      return id;
    },
    lixeiraCliente: (id, restaurar) => mudar(restaurar ? 'Restaurou cliente' : 'Mandou cliente para a lixeira', (d) => {
      d.clientes = d.clientes.map((x) => (x.id === id ? { ...x, deletedAt: restaurar ? null : agora() } : x));
      return d;
    }),

    salvarAgendamento: (a) => {
      // confere conflito de horário do mesmo profissional
      if (a.tipo === 'salao' && a.profissionalId) {
        const ini = new Date(a.inicio).getTime(), fim = new Date(a.fim).getTime();
        const choque = db.agendamentos.find((x) => x.id !== a.id && !x.deletedAt && x.status !== 'cancelado' &&
          (x.profissionalId === a.profissionalId || (x.tipo === 'pessoal' && x.criadoPor === a.profissionalId)) &&
          new Date(x.inicio).getTime() < fim && new Date(x.fim).getTime() > ini);
        if (choque) return 'Esse horário já está ocupado para esse profissional.';
      }
      mudar(a.id ? 'Remarcou horário' : 'Marcou horário', (d) => {
        if (a.id) d.agendamentos = d.agendamentos.map((x) => (x.id === a.id ? { ...x, ...a } as Agendamento : x));
        else d.agendamentos.push({ ...a, id: uid(), criadoPor: euId ?? '', deletedAt: null, comissaoValor: null, status: 'marcado', valor: null, formaPagamento: null } as Agendamento);
        return d;
      });
      return null;
    },
    concluirAtendimento: (id, v, forma) => mudar('Concluiu atendimento', (d) => {
      d.agendamentos = d.agendamentos.map((x) => {
        if (x.id !== id) return x;
        const serv = d.servicos.find((s) => s.id === x.servicoId);
        const prof = d.perfis.find((p) => p.id === x.profissionalId);
        const pct = serv?.categoria === 'quimica' ? prof?.comissaoQuimica ?? 0 : prof?.comissaoMaoObra ?? 0;
        return { ...x, status: 'concluido', valor: v, formaPagamento: forma, comissaoValor: Math.round(v * pct) / 100 };
      });
      return d;
    }),
    mudarStatus: (id, status) => mudar(`Mudou horário para ${status}`, (d) => {
      d.agendamentos = d.agendamentos.map((x) => (x.id === id ? { ...x, status } : x));
      return d;
    }),

    salvarProduto: (p) => {
      const id = p.id ?? uid();
      mudar(p.id ? `Editou produto ${p.nome}` : `Cadastrou produto ${p.nome}`, (d) => {
        if (p.id) d.produtos = d.produtos.map((x) => (x.id === p.id ? { ...x, ...p } as Produto : x));
        else d.produtos.push({ ...p, id, deletedAt: null } as Produto);
        return d;
      });
      return id;
    },
    lixeiraProduto: (id, restaurar) => mudar(restaurar ? 'Restaurou produto' : 'Mandou produto para a lixeira', (d) => {
      d.produtos = d.produtos.map((x) => (x.id === id ? { ...x, deletedAt: restaurar ? null : agora() } : x));
      return d;
    }),
    movimentar: (produtoId, tipo, quantidade, observacao = '', custoUnit = null) => mudar(`Estoque: ${tipo}`, (d) => {
      const q = tipo === 'entrada' || tipo === 'ajuste' ? quantidade : -Math.abs(quantidade);
      d.movimentos.push({ id: uid(), produtoId, tipo, quantidade: q, custoUnit, vendaId: null, observacao, criadoPor: euId ?? '', criadoEm: agora() });
      return d;
    }),

    registrarVenda: (itens, forma, clienteId) => mudar('Registrou venda de produtos', (d) => {
      const id = uid();
      const total = itens.reduce((s, i) => s + i.quantidade * i.precoUnit, 0);
      d.vendas.push({ id, origem: 'produtos', clienteId, descricao: '', itens, total, formaPagamento: forma, criadoPor: euId ?? '', criadoEm: agora(), deletedAt: null });
      for (const i of itens) d.movimentos.push({ id: uid(), produtoId: i.produtoId, tipo: 'venda', quantidade: -i.quantidade, custoUnit: null, vendaId: id, observacao: '', criadoPor: euId ?? '', criadoEm: agora() });
      return d;
    }),
    registrarBazar: (descricao, total, forma) => mudar('Registrou venda do bazar', (d) => {
      d.vendas.push({ id: uid(), origem: 'bazar', clienteId: null, descricao, itens: [], total, formaPagamento: forma, criadoPor: euId ?? '', criadoEm: agora(), deletedAt: null });
      return d;
    }),
    lixeiraVenda: (id, restaurar) => mudar(restaurar ? 'Restaurou venda' : 'Mandou venda para a lixeira', (d) => {
      const v = d.vendas.find((x) => x.id === id);
      if (!v) return d;
      v.deletedAt = restaurar ? null : agora();
      // devolve ou retira do estoque os itens da venda
      for (const i of v.itens) d.movimentos.push({ id: uid(), produtoId: i.produtoId, tipo: 'ajuste', quantidade: restaurar ? -i.quantidade : i.quantidade, custoUnit: null, vendaId: id, observacao: restaurar ? 'Venda restaurada' : 'Venda cancelada', criadoPor: euId ?? '', criadoEm: agora() });
      return d;
    }),

    salvarPerfil: (p) => mudar(p.id ? `Editou usuário ${p.nome}` : `Criou usuário ${p.nome}`, (d) => {
      if (p.id) d.perfis = d.perfis.map((x) => (x.id === p.id ? { ...x, ...p } as Perfil : x));
      else d.perfis.push({ ...p, id: uid() } as Perfil);
      return d;
    }),
    salvarServico: (s) => mudar(s.id ? `Editou serviço ${s.nome}` : `Criou serviço ${s.nome}`, (d) => {
      if (s.id) d.servicos = d.servicos.map((x) => (x.id === s.id ? { ...x, ...s } as Servico : x));
      else d.servicos.push({ ...s, id: uid() } as Servico);
      return d;
    }),

    exportarJSON: () => JSON.stringify(db, null, 2),
    importarJSON: (texto) => {
      const novo = JSON.parse(texto) as Banco;
      if (!Array.isArray(novo.perfis) || !Array.isArray(novo.produtos)) throw new Error('Arquivo de backup inválido.');
      setDb(novo);
    },
  }), [db, eu, euId, mudar, saldo]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDados() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDados fora do DadosProvider');
  return v;
}

export type { Venda };

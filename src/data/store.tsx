import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  Agendamento, Banco, Cliente, FormaPgto, Movimento, Perfil, Produto, Servico, TipoMov, Venda, VendaItem,
} from './types';
import { MODO_DEMO, carregarTudo, emailDeLogin, gravar, ouvirMudancas, sb } from './nuvem';

/*
 * Camada de dados.
 * Na nuvem (padrão): tudo fica no Supabase e aparece em todos os aparelhos.
 *   Cada ação atualiza a tela na hora e grava no banco em seguida;
 *   se o banco recusar, a tela volta a mostrar o que está gravado.
 * Demonstração (VITE_DEMO=1): os dados ficam só no aparelho.
 */

const CHAVE = 'alvorada:banco:v1';
const CHAVE_SESSAO = 'alvorada:sessao';

export const uid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const agora = () => new Date().toISOString();
const vazio = (): Banco => ({ versao: 1, perfis: [], servicos: [], clientes: [], agendamentos: [], produtos: [], movimentos: [], vendas: [], auditoria: [] });

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
    s('Corte masculino', 60, 40, 'fixo', 'mao_obra'), s('Corte feminino', 60, 60, 'fixo', 'mao_obra'),
    s('Escova', 60, 40, 'a_partir', 'mao_obra'), s('Aplicação de coloração', 60, 70, 'fixo', 'mao_obra'),
    s('Coloração', 120, 90, 'a_partir', 'quimica'), s('Matização', 60, 80, 'fixo', 'quimica'),
    s('Luzes femininas', 180, 250, 'a_partir', 'quimica'), s('Progressiva', 120, null, 'combinar', 'quimica'),
    s('Selagem', 120, null, 'combinar', 'quimica'), s('Botox capilar', 120, null, 'combinar', 'quimica'),
    s('Maquiagem', 60, 200, 'fixo', 'mao_obra', 'evinha'), s('Penteado', 90, 180, 'a_partir', 'mao_obra', 'evinha'),
  ];
  const c = (nome: string, telefone: string, aniversario: string): Cliente =>
    ({ id: uid(), nome, telefone, endereco: '', aniversario, observacoes: '', criadoEm: agora(), deletedAt: null });
  const mes = String(new Date().getMonth() + 1).padStart(2, '0');
  const clientes = [c('Carla (exemplo)', '(11) 90000-0001', `1990-${mes}-12`), c('Mariana (exemplo)', '(11) 90000-0002', '1985-03-02'), c('João (exemplo)', '(11) 90000-0003', '')];
  const p = (nome: string, marca: string, precoVenda: number, custo: number): Produto => ({ id: uid(), nome, marca, precoVenda, custo, estoqueMinimo: 2, deletedAt: null });
  const produtos = [p('Shampoo Frutas Vermelhas (exemplo)', 'Eudora', 74.9, 45), p('Hidratante Pêssego (exemplo)', 'Eudora', 59.9, 32), p('Perfume (exemplo)', 'Boticário', 149.9, 90)];
  const movimentos: Movimento[] = produtos.map((pr, i) => ({ id: uid(), produtoId: pr.id, tipo: 'entrada', quantidade: [8, 2, 5][i], custoUnit: pr.custo, vendaId: null, observacao: 'Estoque inicial', criadoPor: 'evinha', criadoEm: agora() }));
  const ag = (cli: Cliente, prof: string, serv: Servico, h: number): Agendamento => ({
    id: uid(), tipo: 'salao', titulo: '', clienteId: cli.id, profissionalId: prof, servicoId: serv.id,
    inicio: hojeAs(h), fim: new Date(new Date(hojeAs(h)).getTime() + serv.duracaoMin * 60000).toISOString(),
    status: 'marcado', valor: null, formaPagamento: null, comissaoValor: null, criadoPor: 'evinha', deletedAt: null,
  });
  const agendamentos = [ag(clientes[0], 'evinha', servicos[2], 15), ag(clientes[2], 'roberto', servicos[0], 10), ag(clientes[1], 'idelson', servicos[4], 14)];
  return { versao: 1, perfis: [evinha, idelson, roberto], servicos, clientes, agendamentos, produtos, movimentos, vendas: [], auditoria: [] };
}

function carregarLocal(): Banco {
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

const mensagemErro = (e: unknown) => {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return 'Usuário ou senha incorretos.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem internet. Confira a conexão e tente de novo.';
  if (/row-level security|permission denied/i.test(m)) return 'Você não tem permissão para isso.';
  return m;
};

// ---------- contexto ----------
type NovoAgendamento = Omit<Agendamento, 'id' | 'criadoPor' | 'deletedAt' | 'comissaoValor' | 'status' | 'valor' | 'formaPagamento'> & { id?: string };

interface Acoes {
  db: Banco;
  eu: Perfil | null;
  demo: boolean;
  carregando: boolean;
  erro: string | null;
  totaisVendas: { hoje: number; mes: number };
  entrar: (id: string) => void;                                  // demonstração
  entrarComSenha: (login: string, senha: string) => Promise<string | null>; // nuvem
  sair: () => void;
  trocarMinhaSenha: (nova: string) => Promise<string | null>;
  redefinirPin: (usuario: string, pin: string) => Promise<string | null>;
  recarregar: () => void;
  podeEstoque: boolean;
  ehAdmin: boolean;
  saldo: (produtoId: string) => number;
  perfil: (id: string | null) => Perfil | undefined;
  cliente: (id: string | null) => Cliente | undefined;
  servico: (id: string | null) => Servico | undefined;
  salvarCliente: (c: Omit<Cliente, 'id' | 'criadoEm' | 'deletedAt'> & { id?: string }) => string;
  lixeiraCliente: (id: string, restaurar?: boolean) => void;
  salvarAgendamento: (a: NovoAgendamento) => string | null;
  concluirAtendimento: (id: string, valor: number, forma: FormaPgto) => void;
  mudarStatus: (id: string, status: Agendamento['status']) => void;
  salvarProduto: (p: Omit<Produto, 'id' | 'deletedAt'> & { id?: string }) => string;
  lixeiraProduto: (id: string, restaurar?: boolean) => void;
  movimentar: (produtoId: string, tipo: TipoMov, quantidade: number, observacao?: string, custoUnit?: number | null) => void;
  registrarVenda: (itens: VendaItem[], forma: FormaPgto, clienteId: string | null) => void;
  registrarBazar: (descricao: string, total: number, forma: FormaPgto) => void;
  lixeiraVenda: (id: string, restaurar?: boolean) => void;
  salvarPerfil: (p: Omit<Perfil, 'id'> & { id?: string }) => void;
  salvarServico: (s: Omit<Servico, 'id'> & { id?: string }) => void;
  exportarJSON: () => string;
  importarJSON: (texto: string) => void;
}

const Ctx = createContext<Acoes | null>(null);

export function DadosProvider({ children, aoErro }: { children: ReactNode; aoErro?: (msg: string) => void }) {
  const demo = MODO_DEMO || !sb;
  const [db, setDb] = useState<Banco>(() => (demo ? carregarLocal() : vazio()));
  const [euId, setEuId] = useState<string | null>(() => {
    if (!demo) return null;
    try { return localStorage.getItem(CHAVE_SESSAO); } catch { return null; }
  });
  const [usuarioLogado, setUsuarioLogado] = useState<string | null>(null); // id do login na nuvem
  const [carregando, setCarregando] = useState(!demo);
  const [erro, setErro] = useState<string | null>(null);
  const [totaisVendas, setTotais] = useState({ hoje: 0, mes: 0 });
  const avisoErro = useRef(aoErro);
  avisoErro.current = aoErro;

  // ----- demonstração: guarda no aparelho -----
  useEffect(() => {
    if (!demo) return;
    try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch { /* ignora */ }
  }, [db, demo]);

  // ----- nuvem: sessão, carga e tempo real -----
  const eu = demo
    ? db.perfis.find((p) => p.id === euId && p.ativo) ?? null
    : db.perfis.find((p) => p.usuarioId && p.usuarioId === usuarioLogado && p.ativo) ?? null;

  const papelRef = useRef<Perfil['papel'] | null>(null);
  const carregar = useCallback(async (papel?: Perfil['papel']) => {
    if (demo || !sb) return;
    try {
      let p = papel ?? papelRef.current;
      if (!p) {
        const { data, error } = await sb.rpc('meu_papel');
        if (error) throw error;
        p = data as Perfil['papel'] | null;
        if (!p) { setErro('Seu login ainda não está ligado a um perfil. Peça para a Evinha conferir em Usuários.'); setCarregando(false); return; }
      }
      papelRef.current = p;
      const { banco, totais } = await carregarTudo(p);
      setDb(banco);
      setTotais(totais);
      setErro(null);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [demo]);

  useEffect(() => {
    if (demo || !sb) return;
    let ativo = true;
    sb.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      const id = data.session?.user.id ?? null;
      setUsuarioLogado(id);
      if (id) carregar(); else setCarregando(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_ev, sessao) => {
      setUsuarioLogado(sessao?.user.id ?? null);
    });
    return () => { ativo = false; sub.subscription.unsubscribe(); };
  }, [demo, carregar]);

  useEffect(() => {
    if (demo || !usuarioLogado) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const parar = ouvirMudancas(() => { clearTimeout(t); t = setTimeout(() => carregar(), 500); });
    const intervalo = setInterval(() => carregar(), 60000); // reserva, caso o tempo real caia
    return () => { parar(); clearInterval(intervalo); clearTimeout(t); };
  }, [demo, usuarioLogado, carregar]);

  /** Aplica na tela e, na nuvem, grava em seguida. Se falhar, recarrega do banco. */
  const aplicar = useCallback((fn: (d: Banco) => Banco, remoto?: () => Promise<unknown>, acao?: string) => {
    setDb((d) => {
      const novo = fn(structuredClone(d));
      if (demo && acao) novo.auditoria = [{ id: uid(), usuario: euId ?? '?', acao, criadoEm: agora() }, ...novo.auditoria].slice(0, 500);
      return novo;
    });
    if (!demo && remoto) {
      remoto().then(() => carregar()).catch((e) => {
        avisoErro.current?.(`Não salvou: ${mensagemErro(e)}`);
        carregar();
      });
    }
  }, [demo, euId, carregar]);

  const saldo = useCallback((produtoId: string) => {
    const p = db.produtos.find((x) => x.id === produtoId);
    if (p?.disponivel !== undefined) return p.disponivel ? 1 : 0;
    return db.movimentos.filter((m) => m.produtoId === produtoId).reduce((s, m) => s + m.quantidade, 0);
  }, [db.produtos, db.movimentos]);

  const valor = useMemo<Acoes>(() => {
    const meuId = eu?.id ?? '';
    return {
      db, eu, demo, carregando, erro, totaisVendas,
      entrar: (id) => { setEuId(id); try { localStorage.setItem(CHAVE_SESSAO, id); } catch { /* */ } },
      entrarComSenha: async (login, senha) => {
        if (!sb) return 'Sem conexão configurada.';
        // sem tela de "carregando" aqui: o formulário mostra "Entrando…" e mantém o erro visível
        const { data, error } = await sb.auth.signInWithPassword({ email: emailDeLogin(login), password: senha });
        if (error) return mensagemErro(error);
        papelRef.current = null;
        setUsuarioLogado(data.user.id);
        await carregar();
        return null;
      },
      sair: () => {
        if (demo) { setEuId(null); try { localStorage.removeItem(CHAVE_SESSAO); } catch { /* */ } return; }
        papelRef.current = null;
        setUsuarioLogado(null);
        setDb(vazio());
        sb?.auth.signOut();
      },
      trocarMinhaSenha: async (nova) => {
        if (!sb) return 'Indisponível na demonstração.';
        const { error } = await sb.auth.updateUser({ password: nova });
        return error ? mensagemErro(error) : null;
      },
      redefinirPin: async (usuario, pin) => {
        if (!sb) return 'Indisponível na demonstração.';
        const { data, error } = await sb.functions.invoke('redefinir-pin', { body: { usuario, pin } });
        if (error) return (data as { erro?: string })?.erro ?? 'Não foi possível trocar o PIN agora.';
        return null;
      },
      recarregar: () => { carregar(); },
      podeEstoque: eu?.papel === 'dona',
      ehAdmin: eu?.papel === 'dona' || eu?.papel === 'socio',
      saldo,
      perfil: (id) => db.perfis.find((p) => p.id === id),
      cliente: (id) => db.clientes.find((c) => c.id === id),
      servico: (id) => db.servicos.find((s) => s.id === id),

      salvarCliente: (c) => {
        const id = c.id ?? uid();
        const antigo = db.clientes.find((x) => x.id === id);
        const novo: Cliente = { ...(antigo ?? { criadoEm: agora(), deletedAt: null }), ...c, id } as Cliente;
        aplicar((d) => { d.clientes = antigo ? d.clientes.map((x) => (x.id === id ? novo : x)) : [...d.clientes, novo]; return d; },
          () => gravar.cliente(novo), antigo ? `Editou cliente ${c.nome}` : `Cadastrou cliente ${c.nome}`);
        return id;
      },
      lixeiraCliente: (id, restaurar) => {
        const c = db.clientes.find((x) => x.id === id);
        if (!c) return;
        const novo = { ...c, deletedAt: restaurar ? null : agora() };
        aplicar((d) => { d.clientes = d.clientes.map((x) => (x.id === id ? novo : x)); return d; },
          () => gravar.cliente(novo), restaurar ? 'Restaurou cliente' : 'Mandou cliente para a lixeira');
      },

      salvarAgendamento: (a) => {
        if (a.tipo === 'salao' && a.profissionalId) {
          const ini = new Date(a.inicio).getTime(), fim = new Date(a.fim).getTime();
          const choque = db.agendamentos.find((x) => x.id !== a.id && !x.deletedAt && x.status !== 'cancelado' &&
            (x.profissionalId === a.profissionalId || (x.tipo === 'pessoal' && x.criadoPor === a.profissionalId)) &&
            new Date(x.inicio).getTime() < fim && new Date(x.fim).getTime() > ini);
          if (choque) return 'Esse horário já está ocupado para esse profissional.';
        }
        const antigo = a.id ? db.agendamentos.find((x) => x.id === a.id) : undefined;
        const novo: Agendamento = {
          ...(antigo ?? { criadoPor: meuId, deletedAt: null, comissaoValor: null, status: 'marcado', valor: null, formaPagamento: null }),
          ...a, id: a.id ?? uid(),
        } as Agendamento;
        aplicar((d) => { d.agendamentos = antigo ? d.agendamentos.map((x) => (x.id === novo.id ? novo : x)) : [...d.agendamentos, novo]; return d; },
          () => gravar.agendamento(novo, !antigo), antigo ? 'Remarcou horário' : 'Marcou horário');
        return null;
      },
      concluirAtendimento: (id, v, forma) => {
        const x = db.agendamentos.find((a) => a.id === id);
        if (!x) return;
        const serv = db.servicos.find((s) => s.id === x.servicoId);
        const prof = db.perfis.find((p) => p.id === x.profissionalId);
        const pct = serv?.categoria === 'quimica' ? prof?.comissaoQuimica ?? 0 : prof?.comissaoMaoObra ?? 0;
        const novo: Agendamento = { ...x, status: 'concluido', valor: v, formaPagamento: forma, comissaoValor: Math.round(v * pct) / 100 };
        aplicar((d) => { d.agendamentos = d.agendamentos.map((a) => (a.id === id ? novo : a)); return d; },
          () => gravar.agendamento(novo, false), 'Concluiu atendimento');
      },
      mudarStatus: (id, status) => {
        const x = db.agendamentos.find((a) => a.id === id);
        if (!x) return;
        const novo = { ...x, status };
        aplicar((d) => { d.agendamentos = d.agendamentos.map((a) => (a.id === id ? novo : a)); return d; },
          () => gravar.agendamento(novo, false), `Mudou horário para ${status}`);
      },

      salvarProduto: (p) => {
        const id = p.id ?? uid();
        const antigo = db.produtos.find((x) => x.id === id);
        const novo: Produto = { ...(antigo ?? { deletedAt: null }), ...p, id } as Produto;
        aplicar((d) => { d.produtos = antigo ? d.produtos.map((x) => (x.id === id ? novo : x)) : [...d.produtos, novo]; return d; },
          () => gravar.produto(novo), antigo ? `Editou produto ${p.nome}` : `Cadastrou produto ${p.nome}`);
        return id;
      },
      lixeiraProduto: (id, restaurar) => {
        const p = db.produtos.find((x) => x.id === id);
        if (!p) return;
        const novo = { ...p, deletedAt: restaurar ? null : agora() };
        aplicar((d) => { d.produtos = d.produtos.map((x) => (x.id === id ? novo : x)); return d; },
          () => gravar.produto(novo), restaurar ? 'Restaurou produto' : 'Mandou produto para a lixeira');
      },
      movimentar: (produtoId, tipo, quantidade, observacao = '', custoUnit = null) => {
        const q = tipo === 'entrada' || tipo === 'ajuste' ? quantidade : -Math.abs(quantidade);
        const m: Movimento = { id: uid(), produtoId, tipo, quantidade: q, custoUnit, vendaId: null, observacao, criadoPor: meuId, criadoEm: agora() };
        aplicar((d) => { d.movimentos.push(m); return d; }, () => gravar.movimento(m), `Estoque: ${tipo}`);
      },

      registrarVenda: (itens, forma, clienteId) => {
        const id = uid();
        const total = itens.reduce((s, i) => s + i.quantidade * i.precoUnit, 0);
        const v: Venda = { id, origem: 'produtos', clienteId, descricao: '', itens, total, formaPagamento: forma, criadoPor: meuId, criadoEm: agora(), deletedAt: null };
        aplicar((d) => {
          d.vendas.push(v);
          for (const i of itens) d.movimentos.push({ id: uid(), produtoId: i.produtoId, tipo: 'venda', quantidade: -i.quantidade, custoUnit: null, vendaId: id, observacao: '', criadoPor: meuId, criadoEm: agora() });
          return d;
        }, () => gravar.venda(v), 'Registrou venda de produtos');
      },
      registrarBazar: (descricao, total, forma) => {
        const v: Venda = { id: uid(), origem: 'bazar', clienteId: null, descricao, itens: [], total, formaPagamento: forma, criadoPor: meuId, criadoEm: agora(), deletedAt: null };
        aplicar((d) => { d.vendas.push(v); return d; }, () => gravar.venda(v), 'Registrou venda do bazar');
      },
      lixeiraVenda: (id, restaurar) => {
        const v = db.vendas.find((x) => x.id === id);
        if (!v) return;
        const quando = restaurar ? null : agora();
        // devolve (ou retira de novo) os itens no estoque
        const ajustes: Movimento[] = v.itens.map((i) => ({
          id: uid(), produtoId: i.produtoId, tipo: 'ajuste', quantidade: restaurar ? -i.quantidade : i.quantidade, custoUnit: null,
          vendaId: id, observacao: restaurar ? 'Venda restaurada' : 'Venda cancelada', criadoPor: meuId, criadoEm: agora(),
        }));
        aplicar((d) => {
          d.vendas = d.vendas.map((x) => (x.id === id ? { ...x, deletedAt: quando } : x));
          d.movimentos.push(...ajustes);
          return d;
        }, async () => { await gravar.vendaLixeira(id, quando); for (const m of ajustes) await gravar.movimento(m); },
        restaurar ? 'Restaurou venda' : 'Mandou venda para a lixeira');
      },

      salvarPerfil: (p) => {
        const id = p.id ?? uid();
        const antigo = db.perfis.find((x) => x.id === id);
        const novo: Perfil = { ...(antigo ?? {}), ...p, id } as Perfil;
        aplicar((d) => { d.perfis = antigo ? d.perfis.map((x) => (x.id === id ? novo : x)) : [...d.perfis, novo]; return d; },
          () => gravar.perfil(novo), antigo ? `Editou usuário ${p.nome}` : `Criou usuário ${p.nome}`);
      },
      salvarServico: (s) => {
        const id = s.id ?? uid();
        const antigo = db.servicos.find((x) => x.id === id);
        const novo: Servico = { ...(antigo ?? {}), ...s, id } as Servico;
        aplicar((d) => { d.servicos = antigo ? d.servicos.map((x) => (x.id === id ? novo : x)) : [...d.servicos, novo]; return d; },
          () => gravar.servico(novo), antigo ? `Editou serviço ${s.nome}` : `Criou serviço ${s.nome}`);
      },

      exportarJSON: () => JSON.stringify(db, null, 2),
      importarJSON: (texto) => {
        if (!demo) throw new Error('Na nuvem, a restauração é feita pelo backup automático. Fale com quem cuida do sistema.');
        const novo = JSON.parse(texto) as Banco;
        if (!Array.isArray(novo.perfis) || !Array.isArray(novo.produtos)) throw new Error('Arquivo de backup inválido.');
        setDb(novo);
      },
    };
  }, [db, eu, demo, carregando, erro, totaisVendas, aplicar, saldo, carregar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDados() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDados fora do DadosProvider');
  return v;
}

export type { Venda };

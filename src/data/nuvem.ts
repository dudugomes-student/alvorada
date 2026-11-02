import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Agendamento, Auditoria, Banco, Cliente, Movimento, Papel, Perfil, Produto, Servico, Venda } from './types';

/*
 * Ligação com o banco na nuvem (Supabase).
 * A chave pública pode ficar no app: quem protege os dados são as regras
 * do banco (RLS), que olham quem está logado.
 */
const URL_PADRAO = 'https://lxheytcnprzauiktflzx.supabase.co';
const CHAVE_PADRAO = 'sb_publishable_xP3maDlzYUDlGmP27PnbuQ_XgrTh_Zu';

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
const url = env.VITE_SUPABASE_URL ?? URL_PADRAO;
const chave = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? CHAVE_PADRAO;

/** Modo demonstração (dados só no aparelho) quando VITE_DEMO=1. */
export const MODO_DEMO = env.VITE_DEMO === '1';

export const sb: SupabaseClient | null = MODO_DEMO ? null : createClient(url, chave, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'alvorada:sessao-nuvem' },
});

/** "roberto" vira o endereço interno roberto@alvorada.app; e-mail fica igual. */
export const emailDeLogin = (texto: string) => {
  const t = texto.trim().toLowerCase();
  return t.includes('@') ? t : `${t}@alvorada.app`;
};

// ---------- conversões banco ↔ app ----------
type Linha = Record<string, unknown>;
const n = (v: unknown) => (v == null ? null : Number(v));

const perfil = (r: Linha): Perfil => ({
  id: r.id as string, nome: r.nome as string, papel: r.papel as Papel, tema: (r.tema as 'rosa' | 'azul') ?? 'azul',
  comissaoMaoObra: Number(r.comissao_mao_obra ?? 0), comissaoQuimica: Number(r.comissao_quimica ?? 0), ativo: !!r.ativo,
  email: (r.email as string) ?? null, usuario: (r.usuario as string) ?? null, temLogin: !!r.usuario_id,
  usuarioId: (r.usuario_id as string) ?? null,
});
const servico = (r: Linha): Servico => ({
  id: r.id as string, nome: r.nome as string, duracaoMin: Number(r.duracao_min), preco: n(r.preco),
  tipoPreco: r.tipo_preco as Servico['tipoPreco'], categoria: r.categoria as Servico['categoria'],
  soPerfil: (r.so_perfil as string) ?? null, ativo: !!r.ativo,
});
const cliente = (r: Linha): Cliente => ({
  id: r.id as string, nome: r.nome as string, telefone: (r.telefone as string) ?? '', endereco: (r.endereco as string) ?? '',
  aniversario: (r.aniversario as string) ?? '', observacoes: (r.observacoes as string) ?? '',
  criadoEm: r.criado_em as string, deletedAt: (r.deleted_at as string) ?? null,
});
const agendamento = (r: Linha): Agendamento => ({
  id: r.id as string, tipo: r.tipo as Agendamento['tipo'], titulo: (r.titulo as string) ?? '',
  clienteId: (r.cliente_id as string) ?? null, profissionalId: (r.profissional_id as string) ?? null, servicoId: (r.servico_id as string) ?? null,
  inicio: r.inicio as string, fim: r.fim as string, status: r.status as Agendamento['status'],
  valor: n(r.valor), formaPagamento: (r.forma_pagamento as Agendamento['formaPagamento']) ?? null, comissaoValor: n(r.comissao_valor),
  criadoPor: (r.criado_por as string) ?? '', deletedAt: (r.deleted_at as string) ?? null,
});
const produto = (r: Linha): Produto => ({
  id: r.id as string, nome: r.nome as string, marca: r.marca as string, precoVenda: Number(r.preco_venda),
  custo: n(r.custo), estoqueMinimo: Number(r.estoque_minimo ?? 0), deletedAt: (r.deleted_at as string) ?? null,
});
const movimento = (r: Linha): Movimento => ({
  id: r.id as string, produtoId: r.produto_id as string, tipo: r.tipo as Movimento['tipo'], quantidade: Number(r.quantidade),
  custoUnit: n(r.custo_unit), vendaId: (r.venda_id as string) ?? null, observacao: (r.observacao as string) ?? '',
  criadoPor: (r.criado_por as string) ?? '', criadoEm: r.criado_em as string,
});
const venda = (r: Linha): Venda => ({
  id: r.id as string, origem: r.origem as Venda['origem'], clienteId: (r.cliente_id as string) ?? null,
  descricao: (r.descricao as string) ?? '', total: Number(r.total), formaPagamento: r.forma_pagamento as Venda['formaPagamento'],
  criadoPor: (r.criado_por as string) ?? '', criadoEm: r.criado_em as string, deletedAt: (r.deleted_at as string) ?? null,
  itens: ((r.venda_itens as Linha[]) ?? []).map((i) => ({ produtoId: i.produto_id as string, quantidade: Number(i.quantidade), precoUnit: Number(i.preco_unit) })),
});

const nomesTabela: Record<string, string> = {
  perfis: 'usuário', servicos: 'serviço', clientes: 'cliente', agendamentos: 'horário',
  produtos: 'produto', movimentos_estoque: 'estoque', vendas: 'venda',
};
const nomesAcao: Record<string, string> = { INSERT: 'Criou', UPDATE: 'Alterou', DELETE: 'Apagou' };

async function lista<T>(consulta: PromiseLike<{ data: Linha[] | null; error: unknown }>, conv: (r: Linha) => T): Promise<T[]> {
  const { data, error } = await consulta;
  if (error) throw error;
  return (data ?? []).map(conv);
}

/** Carrega tudo o que esse perfil pode ver. */
export async function carregarTudo(papel: Papel): Promise<{ banco: Banco; totais: { hoje: number; mes: number } }> {
  if (!sb) throw new Error('Sem conexão configurada');
  const dona = papel === 'dona';
  const admin = papel !== 'profissional';
  const [perfis, servicos, clientes, agendamentos] = await Promise.all([
    lista(sb.from('perfis').select('*').order('nome'), perfil),
    lista(sb.from('servicos').select('*').order('nome'), servico),
    lista(sb.from('clientes').select('*').order('nome'), cliente),
    lista(sb.from('agendamentos').select('*').order('inicio'), agendamento),
  ]);

  let produtos: Produto[] = [], movimentos: Movimento[] = [], vendas: Venda[] = [], auditoria: Auditoria[] = [];
  if (dona) {
    [produtos, movimentos, vendas, auditoria] = await Promise.all([
      lista(sb.from('produtos').select('*').order('nome'), produto),
      lista(sb.from('movimentos_estoque').select('*').order('criado_em'), movimento),
      lista(sb.from('vendas').select('*, venda_itens(*)').order('criado_em'), venda),
      // a atividade é só informativa: se falhar, o resto abre normalmente
      lista(sb.from('auditoria_legivel').select('*').order('criado_em', { ascending: false }).limit(200), (r) => ({
        id: String(r.id), usuario: (r.perfil_id as string) ?? '', criadoEm: r.criado_em as string,
        acao: `${nomesAcao[r.acao as string] ?? r.acao} ${nomesTabela[r.tabela as string] ?? r.tabela}`,
      })).catch(() => [] as Auditoria[]),
    ]);
  } else {
    // balcão: nome, marca, preço e se tem — sem custo nem quantidade
    produtos = await lista(sb.rpc('produtos_balcao'), (r) => ({
      id: r.id as string, nome: r.nome as string, marca: r.marca as string, precoVenda: Number(r.preco_venda),
      custo: null, estoqueMinimo: 0, deletedAt: null, disponivel: !!r.disponivel,
    }));
  }

  let totais = { hoje: 0, mes: 0 };
  if (admin) {
    const agora = new Date();
    const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const amanha = new Date(dia); amanha.setDate(dia.getDate() + 1);
    const mes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const proxMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    const [h, m] = await Promise.all([
      sb.rpc('total_vendas', { p_inicio: dia.toISOString(), p_fim: amanha.toISOString() }),
      sb.rpc('total_vendas', { p_inicio: mes.toISOString(), p_fim: proxMes.toISOString() }),
    ]);
    totais = { hoje: Number(h.data ?? 0), mes: Number(m.data ?? 0) };
  }

  return { banco: { versao: 1, perfis, servicos, clientes, agendamentos, produtos, movimentos, vendas, auditoria }, totais };
}

// ---------- gravações ----------
async function ok(p: PromiseLike<{ error: unknown }>) {
  const { error } = await p;
  if (error) throw error;
}

export const gravar = {
  cliente: (c: Cliente) => ok(sb!.from('clientes').upsert({
    id: c.id, nome: c.nome, telefone: c.telefone || null, endereco: c.endereco || null,
    aniversario: c.aniversario || null, observacoes: c.observacoes || null, deleted_at: c.deletedAt,
  })),
  // insert e update separados: o profissional pode editar o horário dele, mas não criar
  agendamento: (a: Agendamento, novo: boolean) => {
    const linha = {
      tipo: a.tipo, titulo: a.titulo || null, cliente_id: a.clienteId, profissional_id: a.profissionalId,
      servico_id: a.servicoId, inicio: a.inicio, fim: a.fim, status: a.status, valor: a.valor,
      forma_pagamento: a.formaPagamento, deleted_at: a.deletedAt,
    };
    return ok(novo ? sb!.from('agendamentos').insert({ id: a.id, ...linha }) : sb!.from('agendamentos').update(linha).eq('id', a.id));
  },
  produto: (p: Produto) => ok(sb!.from('produtos').upsert({
    id: p.id, nome: p.nome, marca: p.marca, preco_venda: p.precoVenda, custo: p.custo, estoque_minimo: p.estoqueMinimo, deleted_at: p.deletedAt,
  })),
  movimento: (m: Movimento) => ok(sb!.from('movimentos_estoque').insert({
    id: m.id, produto_id: m.produtoId, tipo: m.tipo, quantidade: m.quantidade, custo_unit: m.custoUnit,
    venda_id: m.vendaId, observacao: m.observacao || null,
  })),
  venda: (v: Venda) => ok(sb!.rpc('registrar_venda', {
    p_origem: v.origem, p_forma: v.formaPagamento,
    p_itens: v.itens.map((i) => ({ produto_id: i.produtoId, quantidade: i.quantidade, preco_unit: i.precoUnit })),
    p_cliente: v.clienteId, p_descricao: v.descricao || null, p_total: v.origem === 'bazar' ? v.total : null,
  })),
  vendaLixeira: (id: string, deletedAt: string | null) => ok(sb!.from('vendas').update({ deleted_at: deletedAt }).eq('id', id)),
  perfil: (p: Perfil) => ok(sb!.from('perfis').upsert({
    id: p.id, nome: p.nome, papel: p.papel, tema: p.tema, comissao_mao_obra: p.comissaoMaoObra,
    comissao_quimica: p.comissaoQuimica, ativo: p.ativo, email: p.email || null, usuario: p.usuario || null,
  })),
  servico: (s: Servico) => ok(sb!.from('servicos').upsert({
    id: s.id, nome: s.nome, duracao_min: s.duracaoMin, preco: s.preco, tipo_preco: s.tipoPreco,
    categoria: s.categoria, so_perfil: s.soPerfil, ativo: s.ativo,
  })),
};

/** Fica ouvindo mudanças feitas em outros aparelhos. */
export function ouvirMudancas(aoMudar: () => void) {
  if (!sb) return () => {};
  const canal = sb.channel('alvorada-mudancas');
  for (const t of ['perfis', 'servicos', 'clientes', 'agendamentos', 'produtos', 'movimentos_estoque', 'vendas']) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, aoMudar);
  }
  canal.subscribe();
  return () => { sb!.removeChannel(canal); };
}

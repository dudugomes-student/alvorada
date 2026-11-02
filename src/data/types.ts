export type Papel = 'dona' | 'socio' | 'profissional';
export type FormaPgto = 'dinheiro' | 'cartao' | 'pix';
export type TipoPreco = 'fixo' | 'a_partir' | 'combinar';
export type Categoria = 'mao_obra' | 'quimica';
export type StatusAgenda = 'marcado' | 'concluido' | 'cancelado' | 'faltou';
export type TipoMov = 'entrada' | 'venda' | 'uso' | 'perda' | 'ajuste';

export interface Perfil {
  id: string;
  nome: string;
  papel: Papel;
  tema: 'rosa' | 'azul';
  comissaoMaoObra: number;
  comissaoQuimica: number;
  ativo: boolean;
  email?: string | null;     // login por e-mail
  usuario?: string | null;   // login por usuário + PIN (ex.: "roberto")
  temLogin?: boolean;
  usuarioId?: string | null;
}

export interface Servico {
  id: string;
  nome: string;
  duracaoMin: number;
  preco: number | null;
  tipoPreco: TipoPreco;
  categoria: Categoria;
  soPerfil: string | null;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  endereco: string;
  aniversario: string; // YYYY-MM-DD ou ''
  observacoes: string;
  criadoEm: string;
  deletedAt: string | null;
}

export interface Agendamento {
  id: string;
  tipo: 'salao' | 'pessoal';
  titulo: string;
  clienteId: string | null;
  profissionalId: string | null;
  servicoId: string | null;
  inicio: string; // ISO
  fim: string;
  status: StatusAgenda;
  valor: number | null;
  formaPagamento: FormaPgto | null;
  comissaoValor: number | null;
  criadoPor: string;
  deletedAt: string | null;
}

export interface Produto {
  id: string;
  nome: string;
  marca: string;
  precoVenda: number;
  custo: number | null;
  estoqueMinimo: number;
  deletedAt: string | null;
  disponivel?: boolean; // para quem não vê o estoque (balcão)
}

export interface Movimento {
  id: string;
  produtoId: string;
  tipo: TipoMov;
  quantidade: number;
  custoUnit: number | null;
  vendaId: string | null;
  observacao: string;
  criadoPor: string;
  criadoEm: string;
}

export interface VendaItem {
  produtoId: string;
  quantidade: number;
  precoUnit: number;
}

export interface Venda {
  id: string;
  origem: 'produtos' | 'bazar';
  clienteId: string | null;
  descricao: string;
  itens: VendaItem[];
  total: number;
  formaPagamento: FormaPgto;
  criadoPor: string;
  criadoEm: string;
  deletedAt: string | null;
}

export interface Auditoria {
  id: string;
  usuario: string;
  acao: string;
  criadoEm: string;
}

export interface Banco {
  versao: number;
  perfis: Perfil[];
  servicos: Servico[];
  clientes: Cliente[];
  agendamentos: Agendamento[];
  produtos: Produto[];
  movimentos: Movimento[];
  vendas: Venda[];
  auditoria: Auditoria[];
}

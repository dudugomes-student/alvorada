import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// ---------- ícones (traço) ----------
const caminhos: Record<string, ReactNode> = {
  inicio: <path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  agenda: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  caixa: <><rect x="2" y="6" width="20" height="13" rx="2" /><circle cx="12" cy="12.5" r="2.5" /></>,
  estoque: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  clientes: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  sair: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  check: <path d="m5 12 5 5 9-10" />,
  fechar: <path d="M18 6 6 18M6 6l12 12" />,
  busca: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  alerta: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  bolo: <><path d="M20 21V12a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9" /><path d="M4 16s1.5-1 4-1 4 2 6 2 4-1 4-1M2 21h20M7 8v2M12 8v2M17 8v2M7 4h.01M12 4h.01M17 4h.01" /></>,
  whats: <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z" />,
  lixo: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>,
  editar: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  baixar: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  sacola: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
};

export function Icone({ nome, tam = 22, cor = 'currentColor' }: { nome: keyof typeof caminhos | string; tam?: number; cor?: string }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {caminhos[nome]}
    </svg>
  );
}

// ---------- janela de vidro ----------
export function Janela({ titulo, aberta, fechar, children }: { titulo: string; aberta: boolean; fechar: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberta, fechar]);
  if (!aberta) return null;
  // portal no body: as animações da página não podem prender a janela dentro dela
  return createPortal(
    <div className="veu" onClick={fechar}>
      <div className="janela glass" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <span className="alca" />
        <div className="linha entre">
          <h2>{titulo}</h2>
          <button className="btn btn-icone mini" onClick={fechar} aria-label="Fechar"><Icone nome="fechar" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ---------- campos ----------
let contador = 0;
export function Campo({ rotulo, children, id }: { rotulo: string; children: (id: string) => ReactNode; id?: string }) {
  const [meuId] = useState(() => id ?? `campo-${++contador}`);
  return (
    <div className="campo">
      <label htmlFor={meuId}>{rotulo}</label>
      {children(meuId)}
    </div>
  );
}

export function Segmento<T extends string>({ opcoes, valor, mudar, rotulo }: { opcoes: { v: T; t: string }[]; valor: T; mudar: (v: T) => void; rotulo: string }) {
  return (
    <div className="segmento neu-in" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.v} type="button" aria-pressed={valor === o.v} onClick={() => mudar(o.v)}>{o.t}</button>
      ))}
    </div>
  );
}

/** Faz o número "subir contando" até o valor final. Aceita "R$ 1.234,56" ou "12". */
function useContagem(texto: string) {
  const ehDinheiro = texto.includes('R$');
  const alvo = Number(texto.replace(/[^\d,-]/g, '').replace(',', '.'));
  const valido = /\d/.test(texto) && Number.isFinite(alvo);
  const [atual, setAtual] = useState(valido ? 0 : alvo);
  const anterior = useRef(0);
  useEffect(() => {
    if (!valido) return;
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const de = anterior.current;
    if (reduzir || de === alvo) { setAtual(alvo); anterior.current = alvo; return; }
    const inicio = performance.now(), dur = 900;
    let id = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      setAtual(de + (alvo - de) * e);
      if (p < 1) id = requestAnimationFrame(passo); else anterior.current = alvo;
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [alvo, valido]);
  if (!valido) return texto;
  return ehDinheiro ? atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(Math.round(atual));
}

export function Numero({ rotulo, valor, acento, extra }: { rotulo: string; valor: string; acento?: boolean; extra?: string }) {
  const mostrado = useContagem(valor);
  return (
    <div className="neu card">
      <span className="rotulo">{rotulo}</span>
      <span className={`numero ${acento ? 'acento' : ''}`} aria-label={valor}>{mostrado}</span>
      {extra && <span className="pequeno">{extra}</span>}
    </div>
  );
}

// ---------- aviso ----------
const AvisoCtx = createContext<(msg: string) => void>(() => {});
export function AvisoProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ t: string; k: number } | null>(null);
  const avisar = useCallback((t: string) => setMsg({ t, k: Date.now() }), []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(id);
  }, [msg]);
  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      {msg && (
        <div key={msg.k} className="aviso glass" role="status">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <span key={i} className="faisca" style={{ ['--fx' as string]: `${Math.round(Math.cos(a) * 34)}px`, ['--fy' as string]: `${Math.round(Math.sin(a) * 34)}px`, animationDelay: `${0.1 + (i % 2) * 0.05}s` }} />;
          })}
          <span className="check"><Icone nome="check" tam={18} cor="#fff" /></span>
          {msg.t}
        </div>
      )}
    </AvisoCtx.Provider>
  );
}
export const useAviso = () => useContext(AvisoCtx);

export const iniciais = (nome: string) =>
  nome.split(' ').filter((p) => /^\p{L}/u.test(p)).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/** "domingo, 1 de novembro" → "Domingo, 1 de novembro" */
export const dataExtenso = (d: Date) => {
  const t = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

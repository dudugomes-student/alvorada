# Alvorada — sistema do salão

Fase 1: login por perfil, agenda (salão + pessoal), caixa (salão e vendas), estoque, clientes, usuários, serviços, backup, lixeira e registro de atividade.

## Rodar no computador
```
npm install
npm run dev
```

## Estrutura
- `src/data/store.tsx` — dados e regras (hoje salvos no aparelho; trocar pelo Supabase).
- `src/pages/` — uma página por setor.
- `supabase/schema.sql` — banco de dados com as regras de acesso por perfil. Rodar uma vez no SQL Editor do Supabase.

## Perfis
- Evinha (dona, rosa): tudo.
- Idelson (sócio, azul): tudo, menos estoque e o detalhe das vendas (vê só o total).
- Roberto (profissional, azul): o próprio painel, agenda e comissão (60% mão de obra, 40% química); registra venda sem ver estoque.

## Próximos passos
1. Criar o projeto no Supabase e ligar o `store.tsx` a ele (login com e-mail e senha).
2. Backup diário automático no Google Drive.
3. Empacotar: Electron (.exe) e Capacitor (.apk), gerados pelo GitHub Actions.

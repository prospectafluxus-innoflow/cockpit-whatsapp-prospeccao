# Inclusão no mesmo ciclo trimestral ativo

- [x] Administrador/RH com permissão de configuração consegue incluir participantes novos no ciclo já existente, enquanto Planejado ou Ativo; não precisa criar outro período nem retornar o estado.
- [x] Seção Participantes e avaliadores visível também no ciclo Ativo, com atalho Adicionar participantes no topo e indicação de que as avaliações existentes serão preservadas.
- [x] Mantém Persona concluído, vínculo vigente, avaliador autorizado, confirmação explícita do acesso individual, prevenção de duplicidade e trilha de auditoria. Não altera notas, status, revisão, competências ou permissões de participantes existentes.
- [x] Ciclos Encerrados/Cancelados continuam bloqueados para inclusão; remoção e troca de avaliador existente conservam suas regras atuais.
- [ ] Publicação confirmada no Google, sem adicionar pessoas ou alterar os ciclos reais da usuária durante os testes.

## Evidência local

Em 12/11/2026, TypeScript, 415 testes unitários (dois skips preexistentes), 37 verificações integradas em PostgreSQL local descartável e build de produção aprovados. O cenário integrado confirma que a inclusão ativa não altera a avaliação já encerrada de outra pessoa nem seu ciclo/período, não duplica participantes e registra cicloStatus=active na auditoria. Banco, role e fixtures locais descartados ao finalizar. Nenhum participante real foi incluído. A alteração de impressão segue separada no PR 47, aberto e não integrado por orientação da usuária.

# Correção — ciência do colaborador no Feedback

## Resultado necessário

- [x] Colaborador consegue visualizar e confirmar a declaração de ciência na própria devolutiva liberada, sem precisar acessar a aba Editor EEC, que continua bloqueada para ele.
- [x] A ação permanece condicionada a `canTransition`, ciclo ativo, confirmação explícita, revisão atual e autorização do servidor. Ler a página não registra ciência; gestores não registram ciência em nome do participante.
- [x] Avaliadores mantêm suas ações de concluir, registrar devolutiva, liberar e encerrar. Nenhuma nota, EEC, acesso, participante ou estado real foi alterado nos testes.
- [x] Publicar pelo workflow Google já autorizado e confirmar a versão servida: PR #37, execução 39880759901 concluída com sucesso, revisão `prospectafluxus-00004-74q`, commit `6035aa7938bdf2916fd00dad5cbceab7d0d9b846`; hash do módulo público idêntico ao build local corrigido.

Defeito confirmado em 22/10/2026: `TransitionActions` estava dentro do `TabsContent value="editor"`, inacessível ao participante que inicia na aba preview com o editor desabilitado. Solução mínima: posicionar as ações fora das abas, mantendo a API existente e a condição adicional de ciclo ativo.

Regressão de renderização comprovou a ausência da declaração antes da correção. Depois, passaram quatro testes isolados: declaração acessível com editor bloqueado, avanço desabilitado antes da confirmação, nenhuma transição sem autorização, nenhuma ciência antes da nova liberação e nenhuma ação em ciclo inativo. A revisão read-only confirmou que o backend já exige o próprio participante para registrar ciência e ciclo ativo. TypeScript, build e suíte completa: 252 testes aprovados, dois externos pulados.

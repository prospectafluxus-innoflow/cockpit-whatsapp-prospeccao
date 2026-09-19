import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FLUXUS_DIMENSIONS, FLUXUS_DIMENSION_META, type FluxusDimension, type FluxusResult } from "@shared/fluxus";

const guidance: Record<FluxusDimension, { act: string; avoid: string; motivate: string }> = {
  realizador: {
    act: "Vá direto ao ponto: apresente objetivo, prazo e decisão esperada. Dê autonomia, desafios e metas claras. Reconheça resultados e agilidade.",
    avoid: "Evite rodeios, reuniões longas sem decisão e microgerenciamento. Não confunda objetividade com falta de empatia.",
    motivate: "Autonomia, desafios, resultados visíveis e poder de decisão.",
  },
  comunicador: {
    act: "Reserve espaço para diálogo e reconheça contribuições. Conecte tarefas ao impacto nas pessoas. Combine canais e prazos para transformar entusiasmo em entrega.",
    avoid: "Evite isolamento, excesso de tarefas solitárias e feedback apenas frio e por escrito. Não corte o espaço de fala.",
    motivate: "Reconhecimento, interação, visibilidade e propósito coletivo.",
  },
  planejador: {
    act: "Explique mudanças com antecedência e em sequência. Ofereça estabilidade, previsibilidade e apoio. Valorize consistência e cooperação.",
    avoid: "Evite mudanças bruscas sem contexto, urgências constantes e pressão pública. Não confunda calma com falta de opinião.",
    motivate: "Segurança, rotina previsível, cooperação e reconhecimento da confiabilidade.",
  },
  analista: {
    act: "Traga dados, critérios e padrões claros. Dê tempo razoável para análise e defina a qualidade esperada. Dê feedback baseado em fatos.",
    avoid: "Evite cobranças vagas, prazos irreais sem critério e decisões sem justificativa. Não pressione por resolver sem informação.",
    motivate: "Qualidade, clareza de critérios, domínio técnico e processos bem definidos.",
  },
};

export function FluxusManagerGuidance({ result }: { result: FluxusResult }) {
  const demand = result.dimensions[result.maiorDemanda];
  const meta = FLUXUS_DIMENSION_META[result.maiorDemanda];
  const pressureBand = result.distanciaMediaAdaptacao >= 1.5 ? "Alta" : result.distanciaMediaAdaptacao <= 0.75 ? "Baixa" : "Moderada";
  const wear = result.sustentabilidade === "Atenção prioritária" ? "Alto" : result.sustentabilidade === "Acompanhar" ? "Moderado" : "Baixo";
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-card p-6">
        <Badge variant="outline">Análise Consolidada</Badge>
        <h2 className="mt-3 text-2xl font-semibold">Recomendações práticas para o gestor</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Perfil predominante: <strong className="text-foreground">{FLUXUS_DIMENSION_META[result.predominante].label}</strong>. Maior demanda de adaptação: <strong className="text-foreground">{meta.label}</strong> ({demand.demanda >= 0 ? "+" : ""}{demand.demanda.toFixed(1)}). Energia {result.energia.faixa}, autorregulação {result.autorregulacao.faixa}, pressão de adaptação {pressureBand} e risco de desgaste {wear}. Confirme as hipóteses na devolutiva e com evidências reais do trabalho.</p>
      </section>
      <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Como atuar em cada dimensão</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{FLUXUS_DIMENSIONS.map(dimension => { const meta = FLUXUS_DIMENSION_META[dimension]; const item = result.dimensions[dimension]; const itemGuidance = guidance[dimension]; return <div key={dimension} className="rounded-2xl border border-border/60 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{meta.label}</h3><Badge variant="secondary">Natural {item.natural.toFixed(1)}</Badge></div><p className="mt-3 text-sm"><strong>Como atuar:</strong> {itemGuidance.act}</p><p className="mt-3 text-sm text-muted-foreground"><strong className="text-foreground">Evitar:</strong> {itemGuidance.avoid}</p><p className="mt-3 text-sm text-muted-foreground"><strong className="text-foreground">O que motiva:</strong> {itemGuidance.motivate}</p></div>; })}</CardContent></Card>
      <Card className="border-amber-500/30 bg-amber-500/5"><CardHeader><CardTitle className="text-base">Alerta de demanda de adaptação</CardTitle></CardHeader><CardContent className="text-sm leading-relaxed">A dimensão <strong>{meta.label}</strong> é onde a função mais exige um comportamento diferente do natural ({demand.demanda >= 0 ? "+" : ""}{demand.demanda.toFixed(1)}). Investigue o custo dessa adaptação, se ela é sustentável e qual apoio o colaborador precisa. Um gap alto não é defeito: é tema de conversa e plano.</CardContent></Card>
      <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Energia, equilíbrio e desgaste</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Indicator label="Energia" value={result.energia.score} band={result.energia.faixa} /><Indicator label="Equilíbrio / autorregulação" value={result.autorregulacao.score} band={result.autorregulacao.faixa} /><Indicator label="Pressão de adaptação" value={result.distanciaMediaAdaptacao} band={pressureBand} /><Indicator label="Risco de desgaste" value={result.maiorGap} band={wear} /></CardContent></Card>
      <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Perguntas para a devolutiva</CardTitle></CardHeader><CardContent><ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground"><li>O que desta leitura faz sentido para você? Em que situação isso não aparece?</li><li>Onde você sente que precisa se esforçar para agir como a função pede?</li><li>Qual é o custo de manter essa adaptação ao longo do tempo?</li><li>Que comportamento você quer manter e qual quer desenvolver?</li><li>Que evidência no trabalho confirma ou contradiz essa leitura?</li><li>Que apoio do gestor ajudaria você a evoluir nesse ponto?</li></ol></CardContent></Card>
      <Card className="border-border/60"><CardHeader><CardTitle className="text-base">Plano de ação</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Plan label="Comportamento-alvo" value={`Desenvolver comportamentos de ${meta.label} exigidos pela função.`} /><Plan label="Situação" value="Ex.: reuniões de projeto" /><Plan label="Indicador" value="Ex.: registrar decisão, responsável e prazo em até 10 minutos." /><Plan label="Apoio do gestor" value="Ex.: acompanhamento quinzenal" /><Plan label="Data de revisão" value="__/__/____" /></div></CardContent></Card>
      <aside className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm leading-relaxed text-muted-foreground"><strong className="text-foreground">Nota de método.</strong> Este laudo apoia a decisão do gestor, mas não a substitui. As leituras são hipóteses comportamentais; não medem caráter, inteligência, saúde ou competência técnica.</aside>
    </div>
  );
}

function Indicator({ label, value, band }: { label: string; value: number; band: string }) { return <div className="rounded-xl bg-muted/40 p-4"><p className="text-sm font-medium">{label}</p><p className="mt-1 text-xl font-semibold">{value.toFixed(1)} · {band}</p></div>; }
function Plan({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border/60 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-sm leading-relaxed">{value}</p></div>; }

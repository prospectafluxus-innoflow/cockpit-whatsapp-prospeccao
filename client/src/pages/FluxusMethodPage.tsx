import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CURRENT_FLUXUS_FORMULA_VERSION,
  CURRENT_FLUXUS_INSTRUMENT_VERSION,
} from "@shared/fluxusVersioning";
import {
  Activity,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ShieldAlert,
  UserRound,
} from "lucide-react";

export default function FluxusMethodPage() {
  return <div className="space-y-6">
    <section className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
      <Badge variant="outline">Transparência metodológica</Badge>
      <h1 className="mt-3 text-3xl font-semibold">Como o Fluxus Persona Beta 2 calcula e interpreta resultados</h1>
      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">A ferramenta separa perfil comportamental, experiência atual do trabalho e sustentabilidade percebida. É um instrumento autoral de reflexão e desenvolvimento: não equivale a DISC ou PDA, não é diagnóstico clínico e ainda não possui normas populacionais ou validade preditiva para decisões de emprego.</p>
      <div className="mt-5 flex flex-wrap gap-2"><Badge variant="secondary">Instrumento {CURRENT_FLUXUS_INSTRUMENT_VERSION}</Badge><Badge variant="secondary">Fórmula {CURRENT_FLUXUS_FORMULA_VERSION}</Badge><Badge variant="secondary">Janela contextual: quatro semanas</Badge></div>
    </section>

    <div className="grid gap-4 lg:grid-cols-3">
      <Section icon={UserRound} title="1. Perfil comportamental"><p>Quatro dimensões autorrelatadas — Realizador, Comunicador, Planejador e Analista — são calculadas pela média de cinco itens. O bloco é inspirado em dimensões comportamentais difundidas pelo DISC, mas não é um teste DISC oficial.</p></Section>
      <Section icon={Activity} title="2. Momento atual"><p>Sete dimensões contextuais usam as últimas quatro semanas: engajamento, carga sustentável, autonomia, clareza, apoio e reconhecimento, relações e segurança para falar, e desenvolvimento. A distinção entre perfil e contexto é conceitualmente inspirada em modelos como o PDA, sem reproduzir seu questionário ou algoritmo.</p></Section>
      <Section icon={Calculator} title="3. Índice Fluxus"><p>Combina energia, recuperação, autorregulação, pressão, desgaste e demanda de adaptação entre perfil e função. A saída é “Sustentável”, “Ponto de atenção” ou “Conversa prioritária”; nenhuma dessas faixas representa diagnóstico.</p></Section>
    </div>

      <Card className="border-border/60"><CardHeader><CardTitle className="text-lg">Cálculos transparentes</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground"><p>O perfil comportamental não é mais uma média de dois questionários semelhantes. O bloco Momento Atual é independente e não altera o perfil.</p><pre className="overflow-auto rounded-xl bg-muted p-4 text-xs">{`Perfil(d) = média dos 5 itens comportamentais da dimensão d\nMomento(m) = média dos 3 itens contextuais da dimensão m\nDemanda(d) = Função percebida(d) − Perfil(d)\nÍndice Fluxus = média(Momento geral, fatores protetivos, inverso dos riscos, ajuste da demanda)`}</pre><p>O item “Interrupções e urgências têm tornado meu trabalho difícil de administrar” é redigido no sentido de risco e usa pontuação invertida (8 − resposta) antes da média de Carga sustentável. Pressão e desgaste também são invertidos somente na consolidação do índice. As faixas são regras exploratórias da versão, não percentis.</p></CardContent></Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <Section icon={CheckCircle2} title="Hipóteses permitidas"><ul className="list-disc space-y-2 pl-5"><li>Explorar preferências de atuação e exigências percebidas da função.</li><li>Identificar mudanças autorrelatadas entre ciclos comparáveis.</li><li>Investigar fatores protetivos e condições de trabalho que merecem ajuste.</li><li>Organizar devolutivas, ações e acompanhamento com responsáveis e prazo.</li><li>Apoiar uma discussão de desenvolvimento com outras evidências independentes.</li></ul></Section>
      <Section icon={ShieldAlert} title="Conclusões proibidas"><ul className="list-disc space-y-2 pl-5"><li>Diagnosticar burnout, estresse, depressão ou qualquer condição de saúde.</li><li>Concluir automaticamente que alguém está engajado, competente ou improdutivo.</li><li>Declarar uma pessoa apta ou inapta para promoção.</li><li>Rankear pessoas ou decidir contratação, remuneração, promoção ou desligamento de forma isolada.</li><li>Afirmar equivalência, conversão de escores ou validação como DISC ou PDA.</li></ul></Section>
    </div>

    <Card className="border-amber-500/30 bg-amber-500/5"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Uso responsável e versionamento</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground"><p>Uma sinalização de conversa prioritária exige acolhimento, confirmação com a pessoa e revisão do contexto. Quando houver sofrimento ou risco à saúde, devem ser usados os canais profissionais apropriados.</p><p>Avaliações Beta 1 permanecem armazenadas com suas perguntas e fórmulas originais. Novos ciclos usam a Beta 2. Ciclos de versões diferentes não são apresentados como mudança direta de pontuação.</p></CardContent></Card>
  </div>;
}

function Section({ icon: Icon, title, children }: { icon: typeof Calculator; title: string; children: React.ReactNode }) {
  return <Card className="border-border/60"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-primary" />{title}</CardTitle></CardHeader><CardContent className="text-sm leading-relaxed text-muted-foreground">{children}</CardContent></Card>;
}

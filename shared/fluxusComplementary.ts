export const COMPLEMENTARY_TERMS_VERSION = "2026-11-11.v1";
export const COMPLEMENTARY_MAX_PDF_BYTES = 5 * 1024 * 1024;
export const COMPLEMENTARY_MAX_ACTIVE = 20;
export const COMPLEMENTARY_MAX_PENDING = 4;
export const COMPLEMENTARY_KINDS = ["pq", "saboteurs"] as const;
export type ComplementaryKind = (typeof COMPLEMENTARY_KINDS)[number];
export const SABOTEUR_LABELS = {
  stickler: "Insistente",
  pleaser: "Prestativo",
  hyperVigilant: "Hipervigilante",
  restless: "Inquieto",
  controller: "Controlador",
  avoider: "Esquivo",
  hyperAchiever: "Hiper-Realizador",
  victim: "Vítima",
  hyperRational: "Hiper-Racional",
} as const;
export type SaboteurKey = keyof typeof SABOTEUR_LABELS;
export const CRITIC_LABELS = {
  self: "Crítica a si mesmo",
  others: "Crítica aos outros",
  circumstances: "Crítica às circunstâncias",
} as const;
export type CriticKey = keyof typeof CRITIC_LABELS;
export type ComplementaryValues = {
  pq: number | null;
  saboteurs: Partial<Record<SaboteurKey, number | null>>;
  critic: Partial<Record<CriticKey, number | null>>;
};
export type ComplementaryRecipient = {
  id: number;
  name: string;
  roleLabel: string;
};
export type ComplementarySummary = {
  id: number;
  revision: number;
  kind: ComplementaryKind;
  status: "pending" | "confirmed" | "revoked";
  ownerName: string;
  sourceDate: string | null;
  createdAt: string;
  confirmedAt: string | null;
  recipientNames: string[];
};
export type ComplementaryDetail = ComplementarySummary & {
  assessmentId: number;
  sourceName: string | null;
  fileName: string | null;
  values: ComplementaryValues | null;
  warnings: string[];
  context: string | null;
  recipients: ComplementaryRecipient[];
  termsVersion: string;
  consentText: string;
  isOwner: boolean;
};
export type ComplementaryAvailability = {
  enabled: boolean;
  eligible: boolean;
  reason: string | null;
  termsVersion: string;
  user: { id: number; name: string; companyId: number | null };
  recipients: ComplementaryRecipient[];
};
export const OFFICIAL_ASSESSMENT_URLS = {
  pq: "https://positiveintelligence.com/pq/",
  saboteurs: "https://positiveintelligence.com/saboteurs/",
} as const;
export function complementaryConsentText(
  recipients: ComplementaryRecipient[]
): string {
  const readers = recipients.length
    ? recipients.map(r => `${r.name} (${r.roleLabel})`).join("; ")
    : "nenhum outro leitor — somente você";
  return `Importação opcional de relatório externo de autoconhecimento. Autorizo o Fluxus Persona a receber, guardar e organizar o PDF e os resultados que eu enviar para apoiar meu autoconhecimento e conversas de desenvolvimento. Leitores escolhidos por mim: ${readers}. O relatório só será compartilhado com esses leitores após minha conferência e confirmação; ser gestor ou administrador não concede acesso automático. O QP é um autorrelato de um período, não uma medida de capacidade ou produtividade. Estes resultados não serão somados às notas do Persona/Feedback, usados para diagnóstico ou para decisões de contratação, promoção, remuneração ou desligamento. Posso não participar sem prejuízo à conclusão do Persona ou ao Feedback. Posso excluir esta importação ou retirar este compartilhamento na própria rotina: isso encerra o acesso e remove o PDF e os resultados do sistema ativo, preservando apenas registro mínimo da autorização e retirada; backups seguem a política de retenção aplicável. O arquivo permanece armazenado enquanto eu mantiver esta importação, sujeito à política de retenção informada pela empresa. Nenhum PDF será enviado a serviço externo de IA nesta rotina. Declaro que o relatório é meu e que entendi a finalidade e os leitores desta autorização. Termo ${COMPLEMENTARY_TERMS_VERSION}.`;
}
export function emptyComplementaryValues(): ComplementaryValues {
  return { pq: null, saboteurs: {}, critic: {} };
}

/**
 * notification.ts — Helper de notificações
 *
 * Em modo independente (sem Manus Forge), as notificações são registradas
 * no console do servidor. Para produção, configure um serviço de email
 * (ex: Resend, SendGrid) definindo NOTIFICATION_EMAIL e RESEND_API_KEY.
 *
 * Compatível com a assinatura original: notifyOwner({ title, content })
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL ?? "";

export async function notifyOwner({
  title,
  content,
}: {
  title: string;
  content: string;
}): Promise<boolean> {
  // Sempre loga no console (útil para debug e logs do Render)
  console.log(`[Notificação] ${title}\n${content}`);

  // Se Resend estiver configurado, envia email
  if (RESEND_API_KEY && NOTIFICATION_EMAIL) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ProspectaFluxus <noreply@prospectafluxus.com.br>",
          to: NOTIFICATION_EMAIL,
          subject: title,
          text: content,
        }),
      });

      if (!res.ok) {
        console.error("[Notificação] Falha ao enviar email via Resend:", await res.text());
        return false;
      }

      return true;
    } catch (err) {
      console.error("[Notificação] Erro ao enviar email:", err);
      return false;
    }
  }

  // Sem email configurado, apenas loga
  return true;
}

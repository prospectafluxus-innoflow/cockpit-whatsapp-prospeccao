import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { complementaryConsentText } from "../shared/fluxusComplementary";

async function main() {
  if (
    !process.env.DATABASE_URL?.includes(
      "@127.0.0.1:5432/persona_complementary_it_"
    ) ||
    process.env.PERSONA_COMPLEMENTARY_LOCAL_TEST !== "true"
  )
    throw new Error(
      "Execute somente pelo wrapper de PostgreSQL local descartável."
    );
  process.env.NODE_ENV = "test";
  process.env.FLUXUS_COMPLEMENTARY_ENABLED = "true";
  process.env.INTEGRATION_ENCRYPTION_KEY = "ab".repeat(32);
  const sql = postgres(process.env.DATABASE_URL, {
    ssl: { rejectUnauthorized: false },
    prepare: false,
  });
  const service = await import("../server/fluxusComplementaryDb");
  let count = 0;
  async function check(label: string, operation: () => void | Promise<void>) {
    await operation();
    count++;
    console.log(`OK ${count}: ${label}`);
  }
  async function denied(operation: () => Promise<unknown>, code?: string) {
    await assert.rejects(operation, (error: unknown) => {
      if (code) assert.equal((error as { code?: string }).code, code);
      return true;
    });
  }
  function syntheticPdf(
    kind: "pq" | "saboteurs" = "pq",
    owner = "Pessoa Teste",
    marker = ""
  ): Buffer {
    const title =
      kind === "pq"
        ? "Relatorio de Avaliacao do QP"
        : "Relatorio de Avaliacao dos Sabotadores";
    const lines = [
      `${title} de ${owner}.`,
      "Data: 11/11/2026",
      kind === "pq"
        ? "Pontuacao QP: 47"
        : "Grafico de resultados: conferir manualmente.",
      marker,
    ];
    const stream =
      "BT /F1 12 Tf 50 750 Td " +
      lines
        .map(
          (line, index) =>
            `${index ? "0 -20 Td " : ""}(${line.replace(/[()\\]/g, "\\$&")}) Tj`
        )
        .join(" ") +
      " ET";
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ];
    let output = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(output));
      output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(output);
    output += `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map(offset => String(offset).padStart(10, "0") + " 00000 n ")
      .join(
        "\n"
      )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(output);
  }
  const saboteurs = {
    stickler: 4.5,
    pleaser: 6,
    hyperVigilant: 6.5,
    restless: 5.5,
    controller: 6,
    avoider: 5.5,
    hyperAchiever: 6,
    victim: 3.5,
    hyperRational: 5.5,
  };
  const baseInput = {
    userId: 10,
    kind: "pq" as const,
    fileName: "teste-ficticio.pdf",
    pdfBase64: syntheticPdf().toString("base64"),
    recipientUserIds: [20, 40],
    termsVersion: "2026-11-11.v1",
    consentText: complementaryConsentText([
      { id: 20, name: "Gestora Exemplo", roleLabel: "Gestor" },
      {
        id: 40,
        name: "Consultora Escolhida",
        roleLabel: "Administrador da plataforma",
      },
    ]),
    consentAccepted: true as const,
  };
  try {
    await check(
      "elegibilidade usa ciclo concluído mesmo com rascunho mais novo",
      async () => {
        const a = await service.getComplementaryAvailability(10);
        assert.equal(a.eligible, true);
        assert.ok(a.recipients.some(r => r.id === 40));
        assert.ok(!a.recipients.some(r => r.id === 30));
      }
    );
    await check(
      "não importa sem consentimento, com nome diferente ou sem Persona concluído",
      async () => {
        await denied(
          () =>
            service.uploadComplementaryReport({
              ...baseInput,
              consentAccepted: false as unknown as true,
            }),
          "BAD_REQUEST"
        );
        await denied(
          () =>
            service.uploadComplementaryReport({
              ...baseInput,
              pdfBase64: syntheticPdf("pq", "Outra Pessoa").toString("base64"),
            }),
          "BAD_REQUEST"
        );
        await denied(
          () => service.uploadComplementaryReport({ ...baseInput, userId: 12 }),
          "FORBIDDEN"
        );
      }
    );
    await check(
      "não autoriza gestor de outro cliente ou colega sem papel de leitor",
      async () => {
        await denied(
          () =>
            service.uploadComplementaryReport({
              ...baseInput,
              recipientUserIds: [30],
            }),
          "BAD_REQUEST"
        );
        await denied(
          () =>
            service.uploadComplementaryReport({
              ...baseInput,
              recipientUserIds: [22],
            }),
          "BAD_REQUEST"
        );
      }
    );
    const pending = await service.uploadComplementaryReport(baseInput);
    await check(
      "upload próprio guarda PDF cifrado e nenhum resultado confirmado",
      async () => {
        const [r] =
          await sql`select "userId","companyId","assessmentId","pdfCiphertext","values" from fluxus_complementary_reports where id=${pending.id} limit 1`;
        assert.equal(r.userId, 10);
        assert.equal(r.companyId, 1);
        assert.equal(r.assessmentId, 101);
        assert.equal(r.values, null);
        assert.ok(!r.pdfCiphertext.includes("%PDF"));
        assert.equal(pending.values?.pq, 47);
      }
    );
    await check(
      "reabrir pendente recupera a extração somente para o titular",
      async () => {
        const r = await service.getComplementaryDetail(10, pending.id);
        assert.equal(r.values?.pq, 47);
        assert.equal(r.sourceDate, "2026-11-11");
        assert.ok(!("pdfCiphertext" in r));
        await denied(() => service.getComplementaryDetail(20, pending.id));
        await denied(() => service.getComplementaryDetail(40, pending.id));
        await denied(() => service.getComplementaryDetail(41, pending.id));
      }
    );
    await check("duplicidade ativa rejeitada de forma segura", async () => {
      await denied(
        () => service.uploadComplementaryReport(baseInput),
        "CONFLICT"
      );
    });
    await check("revisão inválida não sobrescreve o pendente", async () => {
      await denied(
        () =>
          service.confirmComplementaryReport({
            userId: 10,
            reportId: pending.id,
            expectedRevision: 2,
            sourceDate: "2026-11-11",
            values: { pq: 47, saboteurs: {}, critic: {} },
            identityConfirmed: true,
          }),
        "CONFLICT"
      );
    });
    const confirmed = await service.confirmComplementaryReport({
      userId: 10,
      reportId: pending.id,
      expectedRevision: 1,
      sourceDate: "2026-11-11",
      values: { pq: 47, saboteurs: {}, critic: {} },
      identityConfirmed: true,
    });
    await check(
      "somente leitores escolhidos acessam após confirmação, sem bypass admin",
      async () => {
        assert.equal(confirmed.revision, 2);
        assert.equal(
          (await service.getComplementaryDetail(20, pending.id)).values?.pq,
          47
        );
        assert.equal(
          (await service.getComplementaryDetail(40, pending.id)).values?.pq,
          47
        );
        await denied(() => service.getComplementaryDetail(21, pending.id));
        await denied(() => service.getComplementaryDetail(41, pending.id));
        await denied(() => service.getComplementaryDetail(30, pending.id));
      }
    );
    await check(
      "listagem compartilhada não expõe PDF nem valores",
      async () => {
        const r = await service.listSharedWithMe(20);
        assert.ok(r.reports.some(x => x.id === pending.id));
        assert.ok(!("values" in r.reports[0]));
        assert.ok(!("pdfCiphertext" in r.reports[0]));
        assert.equal((await service.listSharedWithMe(41)).reports.length, 0);
      }
    );
    await check(
      "download exige consentimento e preserva exatamente o arquivo",
      async () => {
        const r = await service.downloadComplementaryReport(20, pending.id);
        assert.equal(
          createHash("sha256")
            .update(Buffer.from(r.base64, "base64"))
            .digest("hex"),
          createHash("sha256").update(syntheticPdf()).digest("hex")
        );
        await denied(() => service.downloadComplementaryReport(41, pending.id));
      }
    );
    await check("mudança cadastral revoga a leitura antiga", async () => {
      await sql`update users set "fluxusRole"='collaborator' where id=20`;
      await denied(() => service.getComplementaryDetail(20, pending.id));
      await sql`update users set "fluxusRole"='manager' where id=20`;
      await sql`update users set "approvalStatus"='pending' where id=40`;
      await denied(() => service.getComplementaryDetail(40, pending.id));
      await sql`update users set "approvalStatus"='approved' where id=40`;
    });
    await check(
      "somente titular pode revogar; rotina desligada não impede retirada",
      async () => {
        await denied(() =>
          service.revokeComplementaryReport({
            userId: 20,
            reportId: pending.id,
            expectedRevision: 2,
          })
        );
        process.env.FLUXUS_COMPLEMENTARY_ENABLED = "false";
        await denied(
          () => service.uploadComplementaryReport(baseInput),
          "PRECONDITION_FAILED"
        );
        await service.revokeComplementaryReport({
          userId: 10,
          reportId: pending.id,
          expectedRevision: 2,
        });
        const [r] =
          await sql`select "pdfCiphertext","values","sourceName","context" from fluxus_complementary_reports where id=${pending.id} limit 1`;
        assert.equal(r.pdfCiphertext, null);
        assert.equal(r.values, null);
        assert.equal(r.sourceName, null);
        assert.equal(r.context, null);
        await denied(() => service.getComplementaryDetail(20, pending.id));
        await denied(() => service.downloadComplementaryReport(20, pending.id));
        assert.equal((await service.listSharedWithMe(20)).reports.length, 0);
        process.env.FLUXUS_COMPLEMENTARY_ENABLED = "true";
      }
    );
    const sab = await service.uploadComplementaryReport({
      ...baseInput,
      kind: "saboteurs",
      pdfBase64: syntheticPdf("saboteurs").toString("base64"),
      recipientUserIds: [],
      consentText: complementaryConsentText([]),
    });
    await check(
      "Sabotadores confirmam decimais, não exigem QP e ficam privados por padrão",
      async () => {
        const r = await service.confirmComplementaryReport({
          userId: 10,
          reportId: sab.id,
          expectedRevision: 1,
          sourceDate: "2026-11-11",
          values: { pq: null, saboteurs, critic: {} },
          identityConfirmed: true,
        });
        assert.equal(r.values?.saboteurs.hyperVigilant, 6.5);
        assert.deepEqual(r.recipients, []);
        await denied(() => service.getComplementaryDetail(40, sab.id));
      }
    );
    const concurrent = await service.uploadComplementaryReport({
      ...baseInput,
      pdfBase64: syntheticPdf(
        "pq",
        "Pessoa Teste",
        "concurrency fixture"
      ).toString("base64"),
      recipientUserIds: [],
      consentText: complementaryConsentText([]),
    });
    await check(
      "duas confirmações concorrentes não sobrescrevem resultados",
      async () => {
        const results = await Promise.allSettled(
          [47, 48].map(pq =>
            service.confirmComplementaryReport({
              userId: 10,
              reportId: concurrent.id,
              expectedRevision: 1,
              sourceDate: "2026-11-11",
              values: { pq, saboteurs: {}, critic: {} },
              identityConfirmed: true,
            })
          )
        );
        assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
        assert.equal(results.filter(x => x.status === "rejected").length, 1);
        assert.equal(
          (await service.getComplementaryDetail(10, concurrent.id)).revision,
          2
        );
      }
    );
    await check(
      "auditoria não contém notas, conteúdo do arquivo ou nome de terceiros",
      async () => {
        const rows =
          await sql`select metadata from fluxus_audit_logs order by id limit 100`;
        const text = JSON.stringify(rows);
        assert.ok(!text.includes("%PDF"));
        assert.ok(!text.includes("Pontuacao"));
        assert.ok(!text.includes("6.5"));
        assert.ok(rows.length > 0);
      }
    );
    await check(
      "consentimento alterado não registra leitores ou termos diferentes dos aceitos",
      async () => {
        await sql`update users set name='Gestora Atualizada' where id=20`;
        await denied(
          () =>
            service.uploadComplementaryReport({
              ...baseInput,
              pdfBase64: syntheticPdf(
                "pq",
                "Pessoa Teste",
                "stale consent"
              ).toString("base64"),
            }),
          "BAD_REQUEST"
        );
        await sql`update users set name='Gestora Exemplo' where id=20`;
      }
    );
    const corrupt = await service.uploadComplementaryReport({
      ...baseInput,
      pdfBase64: syntheticPdf("pq", "Pessoa Teste", "integrity test").toString(
        "base64"
      ),
    });
    await check(
      "integridade é verificada novamente antes de publicar a confirmação",
      async () => {
        await sql`update fluxus_complementary_reports set "fileHash"=${"0".repeat(64)} where id=${corrupt.id}`;
        await denied(
          () =>
            service.confirmComplementaryReport({
              userId: 10,
              reportId: corrupt.id,
              expectedRevision: 1,
              sourceDate: "2026-11-11",
              values: { pq: 47, saboteurs: {}, critic: {} },
              identityConfirmed: true,
            }),
          "INTERNAL_SERVER_ERROR"
        );
        const [r] =
          await sql`select status from fluxus_complementary_reports where id=${corrupt.id} limit 1`;
        assert.equal(r.status, "pending");
        await service.revokeComplementaryReport({
          userId: 10,
          reportId: corrupt.id,
          expectedRevision: 1,
        });
      }
    );
    async function waitForLocalLock() {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const [r] =
          await sql`select count(*)::int as n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' limit 1`;
        if (r.n > 0) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error("A requisição de teste não alcançou o lock local.");
    }
    await check(
      "mudança de empresa durante upload aborta antes de associar o PDF a outro tenant",
      async () => {
        await sql`insert into users (id,name,"companyId","fluxusRole") values (13,'Outro Teste',1,'collaborator')`;
        await sql`insert into fluxus_assessments (id,"companyId","userId",status,"completedAt") values (113,1,13,'completed','2026-11-11')`;
        let result: Promise<{ error?: unknown }>;
        const lock = ((13 * 73856093) ^ (1 * 19349663)) >>> 0;
        await sql.begin(async tx => {
          await tx`select pg_advisory_xact_lock(${lock & 0x7fffffff})`;
          result = service
            .uploadComplementaryReport({
              ...baseInput,
              userId: 13,
              pdfBase64: syntheticPdf(
                "pq",
                "Outro Teste",
                "tenant change"
              ).toString("base64"),
              recipientUserIds: [],
              consentText: complementaryConsentText([]),
            })
            .then(
              () => ({}),
              error => ({ error })
            );
          await waitForLocalLock();
          await tx`update users set "companyId"=2 where id=13`;
          await tx`update fluxus_assessments set "companyId"=2 where id=113`;
        });
        assert.equal(
          ((await result!).error as { code?: string }).code,
          "CONFLICT"
        );
        const [r] =
          await sql`select count(*)::int as n from fluxus_complementary_reports where "userId"=13 limit 1`;
        assert.equal(r.n, 0);
      }
    );
    const linear = await service.uploadComplementaryReport({
      ...baseInput,
      pdfBase64: syntheticPdf("pq", "Pessoa Teste", "linearized read").toString(
        "base64"
      ),
    });
    await service.confirmComplementaryReport({
      userId: 10,
      reportId: linear.id,
      expectedRevision: 1,
      sourceDate: "2026-11-11",
      values: { pq: 47, saboteurs: {}, critic: {} },
      identityConfirmed: true,
    });
    await check(
      "download bloqueado atrás de uma retirada não retorna o PDF após a revogação",
      async () => {
        let result: Promise<{ error?: unknown }>;
        await sql.begin(async tx => {
          await tx`select id from fluxus_complementary_reports where id=${linear.id} limit 1 for update`;
          result = service.downloadComplementaryReport(20, linear.id).then(
            () => ({}),
            error => ({ error })
          );
          await waitForLocalLock();
          await tx`update fluxus_complementary_reports set status='revoked',revision=revision+1,"pdfCiphertext"=null,"fileHash"=null,"fileName"=null,"sourceName"=null,"sourceDate"=null,values=null,warnings='[]',context=null,"confirmedAt"=null,"revokedAt"=now(),"updatedAt"=now() where id=${linear.id}`;
        });
        assert.ok((await result!).error);
      }
    );
    await check(
      "API não devolve parâmetros pessoais em falhas internas do banco",
      async () => {
        const { fluxusComplementaryRouter } = await import(
          "../server/routers/fluxusComplementary"
        );
        const headers: Record<string, string> = {};
        const caller = fluxusComplementaryRouter.createCaller({
          user: {
            id: 10,
            name: "Pessoa Teste",
            role: "user",
            approvalStatus: "approved",
            accountType: "fluxus",
            privacyDeletedAt: null,
          },
          req: {},
          res: {
            set: (key: string, value: string) => {
              headers[key] = value;
            },
          },
        } as any);
        await sql.unsafe(
          "ALTER TABLE fluxus_audit_logs ADD CONSTRAINT complementary_it_audit_fail CHECK (action <> 'complementary.import') NOT VALID"
        );
        try {
          await assert.rejects(
            () =>
              caller.upload({
                ...baseInput,
                pdfBase64: syntheticPdf(
                  "pq",
                  "Pessoa Teste",
                  "forced audit failure"
                ).toString("base64"),
              }),
            error => {
              assert.equal(
                (error as { code?: string }).code,
                "INTERNAL_SERVER_ERROR"
              );
              assert.ok(!(error as Error).message.includes("Pessoa Teste"));
              assert.ok(!(error as Error).message.includes("insert into"));
              return true;
            }
          );
          assert.equal(headers["Cache-Control"], "private, no-store");
        } finally {
          await sql.unsafe(
            "ALTER TABLE fluxus_audit_logs DROP CONSTRAINT complementary_it_audit_fail"
          );
        }
      }
    );

    console.log(
      `INTEGRAÇÃO LOCAL: ${count} cenários aprovados; nenhum acesso a produção.`
    );
  } finally {
    await sql.end();
  }
  process.exit(0);
}
void main().catch(error => {
  console.error("Falha no teste local isolado:", error);
  process.exit(1);
});

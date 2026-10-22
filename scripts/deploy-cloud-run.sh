#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Uso:
  scripts/deploy-cloud-run.sh --project PROJECT_ID --region REGION --service SERVICE

Configuração protegida (somente nomes/referências, nunca valores de secrets):
  CLOUD_RUN_SECRET_DATABASE_URL_NAME (obrigatório)
  CLOUD_RUN_SECRET_JWT_SECRET_NAME   (obrigatório)
  CLOUD_RUN_SECRET_CRON_SECRET_NAME  (obrigatório)
  CLOUD_RUN_SECRET_<ENV_NAME>_NAME    (opcionais; ver lista no script)
  CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT (e-mail da conta técnica de runtime)
  CLOUD_RUN_BUILD_SERVICE_ACCOUNT   (recurso projects/.../serviceAccounts/...)
  CLOUD_RUN_PUBLIC_ENV_FILE         (arquivo opcional de configurações não secretas)

O serviço fica privado inicialmente. A publicação do endereço exige validação
anterior e autorização do operador. O script não altera dados, cron ou webhooks.
EOF
}

PROJECT_ID="${CLOUD_RUN_PROJECT_ID:-}"
REGION="${CLOUD_RUN_REGION:-}"
SERVICE="${CLOUD_RUN_SERVICE:-}"

while (($# > 0)); do
  case "$1" in
    --project|--region|--service)
      [[ $# -ge 2 ]] || { echo "$1 exige um valor" >&2; exit 2; }
      case "$1" in
        --project) PROJECT_ID="$2" ;;
        --region) REGION="$2" ;;
        --service) SERVICE="$2" ;;
      esac
      shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Argumento desconhecido: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$PROJECT_ID" && -n "$REGION" && -n "$SERVICE" ]] || { echo "project, region e service são obrigatórios" >&2; exit 2; }
command -v gcloud >/dev/null 2>&1 || { echo "gcloud não encontrado" >&2; exit 127; }
: "${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:?Defina a conta de serviço de runtime}"
: "${CLOUD_RUN_BUILD_SERVICE_ACCOUNT:?Defina a conta de serviço de build}"

add_secret_ref() {
  local env_name="$1" config_var="$2" required="${3:-false}"
  local secret_name="${!config_var:-}"
  if [[ -z "$secret_name" ]]; then
    [[ "$required" != "true" ]] || { echo "Configuração protegida ausente: $config_var" >&2; exit 2; }
    return 0
  fi
  [[ "$secret_name" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$ ]] || { echo "Nome inválido de secret em $config_var" >&2; exit 2; }
  SECRET_BINDINGS+=("${env_name}=${secret_name}:latest")
}

SECRET_BINDINGS=()
add_secret_ref DATABASE_URL CLOUD_RUN_SECRET_DATABASE_URL_NAME true
add_secret_ref JWT_SECRET CLOUD_RUN_SECRET_JWT_SECRET_NAME true
add_secret_ref CRON_SECRET CLOUD_RUN_SECRET_CRON_SECRET_NAME true

# Integrações opcionais: valores sensíveis entram sempre por Secret Manager.
for env_name in SESSION_SECRET GEMINI_API_KEY OPENROUTER_API_KEY BUILT_IN_FORGE_API_KEY WABLAST_API_KEY WABLAST_WEBHOOK_SECRET INTEGRATION_ENCRYPTION_KEY RESEND_API_KEY S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY VAPID_PRIVATE_KEY; do
  add_secret_ref "$env_name" "CLOUD_RUN_SECRET_${env_name}_NAME"
done

cmd=(
  gcloud run deploy "$SERVICE"
  --project="$PROJECT_ID" --region="$REGION" --platform=managed --source=.
  --port=8080 --cpu=1 --memory=512Mi
  --min=0 --max=1 --min-instances=0 --max-instances=1
  --concurrency=40 --timeout=300s --cpu-throttling
  --service-account="$CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT"
  --build-service-account="$CLOUD_RUN_BUILD_SERVICE_ACCOUNT"
  --startup-probe=httpGet.path=/api/health,httpGet.port=8080,timeoutSeconds=5,periodSeconds=10,failureThreshold=24
  --no-allow-unauthenticated --quiet
)

# Este arquivo deve conter SOMENTE configurações públicas/vazias, como o flag
# FLUXUS_FEEDBACK_ENABLED, NODE_ENV, S3_BUCKET/endpoint e a chave pública VAPID.
if [[ -n "${CLOUD_RUN_PUBLIC_ENV_FILE:-}" ]]; then
  [[ -r "$CLOUD_RUN_PUBLIC_ENV_FILE" ]] || { echo "Arquivo de configuração pública não encontrado" >&2; exit 2; }
  cmd+=(--env-vars-file="$CLOUD_RUN_PUBLIC_ENV_FILE")
else
  cmd+=(--set-env-vars=NODE_ENV=production)
fi

secret_csv="$(IFS=,; echo "${SECRET_BINDINGS[*]}")"
cmd+=(--set-secrets="$secret_csv")
printf 'Deploy privado: %s em %s/%s (min=0, max=1, 1 vCPU, 512Mi, request-based)\n' "$SERVICE" "$PROJECT_ID" "$REGION"
"${cmd[@]}"

cat <<'EOF'
Nenhuma migration, tarefa do Cloud Scheduler ou configuração de webhook foi
executada. Source deploy pode gerar custos de Cloud Build, Artifact Registry,
armazenamento, rede e Secret Manager; não há promessa de custo zero.
EOF

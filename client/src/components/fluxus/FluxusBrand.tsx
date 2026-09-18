export const FLUXUS_PERSONA_LOGO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663667466619/OoTTEttQiTwWSnTO.webp";

export function FluxusPersonaLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={FLUXUS_PERSONA_LOGO_URL}
      alt="Fluxus Persona — InnoFlow"
      className={className}
      decoding="async"
    />
  );
}

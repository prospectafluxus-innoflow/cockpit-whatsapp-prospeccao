export type FluxusReportVisibility =
  | "participant_only"
  | "participant_manager_hr"
  | "participant_hr";

export type FluxusReportViewer = {
  role?: string | null;
  accountType?: string | null;
  companyId?: number | null;
  fluxusRole?: string | null;
};

export function canAccessFluxusIndividualReport(
  viewer: FluxusReportViewer,
  policy: string,
  companyId: number
) {
  if (viewer.role === "admin") {
    return policy === "participant_manager_hr";
  }

  const sameCompany =
    viewer.accountType === "fluxus" && viewer.companyId === companyId;
  if (!sameCompany) return false;

  if (viewer.fluxusRole === "manager") {
    return policy === "participant_manager_hr";
  }
  if (viewer.fluxusRole === "hr") {
    return policy === "participant_manager_hr" || policy === "participant_hr";
  }
  return false;
}

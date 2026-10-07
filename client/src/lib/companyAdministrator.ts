type AdminSelection = {
  companyId: number;
  person: { id: number };
  expectedIsAdmin: boolean;
};
type AdminWorkspace = {
  enabled: boolean;
  companyId: number | null;
  people: readonly { id: number; isCompanyAdmin: boolean }[];
};

export function canConfirmCompanyAdministrator(input: {
  companyId: number;
  selection: AdminSelection | null;
  workspace: AdminWorkspace | undefined;
  error: unknown;
  isFetching: boolean;
  isPending: boolean;
}) {
  const { selection, workspace } = input;
  if (
    !selection ||
    !workspace?.enabled ||
    input.error ||
    input.isFetching ||
    input.isPending
  )
    return false;
  if (
    selection.companyId !== input.companyId ||
    workspace.companyId !== input.companyId
  )
    return false;
  const person = workspace.people.find(item => item.id === selection.person.id);
  return (
    person !== undefined && person.isCompanyAdmin === selection.expectedIsAdmin
  );
}

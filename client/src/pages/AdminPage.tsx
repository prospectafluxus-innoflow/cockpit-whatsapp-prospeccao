import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, Users, UserCheck, Loader2, Crown, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Redirecionar se não for admin
  if (user && user.role !== "admin") {
    navigate("/");
    return null;
  }

  const usersQuery = trpc.authOwn.listUsers.useQuery();
  const promoteMutation = trpc.authOwn.promoteUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário promovido a administrador.");
      usersQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const approveMutation = trpc.authOwn.approveUser.useMutation({
    onSuccess: () => {
      toast.success("Acesso aprovado! O usuário já pode fazer login.");
      usersQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const rejectMutation = trpc.authOwn.rejectUser.useMutation({
    onSuccess: () => {
      toast.success("Cadastro rejeitado.");
      usersQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const users_list = usersQuery.data ?? [];
  const totalUsers = users_list.length;
  const adminCount = users_list.filter((u) => u.role === "admin").length;
  const pendingCount = users_list.filter((u) => (u as any).approvalStatus === "pending").length;

  const approvalStatusLabel = (status: string) => {
    if (status === "approved") return { label: "Aprovado", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    if (status === "rejected") return { label: "Rejeitado", color: "bg-red-500/10 text-red-400 border-red-500/20" };
    return { label: "Pendente", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Painel de Administração</h1>
          <p className="text-sm text-muted-foreground">Gerencie os usuários do ProspectaFluxus</p>
        </div>
      </div>

      {/* Alerta de pendentes */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <Clock className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              {pendingCount} {pendingCount === 1 ? "cadastro aguarda" : "cadastros aguardam"} aprovação
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5">Revise os cadastros abaixo e aprove ou rejeite o acesso.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalUsers}</p>
              <p className="text-sm text-muted-foreground">Total de usuários</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Aguardando aprovação</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Crown className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{adminCount}</p>
              <p className="text-sm text-muted-foreground">Administradores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de usuários */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Usuários cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users_list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum usuário cadastrado ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground font-medium pl-6">Nome</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium">Email</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium">Acesso</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium">Perfil</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium">Cadastro</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users_list.map((u) => {
                  const approvalStatus = (u as any).approvalStatus ?? "pending";
                  const { label, color } = approvalStatusLabel(approvalStatus);
                  const isBusy = approveMutation.isPending || rejectMutation.isPending || promoteMutation.isPending;
                  return (
                    <TableRow key={u.id} className="border-border/50 hover:bg-accent/30">
                      <TableCell className="pl-6 font-medium text-sm">
                        {u.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${color}`}>
                          {label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === "admin" ? "default" : "secondary"}
                          className={u.role === "admin"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs"
                            : "text-xs"}
                        >
                          {u.role === "admin" ? "Admin" : "Usuário"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Botões de aprovação */}
                          {approvalStatus === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                variant="outline"
                                onClick={() => approveMutation.mutate({ userId: u.id })}
                                disabled={isBusy}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                                variant="outline"
                                onClick={() => rejectMutation.mutate({ userId: u.id })}
                                disabled={isBusy}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Rejeitar
                              </Button>
                            </>
                          )}
                          {approvalStatus === "rejected" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                              variant="outline"
                              onClick={() => approveMutation.mutate({ userId: u.id })}
                              disabled={isBusy}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Aprovar
                            </Button>
                          )}
                          {approvalStatus === "approved" && u.role !== "admin" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-border/50 hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30"
                                onClick={() => promoteMutation.mutate({ userId: u.id })}
                                disabled={isBusy}
                              >
                                <Crown className="h-3 w-3 mr-1" />
                                Admin
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                                variant="outline"
                                onClick={() => rejectMutation.mutate({ userId: u.id })}
                                disabled={isBusy}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Revogar
                              </Button>
                            </>
                          )}
                          {u.role === "admin" && (
                            <span className="text-xs text-muted-foreground italic">Admin</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { 
  UserPlus, 
  Trash2, 
  Users as UsersIcon,
  Building2,
  Shield,
  BarChart3,
  Pencil,
  Key,
  Search,
  CheckCircle2,
  XCircle,
  MoreHorizontal
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import type { Client } from "@shared/schema";

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  clientId: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
}

const createUserSchema = z.object({
  email: z.string().email("Valid email required"),
  name: z.string().optional(),
  role: z.enum(["client", "analyst"]),
  clientId: z.string().optional(),
});

const editUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(["client", "analyst", "admin"]),
  clientId: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function UsersPage() {
  const { t, language } = useI18n();
  const { user: currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserInfo | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserInfo | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data: users = [], isLoading: usersLoading } = useQuery<UserInfo[]>({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchQuery || 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      name: "",
      role: "client",
      clientId: "",
    },
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      role: "client",
      clientId: "",
      status: "active",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserForm) => 
      apiRequest("POST", "/api/users", {
        ...data,
        clientId: data.role === "client" ? data.clientId : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateOpen(false);
      createForm.reset();
      toast({
        title: language === "fr" ? "Utilisateur créé" : "User Created",
        description: language === "fr" ? "Le compte utilisateur a été créé avec succès." : "The user account has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error") || "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: EditUserForm & { id: string }) => 
      apiRequest("PATCH", `/api/users/${data.id}`, {
        name: data.name,
        role: data.role,
        clientId: data.role === "client" ? data.clientId : null,
        status: data.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditUser(null);
      toast({
        title: language === "fr" ? "Utilisateur modifié" : "User Updated",
        description: language === "fr" ? "Les modifications ont été enregistrées." : "Changes have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error") || "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: { id: string; password: string }) => 
      apiRequest("POST", `/api/users/${data.id}/reset-password`, { password: data.password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setResetPasswordUser(null);
      resetPasswordForm.reset();
      toast({
        title: language === "fr" ? "Mot de passe réinitialisé" : "Password Reset",
        description: language === "fr" ? "Le nouveau mot de passe a été défini." : "The new password has been set.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error") || "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => 
      apiRequest("DELETE", `/api/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteUserId(null);
      toast({
        title: language === "fr" ? "Utilisateur supprimé" : "User Deleted",
        description: language === "fr" ? "Le compte utilisateur a été supprimé." : "The user account has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error") || "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (data: { id: string; status: string }) => 
      apiRequest("PATCH", `/api/users/${data.id}`, { status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: language === "fr" ? "Statut modifié" : "Status Updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error") || "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const watchedCreateRole = createForm.watch("role");
  const watchedEditRole = editForm.watch("role");

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return { label: "Admin", variant: "default" as const, icon: Shield };
      case "analyst":
        return { label: language === "fr" ? "Analyste" : "Analyst", variant: "secondary" as const, icon: BarChart3 };
      case "client":
        return { label: "Client", variant: "outline" as const, icon: Building2 };
      default:
        return { label: role, variant: "outline" as const, icon: UsersIcon };
    }
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.name || "Unknown Client";
  };

  const formatLastLogin = (lastLoginAt: string | null) => {
    if (!lastLoginAt) return language === "fr" ? "Jamais" : "Never";
    try {
      return format(new Date(lastLoginAt), "dd MMM yyyy HH:mm");
    } catch {
      return "-";
    }
  };

  const openEditDialog = (user: UserInfo) => {
    setEditUser(user);
    editForm.reset({
      name: user.name || "",
      role: user.role as "client" | "analyst" | "admin",
      clientId: user.clientId || "",
      status: (user.status || "active") as "active" | "inactive",
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">
              {language === "fr" ? "Accès refusé" : "Access Denied"}
            </h2>
            <p className="text-muted-foreground">
              {language === "fr" ? "Seuls les administrateurs peuvent gérer les comptes utilisateurs." : "Only administrators can manage user accounts."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (usersLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-users-title">
            {language === "fr" ? "Gestion des utilisateurs" : "User Management"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "fr" ? "Créez et gérez les comptes utilisateurs" : "Create and manage user accounts"}
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-user">
          <UserPlus className="w-4 h-4 mr-2" />
          {language === "fr" ? "Créer utilisateur" : "Create User"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base">{language === "fr" ? "Tous les utilisateurs" : "All Users"}</CardTitle>
              <CardDescription>
                {filteredUsers.length} {language === "fr" ? "utilisateurs" : "users"} 
                {filteredUsers.length !== users.length && ` (${users.length} ${language === "fr" ? "au total" : "total"})`}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={language === "fr" ? "Rechercher..." : "Search..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="input-search-users"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-32" data-testid="select-role-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "fr" ? "Tous" : "All"}</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="analyst">{language === "fr" ? "Analyste" : "Analyst"}</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {language === "fr" ? "Aucun utilisateur trouvé" : "No users found"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "fr" ? "Courriel" : "Email"}</TableHead>
                    <TableHead>{language === "fr" ? "Nom" : "Name"}</TableHead>
                    <TableHead>{language === "fr" ? "Rôle" : "Role"}</TableHead>
                    <TableHead>{language === "fr" ? "Statut" : "Status"}</TableHead>
                    <TableHead>{language === "fr" ? "Client" : "Client"}</TableHead>
                    <TableHead>{language === "fr" ? "Dernière connexion" : "Last Login"}</TableHead>
                    <TableHead className="w-[80px]">{language === "fr" ? "Actions" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => {
                    const roleBadge = getRoleBadge(user.role);
                    const RoleIcon = roleBadge.icon;
                    const isCurrentUser = user.id === currentUser?.id;
                    const isActive = user.status !== "inactive";

                    return (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`} className={!isActive ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={roleBadge.variant}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {roleBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {language === "fr" ? "Actif" : "Active"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              <XCircle className="w-3 h-3 mr-1" />
                              {language === "fr" ? "Inactif" : "Inactive"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.clientId ? (
                            <span className="text-sm">{getClientName(user.clientId)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLastLogin(user.lastLoginAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-user-actions-${user.id}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(user)} data-testid={`button-edit-user-${user.id}`}>
                                <Pencil className="w-4 h-4 mr-2" />
                                {language === "fr" ? "Modifier" : "Edit"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setResetPasswordUser(user)} data-testid={`button-reset-password-${user.id}`}>
                                <Key className="w-4 h-4 mr-2" />
                                {language === "fr" ? "Réinitialiser mot de passe" : "Reset Password"}
                              </DropdownMenuItem>
                              {!isCurrentUser && user.role !== "admin" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => toggleStatusMutation.mutate({ 
                                      id: user.id, 
                                      status: isActive ? "inactive" : "active" 
                                    })}
                                  >
                                    {isActive ? (
                                      <>
                                        <XCircle className="w-4 h-4 mr-2" />
                                        {language === "fr" ? "Désactiver" : "Deactivate"}
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        {language === "fr" ? "Activer" : "Activate"}
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => setDeleteUserId(user.id)}
                                    className="text-destructive focus:text-destructive"
                                    data-testid={`button-delete-user-${user.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    {language === "fr" ? "Supprimer" : "Delete"}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Créer utilisateur" : "Create User"}</DialogTitle>
            <DialogDescription>
              {language === "fr" 
                ? "Un mot de passe temporaire sera généré automatiquement et envoyé par courriel." 
                : "A temporary password will be auto-generated and sent by email."}
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Courriel" : "Email"}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@example.com" {...field} data-testid="input-user-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                            <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Nom" : "Name"} ({language === "fr" ? "optionnel" : "optional"})</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-user-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Rôle" : "Role"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="analyst">
                          <span className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            {language === "fr" ? "Analyste" : "Analyst"}
                          </span>
                        </SelectItem>
                        <SelectItem value="client">
                          <span className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Client
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchedCreateRole === "client" && (
                <FormField
                  control={createForm.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Client associé" : "Linked Client"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-client">
                            <SelectValue placeholder={language === "fr" ? "Sélectionner client" : "Select client"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-user">
                  {createMutation.isPending ? (language === "fr" ? "Création..." : "Creating...") : (language === "fr" ? "Créer" : "Create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Modifier utilisateur" : "Edit User"}</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(data => editUser && editMutation.mutate({ ...data, id: editUser.id }))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Nom" : "Name"}</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-edit-user-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Rôle" : "Role"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={editUser?.id === currentUser?.id}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-user-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">
                          <span className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Admin
                          </span>
                        </SelectItem>
                        <SelectItem value="analyst">
                          <span className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            {language === "fr" ? "Analyste" : "Analyst"}
                          </span>
                        </SelectItem>
                        <SelectItem value="client">
                          <span className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Client
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchedEditRole === "client" && (
                <FormField
                  control={editForm.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === "fr" ? "Client associé" : "Linked Client"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-user-client">
                            <SelectValue placeholder={language === "fr" ? "Sélectionner client" : "Select client"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{language === "fr" ? "Compte actif" : "Active Account"}</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Les comptes inactifs ne peuvent pas se connecter" : "Inactive accounts cannot log in"}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === "active"}
                        onCheckedChange={(checked) => field.onChange(checked ? "active" : "inactive")}
                        disabled={editUser?.id === currentUser?.id}
                        data-testid="switch-edit-user-status"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button type="submit" disabled={editMutation.isPending} data-testid="button-save-user">
                  {editMutation.isPending ? (language === "fr" ? "Enregistrement..." : "Saving...") : (language === "fr" ? "Enregistrer" : "Save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={() => setResetPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "fr" ? "Réinitialiser le mot de passe" : "Reset Password"}</DialogTitle>
            <DialogDescription>{resetPasswordUser?.email}</DialogDescription>
          </DialogHeader>
          <Form {...resetPasswordForm}>
            <form onSubmit={resetPasswordForm.handleSubmit(data => resetPasswordUser && resetPasswordMutation.mutate({ id: resetPasswordUser.id, password: data.password }))} className="space-y-4">
              <FormField
                control={resetPasswordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Nouveau mot de passe" : "New Password"}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={language === "fr" ? "Minimum 8 caractères" : "Minimum 8 characters"} {...field} data-testid="input-new-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={resetPasswordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "fr" ? "Confirmer le mot de passe" : "Confirm Password"}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={language === "fr" ? "Retapez le mot de passe" : "Re-enter password"} {...field} data-testid="input-confirm-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetPasswordUser(null)}>
                  {language === "fr" ? "Annuler" : "Cancel"}
                </Button>
                <Button type="submit" disabled={resetPasswordMutation.isPending} data-testid="button-reset-password">
                  {resetPasswordMutation.isPending ? (language === "fr" ? "Réinitialisation..." : "Resetting...") : (language === "fr" ? "Réinitialiser" : "Reset")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === "fr" ? "Supprimer l'utilisateur" : "Delete User"}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === "fr" 
                ? "Êtes-vous sûr de vouloir supprimer cet utilisateur? Cette action est irréversible." 
                : "Are you sure you want to delete this user? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-user"
            >
              {deleteMutation.isPending ? (language === "fr" ? "Suppression..." : "Deleting...") : (language === "fr" ? "Supprimer" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

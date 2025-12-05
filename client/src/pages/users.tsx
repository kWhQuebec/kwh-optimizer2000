import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  UserPlus, 
  Trash2, 
  Users as UsersIcon,
  Building2,
  Shield,
  BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  clientId: string | null;
  createdAt: string | null;
}

const createUserSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
  role: z.enum(["client", "analyst"]),
  clientId: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function UsersPage() {
  const { t } = useI18n();
  const { user: currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserInfo[]>({
    queryKey: ["/api/users"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      role: "client",
      clientId: "",
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
      form.reset();
      toast({
        title: t("users.userCreated") || "User Created",
        description: t("users.userCreatedDesc") || "The user account has been created successfully.",
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
        title: t("users.userDeleted") || "User Deleted",
        description: t("users.userDeletedDesc") || "The user account has been removed.",
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

  const watchedRole = form.watch("role");

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return { label: "Admin", variant: "default" as const, icon: Shield };
      case "analyst":
        return { label: "Analyst", variant: "secondary" as const, icon: BarChart3 };
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

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">
              {t("users.accessDenied") || "Access Denied"}
            </h2>
            <p className="text-muted-foreground">
              {t("users.adminOnly") || "Only administrators can manage user accounts."}
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
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-users-title">
            {t("users.title") || "User Management"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("users.subtitle") || "Create and manage user accounts for staff and clients"}
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-user">
          <UserPlus className="w-4 h-4 mr-2" />
          {t("users.createUser") || "Create User"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.allUsers") || "All Users"}</CardTitle>
          <CardDescription>
            {users.length} {t("users.usersCount") || "users total"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t("users.noUsers") || "No users found"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("users.email") || "Email"}</TableHead>
                  <TableHead>{t("users.name") || "Name"}</TableHead>
                  <TableHead>{t("users.role") || "Role"}</TableHead>
                  <TableHead>{t("users.client") || "Client"}</TableHead>
                  <TableHead className="w-[100px]">{t("common.actions") || "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const roleBadge = getRoleBadge(user.role);
                  const RoleIcon = roleBadge.icon;
                  const isCurrentUser = user.id === currentUser?.id;

                  return (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadge.variant}>
                          <RoleIcon className="w-3 h-3 mr-1" />
                          {roleBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.clientId ? (
                          <span className="text-sm">
                            {getClientName(user.clientId)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isCurrentUser && user.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteUserId(user.id)}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.createUser") || "Create User"}</DialogTitle>
            <DialogDescription>
              {t("users.createUserDesc") || "Create a new user account for staff or client access."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.email") || "Email"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="user@example.com" 
                        {...field} 
                        data-testid="input-user-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.password") || "Password"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Minimum 8 characters" 
                        {...field}
                        data-testid="input-user-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.name") || "Name"} ({t("common.optional") || "optional"})</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="John Doe" 
                        {...field}
                        data-testid="input-user-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.role") || "Role"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="client">
                          <span className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Client
                          </span>
                        </SelectItem>
                        <SelectItem value="analyst">
                          <span className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Analyst
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedRole === "client" && (
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("users.linkedClient") || "Linked Client"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-client">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
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
                  {t("common.cancel") || "Cancel"}
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-user">
                  {createMutation.isPending 
                    ? (t("common.creating") || "Creating...") 
                    : (t("users.createUser") || "Create User")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("users.deleteUser") || "Delete User"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("users.deleteUserConfirm") || "Are you sure you want to delete this user? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-user"
            >
              {deleteMutation.isPending 
                ? (t("common.deleting") || "Deleting...") 
                : (t("common.delete") || "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHeader } from "@/pages/admin/AdminLayout";
import { useMe } from "@/context/MeContext";
import { errMsg, useApi } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const ROLE_LABEL = { admin: "Admin", delivery: "Delivery partner", customer: "Customer" };

export default function AdminUsers() {
  const api = useApi();
  const { me, refresh } = useMe();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get("/users").then((r) => setData(r.data)).catch(() => setData({ roles: [], users: [] }));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (user, role) => {
    try {
      await api.patch(`/users/${user.user_id}/role`, { role });
      toast.success(`${user.email || "User"} is now ${ROLE_LABEL[role] || role}`);
      load();
      if (user.user_id === me?.user_id) refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div data-testid="admin-users">
      <AdminHeader title="Users & roles" subtitle="Everyone who has signed in. New accounts start as customers." />
      <div className="bg-white border rounded-xl overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted"><TableRow><TableHead>User</TableHead><TableHead>Joined</TableHead><TableHead className="w-56">Role</TableHead></TableRow></TableHeader>
          <TableBody>
            {data === null ? <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow> :
              data.users.map((u) => (
                <TableRow key={u.user_id} data-testid={`user-row-${u.user_id}`}>
                  <TableCell><p className="text-sm font-medium">{u.name || u.email || "—"}</p><p className="text-xs text-muted-foreground">{u.email}</p></TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(u.created_at)}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(r) => change(u, r)}>
                      <SelectTrigger className="h-8 bg-white" data-testid={`user-role-select-${u.user_id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{data.roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r] || r}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

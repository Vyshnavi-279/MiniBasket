import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminHeader } from "@/pages/admin/AdminLayout";
import { errMsg, useApi } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const APP_STATUS = {
  pending: "bg-[#fff8e1] text-[#b45309]",
  approved: "bg-[#e8f5e9] text-[#1b5e20]",
  rejected: "bg-[#ffebee] text-[#b71c1c]",
};

export default function AdminRiders() {
  const api = useApi();
  const [apps, setApps] = useState(null);
  const [riders, setRiders] = useState([]);

  const load = useCallback(() => {
    api.get("/admin/applications").then((r) => setApps(r.data)).catch(() => setApps([]));
    api.get("/admin/riders").then((r) => setRiders(r.data)).catch(() => {});
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (app, action) => {
    let body = {};
    if (action === "reject") {
      const note = window.prompt("Reason for rejection (shown to the applicant, optional):", "");
      if (note === null) return;
      body = { note };
    }
    try {
      await api.post(`/admin/applications/${app.id}/${action}`, body);
      toast.success(action === "approve" ? `${app.full_name} is now a delivery partner` : "Application rejected");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div data-testid="admin-riders" className="space-y-8">
      <div>
        <AdminHeader title="Delivery partner applications" subtitle="Applicants get no access to orders until you approve them." />
        <div className="bg-white border rounded-xl overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted"><TableRow><TableHead>Applicant</TableHead><TableHead>Vehicle</TableHead><TableHead>Area</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {apps === null ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow> :
                apps.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground" data-testid="applications-empty">No applications yet. Riders apply from the “Become a partner” page.</TableCell></TableRow> :
                apps.map((a) => (
                  <TableRow key={a.id} data-testid={`application-row-${a.id}`}>
                    <TableCell><p className="text-sm font-medium">{a.full_name}</p><p className="text-xs text-muted-foreground">{a.phone} · {a.email}</p></TableCell>
                    <TableCell className="text-sm whitespace-nowrap capitalize">{a.vehicle_type} · {a.vehicle_number}</TableCell>
                    <TableCell className="text-sm">{a.area}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(a.submitted_at)}</TableCell>
                    <TableCell><span className={`text-xs rounded-full px-2.5 py-0.5 capitalize ${APP_STATUS[a.status]}`} data-testid={`application-status-${a.id}`}>{a.status}</span></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {a.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" className="h-8" data-testid={`approve-application-${a.id}`} onClick={() => review(a, "approve")}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                          <Button size="sm" variant="outline" className="h-8" data-testid={`reject-application-${a.id}`} onClick={() => review(a, "reject")}><X className="h-4 w-4 mr-1" /> Reject</Button>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">Reviewed {fmtDate(a.reviewed_at)}</span>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div>
        <AdminHeader title="Active delivery partners" subtitle={`${riders.length} approved`} />
        <div className="bg-white border rounded-xl overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted"><TableRow><TableHead>Partner</TableHead><TableHead>Vehicle</TableHead><TableHead>Area</TableHead><TableHead className="text-right">Active orders</TableHead><TableHead className="text-right">Delivered</TableHead></TableRow></TableHeader>
            <TableBody>
              {riders.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground" data-testid="riders-empty">No approved partners yet.</TableCell></TableRow> :
                riders.map((r) => (
                  <TableRow key={r.user_id} data-testid={`rider-row-${r.user_id}`}>
                    <TableCell><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.profile.phone || ""} {r.email}</p></TableCell>
                    <TableCell className="text-sm capitalize whitespace-nowrap">{r.profile.vehicle_type ? `${r.profile.vehicle_type} · ${r.profile.vehicle_number}` : "—"}</TableCell>
                    <TableCell className="text-sm">{r.profile.area || "—"}</TableCell>
                    <TableCell className="text-right tnum">{r.active_orders}</TableCell>
                    <TableCell className="text-right tnum">{r.delivered_orders}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

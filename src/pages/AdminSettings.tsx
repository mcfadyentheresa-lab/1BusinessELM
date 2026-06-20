import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Building2, Users, MessageSquare, Zap, Key, Plus, Loader2, Mail, Phone, UserCircle, Trash2, Shield, Copy, Check, Camera } from "lucide-react";

export default function AdminSettings() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("crew");
  const [inviteSending, setInviteSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadUserId = useRef<string | null>(null);

  const handleAvatarClick = (userId: string) => {
    pendingUploadUserId.current = userId;
    avatarInputRef.current?.click();
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const userId = pendingUploadUserId.current;
    e.target.value = "";
    if (!file || !userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 5 MB.", variant: "destructive" });
      return;
    }
    setUploadingFor(userId);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `avatars/${userId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("project-assets")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
      if (dbErr) throw dbErr;
      toast({ title: "Photo updated" });
      qc.invalidateQueries({ queryKey: ["all-users"] });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploadingFor(null);
  };

  const { data: tenantSettings, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("tenant_settings").select("*").maybeSingle();
      return data;
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email, role, created_at, phone, avatar_url")
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: featureFlags } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const { data } = await supabase.from("feature_flags").select("*").order("key");
      return data ?? [];
    },
  });

  const { data: clientInvites } = useQuery({
    queryKey: ["client-invites"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_invites")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [brandName, setBrandName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  const handleSaveTenant = async () => {
    setSaving(true);
    try {
      const payload = {
        brand_name: brandName || tenantSettings?.brand_name,
        support_email: supportEmail || tenantSettings?.support_email,
      };
      const existing = tenantSettings?.id;
      if (existing) {
        await supabase.from("tenant_settings").update(payload).eq("id", existing);
      } else {
        await supabase.from("tenant_settings").insert(payload);
      }
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast({ title: "Settings saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleToggleFlag = async (flagId: number, enabled: boolean) => {
    await supabase.from("feature_flags").update({ enabled }).eq("id", flagId);
    qc.invalidateQueries({ queryKey: ["feature-flags"] });
  };

  const handleSendInvite = async () => {
    if (!inviteEmail) return;
    setInviteSending(true);
    try {
      const token = crypto.randomUUID();
      await supabase.from("client_invites").insert({
        email: inviteEmail,
        token,
        role: inviteRole,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      qc.invalidateQueries({ queryKey: ["client-invites"] });
      const inviteLink = `${window.location.origin}/accept-invite/${token}`;
      await navigator.clipboard.writeText(inviteLink).catch(() => {});
      toast({ title: "Invite created", description: "Invite link copied to clipboard." });
      setInviteEmail("");
      setInviteOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setInviteSending(false);
  };

  const handleCopyInviteLink = async (token: string, id: string) => {
    const inviteLink = `${window.location.origin}/accept-invite/${token}`;
    await navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-amber-100 text-amber-800",
    crew: "bg-blue-100 text-blue-800",
    client: "bg-green-100 text-green-800",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Studio configuration and administration</p>
      </div>

      <Tabs defaultValue="company">
        <TabsList className="mb-6">
          <TabsTrigger value="company" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Company</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Users</TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Features</TabsTrigger>
        </TabsList>

        {/* Hidden file input shared across all rows */}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarFile}
        />

        {/* Company Profile */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Identity</CardTitle>
              <CardDescription>Your studio's name and contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenantLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Brand Name</Label>
                      <Input
                        defaultValue={tenantSettings?.brand_name ?? ""}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="Aster & Spruce Living"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Support Email</Label>
                      <Input
                        type="email"
                        defaultValue={tenantSettings?.support_email ?? ""}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder="hello@asterandspruce.com"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSaveTenant} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="h-4 w-4" /> Integrations</CardTitle>
              <CardDescription>API keys are managed as environment secrets via the project settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Contact your system administrator to configure third-party integrations such as SMS or email providers.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Team Members</h2>
              <p className="text-sm text-muted-foreground">{(users ?? []).length} total members</p>
            </div>
            <Button className="gap-2" onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" /> Invite member
            </Button>
          </div>

          {usersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Member</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Role</th>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(users ?? []).map((u: any) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleAvatarClick(u.id)}
                            className="relative group h-8 w-8 shrink-0 rounded-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Upload photo"
                          >
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                {u.name?.[0]?.toUpperCase() ?? u.email[0].toUpperCase()}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {uploadingFor === u.id ? (
                                <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                              ) : (
                                <Camera className="h-3.5 w-3.5 text-white" />
                              )}
                            </div>
                          </button>
                          <span className="font-medium text-foreground">{u.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending invites */}
          {(clientInvites ?? []).filter((i: any) => i.status === "pending").length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Pending Invites</h3>
              <div className="space-y-2">
                {(clientInvites ?? [])
                  .filter((i: any) => i.status === "pending")
                  .map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{inv.email}</p>
                          <p className="text-xs text-muted-foreground capitalize">{inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                        <button
                          onClick={() => handleCopyInviteLink(inv.token, inv.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Copy invite link"
                        >
                          {copiedId === inv.id ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                          {copiedId === inv.id ? "Copied" : "Copy link"}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Feature Flags */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Feature Flags</CardTitle>
              <CardDescription>Toggle experimental and optional features</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {(featureFlags ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No feature flags configured</p>
              ) : (
                (featureFlags ?? []).map((flag: any) => (
                  <div key={flag.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium text-foreground font-mono">{flag.key}</p>
                      {flag.description && <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>}
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(v) => handleToggleFlag(flag.id, v)}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex gap-2">
                {["crew", "client", "admin"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setInviteRole(r)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                      inviteRole === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button className="flex-1 gap-2" onClick={handleSendInvite} disabled={inviteSending || !inviteEmail}>
                {inviteSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send invite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { initials } from "@/lib/utils";
import { Loader2, Save, Lock, Camera } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "At least one uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "At least one number", test: (p: string) => /\d/.test(p) },
];

export default function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(pwNew)).length;
  const allRulesMet = passwordStrength === PASSWORD_RULES.length;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ name, phone }).eq("id", user.id);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
    setSaving(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 5 MB.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `avatars/${user.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("project-assets").upload(path, file, { upsert: true });
    if (upErr) {
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("project-assets").getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
    if (dbErr) {
      toast({ title: "Failed to save avatar", description: dbErr.message, variant: "destructive" });
    } else {
      toast({ title: "Avatar updated" });
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
    setUploadingAvatar(false);
  };

  const handlePasswordChange = async () => {
    if (!allRulesMet) {
      toast({ title: "Password doesn't meet requirements", variant: "destructive" });
      return;
    }
    if (pwNew !== pwConfirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated" });
      setPwNew(""); setPwConfirm("");
    }
    setSavingPw(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-6" style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.025em" }}>
        Profile
      </h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Update your name, contact details, and avatar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg">{user ? initials(user.name) : "?"}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Change avatar"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-medium text-foreground">{user?.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{user?.role}</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="text-xs text-primary hover:underline mt-0.5"
              >
                Change photo
              </button>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (705) 555-0100" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted/50" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Change password</CardTitle>
          <CardDescription>Choose a strong password for your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>New password</Label>
            <Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="New password" />
            {pwNew.length > 0 && (
              <ul className="space-y-1 mt-2">
                {PASSWORD_RULES.map((rule) => (
                  <li key={rule.label} className={`text-xs flex items-center gap-1.5 ${rule.test(pwNew) ? "text-green-600" : "text-muted-foreground"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${rule.test(pwNew) ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                    {rule.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <Label>Confirm new password</Label>
            <Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
            {pwConfirm.length > 0 && pwNew !== pwConfirm && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
          <Button variant="outline" onClick={handlePasswordChange} disabled={savingPw || !pwNew || !pwConfirm} className="gap-2">
            {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from 'sonner';
import { db } from '../lib/db';
import { isCloudFirstEnabled } from '../lib/cloudRepository';
import { ShiftAttendanceCard } from '../components/attendance/ShiftAttendanceCard';

export default function Profile() {
  const { user } = useAuth();
  const cloudFirst = isCloudFirstEnabled();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user]);

  const handleSaveChanges = async () => {
    if (!user) return;

    if (cloudFirst) {
      toast.error("Profile updates are not available yet", {
        description: "Your account is managed by secure cloud authentication. Contact an administrator to change your name or password.",
      });
      return;
    }

    try {
      const dataToUpdate: any = { name };
      if (password) {
        const { derivePasswordHash } = await import('../lib/authCrypto');
        const derived = await derivePasswordHash(password);
        dataToUpdate.passwordHash = derived.hash;
        dataToUpdate.salt = derived.salt;
        dataToUpdate.iterations = derived.iterations;
      }

      await db.users.update(user.id, dataToUpdate);

      toast.success("Profile Updated", {
        description: "Your changes have been saved successfully.",
      });
      window.location.reload();
    } catch {
      toast.error("Error updating profile.");
    }
  };

  if (!user) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Loading...</div></AppLayout>;
  }

  return (
    <AppLayout title="Profile">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal account settings.
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <h2 className="text-xl font-headline font-semibold">Shift & Attendance</h2>
            <p className="text-sm text-muted-foreground">
              Record punch-in, punch-out, and break times for today.
            </p>
          </div>
          <div className="lg:col-span-2">
            <ShiftAttendanceCard />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <h2 className="text-xl font-headline font-semibold">Personal Information</h2>
            <p className="text-sm text-muted-foreground">
              Update your personal information.
            </p>
          </div>
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>
                  {cloudFirst
                    ? "Cloud account changes are temporarily restricted until secure profile management is connected."
                    : "This information is private and will not be displayed publicly."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cloudFirst && (
                  <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    Name and password changes are disabled in cloud-first mode. This prevents changes from being saved only to this device.
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={cloudFirst} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email / Username</Label>
                  <Input id="email" type="email" value={user.email || user.id} readOnly className="bg-muted/50 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Change Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={cloudFirst ? "Managed by cloud authentication" : "Leave blank to keep current password"} disabled={cloudFirst} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Current Role</Label>
                  <Input id="role" value={user.role} readOnly className="bg-muted/50 cursor-not-allowed" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setName(user.name); setPassword(""); }}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={cloudFirst}>Save Changes</Button>
        </div>
      </div>
    </AppLayout>
  );
}

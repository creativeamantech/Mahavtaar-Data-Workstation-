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
import { ShiftAttendanceCard } from '../components/attendance/ShiftAttendanceCard';

export default function Profile() {
  const { user } = useAuth();
  
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) {
        setName(user.name);
    }
  }, [user]);

  const handleSaveChanges = async () => {
    if (user) {
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
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            toast.error("Error updating profile.");
        }
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
                      <CardDescription>This information is private and will not be displayed publicly.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="email">Email / Username</Label>
                          <Input id="email" type="email" value={user.email || user.id} readOnly className="bg-muted/50 cursor-not-allowed" />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="password">Change Password</Label>
                          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current password" />
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
          <Button onClick={handleSaveChanges}>Save Changes</Button>
        </div>
      </div>
    </AppLayout>
  );
}

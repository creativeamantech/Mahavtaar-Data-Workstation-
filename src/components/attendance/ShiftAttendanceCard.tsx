import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AttendanceLog } from '@/lib/db';
import { punchIn, punchOut, startBreak, endBreak } from '@/lib/repositories/attendanceRepository';
import { Clock, LogIn, LogOut, Coffee, Play, CheckCircle2 } from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

export function ShiftAttendanceCard() {
  const { user } = useAuth();
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');

  const todayLog = useLiveQuery(
    async () => {
      if (!user) return undefined;
      const logs = await db.attendance_logs.where('userId').equals(user.id).toArray();
      return logs.find(l => l.date === todayDateStr);
    },
    [user, todayDateStr]
  );

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;

  const isPunchedIn = Boolean(todayLog?.loginTime);
  const isPunchedOut = Boolean(todayLog?.logoutTime);
  const isOnBreak = Boolean(todayLog?.currentBreakStart);

  const handlePunchIn = async () => {
    try {
      await punchIn(user.id, user.name, todayDateStr);
      toast.success('Punched in successfully for today!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to punch in');
    }
  };

  const handlePunchOut = async () => {
    if (!todayLog) return;
    try {
      if (isOnBreak) {
        await endBreak(todayLog.id);
      }
      await punchOut(todayLog.id);
      toast.success('Punched out successfully. Have a great day!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to punch out');
    }
  };

  const handleToggleBreak = async () => {
    if (!todayLog) return;
    try {
      if (isOnBreak) {
        await endBreak(todayLog.id);
        toast.success('Break ended. Resumed work session.');
      } else {
        await startBreak(todayLog.id);
        toast.info('Break started. Enjoy your break!');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update break status');
    }
  };

  // Compute live duration
  let elapsedMinutes = 0;
  if (todayLog?.loginTime) {
    const end = todayLog.logoutTime ? parseISO(todayLog.logoutTime) : currentTime;
    const total = differenceInMinutes(end, parseISO(todayLog.loginTime));
    let breaks = todayLog.breakDuration || 0;
    if (todayLog.currentBreakStart) {
      breaks += differenceInMinutes(currentTime, parseISO(todayLog.currentBreakStart));
    }
    elapsedMinutes = Math.max(0, total - breaks);
  }

  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Daily Shift & Attendance</CardTitle>
          </div>
          {isPunchedOut ? (
            <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> Shift Completed
            </Badge>
          ) : isOnBreak ? (
            <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-300">
              <Coffee className="h-3 w-3" /> On Break
            </Badge>
          ) : isPunchedIn ? (
            <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Active Duty
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Not Punched In
            </Badge>
          )}
        </div>
        <CardDescription>
          Record your daily work shift, break intervals, and active working hours.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-lg border border-border/50 text-xs">
          <div>
            <span className="text-muted-foreground block">Today's Date</span>
            <span className="font-semibold">{format(currentTime, 'MMM dd, yyyy')}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Punch In Time</span>
            <span className="font-semibold">
              {todayLog?.loginTime ? format(parseISO(todayLog.loginTime), 'hh:mm a') : '--:--'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Punch Out Time</span>
            <span className="font-semibold">
              {todayLog?.logoutTime ? format(parseISO(todayLog.logoutTime), 'hh:mm a') : '--:--'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Productive Time</span>
            <span className="font-bold text-primary">{hours}h {mins}m</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!isPunchedIn ? (
            <Button onClick={handlePunchIn} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <LogIn className="h-4 w-4" /> Punch In for Today
            </Button>
          ) : !isPunchedOut ? (
            <>
              <Button
                variant={isOnBreak ? 'default' : 'outline'}
                onClick={handleToggleBreak}
                className={isOnBreak ? 'gap-2 bg-amber-600 hover:bg-amber-700 text-white' : 'gap-2'}
              >
                {isOnBreak ? (
                  <>
                    <Play className="h-4 w-4" /> Resume Work
                  </>
                ) : (
                  <>
                    <Coffee className="h-4 w-4" /> Take Break
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                onClick={handlePunchOut}
                className="gap-2 ml-auto"
              >
                <LogOut className="h-4 w-4" /> Punch Out (End Shift)
              </Button>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Shift ended for today at {todayLog?.logoutTime && format(parseISO(todayLog.logoutTime), 'hh:mm a')}.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

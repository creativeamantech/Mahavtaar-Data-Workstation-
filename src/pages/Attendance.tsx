import React, { useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { DataTable } from '../components/ui/DataTable';
import { format, parseISO, differenceInMinutes, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Download, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { DateRange } from 'react-day-picker';
import Papa from 'papaparse';
import { ShiftAttendanceCard } from '../components/attendance/ShiftAttendanceCard';

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  loginTime: string;
  logoutTime?: string;
  breakDuration?: number;
  currentBreakStart?: string;
}

export default function Attendance() {
  const records = useLiveQuery(() => db.attendance_logs.toArray()) || [];
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchAgent, setSearchAgent] = useState('');

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
        if (searchAgent && !r.userName.toLowerCase().includes(searchAgent.toLowerCase())) {
            return false;
        }
        if (dateRange?.from) {
            const recordDate = parseISO(r.date);
            if (dateRange.to) {
              if (!isWithinInterval(recordDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) })) {
                return false;
              }
            } else {
                if (!isWithinInterval(recordDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.from) })) {
                    return false;
                }
            }
          }
        return true;
    });
  }, [records, dateRange, searchAgent]);

  const calculateDuration = (start?: string, end?: string) => {
    if (!start || !end) return "N/A";
    const minutes = differenceInMinutes(parseISO(end), parseISO(start));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateProductiveHours = (record: AttendanceRecord) => {
    if (!record.loginTime || !record.logoutTime) return { text: "N/A", deviation: false, minutes: 0 };
    const totalMinutes = differenceInMinutes(parseISO(record.logoutTime), parseISO(record.loginTime));
    let breakMinutes = record.breakDuration || 0;
    if (record.currentBreakStart) {
        const start = parseISO(record.currentBreakStart);
        breakMinutes += Math.round((new Date().getTime() - start.getTime()) / 60000);
    }
    const productiveMinutes = totalMinutes - breakMinutes;
    
    if (productiveMinutes < 0) return { text: "0h 0m", deviation: true, minutes: 0 };

    const hours = Math.floor(productiveMinutes / 60);
    const mins = productiveMinutes % 60;
    
    // 8 hours 15 mins working day
    const workDayMinutes = 8 * 60 + 15; 
    const deviation = productiveMinutes < workDayMinutes;

    return { text: `${hours}h ${mins}m`, deviation, minutes: productiveMinutes };
  };

  const columns = useMemo(() => [
    { key: 'userName', label: 'User', sortable: true },
    { key: 'date', label: 'Date', render: (val: string) => format(parseISO(val), "PPP"), sortable: true },
    { key: 'loginTime', label: 'Login Time', render: (val: string) => format(parseISO(val), "hh:mm a") },
    { key: 'logoutTime', label: 'Logout Time', render: (val: string) => val ? format(parseISO(val), "hh:mm a") : "N/A" },
    { key: 'totalHours', label: 'Total Hours', render: (_: any, row: AttendanceRecord) => calculateDuration(row.loginTime, row.logoutTime) },
    { 
       key: 'breakHours',
        label: 'Break Hours',
        render: (_: any, row: AttendanceRecord) => {
        let breakMinutes = row.breakDuration || 0;
        if (row.currentBreakStart) {
            const start = parseISO(row.currentBreakStart);
            breakMinutes += Math.round((new Date().getTime() - start.getTime()) / 60000);
        }
        const hours = Math.floor(breakMinutes / 60);
        const mins = Math.round(breakMinutes % 60);
        return `${hours}h ${mins}m`;
      }
    },
    {
      key: 'productiveHours',
      label: 'Productive Hours',
      render: (_: any, row: AttendanceRecord) => {
        const { text, deviation } = calculateProductiveHours(row);
        return (
          <div className="flex items-center gap-2">
            <span>{text}</span>
            {deviation && text !== "N/A" && <Badge variant="destructive">Deviation</Badge>}
          </div>
        );
      }
    }
  ], []);

  const handleExport = () => {
    if (filteredRecords.length === 0) return;
    
    const csv = Papa.unparse(filteredRecords.map(r => {
        const { text: productiveText, deviation } = calculateProductiveHours(r);
        return {
            'User': r.userName,
            'Date': format(parseISO(r.date), "yyyy-MM-dd"),
            'Login Time': format(parseISO(r.loginTime), "HH:mm"),
            'Logout Time': r.logoutTime ? format(parseISO(r.logoutTime), "HH:mm") : "N/A",
            'Total Hours': calculateDuration(r.loginTime, r.logoutTime),
            'Break (mins)': (r.breakDuration || 0) + (r.currentBreakStart ? Math.round((new Date().getTime() - parseISO(r.currentBreakStart).getTime()) / 60000) : 0),
            'Productive Hours': productiveText,
            'Deviation': deviation ? 'Yes' : 'No'
        }
    }));
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `attendance_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout title="Attendance Management">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold tracking-tight mb-2">Attendance Management</h1>
            <p className="text-muted-foreground">Track user login, logout, break intervals, and working hours.</p>
          </div>
        </div>

        <ShiftAttendanceCard />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
          <div>
            <h2 className="text-xl font-headline font-semibold">Attendance Log & Historical Shifts</h2>
            <p className="text-xs text-muted-foreground">Filter by user, date range, and export reports.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
             <Input 
                placeholder="Search Agent..." 
                value={searchAgent}
                onChange={e => setSearchAgent(e.target.value)}
                className="w-48"
             />
             <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn("w-[260px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                    {format(dateRange.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(dateRange.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Filter by Date Range</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>

            <Button onClick={handleExport} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" /> Export Data
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <DataTable columns={columns} data={filteredRecords} pageSize={25} />
        </div>
      </div>
    </AppLayout>
  );
}

import React, { useState } from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format as formatTZ, toZonedTime } from 'date-fns-tz';
import { parseISO, differenceInMinutes } from "date-fns";
import { useAuth } from "../../contexts/AuthContext";
import { db } from '../../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  loginTime: string;
  logoutTime?: string;
  breakDuration?: number;
  currentBreakStart?: string;
}

const IST_TIMEZONE = 'Asia/Kolkata';

const formatToIST = (dateStr?: string) => {
  if (!dateStr) return "-";
  try {
    const date = parseISO(dateStr);
    const zonedDate = toZonedTime(date, IST_TIMEZONE);
    return formatTZ(zonedDate, 'yyyy-MM-dd hh:mm a', { timeZone: IST_TIMEZONE });
  } catch {
    return dateStr;
  }
};

const calculateProductiveHours = (record: AttendanceRecord, breakMinutes: number) => {
  if (!record.loginTime) return { text: "N/A", deviation: false };
  try {
    const login = parseISO(record.loginTime);
    const logout = record.logoutTime ? parseISO(record.logoutTime) : new Date();
    const diffMins = differenceInMinutes(logout, login) - breakMinutes;
    if (diffMins < 0) return { text: "0h 0m", deviation: true };
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const deviation = hours < 8;
    return { text: `${hours}h ${mins}m`, deviation };
  } catch {
    return { text: "Error", deviation: false };
  }
};

export function AgentAttendanceTable() {
  const { user } = useAuth();
  const [sorting, setSorting] = useState<SortingState>([]);

  const agentAttendance = useLiveQuery(
    async () => {
      if (!user) return [];
      const records = await db.attendance_logs.where('userId').equals(user.id).reverse().sortBy('date');
      return records;
    },
    [user],
    []
  );

  const columns: ColumnDef<AttendanceRecord>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="p-0 hover:bg-transparent font-semibold"
          >
            Date
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        );
      },
      cell: ({ row }) => <span className="font-data font-medium">{row.getValue("date")}</span>,
    },
    {
      accessorKey: "loginTime",
      header: "Punch In (IST)",
      cell: ({ row }) => formatToIST(row.getValue("loginTime")),
    },
    {
      accessorKey: "logoutTime",
      header: "Punch Out (IST)",
      cell: ({ row }) => formatToIST(row.getValue("logoutTime")),
    },
    {
      id: "breakDuration",
      header: "Break Time",
      cell: ({ row }) => {
        let breakMinutes = row.original.breakDuration || 0;
        if (row.original.currentBreakStart) {
          const start = parseISO(row.original.currentBreakStart);
          breakMinutes += Math.round((new Date().getTime() - start.getTime()) / 60000);
        }
        const hours = Math.floor(breakMinutes / 60);
        const mins = Math.round(breakMinutes % 60);
        return `${hours}h ${mins}m`;
      },
    },
    {
      id: "productiveHours",
      header: "Productive Hours",
      cell: ({ row }) => {
        let breakMinutes = row.original.breakDuration || 0;
        if (row.original.currentBreakStart) {
          const start = parseISO(row.original.currentBreakStart);
          breakMinutes += Math.round((new Date().getTime() - start.getTime()) / 60000);
        }
        const { text, deviation } = calculateProductiveHours(row.original, breakMinutes);
        return (
          <div className="flex items-center gap-2">
            <span className="font-data">{text}</span>
            {deviation && text !== "N/A" && <Badge variant="destructive" className="text-[10px]">Deviation</Badge>}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: agentAttendance,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  if (user?.role !== 'EXECUTIVE') {
    return null;
  }

  return (
    <div className="w-full">
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No attendance records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

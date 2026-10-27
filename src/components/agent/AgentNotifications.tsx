import React, { useEffect, useState, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/badge';
import { Link } from 'react-router-dom';
import { format, isToday, isFuture, parseISO } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { db, CustomerFeedback } from '../../lib/db';

export function AgentNotifications() {
  const { records } = useData();
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);

  useEffect(() => {
      if (user) {
          db.customer_feedbacks.where('agentId').equals(user.id).toArray().then(fbs => {
              setFeedbacks(fbs);
          });
      }
  }, [user]);

  const notifications = useMemo(() => {
    if (!user || !records) return [];
    
    const agentFeedbacks = feedbacks;
    
    const ptpReminders = agentFeedbacks
      .filter(f => f.status === 'PTP' && f.ptpDate && (isToday(parseISO(f.ptpDate)) || isFuture(parseISO(f.ptpDate))))
      .map(f => ({
        type: 'PTP',
        feedback: f,
        customer: records.find((c: any) => c.agreementid === f.agreementid),
        date: f.ptpDate!,
      }));

    const cbReminders = agentFeedbacks
      .filter(f => f.status === 'CB' && f.cbDate && (isToday(parseISO(f.cbDate)) || isFuture(parseISO(f.cbDate))))
      .map(f => ({
        type: 'CB',
        feedback: f,
        customer: records.find((c: any) => c.agreementid === f.agreementid),
        date: f.cbDate!,
      }));
      
    return [...ptpReminders, ...cbReminders]
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  }, [feedbacks, records, user]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
             <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px]">
                {notifications.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Reminders</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-72">
            {notifications.length > 0 ? (
                notifications.map(({ type, feedback, customer, date }) => {
                  if (!customer) return null;
                  return (
                    <DropdownMenuItem key={feedback.id} asChild>
                        <Link to={`/customer/${customer?.agreementid}`} className="flex flex-col items-start gap-1 p-3 cursor-pointer">
                            <div className="flex justify-between w-full items-center">
                                <span className="font-semibold line-clamp-1">{customer?.customer_name || customer?.['Customer Name']}</span>
                                <Badge variant={type === 'PTP' ? 'default' : 'secondary'} className="ml-2">{type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {format(parseISO(date), "PPP 'at' p")}
                            </p>
                        </Link>
                    </DropdownMenuItem>
                  );
                })
            ) : (
                <p className="text-sm text-muted-foreground text-center p-4">No upcoming reminders.</p>
            )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

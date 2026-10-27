import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoanRecord, CustomerFeedback } from '../../lib/db';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface AgentLiveDetailsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    customers: LoanRecord[];
    feedbacks: CustomerFeedback[];
}

export function AgentLiveDetailsSheet({ open, onOpenChange, title, customers, feedbacks }: AgentLiveDetailsSheetProps) {
  
  const getLatestFeedback = (agreementId: string) => {
      const customerFeedbacks = feedbacks.filter(f => f.agreementid === agreementId);
      if (customerFeedbacks.length === 0) return null;
      return customerFeedbacks.sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime())[0];
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Showing {customers.length} customer(s) matching this criteria.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Agreement ID</TableHead>
                    <TableHead>Last Interaction</TableHead>
                    <TableHead className="text-right">Amount (POS)</TableHead>
                    <TableHead className="text-right"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {customers.map((customer, index) => {
                    const latestFeedback = getLatestFeedback(customer.agreementid);
                    const name = customer.customer_name || customer['Customer Name'] || 'Unknown';
                    const pos = Number(customer.principal_outstanding || 0);

                    return (
                        <TableRow key={`${customer.agreementid}-${index}`}>
                            <TableCell className="font-medium">{name}</TableCell>
                            <TableCell>{customer.agreementid}</TableCell>
                            <TableCell>
                                {latestFeedback ? (
                                    <div className="flex flex-col items-start">
                                        <Badge>{latestFeedback.status}</Badge>
                                        <span className="text-xs text-muted-foreground mt-1">
                                            {formatDistanceToNow(parseISO(latestFeedback.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                ) : <Badge variant="outline">N/A</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(pos)}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" asChild>
                                    <Link to={`/customer/${customer.agreementid}`}>
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    )
                })}
                 {customers.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            No customers to display.
                        </TableCell>
                    </TableRow>
                 )}
            </TableBody>
        </Table>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

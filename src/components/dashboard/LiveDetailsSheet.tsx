import React from 'react';
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
import { LoanRecord } from "@/lib/db";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, parseISO } from "date-fns";

interface LiveDetailsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    customers: LoanRecord[];
}

export function LiveDetailsSheet({ open, onOpenChange, title, customers }: LiveDetailsSheetProps) {

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl">
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
                    <TableHead>Assigned Agent</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {customers.map(customer => {
                    const agentName = customer.EXECUTIVE_NAME || customer.FOS_Name || customer['FOS Name'];
                    return (
                        <TableRow key={customer.agreementid}>
                            <TableCell className="font-medium">{customer.CUSTOMER_NAME || customer.Customer_Name || customer.customer_name || 'Unknown'}</TableCell>
                            <TableCell>{customer.agreementid}</TableCell>
                            <TableCell>
                                {agentName ? (
                                    <span className="text-xs">{agentName}</span>
                                ) : (
                                    <Badge variant="outline">Unassigned</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(customer.emi_amt || customer.EMI || 0)}
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
  )
}

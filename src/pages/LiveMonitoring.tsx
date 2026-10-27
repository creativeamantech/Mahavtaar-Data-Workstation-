import { useState, useMemo } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { db, CustomerFeedback, LoanRecord } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { isToday, parseISO, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MessageSquare, UserCheck, Users, IndianRupee, Activity, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from 'react-router-dom';
import { LiveDetailsSheet } from '@/components/dashboard/LiveDetailsSheet';
import { fmtCur } from '../lib/formatters';

interface AgentMetrics {
  name: string;
  feedbackCount: number;
  ptpCount: number;
  collectedAmount: number;
}

export default function LiveMonitoring() {
  const { records } = useData();
  const { users } = useAuth();
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [sheetData, setSheetData] = useState<{ title: string; customers: LoanRecord[] }>({ title: '', customers: [] });
  const [isSheetOpen, setSheetOpen] = useState(false);

  // Reactive live query to update automatically on new entries or P2P sync
  const feedbacks = useLiveQuery(
    async () => {
      const data = await db.customer_feedbacks.toArray();
      return data;
    },
    [],
    [] as CustomerFeedback[]
  );

  const filteredFeedbacks = useMemo(() => {
    if (!feedbacks) return [];
    if (dateFilter === 'today') {
      return feedbacks.filter(f => isToday(parseISO(f.createdAt)));
    }
    return feedbacks;
  }, [feedbacks, dateFilter]);

  const uniquePtpCustomers = useMemo(() => {
    const ptpFeedbacks = filteredFeedbacks.filter(f => f.status === 'PTP');
    const ptpAgreementIds = [...new Set(ptpFeedbacks.map(f => f.agreementid))];
    return ptpAgreementIds.map(id => records.find(c => c.agreementid === id)).filter(Boolean) as LoanRecord[];
  }, [filteredFeedbacks, records]);

  const uniquePtpAmount = useMemo(() => {
    return uniquePtpCustomers.reduce((sum, c) => sum + (Number(c.emi_amt || c.EMI) || 0), 0);
  }, [uniquePtpCustomers]);

  const uniquePaidCustomers = useMemo(() => {
    const paidFeedbacks = filteredFeedbacks.filter(f => f.status === 'Paid');
    const paidAgreementIds = [...new Set(paidFeedbacks.map(f => f.agreementid))];
    return paidAgreementIds.map(id => records.find(c => c.agreementid === id)).filter(Boolean) as LoanRecord[];
  }, [filteredFeedbacks, records]);

  const uniqueFeedbackCustomers = useMemo(() => {
    const fbAgreementIds = [...new Set(filteredFeedbacks.map(f => f.agreementid))];
    return fbAgreementIds.map(id => records.find(c => c.agreementid === id)).filter(Boolean) as LoanRecord[];
  }, [filteredFeedbacks, records]);

  const totalCollected = useMemo(() => {
    const paidFeedbacks = filteredFeedbacks.filter(f => f.status === 'Paid');
    return paidFeedbacks.reduce((sum, f) => sum + (Number(f.amountPaid) || 0), 0);
  }, [filteredFeedbacks]);

  const agentPerformance = useMemo(() => {
    const agentsMap: Record<string, AgentMetrics> = {};
    
    // Initialize map with all users who have the EXECUTIVE role
    users.filter(u => u.role === 'EXECUTIVE').forEach(u => {
      agentsMap[u.name] = { name: u.name, feedbackCount: 0, ptpCount: 0, collectedAmount: 0 };
    });

    filteredFeedbacks.forEach(f => {
      if (!agentsMap[f.agentName]) {
        agentsMap[f.agentName] = { name: f.agentName, feedbackCount: 0, ptpCount: 0, collectedAmount: 0 };
      }
      agentsMap[f.agentName].feedbackCount++;
      if (f.status === 'PTP') agentsMap[f.agentName].ptpCount++;
      if (f.status === 'Paid') agentsMap[f.agentName].collectedAmount += (Number(f.amountPaid) || 0);
    });
    return Object.values(agentsMap).sort((a, b) => b.feedbackCount - a.feedbackCount);
  }, [filteredFeedbacks, users]);

  const feedbackStatusData = useMemo(() => {
    const counts = filteredFeedbacks.reduce((acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const colors = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#9333ea', '#0891b2', '#be123c'];
    return Object.entries(counts).map(([name, value], i) => ({
      name, value, fill: colors[i % colors.length]
    }));
  }, [filteredFeedbacks]);

  const recentActivities = useMemo(() => {
    return [...filteredFeedbacks]
      .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime())
      .slice(0, 15);
  }, [filteredFeedbacks]);

  const handleCardClick = (title: string, customers: LoanRecord[]) => {
    setSheetData({ title, customers });
    setSheetOpen(true);
  };

  return (
    <AppLayout title="Live Monitoring">
      <div className="space-y-6">
        <LiveDetailsSheet 
          open={isSheetOpen}
          onOpenChange={setSheetOpen}
          title={sheetData.title}
          customers={sheetData.customers}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-headline font-bold tracking-tight">Live Monitoring</h1>
              <Badge variant="outline" className="gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-300 text-xs py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Stream
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Real-time overview of agent field productivity, PTP promises, and direct collections.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Time Window:</span>
            <select 
              className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'today' | 'all')}
            >
              <option value="today">Today's Shift</option>
              <option value="all">All-Time Cumulative</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:bg-muted/40 transition-colors border-border/80 shadow-sm" onClick={() => handleCardClick("Customers with Feedback", uniqueFeedbackCustomers)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Touchpoints Logged</CardTitle>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <MessageSquare className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-data text-foreground">{filteredFeedbacks.length.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Total feedback calls & visits</p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Executives</CardTitle>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-data text-foreground">{agentPerformance.filter(a => a.feedbackCount > 0).length} <span className="text-sm font-normal text-muted-foreground">/ {agentPerformance.length}</span></div>
              <p className="text-xs text-muted-foreground mt-1">Executives actively submitting</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/40 transition-colors border-border/80 shadow-sm" onClick={() => handleCardClick("Customers with PTP Status", uniquePtpCustomers)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PTP Exposure Pipeline</CardTitle>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <UserCheck className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-data text-amber-600 dark:text-amber-400">
                {fmtCur(uniquePtpAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{uniquePtpCustomers.length} commitments promised</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/40 transition-colors border-border/80 shadow-sm" onClick={() => handleCardClick("Customers with Paid Status", uniquePaidCustomers)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Collected</CardTitle>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-data text-emerald-600 dark:text-emerald-400">
                {fmtCur(totalCollected)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{uniquePaidCustomers.length} cases paid & verified</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4 border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Agent Productivity Volume
              </CardTitle>
              <CardDescription>Number of feedback entries logged per executive.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentPerformance.slice(0, 10)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  <Bar dataKey="feedbackCount" fill="#3b82f6" name="Feedback Count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 border-border/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Disposition Status Breakdown</CardTitle>
              <CardDescription>Proportions of call & field visit outcomes.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] flex items-center justify-center">
              {feedbackStatusData.length === 0 ? (
                <div className="text-xs text-muted-foreground">No disposition data logged yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Pie data={feedbackStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75}>
                      {feedbackStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-12">
          <Card className="md:col-span-7 border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Executive Performance Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Agent Name</TableHead>
                    <TableHead className="text-xs text-center">Touchpoints</TableHead>
                    <TableHead className="text-xs text-center">PTP Count</TableHead>
                    <TableHead className="text-xs text-right">Verified Collection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {agentPerformance.map(agent => (
                    <TableRow key={agent.name} className="hover:bg-muted/30">
                      <TableCell className="font-semibold">{agent.name}</TableCell>
                      <TableCell className="text-center font-data">{agent.feedbackCount}</TableCell>
                      <TableCell className="text-center font-data">{agent.ptpCount}</TableCell>
                      <TableCell className="text-right font-data font-bold text-emerald-600 dark:text-emerald-400">
                        {fmtCur(agent.collectedAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {agentPerformance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data available</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="md:col-span-5 border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Live Activity Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 pr-4">
                <div className="space-y-3">
                  {recentActivities.map(activity => (
                    <Link to={`/customer/${activity.agreementid}`} key={activity.id} className="block p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors shadow-xs">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-xs text-primary">{activity.agentName}</span>
                        <Badge variant="outline" className="text-[10px] font-semibold">{activity.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{activity.detailedFeedback || activity.overallDetailedFeedback || 'No additional remarks'}</p>
                      <div className="text-[10px] text-muted-foreground mt-2 text-right">
                        {formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true })}
                      </div>
                    </Link>
                  ))}
                  {recentActivities.length === 0 && (
                    <div className="text-center text-muted-foreground py-10 text-xs">No recent activities in this window</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}


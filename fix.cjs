const fs = require('fs');

const file = 'src/components/agent/AgentLiveDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const returnStatement = '  return (\n    <div className="space-y-6">';

const additions = `    const getCustomerName = (agreementid: string) => {
        return records.find(r => r.AGREEMENTID === agreementid)?.CUSTOMERNAME || agreementid;
    };

    const getCustomersFromFeedback = (fbs: CustomerFeedback[]) => {
        const ids = Array.from(new Set(fbs.map(f => f.agreementid)));
        return records.filter(r => ids.includes(r.AGREEMENTID));
    };

    const myRecords = records.filter(r => r.AGENT === user?.name || r.AGENT === user?.id);

    const feedbackToday = feedbacks.filter(f => isToday(parseISO(f.createdAt)));

    const ptpFeedbacks = feedbacks.filter(f => f.status === 'PTP');
    const ptpAgreementIds = Array.from(new Set(ptpFeedbacks.map(f => f.agreementid)));
    const uniquePtpCustomers = records.filter(r => ptpAgreementIds.includes(r.AGREEMENTID));
    const totalPTP = uniquePtpCustomers.reduce((sum, r) => sum + (r.POS || 0), 0);

    const paidFeedbacks = feedbacks.filter(f => f.status === 'Paid');
    const paidAgreementIds = Array.from(new Set(paidFeedbacks.map(f => f.agreementid)));
    const uniquePaidCustomers = records.filter(r => paidAgreementIds.includes(r.AGREEMENTID));
    const totalPaid = uniquePaidCustomers.reduce((sum, r) => sum + (r.POS || 0), 0);

    const contactedAgreementIds = Array.from(new Set(feedbacks.map(f => f.agreementid)));
    const notContactedCustomers = myRecords.filter(r => !contactedAgreementIds.includes(r.AGREEMENTID));

    const statusCounts = feedbacks.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const feedbackStatusData = Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
        fill: \`var(--color-\${name.toLowerCase().replace(/[^a-z0-9]/g, '')})\`
    }));

    const chartConfig = {
        value: { label: "Count" },
        ...Object.keys(statusCounts).reduce((acc, status, index) => {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];
            acc[status.toLowerCase().replace(/[^a-z0-9]/g, '')] = {
                label: status,
                color: colors[index % colors.length]
            };
            return acc;
        }, {} as Record<string, any>)
    };

    const recentActivities = [...feedbacks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

`;

if (content.includes(returnStatement)) {
    content = content.replace(returnStatement, additions + returnStatement);
    fs.writeFileSync(file, content);
    console.log("Fix applied");
} else {
    console.log("Could not find return statement");
}

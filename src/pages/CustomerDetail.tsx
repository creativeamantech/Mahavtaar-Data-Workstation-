import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { db, CustomerFeedback } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { fmtCur } from '../lib/formatters';
import { 
  ChevronLeft, ChevronRight, ArrowLeft, PhoneCall, Phone, MessageCircle, 
  MapPin, Calendar, Briefcase, CreditCard, Activity, Search,
  CheckCircle, XCircle, Clock, AlertTriangle, MessageSquare, Database, FileText, PlusCircle
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { FeedbackModal } from '../components/feedback/FeedbackModal';
import { getFeedbackByAgreementId } from '../lib/repositories/feedbackRepository';
import { isCloudFirstEnabled } from '../lib/cloudRepository';

const STANDARD_STATUSES = [
  "Paid", "PTP", "CB", "RTP", "RNR", "Non Contactable", 
  "Already settled", "Disputed Case", "Loan Closed", "Agent dispute", "Talked with third party"
];

const PAID_SUB_STATUSES = ["DAC", "ECS", "Special", "CASA", "Settlement"];
const NON_CONTACTABLE_REASONS = [
  "Switch off", "Not connected", "Incoming not available", 
  "Not in service", "Not exist", "Wrong number"
];

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { records } = useData();
  const { user } = useAuth();
  
  const localFeedbacks = useLiveQuery(
    async () => {
      if (isCloudFirstEnabled() || !id) return [];
      return db.customer_feedbacks.where('agreementid').equals(id).reverse().sortBy('createdAt');
    },
    [id],
    [] as CustomerFeedback[]
  );
  const [cloudFeedbacks, setCloudFeedbacks] = useState<CustomerFeedback[]>([]);
  useEffect(() => {
    if (!isCloudFirstEnabled() || !id) return;
    let active = true;
    getFeedbackByAgreementId(id)
      .then(rows => { if (active) setCloudFeedbacks(rows); })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Unable to load customer feedback.'));
    return () => { active = false; };
  }, [id]);
  const feedbacks = isCloudFirstEnabled() ? cloudFeedbacks : (localFeedbacks || []);

  
  
  
  const [otherPropsSearch, setOtherPropsSearch] = useState('');
  const [activeModalPhone, setActiveModalPhone] = useState<{ number: string; source: string; name?: string } | null>(null);

  const record = useMemo(() => records.find(r => r.agreementid === id), [records, id]);

  const { prevId, nextId, currentIndex, totalList } = useMemo(() => {
    try {
      const listStr = sessionStorage.getItem('currentCaseList');
      if (listStr) {
        const list = JSON.parse(listStr) as string[];
        const idx = list.indexOf(id || '');
        return {
          prevId: idx > 0 ? list[idx - 1] : null,
          nextId: idx < list.length - 1 ? list[idx + 1] : null,
          currentIndex: idx,
          totalList: list.length
        };
      }
    } catch { /* ignore */ }
    return { prevId: null, nextId: null, currentIndex: -1, totalList: 0 };
  }, [id]);

  const phones = useMemo(() => {
    if (!record) return [];
    const extracted: { number: string, source: string, name?: string }[] = [];
    
    const customerName = record.customer_name || record.CUSTOMERNAME || record['Customer Name'] || record.CUSTOMER_NAME || record.customername || 'Customer';

    Object.entries(record).forEach(([key, val]) => {
      const kLow = key.toLowerCase();
      // Skip CRN, Agreement, Loan IDs as they are often 10-12 digits but not phone numbers
      if (kLow.includes('crn') || kLow.includes('agreement') || kLow.includes('loan') || kLow.includes('pos')) return;

      const sVal = String(val).replace(/[^0-9]/g, '');
      if (sVal.length >= 10 && sVal.length <= 12) {
        
        let assocName = customerName;
        
        // If it's a reference or guarantor, try to find their specific name
        if (kLow.includes('ref') || kLow.includes('guar') || kLow.includes('relat')) {
          assocName = 'Reference';
          
          let num = '';
          const digitMatch = kLow.match(/\d+/);
          if (digitMatch) num = digitMatch[0];
          else if (kLow.includes('one')) num = 'one';
          else if (kLow.includes('two')) num = 'two';
          else if (kLow.includes('three')) num = 'three';
          else if (kLow.includes('first')) num = 'first';
          else if (kLow.includes('second')) num = 'second';
          
          const nameKey = Object.keys(record).find(k => {
            const kl = k.toLowerCase();
            if (kl === kLow) return false;
            return kl.includes('name') && 
                   (kl.includes('ref') || kl.includes('guar') || kl.includes('relat')) && 
                   (num ? kl.includes(num) : true);
          });
          
          if (nameKey && record[nameKey]) {
            assocName = String(record[nameKey]);
          } else {
            // Fallback: looking for a field without 'no'/'number'/'phone'
            const fallbackKey = Object.keys(record).find(k => {
              const kl = k.toLowerCase();
              if (kl === kLow) return false;
              const hasRef = kl.includes('ref') || kl.includes('guar') || kl.includes('relat');
              const hasNum = num ? kl.includes(num) : true;
              const isNotNumberField = !kl.includes('no') && !kl.includes('num') && !kl.includes('phone') && !kl.includes('mob');
              return hasRef && hasNum && isNotNumberField;
            });
            if (fallbackKey && record[fallbackKey]) {
              assocName = String(record[fallbackKey]);
            }
          }
        }

        if (!extracted.some(e => e.number === sVal)) {
          extracted.push({ number: sVal, source: key, name: assocName });
        }
      }
    });
    return extracted;
  }, [record]);



  if (!record) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold">Customer Not Found</h2>
          <button onClick={() => navigate(-1)} className="mt-4 text-primary hover:underline">Go Back</button>
        </div>
      </AppLayout>
    );
  }


  // Group properties
  const financialKeys = ['principal_outstanding', 'emi_amt', 'dac', 'ecs', 'Approx Forclosure', 'approx_forclosure', 'penal_pending', 'bcc_pending', 'New Total', 'new_total', 'Special', 'special', 'SPECIAL'];
  const assetKeys = ['ASSET_CATEGORY', 'Make', 'Model', 'Chassis Number', 'Engine Number', 'Manufacturer'];
  const personalKeys = ['customer_name', 'Customer Name', 'CUSTOMERNAME', 'Father Name', 'DOB', 'Age', 'Employer', 'Designation', 'state', 'city', 'Address', 'Pincode', 'reference1_Name', 'reference2_name', 'Supplier', 'Fos Name', 'FOS Name', 'Mailing Address', 'Mailing Landmark', 'SO Name', 'SO Code', 'RO Name', 'RO Code'];
  const opsKeys = ['executive_name', 'Executive Name', 'bom_bkt', 'Allocation Date'];

  const otherProps = Object.entries(record).filter(([k, v]) => 
    !financialKeys.some(fk => k.toLowerCase().includes(fk.toLowerCase())) &&
    !assetKeys.some(ak => k.toLowerCase().includes(ak.toLowerCase())) &&
    !personalKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase())) &&
    !opsKeys.some(ok => k.toLowerCase().includes(ok.toLowerCase())) &&
    k !== 'agreementid' && k !== 'agreement_no' && !k.toLowerCase().includes('crn')
  );

  const getStatusColor = (s: string) => {
    if (s === 'Paid' || s === 'Already settled' || s === 'Loan Closed') return 'bg-success/20 text-success';
    if (s === 'PTP' || s === 'CB') return 'bg-warning/20 text-warning';
    if (s === 'Non Contactable' || s === 'RTP' || s === 'RNR') return 'bg-destructive/20 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  const handleExportHistory = () => {
    try {
      if (feedbacks.length === 0) {
        toast.info("No feedback history to export.");
        return;
      }
      const headers = [
        'Date',
        'Agent',
        'Contact Number',
        'Availability',
        'Standard Feedback',
        'Detailed Feedback'
      ];
      const csv = [
        headers.join(','),
        ...feedbacks.map(f => [
          `"${format(new Date(f.createdAt), 'yyyy-MM-dd HH:mm:ss')}"`,
          `"${f.agentName || ''}"`,
          `"${f.contactNumber || ''}"`,
          `"${f.availability || ''}"`,
          `"${f.standardFeedback || f.status || ''}"`,
          `"${(f.detailedFeedback || f.overallDetailedFeedback || '').replace(/"/g, '""')}"`,
        ].join(','))
      ].join('\n');
      
      const a = document.createElement('a'); 
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); 
      a.download = `Feedback_History_${record.agreementid}.csv`; 
      a.click();
    } catch(err) {
      console.error(err);
      toast.error('Export failed');
    }
  };

  const currentFeedbackStatus = feedbacks[0]?.standardFeedback || feedbacks[0]?.status || 'No Action Yet';

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Navigation Toolbar */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(`/explorer?${searchParams.toString()}`)}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to List
          </button>
          
          <div className="flex items-center gap-4">
            {currentIndex >= 0 && (
              <span className="text-xs text-muted-foreground">
                Case {currentIndex + 1} of {totalList}
              </span>
            )}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => prevId && navigate(`/customer/${prevId}?${searchParams.toString()}`)}
                disabled={!prevId}
                className="p-2 border border-border rounded bg-card hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button 
                onClick={() => nextId && navigate(`/customer/${nextId}?${searchParams.toString()}`)}
                disabled={!nextId}
                className="p-2 border border-border rounded bg-card hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Identity Banner */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {record.customer_name || record.CUSTOMERNAME || record['Customer Name'] || 'Unknown Customer'}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="font-mono font-medium">{record.agreementid || record.agreement_no || record.AGREEMENTNO}</span>
              <span className="h-4 w-px bg-border"></span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {record.city || record.City || 'Unknown City'}</span>
              <span className="h-4 w-px bg-border"></span>
              <Badge variant="outline" className="font-bold">Bucket {record.bom_bkt || '?'}</Badge>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Current Status</span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(currentFeedbackStatus)}`}>
              {currentFeedbackStatus}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Info & Phones */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Phone Directory */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 text-sm text-foreground">
                  <Phone className="h-4 w-4 text-primary" /> Contact Directory
                </h3>
                <span className="text-xs text-muted-foreground font-medium">
                  {phones.length} {phones.length === 1 ? 'Number' : 'Numbers'} Available
                </span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {phones.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-full">No valid phone numbers found.</p>
                ) : (
                  phones.map((p, i) => (
                    <div key={i} className="flex flex-col border border-border rounded-lg p-3 bg-muted/5 hover:border-primary/50 transition-colors">
                      <div className="flex justify-between items-start mb-2.5">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-lg leading-none mb-1 text-foreground">{p.number}</span>
                          {p.name && (
                            <span className="text-[11px] font-bold text-primary/80 uppercase tracking-wider line-clamp-1" title={p.name}>
                              {p.name}
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[10px] capitalize max-w-[110px] text-center ml-2 truncate">
                          {p.source.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="flex gap-2 mt-auto">
                        <a 
                          href={`tel:${p.number}`} 
                          className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold bg-primary text-primary-foreground px-2 py-1.5 rounded hover:bg-primary/90 transition-colors shadow-xs"
                        >
                          <PhoneCall className="h-3 w-3" /> Call
                        </a>
                        <a 
                          href={`whatsapp://send?phone=91${p.number}&text=Hello`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold bg-[#25D366] text-white px-2 py-1.5 rounded hover:bg-[#25D366]/90 transition-colors shadow-xs"
                        >
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </a>
                        <button 
                          type="button"
                          onClick={() => setActiveModalPhone(p)} 
                          className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold bg-muted hover:bg-primary/15 text-foreground border border-border hover:border-primary/40 px-2 py-1.5 rounded transition-all cursor-pointer shadow-xs active:scale-95"
                          title={`Log call feedback for ${p.number}`}
                        >
                          <FileText className="h-3 w-3 text-primary" /> Log Form
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Grid Cards for Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Financials */}
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4" /> Financial Overview</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">POS</span><span className="font-bold">{fmtCur(record.principal_outstanding || 0)}</span></div>
                  {record.bcc_pending && <div className="flex justify-between"><span className="text-muted-foreground">BCC Pending</span><span className="font-medium">{fmtCur(record.bcc_pending)}</span></div>}
                  {record.penal_pending && <div className="flex justify-between"><span className="text-muted-foreground">Penal Pending</span><span className="font-medium">{fmtCur(record.penal_pending)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">EMI</span><span className="font-medium">{fmtCur(record.emi_amt || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">DAC</span><span className="font-medium text-info">{fmtCur(record.dac || record.DAC || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">ECS</span><span className="font-medium">{fmtCur(record.ecs || record.ECS || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Special</span><span className="font-medium">{fmtCur(record.special || record.Special || record.SPECIAL || 0)}</span></div>
                  {record.approx_forclosure && <div className="flex justify-between"><span className="text-muted-foreground">Foreclosure</span><span className="font-medium">{fmtCur(record.approx_forclosure)}</span></div>}
                </div>
              </div>

              {/* Personal / Location */}
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><MapPin className="h-4 w-4" /> Personal & Location</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">State</span><span className="font-medium">{record.state || record.State || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">City</span><span className="font-medium">{record.city || record.City || '-'}</span></div>
                  {(record.Supplier || record.supplier) && <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="font-medium">{record.Supplier || record.supplier}</span></div>}
                  {(record['Fos Name'] || record['FOS Name'] || record.fos_name) && <div className="flex justify-between"><span className="text-muted-foreground">FOS Name</span><span className="font-medium">{record['Fos Name'] || record['FOS Name'] || record.fos_name}</span></div>}
                  {(record['SO Name'] || record.so_name) && <div className="flex justify-between"><span className="text-muted-foreground">SO Name</span><span className="font-medium">{record['SO Name'] || record.so_name}</span></div>}
                  {(record['SO Code'] || record.so_code) && <div className="flex justify-between"><span className="text-muted-foreground">SO Code</span><span className="font-medium">{record['SO Code'] || record.so_code}</span></div>}
                  {(record['RO Name'] || record.ro_name) && <div className="flex justify-between"><span className="text-muted-foreground">RO Name</span><span className="font-medium">{record['RO Name'] || record.ro_name}</span></div>}
                  {(record['RO Code'] || record.ro_code) && <div className="flex justify-between"><span className="text-muted-foreground">RO Code</span><span className="font-medium">{record['RO Code'] || record.ro_code}</span></div>}
                  {(record['Mailing Address'] || record.mailing_address) && <div className="flex justify-between items-start gap-4"><span className="text-muted-foreground whitespace-nowrap">Mailing Address</span><span className="font-medium text-right text-xs mt-0.5 line-clamp-2" title={record['Mailing Address'] || record.mailing_address}>{record['Mailing Address'] || record.mailing_address}</span></div>}
                  {(record['Mailing Landmark'] || record.mailing_landmark) && <div className="flex justify-between items-start gap-4"><span className="text-muted-foreground whitespace-nowrap">Landmark</span><span className="font-medium text-right text-xs mt-0.5 line-clamp-2" title={record['Mailing Landmark'] || record.mailing_landmark}>{record['Mailing Landmark'] || record.mailing_landmark}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Executive</span><span className="font-medium">{record.executive_name || record['Executive Name'] || '-'}</span></div>
                </div>
              </div>

            </div>

            {/* Dynamic Attributes */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2"><Database className="h-4 w-4" /> Full Record Data</h3>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search attributes..." 
                    className="h-8 pl-7 pr-3 rounded-md border border-border bg-card text-xs focus:outline-none focus:border-primary"
                    value={otherPropsSearch}
                    onChange={(e) => setOtherPropsSearch(e.target.value)}
                  />
                </div>
              </div>
              <ScrollArea className="h-64">
                <div className="p-0">
                  <table className="w-full text-xs text-left">
                    <tbody className="divide-y divide-border">
                      {otherProps
                        .filter(([k,v]) => k.toLowerCase().includes(otherPropsSearch.toLowerCase()) || String(v).toLowerCase().includes(otherPropsSearch.toLowerCase()))
                        .map(([k, v]) => (
                        <tr key={k} className="hover:bg-muted/30">
                          <td className="px-4 py-2 font-medium text-muted-foreground w-1/3">{k}</td>
                          <td className="px-4 py-2 font-data">{v !== null && v !== undefined ? String(v) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </div>

          </div>

          {/* RIGHT COLUMN: Audit Stream History */}
          <div className="space-y-6">
            
            {/* Quick Action Prompt if phone available */}
            {phones.length > 0 && (
              <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20 text-primary">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Fast Call & Log</h4>
                    <p className="text-xs text-muted-foreground">Click "Log Form" on any number to record feedback instantly</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModalPhone(phones[0])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Log ({phones[0].number})
                </button>
              </div>
            )}

            {/* Feedback History / Audit Stream */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[480px]">
              <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm text-foreground">Audit Stream</h3>
                  <span className="text-xs text-muted-foreground">({feedbacks.length} logs)</span>
                </div>
                <button 
                  onClick={handleExportHistory} 
                  disabled={feedbacks.length === 0}
                  className="text-xs font-bold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  Export CSV
                </button>
              </div>
              <ScrollArea className="flex-1 p-4">
                {feedbacks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                    <MessageSquare className="h-8 w-8 stroke-1 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No feedback history yet</p>
                    <p className="text-xs text-muted-foreground/80 max-w-xs">
                      Click the "Log Form" button on any phone number above to submit interaction feedback.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map(f => {
                      const displayStatus = f.standardFeedback || f.status || 'Feedback Logged';
                      const details = f.detailedFeedback || f.overallDetailedFeedback;

                      return (
                        <div key={f.id} className="relative pl-4 border-l-2 border-primary/30 pb-4 last:pb-0">
                          <div className="absolute w-2 h-2 rounded-full bg-primary -left-[5px] top-1"></div>
                          
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-sm text-foreground">{displayStatus}</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(f.createdAt), 'MMM d, h:mm a')}</span>
                          </div>

                          <div className="text-xs text-muted-foreground space-y-1.5">
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              <div><span className="font-medium text-foreground">Agent:</span> {f.agentName}</div>
                              <div><span className="font-medium text-foreground">Number:</span> <span className="font-mono">{f.contactNumber}</span></div>
                              <div><span className="font-medium text-foreground">Availability:</span> <span className="font-semibold text-foreground">{f.availability}</span></div>
                            </div>

                            {/* Detailed Feedback */}
                            {details && (
                              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/60 text-foreground">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5 flex items-center gap-1">
                                  <FileText className="h-3 w-3" /> Remarks
                                </div>
                                <p className="italic text-xs">{details}</p>
                              </div>
                            )}

                            {/* Legacy extra fields if present */}
                            {f.amountPaid && <div><span className="font-medium text-foreground">Amount:</span> {fmtCur(f.amountPaid)}</div>}
                            {f.ptpDate && <div><span className="font-medium text-foreground">PTP Date:</span> {format(new Date(f.ptpDate), 'PP p')}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

          </div>

        </div>
      </div>

      {/* Conditional Feedback Window Modal (Auto-detects clicked phone number) */}
      {activeModalPhone && (
        <FeedbackModal
          isOpen={!!activeModalPhone}
          onClose={() => setActiveModalPhone(null)}
          agreementId={record.agreementid}
          customerName={record.customer_name || record['Customer Name'] || record.CUSTOMERNAME}
          contactNumber={activeModalPhone.number}
          phoneSource={activeModalPhone.source}
          phoneLabel={activeModalPhone.name}
        />
      )}
    </AppLayout>
  );
}

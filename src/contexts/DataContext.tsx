import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { parseMainFile, parsePaidFile, mergePaidIntoRecords, parseAdditionalFile, mergeAdditionalIntoRecords, parseCorrectedFile, mergeCorrectedIntoRecords, resolveCustomerName } from '../lib/fileParser';
import { db, AuditEntry, UploadSession } from '../lib/db';
import { useAuth } from './AuthContext';
import { atomicFileImport, atomicUpdateLoanRecord, atomicBulkUpdateLoanRecords } from '../lib/repositories/loanRepository';
import { setTargetRecord, deleteTargetRecord } from '../lib/repositories/targetRepository';
import { SyncEngine } from '../lib/sync/SyncEngine';
import { toast } from 'sonner';
import { cloudFetchAudit, cloudFetchLoans, cloudFetchTargets, cloudFetchUploads, cloudSaveTarget, cloudSaveUpload, cloudUpsertLoans, cloudUpdateLoan, cloudBulkUpdateLoans, isCloudFirstEnabled } from '../lib/cloudRepository';

interface DataContextType {
  isLoading: boolean;
  records: any[];
  filteredRecords: any[];
  schema: string[];
  targets: Record<string, number>;
  auditLog: AuditEntry[];
  uploadHistory: UploadSession[];
  loadMainFile: (buffer: ArrayBuffer, fileName: string, userName: string) => Promise<{ rowCount: number }>;
  loadPaidFile: (buffer: ArrayBuffer, fileName: string, userName: string) => Promise<{ matched: number; total: number }>;
  loadAdditionalFile: (buffer: ArrayBuffer, fileName: string, userName: string) => Promise<{ matched: number; total: number; stats: any }>;
  loadCorrectedFile: (buffer: ArrayBuffer, fileName: string, userName: string) => Promise<{ matched: number; total: number }>;
  updateRecord: (agreementid: string, field: string, value: any, userName: string) => Promise<void>;
  bulkUpdateRecords: (updates: {agreementid: string, field: string, value: any}[], userName: string) => Promise<void>;
  setTarget: (key: string, pct: number, userName: string) => Promise<void>;
  globalBucket: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  setGlobalBucket: (val: string) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);

  const [schema, setSchema] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadSession[]>([]);
  const [globalBucket, setGlobalBucket] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  
  const [undoStack, setUndoStack] = useState<{type: string, audits: AuditEntry[]}[]>([]);
  const [redoStack, setRedoStack] = useState<{type: string, audits: AuditEntry[]}[]>([]);

  useEffect(() => {
    if (records.length > 0) {
      const keys = new Set<string>();
      // To prevent extreme lag on 100k rows, we sample the first 500 rows. In CSV imports, columns are uniform.
      // But let's actually scan all of them because the user requested it. We'll use a fast loop.
      for (let i = 0; i < records.length; i++) {
        const keysArray = Object.keys(records[i]);
        for (let j = 0; j < keysArray.length; j++) {
          keys.add(keysArray[j]);
        }
      }
      setSchema(Array.from(keys));
    } else {
      setSchema([]);
    }
  }, [records]);

  // Local peer-mesh transport is disabled in cloud-first mode.
  useEffect(() => {
    if (!user || isCloudFirstEnabled()) return;

    let active = true;
    const refreshFromLocalDb = async () => {
      if (!active) return;
      try {
        const { fetchAuthorizedLoanRecords } = await import('../lib/repositories/loanRepository');
        const [dbRecords, dbTargets, dbUploads, dbAudit] = await Promise.all([
          fetchAuthorizedLoanRecords(user),
          db.state_targets.toArray(),
          db.upload_sessions.orderBy('createdAt').reverse().toArray(),
          db.audit_log.orderBy('createdAt').reverse().toArray(),
        ]);
        if (!active) return;
        setRecords(dbRecords);
        setTargets(dbTargets.reduce((acc, target) => {
          acc[target.key] = target.pct;
          return acc;
        }, {} as Record<string, number>));
        setUploadHistory(dbUploads);
        setAuditLog(dbAudit);
      } catch (error) {
        console.error('[DataContext] failed to refresh after sync', error);
      }
    };

    const engine = new SyncEngine(() => { void refreshFromLocalDb(); });
    void engine.start().catch(error => {
      console.error('[DataContext] sync engine failed to start', error);
    });

    return () => {
      active = false;
      void engine.stop();
    };
  }, [user]);

  // Load from the authoritative store. Cloud mode must never silently fall back to IndexedDB.
  useEffect(() => {
    let active = true;
    async function loadData() {
      if (isCloudFirstEnabled()) {
        try {
          if (!user) {
            setRecords([]);
            setTargets({});
            setUploadHistory([]);
            setAuditLog([]);
            return;
          }
          const [cloudRecords, cloudTargets, cloudUploads, cloudAudit] = await Promise.all([
            cloudFetchLoans(), cloudFetchTargets(), cloudFetchUploads(), cloudFetchAudit(),
          ]);
          if (!active) return;
          const scopedRecords = user.role === 'EXECUTIVE'
            ? cloudRecords.filter(r => {
                const targets = [user.assignedExecutiveName, user.name].filter(Boolean).map(v => String(v).trim().toLowerCase());
                const raw = String(r.executive_name || r['Executive Name'] || r.EXECUTIVE_NAME || r.FOS_Name || r['FOS Name'] || r.fos || r.FOS || r.executive || '').trim().toLowerCase();
                return !!raw && targets.some(t => raw === t || raw.includes(t) || t.includes(raw));
              })
            : cloudRecords;
          setRecords(scopedRecords);
          setTargets(cloudTargets.reduce((acc, row) => { acc[row.key] = row.pct; return acc; }, {} as Record<string, number>));
          setUploadHistory(cloudUploads);
          setAuditLog(cloudAudit);
        } catch (error) {
          console.error('[DataContext] cloud load failed; local fallback intentionally disabled', error);
          toast.error(error instanceof Error ? error.message : 'Unable to load cloud data. Check your connection and access.');
        } finally {
          if (active) setIsLoading(false);
        }
        return;
      }
      // 1. Migrate legacy localStorage targets if present
      try {
        const savedTargetsStr = localStorage.getItem('app_targets');
        if (savedTargetsStr) {
          const savedTargets = JSON.parse(savedTargetsStr);
          for (const [key, pct] of Object.entries(savedTargets)) {
            // Check if it already exists in Dexie so we don't overwrite newer changes
            const existing = await db.state_targets.get(key);
            if (!existing) {
              await db.state_targets.put({ key, pct: Number(pct), updatedAt: new Date().toISOString() });
            }
          }
          // Intentionally NOT deleting from localStorage, just stop reading it as primary
        }
      } catch (err) {
        console.error("Migration error:", err);
      }

      // 2. Load targets from Dexie
      try {
        const dbTargets = await db.state_targets.toArray();
        const targetsMap = dbTargets.reduce((acc, t) => {
          acc[t.key] = t.pct;
          return acc;
        }, {} as Record<string, number>);
        setTargets(targetsMap);
        
        // 3. Load authorized records (Enforcing Executive Scope at Repository boundary)
        const { fetchAuthorizedLoanRecords } = await import('../lib/repositories/loanRepository');
        const dbRecords = await fetchAuthorizedLoanRecords(user);
        setRecords(dbRecords);
        
        // 4. Load history and audit logs
        const dbUploads = await db.upload_sessions.orderBy('createdAt').reverse().toArray();
        setUploadHistory(dbUploads);
        
        const dbAudit = await db.audit_log.orderBy('createdAt').reverse().toArray();
        setAuditLog(dbAudit);
      } catch (err) {
        console.error("Dexie Load Error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, [user]);

  const loadMainFile = useCallback(async (buffer: ArrayBuffer, fileName: string, userName: string) => {
    const parsed = parseMainFile(buffer);
    const normalizedRecords = parsed.map(record => {
      const custName = record.customer_name || resolveCustomerName(record);
      return {
        ...record,
        customer_name: custName,
        'customer Name': custName,
        'Customer Name': custName,
        CUSTOMER_NAME: custName,
      };
    });
    const entry = { id: crypto.randomUUID(), type: 'MAIN_DATA', fileName, recordCount: normalizedRecords.length, uploadedBy: userName, createdAt: new Date().toISOString() };
    if (isCloudFirstEnabled()) {
      await cloudUpsertLoans(normalizedRecords);
      await cloudSaveUpload(entry as UploadSession);
    } else {
      await atomicFileImport(normalizedRecords, entry as UploadSession);
    }
    setUploadHistory(prev => [entry, ...prev]);
    
    const { fetchAuthorizedLoanRecords } = await import('../lib/repositories/loanRepository');
    const dbRecords = await fetchAuthorizedLoanRecords(user);
    setRecords(dbRecords);
    
    return { rowCount: normalizedRecords.length };
  }, [user]);

  const loadPaidFile = useCallback(async (buffer: ArrayBuffer, fileName: string, userName: string) => {
    const paidRows = parsePaidFile(buffer);
    let matched = 0;
    
    const allDbRecords = isCloudFirstEnabled() ? await cloudFetchLoans() : await db.loan_records.toArray();
    const mergedData = mergePaidIntoRecords(allDbRecords, paidRows);
    matched = paidRows.filter(p => allDbRecords.some(r => r.agreementid === p.agreementid)).length;
    
    const entry = { id: crypto.randomUUID(), type: 'PAID_FILE', fileName, recordCount: paidRows.length, uploadedBy: userName, createdAt: new Date().toISOString() };
    if (isCloudFirstEnabled()) {
      await cloudUpsertLoans(mergedData);
      await cloudSaveUpload(entry as UploadSession);
    } else {
      await atomicFileImport(mergedData, entry as UploadSession);
    }
    setUploadHistory(prev => [entry, ...prev]);
    
    const { fetchAuthorizedLoanRecords } = await import('../lib/repositories/loanRepository');
    const dbRecords = await fetchAuthorizedLoanRecords(user);
    setRecords(dbRecords);
    
    return { matched, total: paidRows.length }; 
  }, [user]);

  const loadAdditionalFile = useCallback(async (buffer: ArrayBuffer, fileName: string, userName: string) => {
    const additionalRows = parseAdditionalFile(buffer);
    
    const allDbRecords = isCloudFirstEnabled() ? await cloudFetchLoans() : await db.loan_records.toArray();
    const { merged, stats } = mergeAdditionalIntoRecords(allDbRecords, additionalRows);
    const matched = additionalRows.filter(p => allDbRecords.some(r => r.agreementid === p.agreementid)).length;
    
    const entry = { id: crypto.randomUUID(), type: 'ADDITIONAL_COLLECTION_FILE', fileName, recordCount: additionalRows.length, uploadedBy: userName, createdAt: new Date().toISOString() };
    setUploadHistory(prev => [entry, ...prev]);
    
    await atomicFileImport(merged, entry as UploadSession);
    
    const { fetchAuthorizedLoanRecords } = await import('../lib/repositories/loanRepository');
    const dbRecords = await fetchAuthorizedLoanRecords(user);
    setRecords(dbRecords);
    
    return { matched, total: additionalRows.length, stats };
  }, [user]);

  const loadCorrectedFile = useCallback(async (buffer: ArrayBuffer, fileName: string, userName: string) => {
    const correctedRows = parseCorrectedFile(buffer);
    
    const allDbRecords = isCloudFirstEnabled() ? await cloudFetchLoans() : await db.loan_records.toArray();
    const { merged, matched } = mergeCorrectedIntoRecords(allDbRecords, correctedRows);
    
    const entry = { id: crypto.randomUUID(), type: 'CORRECTED_DAC_FILE', fileName, recordCount: correctedRows.length, uploadedBy: userName, createdAt: new Date().toISOString() };
    setUploadHistory(prev => [entry, ...prev]);
    
    await atomicFileImport(merged, entry as UploadSession);
    
    const { fetchAuthorizedLoanRecords } = await import('../lib/repositories/loanRepository');
    const dbRecords = await fetchAuthorizedLoanRecords(user);
    setRecords(dbRecords);
    
    return { matched, total: correctedRows.length };
  }, [user]);

  const updateRecord = useCallback(async (agreementid: string, field: string, value: any, userName: string) => {
    let oldVal = '';
    
    const existingRecord = records.find(r => r.agreementid === agreementid);
    oldVal = String(existingRecord?.[field] ?? '');
    const updatePayload = { [field]: value, [`${field}_source`]: 'MANUAL' };
    if (isCloudFirstEnabled()) {
      await cloudUpdateLoan(agreementid, updatePayload, userName);
    } else {
      await atomicUpdateLoanRecord(agreementid, updatePayload, { userName, userRole: user?.role || 'VIEWER', source: 'MANUAL' });
    }
    setRecords(prev => prev.map(r => r.agreementid === agreementid ? { ...r, ...updatePayload } : r));
    
    const audit = {
      id: crypto.randomUUID(),
      agreementid,
      field,
      oldValue: oldVal,
      newValue: String(value),
      changedBy: userName,
      createdAt: new Date().toISOString(),
      source: 'MANUAL',
    };
    
    setAuditLog(a => [audit, ...a]);
    
    setUndoStack(prev => [...prev, { type: 'UPDATE', audits: [audit] }]);
    setRedoStack([]);
  }, [user]);


  const bulkUpdateRecords = useCallback(async (updates: {agreementid: string, field: string, value: any}[], userName: string) => {
    const newAudits: AuditEntry[] = [];
    const updateMap = new Map();
    
    updates.forEach(u => {
      if (!updateMap.has(u.agreementid)) {
        updateMap.set(u.agreementid, {});
      }
      updateMap.get(u.agreementid)[u.field] = u.value;
      updateMap.get(u.agreementid)[`${u.field}_source`] = 'MANUAL';
    });

    const recordsById = new Map(records.map(r => [r.agreementid, r]));
    setRecords(prev => {
      const next = prev.map(r => {
        if (updateMap.has(r.agreementid)) {
          const u = updateMap.get(r.agreementid);
          
          Object.keys(u).forEach(key => {
            if (!key.endsWith('_source')) {
              newAudits.push({
                id: crypto.randomUUID(),
                agreementid: r.agreementid,
                field: key,
                oldValue: String(r[key] ?? ''),
                newValue: String(u[key]),
                changedBy: userName,
                createdAt: new Date().toISOString(),
                source: 'MANUAL',
              });
            }
          });
          
          return { ...r, ...u };
        }
        return r;
      });
      return next;
    });

    setAuditLog(a => [...newAudits, ...a]);

    const formattedUpdates = Array.from(updateMap.entries()).map(([agreementId, upds]) => ({
      agreementId,
      updates: upds
    }));

    if (isCloudFirstEnabled()) {
      await cloudBulkUpdateLoans(formattedUpdates, userName);
    } else {
      await atomicBulkUpdateLoanRecords(formattedUpdates, { userName, userRole: user?.role || 'VIEWER', source: 'BULK_OPERATION' });
    }

    setUndoStack(prev => [...prev, { type: 'BULK_UPDATE', audits: newAudits }]);
    setRedoStack([]);
  }, [user]);

  const setTarget = useCallback(async (key: string, pct: number, userName: string) => {
    const actor = userName || user?.name || 'System';
    if (isCloudFirstEnabled()) {
      await cloudSaveTarget(key, pct, actor);
    } else if (pct <= 0) {
      setTargets(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await deleteTargetRecord(key, actor);
    } else {
      setTargets(prev => ({ ...prev, [key]: pct }));
      await setTargetRecord(key, pct, actor);
    }
  }, [user]);

  
  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, action]);

    const updateMap = new Map();
    action.audits.forEach(a => {
      if (!updateMap.has(a.agreementid)) updateMap.set(a.agreementid, {});
      updateMap.get(a.agreementid)[a.field] = a.oldValue;
      updateMap.get(a.agreementid)[`${a.field}_source`] = 'UNDO'; // Mark as undone
    });

    setRecords(prev => {
      return prev.map(r => {
        if (updateMap.has(r.agreementid)) {
          const u = updateMap.get(r.agreementid);
          return { ...r, ...u };
        }
        return r;
      });
    });

    if (updateMap.size > 0) {
      const formattedUpdates = Array.from(updateMap.entries()).map(([agreementId, upds]) => ({
        agreementId,
        updates: upds
      }));
      await atomicBulkUpdateLoanRecords(
        formattedUpdates,
        { userName: user?.name || 'Unknown', userRole: user?.role || 'VIEWER', source: 'MANUAL' }
      );
    }
  }, [undoStack, user]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, action]);

    const updateMap = new Map();
    action.audits.forEach(a => {
      if (!updateMap.has(a.agreementid)) updateMap.set(a.agreementid, {});
      updateMap.get(a.agreementid)[a.field] = a.newValue;
      updateMap.get(a.agreementid)[`${a.field}_source`] = 'MANUAL'; // Restore manual source
    });

    setRecords(prev => {
      return prev.map(r => {
        if (updateMap.has(r.agreementid)) {
          const u = updateMap.get(r.agreementid);
          return { ...r, ...u };
        }
        return r;
      });
    });

    if (updateMap.size > 0) {
      const formattedUpdates = Array.from(updateMap.entries()).map(([agreementId, upds]) => ({
        agreementId,
        updates: upds
      }));
      await atomicBulkUpdateLoanRecords(
        formattedUpdates,
        { userName: user?.name || 'Unknown', userRole: user?.role || 'VIEWER', source: 'MANUAL' }
      );
    }
  }, [redoStack, user]);

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (globalBucket === 'ALL') return records;
    return records.filter((r: any) => String(r.bom_bkt).trim().toUpperCase() === globalBucket);
  }, [records, globalBucket]);

  return (
    <DataContext.Provider value={{ undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, isLoading, records, filteredRecords, schema, targets, auditLog, uploadHistory, loadMainFile, loadPaidFile, loadAdditionalFile, loadCorrectedFile, updateRecord, bulkUpdateRecords, setTarget, globalBucket, setGlobalBucket }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
};

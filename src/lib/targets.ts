export function normalizeKeyPart(v: unknown): string {
  return String(v ?? '').trim().toUpperCase();
}

export function buildTargetKey(opts: { city?: string; state?: string; bkt?: string }): string {
  const city = opts.city ? normalizeKeyPart(opts.city) : '';
  const state = opts.state ? normalizeKeyPart(opts.state) : '';
  const bkt = opts.bkt ? normalizeKeyPart(opts.bkt) : '';
  
  if (!city && !state && !bkt) return 'GLOBAL';
  if (!city && !state && bkt) return `GLOBAL__BKT__${bkt}`;
  if (city && bkt) return `CITY__${city}__BKT__${bkt}`;
  if (state && bkt) return `STATE__${state}__BKT__${bkt}`;
  if (city) return `CITY__${city}`;
  if (state) return `STATE__${state}`;
  return 'GLOBAL';
}

export function resolveTargetPct(
  targets: Record<string, number>,
  row: { city?: string; state?: string; bkt?: string }
): number {
  const city = normalizeKeyPart(row.city);
  const state = normalizeKeyPart(row.state);
  const bkt = normalizeKeyPart(row.bkt);
  
  return (
    targets[`CITY__${city}__BKT__${bkt}`] ??
    targets[`STATE__${state}__BKT__${bkt}`] ??
    targets[`GLOBAL__BKT__${bkt}`] ??
    targets[`CITY__${city}`] ??
    targets[`STATE__${state}`] ??
    targets['GLOBAL'] ??
    0
  );
}

export function findMatchingRecordsCount(
  targetKey: string,
  records: any[]
): number {
  let count = 0;
  for (const r of records) {
    const city = normalizeKeyPart(r.city || r.City);
    const state = normalizeKeyPart(r.state || r.State);
    const bkt = normalizeKeyPart(r.bom_bkt);
    
    // To know if a record *matches* this specific key, we evaluate
    // the resolution chain and see if it stops exactly at this key.
    const resolvedKey = 
      (targetsHas(targetKey, `CITY__${city}__BKT__${bkt}`) ? `CITY__${city}__BKT__${bkt}` : null) ??
      (targetsHas(targetKey, `STATE__${state}__BKT__${bkt}`) ? `STATE__${state}__BKT__${bkt}` : null) ??
      (targetsHas(targetKey, `GLOBAL__BKT__${bkt}`) ? `GLOBAL__BKT__${bkt}` : null) ??
      (targetsHas(targetKey, `CITY__${city}`) ? `CITY__${city}` : null) ??
      (targetsHas(targetKey, `STATE__${state}`) ? `STATE__${state}` : null) ??
      (targetsHas(targetKey, 'GLOBAL') ? 'GLOBAL' : null);
      
    if (resolvedKey === targetKey) {
      count++;
    }
  }
  return count;
}

function targetsHas(targetKey: string, testKey: string): boolean {
  // If the testKey is exactly the targetKey we are evaluating, it "exists".
  // Note: we can't easily check all targets here without passing the full targets object,
  // but for the purpose of "how many records would match if this were the ONLY target",
  // we can just check string equality.
  // Wait, if we want to know how many records *resolve* to this target given all targets,
  // we need the full targets object. Let's write a better version.
  return targetKey === testKey;
}

export function findMatchingRecordsCountAccurate(
  targetKey: string,
  targets: Record<string, number>,
  records: any[]
): number {
  let count = 0;
  for (const r of records) {
    const city = normalizeKeyPart(r.city || r.City);
    const state = normalizeKeyPart(r.state || r.State);
    const bkt = normalizeKeyPart(r.bom_bkt);
    
    let resolvedKey: string | null = null;
    if (targets[`CITY__${city}__BKT__${bkt}`] !== undefined) resolvedKey = `CITY__${city}__BKT__${bkt}`;
    else if (targets[`STATE__${state}__BKT__${bkt}`] !== undefined) resolvedKey = `STATE__${state}__BKT__${bkt}`;
    else if (targets[`GLOBAL__BKT__${bkt}`] !== undefined) resolvedKey = `GLOBAL__BKT__${bkt}`;
    else if (targets[`CITY__${city}`] !== undefined) resolvedKey = `CITY__${city}`;
    else if (targets[`STATE__${state}`] !== undefined) resolvedKey = `STATE__${state}`;
    else if (targets['GLOBAL'] !== undefined) resolvedKey = 'GLOBAL';

    if (resolvedKey === targetKey) {
      count++;
    }
  }
  return count;
}


export interface ResolvedTarget {
  pct: number;
  date: string | null;
}

export function resolveTarget(
  targets: Record<string, number>,
  row: { city?: string; state?: string; bkt?: string }
): ResolvedTarget {
  const city = normalizeKeyPart(row.city);
  const state = normalizeKeyPart(row.state);
  const bkt = normalizeKeyPart(row.bkt);

  const baseKeys = [
    city && bkt ? `CITY__${city}__BKT__${bkt}` : null,
    state && bkt ? `STATE__${state}__BKT__${bkt}` : null,
    bkt ? `GLOBAL__BKT__${bkt}` : null,
    city ? `CITY__${city}` : null,
    state ? `STATE__${state}` : null,
    'GLOBAL'
  ].filter(Boolean) as string[];

  const today = new Date().toISOString().split('T')[0];

  for (const baseKey of baseKeys) {
    const matchingTargets = Object.entries(targets)
      .filter(([k]) => k === baseKey || k.startsWith(`${baseKey}@@`))
      .map(([k, pct]) => {
         const parts = k.split('@@');
         return { pct, date: parts.length > 1 ? parts[1] : null };
      });
    
    if (matchingTargets.length > 0) {
      matchingTargets.sort((a, b) => {
         if (!a.date) return -1;
         if (!b.date) return 1;
         return a.date.localeCompare(b.date);
      });
      
      const upcoming = matchingTargets.find(t => t.date && t.date >= today);
      if (upcoming) return upcoming;
      
      return matchingTargets[matchingTargets.length - 1];
    }
  }

  return { pct: 0, date: null };
}

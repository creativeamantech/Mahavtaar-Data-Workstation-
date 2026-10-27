/**
 * Mahavtaar Enterprise Typography System
 * Authoritative, high-density financial typography scales.
 */
export const typo = {
  // Page level display & titles
  pageTitle: 'font-sans font-bold text-xl md:text-2xl tracking-tight text-foreground flex items-center gap-2.5',
  pageSubtitle: 'font-sans text-xs md:text-sm text-muted-foreground mt-0.5',
  
  // Section & widget headers
  sectionTitle: 'font-sans font-semibold text-sm md:text-base text-foreground tracking-tight',
  sectionSubtitle: 'font-sans text-xs text-muted-foreground',
  
  // Compact metadata & uppercase chips
  labelCaps: 'font-sans font-bold text-[10px] md:text-[11px] uppercase tracking-wider text-muted-foreground',
  labelSubtle: 'font-sans font-medium text-xs text-muted-foreground',

  // Financial tabular numbers & data values
  dataHero: 'font-sans font-extrabold text-2xl md:text-3xl tracking-tight font-tabular',
  dataValue: 'font-sans font-bold text-xl md:text-2xl tracking-tight font-tabular',
  dataMetric: 'font-sans font-bold text-base md:text-lg font-tabular',
  dataBody: 'font-sans text-xs md:text-sm font-tabular',
  
  // Tables & Micro details
  tableHeader: 'font-sans text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none',
  tableCell: 'font-sans text-xs font-medium font-tabular',
  caption: 'font-sans text-[11px] text-muted-foreground',
  
  // Monospace references
  monoCode: 'font-mono text-xs font-semibold tracking-tight',
};

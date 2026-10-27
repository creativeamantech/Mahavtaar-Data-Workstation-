const fs = require('fs');
let code = fs.readFileSync('src/pages/ExecDashboard.tsx', 'utf8');

// The error was adding </div> to all </table>.
// Instead of replacing </table>, I should just make sure the `teamPerf` table has `</div>` at the end.
// First, I will load ExecDashboard_copy.txt and re-apply my loading fix, then carefully apply the table colgroup fix.

let original = fs.readFileSync('ExecDashboard_copy.txt', 'utf8');

// 1. Loading Fix
const loadingTargetStr = `  if (isLoading) {
    return (
      <AppLayout>
      <div className="mb-4"><BucketFilter /></div>
        <div className="flex h-[50vh] items-center justify-center text-muted-foreground animate-pulse">
          Loading dashboard metrics...
        </div>
      </AppLayout>
    );
  }

  return (`;

const startIdx = original.indexOf('  if (isLoading) {');
// Find the top-level return
const endIdx = original.indexOf('  return (\n    <AppLayout>\n      <div className="mb-6 flex items-center justify-between">');
if (startIdx !== -1 && endIdx !== -1) {
  original = original.slice(0, startIdx) + loadingTargetStr + original.slice(endIdx + 10);
}

// 2. Table Fix
const oldTableStart = '<table className="w-full font-sans text-xs min-w-[1000px]">';
const theadStart = '<thead className="sticky top-0 z-30 bg-muted border-b border-border shadow-sm">';
const tfootStart = '<tfoot className="bg-primary/10 font-bold sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-primary/20 transition-colors"';

// Find the last occurrence of oldTableStart (which is the Performance-Based Paid Cases)
const lastTableIdx = original.lastIndexOf('<div className="overflow-x-auto max-h-[600px] relative">');
if (lastTableIdx !== -1) {
  original = original.slice(0, lastTableIdx) + '<div className="rounded-xl border border-border/80 bg-card shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden mb-8"><div className="overflow-auto flex-1 max-h-[600px] scrollbar-thin">' + original.slice(lastTableIdx + '<div className="overflow-x-auto max-h-[600px] relative">'.length);
}

// Now replace the table tag
const lastTableTagIdx = original.lastIndexOf(oldTableStart);
if (lastTableTagIdx !== -1) {
    const tableRepl = `<table className="w-full table-fixed border-collapse font-sans min-w-[1360px]">
              <colgroup>
                <col style={{ width: '60px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '100px' }} />
              </colgroup>`;
    original = original.slice(0, lastTableTagIdx) + tableRepl + original.slice(lastTableTagIdx + oldTableStart.length);
}

const lastTheadIdx = original.lastIndexOf(theadStart);
if (lastTheadIdx !== -1) {
    original = original.slice(0, lastTheadIdx) + '<thead className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-900 border-b border-border shadow-sm">' + original.slice(lastTheadIdx + theadStart.length);
}

const lastTfootIdx = original.lastIndexOf(tfootStart);
if (lastTfootIdx !== -1) {
    original = original.slice(0, lastTfootIdx) + '<tfoot className="sticky bottom-0 z-20 bg-slate-900 dark:bg-[#070910] text-slate-50 dark:text-slate-100 shadow-[0_-3px_10px_rgba(0,0,0,0.25)] cursor-pointer transition-colors"' + original.slice(lastTfootIdx + tfootStart.length);
}

const oldTh = 'text-muted-foreground font-semibold px-3 py-3 text-center w-12 bg-muted/90 text-xs uppercase text-[10px]';
original = original.replace(oldTh, 'px-3 py-3 text-center uppercase tracking-wider text-[11px] align-middle w-12 text-muted-foreground font-semibold');

original = original.replace(/text-muted-foreground font-semibold px-3 py-3 text-(left|right) uppercase tracking-wider text-\[11px\] bg-muted\/90/g, 'px-3 py-3 text-$1 uppercase tracking-wider text-[11px] align-middle text-muted-foreground font-semibold');

// And add the missing </div> for the table wrapper!
const lastTableCloseIdx = original.lastIndexOf('          </table>\n        </div>\n      </div>\n\n    </AppLayout>');
if (lastTableCloseIdx !== -1) {
    original = original.slice(0, lastTableCloseIdx) + '          </table>\n        </div>\n      </div>\n      </div>\n\n    </AppLayout>' + original.slice(lastTableCloseIdx + '          </table>\n        </div>\n      </div>\n\n    </AppLayout>'.length);
}

fs.writeFileSync('src/pages/ExecDashboard.tsx', original);
console.log('Fixed ExecDashboard completely via node script!');

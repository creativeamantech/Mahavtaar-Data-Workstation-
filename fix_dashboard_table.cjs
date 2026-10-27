const fs = require('fs');
let code = fs.readFileSync('src/pages/ExecDashboard.tsx', 'utf8');

const oldTableStart = '<table className="w-full font-sans text-xs min-w-[1000px]">';
const oldTableEnd = '</table>';
const theadStart = '<thead className="sticky top-0 z-30 bg-muted border-b border-border shadow-sm">';
const tfootStart = '<tfoot className="bg-primary/10 font-bold sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] cursor-pointer hover:bg-primary/20 transition-colors"';

// Only replace the Performance-Based Paid Cases table. 
// It's inside `<div className="overflow-x-auto max-h-[600px] relative">`

code = code.replace('<div className="overflow-x-auto max-h-[600px] relative">', '<div className="rounded-xl border border-border/80 bg-card shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden mb-8"><div className="overflow-auto flex-1 max-h-[600px] scrollbar-thin">');
code = code.replace(oldTableStart, `<table className="w-full table-fixed border-collapse font-sans min-w-[1360px]">
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
              </colgroup>`);

code = code.replace(theadStart, '<thead className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-900 border-b border-border shadow-sm">');
code = code.replace(tfootStart, '<tfoot className="sticky bottom-0 z-20 bg-slate-900 dark:bg-[#070910] text-slate-50 dark:text-slate-100 shadow-[0_-3px_10px_rgba(0,0,0,0.25)] cursor-pointer transition-colors"');

// Fix headers
const oldTh = 'text-muted-foreground font-semibold px-3 py-3 text-center w-12 bg-muted/90 text-xs uppercase text-[10px]';
code = code.replace(oldTh, 'px-3 py-3 text-center uppercase tracking-wider text-[11px] align-middle w-12 text-muted-foreground font-semibold');

code = code.replace(/text-muted-foreground font-semibold px-3 py-3 text-(left|right) uppercase tracking-wider text-\[11px\] bg-muted\/90/g, 'px-3 py-3 text-$1 uppercase tracking-wider text-[11px] align-middle text-muted-foreground font-semibold');


fs.writeFileSync('src/pages/ExecDashboard.tsx', code);
console.log('Fixed table in ExecDashboard.tsx!');

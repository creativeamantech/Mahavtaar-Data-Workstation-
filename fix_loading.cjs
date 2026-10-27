const fs = require('fs');
let code = fs.readFileSync('ExecDashboard_copy.txt', 'utf8');

const targetStr = `  if (isLoading) {
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

const startIdx = code.indexOf('  if (isLoading) {');
const endIdx = code.indexOf('  return (', startIdx + 100);

if (startIdx !== -1 && endIdx !== -1) {
  const newCode = code.slice(0, startIdx) + targetStr + code.slice(endIdx + 10);
  fs.writeFileSync('src/pages/ExecDashboard.tsx', newCode);
  console.log('Fixed ExecDashboard.tsx loading block!');
} else {
  console.log('Could not find start/end!');
}

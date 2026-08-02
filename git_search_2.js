const { execSync } = require('child_process');
const fs = require('fs');

try {
  const commits = execSync('git log --no-pager --oneline -n 30', { encoding: 'utf8' });
  fs.writeFileSync('commits.txt', commits);

  const fileHistory = execSync('git log --no-pager -p -n 10 -- src/lib/supabase.ts', { encoding: 'utf8' });
  fs.writeFileSync('supabase_history.txt', fileHistory);
  console.log("Git search done!");
} catch (e) {
  fs.writeFileSync('error.txt', e.stack + '\n' + e.stdout + '\n' + e.stderr);
}

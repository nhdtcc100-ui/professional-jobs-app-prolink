const { execSync } = require('child_process');
const fs = require('fs');

try {
  // البحث في السجل التاريخي لـ Git عن النص URL الخاص بالـ Supabase للعثور على المفتاح الأصلي
  const output = execSync('git log -p -S "fwqeadonwddzvlyooeee" -n 5', { encoding: 'utf8' });
  fs.writeFileSync('git_output.txt', output);
} catch (e) {
  fs.writeFileSync('git_output.txt', e.toString() + '\n' + (e.stdout || '') + '\n' + (e.stderr || ''));
}

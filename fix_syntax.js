const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
// Lines 2719-2720 are 0-indexed as 2718-2719
// Check what they contain
console.log('Line 2718:', JSON.stringify(lines[2718]));
console.log('Line 2719:', JSON.stringify(lines[2719]));
// Remove the two duplicate closing lines
lines.splice(2718, 2);
fs.writeFileSync('src/App.tsx', lines.join('\n'), 'utf8');
console.log('Done! Total lines now:', lines.length);

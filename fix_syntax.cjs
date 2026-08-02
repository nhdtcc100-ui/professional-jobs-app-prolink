const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix the unterminated string literal break
const searchPattern = /setNewPost\(p => p \+ '\s*\n\s*\[Øâ€¦Ø¸â€šØ·Â§Ø·Â¨Ø·Â© Ø¸â€¦Ø¸â€šØ·Â§Ø¸â€ž: Ø·Â£Ø·Â¯Ø·Â®Ø¸â€ž Ø¸â€¦Ø·Â­Ø·Ú¾Ø¸Ë†Ø¸â€° Ø·Â§Ø¸â€žØ¸â€¦Ø¸â€šØ·Â§Ø¸â€ž Ø¸â€¡Ø¸â€ Ø·Â§\.\.\.\]'\);/g;
const replacement = "setNewPost(p => p + '\\n[مقال: أدخل محتوى المقال هنا...]');";

if (content.match(searchPattern)) {
    content = content.replace(searchPattern, replacement);
    console.log('Fixed syntax error.');
} else {
    // Try a more generic match if the mojibake is slightly different
    const genericPattern = /setNewPost\(p => p \+ '\s*\n\s*\[[^'\n]*\]'\);/g;
    if (content.match(genericPattern)) {
        content = content.replace(genericPattern, replacement);
        console.log('Fixed syntax error (generic match).');
    } else {
        console.log('Could not find pattern.');
    }
}

fs.writeFileSync('src/App.tsx', content);

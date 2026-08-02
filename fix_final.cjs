const fs = require('fs');

function decodeMojibake(str) {
    // Stage 1: Reverse UTF-8 mangling of Windows-1252
    // This handles cases like Ã¢â‚¬Â¢ -> â€¢ -> •
    try {
        let bytes = Buffer.from(str, 'binary');
        // If it's valid UTF-8, it might be double-encoded
        let text = str;
        
        // Try to reverse the Windows-1252 -> UTF-8 mapping
        // We use 'latin1' (ISO-8859-1) which is close to Windows-1252 but safe for all bytes
        let b = Buffer.from(text, 'utf8');
        // If the resulting buffer interpreted as UTF-8 gives something cleaner, we repeat.
        // But for Arabic (Windows-1256), we need a specific mapping.
    } catch (e) {}

    // Manual replacement for common artifacts
    str = str.replace(/Ã¢â‚¬Â¢/g, '•');
    str = str.replace(/Ã¢â‚¬/g, ' '); // Sometimes artifacts of spaces or symbols

    // Stage 2: Windows-1256 recovery (Arabic)
    // Characters like Ø·Â§ are clearly Windows-1252 interpretation of Windows-1256 bytes
    // Ø = 0xD8, · = 0xB7, Â = 0xC2, § = 0xA7
    // These are UTF-8 bytes for certain characters, or just mangled bytes.
    
    // Let's try the byte-reversal method
    const win1252ToByte = {
        '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
        'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91,
        '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
        '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F
    };

    function toBytes(s) {
        let arr = [];
        for (let i = 0; i < s.length; i++) {
            let c = s[i];
            let code = s.charCodeAt(i);
            if (win1252ToByte[c]) {
                arr.push(win1252ToByte[c]);
            } else if (code < 256) {
                arr.push(code);
            }
        }
        return Buffer.from(arr);
    }

    try {
        let bytes = toBytes(str);
        // Interpret as Windows-1256
        const decoder = new TextDecoder('windows-1256');
        let decoded = decoder.decode(bytes);
        
        // If the decoded string contains mostly Arabic characters, it's probably right
        let arabicCount = (decoded.match(/[\u0600-\u06FF]/g) || []).length;
        if (arabicCount > decoded.length * 0.3) {
            return decoded;
        }
    } catch (e) {}

    return str;
}

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Regex to find string literals: "..." or '...' or `...`
// This is tricky because of escapes and nested templates, but we'll try a simple one first
content = content.replace(/(["'`])((?:(?!\1|\\).|\\.)*)\1/g, (match, p1, p2) => {
    if (p2.includes('Ø') || p2.includes('Ù') || p2.includes('Â') || p2.includes('Ã')) {
        let decoded = decodeMojibake(p2);
        return p1 + decoded + p1;
    }
    return match;
});

// Also try to fix text nodes in JSX (text between > and <)
content = content.replace(/>([^<>{]+)</g, (match, p1) => {
    if (p1.includes('Ø') || p1.includes('Ù') || p1.includes('Â') || p1.includes('Ã')) {
        let decoded = decodeMojibake(p1);
        return '>' + decoded + '<';
    }
    return match;
});

fs.writeFileSync('src/App.fixed.tsx', content);
console.log('Done.');

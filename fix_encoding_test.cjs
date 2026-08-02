const fs = require('fs');
const str = "Ø·Â§Ø¸Ù¹Ø·Ú¾Ø¸â€¦"; 
const bytes = Buffer.from(str, 'latin1');
const decoder = new TextDecoder('windows-1256');
console.log('As Windows-1256:', decoder.decode(bytes));

/**
 * Verify that pythonApi has the generateDetailedOutlines method
 * Run this in Node.js or browser console
 */

// Read the pythonApi.ts file and check for the method
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'lib', 'pythonApi.ts');
const content = fs.readFileSync(filePath, 'utf8');

console.log('=== Checking pythonApi.ts ===\n');

// Check for class definition
if (content.includes('class PythonApiClient')) {
    console.log('✓ PythonApiClient class found');
} else {
    console.log('✗ PythonApiClient class NOT found');
}

// Check for generateDetailedOutlines method
if (content.includes('async generateDetailedOutlines(')) {
    console.log('✓ generateDetailedOutlines method found');
    
    // Extract the method signature
    const methodMatch = content.match(/async generateDetailedOutlines\([^)]+\)/);
    if (methodMatch) {
        console.log('  Signature:', methodMatch[0]);
    }
} else {
    console.log('✗ generateDetailedOutlines method NOT found');
}

// Check for streamRequestWithProgress method
if (content.includes('async streamRequestWithProgress(')) {
    console.log('✓ streamRequestWithProgress method found');
} else {
    console.log('✗ streamRequestWithProgress method NOT found');
}

// Check for singleton export
if (content.includes('export const pythonApi = new PythonApiClient()')) {
    console.log('✓ pythonApi singleton export found');
} else {
    console.log('✗ pythonApi singleton export NOT found');
}

// Count all async methods in the class
const asyncMethods = content.match(/async \w+\(/g);
if (asyncMethods) {
    console.log(`\n✓ Total async methods: ${asyncMethods.length}`);
    console.log('  Methods:', asyncMethods.map(m => m.replace('async ', '').replace('(', '')).join(', '));
}

console.log('\n=== Summary ===');
console.log('If all checks pass, the method exists in the source code.');
console.log('If the browser still shows "not a function", try:');
console.log('1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)');
console.log('2. Clear browser cache');
console.log('3. Restart the dev server');
console.log('4. Check browser console for import errors');

// extract-hopscotch-json.js
const fs = require('fs');
const AdmZip = require('adm-zip');
const path = require('path');

function processZipOrHTML(inputPath) {
    const ext = path.extname(inputPath).toLowerCase();
    let htmlContent;
    
    if (ext === '.zip') {
        const zip = new AdmZip(inputPath);
        const zipEntries = zip.getEntries();
        
        // Find the HTML file in the zip
        const htmlEntry = zipEntries.find(entry => 
            entry.entryName.endsWith('.html')
        );
        
        if (!htmlEntry) {
            throw new Error('No HTML file found in zip archive');
        }
        
        htmlContent = htmlEntry.getData().toString('utf8');
    } else if (ext === '.html') {
        htmlContent = fs.readFileSync(inputPath, 'utf8');
    } else {
        throw new Error(`Unsupported file type: ${ext}. Expected .html or .zip file`);
    }
    
    // Validate it's actually Hopscotch HTML
    if (!htmlContent.includes('data=') || !htmlContent.includes('hopscotch')) {
        throw new Error('File does not appear to be a Hopscotch HTML export');
    }
    
    return htmlContent;
}

function extractJSON(htmlContent) {
    // Find the data attribute (handle both quote styles)
    const dataMatch = htmlContent.match(/data=(['"])/);
    if (!dataMatch) {
        throw new Error('Could not find data attribute in HTML');
    }
    
    const quoteChar = dataMatch[1];
    const dataStart = htmlContent.indexOf(dataMatch[0]) + dataMatch[0].length;
    
    // Find the opening brace
    let jsonStart = htmlContent.indexOf('{', dataStart);
    if (jsonStart === -1) {
        throw new Error('Could not find JSON opening brace');
    }
    
    // Match braces to find the closing one
    let braceCount = 1;
    let i = jsonStart + 1;
    let inString = false;
    let escapeNext = false;
    
    while (i < htmlContent.length && braceCount > 0) {
        const char = htmlContent[i];
        
        if (escapeNext) {
            escapeNext = false;
        } else if (char === '\\') {
            escapeNext = true;
        } else if (char === '"' && !inString) {
            inString = true;
        } else if (char === '"' && inString) {
            inString = false;
        } else if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
        }
        
        i++;
    }
    
    if (braceCount !== 0) {
        throw new Error('Mismatched braces in JSON');
    }
    
    let jsonString = htmlContent.substring(jsonStart, i);
    
    // Decode HTML entities if using double quotes
    if (quoteChar === '"') {
        jsonString = jsonString
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'");
    }
    
    return jsonString;
}

// CLI handling
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: node extract-hopscotch-json.js <htmlfile> [--output <outputfile>]');
        process.exit(1);
    }
    
    const inputFile = args[0];
    const outputIndex = args.indexOf('--output');
    const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : null;
    
    try {
        const htmlContent = processZipOrHTML(inputFile);
        const jsonString = extractJSON(htmlContent);
        
        // Validate JSON
        JSON.parse(jsonString);
        
        if (outputFile) {
            fs.writeFileSync(outputFile, jsonString);
            console.log(`Extracted JSON to ${outputFile}`);
        } else {
            console.log(jsonString);
        }
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

module.exports = { extractJSON, processZipOrHTML };
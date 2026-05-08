const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
        results = results.concat(walk(file));
    } else { 
        results.push(file);
    }
  });
  return results;
}

const allFiles = fs.readdirSync('apps').filter(d => fs.statSync('apps/' + d).isDirectory()).flatMap(app => fs.existsSync('apps/' + app + '/src') ? walk('apps/' + app + '/src') : []);
let hasMismatch = false;

allFiles.forEach(file => {
  if (!file.endsWith('.jsx') && !file.endsWith('.js')) return;
  const content = fs.readFileSync(file, 'utf8');
  const imports = [...content.matchAll(/import\s+.*?\s+from\s+['\"](.*?)['\"]/g)].map(m => m[1]);
  
  imports.forEach(imp => {
    if (imp.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), imp);
      const exts = ['', '.js', '.jsx', '.ts', '.tsx', '.css'];
      let foundExact = false;
      let existingFile = '';
      for (const ext of exts) {
        const p = resolved + ext;
        if (fs.existsSync(p)) {
          existingFile = p;
          const dir = path.dirname(p);
          const base = path.basename(p);
          if (fs.readdirSync(dir).includes(base)) {
            foundExact = true;
            break;
          }
        }
      }
      if (existingFile && !foundExact) {
        console.log('Case mismatch:', imp, 'in', file);
        hasMismatch = true;
      }
    }
  });
});

if (!hasMismatch) console.log('No case mismatch found.');

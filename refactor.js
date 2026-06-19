import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('./frontend/src', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Replace deep imports with package import
    const replacements = [
      { regex: /import\s+type\s+\{([^}]+)\}\s+from\s+["'](\.\.\/)*types\/domain["']/g, replacement: 'import type { $1 } from "@toolshare/shared"' },
      { regex: /import\s+\{([^}]+)\}\s+from\s+["'](\.\.\/)*types\/domain["']/g, replacement: 'import { $1 } from "@toolshare/shared"' },
      
      { regex: /import\s+\{([^}]+)\}\s+from\s+["'](\.\.\/)*services\/api["']/g, replacement: 'import { $1 } from "@toolshare/shared"' },
      
      { regex: /import\s+\{([^}]+)\}\s+from\s+["'](\.\.\/)*utils\/categories["']/g, replacement: 'import { $1 } from "@toolshare/shared"' },
      
      { regex: /import\s+\{([^}]+)\}\s+from\s+["'](\.\.\/)*utils\/pluralize["']/g, replacement: 'import { $1 } from "@toolshare/shared"' }
    ];

    replacements.forEach(({ regex, replacement }) => {
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`Updated ${filePath}`);
    }
  }
});

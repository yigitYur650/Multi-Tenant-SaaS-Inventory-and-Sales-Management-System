import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.resolve(__dirname, '../src/locales');
const files = fs.readdirSync(localesDir).filter(file => file.endsWith('.json'));

/**
 * Recursively gets all keys from a nested object
 */
function getAllKeys(obj: any, prefix = ''): string[] {
  return Object.keys(obj).reduce((keys: string[], key: string) => {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], newPrefix));
    } else {
      keys.push(newPrefix);
    }
    return keys;
  }, []);
}

describe('i18n Integrity Test', () => {
  const referenceFile = 'tr.json';
  
  if (!files.includes(referenceFile)) {
    it('should have a reference file tr.json', () => {
      expect(files).toContain(referenceFile);
    });
    return;
  }

  const referencePath = path.join(localesDir, referenceFile);
  const referenceContent = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
  const referenceKeys = getAllKeys(referenceContent).sort();

  files.forEach(file => {
    if (file === referenceFile) return;

    it(`structure of ${file} should match ${referenceFile}`, () => {
      const currentPath = path.join(localesDir, file);
      const currentContent = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
      const currentKeys = getAllKeys(currentContent).sort();

      const missingKeys = referenceKeys.filter(key => !currentKeys.includes(key));
      const extraKeys = currentKeys.filter(key => !referenceKeys.includes(key));

      const failureMessage = [];
      if (missingKeys.length > 0) {
        failureMessage.push(`Missing keys in ${file}:\n  - ${missingKeys.join('\n  - ')}`);
      }
      if (extraKeys.length > 0) {
        failureMessage.push(`Extra keys in ${file}:\n  - ${extraKeys.join('\n  - ')}`);
      }

      if (failureMessage.length > 0) {
        throw new Error(failureMessage.join('\n\n'));
      }

      expect(currentKeys).toEqual(referenceKeys);
    });
  });
});

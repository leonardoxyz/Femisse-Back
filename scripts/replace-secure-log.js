/**
 * Script para substituir secureLog por logger
 * 
 * USO:
 * node scripts/replace-secure-log.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'src');

// Função para verificar se arquivo deve ser processado
function shouldProcessFile(filePath) {
  if (filePath.includes('node_modules')) return false;
  if (!filePath.endsWith('.js')) return false;
  if (filePath.includes('securityUtils.js')) return false; // Pular o arquivo com definição
  return true;
}

// Função para adicionar import do logger se não existir
function ensureLoggerImport(content) {
  // Verifica se já importa logger
  if (content.includes("from '../utils/logger.js'") || 
      content.includes('from "./logger.js"') ||
      content.includes("from '../../utils/logger.js'")) {
    return content;
  }
  
  // Encontra o último import
  const importRegex = /import\s+.*?from\s+['"].*?['"];?\s*\n/g;
  const imports = content.match(importRegex);
  
  if (!imports || imports.length === 0) {
    // Se não houver imports, adiciona no início
    return `import { logger } from '../utils/logger.js';\n\n${content}`;
  }
  
  // Calcula o caminho relativo baseado no conteúdo
  let loggerPath = '../utils/logger.js';
  if (content.includes('controllers/') || content.includes('middleware/')) {
    loggerPath = '../utils/logger.js';
  } else if (content.includes('services/')) {
    loggerPath = '../utils/logger.js';
  }
  
  // Adiciona após o último import
  const lastImport = imports[imports.length - 1];
  const lastImportIndex = content.lastIndexOf(lastImport);
  const insertPosition = lastImportIndex + lastImport.length;
  
  return content.slice(0, insertPosition) + 
         `import { logger } from '${loggerPath}';\n` +
         content.slice(insertPosition);
}

// Função para substituir secureLog por logger
function replaceSecureLog(content) {
  let modified = content;
  let changes = 0;
  
  // Padrão 1: secureLog('Message', { data })
  // Substituir por: logger.info({ data }, 'Message')
  const pattern1 = /secureLog\(\s*['"]([^'"]+)['"]\s*,\s*(\{[^}]+\})\s*\)/g;
  modified = modified.replace(pattern1, (match, message, data) => {
    changes++;
    return `logger.info(${data}, '${message}')`;
  });
  
  // Padrão 2: secureLog('Message')
  // Substituir por: logger.info('Message')
  const pattern2 = /secureLog\(\s*['"]([^'"]+)['"]\s*\)/g;
  modified = modified.replace(pattern2, (match, message) => {
    changes++;
    return `logger.info('${message}')`;
  });
  
  // Padrão 3: secureLog('Error message', { error: ... })
  // Substituir por: logger.error({ err: error }, 'Error message')
  const pattern3 = /secureLog\(\s*['"]([^'"]*[Ee]rror[^'"]*)['"]\s*,\s*\{\s*error:\s*([^}]+)\}\s*\)/g;
  modified = modified.replace(pattern3, (match, message, errorVar) => {
    changes++;
    return `logger.error({ err: ${errorVar.trim()} }, '${message}')`;
  });
  
  // Padrão 4: secureLog com template literal
  const pattern4 = /secureLog\(\s*`([^`]+)`\s*,?\s*([^)]*)\)/g;
  modified = modified.replace(pattern4, (match, message, data) => {
    changes++;
    if (data && data.trim()) {
      return `logger.info(${data.trim()}, \`${message}\`)`;
    }
    return `logger.info(\`${message}\`)`;
  });
  
  return { content: modified, changes };
}

// Função para remover import de secureLog se não usado
function removeSecureLogImport(content) {
  // Remove secureLog do destructuring import
  content = content.replace(/,\s*secureLog\s*,/g, ',');
  content = content.replace(/,\s*secureLog\s*}/g, ' }');
  content = content.replace(/\{\s*secureLog\s*,/g, '{');
  content = content.replace(/\{\s*secureLog\s*\}/g, '');
  
  // Remove linha de import se só tinha secureLog
  content = content.replace(/import\s+\{\s*\}\s+from\s+['"][^'"]+['"];?\s*\n/g, '');
  
  return content;
}

// Função para processar um arquivo
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Verifica se tem secureLog no arquivo
    if (!content.includes('secureLog')) {
      return { processed: false, changes: 0 };
    }
    
    // Adiciona import do logger se necessário
    const hadLogger = content.includes("from '../utils/logger.js'") || 
                      content.includes("from './logger.js'");
    
    if (!hadLogger) {
      content = ensureLoggerImport(content);
    }
    
    // Substitui secureLog por logger
    const { content: modifiedContent, changes } = replaceSecureLog(content);
    
    // Remove import de secureLog se não usado
    let finalContent = removeSecureLogImport(modifiedContent);
    
    if (changes > 0) {
      fs.writeFileSync(filePath, finalContent, 'utf8');
      return { processed: true, changes };
    }
    
    return { processed: false, changes: 0 };
  } catch (error) {
    console.error(`Erro ao processar ${filePath}:`, error.message);
    return { processed: false, changes: 0, error: error.message };
  }
}

// Função para percorrer diretórios recursivamente
function walkDirectory(dir) {
  const files = [];
  
  function walk(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        walk(itemPath);
      } else if (stat.isFile() && shouldProcessFile(itemPath)) {
        files.push(itemPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

// Main
console.log('🔍 Buscando arquivos com secureLog...\n');

const files = walkDirectory(srcDir);
console.log(`📁 Encontrados ${files.length} arquivos para verificar\n`);

let totalProcessed = 0;
let totalChanges = 0;
const processedFiles = [];

for (const file of files) {
  const relativePath = path.relative(process.cwd(), file);
  const result = processFile(file);
  
  if (result.processed) {
    totalProcessed++;
    totalChanges += result.changes;
    processedFiles.push({ file: relativePath, changes: result.changes });
    console.log(`✅ ${relativePath} - ${result.changes} substituições`);
  } else if (result.error) {
    console.log(`❌ ${relativePath} - ERRO: ${result.error}`);
  }
}

console.log(`\n📊 Resumo:`);
console.log(`   Arquivos processados: ${totalProcessed}`);
console.log(`   Total de substituições: ${totalChanges}`);
console.log(`\n✅ Concluído!`);

if (processedFiles.length > 0) {
  console.log(`\n📝 Arquivos modificados:`);
  processedFiles.forEach(({ file, changes }) => {
    console.log(`   - ${file} (${changes} mudanças)`);
  });
}

/**
 * Script para substituir console.log/error/warn por logger
 * 
 * USO:
 * node scripts/replace-console-logs.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'src');

// Arquivos já processados manualmente
const SKIP_FILES = [
  'productsController.js',
  'shippingController.js',
  'logger.js',
  'secureLogger.js', // obsoleto
  'performanceCache.js', // obsoleto
  'advancedRateLimit.js', // obsoleto
  'favoriteController.js', // obsoleto
];

// Função para verificar se arquivo deve ser processado
function shouldProcessFile(filePath) {
  const fileName = path.basename(filePath);
  
  if (SKIP_FILES.includes(fileName)) {
    return false;
  }
  
  if (filePath.includes('node_modules')) {
    return false;
  }
  
  if (!filePath.endsWith('.js')) {
    return false;
  }
  
  return true;
}

// Função para adicionar import do logger se não existir
function ensureLoggerImport(content) {
  // Verifica se já importa logger
  if (content.includes("from '../utils/logger.js'") || 
      content.includes('from "./logger.js"')) {
    return content;
  }
  
  // Encontra o último import
  const importRegex = /import\s+.*?from\s+['"].*?['"];?\s*\n/g;
  const imports = content.match(importRegex);
  
  if (!imports || imports.length === 0) {
    // Se não houver imports, adiciona no início
    return `import { logger } from '../utils/logger.js';\n\n${content}`;
  }
  
  // Adiciona após o último import
  const lastImport = imports[imports.length - 1];
  const lastImportIndex = content.lastIndexOf(lastImport);
  const insertPosition = lastImportIndex + lastImport.length;
  
  return content.slice(0, insertPosition) + 
         `import { logger } from '../utils/logger.js';\n` +
         content.slice(insertPosition);
}

// Função para substituir console.* por logger.*
function replaceConsoleCalls(content) {
  let modified = content;
  let changes = 0;
  
  // Substituir console.error('Mensagem:', error) por logger.error({ err: error }, 'Mensagem')
  const errorRegex = /console\.error\(['"]([^'"]+)['"]\s*,\s*([^)]+)\)/g;
  modified = modified.replace(errorRegex, (match, message, errorVar) => {
    changes++;
    // Remove emojis e dois pontos do final
    const cleanMessage = message.replace(/[\u{1F000}-\u{1F9FF}]/ug, '').replace(/:$/, '').trim();
    return `logger.error({ err: ${errorVar.trim()} }, '${cleanMessage}')`;
  });
  
  // Substituir console.error('Mensagem') por logger.error('Mensagem')
  modified = modified.replace(/console\.error\(['"]([^'"]+)['"]\)/g, (match, message) => {
    changes++;
    const cleanMessage = message.replace(/[\u{1F000}-\u{1F9FF}]/ug, '').replace(/:$/, '').trim();
    return `logger.error('${cleanMessage}')`;
  });
  
  // Substituir console.log('Emoji Mensagem:', data) por logger.info({ data }, 'Mensagem')
  const logWithDataRegex = /console\.log\(['"][\u{1F000}-\u{1F9FF}]?\s*([^'"]+)['"]\s*,\s*([^)]+)\)/ug;
  modified = modified.replace(logWithDataRegex, (match, message, data) => {
    changes++;
    const cleanMessage = message.replace(/[\u{1F000}-\u{1F9FF}]/ug, '').replace(/:$/, '').trim();
    // Tenta identificar nome da variável
    const dataName = data.trim().split('.')[0].split('[')[0];
    return `logger.info({ ${dataName}: ${data.trim()} }, '${cleanMessage}')`;
  });
  
  // Substituir console.log simples
  modified = modified.replace(/console\.log\(['"]([^'"]+)['"]\)/g, (match, message) => {
    changes++;
    const cleanMessage = message.replace(/[\u{1F000}-\u{1F9FF}]/ug, '').replace(/:$/, '').trim();
    // Decide entre info ou debug baseado no conteúdo
    const level = cleanMessage.toLowerCase().includes('erro') || 
                   cleanMessage.toLowerCase().includes('falha') ? 'warn' : 'info';
    return `logger.${level}('${cleanMessage}')`;
  });
  
  // Substituir console.warn
  modified = modified.replace(/console\.warn\(['"]([^'"]+)['"]\s*,?\s*([^)]*)\)/g, (match, message, data) => {
    changes++;
    const cleanMessage = message.replace(/[\u{1F000}-\u{1F9FF}]/ug, '').replace(/:$/, '').trim();
    if (data && data.trim()) {
      const dataName = data.trim().split('.')[0].split('[')[0];
      return `logger.warn({ ${dataName}: ${data.trim()} }, '${cleanMessage}')`;
    }
    return `logger.warn('${cleanMessage}')`;
  });
  
  // Substituir console.info
  modified = modified.replace(/console\.info\(['"]([^'"]+)['"]\)/g, (match, message) => {
    changes++;
    const cleanMessage = message.replace(/[\u{1F000}-\u{1F9FF}]/ug, '').replace(/:$/, '').trim();
    return `logger.info('${cleanMessage}')`;
  });
  
  return { content: modified, changes };
}

// Função para processar um arquivo
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Verifica se tem console.* no arquivo
    if (!content.match(/console\.(log|error|warn|info)/)) {
      return { processed: false, changes: 0 };
    }
    
    // Adiciona import do logger se necessário
    content = ensureLoggerImport(content);
    
    // Substitui console.* por logger.*
    const { content: modifiedContent, changes } = replaceConsoleCalls(content);
    
    if (changes > 0) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
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
console.log('🔍 Buscando arquivos JavaScript no diretório src/...\n');

const files = walkDirectory(srcDir);
console.log(`📁 Encontrados ${files.length} arquivos para processar\n`);

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

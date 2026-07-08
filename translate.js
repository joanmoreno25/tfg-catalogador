const fs = require('fs');
const path = require('path');

const sourceLang = 'es';
const targetLangs = ['en', 'fr', 'it', 'de'];
const localesPath = path.join(__dirname, 'src', 'locales');
const sourceFile = path.join(localesPath, sourceLang, 'translation.json');

async function translateText(text, targetLang) {
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
    const data = await response.json();
    return data.responseData.translatedText;
  } catch (error) {
    console.error(`Error traduciendo "${text}" a ${targetLang}:`, error);
    return text;
  }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función recursiva para navegar por JSON de cualquier profundidad
async function processTranslations(sourceObj, targetObj, lang) {
  let isUpdated = false;
  
  for (const key in sourceObj) {
    // PROTECCIÓN CONTRA PROTOTYPE POLLUTION
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // Si el valor es un objeto (anidación), entramos recursivamente
    if (typeof sourceObj[key] === 'object' && sourceObj[key] !== null) {
      if (!targetObj[key]) targetObj[key] = {};
      const nestedUpdated = await processTranslations(sourceObj[key], targetObj[key], lang);
      if (nestedUpdated) isUpdated = true;
    } else {
      // Si es un texto final, comprobamos si falta la traducción
      if (!targetObj[key]) {
        console.log(`Traduciendo nueva clave: "${key}"...`);
        targetObj[key] = await translateText(sourceObj[key], lang);
        isUpdated = true;
        await delay(500); // Respetar límites de la API
      }
    }
  }
  return isUpdated;
}

async function runTranslations() {
  console.log('Iniciando automatización de traducciones...');
  
  if (!fs.existsSync(sourceFile)) {
    console.error(`No se encuentra el archivo base: ${sourceFile}`);
    return;
  }

  const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));

  for (const lang of targetLangs) {
    console.log(`\nProcesando idioma: ${lang.toUpperCase()}`);
    
    const targetDir = path.join(localesPath, lang);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const targetFile = path.join(targetDir, 'translation.json');
    let targetData = {};

    if (fs.existsSync(targetFile)) {
      targetData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    }

    // Llamamos a la nueva función recursiva
    const updated = await processTranslations(sourceData, targetData, lang);

    if (updated) {
      fs.writeFileSync(targetFile, JSON.stringify(targetData, null, 2), 'utf8');
      console.log(`✅ Archivo ${lang}/translation.json actualizado con éxito.`);
    } else {
      console.log(`⚡ El archivo ${lang}/translation.json ya estaba al día.`);
    }
  }
  console.log('\n¡Proceso de traducción finalizado!');
}

runTranslations();
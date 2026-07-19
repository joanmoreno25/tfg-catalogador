const fs = require('fs');
const path = require('path');

const sourceLang = 'es';
const targetLangs = ['en', 'fr', 'it', 'de'];
const localesPath = path.join(__dirname, 'src', 'locales');
const sourceFile = path.join(localesPath, sourceLang, 'translation.json');

/**
 * Translates a given text to the target language using the MyMemory API.
 * 
 * @param {string} text - The text to be translated.
 * @param {string} targetLang - The target language code.
 * @returns {Promise<string>} The translated text, or the original text if an error occurs.
 */
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

/**
 * Delays execution for a specified number of milliseconds.
 * 
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise<void>} A promise that resolves after the given delay.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Recursively processes and translates missing keys in a nested JSON object.
 * 
 * @param {Object} sourceObj - The source translation object.
 * @param {Object} targetObj - The target translation object being built or updated.
 * @param {string} lang - The target language code.
 * @returns {Promise<boolean>} True if any new translations were added, false otherwise.
 */
async function processTranslations(sourceObj, targetObj, lang) {
  let isUpdated = false;
  
  for (const key in sourceObj) {
    // PROTOTYPE POLLUTION PROTECTION
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // If the value is an object (nested), traverse recursively
    if (typeof sourceObj[key] === 'object' && sourceObj[key] !== null) {
      if (!targetObj[key]) targetObj[key] = {};
      const nestedUpdated = await processTranslations(sourceObj[key], targetObj[key], lang);
      if (nestedUpdated) isUpdated = true;
    } else {
      // If it's a final string value, check if the translation is missing
      if (!targetObj[key]) {
        console.log(`Traduciendo nueva clave: "${key}"...`);
        targetObj[key] = await translateText(sourceObj[key], lang);
        isUpdated = true;
        await delay(500); // Respect API rate limits
      }
    }
  }
  return isUpdated;
}

/**
 * Main function to execute the automated translation process across all target languages.
 * 
 * @returns {Promise<void>}
 */
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

    // Call the recursive processing function
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
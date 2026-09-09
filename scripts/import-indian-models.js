import fs from 'fs';
import path from 'path';

const rootDir = 'd:/new_website/skin_website';
const devicesPath = path.join(rootDir, 'data/devices.json');
const currentDevices = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));

// Keep laptops from existing devices
const laptopDevices = currentDevices.filter(d => d.type === 'laptop');

const RAW_BASE = 'https://raw.githubusercontent.com/KHwang9883/MobileModels/master/brands/';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[+]/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchText(fileName) {
  console.log(`Fetching ${fileName}...`);
  const res = await fetch(`${RAW_BASE}${fileName}`);
  if (!res.ok) throw new Error(`Failed to fetch ${fileName}: ${res.statusText}`);
  return res.text();
}

async function parseAll() {
  const modelsMap = new Map(); // id -> device object

  function addModel(brand, name, aliases = [], cutterStatus = 'available') {
    // Clean name
    let cleanName = name
      .replace(/\s*\(India\)\s*/gi, '')
      .replace(/\s*India\s*/gi, '')
      .replace(/\s*Global\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanName || cleanName.length < 3) return;

    // Normalise brand in name
    if (brand === 'apple' && !cleanName.startsWith('iPhone')) cleanName = `iPhone ${cleanName}`;
    if (brand === 'samsung' && !cleanName.startsWith('Galaxy')) cleanName = `Galaxy ${cleanName}`;
    if (brand === 'oneplus' && !cleanName.startsWith('OnePlus')) cleanName = `OnePlus ${cleanName}`;
    if (brand === 'realme' && !cleanName.toLowerCase().startsWith('realme')) cleanName = `Realme ${cleanName}`;
    if (brand === 'oppo' && !cleanName.startsWith('OPPO')) cleanName = `OPPO ${cleanName}`;
    if (brand === 'vivo' && !cleanName.toLowerCase().startsWith('vivo')) cleanName = `Vivo ${cleanName}`;
    if (brand === 'iqoo' && !cleanName.toLowerCase().startsWith('iqoo')) cleanName = `iQOO ${cleanName}`;
    if (brand === 'poco' && !cleanName.toLowerCase().startsWith('poco')) cleanName = `POCO ${cleanName}`;
    if (brand === 'redmi' && !cleanName.toLowerCase().startsWith('redmi')) cleanName = `Redmi ${cleanName}`;
    if (brand === 'xiaomi' && !cleanName.toLowerCase().startsWith('xiaomi') && !cleanName.toLowerCase().startsWith('mi ')) cleanName = `Xiaomi ${cleanName}`;

    const id = slugify(cleanName);
    if (!id) return;

    if (modelsMap.has(id)) {
      // Merge aliases
      const existing = modelsMap.get(id);
      aliases.forEach(a => {
        if (a && !existing.aliases.includes(a)) existing.aliases.push(a);
      });
    } else {
      modelsMap.set(id, {
        id,
        type: 'phone',
        brand,
        name: cleanName,
        aliases: aliases.filter(Boolean),
        cutterStatus
      });
    }
  }

  // ─── 1. Apple (apple_all_en.md) ──────────────────────────────────
  try {
    const appleText = await fetchText('apple_all_en.md');
    const appleLines = appleText.split('\n');
    let currentApple = '';
    for (const line of appleLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('**') && trimmed.includes('iPhone')) {
        const m = trimmed.match(/iPhone\s*([^`(*]+)/i);
        if (m) {
          currentApple = `iPhone ${m[1].trim()}`;
        }
      }
      if (currentApple && trimmed.startsWith('`A')) {
        const codes = (trimmed.match(/`([^`]+)`/g) || []).map(c => c.replace(/`/g, ''));
        // Only keep iPhone 11 and newer + SE
        if (/iPhone (1[1-6]|SE)/i.test(currentApple)) {
          addModel('apple', currentApple, codes, 'available');
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Apple:', e.message);
  }

  // ─── 2. OnePlus (oneplus_en.md) ──────────────────────────────────
  try {
    const opText = await fetchText('oneplus_en.md');
    const opLines = opText.split('\n');
    for (const line of opLines) {
      if (/india/i.test(line)) {
        const m = line.match(/`([^`]+)`:\s*(.+)/);
        if (m) {
          const code = m[1].trim();
          const name = m[2].trim();
          addModel('oneplus', name, [code], 'available');
        }
      }
    }
  } catch (e) {
    console.error('Error parsing OnePlus:', e.message);
  }

  // ─── 3. Xiaomi / Redmi / POCO (xiaomi_en.md) ─────────────────────
  try {
    const miText = await fetchText('xiaomi_en.md');
    const miLines = miText.split('\n');
    for (const line of miLines) {
      if (/india/i.test(line)) {
        const m = line.match(/`([^`]+)`:\s*(.+)/);
        if (m) {
          const code = m[1].trim();
          let name = m[2].trim();
          let brand = 'xiaomi';
          if (/redmi/i.test(name)) brand = 'redmi';
          else if (/poco/i.test(name)) brand = 'poco';
          addModel(brand, name, [code], 'available');
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Xiaomi:', e.message);
  }

  // ─── 4. Realme (realme_global_en.md) ─────────────────────────────
  try {
    const realmeText = await fetchText('realme_global_en.md');
    const realmeLines = realmeText.split('\n');
    let currentModel = '';
    for (const line of realmeLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('**') && trimmed.includes('realme')) {
        const m = trimmed.match(/\*\*([^*]+)\*\*/);
        if (m) currentModel = m[1].replace(/:\s*$/, '').replace(/\([^)]+\)/, '').trim();
      }
      if (currentModel) {
        const codes = (trimmed.match(/`([^`]+)`/g) || []).map(c => c.replace(/`/g, ''));
        addModel('realme', currentModel, codes, 'available');
      }
    }
  } catch (e) {
    console.error('Error parsing Realme:', e.message);
  }

  // ─── 5. Samsung (samsung_global_en.md) ───────────────────────────
  try {
    const samText = await fetchText('samsung_global_en.md');
    const samLines = samText.split('\n');
    for (const line of samLines) {
      if (/india/i.test(line) || /global/i.test(line)) {
        const m = line.match(/`([^`]+)`:\s*(.+)/);
        if (m) {
          const code = m[1].trim();
          const name = m[2].trim();
          // Filter modern Samsung series (S10-S25, Note10-Note20, A series, M series, F series, Z Fold/Flip)
          if (/Galaxy (S1[0-9]|S2[0-9]|Note|Z|A[0-9]|M[0-9]|F[0-9])/i.test(name)) {
            addModel('samsung', name, [code], 'available');
          }
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Samsung:', e.message);
  }

  // ─── 6. Vivo & iQOO (vivo_global_en.md) ──────────────────────────
  try {
    const vivoText = await fetchText('vivo_global_en.md');
    const vivoLines = vivoText.split('\n');
    let currentVivo = '';
    for (const line of vivoLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('**') && (trimmed.includes('vivo') || trimmed.includes('iQOO'))) {
        const m = trimmed.match(/\*\*([^*]+)\*\*/);
        if (m) currentVivo = m[1].replace(/:\s*$/, '').replace(/\([^)]+\)/, '').trim();
      }
      if (currentVivo) {
        const codes = (trimmed.match(/`([^`]+)`/g) || []).map(c => c.replace(/`/g, ''));
        const brand = /iqoo/i.test(currentVivo) ? 'iqoo' : 'vivo';
        addModel(brand, currentVivo, codes, 'available');
      }
    }
  } catch (e) {
    console.error('Error parsing Vivo:', e.message);
  }

  // ─── 7. OPPO (oppo_global_en.md) ─────────────────────────────────
  try {
    const oppoText = await fetchText('oppo_global_en.md');
    const oppoLines = oppoText.split('\n');
    let currentOppo = '';
    for (const line of oppoLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('**') && trimmed.includes('OPPO')) {
        const m = trimmed.match(/\*\*([^*]+)\*\*/);
        if (m) currentOppo = m[1].replace(/:\s*$/, '').replace(/\([^)]+\)/, '').trim();
      }
      if (currentOppo) {
        const codes = (trimmed.match(/`([^`]+)`/g) || []).map(c => c.replace(/`/g, ''));
        addModel('oppo', currentOppo, codes, 'available');
      }
    }
  } catch (e) {
    console.error('Error parsing OPPO:', e.message);
  }

  // Combine with existing phone devices if not already present
  const existingPhones = currentDevices.filter(d => d.type === 'phone');
  existingPhones.forEach(ep => {
    if (!modelsMap.has(ep.id)) {
      modelsMap.set(ep.id, ep);
    } else {
      // Merge aliases
      const current = modelsMap.get(ep.id);
      ep.aliases?.forEach(a => {
        if (!current.aliases.includes(a)) current.aliases.push(a);
      });
      current.cutterStatus = ep.cutterStatus || current.cutterStatus;
    }
  });

  const allPhoneModels = Array.from(modelsMap.values());
  console.log(`Parsed ${allPhoneModels.length} Indian phone models!`);

  // Combine phone devices + laptop devices
  const finalDevices = [...allPhoneModels, ...laptopDevices];

  // Save to devices.json
  fs.writeFileSync(devicesPath, JSON.stringify(finalDevices, null, 2), 'utf8');
  console.log(`Saved ${finalDevices.length} total devices to ${devicesPath}`);

  // Summary by brand
  const countByBrand = {};
  allPhoneModels.forEach(m => {
    countByBrand[m.brand] = (countByBrand[m.brand] || 0) + 1;
  });
  console.log('Indian Phone Models by Brand:', countByBrand);
}

parseAll();

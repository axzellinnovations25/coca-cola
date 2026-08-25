const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const pool = require('../db');

function decodeXml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripTags(value) {
  return decodeXml(String(value || '').replace(/<[^>]+>/g, ''));
}

function normalizeName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\bFREE\b/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeShopName(value) {
  return normalizeName(value)
    .replace(/\bPALPORULVANIPAM\b/g, 'PALPORUL VANIPAM')
    .replace(/\bFRUITS\b/g, 'FRUIT')
    .replace(/\bMANTHIGAI\b/g, 'MANTHIKAI')
    .replace(/\bSATHA PONS\b/g, 'SATHAPONS')
    .replace(/\bANUSKA\b/g, 'ANUSHKA')
    .replace(/\bSUTHANY\b/g, 'SUTHANI')
    .replace(/\b\(?(?:K|R|S|DI|DEE|VVT|KKS|MATHONY|THONDDAMANARU)\)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProductName(value) {
  const normalized = normalizeName(value)
    .replace(/\bCOCA COLA\b/g, 'COKE')
    .replace(/\bFANTA ORANGE\b/g, 'FANTA')
    .replace(/\bFANTA PORTELLO\b/g, 'PORTELLO')
    .replace(/\bGINGER BEER\b/g, 'GINGER')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized
    .split(' ')
    .filter(token => !['16'].includes(token))
    .sort()
    .join(' ');
}

function excelDateToIso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return date.toISOString().slice(0, 10);
}

function extractWorkbook(buffer) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-xlsx-'));
  const zipPath = path.join(tmpRoot, 'workbook.zip');
  fs.writeFileSync(zipPath, buffer);
  const psQuote = value => `'${String(value).replace(/'/g, "''")}'`;
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath ${psQuote(zipPath)} -DestinationPath ${psQuote(tmpRoot)} -Force`,
  ], { stdio: 'pipe' });
  return tmpRoot;
}

function readSharedStrings(rootDir) {
  const file = path.join(rootDir, 'xl', 'sharedStrings.xml');
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, 'utf8');
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => (
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map(t => stripTags(t[1]))
      .join('')
  ));
}

function readYellowStyleIds(rootDir) {
  const file = path.join(rootDir, 'xl', 'styles.xml');
  if (!fs.existsSync(file)) return new Set();
  const xml = fs.readFileSync(file, 'utf8');
  const fillsMatch = xml.match(/<fills\b[^>]*>([\s\S]*?)<\/fills>/);
  const yellowFillIds = new Set();
  if (fillsMatch) {
    [...fillsMatch[1].matchAll(/<fill\b[^>]*>([\s\S]*?)<\/fill>/g)].forEach((match, index) => {
      if (/fgColor\b[^>]*rgb="FFFFFF00"/i.test(match[1])) yellowFillIds.add(index);
    });
  }

  const cellXfsMatch = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
  const yellowStyleIds = new Set();
  if (cellXfsMatch) {
    [...cellXfsMatch[1].matchAll(/<xf\b([^>]*)\/?>/g)].forEach((match, index) => {
      const fillId = Number((match[1].match(/\bfillId="(\d+)"/) || [])[1]);
      if (yellowFillIds.has(fillId)) yellowStyleIds.add(index);
    });
  }
  return yellowStyleIds;
}

function readSheets(rootDir) {
  const workbook = fs.readFileSync(path.join(rootDir, 'xl', 'workbook.xml'), 'utf8');
  const rels = fs.readFileSync(path.join(rootDir, 'xl', '_rels', 'workbook.xml.rels'), 'utf8');
  const relMap = new Map([...rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)]
    .map(match => [match[1], match[2]]));
  return [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(match => ({
    name: decodeXml(match[1]),
    file: path.join(rootDir, 'xl', relMap.get(match[2])),
  }));
}

function readRows(sheetFile, sharedStrings, yellowStyleIds) {
  const xml = fs.readFileSync(sheetFile, 'utf8');
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = { number: Number(rowMatch[1]), cells: {}, isYellow: false };
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] || '';
      const ref = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      const styleId = Number((attrs.match(/\bs="(\d+)"/) || [])[1]);
      if (yellowStyleIds.has(styleId)) row.isYellow = true;
      const type = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      const raw = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
      let value = raw;
      if (type === 's') value = sharedStrings[Number(raw)] || '';
      if (type === 'inlineStr') value = stripTags(body);
      row.cells[ref] = typeof value === 'string' ? decodeXml(value).trim() : value;
    }
    rows.push(row);
  }
  return rows;
}

function parseWorkbook(buffer) {
  const rootDir = extractWorkbook(buffer);
  try {
    const sharedStrings = readSharedStrings(rootDir);
    const yellowStyleIds = readYellowStyleIds(rootDir);
    const sheets = readSheets(rootDir);
    const vouchers = [];
    for (const sheet of sheets) {
      let current = null;
      for (const row of readRows(sheet.file, sharedStrings, yellowStyleIds)) {
        if (row.number <= 5) continue;
        const c = row.cells;
        if (c.A && c.B && c.C) {
          current = {
            repName: sheet.name.trim(),
            date: excelDateToIso(c.A),
            billNo: String(c.B).trim(),
            shopName: String(c.C).trim(),
            isYellow: row.isYellow,
            yellowRows: row.isYellow ? [row.number] : [],
            items: [],
          };
          vouchers.push(current);
        }
        if (!current || !c.D) continue;
        if (row.isYellow && !current.yellowRows.includes(row.number)) {
          current.isYellow = true;
          current.yellowRows.push(row.number);
        }
        const qty = Number(c.H || c.E || 0);
        const unitPrice = Number(c.J || c.G || 0);
        const amount = Number(c.K || 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        current.items.push({
          sourceName: String(c.D).trim(),
          quantity: qty,
          unit_price: unitPrice,
          amount,
          isFree: unitPrice === 0 || amount === 0 || /\bFREE\b/i.test(String(c.D)),
        });
      }
    }
    return vouchers.filter(voucher => voucher.items.length > 0);
  } finally {
    const resolved = path.resolve(rootDir);
    if (resolved.startsWith(path.resolve(os.tmpdir()))) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

function buildLookup(rows, normalizer) {
  const map = new Map();
  for (const row of rows) {
    const key = normalizer(row.name);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function pickSingle(map, key) {
  const matches = map.get(key) || [];
  return matches.length === 1 ? matches[0] : null;
}

function pickShop(map, key, repId) {
  const matches = map.get(key) || [];
  if (matches.length === 1) return matches[0];
  const repMatches = matches.filter(shop => shop.sales_rep_id === repId);
  return repMatches.length === 1 ? repMatches[0] : null;
}

function repKeys(user) {
  return [
    normalizeName(`${user.first_name || ''} ${user.last_name || ''}`),
    normalizeName(user.first_name || ''),
    normalizeName(user.last_name || ''),
  ].filter(Boolean);
}

const productAliases = new Map([
  ['250 COKE 16', '250ML COCA COLA'],
  ['250 CREAM SODA 16', '250ML FANTA CREAM'],
  ['250 CHARGED 16', '250ML CHARGED'],
  ['250 FANTA 16', '250ML FANTA ORANGE'],
  ['250 GINGER 16', '250ML LION GINGER BEER'],
  ['250 PORTELLO 16', '250ML FANTA PORTELLO'],
  ['250 SPRITE 16', '250ML SPRITE'],
  ['FANTA CREAM SODA 1 5L', '1.5L FANTA CREAM'],
  ['FANTA CREAM SODA 1050ML', '1050ML FANTA CREAM'],
  ['FANTA CREAM SODA 175ML', '175ML FANTA CREAM'],
  ['FANTA CREAM SODA 400ML', '400ML FANTA CREAM'],
  ['LION CLUB SODA 1050ML', '1050ML LION CLUB'],
  ['LION CLUB SODA 400ML', '400ML LION CLUB'],
  ['TIN COCA COLA 250ML', '250ML TIN COCA COLA'],
  ['TIN SPRITE 250ML', '250ML TIN SPRITE'],
  ['ZERO COC 1050ML', '1050ML ZERO COCA COLA'],
  ['ZERO COC 400ML', '400ML ZERO COCA COLA'],
  ['1 5 COKE', '1.5L COCA COLA'],
  ['1 5 FANTA PORTELLO', '1.5L FANTA PORTELLO'],
  ['1050 CLUB SODA', '1050ML LION CLUB'],
  ['1050 FANTA', '1050ML FANTA ORANGE'],
  ['1050 FANTA CREAM', '1050ML FANTA CREAM'],
  ['1050 ZERO COKE', '1050ML ZERO COCA COLA'],
  ['175 CREAM', '175ML FANTA CREAM'],
  ['175 PORTELLO', '175ML FANTA PORTELLO'],
  ['250 COKE16', '250ML COCA COLA'],
  ['250 CREAM SODA', '250ML FANTA CREAM'],
  ['250 GINGER BEER', '250ML LION GINGER BEER'],
  ['250 MLSPRITE 16', '250ML SPRITE'],
  ['250 SPRITE TIN', '250ML TIN SPRITE'],
  ['400 CLUB SODA', '400ML LION CLUB'],
  ['SPRITE 1050L', '1050ML SPRITE'],
]);

async function analyzeSalesWorkbook({ fileBase64, includeYellow = false }) {
  if (!fileBase64) throw new Error('Workbook file is required');
  const base64 = String(fileBase64).replace(/^data:.*?;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw new Error('Workbook file is empty');

  const vouchers = parseWorkbook(buffer);
  const [usersRes, shopsRes, productsRes] = await Promise.all([
    pool.query("SELECT id, first_name, last_name, email FROM users WHERE role = 'representative'"),
    pool.query(`
      SELECT s.*, u.first_name AS sales_rep_first_name, u.last_name AS sales_rep_last_name
      FROM shops s
      LEFT JOIN users u ON s.sales_rep_id = u.id
    `),
    pool.query('SELECT id, name, unit_price, stock, reserved_stock, (stock - reserved_stock) AS available_stock FROM products'),
  ]);

  const repsByName = new Map();
  for (const user of usersRes.rows) {
    for (const key of repKeys(user)) repsByName.set(key, user);
  }
  const repAliases = new Map([['RATHAN', 'KUGARTHAN']]);
  const shopsByName = buildLookup(shopsRes.rows, normalizeName);
  const shopsByNormalizedName = buildLookup(shopsRes.rows, normalizeShopName);
  const productsByName = buildLookup(productsRes.rows, normalizeProductName);

  const candidates = vouchers.filter(voucher => includeYellow || !voucher.isYellow);
  const invoices = candidates.map((voucher, index) => {
    const warnings = [];
    const repKey = normalizeName(voucher.repName);
    const representative = repsByName.get(repKey) || repsByName.get(repAliases.get(repKey));
    if (!representative) warnings.push(`Representative not matched: ${voucher.repName}`);

    const shop = pickShop(shopsByName, normalizeName(voucher.shopName), representative && representative.id)
      || pickShop(shopsByNormalizedName, normalizeShopName(voucher.shopName), representative && representative.id);
    if (!shop) warnings.push(`Shop not matched: ${voucher.shopName}`);

    const items = [];
    for (const sourceItem of voucher.items) {
      if (normalizeName(sourceItem.sourceName) === 'TOTALS') continue;
      const aliasProductName = productAliases.get(normalizeName(sourceItem.sourceName));
      const product = (aliasProductName && pickSingle(productsByName, normalizeProductName(aliasProductName)))
        || pickSingle(productsByName, normalizeProductName(sourceItem.sourceName));
      if (!product) {
        warnings.push(`Product not matched: ${sourceItem.sourceName}`);
        items.push({
          product_id: '',
          name: sourceItem.sourceName,
          source_name: sourceItem.sourceName,
          unit_price: sourceItem.unit_price,
          quantity: sourceItem.isFree ? 0 : sourceItem.quantity,
          free_quantity: sourceItem.isFree ? sourceItem.quantity : 0,
          matched: false,
        });
        continue;
      }
      items.push({
        product_id: product.id,
        name: product.name,
        source_name: sourceItem.sourceName,
        unit_price: sourceItem.unit_price,
        quantity: sourceItem.isFree ? 0 : sourceItem.quantity,
        free_quantity: sourceItem.isFree ? sourceItem.quantity : 0,
        available_stock: Number(product.available_stock || 0),
        matched: true,
      });
    }

    return {
      preview_id: `${voucher.repName}-${voucher.billNo}-${index}`,
      repName: voucher.repName,
      billNo: voucher.billNo,
      date: voucher.date,
      sourceShopName: voucher.shopName,
      isYellow: voucher.isYellow,
      yellowRows: voucher.yellowRows,
      representative: representative || null,
      shop: shop ? {
        ...shop,
        name: String(shop.name || ''),
        address: String(shop.address || ''),
        phone: String(shop.phone || ''),
      } : null,
      notes: `Imported from uploaded sales workbook; bill ${voucher.billNo}`,
      items,
      total: Number(items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0).toFixed(2)),
      warnings,
    };
  });

  return {
    totalVouchersInWorkbook: vouchers.length,
    excludedYellowVouchers: vouchers.filter(voucher => voucher.isYellow).length,
    invoices,
    shops: shopsRes.rows.map(shop => ({
      ...shop,
      name: String(shop.name || ''),
      address: String(shop.address || ''),
      phone: String(shop.phone || ''),
    })),
    products: productsRes.rows,
    representatives: usersRes.rows,
  };
}

module.exports = {
  analyzeSalesWorkbook,
};

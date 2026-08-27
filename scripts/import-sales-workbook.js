const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

require('../server/node_modules/dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const pool = require('../server/src/db');
const productService = require('../server/src/services/productService');

const WORKBOOK = path.join(__dirname, '..', 'reports', '22.08.2026 SALES.xlsx');
const IMPORT_ADMIN_EMAIL = process.env.IMPORT_ADMIN_EMAIL || null;
const APPLY = process.argv.includes('--apply');
const SKIP_UNMATCHED = process.argv.includes('--skip-unmatched');
const ONLY_BILLS_ARG = process.argv.find(arg => arg.startsWith('--only-bills='));
const ONLY_BILLS = new Set(
  ONLY_BILLS_ARG
    ? ONLY_BILLS_ARG.slice('--only-bills='.length).split(',').map(value => value.trim()).filter(Boolean)
    : []
);

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

function extractWorkbook(filePath) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sales-xlsx-'));
  const zipPath = path.join(tmpRoot, 'workbook.zip');
  fs.copyFileSync(filePath, zipPath);
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
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => {
    return [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map(t => stripTags(t[1]))
      .join('');
  });
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

function parseWorkbook(filePath) {
  const rootDir = extractWorkbook(filePath);
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

function levenshtein(a, b) {
  const left = String(a || '');
  const right = String(b || '');
  const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= right.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[left.length][right.length];
}

function repKeys(user) {
  return [
    normalizeName(`${user.first_name || ''} ${user.last_name || ''}`),
    normalizeName(user.first_name || ''),
    normalizeName(user.last_name || ''),
  ].filter(Boolean);
}

async function main() {
  const vouchers = parseWorkbook(WORKBOOK);
  const [usersRes, shopsRes, productsRes, adminRes] = await Promise.all([
    pool.query("SELECT id, first_name, last_name, email FROM users WHERE role = 'representative'"),
    pool.query('SELECT id, name, sales_rep_id FROM shops'),
    pool.query('SELECT id, name, stock, reserved_stock FROM products'),
    IMPORT_ADMIN_EMAIL
      ? pool.query("SELECT id, email FROM users WHERE email = $1 AND role IN ('admin', 'superadmin') LIMIT 1", [IMPORT_ADMIN_EMAIL])
      : pool.query("SELECT id, email FROM users WHERE role IN ('admin', 'superadmin') ORDER BY role = 'superadmin' DESC, created_at ASC LIMIT 1"),
  ]);

  const repsByName = new Map();
  for (const user of usersRes.rows) {
    for (const key of repKeys(user)) repsByName.set(key, user);
  }
  const repAliases = new Map([
    ['RATHAN', 'KUGARTHAN'],
  ]);
  const shopsByName = buildLookup(shopsRes.rows, normalizeName);
  const shopsByNormalizedName = buildLookup(shopsRes.rows, normalizeShopName);
  const productsByName = buildLookup(productsRes.rows, normalizeProductName);
  const productsByDbName = new Map(productsRes.rows.map(product => [normalizeName(product.name), product]));
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
    ['250 CHARGED 16', '250ML CHARGED'],
    ['250 COKE16', '250ML COCA COLA'],
    ['250 CREAM SODA', '250ML FANTA CREAM'],
    ['250 FANTA 16', '250ML FANTA ORANGE'],
    ['250 GINGER BEER', '250ML LION GINGER BEER'],
    ['250 MLSPRITE 16', '250ML SPRITE'],
    ['250 PORTELLO 16', '250ML FANTA PORTELLO'],
    ['250 SPRITE TIN', '250ML TIN SPRITE'],
    ['400 CLUB SODA', '400ML LION CLUB'],
    ['SPRITE 1050L', '1050ML SPRITE'],
  ]);
  const unmatched = { reps: new Set(), shops: new Set(), products: new Set() };
  const shopMisses = new Map();
  const productMisses = new Map();
  const prepared = [];
  const skippedUnmatched = [];
  const excludedYellow = vouchers.filter(voucher => voucher.isYellow);
  const candidateVouchers = vouchers.filter(voucher =>
    !voucher.isYellow && (ONLY_BILLS.size === 0 || ONLY_BILLS.has(String(voucher.billNo).trim()))
  );

  for (const voucher of candidateVouchers) {
    const repKey = normalizeName(voucher.repName);
    const rep = repsByName.get(repKey) || repsByName.get(repAliases.get(repKey));
    if (!rep) unmatched.reps.add(voucher.repName);
    const shop = pickShop(shopsByName, normalizeName(voucher.shopName), rep && rep.id)
      || pickShop(shopsByNormalizedName, normalizeShopName(voucher.shopName), rep && rep.id);
    if (!shop) {
      unmatched.shops.add(voucher.shopName);
      const sourceKey = normalizeShopName(voucher.shopName);
      const candidates = shopsRes.rows
        .map(shopRow => ({
          name: shopRow.name,
          id: shopRow.id,
          sales_rep_id: shopRow.sales_rep_id,
          score: levenshtein(sourceKey, normalizeShopName(shopRow.name)),
        }))
        .sort((a, b) => a.score - b.score)
        .slice(0, 5);
      shopMisses.set(voucher.shopName, { sourceKey, rep: rep ? `${rep.first_name} ${rep.last_name}` : null, candidates });
    }

    const items = [];
    let expectedItemRows = 0;
    for (const item of voucher.items) {
      if (normalizeName(item.sourceName) === 'TOTALS') continue;
      expectedItemRows += 1;
      const aliasProductName = productAliases.get(normalizeName(item.sourceName));
      const product = (aliasProductName && pickSingle(productsByName, normalizeProductName(aliasProductName)))
        || pickSingle(productsByName, normalizeProductName(item.sourceName));
      if (!product) {
        unmatched.products.add(item.sourceName);
        productMisses.set(item.sourceName, {
          sourceKey: normalizeName(item.sourceName),
          aliasProductName: aliasProductName || null,
          aliasKey: aliasProductName ? normalizeProductName(aliasProductName) : null,
          sourceProductKey: normalizeProductName(item.sourceName),
          aliasMatches: aliasProductName ? (productsByName.get(normalizeProductName(aliasProductName)) || []).map(product => product.name) : [],
          sourceMatches: (productsByName.get(normalizeProductName(item.sourceName)) || []).map(product => product.name),
        });
        continue;
      }
      items.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        source_name: item.sourceName,
      });
    }

    if (SKIP_UNMATCHED && (!rep || !shop || items.length !== expectedItemRows)) {
      skippedUnmatched.push({
        repName: voucher.repName,
        billNo: voucher.billNo,
        shopName: voucher.shopName,
        reason: [
          !rep ? 'rep' : null,
          !shop ? 'shop' : null,
          items.length !== expectedItemRows ? 'product' : null,
        ].filter(Boolean).join(', '),
      });
      continue;
    }

    prepared.push({ voucher, rep, shop, items });
  }

  const summary = {
    workbook: path.relative(path.join(__dirname, '..'), WORKBOOK),
    mode: APPLY ? 'apply' : 'dry-run',
    totalVouchersInWorkbook: vouchers.length,
    excludedYellowVouchers: excludedYellow.length,
    candidateVouchers: candidateVouchers.length,
    candidateItemRows: candidateVouchers.reduce((sum, voucher) => sum + voucher.items.length, 0),
    firstCandidateVouchers: candidateVouchers.slice(0, 5).map(voucher => ({
      repName: voucher.repName,
      billNo: voucher.billNo,
      shopName: voucher.shopName,
      items: voucher.items.length,
    })),
    yellowExcluded: excludedYellow.map(voucher => ({
      repName: voucher.repName,
      billNo: voucher.billNo,
      shopName: voucher.shopName,
      date: voucher.date,
      itemRows: voucher.items.length,
      yellowRows: voucher.yellowRows,
      total: Number(voucher.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
    })),
    skippedUnmatched,
    importReview: prepared.map(entry => ({
      repName: entry.voucher.repName,
      billNo: entry.voucher.billNo,
      shopName: entry.voucher.shopName,
      matchedShop: entry.shop ? entry.shop.name : null,
      itemRows: entry.items.length,
      total: Number(entry.voucher.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2)),
    })),
    unmatched: {
      reps: [...unmatched.reps].sort(),
      shops: [...unmatched.shops].sort(),
      products: [...unmatched.products].sort(),
    },
    productMisses: [...productMisses.entries()].map(([sourceName, details]) => ({ sourceName, ...details })),
    shopMisses: [...shopMisses.entries()].map(([sourceName, details]) => ({ sourceName, ...details })),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!SKIP_UNMATCHED && (summary.unmatched.reps.length || summary.unmatched.shops.length || summary.unmatched.products.length)) {
    throw new Error('Import has unmatched names. Fix mappings before applying.');
  }
  if (!APPLY) return;

  const admin = adminRes.rows[0];
  if (!admin) throw new Error('No admin/superadmin user found for approval logs.');

  let created = 0;
  let skipped = 0;
  const failed = [];
  for (const entry of prepared) {
    const notes = `Imported from 22.08.2026 SALES.xlsx; bill ${entry.voucher.billNo}`;
    try {
      const existing = await pool.query(
        'SELECT id, status FROM orders WHERE sales_rep_id = $1 AND shop_id = $2 AND notes = $3 LIMIT 1',
        [entry.rep.id, entry.shop.id, notes]
      );
      if (existing.rows.length > 0) {
        skipped += 1;
        continue;
      }

      const order = await productService.createOrder({
        shop_id: entry.shop.id,
        sales_rep_id: entry.rep.id,
        notes,
        items: entry.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        created_by_admin_id: admin.id,
      });
      await pool.query('UPDATE orders SET created_at = $1::date WHERE id = $2', [entry.voucher.date, order.id]);
      await productService.approveOrder(order.id, admin.id);
      created += 1;
      console.log(`created+approved bill ${entry.voucher.billNo} (${entry.voucher.repName}) ${entry.voucher.shopName}`);
    } catch (error) {
      failed.push({
        billNo: entry.voucher.billNo,
        repName: entry.voucher.repName,
        shopName: entry.voucher.shopName,
        error: error.message,
      });
      console.error(`failed bill ${entry.voucher.billNo} (${entry.voucher.repName}) ${entry.voucher.shopName}: ${error.message}`);
    }
  }

  console.log(JSON.stringify({ created, skipped, failed, skippedUnmatched, excludedYellow: excludedYellow.length }, null, 2));
}

main()
  .catch(error => {
    console.error(error && (error.stack || error.message || String(error)));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });

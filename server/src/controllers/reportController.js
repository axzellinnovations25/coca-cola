const PDFDocument = require('pdfkit');
const reportService = require('../services/reportService');

const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatMoneyLkr(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${moneyFormatter.format(Number(value))} LKR`;
}

function truncateText(text, maxLen) {
  const str = String(text ?? '');
  if (str.length <= maxLen) return str;
  return `${str.slice(0, Math.max(0, maxLen - 1))}…`;
}

exports.downloadRepwiseShopLimitsPdf = async (req, res) => {
  try {
    const reps = await reportService.getRepwiseShopLimits();

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const filename = `repwise_shop_limits_report_${dateStr}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    const page = {
      left: doc.page.margins.left,
      right: doc.page.width - doc.page.margins.right,
      top: doc.page.margins.top,
      bottom: doc.page.height - doc.page.margins.bottom,
    };

    const columns = {
      shopX: page.left,
      shopW: 300,
      creditX: page.left + 310,
      creditW: 130,
      billsX: page.left + 450,
      billsW: page.right - (page.left + 450),
    };

    const colors = {
      headerBg: '#111827',
      headerText: '#ffffff',
      sectionBg: '#EEF2FF',
      line: '#E5E7EB',
      muted: '#6B7280',
      zebra: '#F9FAFB',
      text: '#111827',
    };

    function drawReportHeader() {
      doc
        .fontSize(16)
        .fillColor(colors.text)
        .text('Repwise Shop Limits Report', { align: 'center' });
      doc.moveDown(0.25);
      doc
        .fontSize(10)
        .fillColor(colors.muted)
        .text(`Generated: ${today.toLocaleString()}`, { align: 'center' });
      doc.fillColor(colors.text);
      doc.moveDown(1);
    }

    function drawTableHeader() {
      const y = doc.y;
      doc.save();
      doc.rect(page.left, y, page.right - page.left, 18).fill(colors.headerBg);
      doc
        .fillColor(colors.headerText)
        .fontSize(10)
        .text('Shop Name', columns.shopX + 6, y + 5, { width: columns.shopW - 12 })
        .text('Max Credit', columns.creditX, y + 5, { width: columns.creditW, align: 'right' })
        .text('Max Bills', columns.billsX, y + 5, { width: columns.billsW, align: 'right' });
      doc.restore();
      doc.moveDown(1);
      doc.y = y + 22;
    }

    function ensureSpace(heightNeeded) {
      if (doc.y + heightNeeded > page.bottom) {
        doc.addPage();
        drawReportHeader();
      }
    }

    drawReportHeader();
    doc.moveDown(0.25);

    if (!reps.length) {
      doc.fontSize(12).text('No representatives found.');
      doc.end();
      return;
    }

    for (const rep of reps) {
      ensureSpace(70);
      const repName = `${rep.rep_first_name || ''} ${rep.rep_last_name || ''}`.trim() || 'Unknown Representative';
      const sectionY = doc.y;
      doc.save();
      doc.rect(page.left, sectionY, page.right - page.left, 34).fill(colors.sectionBg);
      doc
        .fillColor(colors.text)
        .fontSize(12)
        .text(repName, page.left + 10, sectionY + 8, { width: page.right - page.left - 20 });
      doc
        .fillColor(colors.muted)
        .fontSize(9)
        .text(rep.rep_email || '', page.left + 10, sectionY + 22, { width: page.right - page.left - 20 });
      doc.restore();
      doc.y = sectionY + 44;

      if (!rep.shops.length) {
        doc.fontSize(10).fillColor(colors.muted).text('No shops assigned.');
        doc.fillColor(colors.text);
        doc.moveDown(0.8);
        continue;
      }

      drawTableHeader();

      for (let i = 0; i < rep.shops.length; i += 1) {
        ensureSpace(26);
        const shop = rep.shops[i];

        const rowY = doc.y;
        const rowH = 18;

        if (i % 2 === 0) {
          doc.save();
          doc.rect(page.left, rowY - 2, page.right - page.left, rowH + 4).fill(colors.zebra);
          doc.restore();
        }

        doc
          .fillColor(colors.text)
          .fontSize(9)
          .text(truncateText(shop.shop_name || '-', 46), columns.shopX + 6, rowY, { width: columns.shopW - 12 })
          .text(formatMoneyLkr(shop.max_bill_amount), columns.creditX, rowY, { width: columns.creditW, align: 'right' })
          .text(shop.max_active_bills == null ? '-' : String(shop.max_active_bills), columns.billsX, rowY, { width: columns.billsW, align: 'right' });

        doc
          .strokeColor(colors.line)
          .lineWidth(1)
          .moveTo(page.left, rowY + rowH + 2)
          .lineTo(page.right, rowY + rowH + 2)
          .stroke();

        doc.y = rowY + rowH + 6;
      }

      doc.moveDown(0.8);

      ensureSpace(30);
    }

    doc.end();
  } catch (error) {
    console.error('downloadRepwiseShopLimitsPdf error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate PDF' });
  }
};

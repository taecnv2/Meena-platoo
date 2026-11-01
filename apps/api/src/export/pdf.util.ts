import { join } from 'node:path';
import pdfMake from 'pdfmake';
import type {
  Content,
  CustomTableLayout,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import type { ExportColumn, ExportMeta } from './export-column.interface';
import { formatExportDateTime } from './format.util';

/** Brand blue/white identity per plan.md §66-67. */
const BRAND_BLUE = '#2563eb';
const BRAND_BLUE_LIGHT = '#dbeafe';
const TEXT_SECONDARY = '#64748b';
const BORDER = '#e2e8f0';
const FONT_DIR = join(__dirname, 'fonts');

let fontsInitialized = false;

function ensureFonts(): void {
  if (fontsInitialized) {
    return;
  }
  pdfMake.setFonts({
    Sarabun: {
      normal: join(FONT_DIR, 'Sarabun-Regular.ttf'),
      bold: join(FONT_DIR, 'Sarabun-Bold.ttf'),
      italics: join(FONT_DIR, 'Sarabun-Italic.ttf'),
      bolditalics: join(FONT_DIR, 'Sarabun-BoldItalic.ttf'),
    },
  });
  // Export content never fetches remote URLs; local access is scoped to our own font directory
  // (pdfmake checks this policy even to load its own font files, so a blanket `false` here
  // would also block the fonts set above).
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.setLocalAccessPolicy((path) => path.startsWith(FONT_DIR));
  fontsInitialized = true;
}

/**
 * pdfmake/pdfkit renders the Thai Baht sign (U+0E3F) as a stray "B" even though the embedded
 * Sarabun font does contain the glyph -- a font-subsetting/shaping quirk specific to this one
 * codepoint. CSV output is unaffected (Excel renders it correctly), so the substitution is
 * scoped to PDF cell text only, not the shared formatter.
 */
function sanitizeForPdf(text: string): string {
  return text.replace(/฿/g, 'บาท ');
}

const tableLayout: CustomTableLayout = {
  fillColor: (rowIndex: number) =>
    rowIndex === 0 ? BRAND_BLUE_LIGHT : rowIndex % 2 === 0 ? '#f8fafc' : null,
  hLineColor: () => BORDER,
  vLineColor: () => BORDER,
  hLineWidth: () => 1,
  vLineWidth: () => 0,
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

export async function buildPdf<T>(
  rows: T[],
  columns: Array<ExportColumn<T>>,
  meta: ExportMeta,
): Promise<Buffer> {
  ensureFonts();

  const tableBody = [
    columns.map((column) => ({
      text: sanitizeForPdf(column.header),
      bold: true,
      alignment: column.align ?? 'left',
    })),
    ...rows.map((row) =>
      columns.map((column) => ({
        text: sanitizeForPdf(String(column.value(row) ?? '-')),
        alignment: column.align ?? 'left',
      })),
    ),
  ];

  const filterLine = meta.filters
    ? Object.entries(meta.filters)
        .map(
          ([label, value]) =>
            `${sanitizeForPdf(label)}: ${sanitizeForPdf(value)}`,
        )
        .join('   ')
    : undefined;

  const content: Content[] = [
    ...(filterLine
      ? [
          {
            text: filterLine,
            fontSize: 8,
            color: TEXT_SECONDARY,
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
        ]
      : []),
    {
      table: {
        headerRows: 1,
        widths: columns.map(() => '*'),
        body: tableBody,
      },
      layout: tableLayout,
      fontSize: columns.length > 5 ? 8 : 9,
    },
  ];

  // Long unbreakable tokens (emails, comma-joined lists) force a column past its equal '*'
  // share in portrait's ~530pt content width -- landscape's ~780pt gives real breathing room,
  // so switch over well before the old >6 threshold let 5-6 column tables silently overflow.
  const docDefinition: TDocumentDefinitions = {
    pageOrientation: columns.length > 4 ? 'landscape' : 'portrait',
    pageMargins: [32, 74, 32, 40],
    defaultStyle: { font: 'Sarabun', fontSize: 9 },
    header: {
      margin: [32, 20, 32, 0],
      stack: [
        {
          text: 'Meena Platoo — มีนาปลาทู',
          fontSize: 10,
          color: BRAND_BLUE,
          bold: true,
        },
        { text: meta.title, fontSize: 14, bold: true, margin: [0, 2, 0, 0] },
      ],
    },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [32, 0, 32, 20],
      columns: [
        {
          text: `สร้างเมื่อ ${formatExportDateTime(meta.generatedAt)}${meta.generatedBy ? ' โดย ' + meta.generatedBy : ''}`,
          fontSize: 8,
          color: TEXT_SECONDARY,
        },
        {
          text: `${currentPage} / ${pageCount}`,
          fontSize: 8,
          alignment: 'right',
          color: TEXT_SECONDARY,
        },
      ],
    }),
    content,
  };

  const pdf = pdfMake.createPdf(docDefinition);
  return pdf.getBuffer();
}

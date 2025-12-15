import { PDFDocument, PDFTextField } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function analyzePdf() {
  const pdfPath = path.join(process.cwd(), 'server/templates/procuration_hq_template.pdf');
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const form = pdfDoc.getForm();
  const fields = form.getFields();
  
  console.log('=== Detailed Field Analysis ===\n');
  
  fields.forEach((field, i) => {
    const name = field.getName();
    if (field instanceof PDFTextField) {
      const tf = field as PDFTextField;
      const widgets = tf.acroField.getWidgets();
      if (widgets.length > 0) {
        const rect = widgets[0].getRectangle();
        console.log(`Field ${i + 1}: "${name}"`);
        console.log(`  Position: x=${rect.x.toFixed(0)}, y=${rect.y.toFixed(0)}`);
        console.log(`  Size: w=${rect.width.toFixed(0)}, h=${rect.height.toFixed(0)}`);
        console.log('');
      }
    }
  });
}

analyzePdf().catch(console.error);

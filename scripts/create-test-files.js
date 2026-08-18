const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const outputDir = path.join(__dirname, '../sample_datasheets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Generate 100% Compliant Technical PDF Datasheet for Industrial Electric Motor
async function generatePDF() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const title = 'ABB TECHNICAL DATASHEET - INDUSTRIAL ELECTRIC MOTOR';
  page.drawText(title, { x: 50, y: 740, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  const textLines = [
    'Manufacturer: ABB Motors and Generators',
    'Model: M3BP 160MLA 4',
    'Product Category: Industrial Electric Motor',
    '--------------------------------------------------------------------------------',
    'Rated Output Power: 5 HP (3.7 kW)',
    'Rated Voltage: 415 V',
    'Full Load Current: 7.6 A',
    'Frequency: 50 Hz',
    'Phase: 3-Phase',
    'Rated Speed: 1440 RPM',
    'Efficiency Class: IE3 High Efficiency',
    'Efficiency at Full Load: 89.2 %',
    'Protection Rating: IP55',
    'Frame Size: 160M',
    'Mounting Type: B3 Foot Mounted',
    'Insulation Class: Class F',
    'Duty Cycle: S1 Continuous',
    'Ambient Temperature: 40 C',
    'Rated Torque: 24.5 Nm',
    'Enclosure Material: Cast Iron',
    'Standards: IEC 60034-1'
  ];

  textLines.forEach((line, idx) => {
    const y = 710 - idx * 22;
    page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
  });

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const filePath = path.join(outputDir, 'abb_electric_motor_m3bp.pdf');
  fs.writeFileSync(filePath, pdfBytes);
  console.log(`✓ Generated sample PDF: ${filePath}`);
}

// 2. Generate Sample CSV Datasheet for Industrial Bearing
function generateCSV() {
  const csvContent = `manufacturer,model,bearing_type,inner_diameter,outer_diameter,width,dynamic_load_rating,static_load_rating,limiting_speed,seal_type,material
SKF,6205-2RSH,Deep Groove Ball Bearing,25 mm,52 mm,15 mm,14.8 kN,7.8 kN,12000 RPM,Contact Seal (2RSH),Stainless Steel
`;

  const filePath = path.join(outputDir, 'skf_bearing_6205.csv');
  fs.writeFileSync(filePath, csvContent);
  console.log(`✓ Generated sample CSV: ${filePath}`);
}

// 3. Generate Sample TXT Datasheet for Industrial Pump
function generateTXT() {
  const txtContent = `GRUNDFOS INDUSTRIAL PUMP SPECIFICATION SHEET
Manufacturer: Grundfos
Model: CR 15-3 A-F-A-E-HQQE
Category: Industrial Pump

TECHNICAL SPECIFICATIONS:
Pump Type: Vertical Multistage Centrifugal Pump
Flow Rate: 15 m3/h
Head: 45 m
Power Rating: 3 kW
Operating Voltage: 415 V
Frequency: 50 Hz
Rated Speed: 2900 RPM
Pump Efficiency: 72 %
Material: Stainless Steel AISI 304
Inlet Size: 50 mm
Outlet Size: 50 mm
Maximum Operating Pressure: 16 bar
Temperature Range: -20 C to 120 C
`;

  const filePath = path.join(outputDir, 'grundfos_pump_cr15.txt');
  fs.writeFileSync(filePath, txtContent);
  console.log(`✓ Generated sample TXT: ${filePath}`);
}

async function run() {
  await generatePDF();
  generateCSV();
  generateTXT();
  console.log('\nAll sample test datasheets generated in ./sample_datasheets/');
}

run().catch(err => {
  console.error('Error generating sample files:', err);
  process.exit(1);
});

import XLSX from 'xlsx';
import { storage } from '../server/storage';

interface ExcelRow {
  BU: string | number;
  'Building Location': string;
  'Address': string;
  'Batch': number;
  'Building SQFT': number;
  'Year Built': number;
  'Estimated Rooftop PV System Size (kW DC)': number;
  'Estimated Rooftop PV System Size (kW AC)': number;
  'Estimated Value of EPC contract': number;
}

async function importDreamSites() {
  console.log('Starting Dream sites import...');
  
  // 1. Create Dream REIT client
  console.log('\n1. Creating Dream REIT client...');
  const client = await storage.createClient({
    name: 'Dream REIT',
    mainContactName: 'Lee Hodgkinson',
    email: 'lhodgkinso@dream.ca',
    phone: '416-819-0336'
  });
  console.log(`   Created client: ${client.name} (ID: ${client.id})`);
  
  // 2. Create Dream - RFP portfolio
  console.log('\n2. Creating Dream - RFP portfolio...');
  const portfolio = await storage.createPortfolio({
    name: 'Dream - RFP',
    clientId: client.id,
    description: 'Dream Industrial REIT RFP for rooftop solar installations across their Quebec industrial portfolio',
    status: 'active'
  });
  console.log(`   Created portfolio: ${portfolio.name} (ID: ${portfolio.id})`);
  
  // 3. Parse Excel file
  console.log('\n3. Parsing Excel file...');
  const wb = XLSX.readFile('attached_assets/Copy_of_visit_schedule-_organized_by_date__1766348624288.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<ExcelRow>(ws);
  
  // Filter out total row and empty rows
  const siteRows = data.filter(row => 
    row.BU && 
    row.Address && 
    row.BU !== 'Total:' && 
    typeof row['Building SQFT'] === 'number'
  );
  
  console.log(`   Found ${siteRows.length} sites to import`);
  
  // 4. Create sites
  console.log('\n4. Creating sites...');
  const createdSites: any[] = [];
  
  for (const row of siteRows) {
    // Parse city from "Building Location" (e.g., "Montreal, QC" -> "Montreal")
    const locationParts = row['Building Location']?.split(',') || [];
    const city = locationParts[0]?.trim() || 'Montreal';
    
    // Build notes with extra info
    const notes = [
      `Building Code: ${row.BU}`,
      `Building SQFT: ${row['Building SQFT']?.toLocaleString() || 'N/A'}`,
      `Year Built: ${row['Year Built'] || 'N/A'}`,
      `Estimated PV Size (DC): ${row['Estimated Rooftop PV System Size (kW DC)']?.toFixed(2) || 'N/A'} kW`,
      `Estimated PV Size (AC): ${row['Estimated Rooftop PV System Size (kW AC)']?.toFixed(2) || 'N/A'} kW`,
      `Estimated EPC Value: $${row['Estimated Value of EPC contract']?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}`,
      `Batch: ${row.Batch || 'N/A'}`
    ].join('\n');
    
    // Create site name from building code and address
    const siteName = `${row.BU} - ${row.Address}`;
    
    try {
      const site = await storage.createSite({
        clientId: client.id,
        name: siteName,
        streetAddress: row.Address,
        city: city,
        province: 'Québec',
        postalCode: null,
        buildingType: 'industrial',
        buildingSize: row['Building SQFT'] || null,
        yearBuilt: row['Year Built'] || null,
        notes: notes,
        status: 'new'
      });
      
      // Link site to portfolio
      await storage.addSiteToPortfolio({
        portfolioId: portfolio.id,
        siteId: site.id
      });
      
      createdSites.push(site);
      console.log(`   ✓ Created: ${siteName}`);
    } catch (error) {
      console.error(`   ✗ Failed to create: ${siteName}`, error);
    }
  }
  
  console.log(`\n========== IMPORT COMPLETE ==========`);
  console.log(`Client: ${client.name} (ID: ${client.id})`);
  console.log(`Portfolio: ${portfolio.name} (ID: ${portfolio.id})`);
  console.log(`Sites created: ${createdSites.length}`);
  console.log(`=====================================\n`);
  
  return { client, portfolio, sites: createdSites };
}

importDreamSites()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });

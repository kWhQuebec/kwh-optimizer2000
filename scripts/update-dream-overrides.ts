import XLSX from 'xlsx';
import { db } from '../server/db';
import { portfolioSites, sites, portfolios } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

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

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function updateDreamOverrides() {
  console.log('Starting Dream overrides update...\n');
  
  // 1. Parse Excel file
  console.log('1. Parsing Excel file...');
  const wb = XLSX.readFile('attached_assets/Copy_of_visit_schedule-_organized_by_date__1766348624288.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<ExcelRow>(ws);
  
  // Filter out total row and empty rows
  const excelRows = data.filter(row => 
    row.BU && 
    row.Address && 
    row.BU !== 'Total:' && 
    typeof row['Building SQFT'] === 'number'
  );
  
  console.log(`   Found ${excelRows.length} rows with data\n`);
  
  // 2. Get all Dream portfolio sites from DB
  console.log('2. Fetching Dream portfolio sites from database...');
  const dreamPortfolio = await db.select().from(portfolios).where(eq(portfolios.name, 'Dream - RFP'));
  
  if (dreamPortfolio.length === 0) {
    console.error('   ERROR: Dream - RFP portfolio not found!');
    return;
  }
  
  const portfolioId = dreamPortfolio[0].id;
  console.log(`   Found portfolio: ${dreamPortfolio[0].name} (ID: ${portfolioId})`);
  
  const dbSites = await db
    .select({
      portfolioSiteId: portfolioSites.id,
      siteId: sites.id,
      siteName: sites.name,
      address: sites.address,
    })
    .from(portfolioSites)
    .innerJoin(sites, eq(portfolioSites.siteId, sites.id))
    .where(eq(portfolioSites.portfolioId, portfolioId));
  
  console.log(`   Found ${dbSites.length} sites in portfolio\n`);
  
  // 3. Match and update
  console.log('3. Matching Excel rows to database sites and updating...\n');
  
  let matched = 0;
  let notMatched = 0;
  const updates: { address: string; pvSizeKW: number; capexNet: number }[] = [];
  
  for (const excelRow of excelRows) {
    const excelAddress = excelRow.Address;
    const normalizedExcelAddr = normalizeAddress(excelAddress);
    
    // Try to find matching DB site
    const matchingSite = dbSites.find(dbSite => {
      const normalizedDbAddr = normalizeAddress(dbSite.address || '');
      return normalizedDbAddr === normalizedExcelAddr || 
             normalizedDbAddr.includes(normalizedExcelAddr) ||
             normalizedExcelAddr.includes(normalizedDbAddr);
    });
    
    if (matchingSite) {
      const pvSizeKW = excelRow['Estimated Rooftop PV System Size (kW DC)'];
      const capexNet = excelRow['Estimated Value of EPC contract'];
      
      // Update portfolio site with override values
      await db.update(portfolioSites)
        .set({
          overridePvSizeKW: pvSizeKW,
          overrideCapexNet: capexNet,
        })
        .where(eq(portfolioSites.id, matchingSite.portfolioSiteId));
      
      console.log(`   ✓ ${excelAddress}`);
      console.log(`     PV Size: ${pvSizeKW.toFixed(2)} kW DC`);
      console.log(`     CAPEX: $${capexNet.toLocaleString()}`);
      matched++;
      updates.push({ address: excelAddress, pvSizeKW, capexNet });
    } else {
      console.log(`   ✗ No match: ${excelAddress}`);
      notMatched++;
    }
  }
  
  console.log(`\n========== UPDATE COMPLETE ==========`);
  console.log(`Matched and updated: ${matched}`);
  console.log(`Not matched: ${notMatched}`);
  console.log(`Total PV Capacity: ${updates.reduce((sum, u) => sum + u.pvSizeKW, 0).toFixed(2)} kW`);
  console.log(`Total CAPEX: $${updates.reduce((sum, u) => sum + u.capexNet, 0).toLocaleString()}`);
  console.log(`=====================================\n`);
}

updateDreamOverrides()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Update failed:', err);
    process.exit(1);
  });

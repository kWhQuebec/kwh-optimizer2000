import { storage } from '../server/storage';

async function createDreamVisits() {
  const clientId = '6ba7837d-84a0-4526-bfbf-f802bc68c25e';
  
  const sites = await storage.getSitesByClient(clientId);
  console.log('Found', sites.length, 'Dream sites');
  
  let created = 0;
  for (const site of sites) {
    try {
      const existingVisits = await storage.getSiteVisitsBySite(site.id);
      if (existingVisits && existingVisits.length > 0) {
        console.log('Skip (has visit):', site.name);
        continue;
      }
      
      await storage.createSiteVisit({
        siteId: site.id,
        status: 'scheduled',
        notes: 'Visite technique planifiée pour le portfolio Dream - RFP'
      });
      console.log('Created visit for:', site.name);
      created++;
    } catch (err: any) {
      console.error('Failed for', site.name, ':', err.message);
    }
  }
  console.log('\nCreated', created, 'scheduled visits');
}

createDreamVisits().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

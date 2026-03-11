/**
 * Batch Re-Analyze All Sites
 *
 * Calls the existing run-potential-analysis endpoint for every site
 * that has meter data. Uses the server's full analysis pipeline
 * (tariff detection, yield strategy, roof polygons, etc.).
 *
 * Usage (from Replit shell, while server is running):
 *   npx tsx scripts/batch-reanalyze.ts
 *   npx tsx scripts/batch-reanalyze.ts --dry-run     # Preview only
 *   npx tsx scripts/batch-reanalyze.ts --site abc123  # Single site
 */

import jwt from 'jsonwebtoken';
import { storage } from '../server/storage';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SINGLE_SITE = args.includes('--site') ? args[args.indexOf('--site') + 1] : null;

// Server runs on port 3000 in Replit
const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

interface ReanalysisResult {
  siteId: string;
  siteName: string;
  status: 'success' | 'skipped' | 'error';
  reason?: string;
  pvSizeKW?: number;
  annualSavings?: number;
  npv25?: number;
  durationMs?: number;
}

async function getAdminToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET env var required');

  // Find an admin user
  const users = await storage.getUsers();
  const admin = users.find((u: any) => u.role === 'admin');
  if (!admin) throw new Error('No admin user found in DB');

  return jwt.sign({ userId: admin.id }, secret, { expiresIn: '1h' });
}

async function reanalyzeSite(siteId: string, siteName: string, token: string): Promise<ReanalysisResult> {
  const start = Date.now();

  try {
    const resp = await fetch(`${BASE_URL}/api/sites/${siteId}/run-potential-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        assumptions: {} // Let server auto-detect everything (tariff, yield, etc.)
      })
    });

    const duration = Date.now() - start;

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        siteId,
        siteName,
        status: resp.status === 400 ? 'skipped' : 'error',
        reason: errText.substring(0, 200),
        durationMs: duration
      };
    }

    const data = await resp.json();
    return {
      siteId,
      siteName,
      status: 'success',
      pvSizeKW: data.pvSizeKW,
      annualSavings: data.annualSavings,
      npv25: data.npv25,
      durationMs: duration
    };
  } catch (err: any) {
    return {
      siteId,
      siteName,
      status: 'error',
      reason: err.message?.substring(0, 200)
    };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   BATCH RE-ANALYZE — kWh Optimizer 2000     ║');
  console.log('╚══════════════════════════════════════════════╝');
  if (DRY_RUN) console.log('⚠️  MODE DRY RUN — aucune modification\n');
  if (SINGLE_SITE) console.log(`🎯 Site unique: ${SINGLE_SITE}\n`);

  // Generate admin JWT
  console.log('🔑 Génération token admin...');
  const token = await getAdminToken();
  console.log('✅ Token OK\n');

  // Get all sites
  const allSites = await storage.getSites();
  const sites = SINGLE_SITE
    ? allSites.filter((s: any) => s.id === SINGLE_SITE)
    : allSites;

  console.log(`📊 ${sites.length} site(s) à traiter\n`);

  // Check which sites have meter data
  const sitesWithData: Array<{ id: string; name: string; hasMeterData: boolean; readingCount: number }> = [];

  for (const site of sites) {
    const readings = await storage.getMeterReadingsBySite(site.id);
    sitesWithData.push({
      id: site.id,
      name: site.name || site.address || site.id,
      hasMeterData: readings.length > 0,
      readingCount: readings.length
    });
  }

  const withData = sitesWithData.filter(s => s.hasMeterData);
  const withoutData = sitesWithData.filter(s => !s.hasMeterData);

  console.log(`📈 ${withData.length} site(s) avec données compteur (seront re-analysés)`);
  console.log(`⏭️  ${withoutData.length} site(s) sans données (ignorés)\n`);

  if (DRY_RUN) {
    console.log('Sites qui seraient re-analysés:');
    for (const s of withData) {
      console.log(`  ✓ ${s.name} (${s.readingCount.toLocaleString()} lectures)`);
    }
    if (withoutData.length > 0) {
      console.log('\nSites ignorés (pas de données compteur):');
      for (const s of withoutData) {
        console.log(`  - ${s.name}`);
      }
    }
    process.exit(0);
  }

  // Re-analyze each site
  const results: ReanalysisResult[] = [];

  for (let i = 0; i < withData.length; i++) {
    const site = withData[i];
    const progress = `[${i + 1}/${withData.length}]`;
    process.stdout.write(`${progress} ${site.name} (${site.readingCount.toLocaleString()} lectures)... `);

    const result = await reanalyzeSite(site.id, site.name, token);
    results.push(result);

    if (result.status === 'success') {
      console.log(`✅ PV ${result.pvSizeKW?.toFixed(0)}kW | $${result.annualSavings?.toFixed(0)}/an | NPV25 $${result.npv25?.toFixed(0)} (${result.durationMs}ms)`);
    } else if (result.status === 'skipped') {
      console.log(`⏭️  ${result.reason}`);
    } else {
      console.log(`❌ ${result.reason}`);
    }

    // Small delay to not hammer the server
    if (i < withData.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Summary
  const success = results.filter(r => r.status === 'success');
  const skipped = results.filter(r => r.status === 'skipped');
  const errors = results.filter(r => r.status === 'error');

  console.log('\n══════════════════════════════════════════════');
  console.log(`✅ Re-analysés: ${success.length}`);
  console.log(`⏭️  Ignorés:     ${skipped.length}`);
  console.log(`❌ Erreurs:     ${errors.length}`);
  console.log(`📊 Total:       ${results.length} / ${sites.length} sites`);
  console.log('══════════════════════════════════════════════');

  if (success.length > 0) {
    const totalSavings = success.reduce((sum, r) => sum + (r.annualSavings || 0), 0);
    const avgDuration = success.reduce((sum, r) => sum + (r.durationMs || 0), 0) / success.length;
    console.log(`\n💰 Économies totales recalculées: $${totalSavings.toLocaleString()}/an`);
    console.log(`⏱️  Temps moyen par analyse: ${Math.round(avgDuration)}ms`);
  }

  if (errors.length > 0) {
    console.log('\nErreurs détaillées:');
    errors.forEach(e => console.log(`  - ${e.siteName}: ${e.reason}`));
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

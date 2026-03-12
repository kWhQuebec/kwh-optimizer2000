// Golden Test - kWh Optimizer 2000
// Validates simulation_runs coherence for real client sites
const { Pool } = require('pg');
const pool = new Pool({ ssl: { rejectUnauthorized: false } });
const SITES = ['Vieux Qu\u00e9bec','Centre de Distribution Terrebonne','1350 Chomedey',
  'Fromagerie Weedon','41020 RONA+ Saint-Laurent','RONA+ LaSalle',
  '41030 RONA+ Qu\u00e9bec','St-Hilaire','45 Principale','33 Principale'];
let pass=0, fail=0, warn=0, failures=[];
function chk(site,label,val,min,max) {
  if(val===null||val===undefined||isNaN(val)){warn++;console.log('  WARN '+label+': NULL');return;}
  let ok=true,reason='';
  if(min!==undefined&&val<min){ok=false;reason=val+' < min '+min;}
  if(max!==undefined&&val>max){ok=false;reason=val+' > max '+max;}
  if(ok){pass++;console.log('  PASS '+label+': '+val.toFixed(2));}
  else{fail++;console.log('  FAIL '+label+': '+reason);failures.push(site+' > '+label+': '+reason);}
}
async function run() {
  console.log('GOLDEN TEST - kWh Optimizer 2000');
  console.log('Date: '+new Date().toISOString()+'\n');
  const sites = (await pool.query('SELECT id,name,address FROM sites ORDER BY name')).rows;
  console.log(sites.length+' sites in DB\n');
  let validated=0;
  for(const sn of SITES) {
    const site = sites.find(s=>s.name===sn||s.name.includes(sn));
    if(!site){console.log('SKIP: '+sn+' not found');continue;}
    const sr = (await pool.query('SELECT * FROM simulation_runs WHERE site_id=$1 ORDER BY created_at DESC LIMIT 1',[site.id])).rows[0];
    if(!sr){console.log('SKIP: '+site.name+' no runs');continue;}
    console.log('\n'+'='.repeat(50));
    console.log(site.name+' ('+(site.address||'')+')');
    console.log('Sim: '+(sr.label||sr.type||'default')+' - '+sr.created_at);
    const pv=+sr.pv_size_kw, bE=+(sr.batt_energy_kwh||0), bP=+(sr.batt_power_kw||0);
    const sav=+sr.annual_savings, cap=+sr.capex_net, pb=+sr.simple_payback_years;
    const npv=+sr.npv_20, irr=+sr.irr_20;
    const costB=+sr.annual_cost_before, costA=+sr.annual_cost_after;
    const peak=+sr.peak_demand_kw, dr=+(sr.annual_demand_reduction_kw||0);
    const co2=+(sr.co2_avoided_tonnes_per_year||0);
    // PV & Battery bounds
    chk(site.name,'PV kW',pv,10,2000);
    chk(site.name,'Batt kWh',bE,0,2000);
    chk(site.name,'Batt kW',bP,0,1000);
    // Battery C-rate sanity
    if(bE>0&&bP>0){const cr=bP/bE;if(cr<0.1||cr>3){fail++;console.log('  FAIL C-rate: '+cr.toFixed(2));failures.push(site.name+' > C-rate: '+cr.toFixed(2));}else{pass++;console.log('  PASS C-rate: '+cr.toFixed(2));}}
    // Financial bounds
    chk(site.name,'Savings $',sav,0,1000000);
    chk(site.name,'CAPEX $',cap,10000,10000000);
    chk(site.name,'Payback y',pb,1,30);
    // Payback coherence: payback ~ capex/savings
    if(cap>0&&sav>0){const imp=cap/sav;const r=pb/imp;if(r<0.5||r>2){fail++;console.log('  FAIL Payback coherence: reported='+pb.toFixed(1)+' implied='+imp.toFixed(1));failures.push(site.name+' > Payback coherence ratio='+r.toFixed(2));}else{pass++;console.log('  PASS Payback coherence: '+pb.toFixed(1)+'y vs '+imp.toFixed(1)+'y');}}
    // NPV & IRR
    chk(site.name,'NPV 20y',npv,-500000,undefined);
    chk(site.name,'IRR 20y',irr,-0.1,1.0);
    // NPV-IRR coherence
    if(!isNaN(npv)&&!isNaN(irr)){if((npv>0&&irr<0)||(npv<-10000&&irr>0.15)){fail++;console.log('  FAIL NPV-IRR incoherent: NPV='+npv.toFixed(0)+' IRR='+(irr*100).toFixed(1)+'%');failures.push(site.name+' > NPV-IRR incoherent');}else{pass++;console.log('  PASS NPV-IRR coherent');}}
    // Cost before > cost after
    if(costB>0&&!isNaN(costA)){if(costB-costA<0){fail++;console.log('  FAIL Cost after > before');failures.push(site.name+' > Cost after > before');}else{pass++;console.log('  PASS Costs: before=$'+costB.toFixed(0)+' after=$'+costA.toFixed(0));}}
    // Demand reduction >= 0
    if(peak>0&&dr!==null){if(dr<0){fail++;failures.push(site.name+' > Demand reduction <0');}else{pass++;console.log('  PASS Demand: peak='+peak.toFixed(0)+'kW reduction='+dr.toFixed(0)+'kW');}}
    // CO2 >= 0
    if(co2<0){fail++;failures.push(site.name+' > CO2 <0');}else if(!isNaN(co2)){pass++;console.log('  PASS CO2: '+co2.toFixed(1)+' tonnes/yr');}
    validated++;
  }
  // Summary
  console.log('\n'+'='.repeat(50));
  console.log('SUMMARY: '+validated+'/'+SITES.length+' sites validated');
  console.log('PASS: '+pass+' | FAIL: '+fail+' | WARN: '+warn);
  if(failures.length){console.log('\nFAILURES:');failures.forEach(f=>console.log('  - '+f));}
  const exitCode = fail>0?1:0;
  console.log('\nExit code: '+exitCode+(exitCode===0?' (ALL PASS)':' (FAILURES DETECTED)'));
  await pool.end();
  process.exit(exitCode);
}
run().catch(e=>{console.error('FATAL:',e.message);pool.end();process.exit(2);});

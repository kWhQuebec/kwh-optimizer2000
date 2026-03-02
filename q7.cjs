const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query(`SELECT results->'optimalScenarioId' as optid, results->'scenarios' as scenarios FROM simulation_runs WHERE id='7e1295be-666a-4d78-897e-4c8e8f5210cc'`).then(r=>{
  const row=r.rows[0];
  const optId=row.optid;
  console.log('Optimal scenario ID:',optId);
  if(row.scenarios){
    const scenarios=typeof row.scenarios==='string'?JSON.parse(row.scenarios):row.scenarios;
    const opt=scenarios.find(s=>s.id===optId);
    if(opt){
      const f=opt.financials||opt;
      console.log(JSON.stringify({id:opt.id,pvSizeKW:opt.pvSizeKW||opt.pvSize,battKWh:opt.battEnergyKWh||opt.battKWh,npv25:f.npv25,irr25:f.irr25,payback:f.simplePaybackYears,lcoe:f.lcoe,annualSavings:f.annualSavings,capexGross:f.capexGross,capexNet:f.capexNet,incentivesHQ:f.incentivesHQ,incentivesFederal:f.incentivesFederal,taxShield:f.taxShield,totalIncentives:f.totalIncentives,totalProdKWh:f.totalProductionKwh,selfSuff:f.selfSufficiencyPercent,co2:f.co2AvoidedTonnesPerYear},null,2));
    }else{console.log('Scenario not found. Available:',scenarios.map(s=>s.id));}
  }else{console.log('No scenarios field');}
  p.end();
}).catch(e=>{console.error(e.message);p.end()});

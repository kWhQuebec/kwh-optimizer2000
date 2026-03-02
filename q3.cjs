const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query(`SELECT sr.id,s.name,s.address,sr.created_at FROM simulation_runs sr JOIN sites s ON sr.site_id=s.id ORDER BY sr.created_at DESC LIMIT 10`).then(r=>{r.rows.forEach(row=>console.log(row.id,row.name,row.address,row.created_at));p.end()}).catch(e=>{console.error(e.message);p.end()});

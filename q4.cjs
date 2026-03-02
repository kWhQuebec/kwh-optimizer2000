const {Pool}=require('pg');
const p=new Pool({connectionString:process.env.DATABASE_URL});
p.query(`SELECT sr.*,s.name,s.address FROM simulation_runs sr JOIN sites s ON sr.site_id=s.id WHERE sr.id='7e1295be-666a-4d78-897e-4c8e8f5210cc'`).then(r=>{console.log(JSON.stringify(r.rows[0],null,2));p.end()}).catch(e=>{console.error(e.message);p.end()});

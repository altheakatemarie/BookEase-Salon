import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = join(root, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'bookease.sqlite'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS services (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE,
 duration INTEGER NOT NULL CHECK(duration IN (30,60,90,120)),
 price REAL NOT NULL CHECK(price >= 0),
 description TEXT NOT NULL DEFAULT '',
 is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1))
);
CREATE TABLE IF NOT EXISTS appointments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',
 service_id INTEGER NOT NULL REFERENCES services(id),
 date TEXT NOT NULL,
 time TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
 notes TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_appointments_slot ON appointments(date,time);
`);
// Upgrade existing salon databases without deleting services or appointments.
if (!db.prepare("PRAGMA table_info(services)").all().some(col => col.name === 'is_available')) {
  db.exec('ALTER TABLE services ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1))');
}
const seed = [
  ["Women's Haircut",60,250,'Haircut and beautiful styling'],
  ["Men's Haircut",30,150,'Cut, trim and style'],
  ['Hair Coloring',120,950,'Full color treatment'],
  ['Hair Rebonding',120,1500,'Smooth straight hair treatment'],
  ['Hair Treatment',60,550,'Deep nourishing hair care'],
  ['Hair Styling',30,300,'Blow-dry and style for events']
];
if (db.prepare('SELECT COUNT(*) AS n FROM services').get().n === 0) {
  const ins = db.prepare('INSERT INTO services(name,duration,price,description) VALUES (?,?,?,?)');
  for (const x of seed) ins.run(...x);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'100kb'}));
const statuses = ['pending','confirmed','completed','cancelled'];
const active = new Set(['pending','confirmed','completed']);
const problem = (status,message) => Object.assign(new Error(message),{status});
const trim = (v,max=150) => typeof v === 'string' ? v.trim().slice(0,max) : '';
// Use Philippine local calendar date, not UTC; it changes automatically each new year.
const currentDatePH = () => new Intl.DateTimeFormat('en-CA',{
 timeZone:'Asia/Manila', year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
// Booking a date today must also use a future time in Philippine local time.
const currentTimePH = () => new Intl.DateTimeFormat('en-GB', {
 timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
}).format(new Date());
const requireFutureSlot = (date,time) => {
 if(date===currentDatePH() && time<=currentTimePH())
   throw problem(400,'This time has already passed today. Choose a later time slot.');
};
const requireBookableDate = date => {
 const now=currentDatePH();
 if(!isDate(date))throw problem(400,'Choose a valid appointment date.');
 if(date.slice(0,4)!==now.slice(0,4))throw problem(400,`Appointment year is locked to ${now.slice(0,4)}. It updates automatically next year.`);
 if(date<now)throw problem(400,'Past appointment dates are not allowed.');
};
const isDate = v => {
  if (typeof v!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0,10)===v;
};
const isTime = v => typeof v === 'string' && /^([01]\d|2[0-3]):(00|30)$/.test(v);
const min = t => Number(t.slice(0,2))*60+Number(t.slice(3));
const hhmm = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const getService = id => db.prepare('SELECT * FROM services WHERE id=?').get(Number(id));
const apSelect = `SELECT a.*,s.name AS service_name,s.duration AS duration,s.price AS price
 FROM appointments a JOIN services s ON s.id=a.service_id`;
const getAppointment = id => db.prepare(`${apSelect} WHERE a.id=?`).get(Number(id));
const idNumber = v => {
 const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw problem(400,'Invalid ID.');return n;
};

function parseService(body={}) {
 const name=trim(body.name,100),description=trim(body.description,500);
 const duration=Number(body.duration),price=Number(body.price);
 if (!name) throw problem(400,'Enter a service name.');
 if (![30,60,90,120].includes(duration))throw problem(400,'Duration must be 30, 60, 90, or 120 minutes.');
 if (body.price===''||body.price==null||!Number.isFinite(price)||price<0) throw problem(400,'Enter a valid price.');
 return {name,description,duration,price};
}
function parseAppointment(body={}, status='pending', allowExistingSchedule=false) {
 const customer_name=trim(body.customer_name,100),phone=trim(body.phone,30),email=trim(body.email,150),notes=trim(body.notes,500);
 const service_id=Number(body.service_id),date=trim(body.date,10),time=trim(body.time,5);
 if (!customer_name)throw problem(400,'Customer name is required.');
 if(!/^09\d{9}$/.test(phone))throw problem(400,'Phone number must be exactly 11 digits and begin with 09.');
 if (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw problem(400,'Invalid email address.');
 if (!Number.isSafeInteger(service_id)||!getService(service_id))throw problem(400,'Choose an existing salon service.');
 if(allowExistingSchedule){if(!isDate(date))throw problem(400,'Choose a valid appointment date.');}
 else requireBookableDate(date);
 if(!isTime(time))throw problem(400,'Choose a valid 30-minute time slot.');
 if(!allowExistingSchedule)requireFutureSlot(date,time);
 if (!statuses.includes(status))throw problem(400,'Choose a valid appointment status.');
 return {customer_name,phone,email,notes,service_id,date,time,status};
}
function isConflict(date,time,duration,excludeId=null) {
 const start=min(time),end=start+duration;
 if (start<540||end>1020)throw problem(400,'Salon hours are 9:00 AM to 5:00 PM. Please choose a fitting time.');
 const rows=db.prepare(`${apSelect} WHERE a.date=? AND a.status IN ('pending','confirmed','completed') AND a.id != ?`).all(date,excludeId??-1);
 return rows.some(a=>start<min(a.time)+a.duration && min(a.time)<end);
}
function checkSchedule(a, excludeId=null) {
 if(active.has(a.status)&&isConflict(a.date,a.time,getService(a.service_id).duration,excludeId))
   throw problem(409,'Schedule conflict: this time overlaps another active appointment.');
}
const sendAppointment = (res,id) => res.json(getAppointment(id));

app.get('/api/health',(_req,res)=>res.json({ok:true,database:'SQLite'}));
app.get('/api/services',(_req,res)=>res.json(db.prepare('SELECT * FROM services ORDER BY name').all()));
app.post('/api/services',(req,res,next)=>{try{
 const s=parseService(req.body);const r=db.prepare('INSERT INTO services(name,duration,price,description) VALUES (@name,@duration,@price,@description)').run(s);
 res.status(201).json(getService(Number(r.lastInsertRowid)));
}catch(e){next(e);}});
app.put('/api/services/:id',(req,res,next)=>{try{
 const id=idNumber(req.params.id),existing=getService(id);if(!existing)throw problem(404,'Service not found.');
 const s=parseService(req.body);
 if(s.duration!==existing.duration){
   const used=db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE service_id=? AND status IN ('pending','confirmed','completed')").get(id).n;
   if(used)throw problem(409,'Cannot change duration while this service has active bookings.');
 }
 db.prepare('UPDATE services SET name=@name,duration=@duration,price=@price,description=@description WHERE id=@id').run({...s,id});
 res.json(getService(id));
}catch(e){next(e);}});
// Toggle availability without deleting the service or its appointment history.
app.patch('/api/services/:id/availability',(req,res,next)=>{try{
 const id=idNumber(req.params.id),svc=getService(id);
 if(!svc)throw problem(404,'Service not found.');
 if(typeof req.body?.is_available!=='boolean')throw problem(400,'Availability must be true or false.');
 db.prepare('UPDATE services SET is_available=? WHERE id=?').run(req.body.is_available?1:0,id);
 res.json(getService(id));
}catch(e){next(e);}});
app.delete('/api/services/:id',(req,res,next)=>{try{
 const id=idNumber(req.params.id);if(!getService(id))throw problem(404,'Service not found.');
 const count=db.prepare('SELECT COUNT(*) AS n FROM appointments WHERE service_id=?').get(id).n;
 if(count)throw problem(409,'Cannot delete a service that has booking history.');
 db.prepare('DELETE FROM services WHERE id=?').run(id);res.status(204).end();
}catch(e){next(e);}});
app.get('/api/appointments',(_req,res)=>res.json(db.prepare(`${apSelect} ORDER BY a.date DESC,a.time DESC,a.id DESC`).all()));
app.get('/api/appointments/:id',(req,res,next)=>{try{
 const a=getAppointment(idNumber(req.params.id));if(!a)throw problem(404,'Appointment not found.');res.json(a);
}catch(e){next(e);}});
app.post('/api/appointments',(req,res,next)=>{try{
 // Newly created bookings always start as Pending.
 const a=parseAppointment(req.body,'pending');
 if(!getService(a.service_id).is_available)throw problem(409,'This service is currently unavailable. Choose another service.');
 checkSchedule(a);
 const insert=db.prepare(`INSERT INTO appointments(customer_name,phone,email,service_id,date,time,status,notes)
 VALUES (@customer_name,@phone,@email,@service_id,@date,@time,@status,@notes)`);
 const r=insert.run(a);res.status(201).json(getAppointment(Number(r.lastInsertRowid)));
}catch(e){next(e);}});
app.put('/api/appointments/:id',(req,res,next)=>{try{
 const id=idNumber(req.params.id),existing=getAppointment(id);
 if(!existing)throw problem(404,'Appointment not found.');
 // Edit details keeps the status unchanged; the separate PATCH route handles status.
 const status=existing.status;
 const unchangedSchedule=existing.date===req.body?.date && existing.time===req.body?.time && existing.service_id===Number(req.body?.service_id);
 const a=parseAppointment(req.body,status,unchangedSchedule);
 if(!getService(a.service_id).is_available && (a.service_id!==existing.service_id || a.date!==existing.date || a.time!==existing.time))
   throw problem(409,'This salon service is unavailable. You may update customer details, but cannot move or create bookings for this service until it is available again.');
 checkSchedule(a,id);
 db.prepare(`UPDATE appointments SET customer_name=@customer_name,phone=@phone,email=@email,
 service_id=@service_id,date=@date,time=@time,notes=@notes WHERE id=@id`).run({customer_name:a.customer_name,phone:a.phone,email:a.email,service_id:a.service_id,date:a.date,time:a.time,notes:a.notes,id});
 sendAppointment(res,id);
}catch(e){next(e);}});
app.patch('/api/appointments/:id/status',(req,res,next)=>{try{
 // Optional status-only endpoint, for future versions. Safe and independently functional.
 const id=idNumber(req.params.id),a=getAppointment(id);if(!a)throw problem(404,'Appointment not found.');
 const status=req.body?.status;if(!statuses.includes(status))throw problem(400,'Invalid status.');
 if(active.has(status)&&!active.has(a.status)){
   requireBookableDate(a.date);
   requireFutureSlot(a.date,a.time);
   if(isConflict(a.date,a.time,a.duration,id))throw problem(409,'Cannot reactivate: schedule already booked.');
 }
 db.prepare('UPDATE appointments SET status=? WHERE id=?').run(status,id);sendAppointment(res,id);
}catch(e){next(e);}});
app.delete('/api/appointments/:id',(req,res,next)=>{try{
 const id=idNumber(req.params.id);const result=db.prepare('DELETE FROM appointments WHERE id=?').run(id);
 if(!result.changes)throw problem(404,'Appointment not found.');res.status(204).end();
}catch(e){next(e);}});
app.get('/api/availability',(req,res,next)=>{try{
 const {date,service_id,exclude_id}=req.query;
 requireBookableDate(date);
 const s=getService(service_id);if(!s)throw problem(400,'Choose a service.');
 if(!s.is_available){
   const existing=exclude_id?getAppointment(exclude_id):null;
   if(!existing || existing.service_id!==s.id || existing.date!==date)
     throw problem(409,'This service is currently unavailable for new bookings.');
   return res.json({slots:[existing.time]});
 }
 const slots=[];
 for(let t=540;t+s.duration<=1020;t+=30){
   const time=hhmm(t);if(!(date===currentDatePH() && time<=currentTimePH()) && !isConflict(date,time,s.duration,exclude_id?Number(exclude_id):null))slots.push(time);
 }
 res.json({slots});
}catch(e){next(e);}});
app.get('/api/stats',(_req,res)=>{
 const stats={total:0,pending:0,confirmed:0,completed:0,cancelled:0};
 for(const r of db.prepare('SELECT status,COUNT(*) AS n FROM appointments GROUP BY status').all()){
   stats[r.status]=r.n;stats.total+=r.n;
 }
 res.json(stats);
});
app.use((err,_req,res,_next)=>{
 if(err.code?.startsWith('SQLITE_CONSTRAINT_UNIQUE'))return res.status(409).json({error:'Service already exists.'});
 if(err.code?.startsWith('SQLITE_CONSTRAINT'))return res.status(400).json({error:'Invalid database value.'});
 if(err.status)return res.status(err.status).json({error:err.message});
 console.error(err);res.status(500).json({error:'Unexpected server error.'});
});
const port = Number(process.env.PORT || 4088);
app.listen(port, '127.0.0.1', () => console.log(`BookEase API running on http://127.0.0.1:${port}`));

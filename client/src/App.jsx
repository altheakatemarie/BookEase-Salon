import React, { useEffect, useState } from 'react';
import {
  Scissors, LayoutDashboard, CalendarDays, Settings2, Plus, Search, Pencil, Trash2, X,
  CalendarCheck2, Clock3, CheckCircle2, CircleX, RefreshCw, Users, Menu, ArrowUpRight,
  CalendarClock, Phone, Mail, ClipboardCheck, AlertTriangle, Heart, Sparkles, Flower2, WandSparkles, Crown
} from 'lucide-react';

const emptyBooking = { customer_name:'',phone:'',email:'',service_id:'',date:'',time:'',status:'pending',notes:'' };
const emptyService = { name:'',description:'',duration:30,price:0 };
const statuses = ['pending','confirmed','completed','cancelled'];
const labels = {pending:'Pending', confirmed:'Confirmed',completed:'Completed',cancelled:'Cancelled'};
const dateToday = () => new Intl.DateTimeFormat('en-CA',{
  timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const makeDate=(year,month,day)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
const daysInMonth=(year,month)=>new Date(Date.UTC(year,month,0)).getUTCDate();
const dateText = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—';
const timeText = t => t ? new Date(`2000-01-01T${t}:00`).toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'}) : '—';
const pesos = n => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(Number(n)||0);
async function api(path,opts={}){
  let response;
  try {response=await fetch(`/api${path}`,{...opts,headers:{'Content-Type':'application/json',...opts.headers}});}
  catch {throw Error('Cannot reach the backend. Check if the server is running on port 4088.');}
  if(response.status===204)return null;
  const json=await response.json().catch(()=>null);
  if(!response.ok)throw Error(json?.error||`Server request failed (${response.status}).`);
  if(json===null)throw Error('Server returned an invalid response.');
  return json;
}
function Modal({title,onClose,children}){
  return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-heading"><div><span className="eyebrow">BOOKEASE • SALON</span><h2>{title}</h2></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20}/></button></div>{children}
    </div>
  </div>;
}
function StatusPill({value}){return <span className={`status-pill ${value}`}><span className="status-dot"/>{labels[value]||value}</span>;}
function LockedDateFilter({value,onChange,today}){
  // Viewing records is different from creating bookings: past days remain searchable.
  const year=Number(today.slice(0,4));
  const selected=value && value.slice(0,4)===String(year)?value:today;
  const month=Number(selected.slice(5,7));
  const day=Number(selected.slice(8,10));
  const maxDay=daysInMonth(year,month);
  function changeMonth(nextMonth){
    const m=Number(nextMonth);
    onChange(makeDate(year,m,Math.min(day,daysInMonth(year,m))));
  }
  function changeDay(nextDay){onChange(makeDate(year,month,Number(nextDay)));}
  return <div className="filter-date-group" aria-label="Appointment date filter, year locked">
    <div className="filter-date-fields">
      <select aria-label="Filter month" value={month} onChange={e=>changeMonth(e.target.value)}>
        {MONTHS.map((name,i)=><option key={name} value={i+1}>{name}</option>)}
      </select>
      <select aria-label="Filter day" value={day} onChange={e=>changeDay(e.target.value)}>
        {Array.from({length:maxDay},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}</option>)}
      </select>
      <span className="filter-year-lock" title="Automatically follows the Philippine calendar"><b>{year}</b><small>🔒 YEAR</small></span>
    </div>
    {value&&<button type="button" className="filter-clear-date" onClick={()=>onChange('')} aria-label="Clear date filter">Clear date</button>}
    {!value&&<span className="filter-all-dates">All dates · choose month/day to filter</span>}
  </div>;
}

export default function App(){
  const [page,setPage]=useState('dashboard');
  const [bookings,setBookings]=useState([]);
  const [services,setServices]=useState([]);
  const [stats,setStats]=useState({total:0,pending:0,confirmed:0,completed:0,cancelled:0});
  const [loading,setLoading]=useState(true);
  const [notice,setNotice]=useState(null);
  const [appointmentModal,setAppointmentModal]=useState(null);
  const [serviceModal,setServiceModal]=useState(null);
  const [query,setQuery]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const [dateFilter,setDateFilter]=useState('');
  const [savingStatus,setSavingStatus]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [calendarToday,setCalendarToday]=useState(dateToday());
  // Refresh today's label after midnight and when the tab becomes visible again.
  useEffect(()=>{
    const update=()=>setCalendarToday(dateToday());
    const timer=setInterval(update,60000);
    document.addEventListener('visibilitychange',update);
    window.addEventListener('focus',update);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('focus',update);};
  },[]);
  async function refresh(){
    try{
      const [bs,ss,st]=await Promise.all([api('/appointments'),api('/services'),api('/stats')]);
      setBookings(bs);setServices(ss);setStats(st);
    }catch(e){setNotice({type:'error',text:e.message});}
    finally{setLoading(false);}
  }
  useEffect(()=>{refresh();},[]);
  function flash(text,type='success'){setNotice({text,type});}
  const pageTo=(p)=>{setPage(p);setSidebarOpen(false);setNotice(null);};
  async function deleteAppointment(item){
    if(!window.confirm(`Delete the appointment for ${item.customer_name}? This cannot be undone.`))return;
    try{await api(`/appointments/${item.id}`,{method:'DELETE'});await refresh();flash('Appointment deleted.');}
    catch(e){flash(e.message,'error');}
  }
  async function toggleServiceAvailability(item){
    try{
      await api(`/services/${item.id}/availability`,{
        method:'PATCH',body:JSON.stringify({is_available:!Boolean(item.is_available)})
      });
      await refresh();
      flash(`${item.name} is now ${item.is_available?'Unavailable':'Available'} for new bookings.`);
    }catch(e){flash(e.message,'error');}
  }
  async function deleteService(item){
    if(!window.confirm(`Delete the service “${item.name}”?`))return;
    try{await api(`/services/${item.id}`,{method:'DELETE'});await refresh();flash('Service removed.');}
    catch(e){flash(e.message,'error');}
  }
  async function changeStatus(item,newStatus){
    if(item.status===newStatus)return;
    setSavingStatus(item.id);
    try{
      await api(`/appointments/${item.id}/status`,{method:'PATCH',body:JSON.stringify({status:newStatus})});
      await refresh();flash(`${item.customer_name}'s appointment changed to ${labels[newStatus]}.`);
    }catch(e){flash(e.message,'error');await refresh();}
    finally{setSavingStatus(null);}
  }
  useEffect(()=>{
    if(dateFilter && dateFilter.slice(0,4)!==calendarToday.slice(0,4))setDateFilter('');
  },[calendarToday,dateFilter]);
  const filtered=bookings.filter(b=>(statusFilter==='all'||b.status===statusFilter)&&(!dateFilter||b.date===dateFilter)&&`${b.customer_name} ${b.phone} ${b.service_name}`.toLowerCase().includes(query.trim().toLowerCase()));
  const upcoming=[...bookings].filter(b=>b.date>=calendarToday&&b.status!=='cancelled'&&b.status!=='completed').sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const nav=[{id:'dashboard',label:'Dashboard',Icon:LayoutDashboard},{id:'appointments',label:'Appointments',Icon:CalendarDays},{id:'services',label:'Services',Icon:Settings2}];
  const cards=[{key:'total',label:'Total appointments',Icon:CalendarDays,note:'All recorded bookings'},{key:'pending',label:'Pending approval',Icon:Clock3,note:'Awaiting confirmation'},{key:'confirmed',label:'Confirmed',Icon:CalendarCheck2,note:'Scheduled visits'},{key:'completed',label:'Completed',Icon:CheckCircle2,note:'Finished visits'},{key:'cancelled',label:'Cancelled',Icon:CircleX,note:'Cancelled reservations'}];
  return <div className="app-layout">
    <aside className={`sidebar ${sidebarOpen?'is-open':''}`}>
      <div className="logo"><div className="logo-icon"><Scissors size={26}/></div><div className="logo-type">Book<span>Ease</span><small>SALON BOOKING SYSTEM</small></div></div>
      <div className="menu-caption">WORKSPACE</div>
      <nav className="nav-list">{nav.map(({id,label,Icon})=><button key={id} className={`nav-link ${page===id?'active':''}`} onClick={()=>pageTo(id)}><Icon size={19}/>{label}</button>)}</nav>
    </aside>
    {sidebarOpen&&<button className="mobile-overlay" aria-label="Close menu" onClick={()=>setSidebarOpen(false)}/>}
    <main className="main">
      <div className="topbar"><button className="icon-btn hamburger" onClick={()=>setSidebarOpen(true)} aria-label="Menu"><Menu size={22}/></button><div className="breadcrumb">Workspace <span>/</span> <strong>{nav.find(n=>n.id===page)?.label}</strong></div><div className="topbar-actions"><span className="top-date"><CalendarDays size={16}/>{dateText(calendarToday)}</span><button className="icon-btn" title="Refresh data" aria-label="Refresh data" onClick={refresh}><RefreshCw size={18}/></button></div></div>
      <div className="content">
        {notice&&<div className={`notice ${notice.type}`} role="alert"><span>{notice.type==='error'?<AlertTriangle size={18}/>:<CheckCircle2 size={18}/>} {notice.text}</span><button onClick={()=>setNotice(null)} aria-label="Dismiss"><X size={18}/></button></div>}
        {loading?<div className="loading">Loading your salon workspace...</div>:<>
          {page==='dashboard'&&<>
            <section className="hero"><div className="hero-inner"><div className="hero-kicker"><Sparkles size={14}/> YOUR BEAUTY WORKSPACE</div><h1>Welcome to BookEase Salon <span>✳</span></h1><p>A lovely little space to keep appointments and salon schedules organized.</p></div><div className="hero-decor"><div className="beauty-decor"><Flower2 size={55} strokeWidth={1.3}/><Scissors size={55} strokeWidth={1.3}/><Sparkles size={24}/></div></div></section>
            <div className="section-heading"><h2>Overview <span className="tiny-flower">✿</span></h2><p>Your salon at a glance.</p></div>
            <div className="stats-grid">{cards.map(({key,label,Icon,note})=><article className="stat-card" key={key}><div className={`stat-icon ${key}`}><Icon size={22}/></div><span className="stat-label">{label}</span><div className="stat-number">{stats[key]||0}</div><small>{note}</small></article>)}</div>
            <section className="panel upcoming-panel"><div className="panel-header"><div><h2>Upcoming salon reservations</h2><p>Customers expected at the salon • view only</p></div><span className="count-tag"><Heart size={13}/> {upcoming.length} upcoming</span></div>
              <AppointmentTable items={upcoming} compact empty="No upcoming reservations yet."/>
            </section>
          </>}
          {page==='appointments'&&<>
            <div className="page-head"><div><span className="eyebrow"><Sparkles size={13}/> CUSTOMER APPOINTMENTS</span><h1>Appointments</h1><p>Manage visits, confirm bookings and keep your salon schedule lovely.</p></div><button className="btn primary" onClick={()=>setAppointmentModal({})}><Plus size={19}/> New Appointment</button></div>
            <section className="panel"><div className="filterbar"><label className="search-box"><Search size={18}/><input aria-label="Search appointments" placeholder="Search name, phone, or service..." value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter by status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(s=><option value={s} key={s}>{labels[s]}</option>)}</select><LockedDateFilter value={dateFilter} onChange={setDateFilter} today={calendarToday}/></div>
              <AppointmentTable items={filtered} empty="No appointments match your search." onEdit={setAppointmentModal} onDelete={deleteAppointment} onStatus={changeStatus} savingStatus={savingStatus}/><div className="table-bottom">Showing {filtered.length} of {bookings.length} appointments</div>
            </section>
          </>}
          {page==='services'&&<>
            <div className="page-head"><div><span className="eyebrow"><Flower2 size={12}/> SALON MENU & PRICES</span><h1>Salon Services</h1><p>Manage services, prices and availability. Toggle a service off when it cannot be booked.</p></div><button className="btn primary" onClick={()=>setServiceModal({})}><Plus size={19}/> Add Service</button></div>
            <div className="services-grid">{services.map(s=><article className={`service-card ${s.is_available?'':'service-unavailable'}`} key={s.id}>
              <div className="service-card-top"><div className="service-symbol"><WandSparkles size={23}/></div><span className={`service-badge ${s.is_available?'available':'unavailable'}`}>{s.is_available?'✿ Available':'♡ Unavailable'}</span></div>
              <h3>{s.name}</h3><p>{s.description||'Beautiful salon service.'}</p>
              <div className="service-facts"><span><Clock3 size={15}/>{s.duration} min</span><b>{pesos(s.price)}</b></div>
              <div className="availability-row"><div><strong>Accept bookings</strong><small>{s.is_available?'Customers can reserve this service':'Temporarily hidden from new bookings'}</small></div><button type="button" className={`availability-switch ${s.is_available?'on':''}`} role="switch" aria-checked={Boolean(s.is_available)} aria-label={`${s.name} availability`} onClick={()=>toggleServiceAvailability(s)}><span/></button></div>
              <div className="service-controls"><button className="btn ghost" onClick={()=>setServiceModal(s)}><Pencil size={15}/> Edit</button><button className="btn ghost delete" onClick={()=>deleteService(s)}><Trash2 size={15}/> Delete</button></div>
            </article>)}</div>
          </>}
        </>}
      </div>
    </main>
    {appointmentModal!==null&&<AppointmentForm key={appointmentModal.id||'new'} record={appointmentModal} services={services} onClose={()=>setAppointmentModal(null)} onSaved={async()=>{setAppointmentModal(null);await refresh();flash(appointmentModal.id?'Appointment details saved.':'New appointment added as Pending.');}}/>}
    {serviceModal!==null&&<ServiceForm key={serviceModal.id||'new'} record={serviceModal} onClose={()=>setServiceModal(null)} onSaved={async()=>{setServiceModal(null);await refresh();flash(serviceModal.id?'Salon service updated.':'Salon service added.');}}/>}
  </div>;
}
function AppointmentTable({items,compact=false,onEdit,onDelete,onStatus,savingStatus,empty}){
  return <div className="table-scroll"><table className="booking-table"><thead><tr><th>Customer</th><th>Service</th><th>Date & time</th><th>Status</th>{!compact&&<th>Actions</th>}</tr></thead><tbody>{items.map(b=><tr key={b.id}><td><div className="customer"><div className="initial">{b.customer_name.charAt(0).toUpperCase()}</div><div><b>{b.customer_name}</b><small>{b.phone}</small></div></div></td><td>{b.service_name}</td><td><div className="date-stack"><b>{dateText(b.date)}</b><small>{timeText(b.time)}</small></div></td><td>{compact?<StatusPill value={b.status}/>:<select className={`status-select ${b.status}`} aria-label={`Status for ${b.customer_name}`} title="Pending = awaiting approval; Confirmed = salon accepted; Completed = service finished; Cancelled = not proceeding" value={b.status} disabled={savingStatus===b.id} onChange={e=>onStatus(b,e.target.value)}>{statuses.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select>}</td>{!compact&&<td><div className="action-icons"><button className="edit-icon" onClick={()=>onEdit(b)} title="Edit details" aria-label={`Edit ${b.customer_name}`}><Pencil size={17}/></button><button className="trash-icon" onClick={()=>onDelete(b)} title="Delete appointment" aria-label={`Delete ${b.customer_name}`}><Trash2 size={17}/></button></div></td>}</tr>)}</tbody></table>{!items.length&&<div className="empty"><ClipboardCheck size={29}/><p>{empty}</p></div>}</div>;
}
function AppointmentForm({record,services,onClose,onSaved}){
  const [form,setForm]=useState({...emptyBooking,...record,service_id:record.service_id||(services.find(s=>s.is_available)?.id||''),date:record.date||dateToday()});
  const [clockToday,setClockToday]=useState(dateToday());
  useEffect(()=>{
    const refreshClock=()=>{
      const newToday=dateToday();
      setClockToday(newToday);
      setForm(f=>!record.id && f.date && f.date.slice(0,4)!==newToday.slice(0,4)?{...f,date:newToday,time:''}:f);
    };
    const timer=setInterval(refreshClock,60000);
    window.addEventListener('focus',refreshClock);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refreshClock);};
  },[]);
  const lockedYear=Number(clockToday.slice(0,4));
  const chosenMonth=Number((form.date||clockToday).slice(5,7));
  const chosenDay=Number((form.date||clockToday).slice(8,10));
  const remainingDays=daysInMonth(lockedYear,chosenMonth);
  const isOldYear=Boolean(record.id && record.date && Number(record.date.slice(0,4))!==lockedYear);
  const updateDate=(month,day)=>{
    const m=Number(month), d=Number(day);
    const next=makeDate(lockedYear,m,Math.min(d,daysInMonth(lockedYear,m)));
    setForm(f=>({...f,date:next,time:''}));
  };
  const [slots,setSlots]=useState([]);
  const [working,setWorking]=useState(false);
  const [waiting,setWaiting]=useState(false);
  const [error,setError]=useState('');
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  useEffect(()=>{
    if(!form.date||!form.service_id){setSlots([]);return;}
    let active=true;setWaiting(true);setError('');
    api(`/availability?date=${form.date}&service_id=${form.service_id}${record.id?`&exclude_id=${record.id}`:''}`).then(d=>{if(active)setSlots(d.slots);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setWaiting(false);});
    return()=>{active=false;};
  },[form.date,form.service_id,record.id]);
  const available=(slots.includes(form.time)||!record.id?slots:[...slots,form.time]).sort();
  async function save(e){
    e.preventDefault();setError('');
    const todayNow=dateToday();
    if(!/^09\d{9}$/.test(form.phone)){setError('Phone must be exactly 11 digits and start with 09.');return;}
    if(form.date.slice(0,4)!==todayNow.slice(0,4)){setError(`Year is locked to ${todayNow.slice(0,4)}.`);return;}
    if(form.date<todayNow){setError('You cannot book a past date.');return;}
    const chosenService=services.find(s=>s.id===Number(form.service_id));
    if(!chosenService){setError('Choose an available salon service.');return;}
    if(!chosenService.is_available && (!record.id || Number(record.service_id)!==Number(form.service_id) || record.date!==form.date || record.time!==form.time)){setError('This service is unavailable. Only the existing customer information can be edited.');return;}
    setWorking(true);
    try{await api(record.id?`/appointments/${record.id}`:'/appointments',{method:record.id?'PUT':'POST',body:JSON.stringify(form)});await onSaved();}
    catch(e){setError(e.message);}finally{setWorking(false);}
  }
  return <Modal title={record.id?'Edit Appointment':'New Appointment'} onClose={onClose}><form className="form" onSubmit={save}>
    <div className="form-section-title"><Heart size={17}/> CUSTOMER DETAILS</div>
    <div className="field-grid"><label>Full name <span>*</span><input required maxLength={100} value={form.customer_name} onChange={e=>set('customer_name',e.target.value)} placeholder="e.g. Maria Santos"/></label><label>Phone number <span>*</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" minLength={11} maxLength={11} pattern="09[0-9]{9}" title="Exactly 11 digits, beginning with 09" value={form.phone} onChange={e=>set('phone',e.target.value.replace(/\D/g,'').slice(0,11))} placeholder="09XXXXXXXXX"/><small className="field-helper">11 digits only · must start with 09</small></label><label className="wide-field">Email (optional)<input type="email" maxLength={150} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="customer@example.com"/></label></div>
    <div className="form-section-title"><Flower2 size={17}/> BOOKING DETAILS</div>
    <div className="field-grid"><label className="wide-field">Salon service <span>*</span><select required value={form.service_id} onChange={e=>setForm(f=>({...f,service_id:Number(e.target.value),time:''}))}><option value="">Choose a service</option>{services.filter(s=>s.is_available||(record.id&&s.id===record.service_id)).map(s=><option value={s.id} key={s.id}>{s.name}{!s.is_available?' (Unavailable — existing booking)':''} — {s.duration} min ({pesos(s.price)})</option>)}</select></label><label className="wide-field">Appointment date <span>*</span>
      <div className="date-picker-locked">
        <select aria-label="Month" required value={chosenMonth} onChange={e=>updateDate(e.target.value,chosenDay)}>
          {MONTHS.map((name,i)=><option key={name} value={i+1} disabled={i+1<Number(clockToday.slice(5,7))}>{name}</option>)}
        </select>
        <select aria-label="Day" required value={chosenDay} onChange={e=>updateDate(chosenMonth,e.target.value)}>
          {Array.from({length:remainingDays},(_,i)=>i+1).map(d=><option key={d} value={d} disabled={chosenMonth===Number(clockToday.slice(5,7))&&d<Number(clockToday.slice(8,10))}>{d}</option>)}
        </select>
        <div className="locked-year" title="Year changes automatically based on the real calendar"><span>{lockedYear}</span><small>🔒 YEAR</small></div>
      </div>
      <small className="field-helper">Only this month or later in the locked year. Past months and days cannot be chosen.</small>
      {isOldYear&&<small className="date-warning">Old record: select a date in {lockedYear} to reschedule.</small>}
    </label><label>Available time <span>*</span><select required disabled={waiting||!form.service_id} value={form.time} onChange={e=>set('time',e.target.value)}><option value="">{waiting?'Loading time slots...':'Choose a time'}</option>{available.map(t=><option key={t} value={t}>{timeText(t)}</option>)}</select></label><label className="wide-field">Notes (optional)<textarea rows={3} maxLength={500} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Hairstyle preference, special requests..."/></label></div>
    <p className="form-hint"><CalendarClock size={15}/> Salon hours: 9 AM–5 PM. New bookings are Pending until staff approves them. Confirmed means the salon has accepted the reservation and expects the client on that date.</p>
    {error&&<div className="form-error"><AlertTriangle size={17}/>{error}</div>}
    <div className="form-footer"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" className="btn primary" disabled={working||!services.length}>{working?'Saving...':record.id?'Save Details':'Create Appointment'}</button></div>
  </form></Modal>;
}
function ServiceForm({record,onClose,onSaved}){
  const [form,setForm]=useState({...emptyService,...record});
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const set=(k,v)=>setForm(x=>({...x,[k]:v}));
  async function save(e){e.preventDefault();setWorking(true);setError('');try{await api(record.id?`/services/${record.id}`:'/services',{method:record.id?'PUT':'POST',body:JSON.stringify(form)});await onSaved();}catch(e){setError(e.message);}finally{setWorking(false);}}
  return <Modal title={record.id?'Edit Salon Service':'Add Salon Service'} onClose={onClose}><form className="form" onSubmit={save}>
    <div className="form-section-title"><Scissors size={17}/> SERVICE INFORMATION</div>
    <div className="field-grid"><label className="wide-field">Service name <span>*</span><input required maxLength={100} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Hair Coloring"/></label><label>Duration <span>*</span><select value={form.duration} onChange={e=>set('duration',Number(e.target.value))}>{[30,60,90,120].map(t=><option key={t} value={t}>{t} minutes</option>)}</select></label><label>Price (₱) <span>*</span><input type="number" min="0" step="0.01" required value={form.price} onChange={e=>set('price',e.target.value)}/></label><label className="wide-field">Description<textarea maxLength={500} rows={3} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Describe your service..."/></label></div>
    {error&&<div className="form-error"><AlertTriangle size={17}/>{error}</div>}
    <div className="form-footer"><button className="btn ghost" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={working}>{working?'Saving...':record.id?'Save Changes':'Add Service'}</button></div>
  </form></Modal>;
}

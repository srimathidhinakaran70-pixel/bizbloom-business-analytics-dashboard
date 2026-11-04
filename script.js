'use strict';

const CSV_COLUMNS = ['Order ID','Order Date','Customer Name','Product','Category','Region','Quantity','Unit Price','Revenue','Expenses','Profit'];
const currency = new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});
const numberFmt = new Intl.NumberFormat('en-IN');
const palette = ['#9674bd','#e99ab8','#f3bd9f','#9cc9a7','#c6a5db','#d77f9e','#e6c17d','#8bb8c4'];
let allRecords = [], filteredRecords = [], charts = {}, currentPage = 1, pageSize = 8, toastTimer;

const $ = id => document.getElementById(id);
const money = n => currency.format(Number(n)||0);
const sum = (rows,key) => rows.reduce((a,r)=>a+(Number(r[key])||0),0);
const safeText = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
const monthLabel = key => {const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-IN',{month:'short',year:'2-digit'});};
const parseDate = value => {const d=new Date(value);return Number.isNaN(d.getTime())?null:d;};

function showToast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}
function parseCSV(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],next=text[i+1];if(c==='"'){if(quoted&&next==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field.trim());field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&next==='\n')i++;row.push(field.trim());if(row.some(x=>x!==''))rows.push(row);row=[];field='';}else field+=c;}
  if(field.length||row.length){row.push(field.trim());if(row.some(x=>x!==''))rows.push(row);}
  if(!rows.length)throw new Error('The CSV file is empty.');
  const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,'').trim().toLowerCase());
  const aliases={'order id':['order id','order_id','orderid'],'order date':['order date','date','order_date'],'customer name':['customer name','customer','customer_name'],'product':['product','product name'],'category':['category'],'region':['region'],'quantity':['quantity','qty'],'unit price':['unit price','unit_price','price'],'revenue':['revenue','sales'],'expenses':['expenses','expense','cost'],'profit':['profit','net profit']};
  const index={};for(const [canonical,alts] of Object.entries(aliases)){index[canonical]=headers.findIndex(h=>alts.includes(h));if(index[canonical]<0)throw new Error(`Missing required column: ${canonical}.`);}
  const records=[],errors=[];
  rows.forEach((r,i)=>{const get=k=>r[index[k]]??'';const date=parseDate(get('order date'));const qty=Number(get('quantity')),price=Number(get('unit price')),revenue=Number(get('revenue')),expenses=Number(get('expenses')),profit=Number(get('profit'));const customer=get('customer name'),product=get('product'),region=get('region'),category=get('category'),id=get('order id');
    const missing=[id,customer,product,region,category].some(v=>!String(v).trim())||!get('order date').trim();
    const numeric=[qty,price,revenue,expenses,profit].every(Number.isFinite);
    if(missing||!date||!numeric||qty<=0||price<0||revenue<0||expenses<0){errors.push(`Row ${i+2}: missing, invalid or non-positive required values`);return;}
    const tolerance=0.02;
    if(Math.abs(revenue-qty*price)>tolerance||Math.abs(profit-(revenue-expenses))>tolerance){errors.push(`Row ${i+2}: calculation mismatch (Revenue = Qty × Unit Price; Profit = Revenue − Expenses)`);return;}
    records.push({id,date,customer,product,category,region,quantity:qty,unitPrice:price,revenue,expenses,profit});
  });
  if(!records.length)throw new Error(`No valid records found. ${errors.slice(0,3).join('; ')}`);
  return {records,errors};
}
function normalizeDemo(rows){return rows.map(r=>({id:r['Order ID'],date:parseDate(r['Order Date']),customer:r['Customer Name'],product:r.Product,category:r.Category,region:r.Region,quantity:+r.Quantity,unitPrice:+r['Unit Price'],revenue:+r.Revenue,expenses:+r.Expenses,profit:+r.Profit}));}

async function loadDemo(){
  try{const response=await fetch('sample-data.csv');if(!response.ok)throw new Error('Could not load sample-data.csv');const parsed=parseCSV(await response.text());allRecords=parsed.records;setValidation(`✓ Demo dataset loaded: ${allRecords.length} valid records.`);}
  catch(e){allRecords=makeFallbackData();setValidation('✓ Built-in demo data loaded. Place sample-data.csv beside index.html for the downloadable sample file.');}
  populateFilters();applyFilters();
}
function makeFallbackData(){
  const products=[['Aura Bottle','Lifestyle'],['Bloom Planner','Stationery'],['Luna Lamp','Home'],['Petal Tote','Accessories'],['Cloud Mug','Home']];
  const regions=['North','South','East','West'];const customers=['Aarav Mehta','Diya Shah','Kabir Rao','Meera Iyer','Rohan Das','Anaya Nair','Ishaan Kapoor','Sara Khan'];
  return Array.from({length:36},(_,i)=>{const p=products[i%5],q=1+i%4,price=[650,420,1450,780,520][i%5],revenue=q*price,expenses=Math.round(revenue*(.55+(i%4)*.04));return{id:`BB-${1001+i}`,date:new Date(2025,0+i%12,2+(i*3)%25),customer:customers[i%8],product:p[0],category:p[1],region:regions[i%4],quantity:q,unitPrice:price,revenue,expenses,profit:revenue-expenses};});
}
function setValidation(message,error=false){const el=$('validationMessage');el.textContent=message;el.classList.toggle('error',error);}
function populateFilters(){
  const fill=(id,values,label)=>{const select=$(id),old=select.value;select.innerHTML=`<option value="all">All ${label}</option>`;[...new Set(values)].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;select.appendChild(o);});if([...select.options].some(o=>o.value===old))select.value=old;};
  const months=[...new Set(allRecords.map(r=>monthKey(r.date)))].sort();const date=$('dateFilter'),old=date.value;date.innerHTML='<option value="all">All dates</option>';months.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=monthLabel(m);date.appendChild(o);});if([...date.options].some(o=>o.value===old))date.value=old;
  fill('productFilter',allRecords.map(r=>r.product),'products');fill('categoryFilter',allRecords.map(r=>r.category),'categories');fill('regionFilter',allRecords.map(r=>r.region),'regions');
}
function applyFilters(){
  const month=$('dateFilter').value,product=$('productFilter').value,category=$('categoryFilter').value,region=$('regionFilter').value;
  filteredRecords=allRecords.filter(r=>(month==='all'||monthKey(r.date)===month)&&(product==='all'||r.product===product)&&(category==='all'||r.category===category)&&(region==='all'||r.region===region));
  currentPage=1;$('dateRangeText').textContent=month==='all'?'All available dates':monthLabel(month);
  renderDashboard();renderTable();
}
function groupSum(rows,key,value){const map=new Map();rows.forEach(r=>map.set(r[key],(map.get(r[key])||0)+r[value]));return [...map.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0])));}
function monthGroups(rows){const map=new Map();rows.forEach(r=>{const k=monthKey(r.date);if(!map.has(k))map.set(k,{revenue:0,expenses:0,profit:0});map.get(k).revenue+=r.revenue;map.get(k).expenses+=r.expenses;map.get(k).profit+=r.profit;});return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));}
function setText(id,value){$(id).textContent=value;}
function renderDashboard(){
  const rows=filteredRecords,rev=sum(rows,'revenue'),exp=sum(rows,'expenses'),profit=sum(rows,'profit'),orders=rows.length,customers=new Set(rows.map(r=>r.customer)).size;
  setText('totalRevenue',money(rev));setText('totalExpenses',money(exp));setText('netProfit',money(profit));setText('totalOrders',numberFmt.format(orders));setText('totalCustomers',numberFmt.format(customers));setText('averageOrder',money(orders?rev/orders:0));setText('profitMargin',`${rev?(profit/rev*100).toFixed(1):'0.0'}%`);
  $('profitBadge').textContent=profit>=0?'Positive result':'Loss period';$('profitBadge').classList.toggle('positive',profit>=0);
  const months=monthGroups(rows),monthLabels=months.map(x=>monthLabel(x[0])),monthlyRevenue=months.map(x=>x[1].revenue),monthlyProfit=months.map(x=>x[1].profit);
  const products=groupSum(rows,'product','revenue').sort((a,b)=>b[1]-a[1]),regions=groupSum(rows,'region','revenue').sort((a,b)=>b[1]-a[1]);
  const best=products[0];setText('bestProduct',best?.[0]||'No sales yet');setText('bestProductDetail',best?`${money(best[1])} revenue · ${rows.filter(r=>r.product===best[0]).reduce((a,r)=>a+r.quantity,0)} units sold.`:'No product data in this selection.');
  drawChart('revenueChart','line',{labels:monthLabels,datasets:[{label:'Revenue',data:monthlyRevenue,borderColor:'#9874bd',backgroundColor:'rgba(190,159,218,.18)',fill:true,tension:.38,pointBackgroundColor:'#fff',pointBorderColor:'#9874bd',pointBorderWidth:2,pointRadius:4}]},{plugins:{legend:{display:false}}});
  drawChart('productChart','bar',{labels:products.map(x=>x[0]),datasets:[{label:'Revenue',data:products.map(x=>x[1]),backgroundColor:products.map((_,i)=>palette[i%palette.length]),borderRadius:7,maxBarThickness:28}]},{indexAxis:'y',plugins:{legend:{display:false}}});
  drawChart('regionChart','doughnut',{labels:regions.map(x=>x[0]),datasets:[{data:regions.map(x=>x[1]),backgroundColor:regions.map((_,i)=>palette[i%palette.length]),borderWidth:3,borderColor:'#fff',hoverOffset:7}]},{cutout:'66%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:7,padding:14,font:{size:10}}}}});
  drawChart('profitChart','bar',{labels:monthLabels,datasets:[{label:'Profit',data:monthlyProfit,backgroundColor:monthlyProfit.map(v=>v>=0?'#9bc9a5':'#e99ab8'),borderRadius:6,maxBarThickness:26}]},{plugins:{legend:{display:false}}});
  const customerMap=new Map();rows.forEach(r=>{const c=customerMap.get(r.customer)||{revenue:0,orders:0,first:r.date};c.revenue+=r.revenue;c.orders++;if(r.date<c.first)c.first=r.date;customerMap.set(r.customer,c);});
  const customerRows=[...customerMap.entries()].sort((a,b)=>b[1].revenue-a[1].revenue),newCount=customerRows.filter(x=>{const first=allRecords.filter(r=>r.customer===x[0]).sort((a,b)=>a.date-b.date)[0];return first&&rows.some(r=>r.customer===x[0]&&r.date.getTime()===first.date.getTime());}).length;
  setText('customerTotalLarge',customers);setText('newCustomers',newCount);setText('returningCustomers',Math.max(0,customers-newCount));
  setText('customerSupportNote','New = first-ever purchase is in this filtered view; returning = previously purchased customers visible here. Classification uses the full loaded dataset.');
  const oneOrder=customerRows.filter(x=>x[1].orders===1).length,multi=customerRows.filter(x=>x[1].orders>1).length;
  drawChart('customerChart','doughnut',{labels:['One order','Repeat orders'],datasets:[{data:[oneOrder,multi],backgroundColor:['#c8afe0','#e99ab8'],borderWidth:3,borderColor:'#fff'}]},{cutout:'68%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:7,padding:15,font:{size:10}}}}});
  $('topCustomersList').innerHTML=customerRows.slice(0,5).map((x,i)=>`<div class="rank-row"><span class="rank-number">${i+1}</span><div><div class="rank-name">${safeText(x[0])}</div><div class="rank-sub">${x[1].orders} order${x[1].orders===1?'':'s'}</div></div><strong class="rank-value">${money(x[1].revenue)}</strong></div>`).join('')||'<p class="small-note">No customer data for this selection.</p>';
  renderInsights(rows,months,products,regions,profit,rev,exp,customerRows);
}
function drawChart(id,type,data,extra={}){
  const canvas=$(id);if(!canvas||typeof Chart==='undefined'){return;}if(charts[id])charts[id].destroy();
  charts[id]=new Chart(canvas,{type,data,options:{responsive:true,maintainAspectRatio:false,animation:{duration:500},interaction:{intersect:false,mode:'index'},plugins:{legend:{display:false},tooltip:{backgroundColor:'#493853',padding:10,titleFont:{family:'DM Sans'},bodyFont:{family:'DM Sans'},callbacks:{label:ctx=>`${ctx.dataset.label||ctx.label}: ${money(ctx.raw)}`}}},scales:type==='doughnut'?{}:{x:{grid:{display:false},ticks:{color:'#9e94a4',font:{size:9},maxRotation:35}},y:{beginAtZero:true,grid:{color:'#f1edf3'},ticks:{color:'#a49aa9',font:{size:9},callback:v=>v>=100000?`₹${(v/100000).toFixed(1)}L`:v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}}},...extra}});
}
function renderInsights(rows,months,products,regions,profit,rev,exp,customers){
  const highest=[...months].sort((a,b)=>b[1].revenue-a[1].revenue)[0],lowest=[...months].sort((a,b)=>a[1].revenue-b[1].revenue)[0],bestProduct=products[0],bestRegion=regions[0];
  const previous=months.length>1?months[months.length-2][1].revenue:0,last=months.length?months[months.length-1][1].revenue:0,growth=previous?((last-previous)/previous*100):null;
  const productProfit=groupSum(rows,'product','profit').sort((a,b)=>a[1]-b[1]),weak=productProfit[0];
  setText('salesGrowth',growth===null?'Not enough months':`${growth>=0?'+':''}${growth.toFixed(1)}% vs previous month`);
  setText('highestMonth',highest?`${monthLabel(highest[0])} · ${money(highest[1].revenue)}`:'—');setText('lowestMonth',lowest?`${monthLabel(lowest[0])} · ${money(lowest[1].revenue)}`:'—');
  setText('businessSummary',!rows.length?'No records':profit>=0?'Profitable':'Operating at a loss');
  const tiles=[
    ['Highest revenue month',highest?`${monthLabel(highest[0])} led with ${money(highest[1].revenue)} in revenue.`:'There are no monthly sales records.'],
    ['Most profitable product',products.length?`${productProfit.slice().sort((a,b)=>b[1]-a[1])[0][0]} generated the strongest total profit.`:'Product profitability is not available.'],
    ['Best-performing region',bestRegion?`${bestRegion[0]} contributed ${money(bestRegion[1])} in revenue.`:'No regional sales are available.'],
    ['Total profit or loss',`${money(Math.abs(profit))} ${profit>=0?'net profit':'net loss'} from ${money(rev)} revenue and ${money(exp)} expenses.`],
    ['Products needing improvement',weak&&weak[1]<0?`${weak[0]} currently has a negative total profit. Review its costs and pricing.`:weak?`${weak[0]} has the lowest total product profit (${money(weak[1])}); review its margin.`:'No product performance data available.'],
    ['Customer value',customers.length?`${customers[0][0]} is the highest-value customer at ${money(customers[0][1].revenue)}.`:'No customer data is available.']
  ];
  $('insightGrid').innerHTML=tiles.map(([title,body])=>`<article class="insight-tile"><span>✧</span><strong>${safeText(title)}</strong><p>${safeText(body)}</p></article>`).join('');
}
function getTableRows(){
  const q=$('tableSearch').value.trim().toLowerCase(),sort=$('sortSelect').value;
  let rows=filteredRecords.filter(r=>[r.id,r.customer,r.product,r.category,r.region].some(v=>String(v).toLowerCase().includes(q)));
  const sorters={'date-desc':(a,b)=>b.date-a.date,'date-asc':(a,b)=>a.date-b.date,'revenue-desc':(a,b)=>b.revenue-a.revenue,'revenue-asc':(a,b)=>a.revenue-b.revenue,'profit-desc':(a,b)=>b.profit-a.profit,'customer-asc':(a,b)=>a.customer.localeCompare(b.customer)};
  rows.sort(sorters[sort]||sorters['date-desc']);return rows;
}
function renderTable(){
  const rows=getTableRows(),pages=Math.max(1,Math.ceil(rows.length/pageSize));currentPage=Math.min(currentPage,pages);const visible=rows.slice((currentPage-1)*pageSize,currentPage*pageSize);
  $('dataTableBody').innerHTML=visible.map(r=>`<tr><td>${safeText(r.id)}</td><td>${r.date.toLocaleDateString('en-IN')}</td><td>${safeText(r.customer)}</td><td>${safeText(r.product)}</td><td>${safeText(r.category)}</td><td>${safeText(r.region)}</td><td>${r.quantity}</td><td>${money(r.revenue)}</td><td>${money(r.expenses)}</td><td class="${r.profit>=0?'profit-cell':'loss-cell'}">${money(r.profit)}</td></tr>`).join('');
  $('emptyState').hidden=rows.length!==0;$('recordCount').textContent=`Showing ${visible.length} of ${rows.length} matching records · ${filteredRecords.length} after filters`;$('pageInfo').textContent=`${currentPage} / ${pages}`;$('prevPage').disabled=currentPage===1;$('nextPage').disabled=currentPage===pages;
}
function csvEscape(value){const s=String(value??'');return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function downloadCSV(filename,headers,rows){const csv=[headers,...rows].map(row=>row.map(csvEscape).join(',')).join('\r\n');const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast(`${filename} downloaded`);}
function exportRecords(){const rows=getTableRows();downloadCSV('bizbloom-filtered-records.csv',CSV_COLUMNS,rows.map(r=>[r.id,r.date.toISOString().slice(0,10),r.customer,r.product,r.category,r.region,r.quantity,r.unitPrice,r.revenue,r.expenses,r.profit]));}
function exportSummary(){const rows=filteredRecords,rev=sum(rows,'revenue'),exp=sum(rows,'expenses'),profit=sum(rows,'profit');const summary=[['Metric','Value'],['Total revenue',rev],['Total expenses',exp],['Net profit',profit],['Total orders',rows.length],['Unique customers',new Set(rows.map(r=>r.customer)).size],['Average order value',rows.length?rev/rows.length:0],['Profit margin',rev?profit/rev*100:0]];downloadCSV('bizbloom-business-summary.csv',summary[0],summary.slice(1));}
function downloadSample(){const a=document.createElement('a');a.href='sample-data.csv';a.download='sample-data.csv';document.body.appendChild(a);a.click();a.remove();}
function handleUpload(file){
  if(!file)return;if(!file.name.toLowerCase().endsWith('.csv')){setValidation('Please choose a .csv file.',true);showToast('Only CSV files are supported.');return;}
  const reader=new FileReader();reader.onload=()=>{try{const parsed=parseCSV(String(reader.result));allRecords=parsed.records;populateFilters();$('tableSearch').value='';$('dateFilter').value=$('productFilter').value=$('categoryFilter').value=$('regionFilter').value='all';applyFilters();const issue=parsed.errors.length?` ${parsed.errors.length} invalid row(s) skipped.`:'';setValidation(`✓ Uploaded ${file.name}: ${allRecords.length} valid records.${issue}${parsed.errors.length?' First issue: '+parsed.errors[0]:''}`);$('updatedLabel').textContent='Custom dataset loaded';showToast(`Loaded ${allRecords.length} valid records`);}catch(e){setValidation(e.message,true);showToast('Could not load CSV. Check the file format.');}};reader.onerror=()=>{setValidation('Unable to read this file.',true);};reader.readAsText(file);
}
function initEvents(){
  ['dateFilter','productFilter','categoryFilter','regionFilter'].forEach(id=>$(id).addEventListener('change',applyFilters));
  $('resetFilters').addEventListener('click',()=>{['dateFilter','productFilter','categoryFilter','regionFilter'].forEach(id=>$(id).value='all');$('tableSearch').value='';applyFilters();showToast('Filters reset');});
  $('tableSearch').addEventListener('input',()=>{currentPage=1;renderTable();});$('sortSelect').addEventListener('change',()=>{currentPage=1;renderTable();});
  $('prevPage').addEventListener('click',()=>{currentPage=Math.max(1,currentPage-1);renderTable();});$('nextPage').addEventListener('click',()=>{currentPage++;renderTable();});
  $('csvUpload').addEventListener('change',e=>{handleUpload(e.target.files[0]);e.target.value='';});
  $('exportRecords').addEventListener('click',exportRecords);$('exportSummary').addEventListener('click',exportSummary);$('downloadSample').addEventListener('click',downloadSample);$('printBtn').addEventListener('click',()=>window.print());
  document.querySelectorAll('.chart-download').forEach(button=>button.addEventListener('click',()=>{const chart=charts[button.dataset.chart];if(!chart){showToast('Chart is not ready yet.');return;}const link=document.createElement('a');link.href=chart.toBase64Image('image/png',1);link.download=`bizbloom-${button.dataset.chart}.png`;link.click();showToast('Chart PNG downloaded');}));
  $('menuToggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
  document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));a.classList.add('active');$('sidebar').classList.remove('open');}));
}
document.addEventListener('DOMContentLoaded',()=>{initEvents();loadDemo();});

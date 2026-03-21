/* PaddlePoint Shared: Suggest & Updates */
(function(){
const SUGGEST_API='https://suggestions.newtonmac.workers.dev';
const UPDATES_API='https://updates.newtonmac.workers.dev';

// Inject modals if not already present
if(!document.getElementById('suggestModal')){
document.body.insertAdjacentHTML('beforeend',`
<div class="pp-modal-overlay" id="suggestModal" onclick="if(event.target===this)closeSuggestModal()">
<div class="pp-modal" onclick="event.stopPropagation()">
<button class="pp-modal-close" onclick="closeSuggestModal()">&times;</button>
<h2 class="suggest-title">Suggest a Feature</h2>
<p class="pp-subtitle">Have an idea for PaddlePoint? We'd love to hear it!</p>
<form id="suggestForm" onsubmit="submitSuggestion(event)">
<div class="pp-form-group"><label>Your Name (optional)</label><input type="text" id="suggestName" placeholder="Anonymous"></div>
<div class="pp-form-group"><label>Your Idea *</label><input type="text" id="suggestTitle" placeholder="e.g. Add surf forecast overlay" required></div>
<div class="pp-form-group"><label>Paddling Club (optional)</label><input type="text" id="suggestClub" placeholder="e.g. San Diego Outrigger Club"></div>
<div class="pp-form-group"><label>Craft Type (optional)</label>
<select id="suggestCraft"><option value="">-- Select --</option><option>SUP</option><option>Kayak</option><option>Outrigger</option><option>Canoe</option><option>Surfski</option><option>Dragon Boat</option><option>Rowing</option><option>Other</option></select></div>
<div class="pp-form-group"><label>Description</label><textarea id="suggestDesc" placeholder="What should it do?"></textarea></div>
<button type="submit" class="pp-submit-btn" id="suggestSubmitBtn">Submit Suggestion</button>
<div class="pp-form-msg" id="suggestMsg"></div>
</form></div></div>

<div class="pp-modal-overlay" id="updatesModal" onclick="if(event.target===this)closeUpdatesModal()">
<div class="pp-modal" onclick="event.stopPropagation()" style="max-width:560px;">
<button class="pp-modal-close" onclick="closeUpdatesModal()">&times;</button>
<h2 class="updates-title">Updates &amp; Roadmap</h2>
<p class="pp-subtitle">What we've shipped and what's coming next</p>
<div id="updatesContent"><div class="updates-empty">Loading...</div></div>
</div></div>

<div class="pp-modal-overlay" id="dataSourcesModal" onclick="if(event.target===this)closeDataSourcesModal()">
<div class="pp-modal" onclick="event.stopPropagation()" style="max-width:560px;">
<button class="pp-modal-close" onclick="closeDataSourcesModal()">&times;</button>
<h2 style="background:linear-gradient(90deg,#0ea5e9,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">📡 Data Sources</h2>
<p class="pp-subtitle">Every data point is sourced from reputable, publicly available resources. We publish and link to every source so you can always verify the information.</p>
<div class="coming-next" style="margin-bottom:12px;"><h3 style="font-size:14px;">🌊 Weather &amp; Marine</h3>
<p><a href="https://weather.google.com" target="_blank" style="color:#60a5fa;">Google Weather</a> · <a href="https://open-meteo.com" target="_blank" style="color:#60a5fa;">Open-Meteo</a> · <a href="https://www.weather.gov" target="_blank" style="color:#60a5fa;">NWS (weather.gov)</a><br><span style="color:#6b7080;font-size:12px;">Triple-source verification for temperature, wind, humidity, visibility, pressure</span></p></div>
<div class="coming-next" style="margin-bottom:12px;"><h3 style="font-size:14px;">🌡️ Tides &amp; Water Temperature</h3>
<p><a href="https://tidesandcurrents.noaa.gov" target="_blank" style="color:#60a5fa;">NOAA CO-OPS</a> · <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" style="color:#60a5fa;">Open-Meteo Marine</a><br><span style="color:#6b7080;font-size:12px;">Real station readings cross-referenced with satellite sea surface temperature</span></p></div>
<div class="coming-next" style="margin-bottom:12px;"><h3 style="font-size:14px;">💧 Water Quality &amp; Safety</h3>
<p><a href="https://www.waterboards.ca.gov" target="_blank" style="color:#60a5fa;">CA State Water Board</a> · <a href="https://www.theswimguide.org" target="_blank" style="color:#60a5fa;">Swim Guide</a> · <a href="https://habsos.noaa.gov" target="_blank" style="color:#60a5fa;">NOAA HABSOS</a> · <a href="https://fhab.sfei.org" target="_blank" style="color:#60a5fa;">CA FHAB (SFEI)</a><br><span style="color:#6b7080;font-size:12px;">Beach advisories, bacteria levels, harmful algal bloom monitoring</span></p></div>
<div class="coming-next" style="margin-bottom:12px;"><h3 style="font-size:14px;">🌬️ Air Quality &amp; River Flow</h3>
<p><a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" style="color:#60a5fa;">Open-Meteo AQ</a> · <a href="https://www.airnow.gov" target="_blank" style="color:#60a5fa;">EPA AirNow</a> · <a href="https://waterservices.usgs.gov" target="_blank" style="color:#60a5fa;">USGS Water Services</a><br><span style="color:#6b7080;font-size:12px;">AQI, river flow rates, stream conditions for inland paddlers</span></p></div>
<div class="coming-next" style="margin-bottom:12px;"><h3 style="font-size:14px;">⚠️ Alerts &amp; Coastal Access</h3>
<p><a href="https://www.weather.gov" target="_blank" style="color:#60a5fa;">National Weather Service</a> · <a href="https://www.coastal.ca.gov/YourCoast/" target="_blank" style="color:#60a5fa;">CA Coastal Commission</a><br><span style="color:#6b7080;font-size:12px;">Active weather warnings and public beach access points</span></p></div>
<div style="background:rgba(245,158,11,0.1);border-left:3px solid #f59e0b;border-radius:0 10px 10px 0;padding:12px 16px;"><p style="font-size:13px;color:#8b8fa3;margin:0;"><strong style="color:#e1e4e8;">🚀 Growing with Local Data</strong><br>As PaddlePoint expands, we're integrating localized resources from municipalities, counties, and regional authorities. If your local agency publishes paddling-relevant data, <a href="mailto:nwtjml@gmail.com" style="color:#60a5fa;">let us know</a>.</p></div>
</div></div>`);
}

let updatesLoaded=false;
window.openSuggestModal=function(){document.getElementById('suggestModal').classList.add('open');};
window.closeSuggestModal=function(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('suggestModal').classList.remove('open');};
window.openUpdatesModal=function(){document.getElementById('updatesModal').classList.add('open');if(!updatesLoaded)loadUpdates();};
window.closeUpdatesModal=function(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('updatesModal').classList.remove('open');};
window.openDataSourcesModal=function(){document.getElementById('dataSourcesModal').classList.add('open');};
window.closeDataSourcesModal=function(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('dataSourcesModal').classList.remove('open');};

window.submitSuggestion=async function(e){
e.preventDefault();
const btn=document.getElementById('suggestSubmitBtn');
const msg=document.getElementById('suggestMsg');
btn.disabled=true;btn.textContent='Submitting...';msg.textContent='';
try{
const page=location.pathname.split('/').pop()||'unknown';
const res=await fetch(SUGGEST_API+'/suggest',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({name:document.getElementById('suggestName').value||'Anonymous',
title:document.getElementById('suggestTitle').value,club:document.getElementById('suggestClub').value,
craft:document.getElementById('suggestCraft').value,description:document.getElementById('suggestDesc').value,page:page})});
if(res.ok){msg.style.color='#22c55e';msg.textContent='Thank you! Your suggestion has been submitted.';
document.getElementById('suggestForm').reset();}
else{throw new Error('Failed');}
}catch(err){msg.style.color='#ef4444';msg.textContent='Something went wrong. Please try again.';}
btn.disabled=false;btn.textContent='Submit Suggestion';
};

async function loadUpdates(){
const container=document.getElementById('updatesContent');
try{
const res=await fetch(UPDATES_API+'/updates');
const data=await res.json();
updatesLoaded=true;

const shipped=`
<div class="coming-next" style="margin-bottom:20px;">
<h3 style="color:#22c55e;">✅ Recently Shipped</h3>
<p class="cn-label">🛶 World's Largest Paddle Club Directory</p>
<p>7,700+ clubs across 77 countries — kayak, canoe, rowing, dragon boat, SUP, outrigger, surfski, and more. Search by location or club name, filter by craft type, click any pin for full details.</p>
<p class="cn-label">🔍 Dual Search: Location + Club Name</p>
<p>Toggle between Location mode (Google Places autocomplete for city/state/country) and Club mode (type-ahead search across all 7,700+ club names with instant results).</p>
<p class="cn-label">📍 Smart Map Zoom</p>
<p>Search a state or country and the map frames the geographic boundaries. Search a city and it zooms to the clubs found there.</p>
<p class="cn-label">➕ Add Club with Auto-Enrichment</p>
<p>Admin tool fetches website data + Google Places info (address, phone, email, rating, reviews, photos, social media, craft types) automatically when adding new clubs.</p>
<p class="cn-label">☁️ Live Cloud Database</p>
<p>Clubs data served live from Google Cloud SQL. Admin edits appear on the public site within seconds — no file downloads or deployments needed.</p>
<p class="cn-label">🔒 Data Protection</p>
<p>Club database protected behind API token + origin checking. No direct file access, anti-indexing headers, proprietary data secured.</p>
<p class="cn-label">🌊 Real-Time Water Conditions</p>
<p>San Diego County coverage with NOAA tides, NWS alerts, Open-Meteo wind/waves/swell/UV, Google Weather, beach water quality, and harmful algal bloom monitoring.</p>
<p class="cn-label">📡 Open Data Transparency</p>
<p>Every data source is published and linked directly on the page. Weather, water quality, tides, air quality — all traceable back to the original provider (NOAA, NWS, Open-Meteo, USGS, EPA, and more).</p>
</div>
<div class="coming-next">
<h3 style="color:#60a5fa;">🚀 Coming Next</h3>
<p class="cn-label">Expanding Coverage</p>
<p>Starting from California and expanding outward across the U.S. and beyond, adding localized conditions for more paddling regions.</p>
<p class="cn-label">Municipal &amp; Local Data Integration</p>
<p>Integrating hyperlocal resources from municipalities, counties, and regional authorities — the water quality reports, beach advisories, and flow data that local paddlers depend on.</p>
<p class="cn-label">Events Calendar</p>
<p>Races, regattas, festivals, and paddling events worldwide with dates, locations, registration links, and craft types.</p>
<p class="cn-label">Craft &amp; Location Matching</p>
<p>Each spot will show which craft types locals use there — surfskis, outrigger canoes, SUPs, K1s — so you know what works for the conditions.</p>
<p class="cn-label">"Claim Your Club" Feature</p>
<p>Club owners can claim their listing, update info, add photos, and manage their presence in the directory.</p>
<p class="cn-label">Gear Reviews &amp; Recommendations</p>
<p>Community-driven gear reviews organized by craft type, with comparison tools and buying guides.</p>
</div>`;

const statusLabels={planned:'Planned',in_progress:'In Progress',completed:'Shipped'};
if(!data.updates||data.updates.length===0){
container.innerHTML=shipped;return;}
container.innerHTML=shipped+data.updates.map(function(u){
const date=new Date(u.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
return '<div class="update-item"><div class="update-header"><span class="update-status '+(u.status||'')+'">'+
(statusLabels[u.status]||u.status||'Update')+'</span><span class="update-title">'+u.title+'</span></div>'+
(u.description?'<div class="update-desc">'+u.description+'</div>':'')+
'<div class="update-date">'+date+(u.suggestedBy?' · Suggested by '+u.suggestedBy:'')+'</div></div>';
}).join('');
}catch(e){container.innerHTML='<div class="updates-empty">Could not load updates.</div>';}
}

document.addEventListener('keydown',function(e){
if(e.key==='Escape'){
var s=document.getElementById('suggestModal');if(s&&s.classList.contains('open'))closeSuggestModal();
var u=document.getElementById('updatesModal');if(u&&u.classList.contains('open'))closeUpdatesModal();
var d=document.getElementById('dataSourcesModal');if(d&&d.classList.contains('open'))closeDataSourcesModal();
}});
})();

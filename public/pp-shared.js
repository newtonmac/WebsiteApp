/* PaddlePoint Shared: Suggest & Updates */
(function(){
const SUGGEST_API='https://suggestions.newtonmac.workers.dev';
const UPDATES_API='https://updates.newtonmac.workers.dev';

// ============ MOBILE HAMBURGER NAV (auto-injected on all pages) ============
(function injectMobileNav(){
    // Skip on Next.js pages — they have their own responsive nav
    if (document.querySelector('header.sticky')) return;
    // Find the nav container (different class on each page)
    var navContainer = document.querySelector('.header-right, .nav-btns, .header-nav');
    var topBar = document.querySelector('.header, .top-bar, .page-header-bar');
    if (!topBar) topBar = document.querySelector('[class*="header"]');
    if (!topBar) return;
    // Make sure container is position:relative for the absolute hamburger
    topBar.style.position = topBar.style.position || 'relative';
    // Inject hamburger button if not already present
    // Remove any existing page-specific hamburger to avoid duplicates
    var existing = document.querySelector('.mobile-nav-toggle');
    if (existing) existing.remove();
    var existingMenu = document.getElementById('mobileMenu');
    if (existingMenu) existingMenu.remove();
    if (!document.querySelector('.pp-mobile-toggle')) {
        var btn = document.createElement('button');
        btn.className = 'pp-mobile-toggle';
        btn.setAttribute('aria-label', 'Menu');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        btn.onclick = function(){ document.getElementById('ppMobileMenu').classList.add('open'); };
        topBar.appendChild(btn);
    }
    // Inject mobile menu overlay
    if (!document.getElementById('ppMobileMenu')) {
        var menu = document.createElement('div');
        menu.className = 'pp-mobile-menu';
        menu.id = 'ppMobileMenu';
        menu.onclick = function(e){ if(e.target===this) this.classList.remove('open'); };
        menu.innerHTML = '<div class="pp-mobile-panel" onclick="event.stopPropagation()">'
            + '<button class="pp-mobile-panel-close" onclick="document.getElementById(\'ppMobileMenu\').classList.remove(\'open\')">&times;</button>'
            + '<a href="paddlepoint.html">🏠 Home</a>'
            + '<a href="paddle-conditions.html">🌊 Water Conditions</a>'
            + '<a href="paddle-weather.html">⛅ Weather & Tides</a>'
            + '<a href="paddle-clubs.html">🛶 Paddle Clubs</a>'
            + '<a href="paddle-events.html">🏁 Events</a>'
            + '<a href="paddle-gear.html">🎯 Gear</a>'
            + '<a href="paddle-federations.html">🏛️ Federations</a>'
            + '<div class="pp-mobile-divider"></div>'
            + '<span onclick="document.getElementById(\'ppMobileMenu\').classList.remove(\'open\');openSuggestModal()">💬 Feedback</span>'
            + '<span onclick="document.getElementById(\'ppMobileMenu\').classList.remove(\'open\');openUpdatesModal()">📋 Updates</span>'
            + '<span onclick="document.getElementById(\'ppMobileMenu\').classList.remove(\'open\');openDataSourcesModal()">📡 Data Sources</span>'
            + '</div>';
        document.body.appendChild(menu);
    }
})();

// Inject modals if not already present
if(!document.getElementById('suggestModal')){
document.body.insertAdjacentHTML('beforeend',`
<div class="pp-modal-overlay" id="suggestModal" onclick="if(event.target===this)closeSuggestModal()">
<div class="pp-modal" onclick="event.stopPropagation()">
<button class="pp-modal-close" onclick="closeSuggestModal()">&times;</button>
<h2 class="suggest-title">Share Your Feedback</h2>
<p class="pp-subtitle">Help us make PaddlePoint better for the paddling community</p>
<form id="suggestForm" onsubmit="submitSuggestion(event)">
<div class="pp-form-group"><label>What type of feedback?</label>
<select id="suggestType" onchange="updateFeedbackForm()">
<option value="feature">💡 Feature Idea</option>
<option value="bug">🐛 Bug Report</option>
<option value="club">🛶 Submit a Club</option>
<option value="event">🏁 Submit an Event</option>
<option value="datasource">📡 Suggest a Data Source</option>
<option value="general">💬 General Feedback</option>
</select></div>
<div class="pp-form-group"><label>Your Name (optional)</label><input type="text" id="suggestName" placeholder="Anonymous"></div>
<div class="pp-form-group" id="fldTitle"><label id="lblTitle">Your Idea *</label><input type="text" id="suggestTitle" required></div>
<div class="pp-form-group" id="fldClub"><label>Paddling Club (optional)</label><input type="text" id="suggestClub" placeholder="e.g. San Diego Outrigger Club"></div>
<div class="pp-form-group" id="fldCraft"><label>Craft Type (optional)</label>
<select id="suggestCraft"><option value="">-- Select --</option><option>SUP</option><option>Kayak</option><option>Outrigger</option><option>Canoe</option><option>Surfski</option><option>Dragon Boat</option><option>Rowing</option><option>Other</option></select></div>
<div class="pp-form-group" id="fldLocation" style="display:none;"><label>Location / Region</label><input type="text" id="suggestLocation" placeholder="e.g. San Diego County, CA"></div>
<div class="pp-form-group" id="fldUrl" style="display:none;"><label>Website / URL</label><input type="text" id="suggestUrl" placeholder="https://..."></div>
<div class="pp-form-group"><label id="lblDesc">Description</label><textarea id="suggestDesc"></textarea></div>
<div class="pp-form-group" id="fldEmail"><label>Your Email (optional)</label><input type="email" id="suggestEmail" placeholder="In case we have follow-up questions"><p style="font-size:11px;color:#6b7080;margin-top:4px;">We may need to reach out to better understand your suggestion and narrow down the details.</p></div>
<div class="pp-form-group" id="fldNotify" style="display:flex;align-items:flex-start;gap:8px;"><input type="checkbox" id="suggestNotify" style="margin-top:3px;accent-color:#22c55e;width:16px;height:16px;cursor:pointer;"><label for="suggestNotify" style="cursor:pointer;font-size:12px;color:#8b8fa3;line-height:1.4;">Notify me by email when this feature is implemented so I can check it out and give more feedback</label></div>
<button type="submit" class="pp-submit-btn" id="suggestSubmitBtn">Send Feedback</button>
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
window.openSuggestModal=function(){document.getElementById('suggestModal').classList.add('open');updateFeedbackForm();};
window.closeSuggestModal=function(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('suggestModal').classList.remove('open');};

window.updateFeedbackForm=function(){
var t=document.getElementById('suggestType').value;
var fldClub=document.getElementById('fldClub'),fldCraft=document.getElementById('fldCraft');
var fldLoc=document.getElementById('fldLocation'),fldUrl=document.getElementById('fldUrl');
var lblTitle=document.getElementById('lblTitle'),lblDesc=document.getElementById('lblDesc');
var titleInput=document.getElementById('suggestTitle'),descInput=document.getElementById('suggestDesc');
var fldNotify=document.getElementById('fldNotify');
// Reset
fldClub.style.display='';fldCraft.style.display='';fldLoc.style.display='none';fldUrl.style.display='none';fldNotify.style.display='flex';
if(t==='feature'){lblTitle.textContent='Your Idea *';titleInput.placeholder='e.g. Add surf forecast overlay';lblDesc.textContent='Description';descInput.placeholder='What should it do? How would it help paddlers?';}
else if(t==='bug'){lblTitle.textContent='What went wrong? *';titleInput.placeholder='e.g. Tide chart not loading for Santa Cruz';lblDesc.textContent='Steps to reproduce';descInput.placeholder='What were you doing when the issue occurred? What device/browser?';fldClub.style.display='none';fldCraft.style.display='none';fldNotify.style.display='none';}
else if(t==='club'){lblTitle.textContent='Club Name *';titleInput.placeholder='e.g. Mission Bay Outrigger Club';lblDesc.textContent='Additional info';descInput.placeholder='Location, website, craft types, anything that helps us add it';fldCraft.style.display='';fldLoc.style.display='';fldUrl.style.display='';}
else if(t==='event'){lblTitle.textContent='Event Name *';titleInput.placeholder='e.g. Pacific Coast Paddle Classic 2026';lblDesc.textContent='Event details';descInput.placeholder='Date, location, sports, registration link';fldClub.style.display='none';fldCraft.style.display='';fldLoc.style.display='';fldUrl.style.display='';}
else if(t==='datasource'){lblTitle.textContent='Data Source Name *';titleInput.placeholder='e.g. San Diego County beach water quality reports';lblDesc.textContent='What data does it provide?';descInput.placeholder='What type of data? (water quality, river flow, beach conditions, etc.) How often is it updated?';fldClub.style.display='none';fldCraft.style.display='none';fldLoc.style.display='';fldUrl.style.display='';}
else{lblTitle.textContent='Subject *';titleInput.placeholder='What\'s on your mind?';lblDesc.textContent='Your feedback';descInput.placeholder='Tell us anything — what you like, what could be better, ideas for the community';fldClub.style.display='none';fldCraft.style.display='none';fldNotify.style.display='none';}
};
window.openUpdatesModal=function(){document.getElementById('updatesModal').classList.add('open');if(!updatesLoaded)loadUpdates();};
window.closeUpdatesModal=function(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('updatesModal').classList.remove('open');};
window.openDataSourcesModal=function(){document.getElementById('dataSourcesModal').classList.add('open');};
window.closeDataSourcesModal=function(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('dataSourcesModal').classList.remove('open');};

window.submitSuggestion=async function(e){
e.preventDefault();
const btn=document.getElementById('suggestSubmitBtn');
const msg=document.getElementById('suggestMsg');
btn.disabled=true;btn.textContent='Sending...';msg.textContent='';
try{
const page=location.pathname.split('/').pop()||'unknown';
const res=await fetch(SUGGEST_API+'/suggest',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({type:document.getElementById('suggestType').value,name:document.getElementById('suggestName').value||'Anonymous',
title:document.getElementById('suggestTitle').value,club:document.getElementById('suggestClub').value,
craft:document.getElementById('suggestCraft').value,description:document.getElementById('suggestDesc').value,
email:document.getElementById('suggestEmail').value||'',notify:document.getElementById('suggestNotify').checked,
location:document.getElementById('suggestLocation').value||'',url:document.getElementById('suggestUrl').value||'',page:page})});
if(res.ok){msg.style.color='#22c55e';
var typeLabels={feature:'Feature idea submitted!',bug:'Bug report received — we\'ll look into it.',club:'Club submission received — we\'ll add it soon!',event:'Event submission received — thanks!',datasource:'Data source suggestion received!',general:'Thanks for your feedback!'};
var baseMsg=typeLabels[document.getElementById('suggestType').value]||'Thank you!';
var email=document.getElementById('suggestEmail').value;
var notify=document.getElementById('suggestNotify').checked;
if(email&&notify)baseMsg+=' We\'ll follow up and notify you when implemented.';
else if(email)baseMsg+=' We may reach out with questions.';
else if(notify)baseMsg+=' Leave an email next time to get notified!';
msg.textContent=baseMsg;
document.getElementById('suggestForm').reset();}
else{throw new Error('Failed');}
}catch(err){msg.style.color='#ef4444';msg.textContent='Something went wrong. Please try again.';}
btn.disabled=false;btn.textContent='Send Feedback';
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
<p class="cn-label">Gear Directory</p>
<p>Equipment directory organized by craft type, with buyer's guides and brand listings for all paddle disciplines.</p>
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
var m=document.getElementById('ppMobileMenu');if(m&&m.classList.contains('open'))m.classList.remove('open');
}});
})();

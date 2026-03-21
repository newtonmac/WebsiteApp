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
<div class="pp-modal" onclick="event.stopPropagation()">
<button class="pp-modal-close" onclick="closeUpdatesModal()">&times;</button>
<h2 class="updates-title">Updates & Roadmap</h2>
<p class="pp-subtitle">What's coming next and what we've shipped</p>
<div id="updatesContent"><div class="updates-empty">Loading...</div></div>
</div></div>`);
}

let updatesLoaded=false;
window.openSuggestModal=function(){document.getElementById('suggestModal').classList.add('open');};
window.closeSuggestModal=function(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('suggestModal').classList.remove('open');};
window.openUpdatesModal=function(){document.getElementById('updatesModal').classList.add('open');if(!updatesLoaded)loadUpdates();};
window.closeUpdatesModal=function(e){if(e&&e.target!==e.currentTarget)return;document.getElementById('updatesModal').classList.remove('open');};

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
const statusLabels={planned:'Planned',in_progress:'In Progress',completed:'Shipped'};
if(!data.updates||data.updates.length===0){
container.innerHTML='<div class="updates-empty">No updates yet. Check back soon!</div>';return;}
container.innerHTML=data.updates.map(u=>{
const date=new Date(u.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
return `<div class="updates-item">
<div class="updates-date">${date}${u.suggestedBy?' · Suggested by '+u.suggestedBy:''}</div>
<div class="updates-item-title"><span class="updates-tag ${u.status||'feature'}">${statusLabels[u.status]||u.status||'Update'}</span> ${u.title}</div>
${u.description?'<div class="updates-item-desc">'+u.description+'</div>':''}
</div>`;}).join('');
}catch(e){container.innerHTML='<div class="updates-empty">Could not load updates.</div>';}
}

// Close on Escape
document.addEventListener('keydown',function(e){
if(e.key==='Escape'){
if(document.getElementById('suggestModal').classList.contains('open'))closeSuggestModal();
if(document.getElementById('updatesModal').classList.contains('open'))closeUpdatesModal();
}});
})();

import * as webllm from "https://esm.run/@mlc-ai/web-llm";

const $=id=>document.getElementById(id);
const DBKEY="fabien_ai_web_v1";
let engine=null,engineReady=false,engineLoading=false,running=false;
let selectedAgent="coordinator",currentProjectId=null;
const SITE_BLUEPRINT=`Fabien AI est une application web locale avec : une liste de projets, une salle visuelle avec des agents sous forme de ronds, un panneau de détail de l’agent sélectionné, une conversation directe avec cet agent, une discussion entre cet agent et le Chef, un fil d’activité, un rapport final, une mémoire par projet, un réglage 1/2/3 agents et une IA locale dans Chrome. L’objectif principal est d’être extrêmement simple, lisible, rapide et évident pour Fabien. L’Optimiseur ne doit jamais analyser le contenu métier des projets : uniquement l’ergonomie, le design, les discussions, la navigation et le fonctionnement du site.`;

const AGENTS={
coordinator:{name:"Chef",label:"Stratégie",icon:"♛",color:"#4ca4ff",role:"Tu es le chef de projet. Tu coordonnes les spécialistes, évites les doublons, synthétises et demandes les validations nécessaires."},
finance:{name:"Finance",label:"Analyse",icon:"▥",color:"#ffb44b",role:"Tu es analyste financier. Vérifie revenus, coûts, marges, hypothèses, unités et cohérence arithmétique. N'invente aucun chiffre."},
spaces:{name:"Architecture",label:"Développement",icon:"◇",color:"#35e9a0",role:"Tu es spécialiste de programmation d'espaces et parcours client. Vérifie surfaces, circulation, capacité et réalisme. Tu ne remplaces pas un architecte ou ingénieur réglementé."},
operations:{name:"Opérations",label:"Automatisation",icon:"⚙",color:"#40d7ee",role:"Tu es responsable opérations. Vérifie horaires, rotations, personnel, nettoyage, capacité, dépendances et goulots d'étranglement."},
clinic:{name:"Clinique",label:"Recherche",icon:"✚",color:"#ef8fc7",role:"Tu analyses l'organisation clinique: flux, salles, rendez-vous, collaboration et suivi. Tu ne poses aucun diagnostic."},
toladi:{name:"Toladi",label:"Veille",icon:"◉",color:"#e4c64f",role:"Tu analyses l'univers de marque, l'expérience, le packaging et l'intégration spatiale."},
marketing:{name:"Marketing",label:"Contenu",icon:"✦",color:"#f28a67",role:"Tu es spécialiste marketing. Recherche clarté, crédibilité et conversion, sans promesses trompeuses."},
investor:{name:"Investisseur",label:"Validation",icon:"▤",color:"#ff5d78",role:"Tu analyses le projet comme investisseur: chiffres, risques, hypothèses, besoins et questions critiques."},
critic:{name:"Critique",label:"Revue",icon:"⌕",color:"#35d2e8",role:"Tu cherches contradictions, hypothèses fragiles, doubles comptes, oublis, risques et éléments non validés."},
verifier:{name:"Vérification",label:"Conformité",icon:"✓",color:"#a981ff",role:"Tu consolides les analyses. Distingue FAITS, HYPOTHÈSES, À VÉRIFIER et DÉCISIONS. Ne valide jamais une exigence légale ou réglementaire sans source compétente."},
data:{name:"Data",label:"Analyse",icon:"◫",color:"#438cff",role:"Tu structures les données, contrôles les calculs, repères les incohérences et produis des synthèses quantitatives sans inventer les données manquantes."},
product:{name:"Produit",label:"Stratégie produit",icon:"◆",color:"#ff6f9b",role:"Tu analyses l'expérience produit, les priorités, la valeur utilisateur et la cohérence des fonctionnalités."},
content:{name:"Contenu",label:"Rédaction",icon:"✎",color:"#68a7ff",role:"Tu aides à structurer, simplifier et rédiger des contenus clairs en respectant les informations disponibles."},
support:{name:"Support",label:"Assistance",icon:"●",color:"#9a7cff",role:"Tu cherches les blocages techniques ou d'usage et proposes les solutions les plus simples et les moins risquées."}
};
const SPECIALISTS=["finance","spaces","operations","clinic","toladi","marketing","investor","data","product","content","support"];
const SLOTS={working:[[8,18],[22,18],[14,30],[30,30]],waiting:[[63,17],[73,17],[83,17],[67,28],[78,28],[88,28]],blocked:[[8,67],[21,67],[34,67],[13,79],[28,79]],resting:[[56,66],[64,66],[72,66],[80,66],[88,66],[56,80],[64,80],[72,80],[80,80],[88,80]]};

const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID?.()||Date.now()+"-"+Math.random().toString(16).slice(2);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const strip=s=>String(s??"").replace(/<think>[\s\S]*?<\/think>/gi,"").replace(/<\/think>/gi,"").replace(/^\s*(Let me|We need|I need|I will)[^\n]*\n+/i,"").trim();
const fmt=iso=>{const d=new Date(iso);return Number.isNaN(d.getTime())?"":d.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"})};

function baseDB(){return {settings:{parallel:2,model:"Qwen2.5-3B-Instruct-q4f16_1-MLC"},projects:[{id:"mon-projet",name:"Mon projet",description:"Projet local",memory:"",files:[],folderBriefs:[],masterDossier:"",webResearch:[],webMemory:[],finalDocTitle:"Dossier final",finalDocHtml:"",created_at:now(),runs:[],messages:[],activity:[]}],selectedProject:"mon-projet"}}
function loadDB(){
  try{
    const base=baseDB(),saved=JSON.parse(localStorage.getItem(DBKEY)||"{}"),merged={...base,...saved};
    if(!Array.isArray(merged.projects)||merged.projects.length===0)merged.projects=base.projects;
    merged.projects=merged.projects.map(p=>({
      id:p.id||uid(),name:p.name||"Mon projet",description:p.description||"Projet local",
      memory:p.memory||"",files:Array.isArray(p.files)?p.files:[],folderBriefs:Array.isArray(p.folderBriefs)?p.folderBriefs:[],masterDossier:p.masterDossier||"",webResearch:Array.isArray(p.webResearch)?p.webResearch:[],webMemory:Array.isArray(p.webMemory)?p.webMemory:[],finalDocTitle:p.finalDocTitle||"Dossier final",finalDocHtml:p.finalDocHtml||"",created_at:p.created_at||now(),
      runs:Array.isArray(p.runs)?p.runs:[],messages:Array.isArray(p.messages)?p.messages:[],activity:Array.isArray(p.activity)?p.activity:[]
    }));
    if(!merged.projects.some(p=>p.id===merged.selectedProject))merged.selectedProject=merged.projects[0].id;
    merged.settings={...base.settings,...(saved.settings||{})};
    return merged;
  }catch{return baseDB()}
}
let db=loadDB();
db.optimizer=db.optimizer||[];
db.notifications=Array.isArray(db.notifications)?db.notifications:[];
const save=()=>localStorage.setItem(DBKEY,JSON.stringify(db));
save();
const project=()=>db.projects.find(p=>p.id===currentProjectId)||db.projects[0];
function showError(m=""){$("error").textContent=m;$("error").classList.toggle("show",!!m)}
function recoverInterruptedRuns(){
  for(const p of db.projects||[]){
    const run=p?.runs?.[p.runs.length-1];if(!run)continue;
    const hasGhost=(run.agents||[]).some(a=>a.status==="working"||a.status==="waiting");
    if(!hasGhost)continue;
    if(["running","error","interrupted","paused"].includes(run.status)){
      for(const a of run.agents||[]){
        if(a.status==="working"||a.status==="waiting"){
          a.status="waiting";
          a.reason="Mission en pause après actualisation de la page.";
          a.finished_at="";
        }
      }
      run.status="paused";run.resumeAvailable=true;
      run.final_report=run.final_report&&!/Prompt tokens exceeded|context window|prompt tokens/i.test(run.final_report)?run.final_report:"Mission mise en pause. Les résultats déjà terminés sont conservés.";
      p.activity=p.activity||[];
      p.activity.push({id:uid(),time:now(),agent:"coordinator",text:"a mis la mission en pause après actualisation"});
    }
  }
  save();
}
function latestRun(){const r=project()?.runs||[];return r[r.length-1]||null}
function updateResumeUI(){
  const run=latestRun(),can=!!run&&["paused","interrupted","error"].includes(run.status)&&!!run.goal&&!running;
  const b=$("resumeBtn"),i=$("resumeInfo");if(b)b.hidden=!can;if(i)i.hidden=!can;
  if(can&&$("goal"))$("goal").value=run.goal;
}
function stateRows(){const p=project(),run=p?.runs?.[p.runs.length-1],m={};Object.keys(AGENTS).forEach(a=>m[a]={agent_id:a,status:"resting",task:"",progress:0,output:"",started_at:"",finished_at:"",reason:""});(run?.agents||[]).forEach(r=>m[r.agent_id]={...m[r.agent_id],...r});return m}
function addActivity(text,agent="coordinator"){const p=project();p.activity=p.activity||[];p.activity.push({id:uid(),time:now(),agent,text});p.activity=p.activity.slice(-60);save()}
function addMessage(from,to,body,channel="internal"){const p=project();p.messages=p.messages||[];p.messages.push({id:uid(),from,to,body:strip(body),channel,time:now()});save()}

function humanError(err){
  const raw=String(err?.message||err||"");
  if(/context window|prompt tokens|4096|exceed context/i.test(raw))return {kind:"context",title:"Trop d’informations à traiter d’un coup",message:"Le contexte est trop volumineux pour le modèle local. Je vais réduire automatiquement les informations envoyées et réessayer.",action:"compact-retry"};
  if(/webgpu|gpu/i.test(raw))return {kind:"engine",title:"Le moteur local n’est pas disponible",message:"Je n’arrive pas à utiliser l’accélération du navigateur. Vérifie que Chrome est à jour puis recharge l’IA locale.",action:"reload-model"};
  if(/memory|out of memory|allocation/i.test(raw))return {kind:"memory",title:"Mémoire insuffisante",message:"Le modèle utilise trop de mémoire. Je peux alléger le contexte ou utiliser un modèle plus petit.",action:"compact-retry"};
  if(/pdf|docx|xlsx|file|fichier|lecture/i.test(raw))return {kind:"file",title:"Je n’arrive pas à lire un document",message:"Un fichier pose problème. Je garde les autres documents et je peux continuer sans celui-ci.",action:"open-agent"};
  return {kind:"generic",title:"Un agent a rencontré un problème",message:"Je n’ai pas pu terminer cette étape. Je te montre ce qui s’est passé et je peux réessayer.",action:"retry-last"};
}
function showToast(n){
  const stack=$("toastStack");if(!stack)return;
  const m=AGENTS[n.agent]||AGENTS.coordinator,el=document.createElement("div");
  el.className="agentToast "+(n.severity||"warning");el.dataset.toast=n.id;
  el.innerHTML=`<div class="agentToastHead"><div class="agentToastWho"><span class="agentToastOrb" style="--c:${m.color}"></span><div><h4>${esc(m.name)} veut te parler</h4><div class="tiny">${esc(n.title)}</div></div></div><button class="modalClose" data-dismiss-toast="${n.id}">×</button></div><p>${esc(n.message)}</p><div class="agentToastActions"><button class="primaryFix" data-note-action="${esc(n.action||"open-agent")}" data-note-id="${n.id}">${n.action==="compact-retry"?"Réparer automatiquement":n.action==="reload-model"?"Recharger l’IA":"Voir / réessayer"}</button><button data-note-action="open-agent" data-note-id="${n.id}">Parler à ${esc(m.name)}</button></div>`;
  stack.appendChild(el);
  el.querySelectorAll("[data-dismiss-toast]").forEach(b=>b.onclick=()=>el.remove());
  el.querySelectorAll("[data-note-action]").forEach(b=>b.onclick=()=>handleNotificationAction(b.dataset.noteAction,b.dataset.noteId));
  setTimeout(()=>{if(el.isConnected)el.remove()},15000);
}
function addNotification(agent,title,message,severity="warning",action="open-agent",detail=""){
  const n={id:uid(),agent:agent||"coordinator",title,message,severity,action,detail,time:now(),read:false};
  db.notifications.push(n);db.notifications=db.notifications.slice(-80);save();renderNotifications();showToast(n);return n;
}
function renderNotifications(){
  const list=$("notificationList"),count=$("notificationCount");if(!list||!count)return;
  const unread=db.notifications.filter(n=>!n.read).length;count.textContent=unread;count.classList.toggle("hidden",!unread);
  list.innerHTML=db.notifications.length?[...db.notifications].reverse().map(n=>{const m=AGENTS[n.agent]||AGENTS.coordinator;return `<div class="notificationItem ${n.read?"":"unread"}"><div class="notificationItemTop"><b>${esc(m.name)} · ${esc(n.title)}</b><time>${fmt(n.time)}</time></div><p>${esc(n.message)}</p><div class="notificationItemActions"><button data-note-action="${esc(n.action||"open-agent")}" data-note-id="${n.id}">${n.action==="compact-retry"?"Réparer automatiquement":n.action==="reload-model"?"Recharger l’IA":"Ouvrir"}</button><button data-note-action="open-agent" data-note-id="${n.id}">Parler à l’agent</button></div></div>`}).join(""):'<div class="empty">Aucune notification.</div>';
  list.querySelectorAll("[data-note-action]").forEach(b=>b.onclick=()=>handleNotificationAction(b.dataset.noteAction,b.dataset.noteId));
}
async function handleNotificationAction(action,id){
  const n=db.notifications.find(x=>x.id===id);if(n)n.read=true;save();renderNotifications();
  if(action==="open-agent"){selectedAgent=n?.agent||"coordinator";renderAll();$("notificationCenter").classList.add("hidden");$("directPanel").scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>$("directInput").focus(),350);return}
  if(action==="reload-model"){engine=null;engineReady=false;$("notificationCenter").classList.add("hidden");await ensureModel();return}
  if(action==="compact-retry"||action==="retry-last"){
    db.settings.compactContext=true;save();$("notificationCenter").classList.add("hidden");
    const last=project()?.runs?.slice(-1)[0]?.goal||$("goal").value.trim();
    if(last){$("goal").value=last;await runMission();}
  }
}


function renderProjects(){const w=$("projects");w.innerHTML="";db.projects.forEach(p=>{const b=document.createElement("button");b.className="project"+(p.id===currentProjectId?" active":"");b.innerHTML=`<strong>${esc(p.name)}</strong><div class="tiny">${esc(p.description||"Projet local")}</div>`;b.onclick=()=>selectProject(p.id);w.appendChild(b)})}
function selectProject(id){currentProjectId=id;db.selectedProject=id;save();selectedAgent="coordinator";$("projectTitle").textContent=project().name;renderAll()}
const stateLabel=s=>({working:"Travaille",waiting:"En attente",blocked:"Bloqué",resting:"Se repose",done:"Terminé",interrupted:"Interrompu"})[s]||"Se repose";
function renderRoom(){
  const rows=stateRows(),groups={working:[],waiting:[],blocked:[],resting:[]};
  Object.keys(AGENTS).forEach(a=>{let st=rows[a].status||"resting";if(st==="done")st="resting";(groups[st]||groups.resting).push(a)});
  let active=0,blocked=0;
  for(const st of ["working","waiting","blocked","resting"]){
    const box=$("status-"+st); if(!box)continue;
    box.innerHTML="";
    groups[st].forEach(aid=>{
      if(st==="working")active++; if(st==="blocked")blocked++;
      const m=AGENTS[aid],el=document.createElement("button");
      el.className=`agentCard ${st} ${selectedAgent===aid?"selected":""}`;
      el.style.setProperty("--c",m.color);
      el.innerHTML=`<span class="agentMenu">•••</span><div class="agentOrb"></div><span class="agentDot"></span><div class="agentCardName">${esc(m.name)}</div><div class="agentCardRole">${esc(m.label||"Agent")}</div>`;
      el.onclick=()=>{selectedAgent=aid;renderAll()};
      box.appendChild(el);
    });
    const count=$("count-"+st);if(count)count.textContent=groups[st].length;
  }
  $("activeCount").textContent=`${active} agent${active>1?"s":""} actif${active>1?"s":""}`;
  $("blockedCount").textContent=`${blocked} blocage${blocked>1?"s":""}`;
  $("blockedCount").className="chip "+(blocked?"bad":"");
  $("roomStatus").textContent=active?`${active} en travail`:"Équipe disponible";
}
function elapsed(iso){if(!iso)return"Disponible";const s=Math.max(0,Math.floor((Date.now()-new Date(iso))/1000));return s<60?s+" s":Math.floor(s/60)+" min"}
function renderDetail(){
  const r=stateRows()[selectedAgent],m=AGENTS[selectedAgent],st=r.status||"resting";
  $("miniOrb").style.setProperty("--selc",m.color);
  $("agentName").textContent=m.name;
  $("agentRole").textContent=m.label||"Agent";
  $("agentState").textContent=stateLabel(st);
  $("agentTask").textContent=r.task||"Aucune mission";
  $("agentSince").textContent=r.started_at?elapsed(r.started_at):"Disponible";
  $("agentNext").textContent=st==="working"?"Envoyer son résultat au chef":st==="waiting"?"Commencer quand son tour arrive":st==="blocked"?"Résoudre le blocage":"Attend une nouvelle mission";
  $("agentProgress").style.width=(r.progress||0)+"%";$("agentProgressText").textContent=(r.progress||0)+" %";
  $("blocker").className="blocker "+(st==="blocked"?"show":"");$("blocker").textContent=st==="blocked"?"⚠ "+(r.reason||"Cet agent est bloqué."):"";
  $("agentOutput").textContent=r.output||"Cet agent se repose. Tu peux quand même lui parler directement.";
  $("directSubtitle").textContent="Conversation avec "+m.name+" · historique conservé localement";
  $("directInput").placeholder="Écrire un message à "+m.name+"…";
}
function renderActivity(){const a=(project().activity||[]).slice(-12).reverse();$("activityList").innerHTML=a.length?a.map(x=>`<div class="activity"><time>${fmt(x.time)}</time><div><b>${esc(AGENTS[x.agent]?.name||x.agent)}</b> · ${esc(x.text)}</div></div>`).join(""):'<div class="empty">Aucune activité.</div>'}
function renderChats(){
  const msgs=project().messages||[];
  const direct=msgs.filter(m=>m.channel==="direct"&&(m.from===selectedAgent||m.to===selectedAgent));
  $("directChat").innerHTML=direct.length?direct.slice(-80).map(m=>`<div class="msg ${m.from==="user"?"me":"agent"}"><div class="who">${esc(m.from==="user"?"Vous":AGENTS[m.from]?.name||m.from)} · ${fmt(m.time)}</div>${esc(m.body)}</div>`).join(""):'<div class="empty">Commence une conversation avec cet agent.</div>';
  $("directChat").scrollTop=$("directChat").scrollHeight;
  const filter=$("networkFilter")?.value||"all";
  let net=msgs.filter(m=>m.channel==="internal");
  if(filter==="selected")net=net.filter(m=>m.from===selectedAgent||m.to===selectedAgent);
  net=net.slice(-80).reverse();
  $("chiefChat").innerHTML=net.length?net.map(m=>{
    const from=AGENTS[m.from],to=AGENTS[m.to],person=from||to,txt=strip(m.body).replace(/\s+/g," ").slice(0,105);
    return `<div class="networkItem"><span class="networkOrb" style="--c:${person?.color||"#789"}"></span><div class="networkMain"><b>${esc(from?.name||m.from)} → ${esc(to?.name||m.to)}</b><div>${esc(txt)}</div></div><time>${fmt(m.time)}</time></div>`
  }).join(""):'<div class="empty">Les échanges entre les agents apparaîtront ici.</div>';
}
function renderConversationModal(){
  const msgs=project().messages||[],m=AGENTS[selectedAgent];
  $("conversationTitle").textContent=m.name;$("conversationAgentName").textContent=m.name;
  const direct=msgs.filter(x=>x.channel==="direct"&&(x.from===selectedAgent||x.to===selectedAgent));
  $("conversationDirect").innerHTML=direct.length?direct.slice(-80).map(x=>`<div class="msg ${x.from==="user"?"me":"agent"}"><div class="who">${esc(x.from==="user"?"Vous":AGENTS[x.from]?.name||x.from)} · ${fmt(x.time)}</div>${esc(x.body)}</div>`).join(""):'<div class="empty">Aucune discussion directe pour le moment.</div>';
  const internal=msgs.filter(x=>x.channel==="internal"&&(x.from===selectedAgent||x.to===selectedAgent));
  $("conversationChief").innerHTML=internal.length?internal.map(x=>`<div class="msg internal"><div class="who">${esc(AGENTS[x.from]?.name||x.from)} → ${esc(AGENTS[x.to]?.name||x.to)} · ${fmt(x.time)}</div>${esc(x.body)}</div>`).join(""):'<div class="empty">Aucun échange avec le réseau IA pour le moment.</div>';
}
function openConversation(){$("conversationModal").classList.remove("hidden");renderConversationModal()}
function renderOptimizerChat(){
  const wrap=$("optimizerChat");
  if(!wrap)return;
  const history=db.optimizer||[];
  wrap.innerHTML=history.length?history.map(x=>`<div class="msg ${x.role==="Fabien"?"me":"agent"}"><div class="who">${esc(x.role)} · ${fmt(x.time)}</div>${esc(x.text)}</div>`).join(""):'<div class="empty">Parle-lui comme à une vraie IA. L’historique restera ici.</div>';
  wrap.scrollTop=wrap.scrollHeight;
}

async function runOptimizer(){
  const input=$("optimizerInput").value.trim();
  if(!input)return;
  $("optimizerInput").value="";
  db.optimizer=db.optimizer||[];
  db.optimizer.push({role:"Fabien",text:input,time:now()});
  save();renderOptimizerChat();
  $("runOptimizer").disabled=true;$("runOptimizer").textContent="…";
  try{
    const history=db.optimizer.slice(-14).map(x=>`${x.role}: ${x.text}`).join("\n");
    const answer=await llm(
      "Tu es l’Optimiseur UX/UI exclusif de Fabien AI. Tu ne travailles sur aucun projet métier. Tu discutes avec Fabien comme dans une vraie conversation. Ton seul rôle est d’améliorer ce site : simplicité, design, lisibilité des discussions, navigation, efficacité et compréhension. Tiens compte de toute la conversation précédente. Pose une question si nécessaire. Donne des propositions concrètes et courtes.",
      `${SITE_BLUEPRINT}\n\nCONVERSATION AVEC FABIEN:\n${history}\n\nRéponds au dernier message de Fabien de manière naturelle.`,
      650
    );
    db.optimizer.push({role:"Optimiseur",text:answer,time:now()});save();renderOptimizerChat();
  }catch(e){
    db.optimizer.push({role:"Optimiseur",text:"Erreur locale : "+(e?.message||e),time:now()});save();renderOptimizerChat();
  }finally{
    $("runOptimizer").disabled=false;$("runOptimizer").textContent="Envoyer";$("optimizerInput").focus();
  }
}
function renderProjectFiles(){
  const p=project();p.files=p.files||[];const box=$("projectFiles");if(!box)return;
  box.innerHTML=p.files.length?p.files.map((f,i)=>`<div class="fileItem"><span>📄 ${esc(f.name)} <span class="tiny">${esc(f.note||"prêt")}</span></span><button data-rmfile="${i}">×</button></div>`).join(""):'<div class="empty">Aucun fichier ajouté.</div>';
  box.querySelectorAll("[data-rmfile]").forEach(b=>b.onclick=()=>{p.files.splice(Number(b.dataset.rmfile),1);save();renderProjectFiles()});
}
function projectContext(){
  const p=project();
  const memoryText=String(p.memory||"").slice(0,1800);
  const master=String(p.masterDossier||"").slice(0,2600);
  const webMemory=(p.webMemory||[]).slice(-24).map(x=>`• [${x.category||"Web"}] ${x.fact} — Source: ${x.title||x.url} (${x.url})`).join("\n").slice(0,4600);
  const web=(p.webResearch||[]).slice(-6).map(r=>`• ${r.title} — ${r.url}\n  ${String(r.content||"").replace(/\s+/g," ").slice(0,220)}`).join("\n").slice(0,1800);
  const folder=(p.folderBriefs||[]).slice(-10).map(f=>`• ${f.path}: ${String(f.summary||"").replace(/\s+/g," ").slice(0,220)}`).join("\n").slice(0,2200);
  const files=(p.files||[]).slice(-6).map(f=>`• ${f.name}: ${String(f.text||"").replace(/\s+/g," ").slice(0,220)}`).join("\n").slice(0,1200);
  return [
    memoryText&&`MÉMOIRE:\n${memoryText}`,
    master&&`DOSSIER MAÎTRE:\n${master}`,
    webMemory&&`MÉMOIRE WEB PERMANENTE ET SOURCÉE:\n${webMemory}`,
    web&&`RECHERCHE INTERNET RÉCENTE:\n${web}`,
    folder&&`FICHIERS DU DOSSIER:\n${folder}`,
    files&&`AUTRES FICHIERS:\n${files}`
  ].filter(Boolean).join("\n\n").slice(0,10500);
}
async function readProjectFile(file){
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(file.size>12*1024*1024)throw new Error(file.name+" est trop volumineux (12 Mo max par fichier).");
  if(ext==="pdf"){
    const pdfjs=await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let out="";
    for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i),tc=await pg.getTextContent();out+=tc.items.map(x=>x.str).join(" ")+"\n";if(out.length>140000)break}
    return out.slice(0,140000);
  }
  if(ext==="docx"){
    const mammoth=await import("https://esm.sh/mammoth@1.9.0");
    const res=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
    return String(res.value||"").slice(0,140000);
  }
  if(ext==="xlsx"){
    const XLSX=await import("https://esm.sh/xlsx@0.18.5");
    const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});let out="";
    for(const name of wb.SheetNames){out+="\n## "+name+"\n"+XLSX.utils.sheet_to_csv(wb.Sheets[name])+"\n";if(out.length>140000)break}
    return out.slice(0,140000);
  }
  if(["txt","md","csv","json"].includes(ext)||file.type.startsWith("text/"))return (await file.text()).slice(0,140000);
  return "";
}
async function handleFiles(files){
  const p=project();p.files=p.files||[];
  for(const file of [...files]){
    try{const text=await readProjectFile(file);p.files.push({name:file.name,type:file.type,size:file.size,text,note:"lu localement",added_at:now()});}
    catch(e){p.files.push({name:file.name,type:file.type,size:file.size,text:"",note:"erreur: "+(e?.message||e),added_at:now()});}
  }
  save();renderProjectFiles();addActivity("fichiers du projet mis à jour");
}

function renderMasterDossier(){
  const p=project();
  const out=$("masterDossierText"),status=$("masterDossierStatus");
  if(out)out.textContent=p.masterDossier||"Aucun dossier maître créé.";
  if(status&&p.masterDossier&&!status.textContent)status.textContent="✓ Dossier maître disponible.";
}
async function summarizeForChief(name,text){
  const excerpt=String(text||"").trim().slice(0,6500);
  if(!excerpt)return "Fichier non lisible automatiquement.";
  return await llm(
    AGENTS.coordinator.role+" Tu prépares un dossier maître. Résume fidèlement ce document, sans rien inventer.",
    `DOCUMENT: ${name}\n\nCONTENU:\n${excerpt}\n\nDonne: faits importants, chiffres, décisions/contraintes, questions ou incohérences, éléments à conserver. Maximum 180 mots.`,
    520
  );
}
async function processFolderWithChief(files){
  const list=[...files].filter(f=>!f.name.startsWith(".")).slice(0,40);
  if(!list.length)return;
  const p=project();p.folderBriefs=[];
  const folderName=(list[0].webkitRelativePath||"").split("/")[0]||"dossier";
  addMessage("coordinator","user",`J’ai bien reçu le dossier « ${folderName} » avec ${list.length} fichier${list.length>1?"s":""}. Je vais les lire un par un, puis je te prépare une synthèse propre.`,"direct");
  renderChats();
  $("folderStatus").textContent=`Chef : préparation de ${list.length} fichier(s)…`;
  if(!await ensureModel()){
    $("folderStatus").textContent="Impossible de charger l’IA locale.";
    addMessage("coordinator","user","Je n’arrive pas à lancer le moteur local pour analyser le dossier. Recharge l’IA locale puis renvoie-moi le dossier.","direct");
    renderChats(); return;
  }
  let readable=0;
  for(let i=0;i<list.length;i++){
    const file=list[i],path=file.webkitRelativePath||file.name;
    $("folderStatus").textContent=`Chef : analyse ${i+1}/${list.length} — ${path}`;
    try{
      const text=await readProjectFile(file);
      if(!String(text||"").trim()){
        p.folderBriefs.push({path,name:file.name,summary:"Fichier reçu mais aucun texte lisible automatiquement.",time:now()});
      }else{
        const summary=await summarizeForChief(path,text);
        p.folderBriefs.push({path,name:file.name,summary,time:now()});readable++;
      }
    }catch(e){
      p.folderBriefs.push({path,name:file.name,summary:"Erreur de lecture : "+(e?.message||e),time:now()});
    }
    save();
  }
  $("folderStatus").textContent=`✓ ${readable}/${list.length} fichier(s) lus. Construction du dossier maître…`;
  await buildMasterDossier();
  $("folderStatus").textContent="✓ Dossier analysé et dossier maître créé par le Chef.";
  addMessage("coordinator","user",`C’est bon, j’ai terminé. J’ai pu lire ${readable} fichier${readable>1?"s":""} sur ${list.length}. J’ai organisé les informations dans le Dossier maître du Chef. Tu peux maintenant me poser des questions dessus normalement.`,"direct");
  addActivity("a analysé un dossier complet","coordinator");
  renderAll();
}
async function buildMasterDossier(){
  const p=project();
  const briefs=(p.folderBriefs||[]).map(x=>`### ${x.path}\n${x.summary}`);
  const manual=(p.files||[]).slice(-12).map(x=>`### ${x.name}\n${String(x.text||"").slice(0,3500)}`);
  const pieces=[];
  if(p.memory)pieces.push(`## Mémoire du projet\n${String(p.memory).slice(0,4500)}`);
  pieces.push(...briefs,...manual);
  if(!pieces.length){$("masterDossierStatus").textContent="Ajoute d’abord un dossier, des fichiers ou des informations au projet.";return;}
  $("masterDossierStatus").textContent="Le Chef organise le dossier maître…";
  if(!await ensureModel()){ $("masterDossierStatus").textContent="IA locale non disponible.";return; }

  const batches=[];
  for(let i=0;i<pieces.length;i+=5){
    const batch=pieces.slice(i,i+5).join("\n\n").slice(0,12500);
    const compact=await llm(
      AGENTS.coordinator.role+" Tu consolides plusieurs résumés de documents sans inventer. Garde uniquement les informations utiles et précises.",
      `CONTENU:\n${batch}\n\nCrée une synthèse intermédiaire courte avec: faits, chiffres, décisions, contraintes, risques, informations manquantes et noms des sources.`,
      650
    );
    batches.push(compact);
  }
  const combined=batches.join("\n\n---\n\n").slice(0,13500);
  const out=await llm(
    AGENTS.coordinator.role+" Tu produis un dossier professionnel, extrêmement clair, structuré et exploitable. Tu distingues les faits des hypothèses et tu n’inventes rien.",
    `SYNTHÈSES DU PROJET:\n${combined}\n\nCrée le DOSSIER MAÎTRE avec cette structure:\n1. RÉSUMÉ EXÉCUTIF\n2. OBJECTIF DU PROJET\n3. FAITS ET DONNÉES CONFIRMÉES\n4. CHIFFRES CLÉS\n5. DÉCISIONS DÉJÀ PRISES\n6. CONTRAINTES\n7. ORGANISATION / STRUCTURE\n8. POINTS À VÉRIFIER\n9. CONTRADICTIONS OU RISQUES\n10. INFORMATIONS MANQUANTES\n11. PROCHAINES DÉCISIONS À PRENDRE\n12. PLAN D’ACTION PRIORISÉ\n13. SOURCES / DOCUMENTS UTILISÉS\n\nSois carré, concis et professionnel. Écris « non fourni » quand une information manque.`,
    1350
  );
  p.masterDossier=out;save();$("masterDossierStatus").textContent="✓ Dossier maître à jour.";renderMasterDossier();
}
function downloadMasterDossier(){
  const p=project();if(!p.masterDossier)return;
  const blob=new Blob([p.masterDossier],{type:"text/markdown;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=(p.name||"projet").replace(/[^a-z0-9_-]+/gi,"-")+"-dossier-maitre.md";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}

function escHtmlText(t){return String(t||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}
function inlineMarkdown(text){
  return escHtmlText(text)
    .replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")
    .replace(/__([^_]+)__/g,"<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g,"<em>$1</em>");
}
function plainTextToHtml(text){
  const lines=String(text||"").split(/\n/),out=[];let inUl=false,inOl=false;
  const close=()=>{if(inUl){out.push("</ul>");inUl=false}if(inOl){out.push("</ol>");inOl=false}};
  for(const raw of lines){
    const line=raw.trim();
    if(!line){close();out.push("<p><br></p>");continue}
    if(/^#{1,6}\s+/.test(line)){
      close();
      const level=(line.match(/^#+/)||[""])[0].length;
      const tag=level===1?"h1":level===2?"h2":"h3";
      out.push(`<${tag}>${inlineMarkdown(line.replace(/^#{1,6}\s+/,""))}</${tag}>`);
      continue;
    }
    if(/^Document\s*:/i.test(line)){close();out.push("<h2>"+inlineMarkdown(line)+"</h2>");continue}
    if(/^\d+[.)]\s+/.test(line)){
      if(inUl){out.push("</ul>");inUl=false}
      if(!inOl){out.push("<ol>");inOl=true}
      out.push("<li>"+inlineMarkdown(line.replace(/^\d+[.)]\s+/,""))+"</li>");continue
    }
    if(/^[-•*]\s+/.test(line)){
      if(inOl){out.push("</ol>");inOl=false}
      if(!inUl){out.push("<ul>");inUl=true}
      out.push("<li>"+inlineMarkdown(line.replace(/^[-•*]\s+/,""))+"</li>");continue
    }
    close();out.push("<p>"+inlineMarkdown(line)+"</p>");
  }
  close();return out.join("");
}
function cleanSavedFinalDocHtml(html){
  let x=String(html||"");
  x=x.replace(/<p>\s*#{1,6}\s+([\s\S]*?)<\/p>/gi,(m,t)=>"<h3>"+t+"</h3>");
  x=x.replace(/<p>\s*(Document\s*:[\s\S]*?)<\/p>/gi,(m,t)=>"<h2>"+t+"</h2>");
  x=x.replace(/\*\*([^*<]+)\*\*/g,"<strong>$1</strong>");
  x=x.replace(/__([^_<]+)__/g,"<strong>$1</strong>");
  return x;
}
function renderFinalDocument(){
  const p=project(),ed=$("finalDocEditor"),title=$("finalDocTitle");
  if(!ed||!title)return;
  title.value=p.finalDocTitle||"Dossier final";
  if(p.finalDocHtml){
    const cleaned=cleanSavedFinalDocHtml(p.finalDocHtml);
    if(cleaned!==p.finalDocHtml){p.finalDocHtml=cleaned;save()}
  }
  ed.innerHTML=p.finalDocHtml||plainTextToHtml(p.masterDossier||"")||"<h1>Dossier final</h1><p>Le Chef peut créer ici le document final du projet.</p>";
  $("finalDocStatus").textContent=p.finalDocHtml?"Enregistré localement":"Prêt à être créé";
}
function saveFinalDocument(){
  const p=project();p.finalDocTitle=$("finalDocTitle").value.trim()||"Dossier final";p.finalDocHtml=$("finalDocEditor").innerHTML;save();
  $("finalDocStatus").textContent="Enregistré ✓";setTimeout(()=>{$("finalDocStatus").textContent="Enregistré localement"},1200);
}
async function generateFinalDocument(){
  const p=project(),source=[p.masterDossier||"",project()?.runs?.slice(-1)[0]?.final_report||"",projectContext()].filter(Boolean).join("\n\n").slice(0,15000);
  if(!source.trim()){$("finalDocStatus").textContent="Aucune matière à transformer en document.";return}
  $("finalDocStatus").textContent="Le Chef rédige le document final…";
  try{
    const out=await llm(
      AGENTS.coordinator.role+" Tu rédiges un document final professionnel, clair, crédible et présentable. Structure avec titres et sous-titres. N’invente rien.",
      `CONTENU DU PROJET:\n${source}\n\nRédige maintenant un vrai document final destiné à un investisseur. Commence par un résumé exécutif, puis concept, besoin marché, expérience client, fonctionnement, espaces, modèle économique, revenus/coûts disponibles, équipe/opérations, risques, hypothèses à confirmer et prochaines étapes. Utilise seulement # et ## pour les titres, des listes quand utile. Ne recopie pas les notes brutes et ne montre jamais les symboles Markdown dans le texte final. N’invente aucun chiffre manquant. Utilise en priorité la MÉMOIRE WEB PERMANENTE et les recherches Internet enregistrées dans le projet pour rendre le dossier réaliste. Ajoute une section SOURCES avec les liens utilisés et ne supprime pas une information utile simplement parce qu’elle vient d’une recherche plus ancienne.`,
      1400
    );
    p.finalDocTitle=p.finalDocTitle||"Dossier final";
    p.finalDocHtml=plainTextToHtml(out);
    save();renderFinalDocument();$("finalDocStatus").textContent="✓ Document créé par le Chef";
    addMessage("coordinator","user","J’ai créé le document final. Tu peux maintenant le modifier directement dans l’éditeur puis l’exporter en Word ou PDF.","direct");renderChats();
  }catch(e){$("finalDocStatus").textContent="Erreur pendant la création : "+(e?.message||e)}
}
function downloadWordDocument(){
  saveFinalDocument();const p=project(),title=p.finalDocTitle||"Dossier final";
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;line-height:1.5;margin:50px;color:#111}h1{font-size:28px}h2{font-size:20px;margin-top:24px}p{margin:0 0 10px}li{margin:4px 0}</style></head><body><h1>${esc(title)}</h1>${p.finalDocHtml||""}</body></html>`;
  const blob=new Blob([html],{type:"application/msword"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=title.replace(/[^a-z0-9_-]+/gi,"-")+".doc";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function downloadPdfDocument(){
  saveFinalDocument();const p=project(),node=$("finalDocEditor").cloneNode(true),wrap=document.createElement("div");
  wrap.style.background="white";wrap.style.color="#111";wrap.style.padding="32px";wrap.appendChild(node);node.style.boxShadow="none";node.style.margin="0 auto";node.style.minHeight="auto";
  if(window.html2pdf){
    window.html2pdf().set({margin:10,filename:(p.finalDocTitle||"Dossier-final").replace(/[^a-z0-9_-]+/gi,"-")+".pdf",image:{type:"jpeg",quality:.98},html2canvas:{scale:2},jsPDF:{unit:"mm",format:"a4",orientation:"portrait"}}).from(wrap).save();
  }else{
    const w=window.open("","_blank");w.document.write("<html><body>"+wrap.innerHTML+"</body></html>");w.document.close();w.print();
  }
}

function domainOf(url){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return ""}}
function webCategory(text){
  const t=String(text||"").toLowerCase();
  if(/loyer|immobilier|pi²|pied carré|commercial/.test(t))return "Immobilier";
  if(/salaire|emploi|main.d.?œuvre|staff|personnel/.test(t))return "Salaires";
  if(/règlement|reglement|loi|norme|permis|gouvernement|québec|canada/.test(t))return "Réglementation";
  if(/marché|marche|croissance|industrie|tendance|demande/.test(t))return "Marché";
  if(/prix|coût|cout|budget|revenu|marge|finance/.test(t))return "Finance";
  if(/concurrent|spa|clinique|centre|studio/.test(t))return "Concurrence";
  return "Projet";
}
function rememberWebResults(results){
  const p=project();p.webMemory=p.webMemory||[];
  const byUrl=new Map(p.webMemory.map(x=>[x.url,x]));
  for(const r of results||[]){
    if(!r?.url||!String(r.content||"").trim())continue;
    const old=byUrl.get(r.url);
    const entry={
      id:old?.id||uid(),
      title:r.title||r.url,
      url:r.url,
      fact:String(r.content||"").replace(/\s+/g," ").trim().slice(0,520),
      category:webCategory((r.title||"")+" "+(r.content||"")),
      query:r.query||old?.query||"",
      saved_at:old?.saved_at||now(),
      updated_at:now()
    };
    byUrl.set(r.url,entry);
  }
  p.webMemory=[...byUrl.values()].slice(-120);save();
}
function removeWebMemory(id){
  const p=project();p.webMemory=(p.webMemory||[]).filter(x=>x.id!==id);save();renderWebResearch();
}
function renderWebResearch(){
  const p=project(),list=$("webResearchSources"),status=$("researchMissionStatus"),badge=$("webResearchBadge"),key=$("tavilyKey");
  const hasKey=!!String(db.settings.tavilyKey||"").trim();
  if(key&&!key.value)key.value=db.settings.tavilyKey||"";
  if(badge){badge.textContent=hasKey?"Activée":"Non configurée";badge.className="webResearchBadge "+(hasKey?"on":"off")}
  if($("webResearchStatus"))$("webResearchStatus").textContent=hasKey?"Recherche web activée. Le Chef garde automatiquement les informations utiles.":"Ajoute une clé Tavily pour permettre aux agents de faire de vraies recherches web.";
  const arr=p.webResearch||[];
  if(status)status.textContent=arr.length?`${arr.length} source${arr.length>1?"s":""} enregistrée${arr.length>1?"s":""} pour ce projet.`:"Aucune recherche effectuée.";
  if(list)list.innerHTML=arr.length?[...arr].reverse().slice(0,30).map(r=>`<div class="webSource"><div class="webSourceTop"><a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.title||r.url)}</a><span class="sourceDomain">${esc(domainOf(r.url))}</span></div><p>${esc(String(r.content||"").slice(0,650))}</p><div class="webSourceQuery">Recherche : ${esc(r.query||"")}</div></div>`).join(""):'<div class="empty">Les sources apparaîtront ici.</div>';

  const mem=p.webMemory||[],memList=$("webMemoryList"),memCount=$("webMemoryCount");
  if(memCount)memCount.textContent=`${mem.length} élément${mem.length>1?"s":""}`;
  if(memList){
    memList.innerHTML=mem.length?[...mem].reverse().map(x=>`<div class="webMemoryItem"><div class="webMemoryTop"><span class="webMemoryCategory">${esc(x.category||"Projet")}</span><button data-web-memory-rm="${esc(x.id)}" title="Retirer de la mémoire">×</button></div><div class="webMemoryFact">${esc(x.fact)}</div><a href="${esc(x.url)}" target="_blank" rel="noreferrer">${esc(x.title||domainOf(x.url))}</a></div>`).join(""):'<div class="empty">Aucune information retenue pour le moment.</div>';
    memList.querySelectorAll("[data-web-memory-rm]").forEach(b=>b.onclick=()=>removeWebMemory(b.dataset.webMemoryRm));
  }
}
async function tavilySearch(query,maxResults=8){
  const key=String(db.settings.tavilyKey||"").trim();
  if(!key)throw new Error("Recherche Internet non configurée");
  const r=await fetch("https://api.tavily.com/search",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      api_key:key,
      query,
      search_depth:"basic",
      max_results:maxResults,
      include_answer:false,
      include_raw_content:false
    })
  });
  if(!r.ok)throw new Error("Recherche web indisponible ("+r.status+")");
  const data=await r.json();
  return (data.results||[]).map(x=>({title:x.title||x.url,url:x.url,content:x.content||"",score:x.score||0,query,time:now()}));
}
function researchQuery(goal){
  const g=String(goal||"").trim()||"centre de récupération guidée clinique intégrée";
  return g+" Montréal Québec marché concurrence loyers commerciaux salaires coûts réglementation sources officielles";
}
function recentCachedResearch(p,query,maxAgeDays=7){
  const maxAge=maxAgeDays*24*60*60*1000,cut=Date.now()-maxAge;
  return (p.webResearch||[]).filter(r=>r.query===query&&new Date(r.time||0).getTime()>=cut);
}
async function runWebResearch(goal,{silent=false,force=false}={}){
  const key=String(db.settings.tavilyKey||"").trim();
  if(!key){
    if(!silent)addNotification("coordinator","Recherche Internet non configurée","Ajoute une clé Tavily gratuite dans la section Recherche Internet pour que je puisse vérifier le marché et les données réelles.","warning","open-agent");
    return [];
  }
  const p=project(),status=$("researchMissionStatus"),query=researchQuery(goal);
  const cached=recentCachedResearch(p,query,7);
  if(cached.length&&!force){
    if(status)status.textContent=`✓ ${cached.length} source${cached.length>1?"s":""} récente${cached.length>1?"s":""} réutilisée${cached.length>1?"s":""} — 0 nouveau crédit.`;
    if(!silent)addMessage("coordinator","user","J’ai déjà des sources récentes pour cette recherche. Je les réutilise sans consommer de nouveau crédit.","direct");
    rememberWebResults(cached);renderWebResearch();renderChats();return cached;
  }
  if(status)status.textContent="Le Chef fait 1 recherche Internet et la partage avec toute l’équipe…";
  if(!silent)addMessage("coordinator","user","Je fais une seule recherche Internet, puis toute l’équipe réutilisera les mêmes sources.","direct");
  let all=[];
  try{all=await tavilySearch(query,8)}
  catch(e){
    if(!silent)addNotification("coordinator","Recherche web incomplète",String(e?.message||e),"warning","open-agent");
    return [];
  }
  const byUrl=new Map((p.webResearch||[]).map(x=>[x.url,x]));
  for(const r of all){if(r.url)byUrl.set(r.url,r)}
  p.webResearch=[...byUrl.values()].slice(-80);rememberWebResults(all);save();renderWebResearch();
  if(status)status.textContent=`✓ 1 recherche effectuée · ${all.length} résultat${all.length>1?"s":""}. Toutes les IA utilisent ces mêmes sources.`;
  if(!silent)addMessage("coordinator","user",`J’ai terminé la recherche Internet. J’ai ajouté ${all.length} sources au projet. Finance, Investisseur, Architecture, Opérations et Vérification vont toutes les réutiliser.`,"direct");
  renderChats();return all;
}
async function testWebResearch(){
  db.settings.tavilyKey=$("tavilyKey").value.trim();save();renderWebResearch();
  $("webResearchStatus").textContent="Test de la recherche…";
  try{
    const r=await tavilySearch("Montréal Québec données économiques",1);
    $("webResearchStatus").textContent=r.length?"✓ Recherche Internet connectée.":"Connexion réussie, mais aucun résultat.";
    renderWebResearch();
  }catch(e){$("webResearchStatus").textContent="Impossible de rechercher : "+(e?.message||e)}
}
function renderReport(){const r=project().runs||[];$("reportText").textContent=r[r.length-1]?.final_report||"Aucun rapport pour ce projet."}
function renderAll(){renderProjects();renderRoom();renderDetail();renderActivity();renderChats();renderConversationModal();renderProjectFiles();renderMasterDossier();renderWebResearch();renderFinalDocument();renderReport();renderNotifications();updateResumeUI()}

const OLLAMA_URL="http://127.0.0.1:11434";
async function checkOllama(){
  try{
    const r=await fetch(OLLAMA_URL+"/api/tags",{method:"GET",cache:"no-store"});
    if(!r.ok)throw new Error("Ollama ne répond pas");
    const data=await r.json(),names=(data.models||[]).map(x=>x.name);
    const wanted=db.settings.ollamaModel||"qwen3:4b";
    ollamaReady=names.some(n=>n===wanted||n.startsWith(wanted+":")||wanted.startsWith(n.split(":")[0]));
    ollamaChecked=true;
    if(ollamaReady){
      $("engineDot").className="statusDot ok";
      $("engineText").textContent="Ollama · "+wanted+" prêt";
      $("loadModelBtn").textContent="Ollama connecté ✓";
      $("setupText").textContent="Le vrai moteur local Ollama est connecté. Les conversations utilisent Qwen3 4B.";
      $("loadPct").textContent="100 %";$("loadBarFill").style.width="100%";
      return true;
    }
    throw new Error("Le modèle "+wanted+" n’est pas installé dans Ollama.");
  }catch(e){
    ollamaReady=false;ollamaChecked=true;
    return false;
  }
}
async function ollamaChat(messages,max_tokens=700,temperature=.45){
  const model=db.settings.ollamaModel||"qwen3:4b";
  const body={
    model,
    messages,
    stream:false,
    think:false,
    options:{temperature,num_predict:max_tokens,num_ctx:8192,repeat_penalty:1.12}
  };
  const r=await fetch(OLLAMA_URL+"/api/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  if(!r.ok)throw new Error("Ollama HTTP "+r.status);
  const data=await r.json();
  return strip(data?.message?.content||"");
}
function similarText(a,b){
  const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9àâçéèêëîïôûùüÿñæœ ]+/gi," ").replace(/\s+/g," ").trim();
  const aa=norm(a),bb=norm(b);if(!aa||!bb)return false;
  if(aa===bb)return true;
  const wa=new Set(aa.split(" ")),wb=new Set(bb.split(" "));
  let inter=0;wa.forEach(x=>{if(wb.has(x))inter++});
  return inter/Math.max(1,Math.min(wa.size,wb.size))>.78;
}
async function chatAgent(agentId,userMessage){
  const m=AGENTS[agentId],p=project(),all=p.messages||[];
  const direct=all.filter(x=>x.channel==="direct"&&(x.from===agentId||x.to===agentId)).slice(-8);
  const context=projectContext().slice(0,5200);
  const system=`${m.role}
Tu discutes avec Fabien comme un collègue humain.
Règles:
- Toujours en français naturel et direct.
- Réponds d’abord au dernier message.
- Ne répète pas une réponse précédente.
- Si le fichier ou dossier est déjà présent dans le contexte, ne le redemande pas.
- Si Fabien te donne un ordre clair, confirme brièvement puis exécute ce qui est possible.
- N’invente rien.
CONTEXTE DU PROJET:
${context||"Aucun contexte enregistré."}`;
  const messages=[{role:"system",content:system}];
  for(const x of direct){
    messages.push({
      role:x.from==="user"?"user":"assistant",
      content:String(x.body).slice(0,900)
    });
  }
  const r=await engine.chat.completions.create({
    messages,
    temperature:.55,
    max_tokens:420
  });
  let reply=strip(r.choices?.[0]?.message?.content||"");
  const prev=direct.filter(x=>x.from===agentId).slice(-1)[0]?.body||"";
  if(similarText(reply,prev)){
    const r2=await engine.chat.completions.create({
      messages:[...messages,{role:"system",content:"Ta réponse ressemble trop à la précédente. Réponds autrement et traite uniquement le dernier message de Fabien."}],
      temperature:.75,max_tokens:420
    });
    reply=strip(r2.choices?.[0]?.message?.content||"");
  }
  return reply;
}
async function ensureModel(){
  if(engineReady&&engine)return true;
  if(engineLoading)return false;
  if(!navigator.gpu){showError("WebGPU n’est pas disponible. Utilise Chrome récent sur ce Mac.");return false}
  engineLoading=true;showError("");$("loadModelBtn").disabled=true;$("engineText").textContent="Chargement de l’IA dans Chrome…";
  const model=$("modelSelect").value;db.settings.model=model;save();
  try{
    const appConfig={...webllm.prebuiltAppConfig,cacheBackend:"indexeddb"};
    engine=await webllm.CreateMLCEngine(model,{appConfig,initProgressCallback:p=>{
      const pc=Math.round((p.progress||0)*100);
      $("loadBarFill").style.width=pc+"%";$("loadPct").textContent=pc+" %";
      $("setupText").textContent=p.text||"Téléchargement du modèle…";
    }});
    engineReady=true;
    $("engineDot").className="statusDot ok";
    $("engineText").textContent="IA Chrome prête";
    $("loadModelBtn").textContent="IA prête ✓";
    $("setupText").textContent="L’IA travaille directement dans cette page tant qu’elle reste ouverte.";
    return true;
  }catch(e){
    $("engineDot").className="statusDot bad";
    $("engineText").textContent="Erreur IA";
    showError("Impossible de charger le modèle : "+(e?.message||e));
    return false;
  }finally{
    engineLoading=false;$("loadModelBtn").disabled=false;
  }
}
function compactPrompt(text,max=8500){
  const t=String(text||"");if(t.length<=max)return t;
  const head=Math.floor(max*.58),tail=max-head;
  return t.slice(0,head)+"\n\n[... contenu intermédiaire condensé automatiquement ...]\n\n"+t.slice(-tail);
}
async function llm(system,user,max_tokens=500){
  if(!await ensureModel())throw new Error("IA locale non prête");
  const sys=system+"\nRéponds toujours en français naturel. N'affiche jamais ton raisonnement interne. N'invente pas les données manquantes.";
  let prompt=compactPrompt(user,6200);
  try{
    const r=await engine.chat.completions.create({
      messages:[{role:"system",content:sys},{role:"user",content:prompt}],
      temperature:.45,max_tokens
    });
    return strip(r.choices?.[0]?.message?.content||"");
  }catch(e){
    const info=humanError(e);
    if(info.kind==="context"){
      prompt=compactPrompt(user,4300);
      const r=await engine.chat.completions.create({
        messages:[{role:"system",content:sys},{role:"user",content:prompt}],
        temperature:.35,max_tokens:Math.min(max_tokens,500)
      });
      return strip(r.choices?.[0]?.message?.content||"");
    }
    throw e;
  }
}
const memory=()=>projectContext();
function choose(goal){const g=goal.toLowerCase(),o=[],add=a=>{if(!o.includes(a))o.push(a)};if(/reven|coût|cout|budget|marge|prix|rentab|tax|salaire/.test(g))add("finance");if(/plan|surface|pi²|m2|m²|salle|vestiaire|circulation|architect/.test(g))add("spaces");if(/horaire|rotation|capacité|capacite|personnel|nettoyage|opération/.test(g))add("operations");if(/clinique|thérap|client|rendez-vous|soin/.test(g))add("clinic");if(/toladi|huile|packaging|marque|bouteille/.test(g))add("toladi");if(/marketing|instagram|pub|vente|communication/.test(g))add("marketing");if(/invest|business|présentation|financement/.test(g))add("investor");if(/donnée|data|tableau|csv|statistique|calcul/.test(g))add("data");if(/produit|fonctionnalité|experience|expérience/.test(g))add("product");if(/texte|rédaction|contenu|document|présentation/.test(g))add("content");if(/bug|erreur|bloqu|support|technique/.test(g))add("support");if(o.length<2){add("finance");add("operations")}return o.slice(0,6)}
async function plan(goal){try{const out=await llm(AGENTS.coordinator.role,`MÉMOIRE:\n${memory()||"Aucune"}\n\nMISSION:\n${goal}\n\nChoisis 2 à 6 spécialistes parmi finance, spaces, operations, clinic, toladi, marketing, investor, data, product, content, support. Réponds: AGENTS: id,id puis PLAN: une phrase.`,180),m=out.match(/AGENTS\s*:\s*([^\n]+)/i),arr=m?m[1].split(/[,; ]+/).filter(x=>SPECIALISTS.includes(x)):[];return {agents:arr.length?[...new Set(arr)].slice(0,5):choose(goal),plan:out}}catch{return {agents:choose(goal),plan:"Plan local de secours."}}}
function makeRun(goal){const run={id:uid(),goal,created_at:now(),status:"running",agents:Object.keys(AGENTS).map(a=>({agent_id:a,status:"resting",task:"",progress:0,output:"",started_at:"",finished_at:"",reason:""})),final_report:""};project().runs.push(run);project().runs=project().runs.slice(-15);save();return run}
const row=(run,a)=>run.agents.find(x=>x.agent_id===a);
function setA(run,a,p){Object.assign(row(run,a),p);save();renderAll()}
async function doAgent(run,aid,goal){setA(run,aid,{status:"working",task:`Analyse : ${goal.slice(0,70)}`,progress:20,started_at:now(),reason:""});addActivity("commence son analyse",aid);addMessage("coordinator",aid,`Analyse cette mission : ${goal}`,"internal");try{const inbox=(project().messages||[]).filter(m=>m.channel==="internal"&&m.to===aid).slice(-8).map(m=>`${AGENTS[m.from]?.name||m.from}: ${m.body}`).join("\n");const out=await llm(AGENTS[aid].role+`\nSignale les blocages, distingue fait/hypothèse et ne prétends jamais qu\'une règle légale est satisfaite sans preuve.`,`MÉMOIRE DU PROJET:\n${memory()||"Aucune donnée"}\n\nMESSAGES REÇUS DU RÉSEAU IA:\n${inbox||"Aucun"}\n\nMISSION:\n${goal}\n\nFais uniquement ton analyse.`,650);const blocked=/donnée.{0,15}manquant|impossible|bloqu/i.test(out)&&memory().trim().length<40;setA(run,aid,{status:blocked?"blocked":"done",progress:100,output:out,finished_at:now(),reason:blocked?"Informations insuffisantes pour conclure.":""});addMessage(aid,"coordinator",out,"internal");addActivity(blocked?"signale un blocage":"termine son analyse",aid);return out}catch(e){const msg=e?.message||String(e),info=humanError(e);setA(run,aid,{status:"blocked",progress:100,output:info.message,reason:info.message,finished_at:now()});addNotification(aid,info.title,info.message,"error",info.action,msg);addMessage(aid,"user",`J’ai rencontré un problème : ${info.message} Je vais essayer de le corriger, et je te préviens si j’ai besoin de toi.`,"direct");renderChats();return "BLOCAGE "+AGENTS[aid].name+": "+info.message}}
async function runMission(options={}){
  if(running)return;
  const resume=!!options.resume,old=resume?latestRun():null;
  const goal=(resume?(old?.goal||""):$("goal").value.trim()).trim();
  if(!goal)return showError("Écris la mission de l’équipe.");

  running=true;showError("");$("runBtn").disabled=true;$("runBtn").textContent=resume?"Reprise en cours…":"Équipe en cours…";$("newTaskBtn").disabled=true;
  updateResumeUI();

  let run;
  if(resume&&old){
    run=old;run.status="running";run.resumeAvailable=false;run.resumed_at=now();
    for(const a of run.agents||[]){if(a.status==="blocked"&&/interrompue|pause|actualisation/i.test(a.reason||"")){a.status="waiting";a.reason="";a.finished_at=""}}
    save();addActivity("reprend la mission après actualisation","coordinator");
    addMessage("coordinator","user","Je reprends la mission là où elle s’était arrêtée. Je garde tout le travail déjà terminé.","direct");
  }else{
    run=makeRun(goal);setA(run,"coordinator",{status:"working",task:"Prépare et distribue la mission",progress:20,started_at:now()});addActivity("prépare la mission");
  }

  try{
    if(!resume&&String(db.settings.tavilyKey||"").trim()){
      await runWebResearch(goal,{silent:false});
    }
    let agentIds=[];
    if(resume){
      agentIds=(run.agents||[]).filter(a=>SPECIALISTS.includes(a.agent_id)&&(a.status!=="done"||!a.output)).map(a=>a.agent_id);
      if(!agentIds.length){const p=await plan(goal);agentIds=p.agents}
      setA(run,"coordinator",{status:"done",progress:100,output:row(run,"coordinator")?.output||"Mission reprise.",finished_at:now()});
    }else{
      const p=await plan(goal);agentIds=p.agents;setA(run,"coordinator",{status:"done",progress:100,output:p.plan,finished_at:now()});
      agentIds.forEach(a=>setA(run,a,{status:"waiting",task:"Attend son tour",progress:5}));
    }

    const results={};
    for(const a of (run.agents||[])){if(SPECIALISTS.includes(a.agent_id)&&a.status==="done"&&a.output)results[a.agent_id]=a.output}

    const queue=agentIds.filter(a=>!results[a]),limit=Math.max(1,Math.min(3,Number(db.settings.parallel||2)));
    async function worker(){while(queue.length){const a=queue.shift();if(!a)return;results[a]=await doAgent(run,a,goal)}}
    if(queue.length)await Promise.all(Array.from({length:Math.min(limit,queue.length)},()=>worker()));

    const ids=Object.keys(results);
    for(let i=0;i<ids.length-1;i++){const a=ids[i],next=ids[i+1],brief=strip(results[a]).replace(/\s+/g," ").slice(0,420);addMessage(a,next,`Transmission de travail : ${brief}`,"internal")}
    Object.entries(results).forEach(([a,o])=>addMessage(a,"critic",`Pour contrôle : ${strip(o).replace(/\s+/g," ").slice(0,420)}`,"internal"));

    const pack=Object.entries(results).map(([a,o])=>`### ${AGENTS[a].name}\n${o}`).join("\n\n");
    let crit=row(run,"critic")?.status==="done"&&row(run,"critic")?.output?row(run,"critic").output:"";
    if(!crit){
      setA(run,"critic",{status:"working",task:"Contrôle les analyses",progress:20,started_at:now(),reason:""});
      crit=await llm(AGENTS.critic.role,`MISSION:\n${goal}\n\nANALYSES:\n${pack}\n\nContrôle les contradictions et risques.`,500);
      setA(run,"critic",{status:"done",progress:100,output:crit,finished_at:now()});
      addMessage("critic","verifier",`Contrôle terminé : ${strip(crit).replace(/\s+/g," ").slice(0,500)}`,"internal");
    }

    setA(run,"verifier",{status:"working",task:"Consolide le rapport final",progress:25,started_at:now(),reason:""});
    const final=await llm(AGENTS.verifier.role,`MISSION:\n${goal}\n\nMÉMOIRE ET FICHIERS:\n${memory()||"Aucune"}\n\nANALYSES:\n${pack}\n\nCRITIQUE:\n${crit}\n\nRédige un rapport clair avec RÉPONSE, CHIFFRES/HYPOTHÈSES, PROBLÈMES À CORRIGER, DÉCISIONS POUR FABIEN, PROCHAINE ACTION. Quand une information vient de la recherche Internet, indique le nom de la source et son URL. Ne présente jamais une donnée web sans source.`,850);
    setA(run,"verifier",{status:"done",progress:100,output:final,finished_at:now()});
    addMessage("verifier","coordinator","Rapport final terminé et prêt pour Fabien.","internal");
    run.final_report=final;run.status="done";run.resumeAvailable=false;if(!project().finalDocHtml)project().finalDocHtml=plainTextToHtml(final);
    save();addActivity("rapport final terminé","verifier");
    addMessage("coordinator","user",resume?"La mission a repris et l’équipe vient de terminer le travail.":"L’équipe a terminé la mission. J’ai aussi placé le résultat dans le Document final, que tu peux modifier et exporter en Word ou PDF.","direct");
    renderAll();
  }catch(e){
    const info=humanError(e);
    for(const a of run.agents||[]){if(a.status==="working"||a.status==="waiting"){a.status="waiting";a.reason="Mission mise en pause. Tu peux appuyer sur Reprendre.";a.finished_at=""}}
    run.status="paused";run.resumeAvailable=true;run.final_report=info.message;save();showError("");
    addNotification("coordinator",info.title,info.message,"error","open-agent",String(e?.message||e));
    addMessage("coordinator","user","La mission s’est arrêtée, mais le travail déjà terminé est conservé. Appuie sur « Reprendre » ou sur la touche R pour continuer.","direct");
    renderAll();
  }finally{
    running=false;$("runBtn").disabled=false;$("runBtn").textContent="▶ Lancer";$("newTaskBtn").disabled=false;updateResumeUI();
  }
}
async function resumeLastMission(){
  const run=latestRun();if(!run||!["paused","interrupted","error"].includes(run.status))return;
  $("goal").value=run.goal||"";await runMission({resume:true});
}
function looksLikeMission(text){
  return /\b(fais|faire|prépare|préparer|analyse|analyser|lance|lancer|travaille|travailler|avance|avancer|continue|continuer|crée|créer|refais|revoir|vérifie|vérifier|organise|organiser|construis|construire|mets à jour|mettre à jour)\b/i.test(text);
}
async function sendDirect(sourceId="directInput"){
  const inp=$(sourceId),msg=inp.value.trim();if(!msg)return;
  inp.value="";addMessage("user",selectedAgent,msg,"direct");renderChats();renderConversationModal();$("directOnline").textContent="● réfléchit…";

  // Si Fabien donne un ordre au Chef, le Chef lance réellement la mission.
  if(selectedAgent==="coordinator" && looksLikeMission(msg) && !running){
    addMessage("coordinator","user","D’accord. Je lance le travail maintenant avec l’équipe et je te remonte le résultat ici.","direct");
    $("goal").value=msg;
    renderChats();renderConversationModal();
    $("directOnline").textContent="● mission lancée";
    setTimeout(()=>runMission(),80);
    return;
  }

  try{
    if(!engineReady)await ensureModel();
    const reply=await chatAgent(selectedAgent,msg);
    addMessage(selectedAgent,"user",reply||"Je n’ai pas réussi à formuler une réponse. Réessaie ta question.","direct");
    renderChats();renderConversationModal();
  }catch(e){
    const info=humanError(e);
    addNotification(selectedAgent,info.title,info.message,"warning",info.action,String(e?.message||e));
    addMessage(selectedAgent,"user",info.message,"direct");
    renderChats();renderConversationModal();
  }finally{
    if(!running)$("directOnline").textContent="● disponible";
  }
}


$("loadModelBtn").onclick=ensureModel;
$("modelSelect").value=db.settings.model||"Qwen2.5-3B-Instruct-q4f16_1-MLC";
$("modelSelect").onchange=()=>{db.settings.model=$("modelSelect").value;if(db.settings.model.startsWith("ollama:"))db.settings.ollamaModel=db.settings.model.slice(7);save();engine=null;engineReady=false;ollamaReady=false;$("engineDot").className="statusDot";$("engineText").textContent="Moteur à connecter";$("loadModelBtn").textContent="Connecter l’IA"};
$("parallel").value=String(db.settings.parallel||2);
$("parallel").onchange=()=>{db.settings.parallel=Number($("parallel").value);save()};
$("runBtn").onclick=runMission;$("newTaskBtn").onclick=()=>{$("goal").focus();$("goal").scrollIntoView({behavior:"smooth",block:"center"})};
$("resumeBtn").onclick=resumeLastMission;
$("resumeInlineBtn").onclick=resumeLastMission;
document.addEventListener("keydown",e=>{
  const tag=(document.activeElement?.tagName||"").toLowerCase(),typing=["input","textarea","select"].includes(tag)||document.activeElement?.isContentEditable;
  if(!typing&&e.key.toLowerCase()==="r"&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
    const run=latestRun();if(run&&["paused","interrupted","error"].includes(run.status)){e.preventDefault();resumeLastMission()}
  }
});

$("memoryBtn").onclick=()=>{$("memoryDrawer").classList.toggle("open");renderProjectFiles()};
$("saveMemory").onclick=()=>{const t=$("memoryText").value.trim();if(!t)return;project().memory+=(project().memory?"\n\n":"")+t;save();$("memoryText").value="";addActivity("mémoire du projet mise à jour");renderAll()};
$("fileInput").onchange=e=>handleFiles(e.target.files);
$("folderInput").onchange=e=>processFolderWithChief(e.target.files);
$("buildMasterDossier").onclick=buildMasterDossier;
$("downloadMasterDossier").onclick=downloadMasterDossier;
$("attachChat").onclick=()=>$("fileInput").click();
$("newProject").onclick=()=>{const name=prompt("Nom du nouveau projet :");if(!name)return;const description=prompt("Petite description :")||"Projet local",id=name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")||uid();db.projects.push({id,name,description,memory:"",files:[],folderBriefs:[],masterDossier:"",webResearch:[],webMemory:[],finalDocTitle:"Dossier final",finalDocHtml:"",created_at:now(),runs:[],messages:[],activity:[]});selectProject(id)};
$("sendDirect").onclick=()=>sendDirect("directInput");$("directInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();sendDirect("directInput")}});$("conversationSend").onclick=()=>sendDirect("conversationInput");$("conversationInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();sendDirect("conversationInput")}});
$("talkFocus").onclick=()=>{$("directPanel").scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>$("directInput").focus(),350)};
$("historyFocus").onclick=()=>openConversation();$("networkFilter").onchange=renderChats;
document.querySelectorAll("[data-open-chat]").forEach(b=>b.onclick=openConversation);
$("closeConversation").onclick=()=>$("conversationModal").classList.add("hidden");$("conversationModal").onclick=e=>{if(e.target===$("conversationModal"))$("conversationModal").classList.add("hidden")};
$("copyReport").onclick=async()=>{try{await navigator.clipboard.writeText($("reportText").textContent);$("copyReport").textContent="Copié ✓";setTimeout(()=>$("copyReport").textContent="Copier",1200)}catch{}};
$("generateFinalDoc").onclick=generateFinalDocument;
$("saveFinalDoc").onclick=saveFinalDocument;
$("downloadWord").onclick=downloadWordDocument;
$("downloadPdf").onclick=downloadPdfDocument;
$("finalDocTitle").addEventListener("input",()=>{$("finalDocStatus").textContent="Modifications non enregistrées"});
$("finalDocEditor").addEventListener("input",()=>{$("finalDocStatus").textContent="Modifications non enregistrées"});
document.querySelectorAll("[data-editor-cmd]").forEach(b=>b.onclick=()=>{document.execCommand(b.dataset.editorCmd,false,b.dataset.editorValue||null);$("finalDocEditor").focus();$("finalDocStatus").textContent="Modifications non enregistrées"});

$("optimizerBtn").onclick=()=>{$("optimizerModal").classList.remove("hidden");renderOptimizerChat();$("optimizerInput").focus()};
$("closeOptimizer").onclick=()=>$("optimizerModal").classList.add("hidden");$("optimizerModal").onclick=e=>{if(e.target===$("optimizerModal"))$("optimizerModal").classList.add("hidden")};
document.querySelectorAll(".optQuick").forEach(b=>b.onclick=()=>{$("optimizerInput").value=b.dataset.opt;runOptimizer()});
$("runOptimizer").onclick=runOptimizer;$("optimizerInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();runOptimizer()}});$("clearOptimizerChat").onclick=()=>{if(confirm("Effacer la conversation avec l’Optimiseur ?")){db.optimizer=[];save();renderOptimizerChat()}};

$("saveTavilyKey").onclick=()=>{db.settings.tavilyKey=$("tavilyKey").value.trim();save();renderWebResearch();$("webResearchStatus").textContent=db.settings.tavilyKey?"✓ Clé enregistrée dans ce navigateur.":"Clé supprimée."};
$("testWebResearch").onclick=testWebResearch;
$("researchNow").onclick=()=>runWebResearch($("goal").value.trim()||project().name,{force:true});
$("notificationBtn").onclick=()=>{$("notificationCenter").classList.toggle("hidden");db.notifications.forEach(n=>n.read=true);save();renderNotifications()};
$("closeNotificationCenter").onclick=()=>$("notificationCenter").classList.add("hidden");
$("clearNotifications").onclick=()=>{db.notifications.forEach(n=>n.read=true);save();renderNotifications()};
$("privacyBtn").onclick=()=>$("privacyModal").classList.remove("hidden");$("closePrivacy").onclick=()=>$("privacyModal").classList.add("hidden");$("privacyModal").onclick=e=>{if(e.target===$("privacyModal"))$("privacyModal").classList.add("hidden")};
$("clearLocal").onclick=()=>{if(confirm("Effacer tous les projets, conversations et rapports locaux ?")){localStorage.removeItem(DBKEY);location.reload()}};

if(db.settings.model&&String(db.settings.model).startsWith("ollama:")){db.settings.model="Qwen2.5-3B-Instruct-q4f16_1-MLC";save()} if(!navigator.gpu){$("engineDot").className="statusDot bad";$("engineText").textContent="WebGPU indisponible";$("setupText").textContent="Utilise Chrome récent pour faire tourner l’IA dans cette page."}else $("engineText").textContent="IA Chrome disponible";
recoverInterruptedRuns();currentProjectId=(db.selectedProject&&db.projects.some(p=>p.id===db.selectedProject))?db.selectedProject:db.projects[0].id;db.selectedProject=currentProjectId;save();$("projectTitle").textContent=project()?.name||"Mon projet";renderAll();setInterval(renderDetail,1000);
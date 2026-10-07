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

function baseDB(){return {settings:{parallel:2,model:"Qwen2.5-1.5B-Instruct-q4f16_1-MLC"},projects:[{id:"mon-projet",name:"Mon projet",description:"Projet local",memory:"",files:[],created_at:now(),runs:[],messages:[],activity:[]}],selectedProject:"mon-projet"}}
function loadDB(){
  try{
    const base=baseDB(),saved=JSON.parse(localStorage.getItem(DBKEY)||"{}"),merged={...base,...saved};
    if(!Array.isArray(merged.projects)||merged.projects.length===0)merged.projects=base.projects;
    merged.projects=merged.projects.map(p=>({
      id:p.id||uid(),name:p.name||"Mon projet",description:p.description||"Projet local",
      memory:p.memory||"",files:Array.isArray(p.files)?p.files:[],created_at:p.created_at||now(),
      runs:Array.isArray(p.runs)?p.runs:[],messages:Array.isArray(p.messages)?p.messages:[],activity:Array.isArray(p.activity)?p.activity:[]
    }));
    if(!merged.projects.some(p=>p.id===merged.selectedProject))merged.selectedProject=merged.projects[0].id;
    merged.settings={...base.settings,...(saved.settings||{})};
    return merged;
  }catch{return baseDB()}
}
let db=loadDB();
db.optimizer=db.optimizer||[];
save();
const save=()=>localStorage.setItem(DBKEY,JSON.stringify(db));
const project=()=>db.projects.find(p=>p.id===currentProjectId)||db.projects[0];
function showError(m=""){$("error").textContent=m;$("error").classList.toggle("show",!!m)}
function stateRows(){const p=project(),run=p?.runs?.[p.runs.length-1],m={};Object.keys(AGENTS).forEach(a=>m[a]={agent_id:a,status:"resting",task:"",progress:0,output:"",started_at:"",finished_at:"",reason:""});(run?.agents||[]).forEach(r=>m[r.agent_id]={...m[r.agent_id],...r});return m}
function addActivity(text,agent="coordinator"){const p=project();p.activity=p.activity||[];p.activity.push({id:uid(),time:now(),agent,text});p.activity=p.activity.slice(-60);save()}
function addMessage(from,to,body,channel="internal"){const p=project();p.messages=p.messages||[];p.messages.push({id:uid(),from,to,body:strip(body),channel,time:now()});save()}

function renderProjects(){const w=$("projects");w.innerHTML="";db.projects.forEach(p=>{const b=document.createElement("button");b.className="project"+(p.id===currentProjectId?" active":"");b.innerHTML=`<strong>${esc(p.name)}</strong><div class="tiny">${esc(p.description||"Projet local")}</div>`;b.onclick=()=>selectProject(p.id);w.appendChild(b)})}
function selectProject(id){currentProjectId=id;db.selectedProject=id;save();selectedAgent="coordinator";$("projectTitle").textContent=project().name;renderAll()}
const stateLabel=s=>({working:"Travaille",waiting:"En attente",blocked:"Bloqué",resting:"Se repose",done:"Terminé"})[s]||"Se repose";
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
  const p=project(),files=(p.files||[]).map(f=>`### Fichier: ${f.name}\n${f.text||""}`).join("\n\n");
  return [p.memory||"",files].filter(Boolean).join("\n\n").slice(0,180000);
}
async function readProjectFile(file){
  const ext=file.name.split(".").pop().toLowerCase();
  if(file.size>8*1024*1024)throw new Error(file.name+" est trop volumineux (8 Mo max).");
  if(ext==="pdf"){
    const pdfjs=await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;let out="";
    for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i),tc=await pg.getTextContent();out+=tc.items.map(x=>x.str).join(" ")+"\n";if(out.length>120000)break}
    return out.slice(0,120000);
  }
  return (await file.text()).slice(0,120000);
}
async function handleFiles(files){
  const p=project();p.files=p.files||[];
  for(const file of [...files]){
    try{const text=await readProjectFile(file);p.files.push({name:file.name,type:file.type,size:file.size,text,note:"lu localement",added_at:now()});}
    catch(e){p.files.push({name:file.name,type:file.type,size:file.size,text:"",note:"erreur: "+(e?.message||e),added_at:now()});}
  }
  save();renderProjectFiles();addActivity("fichiers du projet mis à jour");
}
function renderReport(){const r=project().runs||[];$("reportText").textContent=r[r.length-1]?.final_report||"Aucun rapport pour ce projet."}
function renderAll(){renderProjects();renderRoom();renderDetail();renderActivity();renderChats();renderConversationModal();renderProjectFiles();renderReport()}

async function ensureModel(){if(engineReady&&engine)return true;if(engineLoading)return false;if(!navigator.gpu){showError("WebGPU n’est pas disponible. Utilise Chrome récent sur ce Mac.");return false}engineLoading=true;showError("");$("loadModelBtn").disabled=true;$("engineText").textContent="Chargement de l’IA locale…";const model=$("modelSelect").value;db.settings.model=model;save();try{const appConfig={...webllm.prebuiltAppConfig,cacheBackend:"indexeddb"};engine=await webllm.CreateMLCEngine(model,{appConfig,initProgressCallback:p=>{const pc=Math.round((p.progress||0)*100);$("loadBarFill").style.width=pc+"%";$("loadPct").textContent=pc+" %";$("setupText").textContent=p.text||"Téléchargement du modèle…"}});engineReady=true;$("engineDot").className="statusDot ok";$("engineText").textContent="IA locale prête";$("loadModelBtn").textContent="IA locale prête ✓";$("setupText").textContent="Le modèle est prêt. Les analyses se font dans ce navigateur.";return true}catch(e){$("engineDot").className="statusDot bad";$("engineText").textContent="Erreur IA locale";showError("Impossible de charger le modèle : "+(e?.message||e));return false}finally{engineLoading=false;$("loadModelBtn").disabled=false}}
async function llm(system,user,max_tokens=500){if(!await ensureModel())throw new Error("IA locale non prête");const r=await engine.chat.completions.create({messages:[{role:"system",content:system+"\nRéponds en français. N'affiche jamais ton raisonnement interne. N'invente pas les données manquantes."},{role:"user",content:user}],temperature:.25,max_tokens});return strip(r.choices?.[0]?.message?.content||"")}
const memory=()=>projectContext();
function choose(goal){const g=goal.toLowerCase(),o=[],add=a=>{if(!o.includes(a))o.push(a)};if(/reven|coût|cout|budget|marge|prix|rentab|tax|salaire/.test(g))add("finance");if(/plan|surface|pi²|m2|m²|salle|vestiaire|circulation|architect/.test(g))add("spaces");if(/horaire|rotation|capacité|capacite|personnel|nettoyage|opération/.test(g))add("operations");if(/clinique|thérap|client|rendez-vous|soin/.test(g))add("clinic");if(/toladi|huile|packaging|marque|bouteille/.test(g))add("toladi");if(/marketing|instagram|pub|vente|communication/.test(g))add("marketing");if(/invest|business|présentation|financement/.test(g))add("investor");if(/donnée|data|tableau|csv|statistique|calcul/.test(g))add("data");if(/produit|fonctionnalité|experience|expérience/.test(g))add("product");if(/texte|rédaction|contenu|document|présentation/.test(g))add("content");if(/bug|erreur|bloqu|support|technique/.test(g))add("support");if(o.length<2){add("finance");add("operations")}return o.slice(0,6)}
async function plan(goal){try{const out=await llm(AGENTS.coordinator.role,`MÉMOIRE:\n${memory()||"Aucune"}\n\nMISSION:\n${goal}\n\nChoisis 2 à 6 spécialistes parmi finance, spaces, operations, clinic, toladi, marketing, investor, data, product, content, support. Réponds: AGENTS: id,id puis PLAN: une phrase.`,180),m=out.match(/AGENTS\s*:\s*([^\n]+)/i),arr=m?m[1].split(/[,; ]+/).filter(x=>SPECIALISTS.includes(x)):[];return {agents:arr.length?[...new Set(arr)].slice(0,5):choose(goal),plan:out}}catch{return {agents:choose(goal),plan:"Plan local de secours."}}}
function makeRun(goal){const run={id:uid(),goal,created_at:now(),status:"running",agents:Object.keys(AGENTS).map(a=>({agent_id:a,status:"resting",task:"",progress:0,output:"",started_at:"",finished_at:"",reason:""})),final_report:""};project().runs.push(run);project().runs=project().runs.slice(-15);save();return run}
const row=(run,a)=>run.agents.find(x=>x.agent_id===a);
function setA(run,a,p){Object.assign(row(run,a),p);save();renderAll()}
async function doAgent(run,aid,goal){setA(run,aid,{status:"working",task:`Analyse : ${goal.slice(0,70)}`,progress:20,started_at:now(),reason:""});addActivity("commence son analyse",aid);addMessage("coordinator",aid,`Analyse cette mission : ${goal}`,"internal");try{const inbox=(project().messages||[]).filter(m=>m.channel==="internal"&&m.to===aid).slice(-8).map(m=>`${AGENTS[m.from]?.name||m.from}: ${m.body}`).join("\n");const out=await llm(AGENTS[aid].role+`\nSignale les blocages, distingue fait/hypothèse et ne prétends jamais qu\'une règle légale est satisfaite sans preuve.`,`MÉMOIRE DU PROJET:\n${memory()||"Aucune donnée"}\n\nMESSAGES REÇUS DU RÉSEAU IA:\n${inbox||"Aucun"}\n\nMISSION:\n${goal}\n\nFais uniquement ton analyse.`,650);const blocked=/donnée.{0,15}manquant|impossible|bloqu/i.test(out)&&memory().trim().length<40;setA(run,aid,{status:blocked?"blocked":"done",progress:100,output:out,finished_at:now(),reason:blocked?"Informations insuffisantes pour conclure.":""});addMessage(aid,"coordinator",out,"internal");addActivity(blocked?"signale un blocage":"termine son analyse",aid);return out}catch(e){const msg=e?.message||String(e);setA(run,aid,{status:"blocked",progress:100,output:msg,reason:msg,finished_at:now()});return "BLOCAGE "+AGENTS[aid].name+": "+msg}}
async function runMission(){
  if(running)return;
  const goal=$("goal").value.trim();if(!goal)return showError("Écris la mission de l’équipe.");
  running=true;showError("");$("runBtn").disabled=true;$("runBtn").textContent="Équipe en cours…";$("newTaskBtn").disabled=true;
  const run=makeRun(goal);setA(run,"coordinator",{status:"working",task:"Prépare et distribue la mission",progress:20,started_at:now()});addActivity("prépare la mission");
  try{
    const p=await plan(goal);setA(run,"coordinator",{status:"done",progress:100,output:p.plan,finished_at:now()});
    p.agents.forEach(a=>setA(run,a,{status:"waiting",task:"Attend son tour",progress:5}));
    const results={},queue=[...p.agents],limit=Math.max(1,Math.min(3,Number(db.settings.parallel||2)));
    async function worker(){
      while(queue.length){
        const a=queue.shift();if(!a)return;
        results[a]=await doAgent(run,a,goal);
      }
    }
    await Promise.all(Array.from({length:Math.min(limit,queue.length)},()=>worker()));
    const ids=Object.keys(results);
    for(let i=0;i<ids.length-1;i++){const a=ids[i],next=ids[i+1],brief=strip(results[a]).replace(/\s+/g," ").slice(0,420);addMessage(a,next,`Transmission de travail : ${brief}`,"internal");}
    Object.entries(results).forEach(([a,o])=>addMessage(a,"critic",`Pour contrôle : ${strip(o).replace(/\s+/g," ").slice(0,420)}`,"internal"));
    setA(run,"critic",{status:"working",task:"Contrôle les analyses",progress:20,started_at:now()});
    const pack=Object.entries(results).map(([a,o])=>`### ${AGENTS[a].name}\n${o}`).join("\n\n");
    const crit=await llm(AGENTS.critic.role,`MISSION:\n${goal}\n\nANALYSES:\n${pack}\n\nContrôle les contradictions et risques.`,500);
    setA(run,"critic",{status:"done",progress:100,output:crit,finished_at:now()});addMessage("critic","verifier",`Contrôle terminé : ${strip(crit).replace(/\s+/g," ").slice(0,500)}`,"internal");
    setA(run,"verifier",{status:"working",task:"Consolide le rapport final",progress:25,started_at:now()});
    const final=await llm(AGENTS.verifier.role,`MISSION:\n${goal}\n\nMÉMOIRE ET FICHIERS:\n${memory()||"Aucune"}\n\nANALYSES:\n${pack}\n\nCRITIQUE:\n${crit}\n\nRédige un rapport clair avec RÉPONSE, CHIFFRES/HYPOTHÈSES, PROBLÈMES À CORRIGER, DÉCISIONS POUR FABIEN, PROCHAINE ACTION.`,850);
    setA(run,"verifier",{status:"done",progress:100,output:final,finished_at:now()});addMessage("verifier","coordinator","Rapport final terminé et prêt pour Fabien.","internal");
    run.final_report=final;run.status="done";save();addActivity("rapport final terminé","verifier");renderAll();
  }catch(e){run.status="error";run.final_report="Erreur locale : "+(e?.message||e);save();showError(run.final_report);renderAll()}
  finally{running=false;$("runBtn").disabled=false;$("runBtn").textContent="▶ Lancer";$("newTaskBtn").disabled=false}
}
async function sendDirect(sourceId="directInput"){const inp=$(sourceId),msg=inp.value.trim();if(!msg)return;inp.value="";addMessage("user",selectedAgent,msg,"direct");renderChats();renderConversationModal();$("directOnline").textContent="● réfléchit…";try{const recent=(project().messages||[]).filter(m=>m.channel==="direct"&&(m.from===selectedAgent||m.to===selectedAgent)).slice(-12).map(m=>`${m.from==="user"?"Fabien":AGENTS[m.from]?.name||m.from}: ${m.body}`).join("\n"),network=(project().messages||[]).filter(m=>m.channel==="internal"&&(m.from===selectedAgent||m.to===selectedAgent)).slice(-8).map(m=>`${AGENTS[m.from]?.name||m.from} → ${AGENTS[m.to]?.name||m.to}: ${m.body}`).join("\n"),reply=await llm(AGENTS[selectedAgent].role,`MÉMOIRE:\n${memory()||"Aucune"}\n\nRÉSEAU IA RÉCENT:\n${network||"Aucun"}\n\nDISCUSSION AVEC FABIEN:\n${recent}\n\nRéponds directement à Fabien.`,420);addMessage(selectedAgent,"user",reply,"direct");renderChats();renderConversationModal()}catch(e){addMessage(selectedAgent,"user","Erreur locale : "+(e?.message||e),"direct");renderChats();renderConversationModal()}finally{$("directOnline").textContent="● disponible"}}

$("loadModelBtn").onclick=ensureModel;
$("modelSelect").value=db.settings.model||"Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
$("modelSelect").onchange=()=>{db.settings.model=$("modelSelect").value;save();engine=null;engineReady=false;$("engineDot").className="statusDot";$("engineText").textContent="Modèle à charger";$("loadModelBtn").textContent="Charger l’IA locale"};
$("parallel").value=String(db.settings.parallel||2);
$("parallel").onchange=()=>{db.settings.parallel=Number($("parallel").value);save()};
$("runBtn").onclick=runMission;$("newTaskBtn").onclick=()=>{$("goal").focus();$("goal").scrollIntoView({behavior:"smooth",block:"center"})};
$("memoryBtn").onclick=()=>{$("memoryDrawer").classList.toggle("open");renderProjectFiles()};
$("saveMemory").onclick=()=>{const t=$("memoryText").value.trim();if(!t)return;project().memory+=(project().memory?"\n\n":"")+t;save();$("memoryText").value="";addActivity("mémoire du projet mise à jour");renderAll()};$("fileInput").onchange=e=>handleFiles(e.target.files);$("attachChat").onclick=()=>$("fileInput").click();
$("newProject").onclick=()=>{const name=prompt("Nom du nouveau projet :");if(!name)return;const description=prompt("Petite description :")||"Projet local",id=name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"")||uid();db.projects.push({id,name,description,memory:"",files:[],created_at:now(),runs:[],messages:[],activity:[]});selectProject(id)};
$("sendDirect").onclick=()=>sendDirect("directInput");$("directInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();sendDirect("directInput")}});$("conversationSend").onclick=()=>sendDirect("conversationInput");$("conversationInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();sendDirect("conversationInput")}});
$("talkFocus").onclick=()=>{$("directPanel").scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>$("directInput").focus(),350)};
$("historyFocus").onclick=()=>openConversation();$("networkFilter").onchange=renderChats;
document.querySelectorAll("[data-open-chat]").forEach(b=>b.onclick=openConversation);
$("closeConversation").onclick=()=>$("conversationModal").classList.add("hidden");$("conversationModal").onclick=e=>{if(e.target===$("conversationModal"))$("conversationModal").classList.add("hidden")};
$("copyReport").onclick=async()=>{try{await navigator.clipboard.writeText($("reportText").textContent);$("copyReport").textContent="Copié ✓";setTimeout(()=>$("copyReport").textContent="Copier",1200)}catch{}};
$("optimizerBtn").onclick=()=>{$("optimizerModal").classList.remove("hidden");renderOptimizerChat();$("optimizerInput").focus()};
$("closeOptimizer").onclick=()=>$("optimizerModal").classList.add("hidden");$("optimizerModal").onclick=e=>{if(e.target===$("optimizerModal"))$("optimizerModal").classList.add("hidden")};
document.querySelectorAll(".optQuick").forEach(b=>b.onclick=()=>{$("optimizerInput").value=b.dataset.opt;runOptimizer()});
$("runOptimizer").onclick=runOptimizer;$("optimizerInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();runOptimizer()}});$("clearOptimizerChat").onclick=()=>{if(confirm("Effacer la conversation avec l’Optimiseur ?")){db.optimizer=[];save();renderOptimizerChat()}};
$("privacyBtn").onclick=()=>$("privacyModal").classList.remove("hidden");$("closePrivacy").onclick=()=>$("privacyModal").classList.add("hidden");$("privacyModal").onclick=e=>{if(e.target===$("privacyModal"))$("privacyModal").classList.add("hidden")};
$("clearLocal").onclick=()=>{if(confirm("Effacer tous les projets, conversations et rapports locaux ?")){localStorage.removeItem(DBKEY);location.reload()}};

if(!navigator.gpu){$("engineDot").className="statusDot bad";$("engineText").textContent="WebGPU indisponible";$("setupText").textContent="Utilise Chrome récent pour faire tourner l’IA localement."}else $("engineText").textContent="IA locale disponible";
currentProjectId=(db.selectedProject&&db.projects.some(p=>p.id===db.selectedProject))?db.selectedProject:db.projects[0].id;db.selectedProject=currentProjectId;save();$("projectTitle").textContent=project()?.name||"Mon projet";renderAll();setInterval(renderDetail,1000);
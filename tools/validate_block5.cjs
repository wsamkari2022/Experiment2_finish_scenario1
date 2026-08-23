/* Block 5 structural validation suite.
   Run from src/experiment:  node <this file>
   Parses block5Scenarios.ts + block5CVRContent.ts as text (no build step needed). */
const fs=require('fs'),path=require('path');
// Resolve the sources relative to this file, so the suite runs from any directory.
const SRC=path.join(__dirname,'..','src','experiment');
const S=fs.readFileSync(path.join(SRC,'block5Scenarios.ts'),'utf8'), C=fs.readFileSync(path.join(SRC,'block5CVRContent.ts'),'utf8');
const K=["vulnerabilityProtectionSensitivity","groupSizeSensitivity","gainResponsivenessSensitivity","outcomeAggregationSensitivity"];
const SH={vulnerabilityProtectionSensitivity:"VULN",groupSizeSensitivity:"GROUP",gainResponsivenessSensitivity:"GAIN",outcomeAggregationSensitivity:"OUTCOME"};
const str=(t,k)=>{const j=t.indexOf(k+":");if(j<0)return null;const q=t.indexOf('"',j);return t.slice(q+1,t.indexOf('"',q+1));};
const scen=[...S.matchAll(/^    id: "([a-z_]+)",$/gm)].map(m=>({id:m[1],i:m.index}));
scen.forEach((x,k)=>x.end=k+1<scen.length?scen[k+1].i:S.length);
const DATA={};
for(const sc of scen){const body=S.slice(sc.i,sc.end);
  const opts=[...body.matchAll(/^        id: "([a-z_]+)",$/gm)];
  DATA[sc.id]=opts.map((m,k)=>{const ob=body.slice(m.index,k+1<opts.length?opts[k+1].index:body.length);
    const fp={},f=ob.match(/fingerprint: \{([\s\S]*?)\}/)[1];
    K.forEach(kk=>fp[kk]=+f.match(new RegExp(kk+": ([0-9]+)"))[1]);
    const sd=ob.match(/cvrSeed: \{([\s\S]*?)\n        \}/)[1];
    return {id:m[1],title:str(ob,"title"),fp,rule:str(sd,"rule"),ic:str(sd,"identifiedCase"),harm:str(sd,"harm"),
            gains:str(ob,"gains"),givesUp:str(ob,"givesUp"),moralTension:str(ob,"moralTension")};});}
let fails=0; const ok=(n,c,d)=>{if(!c)fails++;console.log((c?"  PASS  ":"  FAIL  ")+n+(d?"  — "+d:""));};
const align=(o,p)=>100-K.reduce((a,k)=>a+(p[k]/100)*Math.max(0,p[k]-o.fp[k]),0);
const ids=Object.keys(DATA);
console.log("\n=== 1. COVERAGE: 6 options + 4 value-champions per scenario ===");
for(const id of ids){const o=DATA[id];
  // A champion is the option scoring HIGHEST on that dimension within its scenario, uniquely.
  // Replaces an absolute ">=95" test, which was tied to the pre-Stage-3 fingerprint scale.
  // The structural property is what matters: each value must have its own distinct best option.
  const champs=new Set(K.filter(k=>{const mx=Math.max(...o.map(x=>x.fp[k]));
    return o.filter(x=>x.fp[k]===mx).length===1;}));
  const owners=new Set(K.map(k=>{const mx=Math.max(...o.map(x=>x.fp[k]));
    return o.find(x=>x.fp[k]===mx).id;}));
  ok(id.padEnd(30),o.length===6&&champs.size===4&&owners.size===4,
     champs.size+" unique champions across "+owners.size+" distinct options");}
console.log("\n=== 2. STRICT DOMINATION: no option beaten on all 4 dimensions ===");
for(const id of ids){const o=DATA[id];const bad=[];
  for(const a of o)for(const b of o)if(a!==b&&K.every(k=>b.fp[k]>=a.fp[k])&&K.some(k=>b.fp[k]>a.fp[k]))bad.push(a.id+" < "+b.id);
  ok(id.padEnd(30),bad.length===0,bad.length?bad.join("; "):"none dominated");}
console.log("\n=== 3. NO OBVIOUSLY-BEST: every option wins for some profile (4000 random) ===");
for(const id of ids){const o=DATA[id];const wins={};o.forEach(x=>wins[x.id]=0);
  for(let n=0;n<4000;n++){const p={};K.forEach(k=>p[k]=Math.floor(Math.random()*101));
    let best=o[0],bv=-1e9;for(const x of o){const v=align(x,p);if(v>bv){bv=v;best=x;}}wins[best.id]++;}
  const never=Object.entries(wins).filter(([,v])=>v===0).map(([k])=>k);
  ok(id.padEnd(30),never.length===0,never.length?"never wins: "+never.join(", "):"all 6 win somewhere");}
console.log("\n=== 4. CHAMPION MAPPING: a pure lean elects its champion ===");
for(const id of ids)for(const lean of K){const o=DATA[id];const p={};K.forEach(k=>p[k]=k===lean?95:35);
  let best=o[0],bv=-1e9;for(const x of o){const v=align(x,p);if(v>bv){bv=v;best=x;}}
  // Assert the elected option IS this scenario's champion for that value (the highest
  // fingerprint on that dimension) rather than an absolute ">=95", which was tied to the
  // pre-Stage-3 fingerprint scale.
  const mx=Math.max(...o.map(x=>x.fp[lean]));
  ok((id+" / "+SH[lean]).padEnd(40),best.fp[lean]===mx,best.title);}
console.log("\n=== 5. CVR CONTENT INTEGRITY ===");
for(const n of ["TRAVEL","MEAL","CANCER","FLOOD","WATER","GENERIC"]){
  const i=C.indexOf("const "+n+": ScenarioCVRContent"); const t=C.slice(i,C.indexOf("\n};",i));
  const vp=K.filter(k=>new RegExp(k+': "').test(t)).length;
  const fr=/context:/.test(t)&&/directness:/.test(t);
  const who=["close:","group:","system:"].every(w=>t.includes(w));
  ok((n+" content").padEnd(30),i>=0&&vp===4&&fr&&who,vp+"/4 value phrases, framing:"+fr+", who buckets:"+who);}
ok("advisor voice KNOWN_A_YEAR in all 6 group lists",(C.match(/KNOWN_A_YEAR,/g)||[]).length===6);
ok("advisor voice JUST_MET in all 6 system lists",(C.match(/JUST_MET,/g)||[]).length===6);
ok("no family wording in close voices",!/\b(mother|father|sister|brother|daughter|son|parent of yours|your family)\b/i.test(C.slice(C.indexOf("const CLOSE_WHO"),C.indexOf("const KNOWN_A_YEAR"))));
console.log("\n=== 6. VALUE PHRASES ARE SACRIFICEABLE (no self-regarding / double-negative) ===");
for(const n of ["TRAVEL","MEAL","CANCER","FLOOD","WATER"]){
  const i=C.indexOf("const "+n+": ScenarioCVRContent"),t=C.slice(i,i+3200);
  const bad=K.filter(k=>{const v=t.match(new RegExp(k+': "([^"]*)"'))[1];
    return /\bleast\b/.test(v)||/could (save|give) you\b/.test(v);});
  ok((n+" value phrases").padEnd(30),bad.length===0,bad.length?"problem: "+bad.map(k=>SH[k]).join(","):"all name something that can be given up");}
console.log("\n=== 7. IDENTIFIED-VICTIM RULE: every cvrSeed case names one individual ===");
const ABSTRACT=/^(A|The|This|It|Half|After|One of)\s+(town|local|neighbourhood|neighborhood|district|street|route|service|fare|queue|city|region|company|restaurant|four|plates|table|air|metal|harm|is\b)/i;
for(const id of ids){const bad=DATA[id].filter(o=>ABSTRACT.test(o.ic));
  ok(id.padEnd(30),bad.length===0,bad.length?"abstract opener: "+bad.map(x=>x.id).join(", "):"all 6 open on a person");}
console.log("\n=== 8. TRADE-OFF PANEL FIELDS PRESENT ON ALL 30 OPTIONS ===");
for(const id of ids){const missing=DATA[id].filter(o=>!o.gains||!o.givesUp||!o.moralTension).map(o=>o.id);
  ok(id.padEnd(30),missing.length===0,missing.length?"missing: "+missing.join(", "):"gains + givesUp + moralTension on all 6");}
console.log("\n"+(fails?"### "+fails+" CHECK(S) FAILED ###":"### ALL CHECKS PASSED ###")+"\n");
process.exit(fails?1:0);

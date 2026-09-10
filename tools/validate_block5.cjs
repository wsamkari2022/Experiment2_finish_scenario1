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
/* RECIPIENT scenarios ask what the participant WISHES someone else would do. No reflection fires
   there, so their options carry no cvrSeed by design — and every CVR-content gate below must skip
   them rather than fail on the absence. Missing decisionRole means "decider", so nothing authored
   before the field existed changes behavior. */
const ROLE={};
for(const sc of scen){
  const body=S.slice(sc.i,sc.end);
  ROLE[sc.id]=(body.match(/decisionRole: "([a-z]+)"/)||[,"decider"])[1];
}
const isRecipient=id=>ROLE[id]==="recipient";
const DECIDER_IDS=scen.map(x=>x.id).filter(id=>!isRecipient(id));
const DATA={};
for(const sc of scen){const body=S.slice(sc.i,sc.end);
  const opts=[...body.matchAll(/^        id: "([a-z_]+)",$/gm)];
  DATA[sc.id]=opts.map((m,k)=>{const ob=body.slice(m.index,k+1<opts.length?opts[k+1].index:body.length);
    const fp={},f=ob.match(/fingerprint: \{([\s\S]*?)\}/)[1];
    K.forEach(kk=>fp[kk]=+f.match(new RegExp(kk+": ([0-9]+)"))[1]);
    const seed=ob.match(/cvrSeed: \{([\s\S]*?)\n        \}/);
    if(!seed&&!isRecipient(sc.id)) throw new Error("option "+m[1]+" has no cvrSeed and its scenario is not a recipient scenario");
    const sd=seed?seed[1]:"";
    return {id:m[1],title:str(ob,"title"),fp,recipient:isRecipient(sc.id),
            rule:seed?str(sd,"rule"):null,ic:seed?str(sd,"identifiedCase"):null,harm:seed?str(sd,"harm"):null,
            gains:str(ob,"gains"),givesUp:str(ob,"givesUp"),moralTension:str(ob,"moralTension")};});}
let fails=0; const ok=(n,c,d)=>{if(!c)fails++;console.log((c?"  PASS  ":"  FAIL  ")+n+(d?"  — "+d:""));};
const align=(o,p)=>100-K.reduce((a,k)=>a+(p[k]/100)*Math.max(0,p[k]-o.fp[k]),0);
const ids=Object.keys(DATA);
/* Everything below counts against the scenarios that ACTUALLY SHIP, never against a number
   written down here. A hardcoded "30 options" silently stops meaning "all of them" the moment a
   scenario is added or removed, and a count gate that no longer counts everything is worse than
   no gate at all — it reports PASS over the gap. */
const TOTAL_OPTIONS=ids.reduce((a,id)=>a+DATA[id].length,0);
/* Options that are SUPPOSED to have CVR material. Recipient scenarios have none by design, so
   counting seeds against every option would fail for the one reason that is not a defect. */
const DECIDER_OPTIONS=DECIDER_IDS.reduce((a,id)=>a+DATA[id].length,0);
/* The CVR content blocks are likewise discovered, not listed. GENERIC is the scenario-independent
   fallback block; the checks that are about real scenarios exclude it. */
const CVR_ALL=[...C.matchAll(/const ([A-Z_]+): ScenarioCVRContent/g)].map(m=>m[1]);
const CVR_SCEN=CVR_ALL.filter(n=>n!=="GENERIC");
if(!CVR_ALL.length){console.log("  FAIL  no CVR content blocks parsed");process.exit(1);}
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
for(const n of CVR_ALL){
  const i=C.indexOf("const "+n+": ScenarioCVRContent");
  const t=C.slice(i,C.indexOf("\n};",i)).replace(/\n  parallel: \{[\s\S]*?\n  \},/,"");
  const vp=K.filter(k=>new RegExp(k+': "').test(t)).length;
  const fr=/context:/.test(t)&&/directness:/.test(t);
  ok((n+" content").padEnd(30),i>=0&&vp===4&&fr,vp+"/4 value phrases, framing:"+fr);
  // anchorNoun is rendered as `The same ${anchorNoun} are committed...`, so a leading article
  // produces "The same the six hours are committed". That shipped once; this stops it recurring.
  const an=(t.match(/anchorNoun: "([^"]*)"/)||[])[1];
  ok((n+" anchorNoun has no article").padEnd(30), !!an && !/^(the|a|an)\s/i.test(an), an||"MISSING");}

// THE THREE VOICES. One per stakeholder level, shared by every scenario. They differ only in
// social closeness, which is what the dimension measures. The old per-scenario casts (nurses,
// drivers, planners) were picked at random and not matched to the option, so a resident under a
// flight path could object to a bus journey — and the story that followed often named a different
// person than the lead had introduced.
{
  const v=C.slice(C.indexOf("const VOICE:"),C.indexOf("\n};",C.indexOf("const VOICE:")));
  for(const lvl of ["close","group","system"]){
    const blk=v.slice(v.indexOf(lvl+": {"),v.indexOf("},",v.indexOf(lvl+": {")));
    ok(("voice: "+lvl).padEnd(30), /hurtLead:/.test(blk)&&/needLead:/.test(blk)&&/label:/.test(blk),
       "has label + a lead for each side");
  }
  // The person must argue AGAINST whatever the participant just said, so the two sides must
  // differ. Identical leads would make the switch meaningless.
  ok("the two sides read differently".padEnd(30),
     (v.match(/hurtLead:/g)||[]).length===3 && (v.match(/needLead:/g)||[]).length===3,
     "3 hurt leads, 3 need leads");
  ok("no family wording in the voices".padEnd(30),
     !/\b(mother|father|sister|brother|daughter|son|parent of yours|your family)\b/i.test(v));
}
console.log("\n=== 7. PARALLEL WORLDS (the CONTEXT lens) ===");
{
  const S=fs.readFileSync(path.join(SRC,"block5Scenarios.ts"),"utf8");
  for(const n of CVR_ALL){
    const i=C.indexOf("const "+n+": ScenarioCVRContent");
    const blk=C.slice(i,C.indexOf("\n};",i));
    const par=(blk.match(/\n  parallel: \{[\s\S]*?\n  \},/)||[""])[0];
    const own=(blk.match(/\n  register: "([a-z_]+)"/)||[])[1];
    const pr=(par.match(/register: "([a-z_]+)"/)||[])[1];
    const vp=K.filter(k=>new RegExp(k+': "').test(par)).length;
    const setting=/setting:/.test(par);
    // THE RULE: the second place must be just as serious as the first place. If the registers
    // differ, a participant who answers differently may be reacting to the change in stakes
    // rather than the change of setting — that would be stakes sensitivity wearing context's name.
    ok((n+" parallel").padEnd(30), !!par && own===pr && vp===4 && setting,
       par? ("register "+own+"/"+pr+", "+vp+"/4 phrases, setting:"+setting) : "MISSING");
  }
  const seeds=[...S.matchAll(/cvrSeed: \{\s*rule: "((?:[^"\\]|\\.)*)",\s*parallelRule: "((?:[^"\\]|\\.)*)",/g)];
  ok("every option has a parallelRule".padEnd(30), seeds.length===DECIDER_OPTIONS, seeds.length+"/"+DECIDER_OPTIONS+" (recipient scenarios carry none by design)");
  const empty=seeds.filter(m=>!m[2].trim()).length;
  ok("no empty parallelRule".padEnd(30), empty===0, empty+" empty");
}

console.log("\n=== 6. VALUE PHRASES ARE SACRIFICEABLE (no self-regarding / double-negative) ===");
for(const n of CVR_SCEN){
  const i=C.indexOf("const "+n+": ScenarioCVRContent");
  const t=C.slice(i,C.indexOf("\n};",i)).replace(/\n  parallel: \{[\s\S]*?\n  \},/,"");
  const bad=K.filter(k=>{const v=t.match(new RegExp(k+': "([^"]*)"'))[1];
    return /\bleast\b/.test(v)||/could (save|give) you\b/.test(v);});
  ok((n+" value phrases").padEnd(30),bad.length===0,bad.length?"problem: "+bad.map(k=>SH[k]).join(","):"all name something that can be given up");}
console.log("\n=== 7. IDENTIFIED-VICTIM RULE: every cvrSeed case names one individual ===");
const ABSTRACT=/^(A|The|This|It|Half|After|One of)\s+(town|local|neighborhood|neighborhood|district|street|route|service|fare|queue|city|region|company|restaurant|four|plates|table|air|metal|harm|is\b)/i;
for(const id of ids){const bad=DATA[id].filter(o=>ABSTRACT.test(o.ic));
  ok(id.padEnd(30),bad.length===0,bad.length?"abstract opener: "+bad.map(x=>x.id).join(", "):"all 6 open on a person");}
console.log("\n=== 8. TRADE-OFF PANEL FIELDS PRESENT ON ALL 30 OPTIONS ===");
for(const id of ids){const missing=DATA[id].filter(o=>!o.gains||!o.givesUp||!o.moralTension).map(o=>o.id);
  ok(id.padEnd(30),missing.length===0,missing.length?"missing: "+missing.join(", "):"gains + givesUp + moralTension on all 6");}

console.log("\n=== 9. SCENE FIELDS: description / factBase / role each do ONE job ===");
{
  // Three fields, three jobs. They were previously two that overlapped: `description` restated the
  // scarcity `factBase` was meant to own, four of five scenarios carried no numbers at all, and the
  // participant's ROLE — the block's whole manipulation — sat buried mid-paragraph. These gates
  // stop that collapsing back by accident.
  const POSN = {};
  for (const m of S.matchAll(/^    id: "([a-z_]+)",\r?\n    stakePosition: "([a-z_]+)",/gm)) POSN[m[1]] = m[2];
  const field = (body, name) => {
    const k = body.indexOf(`    ${name}:`);
    if (k < 0) return null;
    const q = body.indexOf('"', k);
    let i = q + 1;
    while (i < body.length) {
      if (body[i] === "\\") { i += 2; continue; }
      if (body[i] === '"') break;
      i++;
    }
    return body.slice(q + 1, i);
  };
  const bounds = [...S.matchAll(/^    id: "([a-z_]+)",$/gm)].map((m) => ({ id: m[1], i: m.index }));
  bounds.forEach((b, k) => { b.end = k + 1 < bounds.length ? bounds[k + 1].i : S.length; });

  for (const b of bounds) {
    const body = S.slice(b.i, b.end);
    const desc = field(body, "description");
    const facts = field(body, "factBase");
    const role = field(body, "role");
    const pos = POSN[b.id];

    // The numbers belong in the situation box, never in the scene-setting paragraph.
    const descHasDigits = /\d/.test(desc ?? "");
    const factsHasDigits = /\d/.test(facts ?? "");
    ok((b.id + " — numbers live in factBase").padEnd(46),
       !descHasDigits && factsHasDigits,
       `description ${descHasDigits ? "HAS digits" : "clean"}, factBase ${factsHasDigits ? "has digits" : "HAS NO DIGITS"}`);

    // Every scenario must state who the participant is; it is the only thing that varies by design.
    ok((b.id + " — role stated").padEnd(46), !!role && role.length >= 80,
       role ? `${role.length} chars` : "MISSING");

    // The role must actually name the position it claims. "others" means the participant is
    // explicitly untouched; if that sentence is missing, the manipulation is not delivered.
    const saysUnaffected = /\bnot\b|\bnothing\b|\bnone\b|\boutside\b|\buntouched\b|\bunaffected\b/i.test(role ?? "");
    ok((b.id + " — role matches stakePosition " + pos).padEnd(46),
       pos !== "others" || saysUnaffected,
       pos === "others" ? (saysUnaffected ? "states the participant is unaffected" : "DOES NOT say the participant is unaffected") : "n/a");

    // description and factBase must not be near-duplicates of each other.
    const words = (t) => new Set((t ?? "").toLowerCase().match(/[a-z]{5,}/g) ?? []);
    const dw = words(desc), fw = words(facts);
    const shared = [...dw].filter((w) => fw.has(w));
    const overlap = dw.size ? shared.length / dw.size : 0;
    ok((b.id + " — scene and situation differ").padEnd(46), overlap < 0.30,
       `${Math.round(overlap * 100)}% of description's words reappear in factBase${shared.length ? " (" + shared.join(", ") + ")" : ""}`);
  }
}

console.log("\n=== 10. CVR CONSEQUENCES: present, concrete, readable, and balanced ===");
{
  /*
    Both lenses are built entirely from these lines. If they go missing, vague, or long-winded the
    lenses silently return to the abstract paragraphs they replaced — which participants reported
    being unable to understand.

    READABILITY IS A GATE, NOT A PREFERENCE. Participants read this in a second language. A lens
    nobody can parse measures reading ability rather than moral response, which puts a language
    confound straight into the dependent variable.

    BALANCE IS ALSO A GATE. Directness and Context are compared against each other, so if one block
    were materially longer it would also be more persuasive, and the comparison would partly
    measure length rather than framing.
  */
  const MAXWORDS = 20;
  const VAGUE = /\b(stakeholders?|externalit\w+|utili[sz]\w+|aggregat\w+|systemic|suboptimal|mitigat\w+|leverag\w+|paradigm|framework|methodolog\w+|notwithstanding|heretofore|insofar)\b/i;
  const CONCRETE = /\b(\d|two|three|four|five|six|seven|eight|nine|ten|one|month|months|week|weeks|day|days|hour|hours|year|years|night|winter|spring)\b/i;

  const blocks = [...S.matchAll(/id: "([a-z0-9_]+)",\s*\r?\n\s*cvrSeed: \{([\s\S]*?)\r?\n\s{8}\},/g)];
  ok("every option has a cvrSeed".padEnd(46), blocks.length === DECIDER_OPTIONS, blocks.length + "/" + DECIDER_OPTIONS + " blocks parsed (recipient scenarios carry none by design)");

  const missing = [], pmissing = [], longSent = [], vague = [], abstract = [], dupes = [], lopsided = [], accuses = [];
  const seen = new Map();

  for (const [, oid, body] of blocks) {
    // Read `soon`/`later` from the named sub-block, not from the first match in the seed — the
    // two sub-blocks share field names and a positional match would silently read the wrong one.
    const grab = (blockName, field) => {
      const at = body.indexOf(blockName);
      if (at < 0) return undefined;
      const m = body.slice(at).match(new RegExp(field + ': "([^"]*)"'));
      return m ? m[1] : undefined;
    };
    const soon = grab("consequences: {", "soon");
    const later = grab("consequences: {", "later");
    const psoon = grab("parallelConsequences: {", "soon");
    const plater = grab("parallelConsequences: {", "later");

    if (!soon || !later) { missing.push(oid); continue; }
    if (!psoon || !plater) { pmissing.push(oid); }

    const pairs = [["soon", soon], ["later", later]];
    if (psoon && plater) pairs.push(["p.soon", psoon], ["p.later", plater]);

    for (const [which, text] of pairs) {
      for (const sent of text.split(/(?<=[.!?])\s+/)) {
        const w = sent.trim().split(/\s+/).filter(Boolean).length;
        if (w > MAXWORDS) longSent.push(oid + "/" + which + " (" + w + "w)");
      }
      if (VAGUE.test(text)) vague.push(oid + "/" + which);
      const key = text.toLowerCase().replace(/[^a-z ]/g, "");
      if (seen.has(key)) dupes.push(oid + " = " + seen.get(key)); else seen.set(key, oid);
    }

    if (!CONCRETE.test(soon + " " + later)) abstract.push(oid);
    if (psoon && plater && !CONCRETE.test(psoon + " " + plater)) abstract.push(oid + "/parallel");

    if (psoon && plater) {
      const a = (soon + later).length, b = (psoon + plater).length;
      if (Math.abs(a - b) > Math.max(a, b) * 0.35) lopsided.push(oid + " (" + a + " vs " + b + ")");
      // The CONTEXT lens must never accuse. A "you" in it makes it a second directness lens and
      // the difference between the two measures stops meaning anything. The two scenarios where
      // the participant's own household is literally the subject are the documented exception.
      if (!oid.startsWith("fire_") && /\byou\b|\byour\b/i.test(psoon + " " + plater)) accuses.push(oid);
    }
  }

  ok("directness soon + later on all 30".padEnd(46), missing.length === 0, missing.join(", ") || "all present");
  ok("context soon + later on all 30".padEnd(46), pmissing.length === 0, pmissing.join(", ") || "all present");
  ok(("no sentence over " + MAXWORDS + " words").padEnd(46), longSent.length === 0, longSent.join("; ") || "all short");
  ok("no vague or academic vocabulary".padEnd(46), vague.length === 0, vague.join(", ") || "clean");
  ok("each pair names a number or a timescale".padEnd(46), abstract.length === 0, abstract.join(", ") || "all concrete");
  ok("no two consequences are identical".padEnd(46), dupes.length === 0, dupes.join("; ") || "all 120 distinct");
  ok("the two lenses carry equal weight".padEnd(46), lopsided.length === 0, lopsided.join("; ") || "within 35% on all 30");
  ok("the context lens never says \"you\"".padEnd(46), accuses.length === 0, accuses.join(", ") || "no accusation outside the household scenarios");
}
console.log("\n"+(fails?"### "+fails+" CHECK(S) FAILED ###":"### ALL CHECKS PASSED ###")+"\n");
process.exit(fails?1:0);

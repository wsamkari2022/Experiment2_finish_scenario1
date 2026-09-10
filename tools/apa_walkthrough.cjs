/**
 * apa_walkthrough.cjs — ONE participant, followed all the way through CVR and APA.
 *
 * WHY THIS EXISTS
 * ---------------
 * The other two APA tools answer "is the arithmetic right" (verify_apa) and "how do different
 * answers compare" (apa_personas). Neither shows the thing the study is actually built to do:
 * a person makes one choice, the system reflects it back, they say what they really meant, and
 * THE OPTIONS THEY ARE OFFERED NEXT ARE LABELED DIFFERENTLY AS A RESULT.
 *
 * That last step is the payoff and the hardest thing to convey in prose, so this prints it: the
 * same six options in scenario 2, labeled against the profile before the clarification and again
 * against the profile after it.
 *
 * Every number in the advisor deck's "one participant, step by step" slides comes from this run.
 * It reads the shipped code and changes nothing.
 *
 * Run: npm run apa:walkthrough
 */
const path=require("node:path"),fs=require("node:fs");
const BUILD=path.join(__dirname,"..",".sim-build");
fs.writeFileSync(path.join(BUILD,"package.json"),JSON.stringify({type:"commonjs"}));
const B=f=>require(path.join(BUILD,f));
const {labelOptions,applyApaUpdates,optionMainValue,violatedValue,cvrCoordinate,ALIGNMENT_LABEL,isMisaligned}=B("block5CVR.js");
const {BLOCK5_SCENARIOS}=B("block5Scenarios.js");
const {POLICY_DIM_SHORT}=B("block5Types.js");
const POLICY=["gainResponsivenessSensitivity","outcomeAggregationSensitivity","vulnerabilityProtectionSensitivity","groupSizeSensitivity"];
const STAKE="stakeholderPerspectiveShiftSensitivity";
const ALL=[...POLICY,"directnessSensitivity","contextSensitivity",STAKE];
const S={gainResponsivenessSensitivity:"how much is gained",outcomeAggregationSensitivity:"how many are helped",
 vulnerabilityProtectionSensitivity:"protecting the vulnerable",groupSizeSensitivity:"reducing harm"};
const mk=o=>({generatedAt:"",topThreeKeys:[],topSensitivityKey:"x",
 dimensions:ALL.map((k,i)=>({key:k,label:k,score:o[k]??50,rank:i+1,weight:0.1,sourceBlocks:[]}))});
const sc=(p,k)=>p.dimensions.find(d=>d.key===k).score;
const show=p=>POLICY.map(k=>S[k]+" "+Math.round(sc(p,k))).join(" | ");

const START={gainResponsivenessSensitivity:79,outcomeAggregationSensitivity:66,
 vulnerabilityProtectionSensitivity:30,groupSizeSensitivity:60,
 directnessSensitivity:50,contextSensitivity:50,[STAKE]:45};
const before=mk(START);
const s1=BLOCK5_SCENARIOS[0], s2=BLOCK5_SCENARIOS[1];

console.log("BEFORE  "+show(before));
const lab1=labelOptions(s1.options,before);
const pick=lab1.find(o=>o.level==="strongly_misaligned")||lab1.find(o=>isMisaligned(o.level));
console.log("\nSCENARIO 1:", s1.title);
lab1.forEach((o,i)=>console.log("  "+(i+1)+". "+ALIGNMENT_LABEL[o.level].padEnd(20)+o.title.slice(0,52)));
console.log("\nTHEY PICK: "+pick.title);
console.log("  label:", ALIGNMENT_LABEL[pick.level]);
console.log("  serves:", S[optionMainValue(pick)], "| sacrifices:", S[violatedValue(pick,before)]);
const coord=cvrCoordinate(pick, before, s1);
console.log("  CVR fires -> lens:", coord.framing, "| voice:", coord.who);

const after=applyApaUpdates(before,pick,"context",true,"vulnerabilityProtectionSensitivity",null,1,5);
console.log("\nAPA answers: Q1='just this situation' | Q2 names 'protecting the vulnerable' | confidence 5 | switched after the person");
console.log("AFTER   "+show(after));
console.log("\nMOVES:");
ALL.forEach(k=>{const d=Math.round(sc(after,k)-sc(before,k)); if(d) console.log("   "+(S[k]||k).padEnd(26)+Math.round(sc(before,k))+" -> "+Math.round(sc(after,k))+"  ("+(d>0?"+":"")+d+")");});

console.log("\n=== THE POINT: scenario 2 labels change ===");
const a=labelOptions(s2.options,before), b=labelOptions(s2.options,after);
console.log("\n"+s2.title);
s2.options.forEach(o=>{
  const x=a.find(z=>z.id===o.id), y=b.find(z=>z.id===o.id);
  const chg = x.level!==y.level ? "   <== CHANGED" : "";
  console.log("  "+o.title.slice(0,44).padEnd(46)+ALIGNMENT_LABEL[x.level].padEnd(20)+"->  "+ALIGNMENT_LABEL[y.level].padEnd(20)+chg);
});
console.log("\nORDER before:", a.map(o=>o.title.slice(0,18)).join(" > "));
console.log("ORDER after :", b.map(o=>o.title.slice(0,18)).join(" > "));

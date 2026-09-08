/**
 * apa_personas.cjs — six participants, one starting profile, six different sets of APA answers.
 *
 * WHY THIS EXISTS
 * ---------------
 * The APA rule can be stated in a sentence ("+30 to the value you name, -20 to the incumbent,
 * scaled 0.6-1.0 by confidence"), and that sentence is true of the code read in isolation. It is
 * NOT a complete account of what a participant experiences, because Q1 and Q2 can land on the same
 * value and add together, and the 0-100 clamp then hides the excess.
 *
 * This script makes that visible. Every persona below starts from the SAME profile, so every
 * difference in the output is caused purely by the answers they gave. It reads the shipped code
 * and changes nothing.
 *
 * READ THE FINDINGS IN: docs/BLOCK5_APA_AUDIT.md
 * SEE ALSO: tools/verify_apa.cjs, which asserts the arithmetic rather than displaying it.
 *
 * Run: npm run apa:personas
 */
const path=require("node:path"),fs=require("node:fs");
const BUILD=path.join(__dirname,"..",".sim-build");
fs.writeFileSync(path.join(BUILD,"package.json"),JSON.stringify({type:"commonjs"}));
const B=f=>require(path.join(BUILD,f));
const {applyApaUpdates,optionMainValue,violatedValue,labelOptions}=B("block5CVR.js");
const {BLOCK5_SCENARIOS}=B("block5Scenarios.js");
const {POLICY_DIM_SHORT}=B("block5Types.js");
const POLICY=["gainResponsivenessSensitivity","outcomeAggregationSensitivity","vulnerabilityProtectionSensitivity","groupSizeSensitivity"];
const STAKE="stakeholderPerspectiveShiftSensitivity";
const ALL=[...POLICY,"directnessSensitivity","contextSensitivity",STAKE];
const SHORT={gainResponsivenessSensitivity:"gained",outcomeAggregationSensitivity:"helped",
  vulnerabilityProtectionSensitivity:"vulnerable",groupSizeSensitivity:"harm",
  directnessSensitivity:"direct",contextSensitivity:"context",[STAKE]:"stake"};
const mk=o=>({generatedAt:"",topThreeKeys:[],topSensitivityKey:"x",
  dimensions:ALL.map((k,i)=>({key:k,label:k,score:o[k]??50,rank:i+1,weight:0.1,sourceBlocks:[]}))});
const sc=(p,k)=>p.dimensions.find(d=>d.key===k).score;
const order=p=>[...POLICY].sort((a,b)=>sc(p,b)-sc(p,a)).map(k=>SHORT[k]).join(" > ");

// ONE shared starting profile, so every difference below comes only from the ANSWERS.
const START={gainResponsivenessSensitivity:79,outcomeAggregationSensitivity:66,
  vulnerabilityProtectionSensitivity:30,groupSizeSensitivity:60,
  directnessSensitivity:50,contextSensitivity:50,[STAKE]:45};

const s1=BLOCK5_SCENARIOS[0];
const labeled=labelOptions(s1.options,mk(START));
const OPT=labeled.find(o=>o.level==="misaligned"||o.level==="strongly_misaligned");
const served=optionMainValue(OPT), sacrificed=violatedValue(OPT,mk(START));

console.log("\nSTART (identical for everyone):", POLICY.map(k=>SHORT[k]+" "+START[k]).join("  "));
console.log("order:", order(mk(START)));
console.log("option they picked:", JSON.stringify(OPT.title));
console.log("   it serves:", POLICY_DIM_SHORT[served], "| it sacrifices:", POLICY_DIM_SHORT[sacrificed]);

const USERS=[
 ["A  endorse · sure 5 · names 'vulnerable' · switched after person · Context lens",
  {q1:"endorse",conf:5,prior:"vulnerabilityProtectionSensitivity",moved:true,lens:"contextSensitivity"}],
 ["B  endorse · not sure 1 · names 'gained' (already top) · not moved",
  {q1:"endorse",conf:1,prior:"gainResponsivenessSensitivity",moved:false,lens:null}],
 ["C  just-this-time · sure 5 · names 'harm' · switched",
  {q1:"context",conf:5,prior:"groupSizeSensitivity",moved:true,lens:null}],
 ["D  not sure · mid 3 · names 'helped' · not moved",
  {q1:"unsure",conf:3,prior:"outcomeAggregationSensitivity",moved:false,lens:null}],
 ["E  not sure · sure 5 · names 'vulnerable' (their lowest) · switched · Directness lens",
  {q1:"unsure",conf:5,prior:"vulnerabilityProtectionSensitivity",moved:true,lens:"directnessSensitivity"}],
 ["F  just-this-time · not sure 1 · names 'vulnerable' · not moved",
  {q1:"context",conf:1,prior:"vulnerabilityProtectionSensitivity",moved:false,lens:null}],
];

for(const [name,u] of USERS){
  const before=mk(START);
  const fa=u.lens?{sensitivityKey:u.lens,delta:20}:null;
  const after=applyApaUpdates(before,OPT,u.q1,u.moved,u.prior,fa,1,u.conf);
  const chg=ALL.map(k=>{const d=Math.round(sc(after,k)-sc(before,k));
    return d===0?null:SHORT[k]+" "+Math.round(sc(before,k))+"->"+Math.round(sc(after,k))+" ("+(d>0?"+":"")+d+")";}).filter(Boolean);
  console.log("\n"+name);
  console.log("   moves : "+chg.join("  ·  "));
  console.log("   order : "+order(after)+(order(after)!==order(mk(START))?"    <-- ORDER CHANGED":"    (order unchanged)"));
}

/**
 * apa_personas.cjs — six participants, one starting profile, six different sets of APA answers.
 *
 * WHY THIS EXISTS
 * ---------------
 * The APA rule can be stated in a sentence — "+30 to the value you name, -10 to each of the other
 * three, scaled 0.6-1.0 by confidence" — and that sentence is true of the code read in isolation.
 * It is not a complete account of what a participant experiences, because the 0-100 clamp can
 * swallow part of a move and the stakeholder bump lands on top of it.
 *
 * WHAT IT ORIGINALLY EXISTED TO SHOW, and no longer can: the page used to ask TWO questions that
 * moved the profile, and both could land on the same value and add, with the clamp hiding the
 * excess. The first question was removed on 17 September 2026 and that collision cannot happen any
 * more — A-APA-8 in verify_apa.cjs is what stands guard in case a second bump is ever added back.
 *
 * It still earns its place: every persona below starts from the SAME profile, so every difference
 * in the output is caused purely by the answers they gave. It reads the shipped code and changes
 * nothing.
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

/*
 * SIX PEOPLE, TOLD APART BY THE THREE THINGS THE PAGE STILL ASKS.
 *
 * They used to be told apart by four. The first APA question — endorse / just-this-time / not sure
 * — was removed on 17 September 2026 with the trade it rested on, so the personas that differed
 * ONLY in that answer are now the same person. The set below was rebuilt around what is left:
 * which value they name, how sure they are, whether the stakeholder moved them, and which lens.
 */
const USERS=[
 ["A  sure 5 · names 'vulnerable' (their lowest) · switched after person · Context lens",
  {conf:5,prior:"vulnerabilityProtectionSensitivity",moved:true,lens:"contextSensitivity"}],
 ["B  not sure 1 · names 'gained' (already top) · not moved",
  {conf:1,prior:"gainResponsivenessSensitivity",moved:false,lens:null}],
 ["C  sure 5 · names 'harm' · switched",
  {conf:5,prior:"groupSizeSensitivity",moved:true,lens:null}],
 ["D  mid 3 · names 'helped' · not moved",
  {conf:3,prior:"outcomeAggregationSensitivity",moved:false,lens:null}],
 ["E  sure 5 · names 'vulnerable' · switched · Directness lens",
  {conf:5,prior:"vulnerabilityProtectionSensitivity",moved:true,lens:"directnessSensitivity"}],
 ["F  not sure 1 · names 'vulnerable' · not moved",
  {conf:1,prior:"vulnerabilityProtectionSensitivity",moved:false,lens:null}],
];

for(const [name,u] of USERS){
  const before=mk(START);
  const fa=u.lens?{sensitivityKey:u.lens,delta:20}:null;
  const after=applyApaUpdates(before, u.moved, u.prior, fa, 1, u.conf);
  const chg=ALL.map(k=>{const d=Math.round(sc(after,k)-sc(before,k));
    return d===0?null:SHORT[k]+" "+Math.round(sc(before,k))+"->"+Math.round(sc(after,k))+" ("+(d>0?"+":"")+d+")";}).filter(Boolean);
  console.log("\n"+name);
  console.log("   moves : "+chg.join("  ·  "));
  console.log("   order : "+order(after)+(order(after)!==order(mk(START))?"    <-- ORDER CHANGED":"    (order unchanged)"));
}

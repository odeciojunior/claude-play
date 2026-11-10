// versions.mjs: skill version per run. node versions.mjs <runs.json>   (EXCLUDE=<session prefixes> to leave sessions out)
if(!process.argv[2]){console.error("usage: node versions.mjs <runs.json>");process.exit(2)}
import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(process.argv[2])).filter(x=>["roadmap-planner","roadmap-tracker","roadmap-release","plan-coordinator"].includes(x.skill)&&!(process.env.EXCLUDE||"").split(",").filter(Boolean).includes(x.session));
const c={};
for(const x of r){let b=(x.skillBase||"?").split(String.fromCharCode(92)).join("/");
 let m=b.match(/productivity-tools\/(\d+\.\d+\.\d+)\//);let k=m?"installed "+m[1]:b.includes("scratchpad/")?"sandbox copy":/claude-play-wt/.test(b)?"worktree "+b.replace(/.*claude-play-wt\//,"").split("/")[0]:/claude-play\//.test(b)?"repo checkout":b.slice(0,40);
 if(x.skill==="roadmap-release"&&x.wfScripts?.length)k+=" | wf:"+x.wfScripts.join(",");
 const kk=x.skill+" :: "+k;(c[kk]??={n:0,d:[]}).n++;c[kk].d.push(x.date)}
for(const [k,v] of Object.entries(c).sort()){v.d.sort();console.log(k,v.n,v.d[0],v.d.at(-1))}

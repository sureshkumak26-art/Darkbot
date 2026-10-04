const fs=require('fs');
const path=require('path');
const {EmbedBuilder}=require('discord.js');
const stateFile=path.join(__dirname,'monitor-state.json');
let state={};
try{state=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch{}
function save(){fs.writeFileSync(stateFile,JSON.stringify(state,null,2));}
async function fetchPage(url){
 const r=await fetch(url,{headers:{'User-Agent':'DarkMarket-PublicStockMonitor/1.0'},redirect:'follow'});
 if(!r.ok)throw new Error('HTTP '+r.status);
 return r.text();
}
function detectStock(html,p){
 const low=html.toLowerCase();
 const name=p.name.toLowerCase();
 const id=p.id.toLowerCase();
 const pos=Math.max(low.indexOf(name),low.indexOf(id));
 if(pos<0)return null;
 const area=low.slice(Math.max(0,pos-800),Math.min(low.length,pos+2000));
 if(/out\s*of\s*stock|sold\s*out|unavailable|0\s*(?:in\s*)?stock/.test(area))return 0;
 const m=area.match(/(?:stock|available|quantity|qty)\D{0,40}(\d{1,5})/);
 if(m)return Number(m[1]);
 if(/in\s*stock|available|add\s*to\s*(?:cart|basket)|buy\s*now/.test(area))return 1;
 return null;
}
function restockEmbed(p,previous,current){
 return new EmbedBuilder().setColor(0x22c55e).setTitle('🔄 PRODUCT RESTORED').setDescription('**'+p.name+'** is back in stock.\n\n🆔 Product ID: `'+p.id+'`\n📦 Previous stock: **'+previous+'**\n🟢 Current stock: **'+current+'**\n💰 Price: **'+p.price+'**').setFooter({text:'Dark Market • Automatic Public Stock Monitor'}).setTimestamp();
}
async function checkOnce({products,config,client}){
 if(!config.monitorEnabled)return 0;
 const html=await fetchPage(config.monitorUrl);
 let restored=0;
 for(const p of products){
  const detected=detectStock(html,p);
  if(detected===null)continue;
  const previous=state[p.id];
  state[p.id]=detected;
  if(previous===0&&detected>0){
   p.stock=detected;
   if(config.restockAnnounceChannelId){
    const ch=await client.channels.fetch(config.restockAnnounceChannelId).catch(()=>null);
    if(ch&&ch.isTextBased())await ch.send({embeds:[restockEmbed(p,previous,detected)]});
   }
   restored++;
  }
 }
 save();
 return restored;
}
function startMonitor(args){
 if(!args.config.monitorEnabled){console.log('ℹ️ Public stock monitor disabled.');return;}
 const ms=Math.max(60,args.config.monitorIntervalSeconds)*1000;
 console.log('🔎 Public stock monitor: '+args.config.monitorUrl);
 console.log('⏱️ Checking every '+Math.round(ms/1000)+' seconds');
 const run=()=>checkOnce(args).then(n=>{if(n)console.log('🔄 '+n+' product(s) restored.');}).catch(e=>console.error('⚠️ Stock monitor:',e.message));
 run();
 setInterval(run,ms);
}
module.exports={startMonitor,checkOnce};
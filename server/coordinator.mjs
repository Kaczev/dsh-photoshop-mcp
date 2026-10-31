// One coordinator per server, shared by every guarded tool.
export function createCoordinator({timeoutMs=20000}={}) {
  const pending=new Map(); let sequence=0, uncertain=false;
  return {
    status(){return {queueBusy:pending.size>0||uncertain,pending:[...pending.values()].map(p=>({id:p.id,tool:p.tool,startedAt:p.startedAt})),uncertain};},
    async run(tool,invoke,{probe=false,timeout=timeoutMs}={}){
      if(pending.size || (uncertain&&!probe))return {blocked:true,...this.status()};
      const id=++sequence, entry={id,tool,startedAt:new Date().toISOString()}; pending.set(id,entry);
      let timer,expired=false;
      const work=Promise.resolve().then(invoke).then(value=>({value}),error=>({error})).then(result=>{pending.delete(id);if(expired)uncertain=true;return result;});
      const result=await Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>{expired=true;uncertain=true;resolve({timedOut:true});},timeout);})]);
      clearTimeout(timer);
      if(result.error&&/timeout|timed out/i.test(String(result.error.message)))uncertain=true;
      if(result.value&&/extendscript_timeout|Script execution timeout/.test(JSON.stringify(result.value)))uncertain=true;
      if(tool==='photoshop_ping'&&!result.timedOut&&!result.error&&!result.value?.isError&&!/"ok":false/.test(JSON.stringify(result.value)))uncertain=false;
      return {...result,...this.status()};
    }
  };
}

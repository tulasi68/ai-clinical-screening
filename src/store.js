//src/store.js
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(process.env.DATA_DIR || './data');
const sessions=path.join(root,'sessions');
const outputs=path.join(root,'outputs');
await fs.mkdir(sessions,{recursive:true}); await fs.mkdir(outputs,{recursive:true});
const id=()=>`SCR-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
async function writeJson(file,obj){await fs.writeFile(file,JSON.stringify(obj,null,2),'utf8');}
async function readJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function createSession(input){
  const screening_id=id();
  const session={screening_id,status:'in_progress',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),patient:{patient_name:input.patient_name,age:input.age,gender:input.gender,complaint:input.complaint,phone:input.phone},conversation:[],question_count:0,last_inbound_message_id:null};
  await writeJson(path.join(sessions,`${screening_id}.json`),session); return session;
}
export async function getSession(id){return readJson(path.join(sessions,`${id}.json`));}
export async function saveSession(s){s.updated_at=new Date().toISOString();await writeJson(path.join(sessions,`${s.screening_id}.json`),s);return s;}
export async function findActiveByPhone(phone){
  const files=await fs.readdir(sessions); const target=String(phone||'').replace(/\D/g,'');
  for(const f of files.filter(x=>x.endsWith('.json'))){const s=await readJson(path.join(sessions,f)); if(s?.status==='in_progress' && String(s.patient?.phone||'').replace(/\D/g,'')===target)return s;}
  return null;
}
export async function saveOutput(id,obj){await writeJson(path.join(outputs,`${id}.json`),obj);}
export async function getOutput(id){return readJson(path.join(outputs,`${id}.json`));}

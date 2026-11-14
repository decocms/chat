import * as z from "zod/mini";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
const PRODUCTION_FIRE_API = "https://openrouter.ai/api/v1/chat/completions";
const Config = z.object({ DEV_EMAIL:z.optional(z.string()), FIRE_API:z.optional(z.string()) });
export type FireProvider = {kind:"production";url:typeof PRODUCTION_FIRE_API}|{kind:"local-fixture";url:string;baseURL:string};
/** Server-owned configuration, never a request field. Invalid overrides cannot
 * fall back to the public provider or carry production credentials. */
export function fireProvider(input:unknown):FireProvider {
  const parsed=Config.safeParse(input);
  if(!parsed.success)throw Error("Invalid Fire provider configuration");
  const {DEV_EMAIL,FIRE_API}=parsed.data;
  if(FIRE_API===undefined)return{kind:"production",url:PRODUCTION_FIRE_API};
  const port=/^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/api\/v1\/chat\/completions$/.exec(FIRE_API)?.[1];
  if(!DEV_EMAIL?.trim()||!port||Number(port)>65535)throw Error("Invalid Fire provider configuration");
  return{kind:"local-fixture",url:FIRE_API,baseURL:`http://127.0.0.1:${port}/api/v1`};
}
const MAX_FIXTURE_BODY=256*1024;
async function boundedBody(request:Request){
  const reader=request.body?.getReader();if(!reader)throw Error("Invalid Fire fixture request");
  const decoder=new TextDecoder("utf-8",{fatal:true});let bytes=0,text="";
  try{while(true){const part=await reader.read();if(part.done)break;if(!(part.value instanceof Uint8Array)||(bytes+=part.value.byteLength)>MAX_FIXTURE_BODY)throw Error("Invalid Fire fixture request");text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();return text;}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** The Proxy retains the platform fetch callable/property contract (including
 * Bun's optional preconnect property) while routing every SDK call through the
 * exact endpoint/credential/redirect boundary. No canonical API is mocked. */
export function fireFixtureTransport(provider:FireProvider,fetcher:typeof fetch=fetch):typeof fetch {
  if(provider.kind==="production")return fetcher;
  const endpoint=provider.url;
  const invoke=async(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1]):Promise<Response>=>{
    const rawURL=typeof input==="string"?input:input instanceof URL?input.href:input instanceof Request?input.url:null;
    if(rawURL!==endpoint)throw Error("Invalid Fire fixture request");
    const request=new Request(input,init);
    if(request.url!==endpoint||request.method!=="POST"||request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")throw Error("Invalid Fire fixture request");
    const body=await boundedBody(request);
    // The SDK needs a nonempty inert key to construct its headers. None of its
    // auth/cookie/custom headers may leave this local-only transport.
    return fetcher(endpoint,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body,signal:request.signal,redirect:"manual",credentials:"omit"});
  };
  return new Proxy(fetcher,{apply(_target,_owner,args){return Reflect.apply(invoke,undefined,args);}});
}
export function createFireModelProvider(provider:FireProvider,apiKey:string|undefined,fetcher:typeof fetch=fetch){
  if(provider.kind==="production")return createOpenRouter({apiKey});
  return createOpenRouter({apiKey:"vibebook-inert-local-fire-fixture",baseURL:provider.baseURL,fetch:fireFixtureTransport(provider,fetcher)});
}

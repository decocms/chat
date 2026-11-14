import { client } from "../../lib/client/api";
import type { FetchLike } from "../../transport";
import { FireResult, SttResult, ErrorBody, UNAUTHENTICATED } from "../../../shared/schemas";
export class FireFailure extends Error {
  constructor(readonly status:number,readonly unauthenticated=false,readonly membershipDenied=false){super("Fire request failed");}
}
type FireResponse={ok:boolean;status:number;json():Promise<unknown>};
async function body(response:FireResponse){
  const raw:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const error=ErrorBody.safeParse(raw);
    throw new FireFailure(response.status,response.status===401&&error.success&&error.data.error===UNAUTHENTICATED.error,
      response.status===403&&error.success&&error.data.error==="forbidden");
  }
  return raw;
}
export function createFireApi(fetcher?:FetchLike){
  const api=client("/",fetcher).api.books[":id"];
  return {
    async set(roomId:string,on:boolean,signal:AbortSignal){
      const response=await api.fire.$post({param:{id:encodeURIComponent(roomId)},json:{on}},{init:{signal,cache:"no-store"}});
      try{FireResult.parse(await body(response));}catch(error){if(error instanceof FireFailure)throw error;throw new FireFailure(0);}
    },
    async transcribe(roomId:string,audio:Blob,query:{lang:string;prompt:string},signal:AbortSignal){
      const response=await api.stt.$post({param:{id:encodeURIComponent(roomId)},query},
        {init:{signal,cache:"no-store",body:audio,headers:{"content-type":audio.type||"audio/webm"}}});
      try{return SttResult.parse(await body(response)).text;}catch(error){if(error instanceof FireFailure)throw error;throw new FireFailure(0);}
    },
  };
}

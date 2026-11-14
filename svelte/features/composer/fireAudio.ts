/** One owned microphone capture. Recorder callbacks are detached before tracks
 * stop so late browser events cannot deliver a released utterance. */
export type FireCapture = {
  readonly type: string;
  start(chunk: (data: Blob) => void, ended: () => void, failed:()=>void): void;
  stop(): void;
  dispose(): void;
};
export type FireCaptureFactory = () => Promise<FireCapture>;
export function browserFireCapture(scope: Window & typeof globalThis): FireCaptureFactory | undefined {
  if (!scope.navigator.mediaDevices?.getUserMedia || typeof scope.MediaRecorder !== "function") return;
  return async () => {
    const stream = await scope.navigator.mediaDevices.getUserMedia({audio:true});
    let recorder: MediaRecorder;
    try { recorder = new scope.MediaRecorder(stream); }
    catch(error) { for(const track of stream.getTracks()) track.stop(); throw error; }
    let disposed = false;
    return {
      get type(){return recorder.mimeType || "audio/webm";},
      start(chunk,ended,failed){
        if(disposed) throw Error("Released audio capture");
        recorder.ondataavailable = event => { if(!disposed && event.data.size) chunk(event.data); };
        recorder.onstop = () => {if(!disposed) ended();};
        recorder.onerror=()=>{if(!disposed)failed();};
        // Periodic chunks let the controller enforce the server audio cap
        // while the key is still held, instead of buffering until release.
        recorder.start(1000);
      },
      stop(){if(!disposed && recorder.state !== "inactive") recorder.stop();},
      dispose(){
        if(disposed) return;
        disposed=true;
        recorder.ondataavailable=null; recorder.onstop=null; recorder.onerror=null;
        try{if(recorder.state!=="inactive")recorder.stop();}finally{for(const track of stream.getTracks())track.stop();}
      },
    };
  };
}

# Runs a real Claude Code in a pseudo-terminal and records its screen. Args: <repo> <settings> <out.txt> <answer_locally 0|1>
import pty,os,time,sys,select,re,fcntl,termios,struct
repo,settings,out,local=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]=="1"
pid,fd=pty.fork()
if pid==0:
    os.chdir(repo); os.execvp("claude",["claude","--model","haiku","--settings",settings])
fcntl.ioctl(fd,termios.TIOCSWINSZ,struct.pack("HHHH",40,140,0,0))
buf=b""
def pump(t):
    global buf
    end=time.time()+t
    while time.time()<end:
        r,_,_=select.select([fd],[],[],0.2)
        if r:
            try: buf+=os.read(fd,65536)
            except OSError: return
def screen(n=4000): return re.sub(r'\x1b\[[0-9;?>]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[=>78]','',buf[-n:].decode('utf8','replace'))
pump(6)
if "trust" in screen(): os.write(fd,b"\x1b[B"); pump(1); os.write(fd,b"\r"); pump(4)
os.write(fd,"Use a ferramenta AskUserQuestion agora para me perguntar 'Qual vai ser o código do cupom?' (header 'Código') com as opções BLACK15 e LOJA15. Depois responda só com o código escolhido.".encode())
pump(1); os.write(fd,b"\r")
t0=time.time(); shown=None
while time.time()-t0<120:
    pump(1); s=screen()
    if shown is None and "LOJA15" in s and "Typesomething" in s.replace(" ",""):
        shown=time.time(); open(out+".dialog.txt","w").write(s); open(out+".dialog.raw","wb").write(buf); print("dialog shown", round(shown-t0,1), flush=True)
    if local and shown and time.time()-shown>8: os.write(fd,b"\r"); local=False; print("answered locally", flush=True)
    m=re.search(r"Qual vai ser o c.digo do cupom\?\s*→\s*(\S+)",s)
    if m: print("answered:",m.group(1), flush=True); pump(6); break
open(out,"w").write(screen(8000)); open(out+".raw","wb").write(buf)
os.kill(pid,9)

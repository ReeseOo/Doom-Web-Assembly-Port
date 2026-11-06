import struct,sys
d=open('assets/doom1.wad','rb').read()
n,o=struct.unpack('<ii',d[4:12])
L=[(struct.unpack('<ii8s',d[o+16*i:o+16*i+16])) for i in range(n)]
i=[k for k,l in enumerate(L) if l[2].rstrip(b'\0')==b'E1M1'][0]
def lump(nm):
    for p,s,name in L[i+1:i+11]:
        if name.rstrip(b'\0').decode()==nm: return d[p:p+s]
th=lump('THINGS')
names={1:'player',3004:'zombieman',9:'sergeant',3001:'imp',3002:'demon'}
print(len(th)//10,'things')
for k in range(len(th)//10):
    x,y,a,t,f=struct.unpack('<hhhhh',th[k*10:k*10+10])
    if t in names or t==1: print(names.get(t,t),x,y,a,'flags',hex(f), 'skill:', 'easy' if f&1 else '', 'med' if f&2 else '', 'hard' if f&4 else '', 'MP' if f&16 else '')
V=lump('VERTEXES');vs=[struct.unpack('<hh',V[j*4:j*4+4]) for j in range(len(V)//4)]
LD=lump('LINEDEFS');SD=lump('SIDEDEFS')
print('doors:')
for j in range(len(LD)//14):
    a,b,fl,sp,tag,r,l=struct.unpack('<hhhhhhh',LD[j*14:j*14+14])
    if sp in (1,26,27,28,31,32,33,34,117,118,2,46,63): print(j,sp,vs[a],vs[b],'flags',hex(fl))
try:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    f,ax=plt.subplots(figsize=(14,10))
    for j in range(len(LD)//14):
        a,b,fl,sp,tag,r,l=struct.unpack('<hhhhhhh',LD[j*14:j*14+14])
        c='r' if fl&1 else 'gray'
        if sp in (1,26,27,28,31,32,33,34,117,118): c='lime'
        ax.plot([vs[a][0],vs[b][0]],[vs[a][1],vs[b][1]],c,lw=1)
    for k in range(len(th)//10):
        x,y,a,t,fl=struct.unpack('<hhhhh',th[k*10:k*10+10])
        if t==1: ax.plot(x,y,'bo')
        if t in names and fl&2: ax.plot(x,y,'m^')
    ax.set_aspect('equal'); ax.grid(True); f.savefig('artifacts/runs/20261103T051033Z-audio-c5ca21/qa/user-gameplay-investigation/e1m1-map-offline.png',dpi=80)
    print('plotted')
except Exception as e: print(e)

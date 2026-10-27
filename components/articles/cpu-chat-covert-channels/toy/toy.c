// Within-one-process toy contention channel. Three threads that all belong to this
// program: a sender, a receiver, and a noise thread. All are pinned to ONE logical
// CPU, so "the channel" is only the OS scheduler sharing that CPU between them.
// Nothing here touches another process, VM or tenant. Build: gcc -O2 -pthread toy.c -o toy
#define _GNU_SOURCE
#include <pthread.h>
#include <sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>
#include <stdint.h>

static int CPU = 3, NB, SLOT_US;
static double NOISE;
static volatile int stop_noise;
static uint8_t *tx, *rxbit;
static double *score;
static int64_t T0;

static int64_t now(void){ struct timespec t; clock_gettime(CLOCK_MONOTONIC,&t); return t.tv_sec*1000000000LL+t.tv_nsec; }
static void pin(void){ cpu_set_t s; CPU_ZERO(&s); CPU_SET(CPU,&s); sched_setaffinity(0,sizeof s,&s); }

static void *sender(void *a){ pin();
  for(int i=0;i<NB;i++){ int64_t end=T0+(int64_t)(i+1)*SLOT_US*1000LL;
    if(tx[i]){ while(now()<end); }
    else { struct timespec t={end/1000000000LL,end%1000000000LL}; clock_nanosleep(CLOCK_MONOTONIC,TIMER_ABSTIME,&t,0); } }
  return 0; }

static void *receiver(void *a){ pin();
  for(int i=0;i<NB;i++){ int64_t end=T0+(int64_t)(i+1)*SLOT_US*1000LL; double c=0;
    while(now()<end) c++;               // iterations completed in the slot = CPU share received
    score[i]=c; }
  return 0; }

static void *noise(void *a){ pin(); unsigned s=12345;
  while(!stop_noise){ int64_t end=now()+500000;           // 500 us windows
    if((rand_r(&s)/(double)RAND_MAX)<NOISE){ while(now()<end); }
    else { struct timespec t={0,500000}; nanosleep(&t,0); } }
  return 0; }

static int cmp(const void*a,const void*b){ double x=*(double*)a,y=*(double*)b; return (x>y)-(x<y); }
static double H(double p){ if(p<=0||p>=1) return 0; return -p*log2(p)-(1-p)*log2(1-p); }

int main(int argc,char**argv){
  SLOT_US=atoi(argv[1]); NOISE=atof(argv[2]); NB=atoi(argv[3]); unsigned seed=argc>4?atoi(argv[4]):1;
  tx=malloc(NB); rxbit=malloc(NB); score=malloc(NB*sizeof(double));
  srand(seed); for(int i=0;i<NB;i++) tx[i]=rand()&1;
  pthread_t a,b,n; stop_noise=0;
  if(NOISE>0) pthread_create(&n,0,noise,0);
  T0=now()+20000000LL;
  pthread_create(&a,0,sender,0); pthread_create(&b,0,receiver,0);
  pthread_join(a,0); pthread_join(b,0); stop_noise=1; if(NOISE>0) pthread_join(n,0);
  // decode: threshold = midpoint of the two class means (a pilot-style calibration from the known
  // first 32 bits, so the decoder never uses the later payload)
  double s0=0,s1=0; int n0=0,n1=0; for(int i=0;i<32&&i<NB;i++){ if(tx[i]){s1+=score[i];n1++;} else {s0+=score[i];n0++;} }
  double thr=(s0/n0+s1/n1)/2; int err=0;
  for(int i=32;i<NB;i++){ rxbit[i]= score[i]<thr; if(rxbit[i]!=tx[i]) err++; }
  int m=NB-32; double p=(double)err/m; double rate=1e6/SLOT_US;
  double cap=rate*(1-H(p>0.5?1-p:p));   // binary symmetric channel capacity, bits/s
  printf("%d,%.2f,%d,%.4f,%.1f,%.1f,%.0f,%.0f\n",SLOT_US,NOISE,seed,p,rate,cap,s0/n0,s1/n1);
  return 0; }

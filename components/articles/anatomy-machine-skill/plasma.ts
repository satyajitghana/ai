// The shader chamber's plasma, as Anatomy's references/webgl.md lays it out:
// a canvas between the back SVG and the front SVG, in the figure's own camera.
// GLSL_ISO below is the head of kit/gl.mjs (lines 1-28, MIT) trimmed to what
// this effect uses: project() is the kit's iso() written in GLSL, so the arc
// lands between the electrodes the SVG draws. The context options and the 1.5
// device-ratio cap are glLayer's (kit/gl.mjs:64-105).
//
// The arc is a column between two world points. In an orthographic camera,
// screen distance divided by uK is the true distance from a pixel's ray to a
// world point (webgl.md section 4), so the glow is sized in world units.
// Light theme: ink on paper, solved from the colour the paper should show
// (webgl.md section 8.1, inkFor). Dark theme: premultiplied, screen-blended.

import type { Projection } from "./iso-kit"

const GLSL_ISO = `precision highp float;
uniform vec2 uCanvas;
uniform vec2 uView;
uniform vec2 uOrigin;
uniform float uK;
uniform vec4 uCam;
uniform float uTime;
vec2 viewOf(vec2 frag){return vec2(frag.x,uCanvas.y-frag.y)*(uView.x/uCanvas.x);}
vec2 project(vec3 p){return uOrigin+uK*vec2(p.x*uCam.x-p.y*uCam.y,(p.x*uCam.y+p.y*uCam.x)*uCam.z-p.z*uCam.w);}
float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise2(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),f.x),mix(hash12(i+vec2(0.,1.)),hash12(i+vec2(1.,1.)),f.x),f.y);}
float window(float x,float a,float b,float soft){return smoothstep(a-soft,a+soft,x)*(1.-smoothstep(b-soft,b+soft,x));}
vec3 tonemap(vec3 c,float exposure){return 1.-exp(-c*exposure);}
`

const FRAGMENT = `
uniform vec3 uA;
uniform vec3 uB;
uniform float uOn;
uniform float uDark;
vec4 inkFor(vec3 seen,float cover){
  vec3 absorbed=1.-seen;
  float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);
  return vec4(vec3(a)-absorbed,a);
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec2 a=project(uA);
  vec2 b=project(uB);
  vec2 axis=b-a;
  float len=length(axis);
  vec2 dir=axis/len;
  vec2 rel=vb-a;
  float s=dot(rel,dir)/len;
  float v=dot(rel,vec2(-dir.y,dir.x))/uK;
  float ends=window(s,0.,1.,.06);
  float t=uTime;
  float core=0.;
  for(int i=0;i<3;i++){
    float fi=float(i);
    float off=(noise2(vec2(s*3.1+fi*7.3,t*1.7+fi*3.1))-.5)*3.2*sin(3.14159*clamp(s,0.,1.));
    float w=.32+.12*noise2(vec2(s*5.+fi,t*2.3));
    core+=exp(-pow((v-off)/w,2.));
  }
  float body=exp(-pow(v/2.6,2.))*(.55+.45*noise2(vec2(s*4.,t*1.1)));
  float rim=exp(-pow(v/5.5,2.))*.25;
  float tip=exp(-pow(length(vb-a)/uK/1.6,2.))+exp(-pow(length(vb-b)/uK/1.6,2.));
  float e=uOn*(ends*(core*.9+body*.55+rim)+tip*.5*uOn);
  float dither=(hash12(gl_FragCoord.xy+t)-.5)/255.;
  if(uDark>.5){
    vec3 hot=vec3(1.,.85,1.)*core*.9+vec3(.78,.32,1.)*body+vec3(.45,.2,.95)*rim+vec3(.9,.6,1.)*tip*.5;
    vec3 c=tonemap(hot*uOn*ends+vec3(.9,.6,1.)*tip*.4*uOn,1.5)+dither;
    float al=max(c.r,max(c.g,c.b));
    gl_FragColor=vec4(c,al);
  } else {
    float bodyAmt=clamp(e*.9,0.,1.);
    vec3 seen=mix(vec3(1.),vec3(.52,.16,.86),bodyAmt);
    float coreAmt=clamp(core*ends*uOn*.8,0.,1.);
    seen=mix(seen,vec3(.98,.84,1.),coreAmt*.85);
    vec4 ink=inkFor(clamp(seen,0.,1.),coreAmt*.8);
    gl_FragColor=ink+vec4(dither);
  }
}
`

const VERTEX = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`

export interface PlasmaLayer {
  draw: (time: number, on: number) => void
  dispose: () => void
}

// box: the effect's screen bounds in viewBox units [x0, y0, x1, y1]. Every term
// has fallen to ~0 well inside it, so drawing only there (a scissor) is an
// optimisation, not a cut: the canvas covers the whole bench, the arc about a
// fortieth of it.
export function plasmaLayer(
  canvas: HTMLCanvasElement,
  P: Projection,
  view: [number, number],
  from: [number, number, number],
  to: [number, number, number],
  box: [number, number, number, number],
): PlasmaLayer | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false })
  if (!gl) return null
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader))
      return null
    }
    return shader
  }
  const vs = compile(gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl.FRAGMENT_SHADER, GLSL_ISO + FRAGMENT)
  if (!vs || !fs) return null
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const where = gl.getAttribLocation(program, "p")
  gl.enableVertexAttribArray(where)
  gl.vertexAttribPointer(where, 2, gl.FLOAT, false, 0, 0)
  const u = (name: string) => gl.getUniformLocation(program, name)
  const a = ((P.azimuth ?? 45) * Math.PI) / 180
  const e = ((P.elevation ?? 30) * Math.PI) / 180
  gl.uniform2f(u("uView"), view[0], view[1])
  gl.uniform2f(u("uOrigin"), P.origin[0], P.origin[1])
  gl.uniform1f(u("uK"), P.scale * Math.sqrt(1.6))
  gl.uniform4f(u("uCam"), Math.sin(a), Math.cos(a), Math.sin(e), Math.cos(e))
  gl.uniform3f(u("uA"), ...from)
  gl.uniform3f(u("uB"), ...to)
  const uCanvas = u("uCanvas")
  const uTime = u("uTime")
  const uOn = u("uOn")
  const uDark = u("uDark")
  gl.disable(gl.DEPTH_TEST)
  gl.clearColor(0, 0, 0, 0)

  const draw = (time: number, on: number) => {
    const ratio = Math.min(1.5, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(canvas.clientWidth * ratio))
    const h = Math.max(1, Math.round(canvas.clientHeight * ratio))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    gl.disable(gl.SCISSOR_TEST)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (on < 0.002) return
    const sx = w / view[0]
    const sy = h / view[1]
    const x0 = Math.floor(box[0] * sx)
    const y0 = Math.floor((view[1] - box[3]) * sy)
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(x0, y0, Math.ceil(box[2] * sx) - x0, Math.ceil((view[1] - box[1]) * sy) - y0)
    gl.uniform2f(uCanvas, w, h)
    gl.uniform1f(uTime, time)
    gl.uniform1f(uOn, on)
    gl.uniform1f(uDark, document.documentElement.classList.contains("dark") ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  return {
    draw,
    dispose: () => {
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    },
  }
}

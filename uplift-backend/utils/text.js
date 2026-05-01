// uplift-backend/utils/text.js
const STOP = new Set(['a','an','the','and','or','but','if','then','else','to','from','of','in','on','for','with','is','am','are','was','were','be','been','being','it','this','that','as','at','by','we','you','i','he','she','they','them','our','your','their','my','me']);

const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ');
const toks = s => norm(s).split(/\s+/).filter(t => t && !STOP.has(t));
const tf = arr => arr.reduce((m,t)=> (m[t]=(m[t]||0)+1, m), {});
const dot = (a,b)=> Object.keys(a).reduce((s,k)=> s + (a[k]*(b[k]||0)),0);
const mag = v => Math.sqrt(Object.values(v).reduce((s,n)=> s + n*n, 0));
const cos = (a,b)=> { const A=tf(a), B=tf(b); const m=mag(A)*mag(B); return m? dot(A,B)/m : 0; };

module.exports = { toks, cos };

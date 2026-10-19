const zoom=document.getElementById('imageZoom');
let trigger=null;
document.querySelectorAll('[data-zoom]').forEach(link=>link.addEventListener('click',event=>{
  if(typeof zoom.showModal!=='function')return;
  event.preventDefault();trigger=link;
  const source=link.querySelector('img');
  const image=document.getElementById('zoomImage');image.src=link.href;image.alt=source.alt;
  document.getElementById('zoomOriginal').href=link.href;
  document.getElementById('zoomCaption').textContent=source.alt;
  zoom.showModal();document.getElementById('closeZoom').focus();
}));
document.getElementById('closeZoom').addEventListener('click',()=>zoom.close());
zoom.addEventListener('click',event=>{if(event.target===zoom){const r=zoom.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)zoom.close();}});
zoom.addEventListener('close',()=>trigger?.focus());
let folded=[];
window.addEventListener('beforeprint',()=>{folded=[...document.querySelectorAll('details:not([open])')];folded.forEach(d=>d.open=true);});
window.addEventListener('afterprint',()=>{folded.forEach(d=>d.open=false);folded=[];});
document.getElementById('printGuide').addEventListener('click',()=>window.print());
if('IntersectionObserver'in window){
 const links=[...document.querySelectorAll('.toc a')];
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;links.forEach(link=>{if(link.hash==='#'+entry.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}},{rootMargin:'-90px 0px -65% 0px',threshold:0});
 document.querySelectorAll('.chapter').forEach(section=>observer.observe(section));
}

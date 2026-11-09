/**
 * Widget do chat em JS puro, dentro de Shadow DOM, para não brigar com o CSS do site que o hospeda.
 * Servido em /site/:token/widget.js.
 */
export function widgetSource(base: string, token: string): string {
  return `(function(){
if(window.__n1w)return;window.__n1w=1;
var B=${JSON.stringify(base)}||(document.currentScript&&new URL(document.currentScript.src).origin)||"";var T=${JSON.stringify(token)};
var U=B+"/site/"+T;
function sid(){var k="n1w-sid";try{var v=sessionStorage.getItem(k);if(v)return v;v=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2));sessionStorage.setItem(k,v);return v}catch(e){return window.__n1s||(window.__n1s="s"+Date.now()+Math.random().toString(16).slice(2))}}
var S=sid(),H=[];
function api(p,b){return fetch(U+"/"+p,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.assign({session:S},b))}).then(function(r){return r.json().then(function(j){if(!r.ok)throw{status:r.status,body:j};return j})})}
fetch(U+"/config").then(function(r){return r.json()}).then(function(c){if(!c.enabled)return;mount(c)}).catch(function(){});
function mount(c){
var host=document.createElement("div");document.body.appendChild(host);var root=host.attachShadow({mode:"open"});var t=c.texts,p=c.brand;
var side=p.position==="left"?"left":"right";
root.innerHTML='<style>*{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}.btn{position:fixed;bottom:20px;'+side+':20px;background:'+p.primary+';color:'+p.onPrimary+';border:0;border-radius:999px;padding:12px 18px;font-size:15px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.2)}.box{position:fixed;bottom:20px;'+side+':20px;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 24px));background:#fff;color:#1b1d29;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden}.box.on{display:flex}.hd{background:'+p.primary+';color:'+p.onPrimary+';padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start}.hd b{font-size:16px}.hd small{display:block;opacity:.85;margin-top:2px}.x{background:none;border:0;color:inherit;font-size:20px;cursor:pointer}.ms{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:'+p.soft+'}.m{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}.a{background:#fff;align-self:flex-start;border-bottom-left-radius:4px}.u{background:'+p.primary+';color:'+p.onPrimary+';align-self:flex-end;border-bottom-right-radius:4px}.s{font-size:12px;color:#5b6075;align-self:center;text-align:center}.f{display:flex;gap:8px;padding:10px;border-top:1px solid #e3e5ee}.f input,.lf input{flex:1;border:1px solid #cfd3e2;border-radius:10px;padding:10px;font-size:14px;min-width:0}.f button,.lf button{background:'+p.primary+';color:'+p.onPrimary+';border:0;border-radius:10px;padding:10px 14px;cursor:pointer}.pv{font-size:11px;color:#5b6075;text-align:center;padding:0 10px 8px}.lf{display:none;flex-direction:column;gap:8px;padding:12px;background:#fff;border-top:1px solid #e3e5ee}.lf.on{display:flex}.lf b{font-size:14px}.wa{color:'+p.primary+';font-size:13px;text-align:center}</style><button class="btn" part="launcher"></button><div class="box" role="dialog" aria-label=""><div class="hd"><div><b class="tt"></b><small class="st"></small></div><button class="x" aria-label="×">×</button></div><div class="ms" aria-live="polite"></div><form class="lf"><b class="lt"></b><input class="ln" maxlength="80"><input class="lc" maxlength="120"><button></button></form><form class="f"><input class="in" maxlength="1000" autocomplete="off"><button class="sd"></button></form><div class="pv"></div></div>';
var q=function(s){return root.querySelector(s)};
q(".btn").textContent=t["chat.launcher"];q(".tt").textContent=t["chat.title"];q(".st").textContent=t["chat.subtitle"];q(".box").setAttribute("aria-label",t["chat.title"]);
q(".in").placeholder=t["chat.placeholder"];q(".sd").textContent=t["chat.send"];q(".pv").textContent=t["chat.privacy"];
q(".lt").textContent=t["chat.handoffTitle"];q(".ln").placeholder=t["chat.handoffName"];q(".lc").placeholder=t["chat.handoffContact"];q(".lf button").textContent=t["chat.handoffSubmit"];
var ms=q(".ms"),opened=0,lastQ="";
function add(cls,txt){var d=document.createElement("div");d.className="m "+cls;d.textContent=txt;ms.appendChild(d);ms.scrollTop=ms.scrollHeight;return d}
function note(txt){var d=document.createElement("div");d.className="s";d.textContent=txt;ms.appendChild(d);ms.scrollTop=ms.scrollHeight;return d}
function open(){q(".box").classList.add("on");q(".btn").style.display="none";if(!opened){opened=1;add("a",t["chat.welcome"]);api("chat",{event:"open",campaign:(new URLSearchParams(location.search).get("utm_campaign")||"")}).catch(function(){})}q(".in").focus()}
function close(){q(".box").classList.remove("on");q(".btn").style.display=""}
q(".btn").onclick=open;q(".x").onclick=close;
function wait(ms){return new Promise(function(r){setTimeout(r,ms)})}
q(".f").onsubmit=function(e){e.preventDefault();var i=q(".in"),v=i.value.trim();if(!v)return;i.value="";add("u",v);lastQ=v;var ty=note(t["chat.typing"]);
api("chat",{text:v,history:H.slice()}).then(function(r){H.push(v);return (async function(){for(var k=0;k<r.messages.length;k++){await wait(Math.min(r.messages[k].delayMs||600,1800));if(k===0)ty.remove();add("a",r.messages[k].text)}if(!r.messages.length)ty.remove();
if(r.handoff){if(r.note)note(r.note);q(".lf").classList.add("on");if(c.whatsapp){var a=document.createElement("a");a.className="wa";a.href=c.whatsapp;a.target="_blank";a.rel="noopener";a.textContent="WhatsApp";ms.appendChild(a)}}})()}).catch(function(err){ty.remove();note(err&&err.status===429?t["chat.limit"]:err&&err.status===503?t["chat.closed"]:t["chat.error"])})};
q(".lf").onsubmit=function(e){e.preventDefault();api("lead",{name:q(".ln").value,contact:q(".lc").value,question:lastQ}).then(function(){q(".lf").classList.remove("on");note(t["chat.handoffThanks"])}).catch(function(){note(t["chat.handoffInvalid"])})};
}
})();`;
}

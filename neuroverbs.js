const NEUROVERBS_API_URL =
  "https://script.google.com/macros/s/AKfycbzaq00fpgIqoCWpT8RXd7EypDlRPUtBRtkku_FisgyV-iQZHIHcwUoLyrNTiFJHIml6/exec";

window.idToken = window.idToken || null;

function waitForIdToken(){
  return new Promise(resolve=>{
    const t = setInterval(()=>{
      if(window.idToken){
        clearInterval(t);
        resolve(window.idToken);
      }
    },100);
  });
}

async function sendXP(xp, precision){
  const token = await waitForIdToken();
  const res = await fetch(NEUROVERBS_API_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      action:"updateStats",
      idToken:token,
      xpDelta:xp,
      precision:precision
    })
  });
  const data = await res.json();
  console.log("Backend:", data);
}

window.sendXP = sendXP;
console.log("neuroverbs.js cargado");

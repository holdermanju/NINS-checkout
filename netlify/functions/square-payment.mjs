// NINS Square SANDBOX test function only. Never put access tokens in website JavaScript.
const ALLOWED_ORIGIN = 'https://nins-checkout.netlify.app';
const LOCATION_ID = 'LDSSY825P3VN5';
const TEST_PRICES = Object.freeze({mid:2508931, premium:4236016}); // USD cents, estimated equipment+7% tax; TEST ONLY.
const SQUARE_API = 'https://connect.squareupsandbox.com/v2/payments';
const json=(data,status=200)=> new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export default async function handler(request) {
 if(request.method==='GET') return json({mode:'sandbox',ready:!!process.env.SQUARE_ACCESS_TOKEN,realPaymentsEnabled:false});
 if(request.method!=='POST') return json({ok:false,message:'Method not allowed'},405);
 const origin=request.headers.get('origin');
 if(origin && origin!==ALLOWED_ORIGIN) return json({ok:false,message:'Origin not allowed'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json')) return json({ok:false,message:'JSON required'},415);
 const token=process.env.SQUARE_ACCESS_TOKEN;
 if(!token) return json({ok:false,message:'Square Sandbox token not configured'},503);
 let data;
 try { data=await request.json(); } catch { return json({ok:false,message:'Invalid JSON'},400); }
 const pkg=data?.package;
 const price=Object.hasOwn(TEST_PRICES,pkg) ? TEST_PRICES[pkg] : null;
 if(price===null || typeof data?.sourceId!=='string' || data.sourceId.length>500 || data.sourceId.length<5 || !/^[0-9a-f-]{36}$/i.test(data?.idempotencyKey||'')) {
  return json({ok:false,message:'Invalid Sandbox request'},400);
 }
 try {
  const square=await fetch(SQUARE_API,{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'Square-Version':'2025-10-16'},
   body:JSON.stringify({source_id:data.sourceId,idempotency_key:data.idempotencyKey,amount_money:{amount:price,currency:'USD'},location_id:LOCATION_ID,autocomplete:true,note:`NINS ${pkg} package — SANDBOX SIMULATION ONLY`,reference_id:`NINS-SANDBOX-${pkg}`})
  });
  const result=await square.json();
  if(!square.ok || !result?.payment?.id) return json({ok:false,message:'Square Sandbox declined or rejected the simulated transaction.',code:result?.errors?.[0]?.code||'UNKNOWN'},400);
  return json({ok:true,mode:'sandbox',amount:price,paymentId:result.payment.id,status:result.payment.status});
 } catch {return json({ok:false,message:'Could not reach Square Sandbox.'},502);}
}

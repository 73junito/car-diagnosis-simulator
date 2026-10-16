const handler=require("../api/request-pilot");
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.code=n;return this},json(x){this.body=x;return this},end(){return this}}}
const mk=(method,origin,host="app.autolearnpro.com")=>({method,url:"/api/request-pilot",headers:{host,origin},socket:{encrypted:true,remoteAddress:"192.0.2.10"}});
describe("pilot CORS and proxy boundaries",()=>{
 const before={origins:process.env.PILOT_ALLOWED_ORIGINS,proxy:process.env.PILOT_TRUST_PROXY};
 afterAll(()=>{for(const [k,v] of Object.entries({PILOT_ALLOWED_ORIGINS:before.origins,PILOT_TRUST_PROXY:before.proxy})){if(v===undefined)delete process.env[k];else process.env[k]=v}});
 test("rejects unknown cross-origin preflight and does not allow wildcard",async()=>{
 delete process.env.PILOT_ALLOWED_ORIGINS;
 const res=response();await handler(mk("OPTIONS","https://evil.example"),res);
 expect(res.code).toBe(403);expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
 expect(res.headers.Vary).toBe("Origin");
 });
 test("allows same-origin preflight",async()=>{
 const res=response();await handler(mk("OPTIONS","https://app.autolearnpro.com"),res);
 expect(res.code).toBe(204);expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://app.autolearnpro.com");
 });
 test("allows explicitly configured cross-origin preflight",async()=>{
 process.env.PILOT_ALLOWED_ORIGINS="https://autolearnpro.com";
 const res=response();await handler(mk("OPTIONS","https://autolearnpro.com"),res);
 expect(res.code).toBe(204);expect(res.headers["Access-Control-Allow-Origin"]).toBe("https://autolearnpro.com");
 });
});
const handler=require("../api/request-pilot");
function response(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.code=n;return this},json(x){this.body=x;return this},end(){return this}}}
function req(method,body){return {method,body,headers:{},url:"/api/request-pilot",socket:{remoteAddress:"127.0.0.1"}}}
describe("pilot-request boundary hardening",()=>{
const old=process.env.ADMIN_TOKEN;
afterAll(()=>{if(old===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=old});
test("GET without admin configuration fails closed without integration hints",async()=>{
 delete process.env.ADMIN_TOKEN;const res=response();await handler(req("GET"),res);
 expect(res.code).toBe(503);expect(res.body).toEqual({error:"admin_not_configured"});
});
test("preparsed oversized POST rejected before storage or notification",async()=>{
 const res=response();await handler(req("POST",{name:"Test",email:"test@example.com",notes:"x".repeat(11000)}),res);
 expect(res.code).toBe(413);expect(res.body).toEqual({error:"body_too_large"});
});
test("preparsed oversized admin status rejected",async()=>{
 process.env.ADMIN_TOKEN="a-test-token";const r=req("POST",{id:"1",status:"new",pad:"x".repeat(11000)});r.url="/api/request-pilot/status";r.headers.authorization="Bearer a-test-token";
 const res=response();await handler(r,res);expect(res.code).toBe(413);
});
});
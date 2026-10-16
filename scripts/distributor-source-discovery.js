"use strict";
const fs=require("node:fs");
const path=require("node:path");
const providers=Object.freeze({
 digikey:{name:"DigiKey",base:"https://www.digikey.com/en/products/result",api:"https://developer.digikey.com/",role:"discovery"},
 mouser:{name:"Mouser",base:"https://www.mouser.com/c/",api:"https://www.mouser.com/api-search/",role:"discovery"}
});
function partId(value){if(typeof value!=="string"||!value.trim()||value.length>128||!(/^[a-zA-Z0-9._+\/-]+$/).test(value))throw Error("Invalid manufacturer part number");return value.trim().toUpperCase()}
function record({manufacturer,partNumber,provider,listingUrl,datasheetUrl}){
 if(typeof manufacturer!=="string"||!manufacturer.trim()||manufacturer.length>128)throw Error("Manufacturer required");
 const part=partId(partNumber);
 if(!providers[provider])throw Error("Unsupported distributor");
 function safeHttps(url,label){if(typeof url!=="string")throw Error(label+" required");const parsed=new URL(url);if(parsed.protocol!=="https:")throw Error(label+" must use HTTPS");return parsed.href}
 const url=safeHttps(listingUrl,"listingUrl");
 const host=new URL(url).hostname.toLowerCase();
 const domains=provider==="digikey"?["digikey.com"]:["mouser.com"];
 if(!domains.some(x=>host===x||host.endsWith("."+x)))throw Error("Distributor listing host mismatch");
 const sheet=datasheetUrl?safeHttps(datasheetUrl,"datasheetUrl"):null;
 return {manufacturer:manufacturer.trim(),manufacturerPartNumber:part,provider,listingUrl:url,datasheetUrl:sheet,authority:"discovery-only",validation:"unverified",geometryApproved:false,electricalApproved:false};
}
function compare(a,b){
 if(a.manufacturer.toLowerCase()!==b.manufacturer.toLowerCase()||partId(a.manufacturerPartNumber)!==partId(b.manufacturerPartNumber))
 return {matched:false,reason:"manufacturer or exact part number differs"};
 return {matched:true,reason:"identity match only; technical specifications require manufacturer validation"};
}
function main(){const input=process.argv[2];if(!input)throw Error("Usage: node scripts/distributor-source-discovery.js input.json");const rows=JSON.parse(fs.readFileSync(path.resolve(input),"utf8"));if(!Array.isArray(rows))throw Error("Input must be an array");console.log(JSON.stringify({mode:"read-only",records:rows.map(record)},null,2))}
if(require.main===module)try{main()}catch(e){console.error(e.message);process.exitCode=1}
module.exports={providers,partId,record,compare};

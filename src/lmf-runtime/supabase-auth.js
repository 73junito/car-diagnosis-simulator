"use strict";
// Server-only Supabase Auth user verifier. Client should use a publishable/anon key.
// Do not pass service-role credentials, and never derive identity from user_metadata.
function createSupabaseTokenVerifier(authClient){
 if(typeof authClient?.auth?.getUser!=="function")throw Error("Supabase Auth getUser required");
 return async function verifyAccessToken(token){
  if(typeof token!=="string"||!token.trim())throw Error("Missing bearer token");
  const {data,error}=await authClient.auth.getUser(token);
  if(error||!data?.user?.id)throw Error("Supabase token verification failed");
  const user=data.user;
  if(user.is_anonymous===true)throw Error("Anonymous identity not eligible for evidence persistence");
  return Object.freeze({verified:true,userId:user.id});
 };
}
module.exports={createSupabaseTokenVerifier};

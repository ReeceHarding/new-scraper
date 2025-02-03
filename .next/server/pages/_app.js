"use strict";(()=>{var r={};r.id=636,r.ids=[636],r.modules={7921:(r,e,t)=>{t.d(e,{O:()=>h,Z:()=>f});var a=t(8732),i=t(2015);let o=require("@supabase/supabase-js");var s=t(9776);let n=(0,o.createClient)("http://127.0.0.1:54321","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"),l=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;class u{constructor(r=n){this.client=r}validatePassword(r){if(r.length<8)throw Error("Password must be at least 8 characters")}validateEmail(r){if(!l.test(r))throw Error("Invalid email format")}async register(r,e){try{this.validateEmail(r),this.validatePassword(e);try{let{error:e}=await this.client.auth.resetPasswordForEmail(r);if(!e)throw Error("Email already registered")}catch(r){if(r instanceof Error&&"Email already registered"===r.message)throw r;s.A.error("Password reset check failed",r instanceof Error?r:Error(String(r)))}let{data:t,error:a}=await this.client.auth.signUp({email:r,password:e});if(a)throw s.A.error("Registration failed",a),Error("Registration failed");if(!t?.user||!t?.session)throw Error("Registration failed");let{error:i}=await this.client.from("profiles").insert([{id:t.user.id,email:r,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]).single();if(i){try{await this.client.auth.admin.deleteUser(t.user.id)}catch(r){s.A.error("Failed to clean up user after profile creation error",r)}throw Error("Registration failed")}return s.A.info("User registered successfully",{email:r}),{data:{user:t.user,session:t.session},error:null}}catch(r){if(r instanceof Error){if("Password must be at least 8 characters"===r.message||"Email already registered"===r.message)throw r;s.A.error("Registration error",r)}throw Error("Registration failed")}}async verifyEmail(r){try{let{error:e}=await this.client.auth.verifyOtp({token_hash:r,type:"email"});if(e)throw s.A.error("Failed to verify email",e),e;return s.A.info("Email verified successfully"),{data:null,error:null}}catch(r){throw r instanceof Error&&s.A.error("Failed to verify email",r),r}}async login(r,e){try{let{data:t,error:a}=await this.client.auth.signInWithPassword({email:r,password:e});if(a)throw s.A.error("Login failed",a),Error("Login failed");if(!t.user)throw s.A.error("No user data returned from login"),Error("Login failed");return s.A.info("User logged in successfully",{email:r}),{data:t,error:null}}catch(r){throw s.A.error("Login error",r instanceof Error?r:Error(String(r))),Error("Login failed")}}async resetPassword(r){try{let{error:e}=await this.client.auth.resetPasswordForEmail(r,{redirectTo:`${window.location.origin}/reset-password`});if(e)throw s.A.error("Failed to reset password",e),e;return s.A.info("Password reset email sent",{email:r}),{data:null,error:null}}catch(r){throw r instanceof Error&&s.A.error("Failed to reset password",r),r}}async updatePassword(r){try{let{data:{user:e},error:t}=await this.client.auth.updateUser({password:r}),{data:{session:a}}=await this.client.auth.getSession();if(t)throw s.A.error("Failed to update password",t),t;return s.A.info("Password updated successfully"),{data:{user:e,session:a},error:t}}catch(r){throw r instanceof Error&&s.A.error("Failed to update password",r),r}}async signOut(){try{let{error:r}=await this.client.auth.signOut();if(r)throw s.A.error("Failed to sign out",r),r;return s.A.info("User signed out successfully"),{error:null}}catch(r){throw r instanceof Error&&s.A.error("Failed to sign out",r),r}}async getUser(){try{let{data:{user:r},error:e}=await this.client.auth.getUser();if(e)throw s.A.error("Failed to get user",{error:e}),Error("Get user failed");let{data:{session:t},error:a}=await this.client.auth.getSession();if(a)throw s.A.error("Failed to get session",{error:a}),Error("Get user failed");return{data:{user:r,session:t},error:null}}catch(r){throw s.A.error("Get user/session error",{error:r instanceof Error?r.message:String(r)}),Error("Get user failed")}}async updateProfile(r){try{let{data:e,error:t}=await this.client.auth.updateUser({data:r});if(t)throw s.A.error("Failed to update profile",t),t;let{data:{session:a}}=await this.client.auth.getSession();return s.A.info("Profile updated successfully"),{data:{user:e.user,session:a},error:null}}catch(r){throw r instanceof Error&&s.A.error("Failed to update profile",r),r}}}let c=new u,d=(0,i.createContext)(void 0);function h({children:r}){let e=function(){let[r,e]=(0,i.useState)(null),[t,a]=(0,i.useState)(null),[o,n]=(0,i.useState)(!0),[l,u]=(0,i.useState)(null);return{user:r,session:t,loading:o,error:l,register:async(r,t)=>{try{n(!0),u(null);let{data:i,error:o}=await c.register(r,t);if(o)throw o;e(i.user),a(i.session)}catch(r){throw s.A.error("Failed to register user",r),u(r),r}finally{n(!1)}},login:async(r,t)=>{try{n(!0),u(null);let{data:i,error:o}=await c.login(r,t);if(o)throw o;e(i.user),a(i.session)}catch(r){throw s.A.error("Failed to login user",r),u(r),r}finally{n(!1)}},logout:async()=>{try{n(!0),u(null);let{error:r}=await c.signOut();if(r)throw r;e(null),a(null)}catch(r){throw s.A.error("Failed to logout user",r),u(r),r}finally{n(!1)}},resetPassword:async r=>{try{n(!0),u(null);let{error:e}=await c.resetPassword(r);if(e)throw e}catch(r){throw s.A.error("Failed to reset password",r),u(r),r}finally{n(!1)}},updatePassword:async r=>{try{n(!0),u(null);let{data:t,error:a}=await c.updatePassword(r);if(a)throw a;e(t.user)}catch(r){throw s.A.error("Failed to update password",r),u(r),r}finally{n(!1)}},verifyEmail:async r=>{try{n(!0),u(null);let{error:e}=await c.verifyEmail(r);if(e)throw e}catch(r){throw s.A.error("Failed to verify email",r),u(r),r}finally{n(!1)}},updateProfile:async r=>{try{n(!0),u(null);let{data:t,error:i}=await c.updateProfile(r);if(i)throw i;e(t.user),a(t.session)}catch(r){throw s.A.error("Failed to update profile",r),u(r),r}finally{n(!1)}}}}();return(0,a.jsx)(d.Provider,{value:e,children:r})}function f(){let r=(0,i.useContext)(d);if(void 0===r)throw Error("useAuthContext must be used within an AuthProvider");return r}},7964:(r,e,t)=>{t.r(e),t.d(e,{default:()=>o});var a=t(8732),i=t(7921);function o({Component:r,pageProps:e}){return(0,a.jsx)(i.O,{children:(0,a.jsx)(r,{...e})})}},9776:(r,e,t)=>{t.d(e,{A:()=>i});class a{constructor(){this.context={}}static getInstance(){return a.instance||(a.instance=new a),a.instance}setContext(r){this.context=r}formatLogData(r,e,t){return{level:r,message:e,...t,...this.context,timestamp:new Date().toISOString()}}info(r,e){console.log("[Client]",this.formatLogData("info",r,e))}warn(r,e){console.warn("[Client]",this.formatLogData("warn",r,e))}debug(r,e){console.debug("[Client]",this.formatLogData("debug",r,e))}error(r,e){let t=e instanceof Error?{...e,message:e.message,stack:e.stack,name:e.name}:{message:String(e),name:"UnknownError"};console.error("[Client]",this.formatLogData("error",r,{error:t}))}logPerformance(r,e,t){console.log("[Client]",this.formatLogData("performance",`Performance monitoring: ${r} took ${e}ms`,{type:"performance",operation:r,duration:e,...t}))}}let i=a.getInstance()},2015:r=>{r.exports=require("react")},8732:r=>{r.exports=require("react/jsx-runtime")}};var e=require("../webpack-runtime.js");e.C(r);var t=e(e.s=7964);module.exports=t})();
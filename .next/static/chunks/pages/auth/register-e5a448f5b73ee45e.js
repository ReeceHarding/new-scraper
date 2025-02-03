(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[506],{218:(e,s,r)=>{(window.__NEXT_P=window.__NEXT_P||[]).push(["/auth/register",function(){return r(5080)}])},5080:(e,s,r)=>{"use strict";r.r(s),r.d(s,{default:()=>i});var a=r(4848),t=r(6540),l=r(6715),n=r(1106),o=r.n(n),d=r(6844),c=r(9776);function i(){let e=(0,l.useRouter)(),{register:s,loading:r,error:n}=(0,d.Z)(),[i,u]=(0,t.useState)(""),[m,p]=(0,t.useState)(""),[x,h]=(0,t.useState)(""),[f,b]=(0,t.useState)(null),g=async r=>{if(r.preventDefault(),b(null),m!==x){b("Passwords do not match");return}try{await s(i,m),c.A.info("Registration successful"),e.push("/auth/verify-email")}catch(e){c.A.error("Failed to register",e),b(e.message)}};return(0,a.jsx)("div",{className:"min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8",children:(0,a.jsxs)("div",{className:"max-w-md w-full space-y-8",children:[(0,a.jsxs)("div",{children:[(0,a.jsx)("h2",{className:"mt-6 text-center text-3xl font-extrabold text-gray-900",children:"Create your account"}),(0,a.jsxs)("p",{className:"mt-2 text-center text-sm text-gray-600",children:["Or"," ",(0,a.jsx)(o(),{href:"/auth/login",className:"font-medium text-blue-600 hover:text-blue-500",children:"sign in to your existing account"})]})]}),(0,a.jsxs)("form",{className:"mt-8 space-y-6",onSubmit:g,children:[(0,a.jsxs)("div",{className:"rounded-md shadow-sm -space-y-px",children:[(0,a.jsxs)("div",{children:[(0,a.jsx)("label",{htmlFor:"email",className:"sr-only",children:"Email address"}),(0,a.jsx)("input",{id:"email",name:"email",type:"email",autoComplete:"email",required:!0,value:i,onChange:e=>u(e.target.value),className:"appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm",placeholder:"Email address"})]}),(0,a.jsxs)("div",{children:[(0,a.jsx)("label",{htmlFor:"password",className:"sr-only",children:"Password"}),(0,a.jsx)("input",{id:"password",name:"password",type:"password",autoComplete:"new-password",required:!0,value:m,onChange:e=>p(e.target.value),className:"appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm",placeholder:"Password"})]}),(0,a.jsxs)("div",{children:[(0,a.jsx)("label",{htmlFor:"confirm-password",className:"sr-only",children:"Confirm password"}),(0,a.jsx)("input",{id:"confirm-password",name:"confirm-password",type:"password",autoComplete:"new-password",required:!0,value:x,onChange:e=>h(e.target.value),className:"appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm",placeholder:"Confirm password"})]})]}),(0,a.jsx)("div",{className:"text-sm text-gray-600",children:"Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character."}),(f||n)&&(0,a.jsx)("div",{className:"rounded-md bg-red-50 p-4",children:(0,a.jsx)("div",{className:"flex",children:(0,a.jsx)("div",{className:"ml-3",children:(0,a.jsx)("h3",{className:"text-sm font-medium text-red-800",children:f||(null==n?void 0:n.message)})})})}),(0,a.jsx)("div",{children:(0,a.jsx)("button",{type:"submit",disabled:r,className:"group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ".concat(r?"bg-blue-400 cursor-not-allowed":"bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"),children:r?(0,a.jsxs)("div",{className:"flex items-center",children:[(0,a.jsx)("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"}),"Creating account..."]}):"Create account"})})]})]})})}},6715:(e,s,r)=>{e.exports=r(4009)}},e=>{var s=s=>e(e.s=s);e.O(0,[106,636,593,792],()=>s(218)),_N_E=e.O()}]);
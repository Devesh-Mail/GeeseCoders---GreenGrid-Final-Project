/* Protects dashboard.html / admin.html — redirects to login.html
   if there's no session token, and bounces students out of the
   admin console (and vice versa). Include AFTER api.js. */
(function(){
  const requiredRole = document.body.dataset.requireRole; // "student" | "admin"
  const user = GG_API.getUser();
  if(!GG_API.token() || !user){
    window.location.href = 'login.html';
    return;
  }
  if(requiredRole && user.role !== requiredRole){
    window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
  }
})();

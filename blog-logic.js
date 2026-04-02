'use strict';
/* blog-logic.js — requires config.js, db.js, security.js to be loaded first */

const NATIONS = {
    'Germany':       { tag:'GER', color:'#aaaaaa' },
    'Soviet Union':  { tag:'SOV', color:'#ff6666' },
    'Japan':         { tag:'JAP', color:'#ffff44' },
    'Italy':         { tag:'ITA', color:'#77ee77' },
    'France':        { tag:'FRA', color:'#6699ff' },
    'United Kingdom':{ tag:'ENG', color:'#ff7777' },
    'United States': { tag:'USA', color:'#6688ff' },
    'China':         { tag:'CHI', color:'#FFD700' },
};
const DEFAULT_PIC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='24' fill='%23333'/%3E%3Ctext x='24' y='31' text-anchor='middle' fill='%23888' font-size='18'%3E%3F%3C/text%3E%3C/svg%3E";
let currentUser = null;

function invertColor(hex) {
    hex = (hex||'').replace('#','');
    if (hex.length===3) hex=hex.split('').map(c=>c+c).join('');
    if (hex.length!==6) return '#ffffff';
    const r=255-parseInt(hex.slice(0,2),16), g=255-parseInt(hex.slice(2,4),16), b=255-parseInt(hex.slice(4,6),16);
    return (0.299*r+0.587*g+0.114*b)/255 > 0.5 ? '#111' : '#eee';
}

function showAlert(id, msg, type='error') {
    const el = document.getElementById(id); if(!el) return;
    el.className=`alert alert-${type} show`; el.textContent=msg;
    setTimeout(()=>el.classList.remove('show'),5000);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', ()=>{
        document.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
        document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab'+tab.dataset.tab).classList.add('active');
    });
});

// ── Password strength ─────────────────────────────────────────────────────────
const signupPassEl = document.getElementById('signupPass');
if (signupPassEl) signupPassEl.addEventListener('input', () => {
    const p = signupPassEl.value;
    let score = [p.length>=8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^a-zA-Z0-9]/.test(p)].filter(Boolean).length;
    const colors=['#e74c3c','#e67e22','#f1c40f','#27ae60'];
    const labels=['Weak','Fair','Good','Strong'];
    const fill=document.getElementById('strengthFill'), label=document.getElementById('strengthLabel');
    if(fill){fill.style.width=(score*25)+'%'; fill.style.background=colors[score-1]||'#e74c3c';}
    if(label) label.textContent=p.length>0?labels[score-1]||'Weak':'';
});

// ── Update UI ─────────────────────────────────────────────────────────────────
async function updateUI() {
    const users = await DB.getUsers();
    const user  = users.find(u=>u.username===currentUser);
    if (currentUser && user) {
        if (user.banned) {
            alert('Your account has been banned.\nReason: '+(user.banReason||'No reason given'));
            currentUser=null; await DB.setCurrentUser(null); await updateUI(); return;
        }
        document.getElementById('userPanel').style.display='block';
        document.getElementById('authCard').style.display='none';
        document.getElementById('createSection').style.display='block';
        security.setSafeDisplayName(document.getElementById('usernameDisplay'),currentUser,user.nation,NATIONS);
        document.getElementById('userPic').src=user.profilePic||DEFAULT_PIC;
        document.getElementById('followersCount').textContent=(user.followers||[]).length;
        document.getElementById('followingCount').textContent=(user.following||[]).length;
        document.getElementById('notifCount').textContent=(user.notifications||[]).length;
        const cfg=window.HOM_CONFIG||{};
        const isAdmin=user.isAdmin||(cfg.DEFAULT_ADMINS||[]).includes(currentUser);
        const adminLnk=document.getElementById('adminLink');
        if(adminLnk) adminLnk.style.display=isAdmin?'inline-flex':'none';
    } else {
        document.getElementById('userPanel').style.display='none';
        document.getElementById('authCard').style.display='block';
        document.getElementById('createSection').style.display='none';
    }
    await loadBlogs();
}

// ── Login ─────────────────────────────────────────────────────────────────────
const loginBtn = document.getElementById('loginBtn');
if(loginBtn) loginBtn.addEventListener('click', async ()=>{
    const btn=loginBtn;
    const username=document.getElementById('loginUser').value.trim();
    const password=document.getElementById('loginPass').value;
    if(!username||!password){showAlert('loginError','Please fill in all fields.');return;}
    btn.disabled=true; btn.textContent='Signing in…';
    const rl=await security.checkLoginRateLimit(username);
    if(!rl.allowed){showAlert('loginError',`Too many failed attempts. Try again in ${rl.remaining} min.`);btn.disabled=false;btn.textContent='Sign In →';return;}
    const hashed=await security.hashPassword(password);
    const users=await DB.getUsers();
    const found=users.find(u=>u.username===username);
    if(!found||(found.password!==hashed&&found.password!==password)){
        const rec=await security.recordFailedLogin(username);
        const cfg=window.HOM_CONFIG||{};
        const rem=(cfg.MAX_LOGIN_ATTEMPTS||5)-(rec.attempts||0);
        showAlert('loginError',rem>0?`Invalid credentials. ${rem} attempt(s) left.`:`Account locked for ${cfg.LOCKOUT_MINUTES||15} min.`);
        await security.discordLog('loginFailed',{Username:username,Attempts:rec.attempts,Time:new Date().toLocaleString()});
        await DB.appendLog({type:'loginFailed',username,attempts:rec.attempts});
        btn.disabled=false;btn.textContent='Sign In →';return;
    }
    if(found.banned){showAlert('loginError','Account banned: '+(found.banReason||'No reason'));btn.disabled=false;btn.textContent='Sign In →';return;}
    if(found.password!==hashed){found.password=hashed;await DB.saveUsers(users);}
    await security.clearLoginRateLimit(username);
    currentUser=username; await DB.setCurrentUser(username);
    await security.discordLog('login',{Username:username,Time:new Date().toLocaleString()});
    await DB.appendLog({type:'login',username});
    btn.disabled=false;btn.textContent='Sign In →';
    await updateUI();
});

// ── Signup ────────────────────────────────────────────────────────────────────
const signupBtn=document.getElementById('signupBtn');
if(signupBtn) signupBtn.addEventListener('click',async()=>{
    const btn=signupBtn;
    const username=document.getElementById('signupUser').value.trim();
    const password=document.getElementById('signupPass').value;
    const email=document.getElementById('signupEmail').value.trim();
    const discord=document.getElementById('signupDiscord').value.trim();
    const nation=document.getElementById('signupNation').value;
    const uErr=security.validateUsername(username); if(uErr){showAlert('signupError',uErr);return;}
    const pErr=security.validatePassword(password); if(pErr){showAlert('signupError',pErr);return;}
    btn.disabled=true;btn.textContent='Creating account…';
    const users=await DB.getUsers();
    if(users.find(u=>u.username===username)){showAlert('signupError','Username already taken.');btn.disabled=false;btn.textContent='Create Account →';return;}
    const hashed=await security.hashPassword(password);
    const cfg=window.HOM_CONFIG||{};
    const isAdmin=(cfg.DEFAULT_ADMINS||[]).includes(username);
    users.push({username,password:hashed,email,discord,nation,isAdmin,banned:false,banReason:null,followers:[],following:[],notifications:[],likedTags:[],likedBlogs:[],profilePic:null,createdAt:new Date().toISOString()});
    await DB.saveUsers(users);
    currentUser=username; await DB.setCurrentUser(username);
    await security.discordLog('signup',{Username:username,Email:email||'—',Discord:discord||'—',Faction:nation||'—',Time:new Date().toLocaleString()});
    await DB.appendLog({type:'signup',username,email,nation});
    btn.disabled=false;btn.textContent='Create Account →';
    await updateUI();
});

// ── Logout ────────────────────────────────────────────────────────────────────
const logoutBtn=document.getElementById('logoutBtn');
if(logoutBtn) logoutBtn.addEventListener('click',async()=>{
    await security.discordLog('logout',{Username:currentUser,Time:new Date().toLocaleString()});
    await DB.appendLog({type:'logout',username:currentUser});
    currentUser=null; await DB.setCurrentUser(null); await updateUI();
});

// ── Upload avatar ─────────────────────────────────────────────────────────────
const picInput=document.getElementById('profilePicInput');
if(picInput) picInput.addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file)return;
    if(file.size>2*1024*1024){alert('Image must be under 2 MB.');return;}
    const dataUrl=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);});
    const users=await DB.getUsers(),user=users.find(u=>u.username===currentUser);
    if(user){user.profilePic=dataUrl;await DB.saveUsers(users);document.getElementById('userPic').src=dataUrl;}
});

// ── Notifications ─────────────────────────────────────────────────────────────
const viewNotifBtn=document.getElementById('viewNotifications');
if(viewNotifBtn) viewNotifBtn.addEventListener('click',async()=>{
    const panel=document.getElementById('notifPanel');
    if(panel.classList.contains('open')){panel.classList.remove('open');return;}
    const users=await DB.getUsers(),user=users.find(u=>u.username===currentUser);
    if(!user)return;
    panel.innerHTML='';
    if(!(user.notifications||[]).length){panel.innerHTML='<div class="notif-item" style="text-align:center;">No notifications</div>';}
    else{
        user.notifications.forEach(n=>{const d=document.createElement('div');d.className='notif-item';d.textContent=`${n.message}  (${n.date})`;panel.appendChild(d);});
        user.notifications=[];await DB.saveUsers(users);document.getElementById('notifCount').textContent='0';
    }
    panel.classList.add('open');
});

// ── Editor ────────────────────────────────────────────────────────────────────
function fmt(cmd){document.execCommand(cmd,false,null);document.getElementById('contentEditor').focus();}
const applyFontBtn=document.getElementById('applyFontBtn');
if(applyFontBtn) applyFontBtn.addEventListener('click',()=>{document.execCommand('fontName',false,document.getElementById('fontSelect').value);document.getElementById('contentEditor').focus();});
document.querySelectorAll('input[name="publish"]').forEach(r=>r.addEventListener('change',function(){document.getElementById('scheduleDiv').style.display=this.value==='schedule'?'block':'none';}));
const blogImageInput=document.getElementById('blogImage');
if(blogImageInput) blogImageInput.addEventListener('change',e=>{document.getElementById('imageFileName').textContent=e.target.files[0]?.name||'Choose image…';});

// ── Submit blog ───────────────────────────────────────────────────────────────
const blogForm=document.getElementById('blogForm');
if(blogForm) blogForm.addEventListener('submit',async e=>{
    e.preventDefault(); if(!currentUser)return;
    const title=document.getElementById('blogTitle').value.trim();
    const content=security.sanitizeBlogHTML(document.getElementById('contentEditor').innerHTML);
    const tags=document.getElementById('blogTags').value.split(',').map(t=>t.trim()).filter(Boolean).slice(0,10);
    const format=document.getElementById('blogFormat').value;
    const bgColor=document.getElementById('blogBgColor').value;
    const isPrivate=document.getElementById('blogPrivate').checked;
    const pub=document.querySelector('input[name="publish"]:checked').value;
    const publishTime=pub==='schedule'?document.getElementById('publishTime').value:null;
    if(!title){showAlert('createAlert','Title is required.','error');return;}
    if(!content.trim()){showAlert('createAlert','Content is required.','error');return;}
    let image=null;
    const imgFile=document.getElementById('blogImage').files[0];
    if(imgFile){if(imgFile.size>3*1024*1024){showAlert('createAlert','Image must be under 3 MB.','error');return;}image=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(imgFile);});}
    const seoFriendly=title.length>=5&&content.length>50&&tags.length>0;
    const newBlog={id:Date.now(),title,content,author:currentUser,date:new Date().toISOString(),image,private:isPrivate,tags,seoFriendly,format,bgColor,publishTime,comments:[]};
    const blogs=await DB.getBlogs();blogs.push(newBlog);await DB.saveBlogs(blogs);
    const users=await DB.getUsers(),me=users.find(u=>u.username===currentUser);
    if(me)(me.followers||[]).forEach(fn=>{const f=users.find(u=>u.username===fn);if(f){f.notifications=f.notifications||[];f.notifications.push({type:'new_blog',from:currentUser,message:`${currentUser} published: ${title}`,date:new Date().toLocaleString()});}});
    await DB.saveUsers(users);
    await security.discordLog('blogPublished',{Author:currentUser,Title:title,Tags:tags.join(', ')||'—',Private:isPrivate?'Yes':'No',Time:new Date().toLocaleString()});
    await DB.appendLog({type:'blogPublished',username:currentUser,title});
    blogForm.reset();document.getElementById('contentEditor').innerHTML='';document.getElementById('imageFileName').textContent='Choose image…';document.getElementById('scheduleDiv').style.display='none';
    showAlert('createAlert','Post published successfully!','success');
    await loadBlogs();
});

// ── Load blogs ────────────────────────────────────────────────────────────────
async function loadBlogs(){
    const container=document.getElementById('blogsContainer');
    const users=await DB.getUsers(),now=new Date();
    const blogs=(await DB.getBlogs()).filter(b=>(!b.private||b.author===currentUser)&&(!b.publishTime||new Date(b.publishTime)<=now)).sort((a,b)=>new Date(b.date)-new Date(a.date));
    container.innerHTML='';
    if(!blogs.length){container.innerHTML='<div class="empty-state"><p>No posts yet. Be the first to write one!</p></div>';return;}
    blogs.forEach(blog=>{
        const au=users.find(u=>u.username===blog.author);
        const card=document.createElement('div');card.className='blog-card'+(blog.format==='newspaper'?' newspaper':'');
        if(blog.bgColor&&blog.bgColor!=='#0a0c0f'){card.style.background=blog.bgColor;card.style.color=invertColor(blog.bgColor);card.style.borderColor='transparent';}
        const hdr=document.createElement('div');hdr.className='blog-card-header';
        const pic=document.createElement('img');pic.className='blog-author-pic';pic.src=(au&&au.profilePic)||DEFAULT_PIC;pic.alt='';
        const lnk=document.createElement('a');lnk.className='blog-author-link';lnk.href='profile.html?user='+security.encodeParam(blog.author);
        security.setSafeDisplayName(lnk,blog.author,au?au.nation:null,NATIONS);
        const dt=document.createElement('span');dt.className='blog-date';dt.textContent=new Date(blog.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
        hdr.append(pic,lnk,dt);card.appendChild(hdr);
        const ttl=document.createElement('div');ttl.className='blog-title';ttl.textContent=blog.title;
        const bdy=document.createElement('div');bdy.className='blog-content';bdy.innerHTML=security.sanitizeBlogHTML(blog.content);
        card.append(ttl,bdy);
        if(blog.image){const img=document.createElement('img');img.src=blog.image;img.alt='';bdy.appendChild(img);}
        if(blog.tags&&blog.tags.length){const td=document.createElement('div');td.className='blog-tags';blog.tags.forEach(t=>{const s=document.createElement('span');s.className='tag-badge';s.textContent=t;td.appendChild(s);});card.appendChild(td);}
        const acts=document.createElement('div');acts.className='blog-actions';
        if(currentUser&&blog.author!==currentUser){
            const fbtn=document.createElement('button');fbtn.className='btn btn-ghost';fbtn.style.cssText='font-size:13px;padding:6px 14px;';fbtn.textContent='⏳';acts.appendChild(fbtn);
            (async()=>{const me=(await DB.getUsers()).find(u=>u.username===currentUser);fbtn.textContent=me&&(me.following||[]).includes(blog.author)?'Unfollow':'Follow';fbtn.onclick=()=>toggleFollow(blog.author,fbtn);})();
        }
        if(currentUser===blog.author){
            const del=document.createElement('button');del.className='btn btn-danger';del.style.cssText='font-size:13px;padding:6px 14px;';del.textContent='🗑️ Delete';
            del.onclick=async()=>{if(!confirm('Delete this post?'))return;const bl=await DB.getBlogs();await DB.saveBlogs(bl.filter(b=>b.id!==blog.id));await security.discordLog('blogDeleted',{Author:currentUser,Title:blog.title,Time:new Date().toLocaleString()});await DB.appendLog({type:'blogDeleted',username:currentUser,title:blog.title});await loadBlogs();};
            acts.appendChild(del);
        }
        if(acts.children.length)card.appendChild(acts);
        container.appendChild(card);
    });
}

// ── Follow ────────────────────────────────────────────────────────────────────
async function toggleFollow(target,btn){
    if(!currentUser)return;
    const users=await DB.getUsers();
    const me=users.find(u=>u.username===currentUser),them=users.find(u=>u.username===target);
    if(!me||!them)return;
    me.following=me.following||[];them.followers=them.followers||[];
    if(me.following.includes(target)){me.following=me.following.filter(x=>x!==target);them.followers=them.followers.filter(x=>x!==currentUser);if(btn)btn.textContent='Follow';}
    else{me.following.push(target);them.followers.push(currentUser);them.notifications=them.notifications||[];them.notifications.push({type:'follow',from:currentUser,message:`${currentUser} started following you`,date:new Date().toLocaleString()});if(btn)btn.textContent='Unfollow';}
    await DB.saveUsers(users);
    document.getElementById('followingCount').textContent=me.following.length;
}

// ── Global search ─────────────────────────────────────────────────────────────
const globalSearchEl=document.getElementById('globalSearch');
if(globalSearchEl) globalSearchEl.addEventListener('keypress',async e=>{if(e.key==='Enter'){await DB.setSearchTerm(e.target.value.trim());window.location.href='foryou.html';}});

// ── Init ──────────────────────────────────────────────────────────────────────
(async()=>{currentUser=await DB.getCurrentUser();await updateUI();})();

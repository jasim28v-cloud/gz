// VOID LION - Complete App
const ADMIN_EMAIL = 'jasim28v@gmail.com';

const VoidApp = {
    currentVideoId: null,
    currentVideoUserId: null,
    
    init() {
        this.setupNavigation();
        this.startClock();
        this.checkAdmin();
        setTimeout(() => this.hideLoader(), 1000);
    },
    
    hideLoader() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('app').classList.add('ready');
        VoidVideo.loadFeed();
        VoidNotifications.init();
    },
    
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = () => this.switchPage(item.dataset.page);
        });
    },
    
    switchPage(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
        
        if (page === 'home') VoidVideo.loadFeed();
        else if (page === 'explore') VoidExplore.load();
        else if (page === 'profile' && VoidAuth.currentUser) VoidProfile.load();
    },
    
    openPanel(panelId) { document.getElementById(panelId).classList.add('open'); },
    closePanel(panelId) { document.getElementById(panelId).classList.remove('open'); },
    startClock() { setInterval(() => document.getElementById('liveClock').textContent = new Date().toLocaleTimeString('ar-SA').slice(0,5), 1000); },
    checkAdmin() { if (VoidAuth.currentUser?.email === ADMIN_EMAIL) document.getElementById('adminFAB').classList.remove('hidden'); },
    formatNumber(n) { return n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(1)+'K' : n?.toString() || '0'; },
    timeAgo(ts) {
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'الآن';
        if (s < 3600) return `منذ ${Math.floor(s/60)} د`;
        if (s < 86400) return `منذ ${Math.floor(s/3600)} س`;
        return `منذ ${Math.floor(s/86400)} ي`;
    }
};

// نظام الفيديوهات - عام للمشاهدة
const VoidVideo = {
    async loadFeed() {
        const feed = document.getElementById('videoFeed');
        feed.innerHTML = '<div style="text-align:center;padding-top:50%"><div class="spinner"></div></div>';
        
        const snap = await db.ref('videos').orderByChild('timestamp').limitToLast(20).once('value');
        const videos = snap.val();
        
        feed.innerHTML = '';
        if (!videos) { feed.innerHTML = '<p style="text-align:center;padding-top:50%;color:#888">لا توجد فيديوهات</p>'; return; }
        
        Object.entries(videos).reverse().forEach(([id, v]) => this.renderVideo(id, v));
        this.initObserver();
    },
    
    renderVideo(id, v) {
        const div = document.createElement('div');
        div.className = 'video-item';
        div.dataset.videoId = id;
        div.dataset.userId = v.userId;
        
        div.innerHTML = `
            <video src="${v.url}" loop playsinline></video>
            <div class="video-overlay">
                <div style="display:flex;align-items:center;gap:10px">
                    <img src="${v.userAvatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid #00f2ff">
                    <div>
                        <strong>@${v.username}</strong>
                        ${VoidAuth.currentUser && v.userId !== VoidAuth.currentUser.uid ? 
                            `<button onclick="VoidUser.follow('${v.userId}')" style="background:#00f2ff;border:none;padding:4px 12px;border-radius:20px;margin-right:8px;cursor:pointer">${v.followers?.[VoidAuth.currentUser.uid] ? 'متابَع' : 'متابعة'}</button>` : ''}
                    </div>
                </div>
                <p style="margin-top:8px;font-weight:bold">${v.title || ''}</p>
                <p style="font-size:14px;opacity:0.9">${v.description || ''}</p>
                <div style="margin-top:8px">${(v.description?.match(/#[^\s]+/g) || []).map(t => `<span class="hashtag">${t}</span>`).join('')}</div>
            </div>
        `;
        feed.appendChild(div);
    },
    
    initObserver() {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                const video = e.target.querySelector('video');
                const id = e.target.dataset.videoId;
                if (e.isIntersecting) {
                    video.play();
                    this.currentVideoId = id;
                    this.currentVideoUserId = e.target.dataset.userId;
                    document.getElementById('videoActions').classList.remove('hidden');
                    this.updateActions(id);
                    db.ref(`videos/${id}/views`).transaction(v => (v||0)+1);
                } else { video.pause(); }
            });
        }, { threshold: 0.7 });
        document.querySelectorAll('.video-item').forEach(el => obs.observe(el));
    },
    
    async updateActions(id) {
        const v = (await db.ref(`videos/${id}`).once('value')).val();
        document.getElementById('likeCount').textContent = VoidApp.formatNumber(Object.keys(v.likes||{}).length);
        document.getElementById('commentCount').textContent = VoidApp.formatNumber(v.comments||0);
        document.getElementById('likeIcon').style.color = v.likes?.[VoidAuth.currentUser?.uid] ? '#ff007f' : '#fff';
    },
    
    async toggleLike() {
        if (!VoidAuth.currentUser) { location.href = 'auth.html'; return; }
        const ref = db.ref(`videos/${this.currentVideoId}/likes/${VoidAuth.currentUser.uid}`);
        (await ref.once('value')).exists() ? await ref.remove() : await ref.set(true);
        this.updateActions(this.currentVideoId);
    },
    
    openComments() { VoidApp.openPanel('commentsPanel'); this.loadComments(); },
    
    async loadComments() {
        const c = document.getElementById('commentsList');
        c.innerHTML = '<div class="spinner"></div>';
        const snap = await db.ref(`comments/${this.currentVideoId}`).once('value');
        const comments = snap.val();
        c.innerHTML = !comments ? '<p style="color:#888">لا توجد تعليقات</p>' : 
            Object.entries(comments).reverse().map(([id, cm]) => `
                <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:12px;margin-bottom:10px">
                    <strong style="color:#00f2ff">@${cm.username}</strong>
                    <p>${cm.text}</p>
                    <small>${VoidApp.timeAgo(cm.timestamp)}</small>
                </div>
            `).join('');
    },
    
    async sendComment() {
        if (!VoidAuth.currentUser) { location.href = 'auth.html'; return; }
        const text = document.getElementById('commentInput').value.trim();
        if (!text) return;
        const user = (await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value')).val();
        await db.ref(`comments/${this.currentVideoId}`).push({
            userId: VoidAuth.currentUser.uid, username: user.username, userAvatar: user.avatar,
            text, timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        await db.ref(`videos/${this.currentVideoId}/comments`).transaction(c => (c||0)+1);
        document.getElementById('commentInput').value = '';
        this.loadComments();
    },
    
    shareVideo() {
        if (navigator.share) navigator.share({url: window.location.href});
        else navigator.clipboard?.writeText(window.location.href);
    }
};

// نظام الرفع - بدون واجهة Cloudinary
const VoidUpload = {
    videoFile: null,
    
    openModal() {
        if (!VoidAuth.currentUser) { location.href = 'auth.html'; return; }
        document.getElementById('uploadModal').classList.remove('hidden');
        document.getElementById('videoFileInput').onchange = e => this.handleFile(e.target.files[0]);
    },
    
    closeModal() {
        document.getElementById('uploadModal').classList.add('hidden');
        document.getElementById('uploadAreaBox').classList.remove('hidden');
        document.getElementById('uploadProgressBox').classList.add('hidden');
        document.getElementById('videoInfoBox').classList.add('hidden');
    },
    
    async handleFile(file) {
        if (!file) return;
        document.getElementById('uploadAreaBox').classList.add('hidden');
        document.getElementById('uploadProgressBox').classList.remove('hidden');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', 'so_34k');
        
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = e => {
            const p = Math.round(e.loaded / e.total * 100);
            document.getElementById('progressPercent').textContent = p + '%';
            document.getElementById('progressFill').style.width = p + '%';
        };
        
        xhr.onload = async () => {
            const res = JSON.parse(xhr.responseText);
            this.videoFile = res;
            document.getElementById('uploadProgressBox').classList.add('hidden');
            document.getElementById('videoInfoBox').classList.remove('hidden');
            document.getElementById('videoPreview').src = res.secure_url;
        };
        
        xhr.open('POST', `https://api.cloudinary.com/v1_1/duzoqh3jp/video/upload`);
        xhr.send(formData);
    },
    
    async publish() {
        const title = document.getElementById('videoTitle').value.trim();
        const desc = document.getElementById('videoDescription').value.trim();
        if (!title) return alert('أدخل عنواناً');
        
        const user = (await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value')).val();
        await db.ref('videos').push({
            url: this.videoFile.secure_url, title, description: desc,
            userId: VoidAuth.currentUser.uid, username: user.username, userAvatar: user.avatar,
            likes: {}, comments: 0, shares: 0, views: 0,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        this.closeModal();
        VoidVideo.loadFeed();
    }
};

// نظام البروفايل
const VoidProfile = {
    async load() {
        const user = (await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value')).val();
        document.getElementById('profileCover').style.backgroundImage = `url(${user.cover || ''})`;
        document.getElementById('profileAvatar').src = user.avatar;
        document.getElementById('profileName').textContent = `@${user.username}`;
        document.getElementById('profileBio').textContent = user.bio || '';
        document.getElementById('profileFollowers').textContent = Object.keys(user.followers||{}).length;
        document.getElementById('profileFollowing').textContent = Object.keys(user.following||{}).length;
    },
    
    changeAvatar() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async e => {
            const file = e.target.files[0];
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'so_34k');
            const res = await fetch('https://api.cloudinary.com/v1_1/duzoqh3jp/image/upload', { method: 'POST', body: formData });
            const data = await res.json();
            await db.ref(`users/${VoidAuth.currentUser.uid}/avatar`).set(data.secure_url);
            this.load();
        };
        input.click();
    },
    
    edit() {
        const bio = prompt('السيرة الذاتية:', document.getElementById('profileBio').textContent);
        if (bio !== null) db.ref(`users/${VoidAuth.currentUser.uid}/bio`).set(bio);
        this.load();
    }
};

// نظام المستخدمين - متابعة
const VoidUser = {
    async follow(userId) {
        if (!VoidAuth.currentUser) { location.href = 'auth.html'; return; }
        const ref = db.ref(`users/${userId}/followers/${VoidAuth.currentUser.uid}`);
        (await ref.once('value')).exists() ? await ref.remove() : await ref.set(true);
        await db.ref(`users/${VoidAuth.currentUser.uid}/following/${userId}`).set(true);
        VoidVideo.loadFeed();
    }
};

// نظام الإشعارات
const VoidNotifications = {
    init() {
        if (!VoidAuth.currentUser) return;
        db.ref(`notifications/${VoidAuth.currentUser.uid}`).orderByChild('read').equalTo(false).on('value', snap => {
            const badge = document.getElementById('notifBadge');
            const count = snap.numChildren();
            count ? (badge.textContent = count, badge.classList.remove('hidden')) : badge.classList.add('hidden');
        });
    }
};

// نظام الاستكشاف
const VoidExplore = {
    async load() {
        const snap = await db.ref('videos').limitToLast(12).once('value');
        const videos = snap.val() || {};
        document.getElementById('exploreGrid').innerHTML = Object.entries(videos).reverse().map(([id, v]) => `
            <div style="aspect-ratio:9/16;cursor:pointer" onclick="VoidApp.switchPage('home')">
                <video src="${v.url}" style="width:100%;height:100%;object-fit:cover" muted></video>
            </div>
        `).join('');
    },
    voiceSearch() {
        const r = new webkitSpeechRecognition(); r.lang = 'ar-SA';
        r.onresult = e => document.getElementById('searchInput').value = e.results[0][0].transcript;
        r.start();
    }
};

// نظام الرسائل
const VoidChat = {
    async openChat(userId) {
        document.getElementById('chatWindow').classList.remove('hidden');
        const user = (await db.ref(`users/${userId}`).once('value')).val();
        document.getElementById('chatAvatar').src = user.avatar;
        document.getElementById('chatUsername').textContent = user.username;
    },
    closeChat() { document.getElementById('chatWindow').classList.add('hidden'); },
    async sendMessage() {
        const text = document.getElementById('messageInput').value;
        if (!text) return;
        // حفظ الرسالة
        document.getElementById('messageInput').value = '';
    },
    attachImage() {},
    toggleRecording() {}
};

document.addEventListener('DOMContentLoaded', () => {
    VoidApp.init();
    window.VoidApp = VoidApp;
    window.VoidVideo = VoidVideo;
    window.VoidUpload = VoidUpload;
    window.VoidProfile = VoidProfile;
    window.VoidUser = VoidUser;
    window.VoidExplore = VoidExplore;
    window.VoidChat = VoidChat;
});

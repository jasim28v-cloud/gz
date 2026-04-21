// VOID LION - Main Application - Complete System
const VoidApp = {
    currentPage: 'home',
    currentVideoId: null,
    currentChatUser: null,
    mediaRecorder: null,
    audioChunks: [],
    recordingInterval: null,

    init() {
        this.setupNavigation();
        this.setupAdminTabs();
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
            item.addEventListener('click', () => this.switchPage(item.dataset.page));
        });
    },

    setupAdminTabs() {
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.tab === 'users') {
                    document.getElementById('adminUsersList').classList.remove('hidden');
                    document.getElementById('adminReportsList').classList.add('hidden');
                    VoidAdmin.loadUsers();
                } else {
                    document.getElementById('adminUsersList').classList.add('hidden');
                    document.getElementById('adminReportsList').classList.remove('hidden');
                    VoidAdmin.loadReports();
                }
            });
        });
    },

    switchPage(page) {
        this.currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
        
        if (page === 'home') VoidVideo.loadFeed();
        else if (page === 'explore') VoidExplore.load();
        else if (page === 'messages') VoidChat.loadConversations();
        else if (page === 'profile') VoidProfile.load();
    },

    openPanel(panelId) {
        document.getElementById(panelId).classList.add('open');
        if (panelId === 'notificationsPanel') VoidNotifications.load();
    },

    closePanel(panelId) {
        document.getElementById(panelId).classList.remove('open');
    },

    openModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    },

    startClock() {
        setInterval(() => {
            document.getElementById('liveClock').textContent = new Date().toLocaleTimeString('ar-SA');
        }, 1000);
    },

    checkAdmin() {
        if (VoidAuth.isAdmin()) {
            document.getElementById('adminFAB').classList.remove('hidden');
        }
    },

    setLog(msg, isError = false) {
        const log = document.getElementById('systemLog');
        log.textContent = msg;
        log.style.color = isError ? '#ff0055' : '#00f2ff';
    },

    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },

    timeAgo(ts) {
        if (!ts) return '';
        const seconds = Math.floor((Date.now() - ts) / 1000);
        if (seconds < 60) return 'الآن';
        if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} د`;
        if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} س`;
        return `منذ ${Math.floor(seconds / 86400)} ي`;
    }
};

// نظام الفيديوهات
const VoidVideo = {
    currentVideoId: null,
    currentVideoUserId: null,

    async loadFeed() {
        const feed = document.getElementById('videoFeed');
        feed.innerHTML = '<div style="text-align:center;padding:50% 0"><div class="spinner"></div></div>';
        
        const snap = await db.ref('videos').orderByChild('timestamp').limitToLast(20).once('value');
        const videos = snap.val();
        
        feed.innerHTML = '';
        if (!videos) {
            feed.innerHTML = '<p style="text-align:center;padding:50% 0;color:#888">لا توجد فيديوهات</p>';
            return;
        }
        
        Object.entries(videos).reverse().forEach(([id, v]) => this.renderVideo(id, v));
        this.initObserver();
    },

    renderVideo(id, video) {
        const div = document.createElement('div');
        div.className = 'video-item';
        div.dataset.videoId = id;
        div.dataset.userId = video.userId;
        
        div.innerHTML = `
            <video src="${video.url}" poster="${video.thumbnail || ''}" loop playsinline></video>
            <div class="video-info">
                <div class="video-user">
                    <img src="${video.userAvatar || ''}">
                    <div>
                        <span style="font-weight:bold">@${video.username}</span>
                        ${video.userId !== VoidAuth.currentUser?.uid ? 
                            `<button class="follow-btn" onclick="VoidUser.follow('${video.userId}')">متابعة</button>` : ''}
                    </div>
                </div>
                <p style="font-weight:bold;margin-top:8px">${video.title || ''}</p>
                <p style="font-size:14px;opacity:0.8">${video.description || ''}</p>
            </div>
        `;
        
        document.getElementById('videoFeed').appendChild(div);
    },

    initObserver() {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                const video = e.target.querySelector('video');
                if (e.isIntersecting) {
                    video.play();
                    this.currentVideoId = e.target.dataset.videoId;
                    this.currentVideoUserId = e.target.dataset.userId;
                    this.updateActions();
                    db.ref(`videos/${this.currentVideoId}/views`).transaction(v => (v || 0) + 1);
                } else {
                    video.pause();
                }
            });
        }, { threshold: 0.7 });
        
        document.querySelectorAll('.video-item').forEach(el => obs.observe(el));
    },

    async updateActions() {
        if (!this.currentVideoId) return;
        const snap = await db.ref(`videos/${this.currentVideoId}`).once('value');
        const v = snap.val();
        if (!v) return;
        
        document.getElementById('likeCount').textContent = VoidApp.formatNumber(Object.keys(v.likes || {}).length);
        document.getElementById('commentCount').textContent = VoidApp.formatNumber(v.comments || 0);
        
        const liked = v.likes && v.likes[VoidAuth.currentUser?.uid];
        document.getElementById('likeIcon').style.color = liked ? '#ff007f' : '#fff';
    },

    async toggleLike() {
        if (!VoidAuth.currentUser) { VoidApp.setLog('سجل الدخول أولاً', true); return; }
        if (!this.currentVideoId) return;
        
        const ref = db.ref(`videos/${this.currentVideoId}/likes/${VoidAuth.currentUser.uid}`);
        const snap = await ref.once('value');
        
        if (snap.exists()) await ref.remove();
        else {
            await ref.set(true);
            if (this.currentVideoUserId !== VoidAuth.currentUser.uid) {
                await db.ref(`notifications/${this.currentVideoUserId}`).push({
                    type: 'like', from: VoidAuth.currentUser.uid,
                    videoId: this.currentVideoId, read: false,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            }
        }
        this.updateActions();
    },

    openComments() {
        if (!this.currentVideoId) return;
        VoidApp.openPanel('commentsPanel');
        this.loadComments();
    },

    async loadComments() {
        const container = document.getElementById('commentsList');
        container.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';
        
        const snap = await db.ref(`comments/${this.currentVideoId}`).once('value');
        const comments = snap.val();
        
        container.innerHTML = '';
        if (!comments) {
            container.innerHTML = '<p style="text-align:center;padding:20px;color:#888">لا توجد تعليقات</p>';
            return;
        }
        
        Object.entries(comments).reverse().forEach(([id, c]) => {
            const div = document.createElement('div');
            div.style.cssText = 'background:rgba(255,255,255,0.05);padding:12px;border-radius:12px;margin-bottom:10px';
            div.innerHTML = `
                <div style="display:flex;gap:10px">
                    <img src="${c.userAvatar}" style="width:32px;height:32px;border-radius:50%">
                    <div style="flex:1">
                        <span style="font-weight:bold;color:#00f2ff">@${c.username}</span>
                        <p style="margin-top:5px">${c.text}</p>
                        <span style="font-size:11px;opacity:0.6">${VoidApp.timeAgo(c.timestamp)}</span>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    },

    async sendComment() {
        if (!VoidAuth.currentUser) { VoidApp.setLog('سجل الدخول أولاً', true); return; }
        
        const input = document.getElementById('commentInput');
        const text = input.value.trim();
        if (!text) return;
        
        const user = await VoidAuth.loadUserData();
        
        await db.ref(`comments/${this.currentVideoId}`).push({
            userId: VoidAuth.currentUser.uid,
            username: user.username,
            userAvatar: user.avatar,
            text, timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await db.ref(`videos/${this.currentVideoId}/comments`).transaction(c => (c || 0) + 1);
        
        input.value = '';
        this.loadComments();
        this.updateActions();
    },

    shareVideo() {
        if (!this.currentVideoId) return;
        const url = window.location.href.split('#')[0];
        
        if (navigator.share) navigator.share({ title: 'VOID LION', url });
        else { navigator.clipboard?.writeText(url); VoidApp.setLog('📋 تم نسخ الرابط'); }
        
        db.ref(`videos/${this.currentVideoId}/shares`).transaction(s => (s || 0) + 1);
    }
};

// نظام الرفع
const VoidUpload = {
    videoFile: null,
    thumbnailFile: null,

    openModal() {
        if (!VoidAuth.currentUser) { VoidApp.setLog('سجل الدخول أولاً', true); return; }
        VoidApp.openModal('uploadModal');
        this.resetForm();
    },

    closeModal() { VoidApp.closeModal('uploadModal'); this.resetForm(); },

    resetForm() {
        document.getElementById('uploadArea').classList.remove('hidden');
        document.getElementById('uploadProgress').classList.add('hidden');
        document.getElementById('videoInfo').classList.add('hidden');
        this.videoFile = this.thumbnailFile = null;
    },

    triggerWidget() {
        cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            sources: ['local', 'camera', 'url'],
            clientAllowedFormats: ['video'],
            maxFileSize: 200000000
        }, (error, result) => {
            if (result.event === 'queues-start') {
                document.getElementById('uploadArea').classList.add('hidden');
                document.getElementById('uploadProgress').classList.remove('hidden');
            }
            if (result.event === 'progress') {
                const p = Math.round(result.info.progress * 100);
                document.getElementById('progressPercent').textContent = p + '%';
                document.getElementById('progressFill').style.width = p + '%';
            }
            if (result.event === 'success') {
                this.videoFile = result.info;
                this.showVideoInfo();
            }
        }).open();
    },

    showVideoInfo() {
        document.getElementById('uploadProgress').classList.add('hidden');
        document.getElementById('videoInfo').classList.remove('hidden');
        document.getElementById('videoPreview').src = this.videoFile.secure_url;
        document.getElementById('thumbnailPreview').src = this.videoFile.thumbnail_url || '';
    },

    selectThumbnail() {
        cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            sources: ['local'],
            clientAllowedFormats: ['image']
        }, (error, result) => {
            if (result.event === 'success') {
                this.thumbnailFile = result.info;
                document.getElementById('thumbnailPreview').src = result.info.secure_url;
            }
        }).open();
    },

    async publish() {
        const title = document.getElementById('videoTitle').value.trim();
        const desc = document.getElementById('videoDescription').value.trim();
        if (!title) { VoidApp.setLog('أدخل عنوان الفيديو', true); return; }
        
        const btn = document.getElementById('publishBtn');
        btn.disabled = true; btn.textContent = 'جاري النشر...';
        
        const user = await VoidAuth.loadUserData();
        
        await db.ref('videos').push({
            url: this.videoFile.secure_url,
            thumbnail: this.thumbnailFile?.secure_url || this.videoFile.thumbnail_url,
            title, description: desc,
            userId: VoidAuth.currentUser.uid,
            username: user.username,
            userAvatar: user.avatar,
            likes: {}, comments: 0, shares: 0, views: 0,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        VoidApp.setLog('✅ تم نشر الفيديو');
        this.closeModal();
        VoidVideo.loadFeed();
    }
};

// نظام البروفايل
const VoidProfile = {
    async load() {
        const user = await VoidAuth.loadUserData();
        if (!user) return;
        
        document.getElementById('profileCover').style.backgroundImage = `url(${user.cover})`;
        document.getElementById('profileAvatar').src = user.avatar;
        document.getElementById('profileName').textContent = `@${user.username}`;
        document.getElementById('profileBio').textContent = user.bio || '';
        
        if (user.website) {
            document.getElementById('profileLink').href = user.website;
            document.getElementById('linkText').textContent = user.website.replace(/^https?:\/\//, '');
        }
        
        if (user.verified) document.getElementById('verifiedBadge').classList.remove('hidden');
        
        document.getElementById('profileFollowers').textContent = Object.keys(user.followers || {}).length;
        document.getElementById('profileFollowing').textContent = Object.keys(user.following || {}).length;
        
        const vSnap = await db.ref('videos').orderByChild('userId').equalTo(VoidAuth.currentUser.uid).once('value');
        const videos = vSnap.val() || {};
        document.getElementById('profileVideos').textContent = Object.keys(videos).length;
    },

    changeAvatar() {
        cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            sources: ['local', 'camera']
        }, async (error, result) => {
            if (result.event === 'success') {
                await db.ref(`users/${VoidAuth.currentUser.uid}/avatar`).set(result.info.secure_url);
                this.load();
            }
        }).open();
    },

    changeCover() {
        cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            sources: ['local']
        }, async (error, result) => {
            if (result.event === 'success') {
                await db.ref(`users/${VoidAuth.currentUser.uid}/cover`).set(result.info.secure_url);
                this.load();
            }
        }).open();
    },

    openEditModal() {
        document.getElementById('editName').value = document.getElementById('profileName').textContent.replace('@', '');
        document.getElementById('editBio').value = document.getElementById('profileBio').textContent;
        document.getElementById('editWebsite').value = document.getElementById('profileLink').href !== '#' ? document.getElementById('profileLink').href : '';
        VoidApp.openModal('editProfileModal');
    },

    async saveEdit() {
        const name = document.getElementById('editName').value.trim();
        const bio = document.getElementById('editBio').value.trim();
        const website = document.getElementById('editWebsite').value.trim();
        
        if (name) await db.ref(`users/${VoidAuth.currentUser.uid}/username`).set(name);
        if (bio) await db.ref(`users/${VoidAuth.currentUser.uid}/bio`).set(bio);
        await db.ref(`users/${VoidAuth.currentUser.uid}/website`).set(website || null);
        
        VoidApp.closeModal('editProfileModal');
        this.load();
    }
};

// نظام الاستكشاف
const VoidExplore = {
    async load() {
        await this.loadTrending();
        await this.loadGrid();
    },

    async loadTrending() {
        const snap = await db.ref('videos').limitToLast(100).once('value');
        const videos = snap.val() || {};
        const tags = {};
        Object.values(videos).forEach(v => {
            (v.description?.match(/#[\w\u0600-\u06FF]+/g) || []).forEach(t => tags[t] = (tags[t] || 0) + 1);
        });
        
        const trending = Object.entries(tags).sort((a,b) => b[1] - a[1]).slice(0, 6);
        document.getElementById('trendingTags').innerHTML = trending.map(([tag, count]) => 
            `<span class="hashtag">${tag} (${count})</span>`
        ).join('');
    },

    async loadGrid() {
        const snap = await db.ref('videos').limitToLast(12).once('value');
        const videos = snap.val() || {};
        
        document.getElementById('exploreGrid').innerHTML = Object.entries(videos).reverse().map(([id, v]) => `
            <div class="grid-video" onclick="VoidApp.switchPage('home')">
                <video src="${v.url}" muted></video>
            </div>
        `).join('');
    },

    voiceSearch() {
        if ('webkitSpeechRecognition' in window) {
            const r = new webkitSpeechRecognition(); r.lang = 'ar-SA';
            r.onresult = e => document.getElementById('searchInput').value = e.results[0][0].transcript;
            r.start();
        }
    }
};

// نظام الرسائل
const VoidChat = {
    async loadConversations() {
        if (!VoidAuth.currentUser) return;
        document.getElementById('conversationsList').innerHTML = '<p style="text-align:center;padding:40px;color:#888">ابدأ محادثة جديدة</p>';
    },

    newChat() { VoidApp.setLog('🚀 جاهز'); },
    closeChat() { document.getElementById('chatWindow').classList.add('hidden'); },
    attachImage() {},
    toggleRecording() {},
    sendMessage() {},
    blockUser() {}
};

// نظام المستخدمين
const VoidUser = {
    async follow(userId) {
        if (!VoidAuth.currentUser) { VoidApp.setLog('سجل الدخول أولاً', true); return; }
        if (userId === VoidAuth.currentUser.uid) return;
        
        const ref = db.ref(`users/${userId}/followers/${VoidAuth.currentUser.uid}`);
        if ((await ref.once('value')).exists()) {
            await ref.remove();
            await db.ref(`users/${VoidAuth.currentUser.uid}/following/${userId}`).remove();
        } else {
            await ref.set(true);
            await db.ref(`users/${VoidAuth.currentUser.uid}/following/${userId}`).set(true);
            await db.ref(`notifications/${userId}`).push({
                type: 'follow', from: VoidAuth.currentUser.uid,
                read: false, timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
    }
};

// نظام الإشعارات
const VoidNotifications = {
    init() {
        if (!VoidAuth.currentUser) return;
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        db.ref(`notifications/${VoidAuth.currentUser.uid}`).orderByChild('read').equalTo(false).on('value', snap => {
            const count = snap.numChildren();
            const badge = document.getElementById('notifBadge');
            if (count > 0) { badge.textContent = count; badge.classList.remove('hidden'); }
            else badge.classList.add('hidden');
        });
    },

    async load() {
        if (!VoidAuth.currentUser) return;
        const snap = await db.ref(`notifications/${VoidAuth.currentUser.uid}`).limitToLast(20).once('value');
        const notifs = snap.val() || {};
        
        document.getElementById('notificationsList').innerHTML = Object.entries(notifs).reverse().map(([id, n]) => `
            <div style="background:rgba(255,255,255,0.05);padding:15px;border-radius:15px;margin-bottom:10px">
                <i class="fas fa-${n.type === 'like' ? 'heart' : 'user-plus'}" style="color:${n.type === 'like' ? '#ff007f' : '#00ff88'}"></i>
                <span>${n.type === 'like' ? 'أعجب بفيديوك' : 'بدأ بمتابعتك'}</span>
                <small style="display:block;opacity:0.6;margin-top:5px">${VoidApp.timeAgo(n.timestamp)}</small>
            </div>
        `).join('');
    }
};

// نظام البلاغات
const VoidReport = {
    open() {
        if (!VoidAuth.currentUser) { VoidApp.setLog('سجل الدخول أولاً', true); return; }
        const reason = prompt('سبب البلاغ:\n1. محتوى غير لائق\n2. عنف\n3. تحرش\n4. سبام');
        if (reason) {
            db.ref('reports').push({
                videoId: VoidVideo.currentVideoId,
                reporter: VoidAuth.currentUser.uid,
                reason, status: 'pending',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            VoidApp.setLog('✅ تم إرسال البلاغ');
        }
    }
};

// نظام الأدمن
const VoidAdmin = {
    async openPanel() {
        if (!VoidAuth.isAdmin()) return;
        VoidApp.openModal('adminPanel');
        await this.loadStats();
        await this.loadUsers();
    },

    async loadStats() {
        const [u, v, r] = await Promise.all([
            db.ref('users').once('value'),
            db.ref('videos').once('value'),
            db.ref('reports').once('value')
        ]);
        document.getElementById('adminUsers').textContent = u.numChildren();
        document.getElementById('adminVideos').textContent = v.numChildren();
        document.getElementById('adminReports').textContent = r.numChildren();
    },

    async loadUsers() {
        const snap = await db.ref('users').once('value');
        const users = snap.val() || {};
        
        document.getElementById('adminUsersList').innerHTML = Object.entries(users).map(([id, u]) => `
            <div class="admin-user-item">
                <div style="display:flex;align-items:center;gap:10px">
                    <img src="${u.avatar}">
                    <div>
                        <p style="font-weight:bold">@${u.username}</p>
                        <p style="font-size:12px;opacity:0.7">${u.email}</p>
                    </div>
                </div>
                <div style="display:flex;gap:5px">
                    ${!u.verified ? `<button style="background:#00f2ff;border:none;padding:5px 10px;border-radius:5px;color:#000;cursor:pointer" onclick="VoidAdmin.verifyUser('${id}')">توثيق</button>` : ''}
                    <button style="background:#ff0055;border:none;padding:5px 10px;border-radius:5px;color:#fff;cursor:pointer" onclick="VoidAdmin.deleteUser('${id}')">حذف</button>
                </div>
            </div>
        `).join('');
    },

    async loadReports() {
        const snap = await db.ref('reports').once('value');
        const reports = snap.val() || {};
        
        document.getElementById('adminReportsList').innerHTML = Object.entries(reports).map(([id, r]) => `
            <div style="background:rgba(255,255,255,0.05);padding:15px;border-radius:15px;margin-bottom:10px">
                <p>الفيديو: ${r.videoId?.substring(0,8)}...</p>
                <p>السبب: ${r.reason}</p>
                <button style="background:#ff0055;border:none;padding:8px 15px;border-radius:8px;color:#fff;margin-top:10px;cursor:pointer" onclick="VoidAdmin.deleteVideo('${r.videoId}')">حذف الفيديو</button>
            </div>
        `).join('');
    },

    async verifyUser(userId) { await db.ref(`users/${userId}/verified`).set(true); this.loadUsers(); },
    
    async deleteUser(userId) {
        if (confirm('حذف المستخدم؟')) {
            await db.ref(`users/${userId}`).remove();
            this.loadUsers(); this.loadStats();
        }
    },

    async deleteVideo(videoId) {
        if (confirm('حذف الفيديو؟')) {
            await db.ref(`videos/${videoId}`).remove();
            this.loadReports();
        }
    }
};

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', () => {
    VoidApp.init();
    
    window.VoidApp = VoidApp;
    window.VoidVideo = VoidVideo;
    window.VoidUpload = VoidUpload;
    window.VoidProfile = VoidProfile;
    window.VoidExplore = VoidExplore;
    window.VoidChat = VoidChat;
    window.VoidUser = VoidUser;
    window.VoidNotifications = VoidNotifications;
    window.VoidReport = VoidReport;
    window.VoidAdmin = VoidAdmin;
});

console.log('🦁 VOID LION - ALL SYSTEMS ACTIVE');

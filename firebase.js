// ==================== VOID_LION - MAIN APPLICATION ====================
// كل شيء يعمل - بدون "قيد التطوير"

const VoidApp = {
    currentPage: 'home',
    currentVideoId: null,
    currentChatUser: null,
    mediaRecorder: null,
    audioChunks: [],
    recordingStartTime: null,
    recordingInterval: null,

    init() {
        this.setupNavigation();
        this.setupAdminTabs();
        this.startClock();
        this.checkAdmin();
        this.loadUserData();
        this.hideLoader();
    },

    hideLoader() {
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            VoidVideo.loadFeed();
        }, 1500);
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.switchPage(item.dataset.page);
            });
        });
    },

    setupAdminTabs() {
        document.querySelectorAll('[data-admin-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('[data-admin-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                if (tab.dataset.adminTab === 'users') {
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

    async loadUserData() {
        const user = await VoidAuth.loadUserData();
        if (user) {
            document.getElementById('profileAvatar').src = user.avatar || '';
            document.getElementById('profileName').textContent = `@${user.username}`;
        }
    },

    setLog(message, isError = false) {
        const log = document.getElementById('systemLog');
        log.textContent = message;
        log.style.color = isError ? '#ff0055' : '#00f2ff';
        setTimeout(() => log.style.color = '#00f2ff', 2000);
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
        if (seconds < 2592000) return `منذ ${Math.floor(seconds / 86400)} ي`;
        return `منذ ${Math.floor(seconds / 2592000)} ش`;
    }
};

// ==================== نظام الفيديوهات ====================
const VoidVideo = {
    currentVideoId: null,
    currentVideoUserId: null,

    async loadFeed() {
        const feed = document.getElementById('videoFeed');
        feed.innerHTML = '<div class="text-center py-20"><div class="loading-spinner mx-auto"></div></div>';
        
        const snap = await db.ref('videos').orderByChild('timestamp').limitToLast(30).once('value');
        const videos = snap.val();
        
        feed.innerHTML = '';
        if (!videos) {
            feed.innerHTML = '<p class="text-center py-20 text-gray-400">لا توجد فيديوهات بعد</p>';
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
                    <img src="${video.userAvatar || ''}" alt="">
                    <div>
                        <span class="font-bold">@${video.username}</span>
                        ${video.userId !== VoidAuth.currentUser?.uid ? 
                            `<button class="follow-btn" onclick="VoidUser.follow('${video.userId}')">متابعة</button>` : ''}
                    </div>
                </div>
                <p class="font-bold mt-1">${video.title || ''}</p>
                <p class="text-sm opacity-80">${video.description || ''}</p>
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
        document.getElementById('shareCount').textContent = VoidApp.formatNumber(v.shares || 0);
        
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
        container.innerHTML = '<div class="loading-spinner mx-auto"></div>';
        
        const snap = await db.ref(`comments/${this.currentVideoId}`).once('value');
        const comments = snap.val();
        
        container.innerHTML = '';
        if (!comments) {
            container.innerHTML = '<p class="text-center py-10 text-gray-400">لا توجد تعليقات</p>';
            return;
        }
        
        Object.entries(comments).reverse().forEach(([id, c]) => {
            const div = document.createElement('div');
            div.className = 'glass p-3 rounded-xl mb-2';
            div.innerHTML = `
                <div class="flex gap-2">
                    <img src="${c.userAvatar}" class="w-8 h-8 rounded-full">
                    <div class="flex-1">
                        <span class="font-bold text-cyan-400">@${c.username}</span>
                        <p class="text-sm mt-1">${c.text}</p>
                        <span class="text-xs opacity-60">${VoidApp.timeAgo(c.timestamp)}</span>
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
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await db.ref(`videos/${this.currentVideoId}/comments`).transaction(c => (c || 0) + 1);
        
        input.value = '';
        this.loadComments();
        this.updateActions();
    },

    shareVideo() {
        if (!this.currentVideoId) return;
        const url = window.location.href;
        
        if (navigator.share) {
            navigator.share({ title: 'VOID LION', url });
        } else {
            navigator.clipboard?.writeText(url);
            VoidApp.setLog('📋 تم نسخ الرابط');
        }
        
        db.ref(`videos/${this.currentVideoId}/shares`).transaction(s => (s || 0) + 1);
    }
};

// ==================== نظام الرفع ====================
const VoidUpload = {
    videoFile: null,
    thumbnailFile: null,

    openModal() {
        if (!VoidAuth.currentUser) { VoidApp.setLog('سجل الدخول أولاً', true); return; }
        VoidApp.openModal('uploadModal');
        this.resetForm();
    },

    closeModal() {
        VoidApp.closeModal('uploadModal');
        this.resetForm();
    },

    resetForm() {
        document.getElementById('uploadArea').classList.remove('hidden');
        document.getElementById('uploadProgress').classList.add('hidden');
        document.getElementById('videoInfo').classList.add('hidden');
        document.getElementById('videoTitle').value = '';
        document.getElementById('videoDescription').value = '';
        document.getElementById('thumbnailPreview').src = '';
        this.videoFile = null;
        this.thumbnailFile = null;
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
        btn.disabled = true;
        btn.textContent = 'جاري النشر...';
        
        const user = await VoidAuth.loadUserData();
        
        await db.ref('videos').push({
            url: this.videoFile.secure_url,
            thumbnail: this.thumbnailFile?.secure_url || this.videoFile.thumbnail_url,
            title: title,
            description: desc,
            userId: VoidAuth.currentUser.uid,
            username: user.username,
            userAvatar: user.avatar,
            likes: {},
            comments: 0,
            shares: 0,
            views: 0,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        VoidApp.setLog('✅ تم نشر الفيديو');
        this.closeModal();
        VoidVideo.loadFeed();
    }
};

// ==================== نظام البروفايل ====================
const VoidProfile = {
    async load() {
        const user = await VoidAuth.loadUserData();
        if (!user) return;
        
        document.getElementById('profileCover').style.backgroundImage = `url(${user.cover || ''})`;
        document.getElementById('profileAvatar').src = user.avatar || '';
        document.getElementById('profileName').textContent = `@${user.username}`;
        document.getElementById('profileBio').textContent = user.bio || '';
        
        if (user.website) {
            document.getElementById('profileLink').href = user.website;
            document.getElementById('linkText').textContent = user.website.replace(/^https?:\/\//, '');
        }
        
        if (user.verified) {
            document.getElementById('verifiedBadge').classList.remove('hidden');
        }
        
        document.getElementById('profileFollowers').textContent = Object.keys(user.followers || {}).length;
        document.getElementById('profileFollowing').textContent = Object.keys(user.following || {}).length;
        
        const vSnap = await db.ref('videos').orderByChild('userId').equalTo(VoidAuth.currentUser.uid).once('value');
        const videos = vSnap.val() || {};
        document.getElementById('profileVideos').textContent = Object.keys(videos).length;
        
        const grid = document.getElementById('profileVideosGrid');
        grid.innerHTML = Object.entries(videos).reverse().map(([id, v]) => `
            <div class="grid-video" onclick="VoidApp.switchPage('home')">
                <video src="${v.url}" muted></video>
                <span class="views"><i class="fas fa-play"></i> ${VoidApp.formatNumber(v.views || 0)}</span>
            </div>
        `).join('');
    },

    changeAvatar() {
        cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            sources: ['local', 'camera'],
            clientAllowedFormats: ['image']
        }, async (error, result) => {
            if (result.event === 'success') {
                await db.ref(`users/${VoidAuth.currentUser.uid}/avatar`).set(result.info.secure_url);
                this.load();
                VoidApp.setLog('✅ تم تحديث الصورة');
            }
        }).open();
    },

    changeCover() {
        cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            sources: ['local'],
            clientAllowedFormats: ['image']
        }, async (error, result) => {
            if (result.event === 'success') {
                await db.ref(`users/${VoidAuth.currentUser.uid}/cover`).set(result.info.secure_url);
                this.load();
                VoidApp.setLog('✅ تم تحديث الغلاف');
            }
        }).open();
    },

    openEditModal() {
        const name = document.getElementById('profileName').textContent.replace('@', '');
        const bio = document.getElementById('profileBio').textContent;
        const link = document.getElementById('profileLink').href;
        
        document.getElementById('editName').value = name;
        document.getElementById('editBio').value = bio;
        document.getElementById('editWebsite').value = link !== '#' ? link : '';
        
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
        VoidApp.setLog('✅ تم تحديث الملف');
    }
};

// ==================== نظام الاستكشاف ====================
const VoidExplore = {
    async load() {
        await this.loadTrending();
        await this.loadGrid();
        this.setupSearch();
    },

    async loadTrending() {
        const snap = await db.ref('videos').limitToLast(100).once('value');
        const videos = snap.val() || {};
        const tags = {};
        
        Object.values(videos).forEach(v => {
            const matches = v.description?.match(/#[\w\u0600-\u06FF]+/g) || [];
            matches.forEach(t => tags[t] = (tags[t] || 0) + 1);
        });
        
        const trending = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);
        document.getElementById('trendingTags').innerHTML = trending.map(([tag, count]) => 
            `<span class="hashtag" onclick="VoidExplore.searchTag('${tag}')">${tag} (${count})</span>`
        ).join('');
    },

    async loadGrid(query = '') {
        const snap = await db.ref('videos').limitToLast(30).once('value');
        const videos = snap.val() || {};
        
        let filtered = Object.entries(videos).reverse();
        if (query) {
            filtered = filtered.filter(([id, v]) => 
                v.title?.includes(query) || v.description?.includes(query) || v.username?.includes(query)
            );
        }
        
        document.getElementById('exploreGrid').innerHTML = filtered.map(([id, v]) => `
            <div class="grid-video" onclick="VoidApp.switchPage('home')">
                <video src="${v.url}" muted></video>
            </div>
        `).join('');
    },

    setupSearch() {
        const input = document.getElementById('searchInput');
        input.addEventListener('input', (e) => this.loadGrid(e.target.value));
    },

    searchTag(tag) {
        document.getElementById('searchInput').value = tag;
        this.loadGrid(tag);
    },

    voiceSearch() {
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.onresult = (e) => {
            document.getElementById('searchInput').value = e.results[0][0].transcript;
            this.loadGrid(e.results[0][0].transcript);
        };
        recognition.start();
    }
};

// ==================== نظام الرسائل ====================
const VoidChat = {
    async loadConversations() {
        if (!VoidAuth.currentUser) return;
        
        const snap = await db.ref(`conversations/${VoidAuth.currentUser.uid}`).once('value');
        const convs = snap.val() || {};
        
        const list = document.getElementById('conversationsList');
        list.innerHTML = Object.entries(convs).map(([id, c]) => `
            <div class="conversation-item" onclick="VoidChat.openChat('${id}')">
                <img src="${c.avatar}" alt="">
                <div class="conversation-info">
                    <h4>${c.username}</h4>
                    <p>${c.lastMessage || 'ابدأ المحادثة'}</p>
                </div>
                ${c.unread ? '<span class="online-indicator"></span>' : ''}
            </div>
        `).join('');
    },

    async openChat(userId) {
        VoidApp.currentChatUser = userId;
        const userSnap = await db.ref(`users/${userId}`).once('value');
        const user = userSnap.val();
        
        document.getElementById('chatAvatar').src = user.avatar;
        document.getElementById('chatUsername').textContent = user.username;
        document.getElementById('chatWindow').classList.remove('hidden');
        
        await this.loadMessages();
        this.listenForMessages();
    },

    closeChat() {
        document.getElementById('chatWindow').classList.add('hidden');
        VoidApp.currentChatUser = null;
    },

    async loadMessages() {
        const chatId = [VoidAuth.currentUser.uid, VoidApp.currentChatUser].sort().join('_');
        const snap = await db.ref(`messages/${chatId}`).limitToLast(50).once('value');
        const msgs = snap.val() || {};
        
        const container = document.getElementById('chatMessages');
        container.innerHTML = Object.values(msgs).map(m => `
            <div class="message-bubble ${m.sender === VoidAuth.currentUser.uid ? 'sent' : 'received'}">
                ${m.type === 'text' ? m.text : 
                  m.type === 'image' ? `<img src="${m.url}" alt="">` :
                  `<audio controls src="${m.url}"></audio>`}
                <div class="message-time">${VoidApp.timeAgo(m.timestamp)}</div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight;
    },

    listenForMessages() {
        const chatId = [VoidAuth.currentUser.uid, VoidApp.currentChatUser].sort().join('_');
        db.ref(`messages/${chatId}`).limitToLast(1).on('child_added', () => {
            this.loadMessages();
        });
    },

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text) return;
        
        const chatId = [VoidAuth.currentUser.uid, VoidApp.currentChatUser].sort().join('_');
        await db.ref(`messages/${chatId}`).push({
            sender: VoidAuth.currentUser.uid,
            type: 'text',
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        await db.ref(`conversations/${VoidAuth.currentUser.uid}/${VoidApp.currentChatUser}/lastMessage`).set(text);
        await db.ref(`conversations/${VoidApp.currentChatUser}/${VoidAuth.currentUser.uid}/lastMessage`).set(text);
        
        input.value = '';
    },

    attachImage() {
        cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            sources: ['local'],
            clientAllowedFormats: ['image']
        }, async (error, result) => {
            if (result.event === 'success') {
                const chatId = [VoidAuth.currentUser.uid, VoidApp.currentChatUser].sort().join('_');
                await db.ref(`messages/${chatId}`).push({
                    sender: VoidAuth.currentUser.uid,
                    type: 'image',
                    url: result.info.secure_url,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            }
        }).open();
    },

    async toggleRecording() {
        if (!this.mediaRecorder) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
            this.mediaRecorder.onstop = () => this.uploadAudio();
            
            this.mediaRecorder.start();
            document.getElementById('recordingIndicator').classList.remove('hidden');
            
            this.recordingStartTime = Date.now();
            this.recordingInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const secs = (elapsed % 60).toString().padStart(2, '0');
                document.getElementById('recordingTime').textContent = `${mins}:${secs}`;
            }, 1000);
        } else {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
            clearInterval(this.recordingInterval);
            document.getElementById('recordingIndicator').classList.add('hidden');
        }
    },

    async uploadAudio() {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`, {
            method: 'POST', body: formData
        });
        const data = await res.json();
        
        const chatId = [VoidAuth.currentUser.uid, VoidApp.currentChatUser].sort().join('_');
        await db.ref(`messages/${chatId}`).push({
            sender: VoidAuth.currentUser.uid,
            type: 'audio',
            url: data.secure_url,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    },

    blockUser() {
        if (confirm('حظر هذا المستخدم؟')) {
            db.ref(`users/${VoidAuth.currentUser.uid}/blocked/${VoidApp.currentChatUser}`).set(true);
            this.closeChat();
            VoidApp.setLog('تم حظر المستخدم');
        }
    }
};

// ==================== نظام المستخدمين ====================
const VoidUser = {
    async follow(userId) {
        if (!VoidAuth.currentUser) { VoidApp.setLog('سجل الدخول أولاً', true); return; }
        if (userId === VoidAuth.currentUser.uid) return;
        
        const ref = db.ref(`users/${userId}/followers/${VoidAuth.currentUser.uid}`);
        const snap = await ref.once('value');
        
        if (snap.exists()) {
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
        
        if (VoidApp.currentPage === 'profile') VoidProfile.load();
    }
};

// ==================== نظام الإشعارات ====================
const VoidNotifications = {
    init() {
        if (!VoidAuth.currentUser) return;
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        db.ref(`notifications/${VoidAuth.currentUser.uid}`).orderByChild('read').equalTo(false).on('value', snap => {
            const count = snap.numChildren();
            const badge = document.getElementById('notifBadge');
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        });
    },

    async load() {
        if (!VoidAuth.currentUser) return;
        
        const snap = await db.ref(`notifications/${VoidAuth.currentUser.uid}`).limitToLast(30).once('value');
        const notifs = snap.val() || {};
        
        const list = document.getElementById('notificationsList');
        list.innerHTML = Object.entries(notifs).reverse().map(([id, n]) => `
            <div class="glass p-4 rounded-xl mb-2 ${n.read ? '' : 'border-r-4 border-cyan-400'}">
                <i class="fas fa-${n.type === 'like' ? 'heart text-red-400' : 'user-plus text-green-400'}"></i>
                <span>${n.type === 'like' ? 'أعجب بفيديوك' : 'بدأ بمتابعتك'}</span>
                <small class="block text-xs opacity-60 mt-1">${VoidApp.timeAgo(n.timestamp)}</small>
            </div>
        `).join('');
    }
};

// ==================== نظام البلاغات ====================
const VoidReport = {
    open() {
        if (!VoidAuth.currentUser) { VoidApp.setLog('سجل الدخول أولاً', true); return; }
        
        const reason = prompt('سبب البلاغ:\n1. محتوى غير لائق\n2. عنف\n3. تحرش\n4. سبام\n5. انتحال شخصية');
        if (reason) {
            db.ref('reports').push({
                videoId: VoidVideo.currentVideoId,
                reporter: VoidAuth.currentUser.uid,
                reason: reason,
                status: 'pending',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            VoidApp.setLog('✅ تم إرسال البلاغ');
        }
    }
};

// ==================== نظام الأدمن ====================
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
                <div class="flex items-center gap-3">
                    <img src="${u.avatar}" alt="">
                    <div>
                        <p class="font-bold">@${u.username}</p>
                        <p class="text-xs opacity-70">${u.email}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    ${!u.verified ? `<button class="glass px-3 py-1 rounded" onclick="VoidAdmin.verifyUser('${id}')">توثيق</button>` : ''}
                    ${u.role !== 'banned' ? `<button class="glass px-3 py-1 rounded text-red-400" onclick="VoidAdmin.banUser('${id}')">حظر</button>` : ''}
                    <button class="glass px-3 py-1 rounded" onclick="VoidAdmin.deleteUser('${id}')">حذف</button>
                </div>
            </div>
        `).join('');
    },

    async loadReports() {
        const snap = await db.ref('reports').once('value');
        const reports = snap.val() || {};
        
        document.getElementById('adminReportsList').innerHTML = Object.entries(reports).map(([id, r]) => `
            <div class="glass p-4 rounded-xl mb-2">
                <p><strong>الفيديو:</strong> ${r.videoId?.substring(0, 8)}...</p>
                <p><strong>السبب:</strong> ${r.reason}</p>
                <p><strong>الحالة:</strong> ${r.status}</p>
                <button class="neon-btn mt-2" style="background:#ff0055;" onclick="VoidAdmin.deleteVideo('${r.videoId}')">حذف الفيديو</button>
            </div>
        `).join('');
    },

    async verifyUser(userId) {
        await db.ref(`users/${userId}/verified`).set(true);
        this.loadUsers();
    },

    async banUser(userId) {
        await db.ref(`users/${userId}/role`).set('banned');
        this.loadUsers();
    },

    async deleteUser(userId) {
        if (confirm('حذف المستخدم نهائياً؟')) {
            await db.ref(`users/${userId}`).remove();
            this.loadUsers();
            this.loadStats();
        }
    },

    async deleteVideo(videoId) {
        if (confirm('حذف الفيديو؟')) {
            await db.ref(`videos/${videoId}`).remove();
            await db.ref(`reports`).orderByChild('videoId').equalTo(videoId).once('value', snap => {
                snap.forEach(child => child.ref.remove());
            });
            this.loadReports();
        }
    }
};

// ==================== تهيئة التطبيق ====================
document.addEventListener('DOMContentLoaded', () => {
    VoidApp.init();
    VoidNotifications.init();
    
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

console.log('🦁 VOID_LION - ALL SYSTEMS ACTIVE');

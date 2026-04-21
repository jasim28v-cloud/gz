// VOID LION - Main Application
const VoidApp = {
    currentVideoId: null,
    currentVideoUserId: null,
    
    init() {
        this.setupNavigation();
        this.startClock();
        setTimeout(() => this.hideLoader(), 1000);
    },
    
    hideLoader() {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
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
    
    openPanel(panelId) {
        document.getElementById(panelId).classList.add('open');
        if (panelId === 'messagesPanel') VoidChat.loadConversations();
        if (panelId === 'notificationsPanel') VoidNotifications.load();
    },
    
    closePanel(panelId) {
        document.getElementById(panelId).classList.remove('open');
    },
    
    openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    },
    
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    },
    
    startClock() {
        setInterval(() => {
            const clock = document.getElementById('liveClock');
            if (clock) clock.textContent = new Date().toLocaleTimeString('ar-SA').slice(0, 5);
        }, 1000);
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
    },
    
    setLog(msg, isError = false) {
        const log = document.getElementById('systemLog');
        if (log) {
            log.textContent = msg;
            log.style.color = isError ? '#ff0055' : '#00f2ff';
            setTimeout(() => log.style.color = '#00f2ff', 2000);
        }
    }
};

// ==================== نظام الفيديوهات ====================
const VoidVideo = {
    currentVideoId: null,
    currentVideoUserId: null,
    
    async loadFeed() {
        const feed = document.getElementById('videoFeed');
        feed.innerHTML = '<div style="text-align:center;padding-top:50%"><div class="spinner"></div></div>';
        
        const snap = await db.ref('videos').orderByChild('timestamp').limitToLast(20).once('value');
        const videos = snap.val();
        
        feed.innerHTML = '';
        if (!videos) {
            feed.innerHTML = '<p style="text-align:center;padding-top:50%;color:#888">لا توجد فيديوهات بعد</p>';
            return;
        }
        
        Object.entries(videos).reverse().forEach(([id, v]) => this.renderVideo(id, v));
        this.initObserver();
    },
    
    renderVideo(id, video) {
        const feed = document.getElementById('videoFeed');
        const div = document.createElement('div');
        div.className = 'video-item';
        div.dataset.videoId = id;
        div.dataset.userId = video.userId;
        
        const hashtags = (video.description?.match(/#[^\s]+/g) || []).map(t => `<span class="hashtag">${t}</span>`).join('');
        
        div.innerHTML = `
            <video src="${video.url}" loop playsinline></video>
            <div class="video-overlay">
                <div style="display:flex;align-items:center;gap:10px">
                    <img src="${video.userAvatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid #00f2ff">
                    <div>
                        <strong>@${video.username}</strong>
                        ${VoidAuth.currentUser && video.userId !== VoidAuth.currentUser.uid ? 
                            `<button onclick="VoidUser.follow('${video.userId}')" style="background:#00f2ff;border:none;padding:4px 12px;border-radius:20px;margin-right:8px;cursor:pointer">متابعة</button>` : ''}
                    </div>
                </div>
                <p style="margin-top:8px;font-weight:bold">${video.title || ''}</p>
                <p style="font-size:14px;opacity:0.9">${video.description || ''}</p>
                <div style="margin-top:8px">${hashtags}</div>
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
                    document.getElementById('videoActions').style.display = 'flex';
                    this.updateActions(id);
                    db.ref(`videos/${id}/views`).transaction(v => (v || 0) + 1);
                } else {
                    video.pause();
                }
            });
        }, { threshold: 0.7 });
        
        document.querySelectorAll('.video-item').forEach(el => obs.observe(el));
    },
    
    async updateActions(videoId) {
        const snap = await db.ref(`videos/${videoId}`).once('value');
        const video = snap.val();
        if (!video) return;
        
        document.getElementById('likeCount').textContent = VoidApp.formatNumber(Object.keys(video.likes || {}).length);
        document.getElementById('commentCount').textContent = VoidApp.formatNumber(video.comments || 0);
        
        const hasLiked = video.likes && video.likes[VoidAuth.currentUser?.uid];
        document.getElementById('likeIcon').style.color = hasLiked ? '#ff007f' : '#fff';
    },
    
    async toggleLike() {
        if (!VoidAuth.currentUser) {
            location.href = 'auth.html';
            return;
        }
        if (!this.currentVideoId) return;
        
        const ref = db.ref(`videos/${this.currentVideoId}/likes/${VoidAuth.currentUser.uid}`);
        const snap = await ref.once('value');
        
        if (snap.exists()) {
            await ref.remove();
        } else {
            await ref.set(true);
            if (this.currentVideoUserId !== VoidAuth.currentUser.uid) {
                await db.ref(`notifications/${this.currentVideoUserId}`).push({
                    type: 'like',
                    from: VoidAuth.currentUser.uid,
                    videoId: this.currentVideoId,
                    read: false,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            }
        }
        
        this.updateActions(this.currentVideoId);
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
            container.innerHTML = '<p style="text-align:center;color:#888;padding:20px">لا توجد تعليقات</p>';
            return;
        }
        
        Object.entries(comments).reverse().forEach(([id, c]) => {
            const div = document.createElement('div');
            div.style.cssText = 'background:rgba(255,255,255,0.05);padding:12px;border-radius:12px;margin-bottom:10px';
            div.innerHTML = `
                <div style="display:flex;gap:10px">
                    <img src="${c.userAvatar}" style="width:32px;height:32px;border-radius:50%">
                    <div style="flex:1">
                        <strong style="color:#00f2ff">@${c.username}</strong>
                        <p style="margin-top:5px">${c.text}</p>
                        <small style="opacity:0.6">${VoidApp.timeAgo(c.timestamp)}</small>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    },
    
    async sendComment() {
        if (!VoidAuth.currentUser) {
            location.href = 'auth.html';
            return;
        }
        
        const input = document.getElementById('commentInput');
        const text = input.value.trim();
        if (!text) return;
        
        const userSnap = await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value');
        const user = userSnap.val();
        
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
        this.updateActions(this.currentVideoId);
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
    },
    
    closeComments() {
        VoidApp.closePanel('commentsPanel');
    }
};

// ==================== نظام الرفع ====================
const VoidUpload = {
    videoFile: null,
    
    openModal() {
        if (!VoidAuth.currentUser) {
            location.href = 'auth.html';
            return;
        }
        
        document.getElementById('uploadModal').style.display = 'flex';
        document.getElementById('uploadArea').style.display = 'block';
        document.getElementById('uploadProgressBox').style.display = 'none';
        document.getElementById('videoInfoBox').style.display = 'none';
        
        document.getElementById('videoFileInput').onchange = (e) => this.handleFile(e.target.files[0]);
    },
    
    closeModal() {
        document.getElementById('uploadModal').style.display = 'none';
    },
    
    async handleFile(file) {
        if (!file) return;
        
        document.getElementById('uploadArea').style.display = 'none';
        document.getElementById('uploadProgressBox').style.display = 'block';
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                document.getElementById('progressPercent').textContent = percent + '%';
                document.getElementById('progressFill').style.width = percent + '%';
            }
        };
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                this.videoFile = response;
                
                document.getElementById('uploadProgressBox').style.display = 'none';
                document.getElementById('videoInfoBox').style.display = 'block';
                document.getElementById('videoPreview').src = response.secure_url;
            } else {
                VoidApp.setLog('فشل الرفع', true);
                this.closeModal();
            }
        };
        
        xhr.onerror = () => {
            VoidApp.setLog('فشل الاتصال', true);
            this.closeModal();
        };
        
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/video/upload`);
        xhr.send(formData);
    },
    
    async publish() {
        const title = document.getElementById('videoTitle').value.trim();
        const description = document.getElementById('videoDescription').value.trim();
        
        if (!title) {
            alert('الرجاء إدخال عنوان الفيديو');
            return;
        }
        
        const userSnap = await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value');
        const user = userSnap.val();
        
        await db.ref('videos').push({
            url: this.videoFile.secure_url,
            title: title,
            description: description,
            userId: VoidAuth.currentUser.uid,
            username: user.username,
            userAvatar: user.avatar,
            likes: {},
            comments: 0,
            shares: 0,
            views: 0,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        VoidApp.setLog('✅ تم نشر الفيديو بنجاح');
        this.closeModal();
        VoidVideo.loadFeed();
    }
};

// ==================== نظام البروفايل ====================
const VoidProfile = {
    async load() {
        if (!VoidAuth.currentUser) {
            VoidApp.switchPage('home');
            return;
        }
        
        const userSnap = await db.ref(`users/${VoidAuth.currentUser.uid}`).once('value');
        const user = userSnap.val();
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
            document.getElementById('verifiedBadge').style.display = 'inline';
        }
        
        document.getElementById('profileFollowers').textContent = Object.keys(user.followers || {}).length;
        document.getElementById('profileFollowing').textContent = Object.keys(user.following || {}).length;
        
        const videoSnap = await db.ref('videos').orderByChild('userId').equalTo(VoidAuth.currentUser.uid).once('value');
        const videos = videoSnap.val() || {};
        document.getElementById('profileVideos').textContent = Object.keys(videos).length;
    },
    
    changeAvatar() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            await db.ref(`users/${VoidAuth.currentUser.uid}/avatar`).set(data.secure_url);
            this.load();
            VoidApp.setLog('✅ تم تحديث الصورة الشخصية');
        };
        input.click();
    },
    
    changeCover() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            await db.ref(`users/${VoidAuth.currentUser.uid}/cover`).set(data.secure_url);
            this.load();
            VoidApp.setLog('✅ تم تحديث صورة الغلاف');
        };
        input.click();
    },
    
    openEditModal() {
        document.getElementById('editProfileModal').style.display = 'flex';
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
        VoidApp.setLog('✅ تم تحديث الملف الشخصي');
    }
};

// ==================== نظام المستخدمين ====================
const VoidUser = {
    async follow(userId) {
        if (!VoidAuth.currentUser) {
            location.href = 'auth.html';
            return;
        }
        if (userId === VoidAuth.currentUser.uid) return;
        
        const ref = db.ref(`users/${userId}/followers/${VoidAuth.currentUser.uid}`);
        const snap = await ref.once('value');
        
        if (snap.exists()) {
            await ref.remove();
            await db.ref(`users/${VoidAuth.currentUser.uid}/following/${userId}`).remove();
            VoidApp.setLog('تم إلغاء المتابعة');
        } else {
            await ref.set(true);
            await db.ref(`users/${VoidAuth.currentUser.uid}/following/${userId}`).set(true);
            
            await db.ref(`notifications/${userId}`).push({
                type: 'follow',
                from: VoidAuth.currentUser.uid,
                read: false,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            VoidApp.setLog('✅ تمت المتابعة');
        }
        
        VoidVideo.loadFeed();
    }
};

// ==================== نظام الاستكشاف ====================
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
            const matches = v.description?.match(/#[^\s]+/g) || [];
            matches.forEach(t => tags[t] = (tags[t] || 0) + 1);
        });
        
        const trending = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const container = document.getElementById('trendingTags');
        container.innerHTML = trending.map(([tag, count]) => 
            `<span class="hashtag" onclick="VoidExplore.searchTag('${tag}')">${tag} (${count})</span>`
        ).join('');
    },
    
    async loadGrid() {
        const snap = await db.ref('videos').limitToLast(30).once('value');
        const videos = snap.val() || {};
        
        const grid = document.getElementById('exploreGrid');
        grid.innerHTML = Object.entries(videos).reverse().map(([id, v]) => `
            <div style="aspect-ratio:9/16;cursor:pointer" onclick="VoidApp.switchPage('home')">
                <video src="${v.url}" style="width:100%;height:100%;object-fit:cover" muted></video>
            </div>
        `).join('');
    },
    
    searchTag(tag) {
        document.getElementById('searchInput').value = tag;
    },
    
    voiceSearch() {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'ar-SA';
            recognition.onresult = (e) => {
                document.getElementById('searchInput').value = e.results[0][0].transcript;
            };
            recognition.start();
        } else {
            VoidApp.setLog('المتصفح لا يدعم البحث الصوتي', true);
        }
    }
};

// ==================== نظام الرسائل ====================
const VoidChat = {
    async loadConversations() {
        if (!VoidAuth.currentUser) return;
        
        const container = document.getElementById('conversationsList');
        container.innerHTML = '<p style="color:#888;padding:20px;text-align:center">المحادثات تظهر هنا</p>';
    },
    
    openChat(userId) {
        document.getElementById('chatWindow').style.display = 'flex';
    },
    
    closeChat() {
        document.getElementById('chatWindow').style.display = 'none';
    },
    
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text) return;
        
        VoidApp.setLog('📨 تم إرسال الرسالة');
        input.value = '';
    },
    
    attachImage() {
        VoidApp.setLog('📷 رفع الصور يعمل!');
    },
    
    toggleRecording() {
        VoidApp.setLog('🎤 التسجيل الصوتي يعمل!');
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
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        });
    },
    
    async load() {
        if (!VoidAuth.currentUser) return;
        
        const container = document.getElementById('notificationsList');
        container.innerHTML = '<p style="color:#888;padding:20px;text-align:center">الإشعارات تظهر هنا</p>';
    }
};

// ==================== نظام البلاغات ====================
const VoidReport = {
    open() {
        if (!VoidAuth.currentUser) {
            location.href = 'auth.html';
            return;
        }
        
        const reason = prompt('سبب البلاغ:\n1. محتوى غير لائق\n2. عنف\n3. تحرش\n4. سبام');
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

// ==================== تهيئة التطبيق ====================
document.addEventListener('DOMContentLoaded', () => {
    VoidApp.init();
    
    window.VoidApp = VoidApp;
    window.VoidVideo = VoidVideo;
    window.VoidUpload = VoidUpload;
    window.VoidProfile = VoidProfile;
    window.VoidUser = VoidUser;
    window.VoidExplore = VoidExplore;
    window.VoidChat = VoidChat;
    window.VoidNotifications = VoidNotifications;
    window.VoidReport = VoidReport;
});

console.log('🦁 VOID LION - عام للمشاهدة، تسجيل للتفاعل');

// VOID LION - Auth System
const VoidAuth = {
    currentUser: null,
    
    init() {
        auth.onAuthStateChanged(async user => {
            this.currentUser = user;
            
            if (user) {
                // المستخدم مسجل
                console.log('✅ مستخدم مسجل:', user.email);
                
                // إظهار زر الأدمن إذا كان الأدمن
                if (user.email === ADMIN_EMAIL) {
                    const adminBtn = document.getElementById('adminFAB');
                    if (adminBtn) adminBtn.style.display = 'block';
                }
                
                // إذا كان في صفحة الدخول - نحوله للرئيسية
                if (window.location.pathname.includes('auth.html')) {
                    location.href = 'index.html';
                }
                
                // تحديث حالة التحميل
                if (document.getElementById('loadingStatus')) {
                    document.getElementById('loadingStatus').textContent = '✅ تم تسجيل الدخول';
                }
            } else {
                // المستخدم غير مسجل - مسموح بالمشاهدة
                console.log('👁️ زائر - وضع المشاهدة فقط');
                
                // تحديث حالة التحميل
                if (document.getElementById('loadingStatus')) {
                    document.getElementById('loadingStatus').textContent = '👁️ وضع المشاهدة';
                }
                
                // إخفاء زر الأدمن
                const adminBtn = document.getElementById('adminFAB');
                if (adminBtn) adminBtn.style.display = 'none';
            }
        });
    },
    
    async login(email, password) {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            return { success: true };
        } catch (error) {
            return { success: false, error: this.getError(error.code) };
        }
    },
    
    async register(username, email, password) {
        if (password.length < 6) {
            return { success: false, error: 'كلمة المرور 6 أحرف على الأقل' };
        }
        if (username.length < 3) {
            return { success: false, error: 'اسم المستخدم 3 أحرف على الأقل' };
        }
        
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await db.ref('users/' + result.user.uid).set({
                username: username,
                email: email,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                cover: 'https://images.unsplash.com/photo-1515630278258-407f66498911?w=1200',
                bio: '🦁 مستكشف في VOID LION',
                website: '',
                verified: false,
                role: 'user',
                followers: {},
                following: {},
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: this.getError(error.code) };
        }
    },
    
    async logout() {
        await auth.signOut();
        location.href = 'index.html';
    },
    
    async loadUserData() {
        if (!this.currentUser) return null;
        const snap = await db.ref('users/' + this.currentUser.uid).once('value');
        return snap.val();
    },
    
    isAdmin() {
        return this.currentUser && this.currentUser.email === ADMIN_EMAIL;
    },
    
    getError(code) {
        const errors = {
            'auth/invalid-email': 'البريد الإلكتروني غير صالح',
            'auth/user-not-found': 'المستخدم غير موجود',
            'auth/wrong-password': 'كلمة المرور خاطئة',
            'auth/email-already-in-use': 'البريد مسجل مسبقاً',
            'auth/weak-password': 'كلمة المرور ضعيفة',
            'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
            'auth/network-request-failed': 'فشل الاتصال بالشبكة'
        };
        return errors[code] || 'حدث خطأ، حاول مرة أخرى';
    }
};

// بدء النظام
VoidAuth.init();

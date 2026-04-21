// VOID LION - Auth System
const VoidAuth = {
    currentUser: null,

    init() {
        auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            if (user) {
                document.getElementById('loadingStatus').textContent = '✅ تم تسجيل الدخول';
                if (window.location.pathname.includes('auth.html')) {
                    window.location.href = 'index.html';
                }
                await this.loadUserData();
            } else {
                if (!window.location.pathname.includes('auth.html')) {
                    window.location.href = 'auth.html';
                }
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
        
        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            await db.ref('users/' + result.user.uid).set({
                username, email,
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
        window.location.href = 'auth.html';
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
            'auth/invalid-email': 'البريد غير صالح',
            'auth/user-not-found': 'المستخدم غير موجود',
            'auth/wrong-password': 'كلمة مرور خاطئة',
            'auth/email-already-in-use': 'البريد مسجل مسبقاً',
            'auth/weak-password': 'كلمة مرور ضعيفة'
        };
        return errors[code] || 'حدث خطأ';
    }
};

VoidAuth.init();

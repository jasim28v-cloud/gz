// ==================== VOID_LION - AUTH SYSTEM ====================
const VoidAuth = {
    currentUser: null,

    init() {
        auth.onAuthStateChanged(user => {
            this.currentUser = user;
            if (user) {
                if (window.location.pathname.includes('auth.html')) {
                    window.location.href = 'index.html';
                }
                this.loadUserData();
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
            return { success: false, error: this.getArabicError(error.code) };
        }
    },

    async register(username, email, password) {
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
            return { success: false, error: this.getArabicError(error.code) };
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

    getArabicError(code) {
        const errors = {
            'auth/invalid-email': 'البريد الإلكتروني غير صالح',
            'auth/user-not-found': 'المستخدم غير موجود',
            'auth/wrong-password': 'كلمة المرور خاطئة',
            'auth/email-already-in-use': 'البريد مسجل مسبقاً',
            'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
            'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً'
        };
        return errors[code] || 'حدث خطأ، حاول مرة أخرى';
    },

    isAdmin() {
        return this.currentUser && this.currentUser.email === ADMIN_EMAIL;
    }
};

VoidAuth.init();

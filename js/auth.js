VoidAuth.init();
const VoidAuth = {
    currentUser: null,
    init() {
        auth.onAuthStateChanged(async user => {
            this.currentUser = user;
            if (user) {
                if (window.location.pathname.includes('auth.html')) location.href = 'index.html';
                if (user.email === ADMIN_EMAIL && document.getElementById('adminFAB')) {
                    document.getElementById('adminFAB').style.display = 'block';
                }
            } else {
                if (!window.location.pathname.includes('auth.html') && !window.location.pathname.includes('index.html')) {
                    location.href = 'auth.html';
                }
            }
        });
    },
    async login(email, password) {
        try { await auth.signInWithEmailAndPassword(email, password); return { success: true }; }
        catch(e) { return { success: false, error: this.getError(e.code) }; }
    },
    async register(username, email, password) {
        if (password.length < 6) return { success: false, error: 'كلمة المرور 6 أحرف على الأقل' };
        try {
            const res = await auth.createUserWithEmailAndPassword(email, password);
            await db.ref('users/' + res.user.uid).set({
                username, email,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
                cover: 'https://images.unsplash.com/photo-1515630278258-407f66498911?w=600',
                bio: '🦁 مستكشف في VOID LION', website: '', verified: false, role: 'user',
                followers: {}, following: {}, createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            return { success: true };
        } catch(e) { return { success: false, error: this.getError(e.code) }; }
    },
    async logout() { await auth.signOut(); location.href = 'auth.html'; },
    getError(code) {
        const e = { 'auth/invalid-email':'بريد غير صالح', 'auth/user-not-found':'مستخدم غير موجود', 'auth/wrong-password':'كلمة مرور خاطئة', 'auth/email-already-in-use':'البريد مسجل', 'auth/weak-password':'كلمة مرور ضعيفة' };
        return e[code] || 'حدث خطأ';
    }
};
VoidAuth.init();

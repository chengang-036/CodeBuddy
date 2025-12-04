// Firebase 配置文件
// 请在 Firebase Console 创建项目后，将配置信息填写在这里

const firebaseConfig = {
    // 从 Firebase Console 获取这些配置
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// 初始化 Firebase（如果还没初始化）
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 导出数据库和存储引用
const db = firebase.firestore ? firebase.firestore() : null;
const storage = firebase.storage ? firebase.storage() : null;

console.log('Firebase 配置已加载');

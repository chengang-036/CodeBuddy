// Firebase 配置文件
const firebaseConfig = {
  apiKey: "AIzaSyDceg98xycXnvhHL43aQsFCpbBioMY46wM",
  authDomain: "codebuddy-clothes.firebaseapp.com",
  projectId: "codebuddy-clothes",
  storageBucket: "codebuddy-clothes.firebasestorage.app",
  messagingSenderId: "879362298778",
  appId: "1:879362298778:web:3d8a841b0581843e1c2023"
};

// 初始化 Firebase
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase 初始化成功');
    }
    
    // 获取数据库和存储引用
    var db = firebase.firestore();
    var storage = firebase.storage();
    
    console.log('✅ Firestore 和 Storage 已就绪');
    console.log('Storage Bucket:', firebaseConfig.storageBucket);
} catch (error) {
    console.error('❌ Firebase 初始化失败:', error);
}

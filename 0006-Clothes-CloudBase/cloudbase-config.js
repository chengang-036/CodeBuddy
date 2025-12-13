// 腾讯云开发 CloudBase 配置文件
const cloudbaseConfig = {
    env: 'cloud1-2gldqcaoed8d0a9f'  // 你的云开发环境ID
};

// 初始化云开发
try {
    // 使用全局变量，以便其他页面可以访问
    window.app = cloudbase.init(cloudbaseConfig);
    
    // 获取数据库引用（根据官方文档）
    window.db = app.database();
    
    console.log('✅ 云开发初始化成功');
    console.log('环境ID:', cloudbaseConfig.env);
    
    // 检查登录状态并尝试匿名登录（根据官方文档）
    app.auth().getLoginState().then(loginState => {
        if (loginState) {
            console.log('✅ 已登录，用户ID:', loginState.user.uid);
        } else {
            console.log('⚠️ 未登录，尝试匿名登录...');
            // 根据官方文档：app.auth().signInAnonymously()
            return app.auth().signInAnonymously();
        }
    }).then(result => {
        if (result) {
            console.log('✅ 匿名登录成功');
            console.log('用户信息:', result);
        }
    }).catch(err => {
        console.error('❌ 登录失败:', err);
        
        // 检查是否是403错误（匿名登录未开启）
        if (err.code === 403 || (err.message && err.message.includes('403'))) {
            console.error('🔒 匿名登录未开启或权限不足');
            alert('❌ 匿名登录未开启！\n\n请前往云开发控制台开启：\n1. 打开 https://console.cloud.tencent.com/tcb\n2. 选择环境: cloud1-2gldqcaoed8d0a9f\n3. 用户管理 → 登录方式 → 匿名登录 → 开启');
        } else {
            console.error('登录错误详情:', err);
        }
    });
    
} catch (error) {
    console.error('❌ 云开发初始化失败:', error);
    alert('云开发初始化失败，请检查SDK是否正确加载');
}

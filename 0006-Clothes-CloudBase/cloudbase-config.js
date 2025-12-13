// 腾讯云开发 CloudBase 配置文件
// 请替换为你自己的环境ID
const cloudbaseConfig = {
    env: 'your-env-id'  // 替换为你的云开发环境ID，例如：'clothes-1g2h3i4j5k'
};

// 初始化云开发
try {
    const app = cloudbase.init(cloudbaseConfig);
    
    // 获取数据库和存储引用
    var db = app.database();
    var storage = app.uploadFile;
    var auth = app.auth();
    
    console.log('✅ 云开发初始化成功');
    console.log('环境ID:', cloudbaseConfig.env);
    
    // 检查登录状态
    auth.getLoginState().then(loginState => {
        if (loginState) {
            console.log('✅ 已登录，用户ID:', loginState.user.uid);
        } else {
            console.log('⚠️ 未登录，将使用匿名登录');
            // 自动进行匿名登录
            auth.anonymousAuthProvider().signIn().then(() => {
                console.log('✅ 匿名登录成功');
            }).catch(err => {
                console.error('❌ 匿名登录失败:', err);
            });
        }
    });
    
} catch (error) {
    console.error('❌ 云开发初始化失败:', error);
    alert('云开发初始化失败，请检查配置是否正确');
}

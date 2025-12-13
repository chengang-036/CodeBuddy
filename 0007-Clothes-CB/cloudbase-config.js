// 腾讯云开发 CloudBase 配置文件
// 参考官方文档: https://docs.cloudbase.net/api-reference/webv2/initialization

const cloudbaseConfig = {
    env: 'cloud1-2gldqcaoed8d0a9f',  // 你的云开发环境ID
    region: 'ap-shanghai'             // 可选，默认上海
};

// 初始化 CloudBase
let app, db, auth;

try {
    // 根据官方文档初始化
    app = cloudbase.init(cloudbaseConfig);
    
    // 获取数据库引用
    db = app.database();
    
    // 获取认证引用
    auth = app.auth();
    
    console.log('✅ CloudBase 初始化成功');
    console.log('环境ID:', cloudbaseConfig.env);
    console.log('地域:', cloudbaseConfig.region);
    
    // 检查登录状态并尝试匿名登录
    auth.getLoginState().then(loginState => {
        if (loginState) {
            console.log('✅ 已登录，用户ID:', loginState.user.uid);
        } else {
            console.log('⚠️ 未登录，尝试匿名登录...');
            // 根据官方文档：使用 signInAnonymously
            return auth.signInAnonymously();
        }
    }).then(result => {
        if (result) {
            console.log('✅ 匿名登录成功');
            console.log('用户信息:', result);
        }
    }).catch(err => {
        console.error('❌ 登录失败:', err);
        console.error('错误详情:', {
            code: err.code,
            message: err.message,
            requestId: err.requestId,
            fullError: JSON.stringify(err, null, 2)
        });
        
        // 403错误可能的原因：
        // 1. 匿名登录未开启
        // 2. 环境ID错误
        // 3. 域名安全配置未添加
        // 4. 环境状态异常
        
        if (err.code === 403 || (err.message && err.message.includes('403'))) {
            console.error('🔒 403权限错误 - 可能原因：');
            console.error('1. 匿名登录未开启或配置错误');
            console.error('2. Web安全域名未添加当前访问域名: ' + window.location.origin);
            console.error('3. 环境ID错误: ' + cloudbaseConfig.env);
            
            alert(`❌ CloudBase 403权限错误！

可能的原因和解决方法：

1️⃣ 检查匿名登录是否真的开启：
   https://console.cloud.tencent.com/tcb/user-auth
   选择环境：${cloudbaseConfig.env}
   确认"匿名登录"状态为"已开启"

2️⃣ 添加Web安全域名（重要！）：
   https://console.cloud.tencent.com/tcb/env/safety
   选择环境：${cloudbaseConfig.env}
   在"WEB安全域名"中添加：
   - http://43.143.57.182:8080
   - http://43.143.57.182
   
3️⃣ 确认环境ID正确：
   当前使用：${cloudbaseConfig.env}
   请在控制台确认环境ID是否匹配

4️⃣ 确认环境状态正常（非停服/欠费状态）`);
        }
    });
    
} catch (error) {
    console.error('❌ CloudBase 初始化失败:', error);
    alert('CloudBase初始化失败，请检查SDK是否正确加载');
}

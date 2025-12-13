// 腾讯云开发 CloudBase 配置文件
const cloudbaseConfig = {
    env: 'cloud1-2gldqcaoed8d0a9f'  // 你的云开发环境ID
};

// 初始化云开发
try {
    // 使用全局变量，以便其他页面可以访问
    window.app = cloudbase.init(cloudbaseConfig);
    
    // 获取数据库和存储引用
    var db = app.database();
    var storage = app.uploadFile;
    
    console.log('✅ 云开发初始化成功');
    console.log('环境ID:', cloudbaseConfig.env);
    console.log('⚠️ 未使用登录，请确保在云开发控制台设置了数据库权限：所有用户可读写');
    
} catch (error) {
    console.error('❌ 云开发初始化失败:', error);
    alert('云开发初始化失败，请检查配置是否正确');
}

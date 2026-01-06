// UniServe 一体化客服系统
// 数据管理和业务逻辑

class UniServeApp {
    constructor() {
        this.currentSession = null;
        this.sessions = [];
        this.messages = {};
        this.onlineStartTime = Date.now();
        this.currentTool = 'service';
        
        this.init();
    }

    init() {
        this.loadMockData();
        this.initEventListeners();
        this.startOnlineTimer();
        this.renderSessions();
        this.renderToolContent();
    }

    // 加载模拟数据
    loadMockData() {
        this.sessions = [
            {
                id: 'session1',
                customerName: '这是我的名称',
                customerId: 'C10001',
                avatar: '张',
                status: 'active',
                customerStatus: 'online',
                lastMessage: '您帮我查一下保单',
                lastSender: 'agent',
                time: '2分前',
                type: '保单查询',
                unreadCount: 1
            },
            {
                id: 'session2',
                customerName: '李四',
                customerId: 'C10002',
                avatar: '李',
                status: 'active',
                customerStatus: 'online',
                lastMessage: '理赔需要准备什么材料？',
                lastSender: 'customer',
                time: '10:18',
                type: '理赔咨询',
                unreadCount: 0
            },
            {
                id: 'session3',
                customerName: '王五',
                customerId: 'C10003',
                avatar: '王',
                status: 'queued',
                customerStatus: 'offline',
                lastMessage: '在线吗？',
                lastSender: 'customer',
                time: '10:12',
                type: '通用咨询',
                unreadCount: 2
            }
        ];

        // 模拟消息数据
        this.messages['session1'] = [
            {
                id: 'msg1',
                type: 'customer',
                content: '要找下个东西和他说',
                time: '9月14日 15:17:32',
                sender: '王小明',
                hasActions: true
            },
            {
                id: 'msg2',
                type: 'agent',
                content: '好的，马上办您处理',
                time: '9月14日 15:17:32',
                sender: '李四',
                quote: {
                    author: '王小明',
                    content: '要找下个东西和他说'
                }
            },
            {
                id: 'msg3',
                type: 'customer',
                content: '',
                isVoice: true,
                duration: '9"',
                time: '9月14日 15:17:32',
                sender: '王小明',
                hasActions: true
            },
            {
                id: 'msg4',
                type: 'customer',
                content: '要找下个东西和他说',
                time: '9月14日 15:17:32',
                sender: '王小明'
            }
        ];

        this.messages['session2'] = [
            {
                id: 'msg5',
                type: 'customer',
                content: '理赔需要准备什么材料？',
                time: '10:18:20',
                sender: '李四'
            },
            {
                id: 'msg6',
                type: 'agent',
                content: '您好！理赔材料通常包括：1.理赔申请书 2.保险合同 3.被保险人身份证明 4.医疗费用发票原件 5.病历资料。具体材料可能因险种不同有所差异，请问您购买的是什么险种？',
                time: '10:18:40',
                sender: '坐席001'
            }
        ];
    }

    // 初始化事件监听
    initEventListeners() {
        // 发送消息
        const btnSend = document.getElementById('btnSend');
        const messageInput = document.getElementById('messageInput');
        
        btnSend.addEventListener('click', () => this.sendMessage());
        messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 呼出/挂断
        document.getElementById('btnCall').addEventListener('click', () => this.handleCall());
        document.getElementById('btnHangup').addEventListener('click', () => this.handleHangup());

        // 管理员模式切换
        document.getElementById('adminMode').addEventListener('change', (e) => {
            this.toggleAdminMode(e.target.checked);
        });

        // 工具栏标签切换
        document.querySelectorAll('.tool-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTool(e.target.dataset.tool);
            });
        });

        // 标签页关闭
        document.querySelectorAll('.tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(e.target.closest('.tab').dataset.session);
            });
        });
    }

    // 渲染会话列表
    renderSessions() {
        const sessionList = document.getElementById('sessionList');
        sessionList.innerHTML = '';

        this.sessions.forEach(session => {
            const card = document.createElement('div');
            card.className = 'session-card';
            if (this.currentSession === session.id) {
                card.classList.add('active');
            }

            // 未读消息徽章
            const unreadBadge = session.unreadCount > 0 
                ? `<span class="unread-count">${session.unreadCount}</span>` 
                : '';

            card.innerHTML = `
                <div class="session-header">
                    <div class="customer-info">
                        <div class="customer-status-dot ${session.customerStatus}"></div>
                        <div class="customer-details">
                            <h4>${session.customerName}</h4>
                        </div>
                    </div>
                    <div class="session-time">${session.time}</div>
                </div>
                <div class="session-body">
                    <span class="agent-badge">坐席</span>
                    <span class="message-text">${session.lastMessage}</span>
                    ${unreadBadge}
                </div>
            `;

            card.addEventListener('click', () => this.selectSession(session.id));
            sessionList.appendChild(card);
        });

        // 更新排队数量和会话中数量
        const queueCount = this.sessions.filter(s => s.status === 'queued').length;
        const activeCount = this.sessions.filter(s => s.status === 'active').length;
        document.getElementById('queueCount').textContent = queueCount;
        document.getElementById('activeCount').textContent = activeCount;
    }

    // 选择会话
    selectSession(sessionId) {
        this.currentSession = sessionId;
        
        // 清除未读消息数
        const session = this.sessions.find(s => s.id === sessionId);
        if (session) {
            session.unreadCount = 0;
        }
        
        this.renderSessions();
        this.renderMessages();
    }

    // 渲染消息
    renderMessages() {
        const container = document.getElementById('messagesContainer');
        
        if (!this.currentSession || !this.messages[this.currentSession]) {
            container.innerHTML = `
                <div class="welcome-message">
                    <p>欢迎使用UniServe客服系统</p>
                    <p>请从左侧选择一个会话开始对话</p>
                </div>
            `;
            return;
        }

        const messages = this.messages[this.currentSession];
        container.innerHTML = '';

        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.type}`;

            const avatarUrl = msg.type === 'customer' 
                ? 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23667eea"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="white" font-size="40" font-weight="bold"%3E' + msg.sender.charAt(0) + '%3C/text%3E%3C/svg%3E'
                : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%231890ff"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="white" font-size="35"%3E%E5%9D%90%3C/text%3E%3C/svg%3E';

            let bubbleContent = '';
            
            // 语音消息
            if (msg.isVoice) {
                bubbleContent = `
                    <div class="voice-message">
                        <div class="voice-icon">🔊</div>
                        <div class="voice-duration">${msg.duration}</div>
                    </div>
                `;
            } else {
                // 普通文字消息
                if (msg.quote) {
                    bubbleContent += `
                        <div class="quote-message">
                            <div class="quote-author">${msg.quote.author}：${msg.quote.content}</div>
                        </div>
                    `;
                }
                bubbleContent += msg.content;
            }

            // 操作按钮
            let actionsHTML = '';
            if (msg.hasActions) {
                actionsHTML = `
                    <div class="message-actions">
                        <button class="message-action-btn" title="转接">转</button>
                        <button class="message-action-btn" title="复制">📋</button>
                    </div>
                `;
            }

            messageDiv.innerHTML = `
                <img class="message-avatar" src="${avatarUrl}" alt="${msg.sender}">
                <div class="message-content">
                    <div class="message-header">
                        <span>${msg.sender}</span>
                        <span>${msg.time}</span>
                    </div>
                    <div class="message-bubble">${bubbleContent}</div>
                    ${actionsHTML}
                </div>
            `;

            container.appendChild(messageDiv);
        });

        // 滚动到底部
        container.scrollTop = container.scrollHeight;
    }

    // 发送消息
    sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content) {
            alert('请输入消息内容');
            return;
        }

        if (!this.currentSession) {
            alert('请先选择一个会话');
            return;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });

        const message = {
            id: 'msg_' + Date.now(),
            type: 'agent',
            content: content,
            time: timeStr,
            sender: document.getElementById('agentName').textContent
        };

        if (!this.messages[this.currentSession]) {
            this.messages[this.currentSession] = [];
        }

        this.messages[this.currentSession].push(message);
        input.value = '';
        this.renderMessages();

        // 更新会话列表中的最后消息
        const session = this.sessions.find(s => s.id === this.currentSession);
        if (session) {
            session.lastMessage = content;
            session.lastSender = 'agent';
            session.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            this.renderSessions();
        }

        // 模拟客户回复
        setTimeout(() => {
            this.simulateCustomerReply();
        }, 2000);
    }

    // 模拟客户回复
    simulateCustomerReply() {
        if (!this.currentSession) return;

        const replies = [
            '好的，谢谢',
            '明白了',
            '还有其他问题吗？',
            '收到，感谢您的帮助',
            '我再想想'
        ];

        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
        const session = this.sessions.find(s => s.id === this.currentSession);

        const message = {
            id: 'msg_' + Date.now(),
            type: 'customer',
            content: replies[Math.floor(Math.random() * replies.length)],
            time: timeStr,
            sender: session ? session.customerName : '客户'
        };

        this.messages[this.currentSession].push(message);
        
        // 更新会话列表
        if (session) {
            session.lastMessage = message.content;
            session.lastSender = 'customer';
            session.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            // 如果不是当前会话，增加未读数
            if (this.currentSession !== session.id) {
                session.unreadCount = (session.unreadCount || 0) + 1;
            }
        }
        
        this.renderMessages();
        this.renderSessions();
    }

    // 呼出电话
    handleCall() {
        const btnCall = document.getElementById('btnCall');
        const btnHangup = document.getElementById('btnHangup');
        
        btnCall.disabled = true;
        btnHangup.disabled = false;
        
        alert('正在呼出...');
        
        setTimeout(() => {
            alert('通话已接通');
        }, 1500);
    }

    // 挂断电话
    handleHangup() {
        const btnCall = document.getElementById('btnCall');
        const btnHangup = document.getElementById('btnHangup');
        
        btnCall.disabled = false;
        btnHangup.disabled = true;
        
        alert('通话已结束');
    }

    // 切换管理员模式
    toggleAdminMode(enabled) {
        if (enabled) {
            console.log('已切换到管理员模式');
            // 这里可以添加管理员模式的特殊功能
        } else {
            console.log('已切换到普通模式');
        }
    }

    // 切换工具标签
    switchTool(toolName) {
        this.currentTool = toolName;
        
        document.querySelectorAll('.tool-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        document.querySelector(`[data-tool="${toolName}"]`).classList.add('active');
        this.renderToolContent();
    }

    // 渲染工具内容
    renderToolContent() {
        const container = document.getElementById('toolContent');
        
        const toolContents = {
            service: `
                <div class="tool-section">
                    <h4>快速服务</h4>
                    <div class="quick-links">
                        <div class="quick-link">客户资料</div>
                        <div class="quick-link">工单创建</div>
                        <div class="quick-link">投诉处理</div>
                        <div class="quick-link">业务办理</div>
                    </div>
                </div>
                <div class="tool-section">
                    <h4>常用模板</h4>
                    <div class="quick-links">
                        <div class="quick-link">问候语</div>
                        <div class="quick-link">结束语</div>
                        <div class="quick-link">致歉语</div>
                        <div class="quick-link">引导语</div>
                    </div>
                </div>
            `,
            policy: `
                <div class="tool-section">
                    <h4>保单查询</h4>
                    <div class="form-group">
                        <label class="form-label">保单号</label>
                        <input type="text" class="form-input" placeholder="请输入保单号">
                    </div>
                    <div class="form-group">
                        <label class="form-label">客户身份证号</label>
                        <input type="text" class="form-input" placeholder="请输入身份证号">
                    </div>
                    <button class="btn-primary" onclick="alert('查询功能开发中...')">查询</button>
                </div>
                <div class="tool-section" style="margin-top: 20px;">
                    <h4>保单信息</h4>
                    <div class="info-item">
                        <div class="info-label">保单号</div>
                        <div class="info-value">P2024001234</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">险种</div>
                        <div class="info-value">重大疾病保险</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">保额</div>
                        <div class="info-value">50万元</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">保单状态</div>
                        <div class="info-value">生效中</div>
                    </div>
                </div>
            `,
            practice: `
                <div class="tool-section">
                    <h4>业务实务</h4>
                    <div class="quick-links">
                        <div class="quick-link">理赔流程</div>
                        <div class="quick-link">投保规则</div>
                        <div class="quick-link">保全变更</div>
                        <div class="quick-link">续保办理</div>
                        <div class="quick-link">退保流程</div>
                        <div class="quick-link">受益人变更</div>
                    </div>
                </div>
                <div class="tool-section">
                    <h4>常见问题</h4>
                    <div class="info-item" style="cursor: pointer;">
                        <div class="info-value">如何办理理赔？</div>
                    </div>
                    <div class="info-item" style="cursor: pointer;">
                        <div class="info-value">理赔需要多长时间？</div>
                    </div>
                    <div class="info-item" style="cursor: pointer;">
                        <div class="info-value">如何查询保单？</div>
                    </div>
                </div>
            `,
            product: `
                <div class="tool-section">
                    <h4>产品分类</h4>
                    <div class="quick-links">
                        <div class="quick-link">重疾险</div>
                        <div class="quick-link">医疗险</div>
                        <div class="quick-link">寿险</div>
                        <div class="quick-link">意外险</div>
                        <div class="quick-link">年金险</div>
                        <div class="quick-link">财产险</div>
                    </div>
                </div>
                <div class="tool-section">
                    <h4>热门产品</h4>
                    <div class="info-item">
                        <div class="info-label">产品名称</div>
                        <div class="info-value">安康保重疾险</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">保障额度</div>
                        <div class="info-value">10万-100万</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">保障期限</div>
                        <div class="info-value">终身/定期可选</div>
                    </div>
                </div>
            `,
            message: `
                <div class="tool-section">
                    <h4>留言记录</h4>
                    <div class="form-group">
                        <label class="form-label">留言类型</label>
                        <select class="form-input">
                            <option>投诉</option>
                            <option>建议</option>
                            <option>咨询</option>
                            <option>其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">留言内容</label>
                        <textarea class="form-input" rows="4" placeholder="请输入留言内容"></textarea>
                    </div>
                    <button class="btn-primary" onclick="alert('留言已保存')">保存留言</button>
                </div>
                <div class="tool-section" style="margin-top: 20px;">
                    <h4>历史留言</h4>
                    <div class="info-item">
                        <div class="info-label">2024-12-25 14:30</div>
                        <div class="info-value">客户对服务态度表示满意</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">2024-12-24 10:15</div>
                        <div class="info-value">需要后续跟进理赔进度</div>
                    </div>
                </div>
            `,
            task: `
                <div class="tool-section">
                    <h4>待办任务</h4>
                    <div class="info-item" style="border-left: 3px solid #ff4d4f;">
                        <div class="info-label">紧急 - 今天 16:00</div>
                        <div class="info-value">回访客户张三理赔进度</div>
                    </div>
                    <div class="info-item" style="border-left: 3px solid #faad14;">
                        <div class="info-label">重要 - 明天 10:00</div>
                        <div class="info-value">处理客户李四的投诉工单</div>
                    </div>
                    <div class="info-item" style="border-left: 3px solid #52c41a;">
                        <div class="info-label">普通 - 本周五</div>
                        <div class="info-value">完成本月服务质量报告</div>
                    </div>
                </div>
                <div class="tool-section">
                    <h4>添加任务</h4>
                    <div class="form-group">
                        <label class="form-label">任务标题</label>
                        <input type="text" class="form-input" placeholder="请输入任务标题">
                    </div>
                    <div class="form-group">
                        <label class="form-label">截止时间</label>
                        <input type="datetime-local" class="form-input">
                    </div>
                    <button class="btn-primary" onclick="alert('任务已添加')">添加任务</button>
                </div>
            `
        };

        container.innerHTML = toolContents[this.currentTool] || toolContents.service;
    }

    // 关闭标签页
    closeTab(sessionId) {
        console.log('关闭标签页:', sessionId);
        // 这里可以添加关闭标签页的逻辑
    }

    // 在线时长计时器
    startOnlineTimer() {
        setInterval(() => {
            const elapsed = Date.now() - this.onlineStartTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            document.getElementById('onlineTime').textContent = timeStr;
        }, 1000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new UniServeApp();
});

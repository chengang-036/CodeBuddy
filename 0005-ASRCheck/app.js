// ==================== 全局状态 ====================
let currentUser = null;
let currentTask = null;
let currentTaskIndex = 0;
let taskQueue = [];
let annotations = [];
let selectedRange = null;
let overallRating = 0;
let audioContext = null;
let waveformData = null;

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // 显示登录框
    showLoginModal();
    
    // 初始化事件监听器
    initEventListeners();
    
    // 加载示例任务数据
    loadSampleTasks();
}

// ==================== 用户登录 ====================
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const role = document.getElementById('userRole').value;
    
    currentUser = { username, role };
    
    document.getElementById('userName').innerHTML = `标注员：<strong>${username}</strong>`;
    document.getElementById('logoutBtn').style.display = 'block';
    
    if (role === 'admin') {
        document.getElementById('adminPanel').style.display = 'block';
    }
    
    hideLoginModal();
    loadNextTask();
});

document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('确定要退出吗？未保存的标注将丢失。')) {
        currentUser = null;
        document.getElementById('userName').innerHTML = '标注员：<strong>未登录</strong>';
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'none';
        showLoginModal();
    }
});

// ==================== 任务管理 ====================
function loadSampleTasks() {
    // 示例任务数据
    taskQueue = [
        {
            task_id: 'case_001',
            audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            audio_file: 'report_001.mp3',
            case_time: '2024-01-15 14:30:00',
            asr_engine: 'AlibabaCloud ASR v3.2',
            asr_text: '喂你好我想报案就是昨天晚上大概十点钟左右吧我在小区停车场发现我的车被砸了前挡风玻璃碎了副驾驶的窗户也破了车里的东西也被翻得乱七八糟我的笔记本电脑和一些现金都不见了大概损失有一万多块钱吧对对监控我看了一下好像是坏的小区物业说他们会配合调查的嗯好的我在家等你们谢谢'
        },
        {
            task_id: 'case_002',
            audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            audio_file: 'report_002.mp3',
            case_time: '2024-01-15 15:45:00',
            asr_engine: 'AlibabaCloud ASR v3.2',
            asr_text: '警察同志我要报警我妈妈走失了她今年七十五岁了有老年痴呆今天上午九点多出门买菜到现在都没回来我们找了好几个小时了都没找到她穿着一件红色的羽绒服黑色裤子身高大概一米六左右头发花白对她可能不记得回家的路了我真的很担心麻烦你们帮帮忙'
        },
        {
            task_id: 'case_003',
            audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
            audio_file: 'report_003.mp3',
            case_time: '2024-01-15 16:20:00',
            asr_engine: 'AlibabaCloud ASR v3.2',
            asr_text: '你好我想咨询一下就是我在网上被骗了对方说是某个购物平台的客服说我的会员账号出现异常需要注销不然会影响征信让我按照他的指示操作结果我就把验证码告诉他了然后我的银行卡就被转走了五万块钱我现在该怎么办能追回来吗'
        }
    ];
}

function loadNextTask() {
    if (currentTaskIndex >= taskQueue.length) {
        alert('🎉 所有任务已完成！');
        return;
    }
    
    currentTask = taskQueue[currentTaskIndex];
    annotations = [];
    overallRating = 0;
    
    // 更新任务信息
    document.getElementById('taskId').textContent = currentTask.task_id;
    document.getElementById('audioFile').textContent = currentTask.audio_file;
    document.getElementById('caseTime').textContent = currentTask.case_time;
    document.getElementById('asrEngine').textContent = currentTask.asr_engine;
    document.getElementById('taskProgress').textContent = `${currentTaskIndex + 1} / ${taskQueue.length}`;
    
    // 加载文本
    document.getElementById('asrText').textContent = currentTask.asr_text;
    
    // 加载音频
    loadAudio(currentTask.audio_url);
    
    // 重置评分
    resetRating();
    
    // 清空标注列表
    updateAnnotationsList();
}

// ==================== 音频播放器 ====================
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const currentTimeSpan = document.getElementById('currentTime');
const durationSpan = document.getElementById('duration');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const playbackRate = document.getElementById('playbackRate');
const waveformCanvas = document.getElementById('waveformCanvas');
const playhead = document.getElementById('playhead');

function loadAudio(url) {
    audioPlayer.src = url;
    audioPlayer.load();
    
    // 生成波形图
    generateWaveform();
}

audioPlayer.addEventListener('loadedmetadata', function() {
    durationSpan.textContent = formatTime(audioPlayer.duration);
    progressBar.max = audioPlayer.duration;
});

audioPlayer.addEventListener('timeupdate', function() {
    currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
    progressBar.value = audioPlayer.currentTime;
    
    // 更新播放头位置
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    playhead.style.left = percent + '%';
});

audioPlayer.addEventListener('ended', function() {
    playPauseBtn.querySelector('.icon').textContent = '▶️';
});

playPauseBtn.addEventListener('click', togglePlayPause);

function togglePlayPause() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseBtn.querySelector('.icon').textContent = '⏸️';
    } else {
        audioPlayer.pause();
        playPauseBtn.querySelector('.icon').textContent = '▶️';
    }
}

progressBar.addEventListener('input', function() {
    audioPlayer.currentTime = progressBar.value;
});

volumeSlider.addEventListener('input', function() {
    const volume = volumeSlider.value / 100;
    audioPlayer.volume = volume;
    volumeValue.textContent = volumeSlider.value + '%';
});

playbackRate.addEventListener('change', function() {
    audioPlayer.playbackRate = parseFloat(playbackRate.value);
});

// 点击波形图跳转
waveformCanvas.addEventListener('click', function(e) {
    const rect = waveformCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audioPlayer.currentTime = audioPlayer.duration * percent;
});

function generateWaveform() {
    const canvas = waveformCanvas;
    const ctx = canvas.getContext('2d');
    
    // 设置canvas尺寸
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // 生成模拟波形数据
    const bars = 100;
    const barWidth = canvas.width / bars;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#667eea';
    
    for (let i = 0; i < bars; i++) {
        const height = Math.random() * canvas.height * 0.8;
        const x = i * barWidth;
        const y = (canvas.height - height) / 2;
        
        ctx.fillRect(x, y, barWidth - 2, height);
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==================== 文本标注 ====================
const asrTextContainer = document.getElementById('asrText');
const annotationToolbar = document.getElementById('annotationToolbar');

asrTextContainer.addEventListener('mouseup', handleTextSelection);
asrTextContainer.addEventListener('touchend', handleTextSelection);

function handleTextSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
        selectedRange = selection.getRangeAt(0);
        showAnnotationToolbar(selection);
    } else {
        hideAnnotationToolbar();
    }
}

function showAnnotationToolbar(selection) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    
    annotationToolbar.style.display = 'flex';
    annotationToolbar.style.left = rect.left + 'px';
    annotationToolbar.style.top = (rect.bottom + window.scrollY + 10) + 'px';
    
    // 确保工具栏在视口内
    setTimeout(() => {
        const toolbarRect = annotationToolbar.getBoundingClientRect();
        if (toolbarRect.right > window.innerWidth) {
            annotationToolbar.style.left = (window.innerWidth - toolbarRect.width - 20) + 'px';
        }
    }, 0);
}

function hideAnnotationToolbar() {
    annotationToolbar.style.display = 'none';
    document.getElementById('correctionInput').value = '';
}

// 错误类型按钮
document.querySelectorAll('.error-type-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const errorType = this.dataset.type;
        const color = this.dataset.color;
        addAnnotation(errorType, color);
    });
});

// 应用修正
document.getElementById('applyCorrection').addEventListener('click', function() {
    const correctedText = document.getElementById('correctionInput').value.trim();
    if (correctedText) {
        const lastAnnotation = annotations[annotations.length - 1];
        if (lastAnnotation) {
            lastAnnotation.corrected_text = correctedText;
            updateAnnotationsList();
        }
    }
});

// 删除标注
document.getElementById('removeAnnotation').addEventListener('click', function() {
    if (selectedRange) {
        removeAnnotationAtRange(selectedRange);
        hideAnnotationToolbar();
    }
});

function addAnnotation(errorType, color, correctedText = '') {
    if (!selectedRange) return;
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    // 获取选中文本在整个文本中的位置
    const fullText = asrTextContainer.textContent;
    const beforeText = selectedRange.startContainer.textContent.substring(0, selectedRange.startOffset);
    const start = fullText.indexOf(beforeText) + beforeText.length;
    const end = start + selectedText.length;
    
    // 创建高亮元素
    const span = document.createElement('span');
    span.className = 'annotation-highlight';
    span.style.backgroundColor = color;
    span.textContent = selectedText;
    span.dataset.start = start;
    span.dataset.end = end;
    span.dataset.errorType = errorType;
    
    // 替换选中的文本
    selectedRange.deleteContents();
    selectedRange.insertNode(span);
    
    // 保存标注
    const annotation = {
        id: Date.now(),
        start: start,
        end: end,
        text: selectedText,
        error_type: errorType,
        color: color,
        corrected_text: correctedText,
        annotator: currentUser ? currentUser.username : 'unknown'
    };
    
    annotations.push(annotation);
    
    // 更新标注列表
    updateAnnotationsList();
    
    // 清空选择
    selection.removeAllRanges();
    hideAnnotationToolbar();
}

function removeAnnotationAtRange(range) {
    const container = range.startContainer;
    let target = container;
    
    // 找到包含标注的span元素
    while (target && !target.classList?.contains('annotation-highlight')) {
        target = target.parentElement;
    }
    
    if (target && target.classList.contains('annotation-highlight')) {
        const start = parseInt(target.dataset.start);
        const end = parseInt(target.dataset.end);
        
        // 从标注数组中删除
        annotations = annotations.filter(a => !(a.start === start && a.end === end));
        
        // 替换为普通文本
        const textNode = document.createTextNode(target.textContent);
        target.parentElement.replaceChild(textNode, target);
        
        updateAnnotationsList();
    }
}

function updateAnnotationsList() {
    const listContainer = document.getElementById('annotationsList');
    const countSpan = document.getElementById('annotationCount');
    
    countSpan.textContent = annotations.length;
    
    if (annotations.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无标注</div>';
        return;
    }
    
    listContainer.innerHTML = annotations.map(ann => `
        <div class="annotation-item" style="border-left-color: ${ann.color}">
            <div class="annotation-item-content">
                <div class="annotation-item-text">"${ann.text}"</div>
                <div class="annotation-item-type">
                    ${ann.error_type}
                    ${ann.corrected_text ? ` → "${ann.corrected_text}"` : ''}
                </div>
            </div>
            <button class="annotation-item-delete" onclick="deleteAnnotation(${ann.id})">删除</button>
        </div>
    `).join('');
}

function deleteAnnotation(id) {
    // 从数组中删除
    annotations = annotations.filter(a => a.id !== id);
    
    // 从DOM中删除高亮
    const highlights = asrTextContainer.querySelectorAll('.annotation-highlight');
    highlights.forEach(highlight => {
        const ann = annotations.find(a => 
            a.start === parseInt(highlight.dataset.start) && 
            a.end === parseInt(highlight.dataset.end)
        );
        if (!ann) {
            const textNode = document.createTextNode(highlight.textContent);
            highlight.parentElement.replaceChild(textNode, highlight);
        }
    });
    
    updateAnnotationsList();
}

// ==================== 评分系统 ====================
const stars = document.querySelectorAll('.star');
const ratingValueSpan = document.getElementById('ratingValue');

stars.forEach(star => {
    star.addEventListener('click', function() {
        overallRating = parseInt(this.dataset.value);
        updateStarDisplay();
    });
    
    star.addEventListener('mouseenter', function() {
        const value = parseInt(this.dataset.value);
        stars.forEach((s, i) => {
            if (i < value) {
                s.textContent = '★';
                s.style.color = '#ffd700';
            } else {
                s.textContent = '☆';
                s.style.color = '#ddd';
            }
        });
    });
});

document.querySelector('.star-rating').addEventListener('mouseleave', function() {
    updateStarDisplay();
});

function updateStarDisplay() {
    stars.forEach((star, i) => {
        if (i < overallRating) {
            star.textContent = '★';
            star.classList.add('active');
        } else {
            star.textContent = '☆';
            star.classList.remove('active');
        }
    });
    
    ratingValueSpan.textContent = overallRating > 0 ? `${overallRating} 分` : '未评分';
}

function resetRating() {
    overallRating = 0;
    updateStarDisplay();
}

// ==================== 提交和跳过 ====================
document.getElementById('submitBtn').addEventListener('click', submitTask);
document.getElementById('skipBtn').addEventListener('click', showSkipModal);

function submitTask() {
    if (overallRating === 0) {
        if (!confirm('您还未评分，确定要提交吗？')) {
            return;
        }
    }
    
    // 构建提交数据
    const result = {
        task_id: currentTask.task_id,
        annotations: annotations,
        overall_rating: overallRating,
        annotator: currentUser ? currentUser.username : 'unknown',
        submitted_at: new Date().toISOString()
    };
    
    // 保存到localStorage（实际应用中应该发送到后端）
    saveResult(result);
    
    // 显示提示
    showToast('✅ 提交成功！');
    
    // 加载下一个任务
    currentTaskIndex++;
    setTimeout(() => {
        loadNextTask();
    }, 500);
}

function showSkipModal() {
    document.getElementById('skipModal').style.display = 'flex';
}

document.getElementById('cancelSkip').addEventListener('click', function() {
    document.getElementById('skipModal').style.display = 'none';
});

document.getElementById('skipForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const reason = document.getElementById('skipReason').value.trim();
    
    const skipData = {
        task_id: currentTask.task_id,
        skipped: true,
        skip_reason: reason,
        annotator: currentUser ? currentUser.username : 'unknown',
        skipped_at: new Date().toISOString()
    };
    
    saveResult(skipData);
    
    document.getElementById('skipModal').style.display = 'none';
    document.getElementById('skipReason').value = '';
    
    showToast('⏭️ 已跳过');
    
    currentTaskIndex++;
    setTimeout(() => {
        loadNextTask();
    }, 500);
});

function saveResult(result) {
    const results = JSON.parse(localStorage.getItem('asrCheckResults') || '[]');
    results.push(result);
    localStorage.setItem('asrCheckResults', JSON.stringify(results));
}

// ==================== 键盘快捷键 ====================
document.addEventListener('keydown', function(e) {
    // 空格键：播放/暂停
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        togglePlayPause();
    }
    
    // 数字键1-5：快速标注
    if (selectedRange && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const errorTypes = [
            { type: '漏转', color: '#ff6b6b' },
            { type: '错转', color: '#ffa500' },
            { type: '多转', color: '#90ee90' },
            { type: '标点错误', color: '#87ceeb' },
            { type: '分词错误', color: '#dda0dd' }
        ];
        const index = parseInt(e.key) - 1;
        if (errorTypes[index]) {
            addAnnotation(errorTypes[index].type, errorTypes[index].color);
        }
    }
    
    // Ctrl+S：提交
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        submitTask();
    }
    
    // Ctrl+N：下一题
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (confirm('确定要跳过当前任务吗？')) {
            currentTaskIndex++;
            loadNextTask();
        }
    }
});

// ==================== 管理员功能 ====================
document.getElementById('showAdminBtn')?.addEventListener('click', function() {
    const adminContent = document.getElementById('adminContent');
    adminContent.style.display = adminContent.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('uploadTasksBtn')?.addEventListener('click', function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const tasks = JSON.parse(event.target.result);
                taskQueue = tasks;
                currentTaskIndex = 0;
                loadNextTask();
                showToast('✅ 任务加载成功！');
            } catch (error) {
                alert('❌ JSON格式错误：' + error.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
});

document.getElementById('exportDataBtn')?.addEventListener('click', function() {
    const results = JSON.parse(localStorage.getItem('asrCheckResults') || '[]');
    
    if (results.length === 0) {
        alert('暂无数据可导出');
        return;
    }
    
    // 导出JSON
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asr_check_results_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showToast('✅ 数据已导出！');
});

document.getElementById('viewStatsBtn')?.addEventListener('click', function() {
    const results = JSON.parse(localStorage.getItem('asrCheckResults') || '[]');
    
    if (results.length === 0) {
        alert('暂无统计数据');
        return;
    }
    
    // 统计错误类型
    const errorStats = {};
    let totalAnnotations = 0;
    let totalRating = 0;
    let ratedCount = 0;
    
    results.forEach(result => {
        if (result.annotations) {
            result.annotations.forEach(ann => {
                errorStats[ann.error_type] = (errorStats[ann.error_type] || 0) + 1;
                totalAnnotations++;
            });
        }
        if (result.overall_rating) {
            totalRating += result.overall_rating;
            ratedCount++;
        }
    });
    
    const avgRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(2) : 'N/A';
    
    let statsText = `📊 统计报表\n\n`;
    statsText += `总任务数: ${results.length}\n`;
    statsText += `总标注数: ${totalAnnotations}\n`;
    statsText += `平均评分: ${avgRating}\n\n`;
    statsText += `错误类型分布:\n`;
    
    Object.entries(errorStats).forEach(([type, count]) => {
        statsText += `  ${type}: ${count} (${(count/totalAnnotations*100).toFixed(1)}%)\n`;
    });
    
    alert(statsText);
});

// ==================== 工具函数 ====================
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 3000;
        font-size: 14px;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// 点击其他区域隐藏工具栏
document.addEventListener('click', function(e) {
    if (!annotationToolbar.contains(e.target) && !asrTextContainer.contains(e.target)) {
        hideAnnotationToolbar();
    }
});

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==================== 初始化事件监听器 ====================
function initEventListeners() {
    // 已在各个功能模块中定义
    console.log('✅ 事件监听器初始化完成');
}

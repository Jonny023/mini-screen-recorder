let mediaRecorder = null;
let recordedChunks = [];
let startTime = null;
let pausedTime = 0;
let pauseStartTime = null;
let timerInterval = null;
let isRecording = false;
let isPaused = false;

const toggleButton = document.getElementById('toggleRecording');
const stopButton = document.getElementById('stopRecording');
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.querySelector('.status-text');
const timerDisplay = document.querySelector('.timer');

// 更新计时器显示
function updateTimer() {
    if (!startTime) return;
    
    const timerElement = document.querySelector('.timer');
    let currentTime = Date.now();
    let elapsedTime;

    if (isPaused) {
        // 如果是暂停状态，使用暂停时的时间
        elapsedTime = pauseStartTime - startTime - pausedTime;
    } else {
        // 正常录制状态，减去累计的暂停时间
        elapsedTime = currentTime - startTime - pausedTime;
    }

    // 转换为秒
    const seconds = Math.floor(elapsedTime / 1000);
    // 格式化时间
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    // 格式化显示
    timerElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// 开始录制
async function startRecording() {
    try {
        // 获取录制源
        const sources = await window.recorderAPI.startRecording();
        if (!sources || !sources.screen) return;

        // 获取屏幕流
        const screenStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sources.screen.id,
                    maxWidth: 1920,
                    maxHeight: 1080
                }
            }
        });

        // 配置录制选项
        const options = {
            mimeType: 'video/webm;codecs=vp8',
            videoBitsPerSecond: 2500000
        };

        mediaRecorder = new MediaRecorder(screenStream, options);
        recordedChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        // 设置初始状态
        startTime = Date.now();
        pausedTime = 0;
        isPaused = false;
        isRecording = true;

        // 启动录制和计时器
        mediaRecorder.start(1000);
        timerInterval = setInterval(updateTimer, 1000);

        // 更新 UI
        statusIndicator.classList.add('recording');
        statusText.textContent = '录制中';
        toggleButton.textContent = '暂停';
        stopButton.disabled = false;

        // 添加停止流��处理
        mediaRecorder.onstop = () => {
            screenStream.getTracks().forEach(track => track.stop());
        };

    } catch (error) {
        console.error('录制失败:', error);
        alert('无法开始录制: ' + error.message);
        resetRecordingState();
    }
}

// 暂停录制
function pauseRecording() {
    if (!mediaRecorder || !isRecording || isPaused) return;

    isPaused = true;
    pauseStartTime = Date.now();
    mediaRecorder.pause();

    // 更新 UI
    statusIndicator.classList.remove('recording');
    statusIndicator.classList.add('paused');
    statusText.textContent = '已暂停';
    toggleButton.textContent = '继续';
}

// 继续录制
function resumeRecording() {
    if (!mediaRecorder || !isRecording || !isPaused) return;

    // 计算暂停时间
    pausedTime += Date.now() - pauseStartTime;
    isPaused = false;
    pauseStartTime = null;
    
    mediaRecorder.resume();

    // 更新 UI
    statusIndicator.classList.remove('paused');
    statusIndicator.classList.add('recording');
    statusText.textContent = '录制中';
    toggleButton.textContent = '暂停';
}

// 停止录制
async function stopRecording() {
    if (!mediaRecorder) return;

    return new Promise((resolve) => {
        mediaRecorder.onstop = async () => {
            clearInterval(timerInterval);
            
            try {
                const filePath = await window.recorderAPI.saveRecording();
                if (filePath) {
                    const blob = new Blob(recordedChunks, {
                        type: 'video/webm'
                    });
                    
                    const arrayBuffer = await blob.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const array = Array.from(uint8Array);
                    
                    await window.recorderAPI.writeFile(filePath, array);
                    alert('录制已保存');
                }
            } catch (error) {
                console.error('保存失败:', error);
                alert('保存失败: ' + error.message);
            }
            
            resetRecordingState();
            resolve();
        };
        
        mediaRecorder.stop();
    });
}

// 重置录制状态
function resetRecordingState() {
    mediaRecorder = null;
    recordedChunks = [];
    statusIndicator.classList.remove('recording', 'paused');
    statusText.textContent = '就绪';
    toggleButton.textContent = '开始录制';
    stopButton.disabled = true;
    timerDisplay.textContent = '00:00:00';
    clearInterval(timerInterval);
    
    // 重置所有状态��量
    isRecording = false;
    isPaused = false;
    pausedTime = 0;
    startTime = null;
    pauseStartTime = null;
}

// 处理录制状态切换
function handleRecordingState() {
    console.log('处理录制状态切换', { isRecording, isPaused });
    
    if (!isRecording) {
        // 开始新录制
        startRecording();
    } else if (isPaused) {
        // 继续录制
        resumeRecording();
    } else {
        // 暂停录制
        pauseRecording();
    }
}

// 监听按钮点击事件
toggleButton.addEventListener('click', handleRecordingState);
stopButton.addEventListener('click', stopRecording);

// 监听快捷键事件
window.recorderAPI.onToggleRecordingState(() => {
    console.log('收到切换录制状态事件');
    handleRecordingState();
});

window.recorderAPI.onStopRecordingState(() => {
    console.log('收到停止录制事件');
    if (mediaRecorder) {
        stopRecording();
    }
}); 
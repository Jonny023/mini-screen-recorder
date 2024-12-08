const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, dialog, desktopCapturer, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const nativeImage = require('electron').nativeImage;

let mainWindow;
let tray = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload/preload.js'),
            webSecurity: true,
            enableRemoteModule: false,
            backgroundThrottling: false,
            offscreen: false
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        return { action: 'deny' };
    });

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomFactor(1);
        mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    });

    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['media'];
        callback(allowedPermissions.includes(permission));
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.hide();
        if (app.isReady()) {
            new Notification({
                title: 'Mini Screen Recorder',
                body: '应用程序已最小化到系统托盘'
            }).show();
        }
    });

    mainWindow.webContents.on('did-finish-load', () => {
        registerShortcuts();
    });

    mainWindow.on('closed', () => {
        // 清理任何你可能使用的资源
        // 比如停止录屏、释放内存等
    });

    // 启用硬件加速
    app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
    app.commandLine.appendSwitch('enable-accelerated-video');
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
    app.commandLine.appendSwitch('enable-zero-copy');
}

// 修改 createTray 函数
function createTray() {
    try {
        if (tray !== null) {
            tray.destroy();
            tray = null;
        }

        tray = new Tray(nativeImage.createEmpty());

        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示主窗口',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: '开始/暂停录制',
                click: () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('toggle-recording-state');
                    }
                }
            },
            {
                label: '停止并保存',
                click: () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('stop-recording-state');
                    }
                }
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => {
                    app.isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('Mini Screen Recorder');
        tray.setContextMenu(contextMenu);

        console.log('[成功] 托盘创建成功');
    } catch (error) {
        console.error('[错误] 创建托盘失败:', error);
    }
}

// 注册全局快捷键
function registerShortcuts() {
    try {
        globalShortcut.unregisterAll();

        // F1: 切换录制状态（开/暂停）
        const registeredF1 = globalShortcut.register('F1', () => {
            console.log('[快捷键] 触发 F1 快捷键');
            if (!mainWindow || mainWindow.webContents.isLoading()) return;
            mainWindow.webContents.send('toggle-recording-state');
            mainWindow.show();
            mainWindow.focus();
        });

        // F2: 停止录制
        const registeredF2 = globalShortcut.register('F2', () => {
            console.log('[快捷键] 触发 F2 快捷键');
            if (!mainWindow || mainWindow.webContents.isLoading()) return;
            mainWindow.webContents.send('stop-recording-state');
            mainWindow.show();
            mainWindow.focus();
        });

        if (!registeredF1 || !registeredF2) {
            throw new Error('[错误] 快捷键注册失败');
        }

        console.log('[成功] 快捷键注册成功');
    } catch (error) {
        console.error('[错误] 快捷键注册失败:', error);
    }
}

// 处理开始录制请求
ipcMain.handle('start-recording', async () => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 0, height: 0 }  // 不需要缩略图
        });

        if (sources.length === 0) {
            throw new Error('没有找到可用的屏幕源');
        }

        // 只返回必要的信息
        return {
            screen: {
                id: sources[0].id,
                name: sources[0].name
            }
        };
    } catch (error) {
        console.error('[错误] 获取录制源失败:', error);
        throw error;
    }
});

// 修改保存文件请求处
ipcMain.handle('save-recording', async () => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存录制文件',
        defaultPath: `screen-recording-${Date.now()}.webm`,
        filters: [
            { name: '视频文件', extensions: ['webm'] }
        ]
    });

    return filePath;
});

// 处理文件请求
ipcMain.handle('write-file', async (event, filePath, array) => {
    try {
        // 将数组换回 Buffer
        const buffer = Buffer.from(array);
        await fs.promises.writeFile(filePath, buffer);
        return true;
    } catch (error) {
        console.error('文件写入失败:', error);
        throw error;
    }
});

app.whenReady().then(async () => {
    try {
        await createWindow();
        // 延迟创建托盘，确保应用完全初始化
        setTimeout(() => {
            createTray();
        }, 1000);
    } catch (error) {
        console.error('[错误] 应用程序启动失败:', error);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
    if (tray) {
        try {
            tray.destroy();
            tray = null;
        } catch (error) {
            console.error('[错误] 销毁托盘失败:', error);
        }
    }
}); 
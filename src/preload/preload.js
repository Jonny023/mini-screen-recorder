const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recorderAPI', {
    startRecording: () => ipcRenderer.invoke('start-recording'),
    saveRecording: () => ipcRenderer.invoke('save-recording'),
    writeFile: (filePath, array) => ipcRenderer.invoke('write-file', filePath, array),
    onToggleRecordingState: (callback) => ipcRenderer.on('toggle-recording-state', callback),
    onStopRecordingState: (callback) => ipcRenderer.on('stop-recording-state', callback)
}); 
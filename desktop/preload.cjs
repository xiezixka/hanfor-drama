const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('hanforDesktop', {
  platform: process.platform,
})

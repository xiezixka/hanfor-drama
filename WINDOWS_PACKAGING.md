# 涵锋AI Windows 安装包

这个项目可以封装成 Windows 桌面软件。安装后用户点击桌面图标，应用会自动启动本地服务并打开桌面窗口，不需要手动运行 Docker 或命令。

## 推荐构建方式

因为项目包含 SQLite、Sharp 等原生模块，Windows 安装包建议在 Windows 电脑或 GitHub Actions 的 Windows 环境里构建。

## 在 Windows 本机打包

1. 安装 Node.js 20。
2. 在项目根目录执行：

```bash
npm install
npm ci --prefix frontend
npm ci --prefix backend
npm run dist:win
```

打包脚本会先编译前后端，再把 SQLite、Sharp 这类原生模块重建为 Electron 可用的 Windows 版本。生成的安装包在：

```text
release/涵锋AI-1.0.0-Setup.exe
```

## 用 GitHub Actions 打包

仓库里已经加入工作流：

```text
.github/workflows/windows-desktop.yml
```

推到 GitHub 后，手动运行 `Build Desktop Apps`，完成后在 Artifacts 里下载 Windows 安装包。

## 数据保存位置

安装包不会内置当前电脑里的项目数据和 API Key。用户在 Windows 上使用时，数据会保存在该用户自己的应用数据目录里：

```text
%APPDATA%/涵锋AI/data
```

包括数据库、上传图片、生成音频、生成视频和合成视频。

## 已处理的桌面版差异

- 桌面窗口会自动寻找可用端口，默认从 `5679` 开始。
- 后端数据库和上传文件改为保存到 Windows 用户数据目录。
- Skills 文件首次启动会复制到用户数据目录，后续可在应用内修改。
- 打包时会带上 FFmpeg，用于配音合成和视频拼接。

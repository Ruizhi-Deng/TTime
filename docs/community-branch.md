# TTime Community

当前分支 `reverse-0915` 基于公开的 0.9.2 源码，提供单用户本地版本。

## 第二阶段已完成

- 删除账户、登录、会员、设备绑定、云端配置和云端历史。
- 删除依赖上游服务的 TTime 翻译、TTime AI、在线 OCR 和内置小牛共享密钥。
- 删除上游自动更新、登录回调 HTTP 服务和使用事件上报。
- 保留用户自备密钥的翻译与 OCR 服务、本地离线 OCR、快捷键、截图、划词、窗口与代理设置。
- 翻译历史只保存到本机，取消原有 30 条限制。

应用名称为 **TTime Community**，使用独立应用标识与本地数据目录。首次启动生成新配置；不导入、迁移或兼容旧版配置与历史。Windows 默认数据目录为 `%APPDATA%/TTime Community/`。用户需要重新填写密钥和设置偏好。Windows 安装程序默认安装到当前用户。

初始翻译服务为 Google 内置翻译、Bing 词典和 DeepL 内置翻译，初始 OCR 为本地 TTime OCR。云端账户与同步功能没有替代实现。

## 构建和验证

Windows 使用 Node.js 16.20.2 与 Python 3.10：

```sh
npm ci --legacy-peer-deps
npm run modules-update
npm run test:local
npm run build
npx electron-builder --win nsis --config --publish never
npx electron-builder --win portable --config --publish never
```

GitHub Actions 生成 `TTime-windows-community`，包括安装程序与便携程序。`test:local` 验证历史保存、异步结果更新、超过 30 条历史以及删除后的计数。编译和打包不代替 Windows 上的快捷键、截图与本地 OCR 实测。

## 后续阶段

第三阶段：多 AI 实例、自定义 OpenAI 接口与模型、本地提示词，以及 Ollama、Gemini、智谱和 DeepLX。

第四阶段：恢复 PP-OCRv4 与结构化 OCR 输出，处理模型缓存、文本框合并和英文空格。

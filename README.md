# TTime Community 1.0.0

单用户本地翻译与 OCR 桌面应用，基于 [TTime](https://github.com/InkTimeRecord/TTime) 公开的 0.9.2 源码维护。

[下载 Windows 安装版与便携版](https://github.com/Ruizhi-Deng/TTime/releases/latest) · [配置与构建说明](docs/community-branch.md) · [1.0.0 更新说明](docs/releases/v1.0.0.md)

## 主要功能

- 输入、划词、截图翻译，截图 OCR 与静默 OCR，全局快捷键、窗口钉住和本地历史。
- 18 个翻译源，包括 OpenAI 兼容接口、DeepSeek、Gemini、智谱 GLM 和常用翻译 API / 内置源。
- AI 多实例、自定义接口与模型、流式响应、本地系统 / 用户提示词。
- 本地 PP-OCRv4 与多语言 OCR，识别框、置信度、段落合并和模型缓存。中英模型随程序提供。
- 配置、密钥与历史保存在本机，无账户、会员、云同步及上游自动更新。

Windows 默认数据目录为 `%APPDATA%/TTime Community/`。从官方 TTime 切换时重新配置；已有 Community 配置使用同一目录。

## 开发

维护分支为 `reverse-0915`。Windows 构建使用 Node.js 16.20.2、Python 3.10；完整步骤见 [构建说明](docs/community-branch.md#构建和验证)。GitHub Actions 运行验证并生成安装版与便携版。

## 许可与归属

保留上游 [TTime 许可](LICENSE.txt)。OCR 模型及算法来源与许可见 [OCR 说明](docs/community-branch.md#第四阶段已完成) 和 `ocr/` 下的 PaddleOCR、RapidOCR 许可文件。

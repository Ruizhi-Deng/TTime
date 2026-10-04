# 0.9.15 段落合并核查

核查对象是用户提供的 TTime 0.9.15 安装包，以及本仓库的 1.0.0 源码。

## 能确认的部分

- 原版 OCR 窗口的 renderer 保存 `ocrSegmentMergeStatus` 开关，显示“使用自研算法，将 OCR 结果智能分段”的说明。
- 原版 `out/main/index.jsc` 可提取出服务方法名 `ocrLineMerge` 和请求路径 `translate/ocr/segmentMerge/`。
- 原版结果处理附近可提取出 `ocrVo`、`lineInfoList`、`ocrServiceType`、`ocrServiceLanguageType`、`ocrTextList` 和 `mergedText`。
- 原版 renderer 从 `updateOcrTextInfo(ocrVo)` 接收结果，显示 `ocrVo.allText`。

这些证据支持“客户端识别 → 调用服务端合并 → 接收合并文本 → 显示”的链路。客户端主程序是 V8 cached bytecode；字符串证据尚不足以确认完整请求 JSON、字段类型或每条控制分支。

## 尚不能确认的部分

安装包未包含该接口的服务端源码。不能仅据客户端符号确定服务端使用几何规则、文本规则、机器学习或 LLM，也不能恢复其具体阈值、分栏逻辑或断词规则。官网与上游 0.9.12 发布说明只将其描述为自研智能分段，没有公开算法细节。

因此当前版本的段落合并是独立的本地实现，不能描述成恢复了原版合并算法。

## 当前实现

`src/common/ocr/OcrResult.ts` 的 `composeOcrResult` 按行框位置排序；依据行高、行间距、左对齐、同一行的水平间距、列表前缀和旋转情况决定是否合并。`joinText` 连接中英文，并保留必要空格。该规则不使用远程服务或 LLM。
